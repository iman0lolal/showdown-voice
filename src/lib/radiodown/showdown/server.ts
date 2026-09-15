/**
 * Sim server discovery.
 *
 * Official client (play.pokemonshowdown.com/config/config.js, checked 2026-09):
 *   Config.defaultserver = { id: 'showdown', host: 'sim3.psim.us', port: 443, httpport: 8000 }
 *
 * PROTOCOL.md still documents:
 *   wss://sim3.psim.us/showdown/websocket
 *   ws://sim3.psim.us:8000/showdown/websocket
 *
 * Do not treat sim3 as an API contract forever. Parse the live config when
 * a network is available; fall back to DEFAULT_SERVER.
 *
 * Keepalive (official client-connection.ts): send `|/cmd ping` if idle ~20s.
 * SockJS also emits `o` (open) and `h` (heartbeat) — ignore both.
 */

export interface SimServer {
  id: string;
  host: string;
  port: number;
  httpport: number;
  protocol: "https" | "http";
}

export const DEFAULT_SERVER: SimServer = {
  id: "showdown",
  host: "sim3.psim.us",
  port: 443,
  httpport: 8000,
  protocol: "https",
};

export const CLIENT_CONFIG_URL = "https://play.pokemonshowdown.com/config/config.js";
export const LOGIN_API = "https://play.pokemonshowdown.com/api/login";
export const UPKEEP_API = "https://play.pokemonshowdown.com/api/upkeep";
export const GETASSERTION_API = "https://play.pokemonshowdown.com/api/getassertion";

export const KEEPALIVE_CMD = "|/cmd ping";
export const KEEPALIVE_MS = 20_000;

export function websocketUrl(server: SimServer = DEFAULT_SERVER): string {
  if (server.protocol === "https" || server.port === 443) {
    return `wss://${server.host}/showdown/websocket`;
  }
  return `ws://${server.host}:${server.httpport || 8000}/showdown/websocket`;
}

export function parseDefaultServerFromConfigJs(source: string): SimServer | null {
  const host = source.match(/host:\s*['"]([^'"]+)['"]/)?.[1];
  const id = source.match(/id:\s*['"]([^'"]+)['"]/)?.[1] ?? "showdown";
  const port = Number(source.match(/port:\s*(\d+)/)?.[1] ?? 443);
  const httpport = Number(source.match(/httpport:\s*(\d+)/)?.[1] ?? 8000);
  if (!host) return null;
  return {
    id,
    host,
    port,
    httpport,
    protocol: port === 443 ? "https" : "http",
  };
}

export function isTransportFrame(raw: string): boolean {
  return raw === "o" || raw === "h";
}

export function joinBattleCommand(roomId: string): string {
  const id = roomId.replace(/^>/, "");
  return `|/join ${id}`;
}

export function reconnectCommands(input: {
  username: string;
  assertion: string;
  roomId?: string;
}): string[] {
  const cmds = [`|/trn ${input.username},0,${input.assertion}`];
  if (input.roomId) cmds.push(joinBattleCommand(input.roomId));
  return cmds;
}
