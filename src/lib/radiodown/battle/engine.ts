import { EMPTY_BOOSTS, type BattleEvent, type BattleState, type ChoiceRequest, type FieldState, type GameType, type PokemonState, type SideHazards, type SideState, type StatBoosts, type StatName } from "../types.ts";
import { identKey, parsePokemonIdent, toId, type PlayerId } from "../ids.ts";
import { parseDetails } from "./details.ts";
import { parseHpStatus } from "./hp.ts";
import { parseChoiceRequest } from "./request.ts";

const STAT_NAMES: StatName[] = ["atk", "def", "spa", "spd", "spe", "accuracy", "evasion"];

function emptyHazards(): SideHazards {
  return { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false };
}

function emptySide(player: PlayerId, name = player): SideState {
  return {
    player,
    name,
    teamSize: 0,
    pokemon: [],
    hazards: emptyHazards(),
    sideConditions: [],
  };
}

function emptyField(): FieldState {
  return { trickRoom: false, tailwind: { p1: false, p2: false } };
}

export function createBattleState(): BattleState {
  return {
    gen: 9,
    format: "",
    gameType: "singles",
    rated: false,
    rules: [],
    turn: 0,
    started: false,
    ended: false,
    p1: emptySide("p1"),
    p2: emptySide("p2"),
    field: emptyField(),
    request: null,
    perspective: null,
    log: [],
    lastTurnSummary: [],
  };
}

export class BattleEngine {
  state: BattleState;
  private splitFor: PlayerId | null = null;
  private splitIndex = 0;

  constructor(initial?: BattleState) {
    this.state = initial ?? createBattleState();
  }

  feed(events: BattleEvent[], roomId?: string): BattleState {
    if (roomId) this.state.roomId = roomId;
    for (const event of events) this.apply(event);
    return this.state;
  }

  apply(event: BattleEvent): BattleState {
    if (event.type === "split") {
      const player = event.args[0];
      this.splitFor = player === "p1" || player === "p2" || player === "p3" || player === "p4" ? player : null;
      this.splitIndex = 0;
      return this.state;
    }

    if (this.splitFor) {
      this.splitIndex += 1;
      const keepPrivate = this.state.perspective === this.splitFor;
      const keepThis = keepPrivate ? this.splitIndex === 1 : this.splitIndex === 2;
      if (this.splitIndex >= 2) {
        this.splitFor = null;
        this.splitIndex = 0;
      }
      if (!keepThis) return this.state;
    }

    if (event.type !== "request" && event.type !== "spacer" && event.type !== "") {
      this.state.log.push(event);
    }

    switch (event.type) {
      case "player":
        this.onPlayer(event);
        break;
      case "teamsize":
        this.onTeamSize(event);
        break;
      case "gametype":
        this.state.gameType = (event.args[0] as GameType) || "singles";
        break;
      case "gen":
        this.state.gen = Number(event.args[0]) || 9;
        break;
      case "tier":
        this.state.format = event.args[0] ?? "";
        break;
      case "rated":
        this.state.rated = true;
        break;
      case "rule":
        if (event.args[0]) this.state.rules.push(event.args[0]);
        break;
      case "poke":
        this.onPreviewPoke(event);
        break;
      case "start":
        this.state.started = true;
        this.state.lastTurnSummary.push("La batalla comienza.");
        break;
      case "turn":
        this.state.turn = Number(event.args[0]) || this.state.turn;
        this.state.lastTurnSummary = [`Turno ${this.state.turn}.`];
        this.state.request = null;
        break;
      case "request":
        this.onRequest(event.args.join("|"));
        break;
      case "switch":
      case "drag":
        this.onSwitch(event, event.type === "drag");
        break;
      case "replace":
      case "detailschange":
        this.onDetailsChange(event);
        break;
      case "move":
        this.onMove(event);
        break;
      case "-damage":
      case "-heal":
      case "-sethp":
        this.onHpChange(event);
        break;
      case "-status":
        this.onStatus(event, false);
        break;
      case "-curestatus":
        this.onStatus(event, true);
        break;
      case "-boost":
      case "-unboost":
        this.onBoost(event, event.type === "-boost" ? 1 : -1);
        break;
      case "-setboost":
        this.onSetBoost(event);
        break;
      case "-clearboost":
      case "-clearallboost":
      case "-clearpositiveboost":
      case "-clearnegativeboost":
        this.onClearBoosts(event);
        break;
      case "-weather":
        this.onWeather(event);
        break;
      case "-fieldstart":
      case "-fieldend":
        this.onField(event);
        break;
      case "-sidestart":
      case "-sideend":
        this.onSideCondition(event);
        break;
      case "-ability":
        this.onAbility(event);
        break;
      case "-item":
      case "-enditem":
        this.onItem(event);
        break;
      case "-terastallize":
        this.onTera(event);
        break;
      case "-mega":
      case "-burst":
        this.note(`${event.args[0] ?? ""} megaevoluciona.`);
        break;
      case "faint":
        this.onFaint(event);
        break;
      case "-start":
      case "-end":
        this.onVolatile(event);
        break;
      case "-immune":
        this.note(`${this.displayName(event.args[0])} no se ve afectado.`);
        break;
      case "-resisted":
        this.note("No es muy efectivo.");
        break;
      case "-supereffective":
        this.note("Es muy efectivo.");
        break;
      case "-crit":
        this.note("Golpe crítico.");
        break;
      case "-miss":
        this.note(`${this.displayName(event.args[1] ?? event.args[0])} esquiva el ataque.`);
        break;
      case "-fail":
        this.note("El movimiento falla.");
        break;
      case "-activate":
        this.note(`${this.displayName(event.args[0])} activa ${event.args[1] ?? "un efecto"}.`);
        break;
      case "error":
        this.note(event.args.join(" "));
        break;
      case "cant":
        this.note(`${this.displayName(event.args[0])} no puede moverse (${event.args[1] ?? "impedido"}).`);
        break;
      case "win":
        this.state.ended = true;
        this.state.winner = event.args[0];
        this.state.request = null;
        this.note(`Ganador: ${event.args[0]}.`);
        break;
      case "tie":
        this.state.ended = true;
        this.note("Empate.");
        break;
      default:
        break;
    }
    return this.state;
  }

