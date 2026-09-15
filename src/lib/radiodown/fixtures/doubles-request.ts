/** Minimal doubles |request| — architecture for targets, not a full doubles engine. */
export const DOUBLES_MOVE_REQUEST = {
  active: [
    {
      moves: [
        { move: "Earthquake", id: "earthquake", pp: 8, maxpp: 16, target: "allAdjacentFoes", disabled: false },
        { move: "Dragon Claw", id: "dragonclaw", pp: 10, maxpp: 24, target: "normal", disabled: false },
      ],
    },
    {
      moves: [
        { move: "Helping Hand", id: "helpinghand", pp: 16, maxpp: 32, target: "adjacentAlly", disabled: false },
        { move: "Protect", id: "protect", pp: 10, maxpp: 16, target: "self", disabled: false },
      ],
    },
  ],
  side: {
    name: "RadioTrainer",
    id: "p1",
    pokemon: [
      {
        ident: "p1: Garchomp",
        details: "Garchomp, M",
        condition: "80/100",
        active: true,
        moves: ["earthquake", "dragonclaw"],
      },
      {
        ident: "p1: Gholdengo",
        details: "Gholdengo",
        condition: "100/100",
        active: true,
        moves: ["helpinghand", "protect"],
      },
    ],
  },
  rqid: 4,
};
