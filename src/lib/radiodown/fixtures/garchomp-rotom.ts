/**
 * Synthetic Gen 9 OU log + choice requests for the voice demo.
 * Built from SIM-PROTOCOL.md message types (not a live replay — replays omit |request|).
 * Scenario matches the product brief: Garchomp vs Rotom-Wash → Corviknight.
 */

export const GARCHOMP_ROTOM_LOG = `|player|p1|RadioTrainer|1|1500
|player|p2|Rival|2|1480
|teamsize|p1|6
|teamsize|p2|6
|gametype|singles
|gen|9
|tier|[Gen 9] OU
|rule|HP Percentage Mod: HP is shown in percentages
|rule|Species Clause: Limit one of each Pokémon
|clearpoke
|poke|p1|Garchomp, M|item
|poke|p1|Gholdengo|item
|poke|p1|Great Tusk|item
|poke|p1|Dragapult, F|item
|poke|p1|Slowking-Galar|item
|poke|p1|Cinderace, M|item
|poke|p2|Rotom-Wash|item
|poke|p2|Corviknight, F|item
|poke|p2|Great Tusk|item
|poke|p2|Gholdengo|item
|poke|p2|Dragapult, M|item
|poke|p2|Ting-Lu|item
|teampreview
|start
|switch|p1a: Garchomp|Garchomp, M|100/100
|switch|p2a: Rotom-Wash|Rotom-Wash|100/100
|-ability|p1a: Garchomp|Rough Skin
|turn|1
|move|p2a: Rotom-Wash|Will-O-Wisp|p1a: Garchomp
|-status|p1a: Garchomp|brn
|move|p1a: Garchomp|Stealth Rock|p2a: Rotom-Wash
|-sidestart|p2: Rival|move: Stealth Rock
|-damage|p1a: Garchomp|88/100|[from] brn
|upkeep
|turn|2
|move|p1a: Garchomp|Earthquake|p2a: Rotom-Wash
|-supereffective|p2a: Rotom-Wash
|-damage|p2a: Rotom-Wash|64/100
|move|p2a: Rotom-Wash|Hydro Pump|p1a: Garchomp
|-damage|p1a: Garchomp|82/100
|-damage|p1a: Garchomp|76/100|[from] brn
|upkeep
|turn|8`;

export const GARCHOMP_MOVE_REQUEST = {
  active: [
    {
      moves: [
        { move: "Earthquake", id: "earthquake", pp: 12, maxpp: 16, target: "allAdjacentFoes", disabled: false },
        { move: "Dragon Claw", id: "dragonclaw", pp: 23, maxpp: 24, target: "normal", disabled: false },
        { move: "Stealth Rock", id: "stealthrock", pp: 31, maxpp: 32, target: "foeSide", disabled: false },
        { move: "Protect", id: "protect", pp: 16, maxpp: 16, target: "self", disabled: false },
      ],
      canTerastallize: "Ground",
    },
  ],
  side: {
    name: "RadioTrainer",
    id: "p1",
    pokemon: [
      {
        ident: "p1: Garchomp",
        details: "Garchomp, M",
        condition: "82/100 brn",
        active: true,
        stats: { atk: 266, def: 216, spa: 176, spd: 206, spe: 282 },
        moves: ["earthquake", "dragonclaw", "stealthrock", "protect"],
        baseAbility: "roughskin",
        item: "leftovers",
        ability: "roughskin",
        teraType: "Ground",
      },
      {
        ident: "p1: Gholdengo",
        details: "Gholdengo",
        condition: "100/100",
        active: false,
        moves: ["shadowball", "makeitrain", "nastyplot", "recover"],
        baseAbility: "goodasgold",
        item: "airballoon",
        teraType: "Steel",
      },
      {
        ident: "p1: Great Tusk",
        details: "Great Tusk",
        condition: "100/100",
        active: false,
        moves: ["headlongrush", "icespinner", "rapidspin", "stealthrock"],
        baseAbility: "protosynthesis",
        item: "leftovers",
        teraType: "Ground",
      },
      {
        ident: "p1: Dragapult",
        details: "Dragapult, F",
        condition: "100/100",
        active: false,
        moves: ["dracometeor", "shadowball", "uturn", "flamethrower"],
        baseAbility: "infiltrator",
        item: "choiceSpecs",
        teraType: "Ghost",
      },
      {
        ident: "p1: Slowking-Galar",
        details: "Slowking-Galar",
        condition: "100/100",
        active: false,
        moves: ["futuresight", "sludgebomb", "chillyreception", "thunderwave"],
        baseAbility: "regenerator",
        item: "heavydutyboots",
        teraType: "Water",
      },
      {
        ident: "p1: Cinderace",
        details: "Cinderace, M",
        condition: "0 fnt",
        active: false,
        moves: ["pyroball", "uturn", "courtchange", "suckerpunch"],
        baseAbility: "libero",
        item: "heavydutyboots",
        teraType: "Fire",
      },
    ],
  },
  rqid: 8,
};

export const AFTER_EARTHQUAKE_LOG = `|move|p1a: Garchomp|Earthquake|p2a: Rotom-Wash
|-supereffective|p2a: Rotom-Wash
|-damage|p2a: Rotom-Wash|18/100
|move|p2a: Rotom-Wash|Volt Switch|p1a: Garchomp
|-supereffective|p1a: Garchomp
|-damage|p1a: Garchomp|41/100
|switch|p2a: Corviknight|Corviknight, F|94/100|[from] Volt Switch
|-damage|p2a: Corviknight|88/100|[from] Stealth Rock
|-ability|p2a: Corviknight|Pressure
|-heal|p1a: Garchomp|47/100|[from] item: Leftovers
|-damage|p1a: Garchomp|41/100|[from] brn
|upkeep
|turn|9`;

export const TURN9_REQUEST = {
  ...GARCHOMP_MOVE_REQUEST,
  rqid: 9,
  active: [
    {
      moves: [
        { move: "Earthquake", id: "earthquake", pp: 11, maxpp: 16, target: "allAdjacentFoes", disabled: false },
        { move: "Dragon Claw", id: "dragonclaw", pp: 23, maxpp: 24, target: "normal", disabled: false },
        { move: "Stealth Rock", id: "stealthrock", pp: 31, maxpp: 32, target: "foeSide", disabled: true },
        { move: "Protect", id: "protect", pp: 16, maxpp: 16, target: "self", disabled: false },
      ],
      canTerastallize: "Ground",
    },
  ],
  side: {
    ...GARCHOMP_MOVE_REQUEST.side,
    pokemon: GARCHOMP_MOVE_REQUEST.side.pokemon.map((p) =>
      p.ident.includes("Garchomp") ? { ...p, condition: "41/100 brn" } : p,
    ),
  },
};
