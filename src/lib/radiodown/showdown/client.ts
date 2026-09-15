/**
 * Pokémon Showdown protocol helpers. No DOM, no WebSocket constructor.
 * The transport lives in the app shell (web / iOS / Chrome).
 */

export {
  DEFAULT_SERVER,
  websocketUrl,
  parseDefaultServerFromConfigJs,
  isTransportFrame,
  joinBattleCommand,
  reconnectCommands,
  KEEPALIVE_CMD,
  KEEPALIVE_MS,
  LOGIN_API,
  UPKEEP_API,
  GETASSERTION_API,
  CLIENT_CONFIG_URL,
} from "./server.ts";
export type { SimServer } from "./server.ts";
import { LOGIN_API, UPKEEP_API, GETASSERTION_API, websocketUrl } from "./server.ts";

export const SHOWDOWN_WS = websocketUrl();
export const SHOWDOWN_LOGIN = LOGIN_API;
export const SHOWDOWN_UPKEEP = UPKEEP_API;
export const SHOWDOWN_ASSERTION = GETASSERTION_API;

export interface ShowdownLoginResult {
  username: string;
  assertion: string;
  named: boolean;
}

export function encodeClientMessage(roomId: string, text: string): string {
  return `${roomId}|${text}`;
}

export function chooseMessage(roomId: string, chooseCmd: string): string {
  const body = chooseCmd.startsWith("/") ? chooseCmd : `/choose ${chooseCmd}`;
  return encodeClientMessage(roomId, body);
}

export function parseChallstr(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|challstr|")) return null;
  return trimmed.slice("|challstr|".length);
}

export function trnCommand(username: string, assertion: string): string {
  return `|trn ${username},0,${assertion}`;
}

export function parseUpdateuser(line: string): { username: string; named: boolean } | null {
  if (!line.startsWith("|updateuser|")) return null;
  const parts = line.split("|");
  return { username: parts[2] ?? "", named: parts[3] === "1" };
}

export function parseLoginResponse(body: string): ShowdownLoginResult | { error: string } {
  const jsonText = body.startsWith("]") ? body.slice(1) : body;
  let data: {
    assertion?: string;
    actionsuccess?: boolean;
    curuser?: { loggedin?: boolean; username?: string };
    username?: string;
    error?: string;
  };
  try {
    data = JSON.parse(jsonText) as typeof data;
  } catch {
    return { error: "Respuesta de login ilegible." };
  }
  if (data.error) return { error: data.error };
  const assertion = data.assertion ?? "";
  if (!assertion || assertion === ";") {
    return { error: "Showdown no devolvió una assertion válida." };
  }
  const username = data.curuser?.username ?? data.username ?? "";
  return {
    username,
    assertion,
    named: Boolean(data.curuser?.loggedin),
  };
}

/**
 * `|updatesearch|JSON` — current ladder searches and rooms this user is in.
 * Official PROTOCOL.md: games is `{roomid: title}` or `null`. Includes
 * non-Pokémon rooms (Mafia, etc). Sent on login and whenever search/games change.
 *
 * This is how START VOICE BATTLE finds the active battle without typing an ID:
 * log in as the same named account that started the fight in Safari, then
 * `/join` the `battle-*` room listed here. A User may have multiple Connections.
 */
export interface UpdateSearch {
  searching: string[];
  games: Record<string, string> | null;
}

export interface BattleRoomRef {
  roomId: string;
  title: string;
}

export type VoiceBattleJoinPlan =
  | { action: "join"; roomId: string; title: string }
  | { action: "choose"; battles: BattleRoomRef[] }
  | { action: "searching"; formats: string[] }
  | { action: "none" };

export function parseUpdateSearch(line: string): UpdateSearch | null {
  const trimmed = line.trim();
  const marker = "|updatesearch|";
  const idx = trimmed.indexOf(marker);
  if (idx < 0) return null;
  const json = trimmed.slice(idx + marker.length);
  try {
    const data = JSON.parse(json) as { searching?: unknown; games?: unknown };
    const searching = Array.isArray(data.searching) ? data.searching.map(String) : [];
    if (data.games == null) return { searching, games: null };
    if (typeof data.games !== "object" || Array.isArray(data.games)) {
      return { searching, games: null };
    }
    const games: Record<string, string> = {};
    for (const [key, value] of Object.entries(data.games as Record<string, unknown>)) {
      games[key] = String(value);
    }
    return { searching, games };
  } catch {
    return null;
  }
}

export function isBattleRoomId(roomId: string): boolean {
  return roomId.startsWith("battle-");
}

export function battleRoomsFromSearch(search: UpdateSearch): BattleRoomRef[] {
  if (!search.games) return [];
  return Object.entries(search.games)
    .filter(([id]) => isBattleRoomId(id))
    .map(([roomId, title]) => ({ roomId, title }));
}

/**
 * Decide what START VOICE BATTLE should do after login.
 * 1 battle → join it. Several battles → ask. Searching → wait. None → caller may `/search`.
 */
export function planVoiceBattleJoin(search: UpdateSearch): VoiceBattleJoinPlan {
  const battles = battleRoomsFromSearch(search);
  if (battles.length === 1) {
    const only = battles[0]!;
    return { action: "join", roomId: only.roomId, title: only.title };
  }
  if (battles.length > 1) return { action: "choose", battles };
  if (search.searching.length) return { action: "searching", formats: search.searching };
  return { action: "none" };
}
