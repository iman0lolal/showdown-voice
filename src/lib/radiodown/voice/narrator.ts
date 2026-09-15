import type { BattleState, PokemonState } from "../types.ts";
import { activePokemon, opponentPlayer, youPlayer } from "../battle/engine.ts";
import { formatHp } from "../battle/hp.ts";

export function narrateSituation(state: BattleState, lang: "es" | "en" = "es"): string {
  if (state.ended) {
    if (lang === "en") return state.winner ? `Battle over. Winner: ${state.winner}.` : "Battle ended in a tie.";
    return state.winner ? `La batalla terminó. Ganador: ${state.winner}.` : "La batalla terminó en empate.";
  }
  const you = youPlayer(state);
  const foe = opponentPlayer(state);
  const mine = activePokemon(state, you);
  const theirs = activePokemon(state, foe);
  const turn = state.turn || 1;
  const request = state.request;

  if (lang === "en") {
    const bits = [`Turn ${turn}.`];
    if (mine) bits.push(`Your ${mine.species} is at ${formatHp(mine.hp)}${statusBit(mine, "en")}.`);
    if (theirs) {
      bits.push(`The opponent has ${theirs.species} at ${formatHp(theirs.hp)}${statusBit(theirs, "en")}.`);
      if (theirs.moves.length) bits.push(`You know ${theirs.moves.map((m) => m.name).join(", ")}.`);
    }
    bits.push(...fieldBits(state, "en"));
    if (request?.kind === "switch") bits.push("You must switch.");
    else if (request?.kind === "team") bits.push("Team preview. Choose your lead.");
    else if (request?.kind === "move") {
      const n = request.active?.[0]?.moves.filter((m) => !m.disabled).length ?? 0;
      bits.push(`You have ${n} moves available. What do you want to do?`);
    } else if (request?.kind === "wait") bits.push("Waiting for the opponent.");
    else bits.push("What do you want to do?");
    return bits.join(" ");
  }

  const bits = [`Turno ${turn}.`];
  if (mine) bits.push(`Tu ${mine.species} está al ${formatHp(mine.hp)}${statusBit(mine, "es")}.`);
  if (theirs) {
    bits.push(`El rival tiene ${theirs.species} al ${formatHp(theirs.hp)}${statusBit(theirs, "es")}.`);
    if (theirs.moves.length) bits.push(`Conoces ${theirs.moves.map((m) => m.name).join(", ")}.`);
  }
  bits.push(...fieldBits(state, "es"));
  if (request?.kind === "switch") bits.push("Tienes que cambiar.");
  else if (request?.kind === "team") bits.push("Team preview. Elige el lead.");
  else if (request?.kind === "move") {
    const n = request.active?.[0]?.moves.filter((m) => !m.disabled).length ?? 0;
    bits.push(`Tienes ${n} movimientos disponibles. ¿Qué quieres hacer?`);
  } else if (request?.kind === "wait") bits.push("Esperando al rival.");
  else bits.push("¿Qué quieres hacer?");
  return bits.join(" ");
}

export function narrateOpponent(state: BattleState, lang: "es" | "en" = "es"): string {
  const theirs = activePokemon(state, opponentPlayer(state));
  if (!theirs) return lang === "en" ? "No opposing Pokémon is active." : "No hay Pokémon rival activo.";
  const moves = theirs.moves.length
    ? theirs.moves.map((m) => m.name).join(", ")
    : lang === "en"
      ? "no moves revealed yet"
      : "aún no conoces movimientos";
  const ability = theirs.abilityKnown && theirs.ability ? theirs.ability : lang === "en" ? "unknown ability" : "habilidad desconocida";
  const item = theirs.itemKnown
    ? theirs.item || (lang === "en" ? "no item" : "sin objeto")
    : lang === "en"
      ? "unknown item"
      : "objeto desconocido";
  if (lang === "en") {
    return `${theirs.species} at ${formatHp(theirs.hp)}${statusBit(theirs, "en")}. Ability: ${ability}. Item: ${item}. Known moves: ${moves}.`;
  }
  return `${theirs.species} al ${formatHp(theirs.hp)}${statusBit(theirs, "es")}. Habilidad: ${ability}. Objeto: ${item}. Movimientos conocidos: ${moves}.`;
}

