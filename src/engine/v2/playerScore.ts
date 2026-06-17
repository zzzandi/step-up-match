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
  let score = 0;

  const restMinutes =
    getRestMinutes(
      player.waitingStartedAt
    );

  /*
   * 휴식시간
   */

  score +=
    Math.min(
      restMinutes,
      60
    ) *
    (ENGINE_CONFIG.restWeight /
      60);

  /*
   * 경기수
   */

  score +=
    Math.max(
      0,
      10 -
        player.matchCount
    ) *
    (ENGINE_CONFIG.matchCountWeight /
      10);

  /*
   * 연속경기
   */

  score +=
    Math.max(
      0,
      10 -
        player.consecutiveMatches
    ) *
    (ENGINE_CONFIG.consecutiveWeight /
      10);

  return score;
}