  setRequest(request: ChoiceRequest | null) {
    this.state.request = request;
    if (request?.side?.id) this.state.perspective = request.side.id;
    if (request?.side) this.mergeRequestSide(request);
  }

  private onRequest(json: string) {
    const request = parseChoiceRequest(json);
    this.setRequest(request);
  }

  private onPlayer(event: BattleEvent) {
    const player = event.args[0] as PlayerId;
    const side = this.side(player);
    if (!side) return;
    side.name = event.args[1] ?? side.name;
    side.avatar = event.args[2];
    if (event.args[3]) side.rating = Number(event.args[3]);
  }

  private onTeamSize(event: BattleEvent) {
    const side = this.side(event.args[0] as PlayerId);
    if (!side) return;
    side.teamSize = Number(event.args[1]) || side.teamSize;
  }

  private onPreviewPoke(event: BattleEvent) {
    const player = event.args[0] as PlayerId;
    const side = this.side(player);
    if (!side) return;
    const details = parseDetails(event.args[1]);
    const itemFlag = event.args[2];
    const existing = side.pokemon.find((p) => p.species === details.species && !p.active);
    if (existing) return;
    side.pokemon.push(
      this.makePokemon({
        player,
        nickname: details.species,
        species: details.species,
        level: details.level,
        gender: details.gender,
        shiny: details.shiny,
        itemKnown: itemFlag === "item",
        item: itemFlag === "item" ? undefined : itemFlag === "" ? null : undefined,
      }),
    );
    if (!side.teamSize) side.teamSize = side.pokemon.length;
  }

  private onSwitch(event: BattleEvent, dragged: boolean) {
    const ident = parsePokemonIdent(event.args[0] ?? "");
    const details = parseDetails(event.args[1]);
    const hp = parseHpStatus(event.args[2]);
    const side = this.side(ident.player);
    if (!side) return;

    for (const poke of side.pokemon) {
      if (poke.active && poke.slot === (ident.slot ?? "a")) {
        poke.active = false;
        poke.slot = undefined;
        poke.boosts = { ...EMPTY_BOOSTS };
        poke.volatiles = [];
      }
    }

    let poke = this.findPokemon(ident.player, ident.nickname, details.species);
    if (!poke) {
      poke = this.makePokemon({
        player: ident.player,
        nickname: ident.nickname || details.species,
        species: details.species,
        level: details.level,
        gender: details.gender,
        shiny: details.shiny,
      });
      side.pokemon.push(poke);
    }
    poke.nickname = ident.nickname || poke.nickname;
    poke.species = details.species;
    poke.level = details.level;
    poke.gender = details.gender;
    poke.shiny = details.shiny;
    if (details.teraType) {
      poke.teraType = details.teraType;
      poke.terastallized = true;
      poke.teraTypeKnown = true;
    }
    poke.hp = hp.hp;
    poke.status = hp.status === "fnt" ? undefined : hp.status;
    poke.fainted = hp.hp.percent === 0 || hp.status === "fnt";
    poke.active = !poke.fainted;
    poke.slot = ident.slot ?? "a";
    poke.boosts = { ...EMPTY_BOOSTS };
    poke.key = identKey({ ...ident, nickname: poke.nickname });
    const verb = dragged ? "es forzado a salir" : "entra";
    this.note(`${this.sideLabel(ident.player)} ${verb}: ${poke.species} (${poke.hp.percent}%).`);
  }

