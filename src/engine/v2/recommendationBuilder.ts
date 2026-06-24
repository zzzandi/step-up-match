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

  /*
   * 고정 파트너 우선
   */

  const fixedPair =
    players.find(
      (player) =>
        player.fixedPartner
    );

  const fixedPartnerMatches: TeamMatch[] =
    [];

  if (fixedPair) {
    const partner =
      players.find(
        (player) =>
          player.id ===
          fixedPair.fixedPartner
      );

    if (partner) {
      const remaining =
        players.filter(
          (player) =>
            player.id !==
              fixedPair.id &&
            player.id !==
              partner.id
        );

      if (
        remaining.length === 2
      ) {
        fixedPartnerMatches.push({
          teamA: [
            fixedPair,
            partner,
          ],

          teamB: [
            remaining[0],
            remaining[1],
          ],
        });
      }
    }
  }

  const matches =
    generateBasicMatches(
      players
    );

  const dedupedMatches =
    Array.from(
      [
        ...fixedPartnerMatches,
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
   * 여복 우선
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
   * 혼복 vs 혼복
   */

  if (
    teamAFemale === 1 &&
    teamBFemale === 1
  ) {
    score += 50;
  }

  /*
   * 여자 2명 존재
   */

  if (
    femaleCount === 2
  ) {
    score += 20;
  }

  return score;
}
