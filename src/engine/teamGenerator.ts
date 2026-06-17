import type { Player } from "@/types/player";

export interface GeneratedMatch {
  teamA: [Player, Player];
  teamB: [Player, Player];
}

export function generateTeams(
  players: Player[]
): GeneratedMatch[] {
  if (players.length < 4) {
    return [];
  }

  const fixedPlayers =
    players.filter(
      (player) => player.fixedPartner
    );

  if (fixedPlayers.length >= 2) {
    const fixedA =
      fixedPlayers[0];

    const fixedB =
      players.find(
        (player) =>
          player.id ===
          fixedA.fixedPartner
      );

    if (fixedB) {
      const remaining =
        players.filter(
          (player) =>
            player.id !== fixedA.id &&
            player.id !== fixedB.id
        );

      if (
        remaining.length >= 2
      ) {
        return [
          {
            teamA: [
              fixedA,
              fixedB,
            ],

            teamB: [
              remaining[0],
              remaining[1],
            ],
          },
        ];
      }
    }
  }

  const [
    a,
    b,
    c,
    d,
  ] = players;

  return [
    {
      teamA: [a, b],
      teamB: [c, d],
    },

    {
      teamA: [a, c],
      teamB: [b, d],
    },

    {
      teamA: [a, d],
      teamB: [b, c],
    },
  ];
}