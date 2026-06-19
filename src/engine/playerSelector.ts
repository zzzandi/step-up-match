import type { Player } from "@/types/player";

import {
  calculatePlayerScore,
} from "./v2/playerScore";
import {
  scorePlayerSelection,
} from "./v2/selectionScorer";

export function selectCandidates(
  players: Player[],
  courtCount: number
): Player[] {
  const waitingPlayers =
    players.filter(
      (player) =>
        player.status ===
          "WAITING" &&
        player.isPresent
    );
  const candidateCount =
    Math.min(
      waitingPlayers.length,
      Math.max(
        16,
        courtCount * 4 + 8
      )
    );
  const candidatePool =
    waitingPlayers
      .map((player) => ({
        player,
        score:
          calculatePlayerScore(
            player
          ),
      }))
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .slice(0, candidateCount)
      .map(
        (item) =>
          item.player
      );

  let bestGroup:
    | [Player, Player, Player, Player]
    | null = null;
  let bestScore =
    Number.NEGATIVE_INFINITY;

  for (
    let i = 0;
    i < candidatePool.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < candidatePool.length;
      j++
    ) {
      for (
        let k = j + 1;
        k < candidatePool.length;
        k++
      ) {
        for (
          let l = k + 1;
          l < candidatePool.length;
          l++
        ) {
          const group: [
            Player,
            Player,
            Player,
            Player,
          ] = [
            candidatePool[i],
            candidatePool[j],
            candidatePool[k],
            candidatePool[l],
          ];
          const femaleCount =
            group.filter(
              (player) =>
                player.gender === "F"
            ).length;

          if (
            femaleCount === 1 ||
            femaleCount === 3
          ) {
            continue;
          }

          const score =
            scorePlayerSelection(
              group
            ).total;

          if (score > bestScore) {
            bestScore = score;
            bestGroup = group;
          }
        }
      }
    }
  }

  return (
    bestGroup ??
    candidatePool.slice(0, 4)
  );
}