  private onDetailsChange(event: BattleEvent) {
    const poke = this.pokemonFromArg(event.args[0]);
    if (!poke) return;
    const details = parseDetails(event.args[1]);
    poke.species = details.species;
    if (details.teraType) {
      poke.teraType = details.teraType;
      poke.terastallized = true;
      poke.teraTypeKnown = true;
    }
    if (event.args[2]) {
      const hp = parseHpStatus(event.args[2]);
      poke.hp = hp.hp;
      poke.status = hp.status;
    }
  }

  private onMove(event: BattleEvent) {
    const poke = this.pokemonFromArg(event.args[0]);
    const moveName = event.args[1] ?? "un movimiento";
    const target = event.args[2] ? this.displayName(event.args[2]) : "";
    if (poke) {
      const id = toId(moveName);
      if (id && !poke.moves.some((m) => m.id === id)) {
        poke.moves.push({ id, name: moveName, revealed: true });
      }
    }
    const miss = event.kwArgs.miss ? " (falla)" : "";
    this.note(`${this.displayName(event.args[0])} usa ${moveName}${target ? ` contra ${target}` : ""}${miss}.`);
  }

  private onHpChange(event: BattleEvent) {
    const poke = this.pokemonFromArg(event.args[0]);
    if (!poke) return;
    const hp = parseHpStatus(event.args[1]);
    poke.hp = hp.hp;
    if (hp.status) poke.status = hp.status;
    if (hp.hp.percent === 0) {
      poke.fainted = true;
      poke.active = false;
    }
    const from = event.kwArgs.from ? ` (${event.kwArgs.from})` : "";
    const verb = event.type === "-heal" ? "se cura" : "queda";
    this.note(`${this.displayName(event.args[0])} ${verb} al ${poke.hp.percent}%${from}.`);
  }

  private onStatus(event: BattleEvent, cure: boolean) {
    const poke = this.pokemonFromArg(event.args[0]);
    const status = event.args[1];
    if (!poke) return;
    if (cure) {
      if (poke.status === status) poke.status = undefined;
      this.note(`${this.displayName(event.args[0])} se cura de ${status}.`);
    } else {
      poke.status = status as PokemonState["status"];
      this.note(`${this.displayName(event.args[0])} sufre ${status}.`);
    }
  }

  private onBoost(event: BattleEvent, sign: 1 | -1) {
    const poke = this.pokemonFromArg(event.args[0]);
    if (!poke) return;
    const stat = event.args[1] as StatName;
    const amount = Number(event.args[2]) || 1;
    if (!STAT_NAMES.includes(stat)) return;
    poke.boosts[stat] = clampBoost(poke.boosts[stat] + sign * amount);
    const dir = sign > 0 ? "sube" : "baja";
    this.note(`${this.displayName(event.args[0])}: ${stat} ${dir} ${amount}.`);
  }

  private onSetBoost(event: BattleEvent) {
    const poke = this.pokemonFromArg(event.args[0]);
    if (!poke) return;
    const stat = event.args[1] as StatName;
    const amount = Number(event.args[2]) || 0;
    if (!STAT_NAMES.includes(stat)) return;
    poke.boosts[stat] = clampBoost(amount);
  }

  private onClearBoosts(event: BattleEvent) {
    if (event.type === "-clearallboost") {
      for (const poke of [...this.state.p1.pokemon, ...this.state.p2.pokemon]) {
        poke.boosts = { ...EMPTY_BOOSTS };
      }
      return;
    }
    const poke = this.pokemonFromArg(event.args[0]);
    if (!poke) return;
    poke.boosts = { ...EMPTY_BOOSTS };
  }

