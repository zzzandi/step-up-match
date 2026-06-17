import type { Player } from "@/types/player";
import type {
  MatchRecommendation,
} from "@/types/match";

import {
  selectCandidates,
} from "./playerSelector";

import {
  generateTeams,
} from "./teamGenerator";

import {
  calculateMatchScore,
} from "./scoreCalculator";

function uniqueKey(
  teamA: Player[],
  teamB: Player[]
) {
  const a = teamA
    .map(
      (player) =>
        player.id
    )
    .sort()
    .join("-");

  const b = teamB
    .map(
      (player) =>
        player.id
    )
    .sort()
    .join("-");

  return `${a}|${b}`;
}

export function generateRecommendations(
  courtId: number,
  players: Player[],
  courtCount = 1
): MatchRecommendation[] {
  const candidates =
    selectCandidates(
      players,
      courtCount
    );

  if (
    candidates.length < 4
  ) {
    return [];
  }

  const allRecommendations: MatchRecommendation[] =
    [];

  for (
    let i = 0;
    i < candidates.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < candidates.length;
      j++
    ) {
      for (
        let k = j + 1;
        k < candidates.length;
        k++
      ) {
        for (
          let l = k + 1;
          l < candidates.length;
          l++
        ) {
          const group = [
            candidates[i],
            candidates[j],
            candidates[k],
            candidates[l],
          ];

          const matches =
            generateTeams(
              group
            );

          matches.forEach(
            (match) => {
              allRecommendations.push(
                {
                  id:
                    crypto.randomUUID(),

                  courtId,

                  teamA:
                    match.teamA,

                  teamB:
                    match.teamB,

                  score:
                    calculateMatchScore(
                      match.teamA,
                      match.teamB
                    ),

                  createdAt:
                    new Date(),
                }
              );
            }
          );
        }
      }
    }
  }

  const sorted =
    allRecommendations.sort(
      (a, b) =>
        b.score.total -
        a.score.total
    );

  const result: MatchRecommendation[] =
    [];

  const usedMatches =
    new Set<string>();

  for (const rec of sorted) {
    const key =
      uniqueKey(
        rec.teamA,
        rec.teamB
      );

    if (
      usedMatches.has(
        key
      )
    ) {
      continue;
    }

    usedMatches.add(
      key
    );

    result.push(
      rec
    );

    if (
      result.length >= 3
    ) {
      break;
    }
  }

  return result;
}