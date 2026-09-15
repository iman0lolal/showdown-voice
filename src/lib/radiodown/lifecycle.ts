/**
 * Explicit app lifecycle. Connection and battle are separate so a demo
 * without a socket can still run the voice loop, and iOS / Chrome can
 * drive the same guards from their shells.
 *
 * requireConfirm is not a field here: sending /choose is only legal from
 * ACTION_PENDING_CONFIRMATION after an explicit confirm event.
 */

export type ConnectionPhase =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "AUTHENTICATING"
  | "IDLE"
  | "SEARCHING"
  | "JOINING"
  | "RECONNECTING"
  | "ERROR";

export type BattlePhase =
  | "IDLE"
  | "BATTLE_FOUND"
  | "WAITING_FOR_REQUEST"
  | "AWAITING_USER_ACTION"
  | "CLARIFYING"
  | "ACTION_PENDING_CONFIRMATION"
  | "EXECUTING"
  | "WAITING_FOR_RESULT"
  | "BATTLE_FINISHED";

export type AppPhase = ConnectionPhase | BattlePhase;

export interface ExecutionGate {
  connection?: ConnectionPhase;
  battle: BattlePhase;
  ended: boolean;
  hasLiveRequest: boolean;
  lastSentRqid?: number;
  currentRqid?: number;
}

export type GateResult = { ok: true } | { ok: false; reason: string };

const BLOCKED_CONNECTION: ConnectionPhase[] = ["DISCONNECTED", "CONNECTING", "RECONNECTING", "ERROR"];

export function canSendChoose(gate: ExecutionGate): GateResult {
  if (gate.ended || gate.battle === "BATTLE_FINISHED") {
    return { ok: false, reason: "La batalla ya terminó." };
  }
  if (gate.connection && BLOCKED_CONNECTION.includes(gate.connection)) {
    return { ok: false, reason: "No hay conexión con Showdown." };
  }
  if (gate.battle === "WAITING_FOR_RESULT" || gate.battle === "EXECUTING") {
    return { ok: false, reason: "Ya hay una acción enviada. Espera el resultado." };
  }
  if (gate.battle !== "ACTION_PENDING_CONFIRMATION") {
    return { ok: false, reason: "Nada confirmado para enviar." };
  }
  if (!gate.hasLiveRequest) {
    return { ok: false, reason: "No hay |request| pendiente." };
  }
  if (
    gate.lastSentRqid != null &&
    gate.currentRqid != null &&
    gate.lastSentRqid === gate.currentRqid
  ) {
    return { ok: false, reason: "Ese rqid ya se envió." };
  }
  return { ok: true };
}

export function canProposeAction(gate: Pick<ExecutionGate, "battle" | "ended" | "hasLiveRequest">): GateResult {
  if (gate.ended || gate.battle === "BATTLE_FINISHED") {
    return { ok: false, reason: "La batalla ya terminó." };
  }
  if (gate.battle === "WAITING_FOR_RESULT" || gate.battle === "EXECUTING") {
    return { ok: false, reason: "Esperando el resultado del turno. No puedo elegir otra vez." };
  }
  if (!gate.hasLiveRequest) {
    return { ok: false, reason: "No es tu turno (no hay |request|)." };
  }
  if (
    gate.battle !== "AWAITING_USER_ACTION" &&
    gate.battle !== "CLARIFYING" &&
    gate.battle !== "ACTION_PENDING_CONFIRMATION" &&
    gate.battle !== "IDLE"
  ) {
    return { ok: false, reason: "Ahora no se puede proponer una acción." };
  }
  return { ok: true };
}

/** Map the voice-loop phase names used by the UI. */
export function battlePhaseFromSession(
  phase: string,
  ended: boolean,
  hasRequest: boolean,
): BattlePhase {
  if (ended || phase === "ended") return "BATTLE_FINISHED";
  switch (phase) {
    case "confirming":
      return "ACTION_PENDING_CONFIRMATION";
    case "executing":
      return "EXECUTING";
    case "waiting_result":
      return "WAITING_FOR_RESULT";
    case "clarifying":
      return "CLARIFYING";
    case "awaiting_command":
      return "AWAITING_USER_ACTION";
    case "narrating":
      return hasRequest ? "AWAITING_USER_ACTION" : "WAITING_FOR_REQUEST";
    default:
      return hasRequest ? "AWAITING_USER_ACTION" : "IDLE";
  }
}
