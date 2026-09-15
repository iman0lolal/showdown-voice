export interface PokemonDetails {
  species: string;
  level: number;
  gender?: "M" | "F";
  shiny: boolean;
  teraType?: string;
}

/**
 * DETAILS: SPECIES[, L##][, M/F][, shiny][, tera:TYPE]
 * Example: `Sawsbuck, L50, F, shiny`
 */
export function parseDetails(raw: string | undefined): PokemonDetails {
  if (!raw) return { species: "Unknown", level: 100, shiny: false };
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const species = parts[0] ?? "Unknown";
  let level = 100;
  let gender: "M" | "F" | undefined;
  let shiny = false;
  let teraType: string | undefined;
  for (const part of parts.slice(1)) {
    if (/^L\d+$/i.test(part)) {
      level = Number(part.slice(1));
    } else if (part === "M" || part === "F") {
      gender = part;
    } else if (part.toLowerCase() === "shiny") {
      shiny = true;
    } else if (part.toLowerCase().startsWith("tera:")) {
      teraType = part.slice(5);
    }
  }
  return { species, level, gender, shiny, teraType };
}
