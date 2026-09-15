import { toId } from "../ids.ts";
import type { BattleAction, ChoiceRequest, ValidationResult } from "../types.ts";
import { aliasSpecies, bestMatch } from "../voice/aliases.ts";

/**
 * Validate a structured action against the current |request| and
 * produce a Showdown `/choose` command.
 *
 * Choice syntax (SIM-PROTOCOL.md):
 *   move MOVESPEC
 *   move MOVESPEC mega | zmove | max | terastallize
 *   switch SWITCHSPEC
 *   team TEAMSPEC
 *   pass | default | undo
 *
 * Client sends: `/choose CHOICE` optionally `|rqid`.
 */
export function validateAndChoose(action: BattleAction, request: ChoiceRequest | null): ValidationResult {
  if (!request || request.kind === "wait") {
    return { ok: false, reason: "No hay una decisión pendiente en Showdown." };
  }
  if (action.type === "undo") {
    return { ok: true, action, choose: withRqid("undo", request) };
  }
  if (action.type === "pass") {
    return { ok: true, action, choose: withRqid("pass", request) };
  }
  if (action.type === "default") {
    return { ok: true, action, choose: withRqid("default", request) };
  }
  if (action.type === "team") {
    if (request.kind !== "team") return { ok: false, reason: "Ahora no es team preview." };
    return { ok: true, action, choose: withRqid(`team ${action.order}`, request) };
  }
  if (action.type === "switch") {
    return validateSwitch(action, request);
  }
  if (action.type === "move") {
    return validateMove(action, request);
  }
  return { ok: false, reason: "Acción no reconocida." };
}

function validateSwitch(
  action: Extract<BattleAction, { type: "switch" }>,
  request: ChoiceRequest,
): ValidationResult {
  if (request.kind === "move" && request.active?.[0]?.trapped) {
    return { ok: false, reason: "Tu Pokémon está atrapado y no puede cambiar." };
  }
  if (request.kind !== "move" && request.kind !== "switch" && request.kind !== "team") {
    return { ok: false, reason: "Ahora no puedes cambiar." };
  }
  const pokemon = request.side?.pokemon ?? [];
  const available = pokemon
    .map((p, index) => ({
      p,
      slot: index + 1,
      name: (p.ident.split(":").pop() ?? p.details.split(",")[0] ?? "").trim(),
    }))
    .filter(({ p }) => !p.active && !p.condition.includes("fnt"));

  if (!action.pokemon) {
    return {
      ok: false,
      needsClarification: "¿A qué Pokémon quieres cambiar?",
      ambiguous: available.map((a) => a.name),
    };
  }

  const wanted = aliasSpecies(action.pokemon);
  const names = available.map((a) => a.name);
  const match = available.find((a) => toId(a.name) === toId(wanted)) ??
    (() => {
      const fuzzy = bestMatch(wanted, names);
      return fuzzy && fuzzy.score >= 0.78
        ? available.find((a) => a.name === fuzzy.value)
        : undefined;
    })();

  if (!match) {
    return {
      ok: false,
      reason: `${action.pokemon} no está disponible para el cambio.`,
      ambiguous: names,
    };
  }

  const filled: BattleAction = { type: "switch", pokemon: match.name, slot: match.slot };
  return { ok: true, action: filled, choose: withRqid(`switch ${match.slot}`, request) };
}

function validateMove(
  action: Extract<BattleAction, { type: "move" }>,
  request: ChoiceRequest,
): ValidationResult {
  if (request.kind === "switch") {
    return { ok: false, reason: "Tienes que cambiar, no atacar." };
  }
  if (request.kind !== "move") {
    return { ok: false, reason: "Ahora no puedes usar un movimiento." };
  }
  const active = request.active?.[0];
  if (!active) return { ok: false, reason: "No hay Pokémon activo en la petición." };

  const moves = active.moves;
  const wanted = toId(action.moveId || action.move);
  const exact = moves.find((m) => !m.disabled && (m.id === wanted || toId(m.move) === wanted));
  const fuzzy = !exact
    ? bestMatch(
        wanted,
        moves.filter((m) => !m.disabled).map((m) => m.move),
      )
    : null;
  const resolved = exact ?? (fuzzy && fuzzy.score >= 0.78 ? moves.find((m) => m.move === fuzzy.value) : undefined);

  if (!resolved) {
    const disabled = moves.find((m) => m.disabled && (m.id === wanted || toId(m.move) === wanted));
    if (disabled) return { ok: false, reason: `${disabled.move} está deshabilitado.` };
    return {
      ok: false,
      reason: `${action.move} no está entre los movimientos legales.`,
      ambiguous: moves.filter((m) => !m.disabled).map((m) => m.move),
    };
  }

  const extras: string[] = [];
  if (action.terastallize) {
    if (!active.canTerastallize) return { ok: false, reason: "Teracristal no está disponible." };
    extras.push("terastallize");
  }
  if (action.mega) {
    if (!active.canMegaEvo && !active.canMegaEvoX && !active.canMegaEvoY) {
      return { ok: false, reason: "Megaevolución no está disponible." };
    }
    extras.push("mega");
  }
  if (action.zmove) {
    if (!active.canZMove) return { ok: false, reason: "Movimiento Z no está disponible." };
    extras.push("zmove");
  }
  if (action.dynamax) {
    if (!active.canDynamax) return { ok: false, reason: "Dynamax no está disponible." };
    extras.push("max");
  }

  const spec = extras.length ? `move ${resolved.id} ${extras.join(" ")}` : `move ${resolved.id}`;
  const filled: BattleAction = {
    ...action,
    move: resolved.move,
    moveId: resolved.id,
  };
  return { ok: true, action: filled, choose: withRqid(spec, request) };
}

function withRqid(choice: string, request: ChoiceRequest): string {
  if (request.rqid != null) return `/choose ${choice}|${request.rqid}`;
  return `/choose ${choice}`;
}
