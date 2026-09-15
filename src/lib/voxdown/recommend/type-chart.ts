/** Gen 6+ type chart. Attacker → defender → multiplier. */
export const TYPES = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
] as const;

export type PokeType = (typeof TYPES)[number];

const CHART: Record<string, Partial<Record<string, number>>> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
};

export function typeEffectiveness(attack: string, defenders: string[]): number {
  let mult = 1;
  const atk = title(attack);
  for (const d of defenders) {
    const def = title(d);
    const v = CHART[atk]?.[def];
    if (v == null) continue;
    mult *= v;
  }
  return mult;
}

const MOVE_TYPES: Record<string, string> = {
  earthquake: "Ground",
  earthpower: "Ground",
  hydropump: "Water",
  surf: "Water",
  scald: "Water",
  voltswitch: "Electric",
  thunderbolt: "Electric",
  thunder: "Electric",
  willowisp: "Fire",
  flamethrower: "Fire",
  fireblast: "Fire",
  shadowball: "Ghost",
  dragonclaw: "Dragon",
  dracometeor: "Dragon",
  protect: "Normal",
  swordsdance: "Normal",
  calmmind: "Psychic",
  stealthrock: "Rock",
  knockoff: "Dark",
  closecombat: "Fighting",
  bravebird: "Flying",
  uturn: "Bug",
  icebeam: "Ice",
  moonblast: "Fairy",
  gunkshot: "Poison",
  heatwave: "Fire",
  overheat: "Fire",
  bulkup: "Fighting",
  roost: "Flying",
  encore: "Normal",
  growth: "Normal",
  tailglow: "Bug",
};

export function guessMoveType(moveId: string): string | undefined {
  return MOVE_TYPES[moveId];
}

function title(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