  private onWeather(event: BattleEvent) {
    const id = event.args[0] ?? "";
    if (!id || id === "none" || event.kwArgs.upkeep) {
      if (id === "none") this.state.field.weather = undefined;
      return;
    }
    this.state.field.weather = { id: toId(id), name: weatherName(id) };
    this.note(`Clima: ${this.state.field.weather.name}.`);
  }

  private onField(event: BattleEvent) {
    const raw = event.args[0] ?? "";
    const id = toId(raw);
    if (event.type === "-fieldend") {
      if (id.includes("trickroom")) this.state.field.trickRoom = false;
      else if (id.includes("terrain") || id.includes("terreno")) this.state.field.terrain = undefined;
      return;
    }
    if (id.includes("trickroom")) this.state.field.trickRoom = true;
    else this.state.field.terrain = raw;
    this.note(`Campo: ${raw}.`);
  }

  private onSideCondition(event: BattleEvent) {
    const ident = parsePokemonIdent(event.args[0] ?? "");
    const side = this.side(ident.player);
    if (!side) return;
    const effect = (event.args[1] ?? "").toLowerCase();
    const start = event.type === "-sidestart";
    if (effect.includes("stealth") || effect.includes("trampa rocas")) {
      side.hazards.stealthRock = start;
    } else if (effect.includes("toxic spike") || effect.includes("púas tóxicas") || effect.includes("toxicspikes")) {
      side.hazards.toxicSpikes = start ? Math.min(2, side.hazards.toxicSpikes + 1) : 0;
    } else if (effect.includes("spike") || effect.includes("púas")) {
      side.hazards.spikes = start ? Math.min(3, side.hazards.spikes + 1) : 0;
    } else if (effect.includes("sticky") || effect.includes("tela")) {
      side.hazards.stickyWeb = start;
    } else if (effect.includes("tailwind") || effect.includes("viento afín")) {
      this.state.field.tailwind[ident.player === "p2" ? "p2" : "p1"] = start;
    }
    const name = event.args[1] ?? "condición";
    this.note(`${start ? "Se coloca" : "Desaparece"} ${name} en el lado de ${side.name}.`);
  }

  private onAbility(event: BattleEvent) {
    const poke = this.pokemonFromArg(event.args[0]);
    if (!poke) return;
    const ability = event.args[1];
    if (ability) {
      poke.ability = ability;
      poke.abilityKnown = true;
      this.note(`${this.displayName(event.args[0])} habilidad: ${ability}.`);
    }
  }

  private onItem(event: BattleEvent) {
    const poke = this.pokemonFromArg(event.args[0]);
    if (!poke) return;
    if (event.type === "-enditem") {
      poke.item = null;
      poke.itemKnown = true;
      this.note(`${this.displayName(event.args[0])} pierde ${event.args[1] ?? "su objeto"}.`);
    } else {
      poke.item = event.args[1];
      poke.itemKnown = true;
    }
  }

  private onTera(event: BattleEvent) {
    const poke = this.pokemonFromArg(event.args[0]);
    if (!poke) return;
    poke.terastallized = true;
    poke.teraType = event.args[1] || poke.teraType;
    poke.teraTypeKnown = true;
    this.note(`${this.displayName(event.args[0])} teracristaliza en ${poke.teraType}.`);
  }

  private onFaint(event: BattleEvent) {
    const poke = this.pokemonFromArg(event.args[0]);
    if (!poke) return;
    poke.fainted = true;
    poke.active = false;
    poke.hp = { ...poke.hp, current: 0, percent: 0 };
    this.note(`${this.displayName(event.args[0])} se debilita.`);
  }

  private onVolatile(event: BattleEvent) {
    const poke = this.pokemonFromArg(event.args[0]);
    if (!poke) return;
    const vol = event.args[1] ?? "";
    if (event.type === "-start") {
      if (!poke.volatiles.includes(vol)) poke.volatiles.push(vol);
    } else {
      poke.volatiles = poke.volatiles.filter((v) => v !== vol);
    }
  }

