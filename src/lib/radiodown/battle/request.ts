import { isPlayerId, type PlayerId } from "../ids.ts";
import type { ActiveRequest, ChoiceRequest, RequestKind, RequestMove, SidePokemonRequest } from "../types.ts";

interface RawRequest {
  wait?: boolean;
  teamPreview?: boolean;
  forceSwitch?: boolean[];
  active?: Array<RawActive | null>;
  side?: {
    name?: string;
    id?: string;
    pokemon?: RawSidePokemon[];
  };
  rqid?: number | string;
  noCancel?: boolean;
}

interface RawActive {
  moves?: Array<RawMove | string>;
  canMegaEvo?: boolean;
  canMegaEvoX?: boolean;
  canMegaEvoY?: boolean;
  canUltraBurst?: boolean;
  canZMove?: unknown;
  canDynamax?: boolean;
  canTerastallize?: string | boolean;
  trapped?: boolean;
  maybeTrapped?: boolean;
}

interface RawMove {
  move?: string;
  id?: string;
  pp?: number;
  maxpp?: number;
  target?: string;
  disabled?: boolean;
}

interface RawSidePokemon {
  ident?: string;
  details?: string;
  condition?: string;
  active?: boolean;
  stats?: Record<string, number>;
  moves?: string[];
  baseAbility?: string;
  item?: string;
  pokeball?: string;
  ability?: string;
  teraType?: string;
  terastallized?: string | boolean;
}

export function parseChoiceRequest(json: string): ChoiceRequest | null {
  const trimmed = json.trim();
  if (!trimmed || trimmed === "null") return null;
  let raw: RawRequest;
  try {
    raw = JSON.parse(trimmed) as RawRequest;
  } catch {
    return null;
  }
  let kind: RequestKind = "move";
  if (raw.wait) kind = "wait";
  else if (raw.teamPreview) kind = "team";
  else if (raw.forceSwitch?.some(Boolean)) kind = "switch";

  const active: ActiveRequest[] | undefined = raw.active
    ?.filter((a): a is RawActive => a != null)
    .map((a) => ({
      moves: (a.moves ?? []).map(normalizeMove),
      canMegaEvo: a.canMegaEvo,
      canMegaEvoX: a.canMegaEvoX,
      canMegaEvoY: a.canMegaEvoY,
      canUltraBurst: a.canUltraBurst,
      canZMove: Boolean(a.canZMove),
      canDynamax: a.canDynamax,
      canTerastallize: a.canTerastallize,
      trapped: a.trapped,
      maybeTrapped: a.maybeTrapped,
    }));

  const sidePokemon: SidePokemonRequest[] = (raw.side?.pokemon ?? []).map((p) => ({
    ident: p.ident ?? "",
    details: p.details ?? "",
    condition: p.condition ?? "",
    active: Boolean(p.active),
    stats: p.stats,
    moves: p.moves ?? [],
    baseAbility: p.baseAbility,
    item: p.item,
    pokeball: p.pokeball,
    ability: p.ability,
    teraType: p.teraType,
    terastallized: p.terastallized,
  }));

  const sideId = raw.side?.id;
  const side = raw.side
    ? {
        name: raw.side.name ?? "",
        id: (isPlayerId(sideId ?? "") ? sideId : "p1") as PlayerId,
        pokemon: sidePokemon,
      }
    : undefined;

  const rqid = raw.rqid == null ? undefined : Number(raw.rqid);

  return {
    kind,
    rqid: Number.isFinite(rqid) ? rqid : undefined,
    wait: raw.wait,
    teamPreview: raw.teamPreview,
    forceSwitch: raw.forceSwitch,
    active,
    side,
    noCancel: raw.noCancel,
  };
}

function normalizeMove(move: RawMove | string): RequestMove {
  if (typeof move === "string") {
    return {
      move,
      id: move.toLowerCase().replace(/[^a-z0-9]+/g, ""),
      pp: 0,
      maxpp: 0,
      target: "normal",
      disabled: false,
    };
  }
  const name = move.move ?? move.id ?? "";
  return {
    move: name,
    id: (move.id ?? name).toLowerCase().replace(/[^a-z0-9]+/g, ""),
    pp: move.pp ?? 0,
    maxpp: move.maxpp ?? 0,
    target: move.target ?? "normal",
    disabled: Boolean(move.disabled),
  };
}
