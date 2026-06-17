import type { Player } from "@/types/player";

import {
  calculatePlayerScore,
} from "./playerScore";

export function selectCandidates(
  players: Player[],
  candidateCount = 8
): Player[] {
  const waitingPlayers =
    players.filter(
      (player) =>
        player.status === "WAITING" &&
        player.isPresent
    );

  const scoredPlayers =
    waitingPlayers.map(
      (player) => ({
        player,

        score:
          calculatePlayerScore(
            player
          ),
      })
    );

  return scoredPlayers
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