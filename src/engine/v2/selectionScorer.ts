import type { Player } from "@/types/player";

import {
  getRestMinutes,
} from "@/utils/time";

import {
  ENGINE_CONFIG,
} from "./engineConfig";

const EXPECTED_MATCH_INTERVAL_MINUTES = 18;

export interface SelectionScore {
  total: number;
  rest: number;
  diversity: number;
  matchCount: number;
  consecutive: number;
}

export function countRecentSharedGames(
  playerA: Player,
  playerB: Player
) {
  const recentPairEntries =
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

  return Math.floor(
    recentPairEntries / 2
  );
}

export function hasRecentHardRepeat(
  playerA: Player,
  playerB: Player
) {
  return (
    countRecentSharedGames(
      playerA,
      playerB
    ) >= 2
  );
}

function isFixedPartnerPair(
  playerA: Player,
  playerB: Player
) {
  return (
    playerA.fixedPartner === playerB.id ||
    playerB.fixedPartner === playerA.id
  );
}

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
  let repeatedPairSlots = 0;
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
        isFixedPartnerPair(
          players[i],
          players[j]
        )
      ) {
        continue;
      }

      const sharedGames =
        countRecentSharedGames(
          players[i],
          players[j]
        );

      repeatedPairs += sharedGames;

      if (sharedGames > 0) {
        repeatedPairSlots += 1;
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
      -2,
      1 -
        repeatedPairSlots / 2 -
        repeatedPairs / 4 -
        hardRepeatedPairs
    ) * weights.diversity;
  const matchCount =
    players.reduce(
      (sum, player) =>
        sum +
        Math.max(
          0,
          Math.min(
            2,
            getAttendanceMinutes(
              player
            ) /
              EXPECTED_MATCH_INTERVAL_MINUTES -
              player.matchCount
          )
        ) /
          2,
      0
    ) /
    players.length *
    weights.matchCount;
  const consecutive =
    players.reduce(
      (sum, player) =>
        sum +
        -Math.min(
          2,
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
