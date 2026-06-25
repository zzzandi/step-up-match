import type { Player } from "@/types/player";

export interface TeamMatch {
  teamA: [Player, Player];

  teamB: [Player, Player];
}

function generateBasicMatches(
  players: Player[]
): TeamMatch[] {
  if (
    players.length !== 4
  ) {
    return [];
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

export function buildMatches(
  players: Player[]
): TeamMatch[] {
  if (
    players.length !== 4
  ) {
    return [];
  }


  const matches =
    generateBasicMatches(
      players
    );

  const dedupedMatches =
    Array.from(
      [
        ...matches,
      ]
        .reduce(
          (deduped, match) => {
          const key = [
            match.teamA
              .map(
                (player) =>
                  player.id
              )
              .sort()
              .join("-"),
            match.teamB
              .map(
                (player) =>
                  player.id
              )
              .sort()
              .join("-"),
          ]
            .sort()
            .join("|");

            if (!deduped.has(key)) {
              deduped.set(
                key,
                match
              );
            }

            return deduped;
          },
          new Map<
            string,
            TeamMatch
          >()
        )
        .values()
    );

  return dedupedMatches.sort(
    (a, b) =>
      calculateGenderPriority(
        b
      ) -
      calculateGenderPriority(
        a
      )
  );
}

function calculateGenderPriority(
  match: TeamMatch
) {
  let score = 0;

  const players = [
    ...match.teamA,
    ...match.teamB,
  ];

  const femaleCount =
    players.filter(
      (player) =>
        player.gender === "F"
    ).length;

  /*
   * ?щ났 ?곗꽑
   */

  const teamAFemale =
    match.teamA.filter(
      (player) =>
        player.gender === "F"
    ).length;

  const teamBFemale =
    match.teamB.filter(
      (player) =>
        player.gender === "F"
    ).length;

  if (
    teamAFemale === 2 &&
    teamBFemale === 2
  ) {
    score += 100;
  }

  /*
   * ?쇰났 vs ?쇰났
   */

  if (
    teamAFemale === 1 &&
    teamBFemale === 1
  ) {
    score += 50;
  }

  /*
   * ?ъ옄 2紐?議댁옱
   */

  if (
    femaleCount === 2
  ) {
    score += 20;
  }

  return score;
}
