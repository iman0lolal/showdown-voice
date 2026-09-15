/**
 * Pokémon Showdown websocket client.
 *
 * Confirmed endpoints (PROTOCOL.md, smogon/pokemon-showdown):
 *   wss://sim3.psim.us/showdown/websocket
 *   ws://sim3.psim.us:8000/showdown/websocket
 *
 * There is NO REST API for live battle state. The websocket *is* the API.
 * Login: |challstr| → POST play.pokemonshowdown.com/api/login → /trn USER,0,ASSERTION
 *
 * Client → server: ROOMID|TEXT
 * Battle decisions: ROOMID|/choose CHOICE
 */

export const SHOWDOWN_WS = "wss://sim3.psim.us/showdown/websocket";
export const SHOWDOWN_LOGIN = "https://play.pokemonshowdown.com/api/login";
export const SHOWDOWN_UPKEEP = "https://play.pokemonshowdown.com/api/upkeep";
export const SHOWDOWN_ASSERTION = "https://play.pokemonshowdown.com/api/getassertion";

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
  if (!line.startsWith("|challstr|")) return null;
  return line.slice("|challstr|".length);
}

export function trnCommand(username: string, assertion: string): string {
  return `|trn ${username},0,${assertion}`;
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
