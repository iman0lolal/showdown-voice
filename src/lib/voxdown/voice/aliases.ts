import { toId } from "../ids.ts";

/** Spanish / informal names → Showdown move ids */
export const MOVE_ALIASES: Record<string, string> = {
  terremoto: "earthquake",
  earthquake: "earthquake",
  proteccion: "protect",
  protect: "protect",
  protege: "protect",
  hidrobomba: "hydropump",
  hydropump: "hydropump",
  hydrobomb: "hydropump",
  rayo: "thunderbolt",
  thunderbolt: "thunderbolt",
  trueno: "thunder",
  thunder: "thunder",
  lanzallamas: "flamethrower",
  flamethrower: "flamethrower",
  ascuas: "ember",
  garradragon: "dragonclaw",
  dragonclaw: "dragonclaw",
  bolasombra: "shadowball",
  shadowball: "shadowball",
  voltiocambio: "voltswitch",
  voltswitch: "voltswitch",
  idayvuelta: "uturn",
  uturn: "uturn",
  fuegofatuo: "willowisp",
  willowisp: "willowisp",
  descanso: "rest",
  rest: "rest",
  danzadragon: "dragondance",
  dragondance: "dragondance",
  avalancha: "rockslide",
  rockslide: "rockslide",
  rocaafilada: "stoneedge",
  stoneedge: "stoneedge",
  toxico: "toxic",
  toxic: "toxic",
  surf: "surf",
  rayohielo: "icebeam",
  icebeam: "icebeam",
  pazmental: "calmmind",
  calmmind: "calmmind",
  danzaespada: "swordsdance",
  swordsdance: "swordsdance",
  maquinacion: "nastyplot",
  nastyplot: "nastyplot",
  recuperacion: "recover",
  recover: "recover",
  respiro: "roost",
  roost: "roost",
  tramprocas: "stealthrock",
  stealthrock: "stealthrock",
  puas: "spikes",
  spikes: "spikes",
  despejar: "defog",
  defog: "defog",
  truco: "trick",
  trick: "trick",
  encare: "encore",
  encore: "encore",
  mofa: "taunt",
  taunt: "taunt",
  sustituto: "substitute",
  substitute: "substitute",
  desarme: "knockoff",
  knockoff: "knockoff",
  abocajarro: "closecombat",
  closecombat: "closecombat",
  pajaroosado: "bravebird",
  bravebird: "bravebird",
  colaferrea: "irontail",
  irontail: "irontail",
  hidropulso: "waterpulse",
  voltio: "voltswitch",
  teracristal: "tera",
  tera: "tera",
  gigamax: "dynamax",
  dynamax: "dynamax",
  dmax: "dynamax",
  mega: "mega",
  megaevo: "mega",
  megaevolucion: "mega",
};

export const SPECIES_ALIASES: Record<string, string> = {
  garchomp: "garchomp",
  garchon: "garchomp",
  rotomwash: "rotomwash",
  rotom: "rotomwash",
  corviknight: "corviknight",
  corvi: "corviknight",
  greattusk: "greattusk",
  colmilloférreo: "ironvaliant",
  gholdengo: "gholdengo",
  goldengo: "gholdengo",
};

export function aliasMove(raw: string): string {
  const id = toId(raw);
  return MOVE_ALIASES[id] ?? id;
}

export function aliasSpecies(raw: string): string {
  const id = toId(raw);
  return SPECIES_ALIASES[id] ?? id;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = i;
    row[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cur = row[j + 1];
      const cost = a[i] === b[j] ? 0 : 1;
      row[j + 1] = Math.min(row[j + 1] + 1, row[j] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length] ?? 99;
}

export function bestMatch(query: string, candidates: string[]): { value: string; score: number } | null {
  if (!candidates.length) return null;
  const q = toId(query);
  let best: { value: string; score: number } | null = null;
  for (const c of candidates) {
    const id = toId(c);
    if (id === q) return { value: c, score: 1 };
    if (id.startsWith(q) || q.startsWith(id)) {
      const score = Math.min(id.length, q.length) / Math.max(id.length, q.length);
      if (!best || score > best.score) best = { value: c, score: Math.max(score, 0.82) };
      continue;
    }
    const dist = levenshtein(q, id);
    const score = 1 - dist / Math.max(q.length, id.length);
    if (score >= 0.72 && (!best || score > best.score)) best = { value: c, score };
  }
  return best;
}
