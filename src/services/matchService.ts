import type { Player } from "@/types/player";
import type { Court } from "@/types/court";
import type {
  MatchRecommendation,
} from "@/types/match";

import {
  generateRecommendations,
} from "@/engine/matchEngine";

export function createRecommendations(
  courtId: number,
  players: Player[]
): MatchRecommendation[] {
  return generateRecommendations(
    courtId,
    players
  );
}

export function createCourtFromRecommendation(
  recommendation: MatchRecommendation
): Court {
  return {
    id:
      recommendation.courtId,

    status:
      "PLAYING",

    teamA:
      recommendation.teamA,

    teamB:
      recommendation.teamB,

    startedAt:
      new Date(),
  };
}

export function getSelectedPlayerIds(
  recommendation: MatchRecommendation
): string[] {
  return [
    ...recommendation.teamA,
    ...recommendation.teamB,
  ].map(
    (player) =>
      player.id
  );
}