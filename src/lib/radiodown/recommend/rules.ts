import type { BattleAction, BattleState, ChoiceRequest } from "../types.ts";
import { activePokemon, opponentPlayer, youPlayer } from "../battle/engine.ts";
import { guessMoveType, typeEffectiveness } from "./type-chart.ts";
import { toId } from "../ids.ts";

/**
 * Data-only suggestion. Never a /choose string. Never a websocket send.
 * AnalysisEngine must not import the Showdown transport.
 */
export interface RuleRecommendation {
  recommendedAction: BattleAction;
  /** Alias of recommendedAction — kept so older tests read `.action`. */
  action: BattleAction;
  confidence: number;
  reason: string;
  why: string;
  spoken: string;
  score: number;
}

export function recommend(state: BattleState, lang: "es" | "en" = "es"): RuleRecommendation | null {
  const request = state.request;
  if (!request || request.kind === "wait") return null;
  if (request.kind === "switch" || request.kind === "team") {
    return recommendSwitch(state, request, lang);
  }
  return recommendMove(state, request, lang);
}

function pack(
  action: BattleAction,
  score: number,
  reason: string,
): RuleRecommendation {
  const confidence = Math.max(0.15, Math.min(0.92, score / 2.4));
  return {
    recommendedAction: action,
    action,
    confidence,
    reason,
    why: reason,
    spoken: reason,
    score,
  };
}

function recommendSwitch(state: BattleState, request: ChoiceRequest, lang: "es" | "en"): RuleRecommendation | null {
  const foe = activePokemon(state, opponentPlayer(state));
  const options = (request.side?.pokemon ?? [])
    .map((p, i) => ({
      p,
      slot: i + 1,
      name: (p.ident.split(":").pop() ?? p.details.split(",")[0] ?? "").trim(),
    }))
    .filter(({ p }) => !p.condition.includes("fnt") && (request.kind === "team" || !p.active));
  if (!options.length) return null;
  const pick = options[0];
  if (!pick) return null;
  const action: BattleAction = { type: "switch", pokemon: pick.name, slot: pick.slot };
  const why = foe
    ? lang === "en"
      ? `Switch available. ${pick.name} is a legal replacement versus ${foe.species}.`
      : `Hay que cambiar. ${pick.name} es un recambio legal frente a ${foe.species}.`
    : lang === "en"
      ? `${pick.name} is a legal switch.`
      : `${pick.name} es un cambio legal.`;
  return pack(action, 1, why);
}

function recommendMove(state: BattleState, request: ChoiceRequest, lang: "es" | "en"): RuleRecommendation | null {
  const active = request.active?.[0];
  if (!active) return null;
  const foe = activePokemon(state, opponentPlayer(state));
  const mine = activePokemon(state, youPlayer(state));
  const foeTypes = foe?.types?.length ? foe.types : guessSpeciesTypes(foe?.species);

  const scored = active.moves
    .filter((m) => !m.disabled)
    .map((m) => {
      const type = guessMoveType(m.id) ?? "Normal";
      const eff = foeTypes.length ? typeEffectiveness(type, foeTypes) : 1;
      let score = eff;
      if (m.id === "protect" && (mine?.hp.percent ?? 100) < 35) score += 1.2;
      if (["swordsdance", "calmmind", "dragondance", "nastyplot", "tailglow", "bulkup"].includes(m.id)) {
        score = (mine?.hp.percent ?? 0) > 70 ? 1.1 : 0.4;
      }
      if (eff === 0) score = 0;
      return { m, score, eff, type };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return null;
  const action: BattleAction = { type: "move", move: best.m.move, moveId: best.m.id };
  const why =
    lang === "en"
      ? effectivenessWhy(best.m.move, best.eff, foe?.species, "en")
      : effectivenessWhy(best.m.move, best.eff, foe?.species, "es");
  return pack(action, best.score, why);
}

function effectivenessWhy(move: string, eff: number, species: string | undefined, lang: "es" | "en"): string {
  const target = species ?? (lang === "en" ? "the opponent" : "el rival");
  if (eff === 0) {
    return lang === "en" ? `${move} does not affect ${target}.` : `${move} no afecta a ${target}.`;
  }
  if (eff >= 2) {
    return lang === "en"
      ? `My recommendation is ${move}. It is super-effective against ${target}. This is a heuristic, not a guarantee.`
      : `Mi recomendación es ${move}. Es muy efectivo contra ${target}. Es una heurística, no una garantía.`;
  }
  if (eff <= 0.5) {
    return lang === "en"
      ? `My recommendation is ${move}, but it is not very effective against ${target}.`
      : `Mi recomendación es ${move}, aunque no es muy efectivo contra ${target}.`;
  }
  return lang === "en"
    ? `My recommendation is ${move}. Confirm if you want me to send it.`
    : `Mi recomendación es ${move}. Confirma si quieres que la envíe.`;
}

const SPECIES_TYPES: Record<string, string[]> = {
  garchomp: ["Dragon", "Ground"],
  rotomwash: ["Electric", "Water"],
  corviknight: ["Flying", "Steel"],
  greattusk: ["Ground", "Fighting"],
  gholdengo: ["Steel", "Ghost"],
  zapdos: ["Electric", "Flying"],
  torkoal: ["Fire"],
  whimsicott: ["Grass", "Fairy"],
  krookodile: ["Ground", "Dark"],
  zarude: ["Dark", "Grass"],
  manaphy: ["Water"],
  okidogi: ["Poison", "Fighting"],
  walkingwake: ["Water", "Dragon"],
  ninetales: ["Fire"],
  metagross: ["Steel", "Psychic"],
  cinderace: ["Fire"],
};

export function guessSpeciesTypes(species?: string): string[] {
  if (!species) return [];
  return SPECIES_TYPES[toId(species)] ?? [];
}
