import { BattleEngine, createBattleState } from "../battle/engine.ts";
import { parseProtocolPayload } from "../protocol/parse-line.ts";
import { validateAndChoose } from "../action/choose.ts";
import { recommend, type RuleRecommendation } from "../recommend/rules.ts";
import { battlePhaseFromSession, canProposeAction, canSendChoose } from "../lifecycle.ts";
import type { ConnectionPhase } from "../lifecycle.ts";
import type {
  BattleAction,
  BattleState,
  PendingConfirmation,
  SessionPhase,
  VoiceSessionSnapshot,
} from "../types.ts";
import { parseVoiceCommand } from "./parser.ts";
import { actionSpeech, narrateOpponent, narrateOptions, narrateSituation } from "./narrator.ts";

export interface SessionConfig {
  lang: "es" | "en";
  /**
   * Security invariant. Always true in production.
   * There is no "auto battle" switch.
   */
  readonly requireConfirm: true;
  confirmTimeoutMs: number;
}

const DEFAULT_CONFIG: SessionConfig = {
  lang: "es",
  requireConfirm: true,
  confirmTimeoutMs: 12000,
};

export interface SessionReply {
  speak: string;
  snapshot: VoiceSessionSnapshot;
  execute?: string;
}

/**
 * Turn conversation controller.
 * Recommendations never execute. Ambiguous STT never clicks.
 * /choose is emitted only from ACTION_PENDING_CONFIRMATION after "sí".
 */
export class VoiceSession {
  readonly engine: BattleEngine;
  config: SessionConfig;
  phase: SessionPhase = "idle";
  connectionPhase: ConnectionPhase = "DISCONNECTED";
  lastNarration = "";
  lastHeard?: string;
  pending?: PendingConfirmation;
  recommendation?: RuleRecommendation;
  clarification?: string;
  error?: string;
  lastSentRqid?: number;
  lastSentChoose?: string;
  onExecute?: (choose: string) => void;

  constructor(engine?: BattleEngine, config?: Partial<Pick<SessionConfig, "lang" | "confirmTimeoutMs">>) {
    this.engine = engine ?? new BattleEngine();
    this.config = { ...DEFAULT_CONFIG, ...config, requireConfirm: true };
  }

  get state(): BattleState {
    return this.engine.state;
  }

  ingest(payload: string): SessionReply | null {
    const chunks = parseProtocolPayload(payload);
    for (const chunk of chunks) this.engine.feed(chunk.events, chunk.roomId);
    if (this.state.ended) {
      this.phase = "ended";
      this.pending = undefined;
      return this.speakNow(narrateSituation(this.state, this.config.lang));
    }
    if (this.state.request && this.state.request.kind !== "wait") {
      if (this.state.request.rqid != null && this.state.request.rqid === this.lastSentRqid) {
        this.phase = "waiting_result";
        return null;
      }
      this.recommendation = recommend(this.state, this.config.lang) ?? undefined;
      this.phase = "awaiting_command";
      this.pending = undefined;
      return this.speakNow(narrateSituation(this.state, this.config.lang));
    }
    if (this.state.request?.kind === "wait") {
      this.phase = "waiting_result";
    }
    return null;
  }

  /**
   * After a socket drop: reset engine and replay the protocol log.
   * Showdown re-sends the battle log + current |request| on `/join ROOM`.
   */
  restoreFromLog(payload: string): SessionReply | null {
    const roomId = this.state.roomId;
    const lang = this.config.lang;
    this.engine.state = createBattleState();
    if (roomId) this.engine.state.roomId = roomId;
    this.pending = undefined;
    this.lastSentChoose = undefined;
    this.lastSentRqid = undefined;
    this.phase = "idle";
    this.config = { ...this.config, lang, requireConfirm: true };
    return this.ingest(payload);
  }

  hear(utterance: string): SessionReply {
    this.lastHeard = utterance;
    this.error = undefined;
    const intent = parseVoiceCommand(utterance, {
      state: this.state,
      request: this.state.request,
      lastRecommendation: this.recommendation?.action,
    });

    if (intent.kind === "repeat") {
      return this.speakNow(this.lastNarration || narrateSituation(this.state, this.config.lang));
    }
    if (intent.kind === "query") {
      const text =
        intent.topic === "opponent"
          ? narrateOpponent(this.state, this.config.lang)
          : intent.topic === "options" || intent.topic === "moves"
            ? narrateOptions(this.state, this.config.lang)
            : intent.topic === "recommend"
              ? this.speakRecommendation()
              : narrateSituation(this.state, this.config.lang);
      return this.speakNow(text);
    }
    if (intent.kind === "cancel" || intent.kind === "deny") {
      this.pending = undefined;
      if (this.state.ended) this.phase = "ended";
      else if (this.state.request && this.state.request.kind !== "wait") this.phase = "awaiting_command";
      const msg = this.config.lang === "en" ? "Cancelled. What do you want to do?" : "Cancelado. ¿Qué quieres hacer?";
      return this.speakNow(msg);
    }
    if (intent.kind === "confirm") {
      return this.confirmPending();
    }
    if (intent.kind === "accept_recommendation") {
      if (!this.recommendation) {
        const msg =
          this.config.lang === "en" ? "I don't have a recommendation yet." : "Todavía no tengo una recomendación.";
        return this.speakNow(msg);
      }
      return this.propose(this.recommendation.action, "recommendation");
    }
    if (intent.kind === "unclear") {
      this.phase = "clarifying";
      const msg =
        this.config.lang === "en"
          ? `I didn't catch a legal action. ${narrateOptions(this.state, "en")}`
          : `No he entendido una acción legal. ${narrateOptions(this.state, "es")}`;
      return this.speakNow(msg);
    }
    if (intent.kind === "action") {
      if (intent.action.type === "switch" && !intent.action.pokemon) {
        this.phase = "clarifying";
        const msg = this.config.lang === "en" ? "Switch to which Pokémon?" : "¿A qué Pokémon?";
        this.clarification = msg;
        return this.speakNow(msg);
      }
      return this.propose(intent.action, "user");
    }
    return this.speakNow(this.config.lang === "en" ? "Say that again?" : "¿Puedes repetirlo?");
  }

