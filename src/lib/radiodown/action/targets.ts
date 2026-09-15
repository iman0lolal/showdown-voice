/**
 * Showdown target encoding (SIM-PROTOCOL.md).
 *
 * Singles: never send a TARGETSPEC.
 * Doubles/Triples:
 *   +N  foe slot (1-based)
 *   -N  ally slot (1-based)
 *
 * Layout (doubles, your perspective):
 *   +2 +1
 *   -1 -2
 */

export type ActionTarget =
  | { kind: "none" }
  | { kind: "self" }
  | { kind: "auto" }
  | { kind: "foe"; slot: number }
  | { kind: "ally"; slot: number };

/** Move target field from |request|.active[].moves[].target */
export type RequestTarget =
  | "normal"
  | "any"
  | "adjacentFoe"
  | "adjacentAlly"
  | "adjacentAllyOrSelf"
  | "adjacentPokemon"
  | "allAdjacent"
  | "allAdjacentFoes"
  | "allySide"
  | "foeSide"
  | "allyTeam"
  | "self"
  | "all"
  | "randomNormal"
  | "scripted"
  | string;

export function targetIsChosen(target: RequestTarget | undefined): boolean {
  switch (target) {
    case "normal":
    case "any":
    case "adjacentFoe":
    case "adjacentAlly":
    case "adjacentAllyOrSelf":
    case "adjacentPokemon":
      return true;
    default:
      return false;
  }
}

export function encodeTargetSpec(target: ActionTarget | undefined): string {
  if (!target || target.kind === "none" || target.kind === "auto" || target.kind === "self") return "";
  if (target.kind === "foe") return `+${target.slot}`;
  if (target.kind === "ally") return `-${target.slot}`;
  return "";
}

export function parseSpokenTarget(raw: string): ActionTarget | undefined {
  const text = raw.toLowerCase();
  if (/\b(aliado|ally|partner|compañero)\b/.test(text)) return { kind: "ally", slot: 1 };
  const foeSlot = text.match(/\b(?:rival|foe|enemy|slot)\s*([12])\b/);
  if (foeSlot) return { kind: "foe", slot: Number(foeSlot[1]) };
  if (/\b(izquierda|left)\b/.test(text)) return { kind: "foe", slot: 2 };
  if (/\b(derecha|right)\b/.test(text)) return { kind: "foe", slot: 1 };
  return undefined;
}
