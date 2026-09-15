import { BattleEngine } from "../battle/engine.ts";
import { parseProtocolPayload } from "../protocol/parse-line.ts";
import { validateAndChoose } from "../action/choose.ts";
import { recommend, type RuleRecommendation } from "../recommend/rules.ts";
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
  /** Always confirm irreversible actions. Default true. */
  requireConfirm: boolean;
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
 * Never auto-executes a recommendation. Ambiguous STT never clicks.
 */
export class VoiceSession {
  readonly engine: BattleEngine;
  config: SessionConfig;
  phase: SessionPhase = "idle";
  lastNarration = "";
  lastHeard?: string;
  pending?: PendingConfirmation;
  recommendation?: RuleRecommendation;
  clarification?: string;
  error?: string;
  onExecute?: (choose: string) => void;

  constructor(engine?: BattleEngine, config?: Partial<SessionConfig>) {
    this.engine = engine ?? new BattleEngine();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get state(): BattleState {
    return this.engine.state;
  }

  ingest(payload: string): SessionReply | null {
    const chunks = parseProtocolPayload(payload);
    for (const chunk of chunks) this.engine.feed(chunk.events, chunk.roomId);
    if (this.state.ended) {
      this.phase = "ended";
      return this.speakNow(narrateSituation(this.state, this.config.lang));
    }
    if (this.state.request && this.state.request.kind !== "wait") {
      this.recommendation = recommend(this.state, this.config.lang) ?? undefined;
      this.phase = "awaiting_command";
      this.pending = undefined;
      return this.speakNow(narrateSituation(this.state, this.config.lang));
    }
    return null;
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
      this.phase = "awaiting_command";
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
    if (!this.pending) {
      const msg =
        this.config.lang === "en"
          ? "Nothing to confirm. Tell me a move or a switch."
          : "No hay nada que confirmar. Dime un movimiento o un cambio.";
      return this.speakNow(msg);
    }
    const choose = this.pending.choose;
    this.pending = undefined;
    this.phase = "executing";
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
            why: this.recommendation.why,
            spoken: this.recommendation.spoken,
          }
        : undefined,
      clarification: this.clarification,
      error: this.error,
    };
  }

  private propose(action: BattleAction, source: "user" | "recommendation"): SessionReply {
    const check = validateAndChoose(action, this.state.request);
    if (!check.ok || !check.action || !check.choose) {
      this.phase = "clarifying";
      const msg = check.needsClarification ?? check.reason ?? "No puedo ejecutar eso.";
      this.clarification = msg;
      this.error = check.reason;
      return this.speakNow(msg);
    }
    const spoken = actionSpeech(check.action, this.config.lang);
    if (!this.config.requireConfirm) {
      this.pending = { action: check.action, choose: check.choose, spoken, source };
      return this.confirmPending();
    }
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
