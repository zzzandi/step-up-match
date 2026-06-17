import type { Player } from "@/types/player";

import {
  calculatePlayerScore,
} from "./v2/playerScore";

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
        12,
        courtCount * 4 + 8
      )
    );

  return waitingPlayers
    .map(
      (player) => ({
        player,

        score:
          calculatePlayerScore(
            player
          ),
      })
    )
    .sort(
      (a, b) =>
        b.score -
        a.score
    )
    .slice(
      0,
      candidateCount
    )
    .map(
      (item) =>
        item.player
    );
}