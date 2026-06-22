import type { Court } from "@/types/court";
import type { MatchHistory } from "@/types/matchHistory";

export function createMatchHistory(
  court: Court
): MatchHistory | null {
  if (
    !court.teamA ||
    !court.teamB ||
    !court.startedAt
  ) {
    return null;
  }

  return {
    id: crypto.randomUUID(),

    courtId: court.id,

    teamA: [
      court.teamA[0].id,
      court.teamA[1].id,
    ],

    teamB: [
      court.teamB[0].id,
      court.teamB[1].id,
    ],

    playerNames: Object.fromEntries(
      [
        ...court.teamA,
        ...court.teamB,
      ].map((player) => [
        player.id,
        player.name,
      ])
    ),

    startedAt:
      court.startedAt,

    endedAt:
      new Date(),

    teamAScore: undefined,

    teamBScore: undefined,
  };
}
