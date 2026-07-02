import type { Player } from "@/types/player";

import {
  getRestMinutes,
} from "@/utils/time";

import {
  ENGINE_CONFIG,
} from "./engineConfig";

const EXPECTED_MATCH_INTERVAL_MINUTES = 18;

function getAttendanceMinutes(
  player: Player
) {
  const startedAt =
    player.arrivalTime ??
    player.waitingStartedAt;

  if (!startedAt) {
    return 0;
  }

  return Math.max(
    0,
    (Date.now() -
      new Date(startedAt).getTime()) /
      60_000
  );
}

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
  const expectedMatchCount =
    getAttendanceMinutes(player) /
    EXPECTED_MATCH_INTERVAL_MINUTES;
  const matchDeficit =
    expectedMatchCount -
    player.matchCount;
  const matchCount =
    Math.max(
      0,
      Math.min(2, matchDeficit)
    ) *
    (weights.matchCount / 2);
  const consecutive =
    -Math.min(
      2,
      player.consecutiveMatches
    ) *
    (weights.consecutive / 2);

  return (
    rest +
    matchCount +
    consecutive
  );
}