export function narrateOptions(state: BattleState, lang: "es" | "en" = "es"): string {
  const request = state.request;
  if (!request || request.kind === "wait") {
    return lang === "en" ? "There is no choice to make right now." : "Ahora mismo no hay que elegir nada.";
  }
  if (request.kind === "switch" || request.kind === "team") {
    const names = (request.side?.pokemon ?? [])
      .filter((p) => !p.condition.includes("fnt"))
      .map((p) => p.ident.split(":").pop()?.trim() || p.details.split(",")[0]);
    return lang === "en"
      ? `Available Pokémon: ${names.join(", ")}.`
      : `Pokémon disponibles: ${names.join(", ")}.`;
  }
  const moves = request.active?.[0]?.moves ?? [];
  const live = moves.filter((m) => !m.disabled).map((m) => `${m.move} (${m.pp} PP)`);
  const flags: string[] = [];
  const a = request.active?.[0];
  if (a?.canTerastallize) flags.push(lang === "en" ? "Terastallize available" : "Teracristal disponible");
  if (a?.canMegaEvo) flags.push("Mega");
  if (a?.canDynamax) flags.push("Dynamax");
  const bench = (request.side?.pokemon ?? [])
    .filter((p) => !p.active && !p.condition.includes("fnt"))
    .map((p) => p.ident.split(":").pop()?.trim());
  const parts = [
    lang === "en" ? `Moves: ${live.join(", ") || "none"}.` : `Movimientos: ${live.join(", ") || "ninguno"}.`,
  ];
  if (flags.length) parts.push(flags.join(", ") + ".");
  if (bench.length) {
    parts.push(lang === "en" ? `You can switch to ${bench.join(", ")}.` : `Puedes cambiar a ${bench.join(", ")}.`);
  }
  return parts.join(" ");
}

export function actionSpeech(action: { type: string } & Record<string, unknown>, lang: "es" | "en" = "es"): string {
  if (action.type === "move") {
    const tera = action.terastallize ? (lang === "en" ? "Terastallize and " : "Tera y ") : "";
    const mega = action.mega ? "Mega + " : "";
    const dmax = action.dynamax ? "Dynamax + " : "";
    const move = String(action.move);
    return lang === "en" ? `${tera}${mega}${dmax}${move} selected.` : `${tera}${mega}${dmax}${move} seleccionado.`;
  }
  if (action.type === "switch") {
    const name = String(action.pokemon || "");
    return lang === "en" ? `Switching to ${name}.` : `Cambiando a ${name}.`;
  }
  return lang === "en" ? "Action selected." : "Acción seleccionada.";
}

function statusBit(poke: PokemonState, lang: "es" | "en"): string {
  if (!poke.status || poke.status === "fnt") return "";
  const labels: Record<string, { es: string; en: string }> = {
    brn: { es: "quemado", en: "burned" },
    par: { es: "paralizado", en: "paralyzed" },
    slp: { es: "dormido", en: "asleep" },
    frz: { es: "congelado", en: "frozen" },
    psn: { es: "envenenado", en: "poisoned" },
    tox: { es: "gravemente envenenado", en: "badly poisoned" },
  };
  const label = labels[poke.status]?.[lang] ?? poke.status;
  return lang === "en" ? `, ${label}` : `, ${label}`;
}

function fieldBits(state: BattleState, lang: "es" | "en"): string[] {
  const bits: string[] = [];
  if (state.field.weather) {
    bits.push(lang === "en" ? `Weather: ${state.field.weather.name}.` : `Clima: ${state.field.weather.name}.`);
  }
  if (state.field.terrain) {
    bits.push(lang === "en" ? `Terrain: ${state.field.terrain}.` : `Terreno: ${state.field.terrain}.`);
  }
  const foe = opponentPlayer(state);
  const foeSide = foe === "p1" ? state.p1 : state.p2;
  const you = youPlayer(state);
  const mySide = you === "p1" ? state.p1 : state.p2;
  if (mySide.hazards.stealthRock) bits.push(lang === "en" ? "Stealth Rock on your side." : "Tienes Trampa Rocas.");
  if (foeSide.hazards.stealthRock) bits.push(lang === "en" ? "Stealth Rock on their side." : "El rival tiene Trampa Rocas.");
  return bits;
}
