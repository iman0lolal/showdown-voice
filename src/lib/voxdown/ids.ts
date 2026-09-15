/** Pokémon Showdown toId — lowercase alphanumeric only. */
export function toId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function toUserId(name: string): string {
  return toId(name);
}

export type PlayerId = "p1" | "p2" | "p3" | "p4";
export type SlotLetter = "a" | "b" | "c";

export interface PokemonIdent {
  player: PlayerId;
  slot?: SlotLetter;
  nickname: string;
  raw: string;
}

const PLAYER_RE = /^(p[1-4])([a-c])?(?::\s*(.*))?$/;

export function parsePokemonIdent(raw: string): PokemonIdent {
  const trimmed = raw.trim();
  const match = PLAYER_RE.exec(trimmed);
  if (!match) {
    return { player: "p1", nickname: trimmed, raw: trimmed };
  }
  const player = match[1] as PlayerId;
  const slot = (match[2] as SlotLetter | undefined) || undefined;
  const nickname = (match[3] ?? "").trim();
  return { player, slot, nickname, raw: trimmed };
}

export function identKey(ident: PokemonIdent): string {
  return `${ident.player}${ident.slot ?? ""}:${toId(ident.nickname)}`;
}

export function isPlayerId(value: string): value is PlayerId {
  return value === "p1" || value === "p2" || value === "p3" || value === "p4";
}