  confirmPending(): SessionReply {
    const gate = canSendChoose({
      connection: this.connectionPhase === "DISCONNECTED" ? undefined : this.connectionPhase,
      battle: battlePhaseFromSession(this.phase, this.state.ended, Boolean(this.state.request)),
      ended: this.state.ended,
      hasLiveRequest: Boolean(this.state.request && this.state.request.kind !== "wait"),
      lastSentRqid: this.lastSentRqid,
      currentRqid: this.state.request?.rqid,
    });
    if (!this.pending || !gate.ok) {
      const msg =
        !this.pending
          ? this.config.lang === "en"
            ? "Nothing to confirm. Tell me a move or a switch."
            : "No hay nada que confirmar. Dime un movimiento o un cambio."
          : gate.ok
            ? ""
            : gate.reason;
      return this.speakNow(msg);
    }
    const choose = this.pending.choose;
    const rqid = this.state.request?.rqid;
    this.pending = undefined;
    this.phase = "executing";
    this.lastSentChoose = choose;
    this.lastSentRqid = rqid;
    this.onExecute?.(choose);
    const speak = this.config.lang === "en" ? "Executing." : "Ejecutando.";
    const reply = this.speakNow(speak, choose);
    this.phase = "waiting_result";
    this.engine.state.request = null;
    return reply;
  }

  snapshot(): VoiceSessionSnapshot {
    return {
      phase: this.phase,
      state: this.state,
      lastNarration: this.lastNarration,
      lastHeard: this.lastHeard,
      pending: this.pending,
      recommendation: this.recommendation
        ? {
            action: this.recommendation.action,
            why: this.recommendation.reason,
            spoken: this.recommendation.spoken,
            confidence: this.recommendation.confidence,
          }
        : undefined,
      clarification: this.clarification,
      error: this.error,
      lastSentRqid: this.lastSentRqid,
    };
  }

  private propose(action: BattleAction, source: "user" | "recommendation"): SessionReply {
    const proposeGate = canProposeAction({
      battle: battlePhaseFromSession(this.phase, this.state.ended, Boolean(this.state.request)),
      ended: this.state.ended,
      hasLiveRequest: Boolean(this.state.request && this.state.request.kind !== "wait"),
    });
    if (!proposeGate.ok) {
      this.error = proposeGate.reason;
      return this.speakNow(proposeGate.reason);
    }
    const check = validateAndChoose(action, this.state.request, {
      ended: this.state.ended,
      gameType: this.state.gameType,
      lastSentRqid: this.lastSentRqid,
      perspective: this.state.perspective,
    });
    if (!check.ok || !check.action || !check.choose) {
      this.phase = "clarifying";
      const msg = check.needsClarification ?? check.reason ?? "No puedo ejecutar eso.";
      this.clarification = msg;
      this.error = check.reason;
      return this.speakNow(msg);
    }
    const spoken = actionSpeech(check.action, this.config.lang);
    this.pending = { action: check.action, choose: check.choose, spoken, source };
    this.phase = "confirming";
    const ask = this.config.lang === "en" ? `${spoken} Confirm?` : `${spoken} ¿Confirmas?`;
    return this.speakNow(ask);
  }

  private speakRecommendation(): string {
    this.recommendation = recommend(this.state, this.config.lang) ?? undefined;
    if (!this.recommendation) {
      return this.config.lang === "en"
        ? "I don't have enough information for a rule-based recommendation."
        : "No tengo información suficiente para una recomendación.";
    }
    const tail =
      this.config.lang === "en" ? " What do you want to do?" : " ¿Qué quieres hacer?";
    return this.recommendation.spoken + tail;
  }

  private speakNow(text: string, execute?: string): SessionReply {
    this.lastNarration = text;
    return { speak: text, snapshot: this.snapshot(), execute };
  }
}
