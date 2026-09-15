import { toId } from "../ids.ts";
import type { BattleAction, ChoiceRequest, ValidationContext, ValidationResult } from "../types.ts";
import { aliasSpecies, bestMatch } from "../voice/aliases.ts";
import { encodeTargetSpec, targetIsChosen, type ActionTarget } from "./targets.ts";

/**
 * Validate a structured action against the current |request| and
 * produce a Showdown `/choose` command.
 *
 * |request| is the only source of truth for legal choices.
 */
export function validateAndChoose(
  action: BattleAction,
  request: ChoiceRequest | null,
  ctx: ValidationContext = {},
): ValidationResult {
  if (ctx.ended) {
    return { ok: false, reason: "La batalla ya terminó." };
  }
  if (!request || request.kind === "wait") {
    return { ok: false, reason: "No hay una decisión pendiente en Showdown." };
  }
  if (ctx.lastSentRqid != null && request.rqid != null && ctx.lastSentRqid === request.rqid) {
    return { ok: false, reason: "Esa petición ya se envió." };
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
    return validateMove(action, request, ctx);
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
    const fainted = pokemon.find((p) => {
      const name = (p.ident.split(":").pop() ?? "").trim();
      return toId(name) === toId(wanted) && p.condition.includes("fnt");
    });
    if (fainted) {
      return { ok: false, reason: `${action.pokemon} está debilitado.` };
    }
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
  ctx: ValidationContext,
): ValidationResult {
  if (request.kind === "switch") {
    return { ok: false, reason: "Tienes que cambiar, no atacar." };
  }
  if (request.kind !== "move") {
    return { ok: false, reason: "Ahora no puedes usar un movimiento." };
  }
  const activeIndex = action.activeSlot ?? 0;
  const active = request.active?.[activeIndex];
  if (!active) return { ok: false, reason: "No hay Pokémon activo en esa posición." };

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

  const gameType = ctx.gameType ?? "singles";
  let target: ActionTarget | undefined = action.target;
  if (gameType === "singles") {
    target = { kind: "none" };
  } else if (targetIsChosen(resolved.target) && (!target || target.kind === "none")) {
    return {
      ok: false,
      needsClarification: "¿A qué Pokémon apunta el movimiento?",
      action: { ...action, move: resolved.move, moveId: resolved.id },
    };
  }

  const targetSpec = gameType === "singles" ? "" : encodeTargetSpec(target);
  const parts = [`move ${resolved.id}`, targetSpec, ...extras].filter(Boolean);
  const filled: BattleAction = {
    ...action,
    move: resolved.move,
    moveId: resolved.id,
    target: target ?? { kind: "none" },
  };
  return { ok: true, action: filled, choose: withRqid(parts.join(" "), request) };
}

function withRqid(choice: string, request: ChoiceRequest): string {
  if (request.rqid != null) return `/choose ${choice}|${request.rqid}`;
  return `/choose ${choice}`;
}
