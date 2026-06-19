import type { Player } from "@/types/player";

import {
  getRestMinutes,
} from "@/utils/time";

import {
  ENGINE_CONFIG,
} from "./engineConfig";

export function calculatePlayerScore(
  player: Player
) {
  const weights =
    ENGINE_CONFIG.playerSelection;
  const restMinutes =
    getRestMinutes(
      player.waitingStartedAt
    );
  const rest =
    Math.min(
      restMinutes,
      60
    ) *
    (weights.rest / 60);
  const matchCount =
    Math.max(
      0,
      10 - player.matchCount
    ) *
    (weights.matchCount / 10);
  const consecutive =
    Math.max(
      0,
      2 -
        player.consecutiveMatches
    ) *
    (weights.consecutive / 2);

  return (
    rest +
    matchCount +
    consecutive
  );
}
