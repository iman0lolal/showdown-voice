/**
 * Pokémon Showdown protocol helpers. No DOM, no WebSocket constructor.
 * The transport lives in the app shell (web / Android / iOS).
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
