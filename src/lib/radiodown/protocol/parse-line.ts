import type { BattleEvent } from "../types.ts";

/**
 * Parse a single SIM-PROTOCOL / PROTOCOL line.
 * `|TYPE|arg1|arg2|[from]item: Leftovers`
 */
export function parseProtocolLine(raw: string): BattleEvent | null {
  const line = raw.replace(/\r$/, "");
  if (!line || line === "|") {
    return { type: "spacer", args: [], kwArgs: {}, raw: line };
  }
  if (!line.startsWith("|")) {
    return { type: "text", args: [line], kwArgs: {}, raw: line };
  }
  const parts = line.slice(1).split("|");
  const type = parts[0] ?? "";
  const args: string[] = [];
  const kwArgs: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i] ?? "";
    if (part.startsWith("[")) {
      const close = part.indexOf("]");
      if (close > 0) {
        const key = part.slice(1, close);
        const value = part.slice(close + 1).replace(/^[:\s]+/, "");
        kwArgs[key] = value || "true";
        continue;
      }
    }
    args.push(part);
  }
  return { type, args, kwArgs, raw: line };
}

export interface ProtocolChunk {
  roomId?: string;
  events: BattleEvent[];
}

/**
 * Split a websocket payload into room-scoped chunks.
 * Server format:
 *   >ROOMID
 *   |msg
 *   |msg
 */
export function parseProtocolPayload(payload: string): ProtocolChunk[] {
  const text = payload.replace(/^\u0000+/, "");
  if (!text) return [];

  // SockJS wraps arrays: a["line1\nline2"]
  if (text.startsWith("a")) {
    try {
      const parsed = JSON.parse(text.slice(1)) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) => parseProtocolPayload(String(item)));
      }
    } catch {
      // fall through
    }
  }

  const chunks: ProtocolChunk[] = [];
  let current: ProtocolChunk = { events: [] };

  for (const rawLine of text.split("\n")) {
    if (rawLine.startsWith(">")) {
      if (current.roomId || current.events.length) chunks.push(current);
      current = { roomId: rawLine.slice(1).trim() || undefined, events: [] };
      continue;
    }
    const event = parseProtocolLine(rawLine);
    if (event) current.events.push(event);
  }
  if (current.roomId || current.events.length) chunks.push(current);
  return chunks;
}
