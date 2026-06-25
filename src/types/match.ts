import type { Player } from "./player";

export interface MatchScoreDetail {
  total: number;

  balance: number;

  diversity: number;

  partnerDiversity?: number;

  opponentDiversity?: number;

  partnerPenalty: number;

  opponentPenalty: number;

  genderBonus: number;

  fixedPartnerBonus: number;

  fixedPartnerBalancePenalty?: number;
}

export interface MatchRecommendation {
  id: string;

  courtId: number;

  teamA: [Player, Player];

  teamB: [Player, Player];

  score: MatchScoreDetail;

  createdAt: Date;
}
