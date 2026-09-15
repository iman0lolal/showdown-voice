import { toId } from "../ids.ts";
import type { BattleAction, BattleState, ChoiceRequest, VoiceIntent } from "../types.ts";
import { aliasMove, aliasSpecies, bestMatch } from "./aliases.ts";

const CONFIRM = /^(sí|si|yes|ok|okay|vale|hazlo|ejecuta|confirma|confirm|dale|afirmativo|do it|go)$/i;
const DENY = /^(no|nop|nel|cancel[ae]?|cancela|cancelar|atrás|atras|back|stop|para)$/i;
const REPEAT = /^(repite|repetir|otra vez|de nuevo|repeat|again|qué\??|que\??)$/i;
const ACCEPT_REC = /^(haz la recomendaci[oó]n|recomendaci[oó]n|la recomendaci[oó]n|hazlo t[uú]|sigue tu consejo|go with the rec(ommendation)?)$/i;

const QUERY_OPPONENT = /(qu[eé] tiene (el )?rival|qu[eé] es (el )?rival|opponent|what.*(foe|opponent)|rival.*(pokemon|pokémon)?)/i;
const QUERY_OPTIONS = /(qu[eé] puedo (hacer|usar)|opciones|dime las opciones|what can i (do|use)|options)/i;
const QUERY_MOVES = /(qu[eé] movimientos|moves|known moves)/i;
const QUERY_TEAM = /(mi equipo|qu[eé] me queda|bench|team left)/i;
const QUERY_SIT = /(situaci[oó]n|estado|status|qu[eé] pasa|what('s| is) happening)/i;
const QUERY_REC = /(recomienda|recomendaci[oó]n|qu[eé] hago|what should i|advise)/i;

const SWITCH = /^(cambia(?:r)?(?: a)?|cambio(?: a)?|switch(?: to)?|trae(?: a)?|saca(?: a)?)\s+(.+)$/i;
const MOVE_PREFIX =
  /^(usa(?:r)?|ataca(?:r)?(?: con)?|lanza(?:r)?|haz|quiero|tira(?:r)?|use|attack(?: with)?|go)\s+(.+)$/i;
const TERA = /\b(tera|teracristal(?:iza(?:r)?)?|terastal(?:lize)?)\b/i;
const MEGA = /\b(mega|megaevo(?:luci[oó]n)?)\b/i;
const DMAX = /\b(dynamax|dmax|gigantamax|gmax)\b/i;
const ZMOVE = /\b(z\s*-?\s*move|movimiento z)\b/i;

export interface ParseContext {
  state: BattleState;
  request: ChoiceRequest | null;
  lastRecommendation?: BattleAction;
}

export function parseVoiceCommand(utterance: string, ctx: ParseContext): VoiceIntent {
  const raw = utterance.trim().replace(/[.!?]+$/g, "");
  if (!raw) return { kind: "unclear", raw };

  if (CONFIRM.test(raw)) return { kind: "confirm" };
  if (DENY.test(raw)) return { kind: "deny" };
  if (ACCEPT_REC.test(raw)) return { kind: "accept_recommendation" };
  if (REPEAT.test(raw) && raw.length < 18) return { kind: "repeat" };

  if (QUERY_REC.test(raw)) return { kind: "query", topic: "recommend" };
  if (QUERY_OPPONENT.test(raw)) return { kind: "query", topic: "opponent" };
  if (QUERY_OPTIONS.test(raw)) return { kind: "query", topic: "options" };
  if (QUERY_MOVES.test(raw)) return { kind: "query", topic: "moves" };
  if (QUERY_TEAM.test(raw)) return { kind: "query", topic: "team" };
  if (QUERY_SIT.test(raw)) return { kind: "query", topic: "situation" };

  const terastallize = TERA.test(raw);
  const mega = MEGA.test(raw);
  const dynamax = DMAX.test(raw);
  const zmove = ZMOVE.test(raw);
  const cleaned = raw
    .replace(TERA, " ")
    .replace(MEGA, " ")
    .replace(DMAX, " ")
    .replace(ZMOVE, " ")
    .replace(/\b(y|and|con|then)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const switchMatch = SWITCH.exec(cleaned);
  if (switchMatch) {
    const name = switchMatch[2] ?? "";
    if (!name || /^(un pokemon|un pokémon|pokemon|pokémon)$/i.test(name)) {
      return { kind: "action", action: { type: "switch", pokemon: "" }, raw };
    }
    return {
      kind: "action",
      action: { type: "switch", pokemon: aliasSpecies(name) },
      raw,
    };
  }

  if (/^(cambia(?:r)?|cambio|switch)$/i.test(cleaned)) {
    return { kind: "action", action: { type: "switch", pokemon: "" }, raw };
  }

  let movePhrase = cleaned;
  const moveMatch = MOVE_PREFIX.exec(cleaned);
  if (moveMatch) movePhrase = moveMatch[2] ?? cleaned;

  const legalMoves = legalMoveNames(ctx.request);
  const guessed = resolveMove(movePhrase, legalMoves);
  if (guessed) {
    return {
      kind: "action",
      action: {
        type: "move",
        move: guessed.name,
        moveId: guessed.id,
        terastallize,
        mega,
        dynamax,
        zmove,
      },
      raw,
    };
  }

  const legalSwitches = legalSwitchNames(ctx.request);
  const switchGuess = bestMatch(aliasSpecies(movePhrase), legalSwitches);
  if (switchGuess && switchGuess.score >= 0.82) {
    return {
      kind: "action",
      action: { type: "switch", pokemon: switchGuess.value },
      raw,
    };
  }

  return { kind: "unclear", guess: movePhrase, raw };
}

function legalMoveNames(request: ChoiceRequest | null): { name: string; id: string }[] {
  const moves = request?.active?.[0]?.moves ?? [];
  return moves.filter((m) => !m.disabled).map((m) => ({ name: m.move, id: m.id }));
}

function legalSwitchNames(request: ChoiceRequest | null): string[] {
  const pokemon = request?.side?.pokemon ?? [];
  return pokemon
    .filter((p) => !p.active && !p.condition.includes("fnt"))
    .map((p) => p.ident.split(":").pop()?.trim() || p.details.split(",")[0] || "")
    .filter(Boolean);
}

function resolveMove(
  phrase: string,
  legal: { name: string; id: string }[],
): { name: string; id: string } | null {
  const aliased = aliasMove(phrase);
  if (!legal.length) {
    return { name: phrase, id: aliased };
  }
  const byId = legal.find((m) => m.id === aliased || toId(m.name) === aliased);
  if (byId) return byId;
  const match = bestMatch(
    aliased,
    legal.map((m) => m.name),
  );
  if (match && match.score >= 0.72) {
    return legal.find((m) => m.name === match.value) ?? { name: match.value, id: toId(match.value) };
  }
  return null;
}
