import type { PlayerId, SlotLetter } from "./ids.ts";

export type StatusId = "brn" | "par" | "slp" | "frz" | "psn" | "tox" | "fnt";

export type StatName = "atk" | "def" | "spa" | "spd" | "spe" | "accuracy" | "evasion";

export type GameType = "singles" | "doubles" | "triples" | "multi" | "freeforall";

export interface HpState {
  current: number;
  max: number;
  /** 0–100. Uses HP Percentage Mod when max is 100. */
  percent: number;
}

export interface KnownMove {
  id: string;
  name: string;
  pp?: number;
  maxPp?: number;
  disabled?: boolean;
  target?: string;
}

export interface StatBoosts {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  accuracy: number;
  evasion: number;
}

export const EMPTY_BOOSTS: StatBoosts = {
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
  accuracy: 0,
  evasion: 0,
};

export interface PokemonState {
  /** Stable key: player + slot-or-species. */
  key: string;
  player: PlayerId;
  slot?: SlotLetter;
  nickname: string;
  species: string;
  level: number;
  gender?: "M" | "F";
  shiny: boolean;
  teraType?: string;
  terastallized: boolean;
  hp: HpState;
  status?: StatusId;
  item?: string | null;
  itemKnown: boolean;
  ability?: string;
  abilityKnown: boolean;
  moves: KnownMove[];
  boosts: StatBoosts;
  fainted: boolean;
  active: boolean;
  volatiles: string[];
  types?: string[];
}

export interface SideHazards {
  stealthRock: boolean;
  spikes: number;
  toxicSpikes: number;
  stickyWeb: boolean;
}

export interface SideState {
  player: PlayerId;
  name: string;
  avatar?: string;
  rating?: number;
  teamSize: number;
  pokemon: PokemonState[];
  hazards: SideHazards;
  sideConditions: string[];
}

export interface WeatherState {
  id: string;
  name: string;
}

export interface FieldState {
  weather?: WeatherState;
  terrain?: string;
  trickRoom: boolean;
  tailwind: { p1: boolean; p2: boolean };
}

export type RequestKind = "move" | "switch" | "team" | "wait";

export interface RequestMove {
  move: string;
  id: string;
  pp: number;
  maxpp: number;
  target: string;
  disabled: boolean;
}

export interface ActiveRequest {
  moves: RequestMove[];
  canMegaEvo?: boolean;
  canMegaEvoX?: boolean;
  canMegaEvoY?: boolean;
  canUltraBurst?: boolean;
  canZMove?: boolean;
  canDynamax?: boolean;
  canTerastallize?: string | boolean;
  trapped?: boolean;
  maybeTrapped?: boolean;
}

export interface SidePokemonRequest {
  ident: string;
  details: string;
  condition: string;
  active: boolean;
  stats?: Record<string, number>;
  moves: string[];
  baseAbility?: string;
  item?: string;
  pokeball?: string;
  ability?: string;
  teraType?: string;
  terastallized?: string | boolean;
}

export interface ChoiceRequest {
  kind: RequestKind;
  rqid?: number;
  wait?: boolean;
  teamPreview?: boolean;
  forceSwitch?: boolean[];
  active?: ActiveRequest[];
  side?: {
    name: string;
    id: PlayerId;
    pokemon: SidePokemonRequest[];
  };
  noCancel?: boolean;
}

export type BattleAction =
  | {
      type: "move";
      move: string;
      moveId: string;
      slot?: number;
      mega?: boolean;
      megax?: boolean;
      megay?: boolean;
      zmove?: boolean;
      dynamax?: boolean;
      terastallize?: boolean;
      target?: string;
    }
  | { type: "switch"; pokemon: string; slot?: number }
  | { type: "team"; order: string }
  | { type: "pass" }
  | { type: "undo" }
  | { type: "default" };

export interface ValidationResult {
  ok: boolean;
  action?: BattleAction;
  choose?: string;
  reason?: string;
  ambiguous?: string[];
  needsClarification?: string;
}

export interface BattleEvent {
  type: string;
  args: string[];
  kwArgs: Record<string, string>;
  raw: string;
}

export interface BattleState {
  roomId?: string;
  gen: number;
  format: string;
  gameType: GameType;
  rated: boolean;
  rules: string[];
  turn: number;
  started: boolean;
  ended: boolean;
  winner?: string;
  p1: SideState;
  p2: SideState;
  field: FieldState;
  request: ChoiceRequest | null;
  /** Whose private info we have (`side.id` from the latest request). */
  perspective: PlayerId | null;
  log: BattleEvent[];
  lastTurnSummary: string[];
}

export type VoiceIntent =
  | { kind: "query"; topic: "opponent" | "options" | "moves" | "team" | "situation" | "recommend" }
  | { kind: "action"; action: BattleAction; raw: string }
  | { kind: "confirm" }
  | { kind: "deny" }
  | { kind: "cancel" }
  | { kind: "repeat" }
  | { kind: "accept_recommendation" }
  | { kind: "unclear"; guess?: string; raw: string };

export type SessionPhase =
  | "idle"
  | "narrating"
  | "awaiting_command"
  | "clarifying"
  | "confirming"
  | "executing"
  | "waiting_result"
  | "ended";

export interface PendingConfirmation {
  action: BattleAction;
  choose: string;
  spoken: string;
  source: "user" | "recommendation";
}

export interface VoiceSessionSnapshot {
  phase: SessionPhase;
  state: BattleState;
  lastNarration: string;
  lastHeard?: string;
  pending?: PendingConfirmation;
  recommendation?: { action: BattleAction; why: string; spoken: string };
  clarification?: string;
  error?: string;
}
