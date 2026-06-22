import type { Court } from "@/types/court";
import type { Player } from "@/types/player";

import {
  generateTeams,
} from "./teamGenerator";

import {
  calculateMatchScore,
} from "./scoreCalculator";

export function initializeMatches(
  players: Player[],
  courtCount: number
): {
  courts: Court[];
  updatedPlayers: Player[];
} {
  const arrivedPlayers =
    [...players]
      .filter(
        (player) =>
          player.isPresent
      )
      .sort(
        (a, b) =>
          new Date(
            a.arrivalTime
          ).getTime() -
          new Date(
            b.arrivalTime
          ).getTime()
      );

  const playingCount =
    courtCount * 4;

  const selectedPlayers =
    arrivedPlayers.slice(
      0,
      playingCount
    );

  const selectedIds =
    new Set(
      selectedPlayers.map(
        (player) =>
          player.id
      )
    );

  const updatedPlayers =
    players.map(
      (player) => {
        if (
          selectedIds.has(
            player.id
          )
        ) {
          return {
            ...player,

            status:
              "PLAYING" as const,

            matchCount:
              player.matchCount +
              1,

            playingStartedAt:
              new Date(),
          };
        }

        return {
          ...player,

          status:
            "WAITING" as const,

          waitingStartedAt:
            new Date(),
        };
      }
    );

  const courts: Court[] =
    [];

  for (
    let i = 0;
    i < courtCount;
    i++
  ) {
    const start =
      i * 4;

    const group =
      selectedPlayers.slice(
        start,
        start + 4
      );

    if (
      group.length < 4
    ) {
      break;
    }

    const matches =
      generateTeams(
        group
      );

    const bestMatch =
      matches.sort(
        (a, b) =>
          calculateMatchScore(
            b.teamA,
            b.teamB
          ).total -
          calculateMatchScore(
            a.teamA,
            a.teamB
          ).total
      )[0];

    courts.push({
      id: i + 1,

      status:
        "PLAYING",

      teamA:
        bestMatch.teamA,

      teamB:
        bestMatch.teamB,

      startedAt:
        new Date(),
    });
  }

  return {
    courts,
    updatedPlayers,
  };
}
