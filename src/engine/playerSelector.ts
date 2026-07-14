import type { Player } from "@/types/player";

import {
  calculatePlayerScore,
} from "./v2/playerScore";
import {
  hasRecentHardRepeat,
  scorePlayerSelection,
} from "./v2/selectionScorer";

function containsExcludedPair(
  players: Player[],
  excludedMatchPairs: [
    string,
    string,
  ][]
) {
  const playerIds =
    new Set(
      players.map(
        (player) => player.id
      )
    );

  return excludedMatchPairs.some(
    ([
      playerAId,
      playerBId,
    ]) =>
      playerIds.has(playerAId) &&
      playerIds.has(playerBId)
  );
}

function containsRecentHardRepeat(
  players: Player[],
  {
    ignoreFixedPartners = false,
  } = {}
) {
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
        ignoreFixedPartners &&
        (players[i].fixedPartner ===
          players[j].id ||
          players[j].fixedPartner ===
            players[i].id)
      ) {
        continue;
      }

      if (
        hasRecentHardRepeat(
          players[i],
          players[j]
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function getGenderSelectionAdjustment(
  players: Player[],
  waitingWomenCount: number
) {
  const femaleCount =
    players.filter(
      (player) =>
        player.gender === "F"
    ).length;

  if (waitingWomenCount >= 2) {
    if (femaleCount === 2) {
      return 45;
    }

    if (femaleCount === 1) {
      return -80;
    }
  }

  if (
    waitingWomenCount === 1 &&
    femaleCount === 1
  ) {
    return 15;
  }

  return 0;
}

export function selectCandidates(
  players: Player[],
  courtCount: number,
  womenDoublesPriority = false,
  excludedMatchPairs: [
    string,
    string,
  ][] = [],
  includePlayingPlayers = false
): Player[] {
  const waitingPlayers =
    players.filter(
      (player) =>
        (player.status ===
          "WAITING" ||
          (includePlayingPlayers &&
            player.status ===
              "PLAYING")) &&
        player.isPresent
    )
    .map((player) =>
      player.status === "PLAYING"
        ? {
            ...player,
            waitingStartedAt:
              player.playingStartedAt ??
              new Date(),
          }
        : player
    );
  const waitingWomenCount =
    waitingPlayers.filter(
      (player) =>
        player.gender === "F"
    ).length;
  if (womenDoublesPriority) {
    const waitingOrder =
      [...waitingPlayers].sort(
        (a, b) =>
          new Date(
            a.waitingStartedAt ??
              a.arrivalTime
          ).getTime() -
          new Date(
            b.waitingStartedAt ??
              b.arrivalTime
          ).getTime()
      );
    const topThreeWomen =
      waitingOrder
        .slice(0, 3)
        .filter(
          (player) =>
            player.gender === "F"
        );
    const waitingWomen =
      waitingOrder.filter(
        (player) =>
          player.gender === "F"
      );

    if (
      topThreeWomen.length >= 2 &&
      waitingWomen.length >= 4
    ) {
      const mandatoryIds =
        new Set(
          topThreeWomen.map(
            (player) =>
              player.id
          )
        );
      const remainingWomen =
        waitingWomen
          .filter(
            (player) =>
              !mandatoryIds.has(
                player.id
              )
          )
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
          .map(
            (item) =>
              item.player
          );

      const womenPool = [
        ...topThreeWomen,
        ...remainingWomen,
      ];
      let bestWomenGroup:
        | [
            Player,
            Player,
            Player,
            Player,
          ]
        | null = null;
      let fallbackWomenGroup:
        | [
            Player,
            Player,
            Player,
            Player,
          ]
        | null = null;
      let bestWomenScore =
        Number.NEGATIVE_INFINITY;
      let fallbackWomenScore =
        Number.NEGATIVE_INFINITY;

      for (
        let i = 0;
        i < womenPool.length;
        i++
      ) {
        for (
          let j = i + 1;
          j < womenPool.length;
          j++
        ) {
          for (
            let k = j + 1;
            k < womenPool.length;
            k++
          ) {
            for (
              let l = k + 1;
              l < womenPool.length;
              l++
            ) {
              const group: [
                Player,
                Player,
                Player,
                Player,
              ] = [
                womenPool[i],
                womenPool[j],
                womenPool[k],
                womenPool[l],
              ];

              if (
                !topThreeWomen.every(
                  (player) =>
                    group.some(
                      (member) =>
                        member.id ===
                        player.id
                    )
                ) ||
                containsExcludedPair(
                  group,
                  excludedMatchPairs
                )
              ) {
                continue;
              }

              const score =
                scorePlayerSelection(
                  group
                ).total;

              if (
                score >
                fallbackWomenScore
              ) {
                fallbackWomenScore =
                  score;
                fallbackWomenGroup =
                  group;
              }

              if (
                score >
                bestWomenScore
              ) {
                bestWomenScore =
                  score;
                bestWomenGroup =
                  group;
              }
            }
          }
        }
      }

      if (bestWomenGroup) {
        return bestWomenGroup;
      }

      if (fallbackWomenGroup) {
        return fallbackWomenGroup;
      }
    }
  }

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
  let fallbackGroup:
    | [Player, Player, Player, Player]
    | null = null;
  let bestScore =
    Number.NEGATIVE_INFINITY;
  let fallbackScore =
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

          if (
            containsExcludedPair(
              group,
              excludedMatchPairs
            )
          ) {
            continue;
          }

          const score =
            scorePlayerSelection(
              group
            ).total +
            getGenderSelectionAdjustment(
              group,
              waitingWomenCount
            );

          if (
            score > fallbackScore
          ) {
            fallbackScore = score;
            fallbackGroup = group;
          }

          if (
            containsRecentHardRepeat(
              group,
              {
                ignoreFixedPartners:
                  true,
              }
            )
          ) {
            continue;
          }

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
    fallbackGroup ??
    candidatePool.slice(0, 4)
  );
}
