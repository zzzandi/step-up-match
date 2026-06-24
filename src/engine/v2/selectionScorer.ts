import type { Player } from "@/types/player";

import {
  getRestMinutes,
} from "@/utils/time";

import {
  ENGINE_CONFIG,
} from "./engineConfig";

export interface SelectionScore {
  total: number;
  rest: number;
  diversity: number;
  matchCount: number;
  consecutive: number;
}

function hasRecentHardRepeat(
  playerA: Player,
  playerB: Player
) {
  const recentCount =
    [
      ...playerA.lastPartners,
      ...playerB.lastPartners,
      ...playerA.lastOpponents,
      ...playerB.lastOpponents,
    ].filter(
      (playerId) =>
        playerId === playerA.id ||
        playerId === playerB.id
    ).length;

  return recentCount >= 2;
}

function hasAnyPlayedTogether(
  playerA: Player,
  playerB: Player
) {
  return (
    playerA.lastPartners.includes(
      playerB.id
    ) ||
    playerB.lastPartners.includes(
      playerA.id
    ) ||
    playerA.lastOpponents.includes(
      playerB.id
    ) ||
    playerB.lastOpponents.includes(
      playerA.id
    )
  );
}

export function scorePlayerSelection(
  players: [Player, Player, Player, Player]
): SelectionScore {
  const weights =
    ENGINE_CONFIG.playerSelection;
  const rest =
    players.reduce(
      (sum, player) =>
        sum +
        Math.min(
          getRestMinutes(
            player.waitingStartedAt
          ),
          60
        ) /
          60,
      0
    ) /
    players.length *
    weights.rest;

  let repeatedPairs = 0;
  let hardRepeatedPairs = 0;

  for (
    let i = 0;
    i < players.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < players.length;
      j++
    ) {
      if (
        hasAnyPlayedTogether(
          players[i],
          players[j]
        )
      ) {
        repeatedPairs += 1;
      }

      if (
        hasRecentHardRepeat(
          players[i],
          players[j]
        )
      ) {
        hardRepeatedPairs += 1;
      }
    }
  }

  const diversity =
    Math.max(
      0,
      1 -
        repeatedPairs / 6 -
        hardRepeatedPairs / 3
    ) * weights.diversity;
  const matchCount =
    players.reduce(
      (sum, player) =>
        sum +
        Math.max(
          0,
          10 - player.matchCount
        ) /
          10,
      0
    ) /
    players.length *
    weights.matchCount;
  const consecutive =
    players.reduce(
      (sum, player) =>
        sum +
        Math.max(
          0,
          2 -
            player.consecutiveMatches
        ) /
          2,
      0
    ) /
    players.length *
    weights.consecutive;

  return {
    total:
      rest +
      diversity +
      matchCount +
      consecutive,
    rest,
    diversity,
    matchCount,
    consecutive,
  };
}