  private mergeRequestSide(request: ChoiceRequest) {
    const side = this.side(request.side!.id);
    if (!side) return;
    for (const rp of request.side!.pokemon) {
      const ident = parsePokemonIdent(rp.ident);
      const details = parseDetails(rp.details);
      const hp = parseHpStatus(rp.condition);
      let poke = this.findPokemon(ident.player, ident.nickname, details.species);
      if (!poke) {
        poke = this.makePokemon({
          player: ident.player,
          nickname: ident.nickname || details.species,
          species: details.species,
        });
        side.pokemon.push(poke);
      }
      poke.species = details.species || poke.species;
      poke.nickname = ident.nickname || poke.nickname;
      poke.hp = hp.hp;
      poke.status = hp.status === "fnt" ? "fnt" : hp.status;
      poke.fainted = hp.status === "fnt" || hp.hp.percent === 0;
      poke.active = rp.active && !poke.fainted;
      poke.item = rp.item;
      poke.itemKnown = rp.item !== undefined;
      poke.ability = rp.ability ?? rp.baseAbility ?? poke.ability;
      poke.abilityKnown = Boolean(rp.ability ?? rp.baseAbility);
      if (rp.teraType) {
        poke.teraType = rp.teraType;
        poke.teraTypeKnown = true;
      }
      poke.terastallized = Boolean(rp.terastallized);
      if (rp.moves?.length) {
        poke.moves = rp.moves.map((m) => ({
          id: toId(m),
          name: m,
          revealed: true,
        }));
      }
    }
  }

  private makePokemon(init: {
    player: PlayerId;
    nickname: string;
    species: string;
    level?: number;
    gender?: "M" | "F";
    shiny?: boolean;
    item?: string | null;
    itemKnown?: boolean;
  }): PokemonState {
    return {
      key: `${init.player}:${toId(init.nickname || init.species)}`,
      player: init.player,
      nickname: init.nickname,
      species: init.species,
      level: init.level ?? 100,
      gender: init.gender,
      shiny: Boolean(init.shiny),
      terastallized: false,
      teraTypeKnown: false,
      hp: { current: 100, max: 100, percent: 100 },
      item: init.item,
      itemKnown: Boolean(init.itemKnown),
      abilityKnown: false,
      moves: [],
      boosts: { ...EMPTY_BOOSTS },
      fainted: false,
      active: false,
      volatiles: [],
    };
  }

  private side(player: string | undefined): SideState | null {
    if (player === "p1") return this.state.p1;
    if (player === "p2") return this.state.p2;
    return null;
  }

  private pokemonFromArg(raw?: string): PokemonState | undefined {
    if (!raw) return undefined;
    const ident = parsePokemonIdent(raw);
    return this.findPokemon(ident.player, ident.nickname);
  }

  private findPokemon(player: PlayerId, nickname: string, species?: string): PokemonState | undefined {
    const side = this.side(player);
    if (!side) return undefined;
    const nickId = toId(nickname);
    const speciesId = species ? toId(species) : "";
    return (
      side.pokemon.find((p) => toId(p.nickname) === nickId) ||
      side.pokemon.find((p) => toId(p.species) === nickId) ||
      (speciesId ? side.pokemon.find((p) => toId(p.species) === speciesId) : undefined)
    );
  }

  private displayName(raw?: string): string {
    if (!raw) return "Pokémon";
    const ident = parsePokemonIdent(raw);
    return ident.nickname || raw;
  }

  private sideLabel(player: PlayerId): string {
    if (this.state.perspective && player === this.state.perspective) return "Tu";
    if (this.state.perspective && player !== this.state.perspective) return "El rival";
    return this.side(player)?.name || player;
  }

  private note(text: string) {
    this.state.lastTurnSummary.push(text);
  }
}

function clampBoost(n: number): number {
  return Math.max(-6, Math.min(6, n));
}

function weatherName(id: string): string {
  const key = toId(id);
  if (key.includes("sunny") || key.includes("desolate")) return "Sol";
  if (key.includes("rain")) return "Lluvia";
  if (key.includes("sand")) return "Tormenta de arena";
  if (key.includes("snow") || key.includes("hail")) return "Nieve";
  return id;
}

export function activePokemon(state: BattleState, player: PlayerId): PokemonState | undefined {
  const side = player === "p1" ? state.p1 : state.p2;
  return side.pokemon.find((p) => p.active && !p.fainted);
}

export function opponentPlayer(state: BattleState): PlayerId {
  return state.perspective === "p2" ? "p1" : "p2";
}

export function youPlayer(state: BattleState): PlayerId {
  return state.perspective ?? "p1";
}
