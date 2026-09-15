export { toId, parsePokemonIdent, identKey } from "./ids.ts";
export type { PlayerId } from "./ids.ts";
export type {
  BattleState,
  BattleAction,
  MoveAction,
  SwitchAction,
  ChoiceRequest,
  VoiceIntent,
  VoiceSessionSnapshot,
  SessionPhase,
  PokemonState,
  SideState,
  ActionTarget,
} from "./types.ts";
export { parseProtocolLine, parseProtocolPayload } from "./protocol/parse-line.ts";
export { BattleEngine, createBattleState, activePokemon, opponentPlayer, youPlayer } from "./battle/engine.ts";
export { parseChoiceRequest } from "./battle/request.ts";
export { parseHpStatus } from "./battle/hp.ts";
export { parseVoiceCommand } from "./voice/parser.ts";
export { VoiceSession } from "./voice/session.ts";
export { narrateSituation, narrateOpponent, narrateOptions, actionSpeech } from "./voice/narrator.ts";
export { validateAndChoose } from "./action/choose.ts";
export { encodeTargetSpec, targetIsChosen } from "./action/targets.ts";
export { recommend } from "./recommend/rules.ts";
export type { RuleRecommendation } from "./recommend/rules.ts";
export {
  SHOWDOWN_WS,
  encodeClientMessage,
  chooseMessage,
  parseChallstr,
  trnCommand,
  parseLoginResponse,
  websocketUrl,
  reconnectCommands,
  isTransportFrame,
  KEEPALIVE_CMD,
  parseUpdateSearch,
  battleRoomsFromSearch,
  planVoiceBattleJoin,
  joinBattleCommand,
  isBattleRoomId,
} from "./showdown/client.ts";
export type { UpdateSearch, BattleRoomRef, VoiceBattleJoinPlan } from "./showdown/client.ts";
export {
  canSendChoose,
  canProposeAction,
  battlePhaseFromSession,
} from "./lifecycle.ts";
export type { ConnectionPhase, BattlePhase, AppPhase } from "./lifecycle.ts";
