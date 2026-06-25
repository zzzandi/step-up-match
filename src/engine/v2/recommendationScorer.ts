import type {
  TeamMatch,
} from "./recommendationBuilder";

import {
  ENGINE_CONFIG,
} from "./engineConfig";
import {
  isCompatibleGenderMatch,
} from "./genderRules";
import {
  getEffectiveHiddenSkill,
} from "@/utils/skillOverrides";
import {
  getRestMinutes,
} from "@/utils/time";

const FIXED_PARTNER_TEAM_BONUS = 8;
const MIN_FIXED_PARTNER_REST_MINUTES = 8;

export interface RecommendationScore {
  total: number;
  balance: number;
  diversity: number;
  partnerDiversity: number;
  opponentDiversity: number;
  partnerPenalty: number;
  opponentPenalty: number;
  genderBonus: number;
  fixedPartnerBonus: number;
}

export function scoreMatch(
  match: TeamMatch
): RecommendationScore {
  const {
    teamA,
    teamB,
  } = match;
  const weights =
    ENGINE_CONFIG.teamCreation;
  const teamASkill =
    getEffectiveHiddenSkill(
      teamA[0]
    ) +
    getEffectiveHiddenSkill(
      teamA[1]
    );
  const teamBSkill =
    getEffectiveHiddenSkill(
      teamB[0]
    ) +
    getEffectiveHiddenSkill(
      teamB[1]
    );
  const gap =
    Math.abs(
      teamASkill -
        teamBSkill
    );
  const balance =
    Math.max(
      0,
      weights.balance - gap
    );

  let partnerPenalty = 0;

  if (
    teamA[0].lastPartners.includes(
      teamA[1].id
    ) ||
    teamA[1].lastPartners.includes(
      teamA[0].id
    )
  ) {
    partnerPenalty -= 15;
  }

  if (
    teamB[0].lastPartners.includes(
      teamB[1].id
    ) ||
    teamB[1].lastPartners.includes(
      teamB[0].id
    )
  ) {
    partnerPenalty -= 15;
  }

  const partnerDiversity =
    weights.partnerDiversity +
    partnerPenalty;
  let opponentPenalty = 0;

  teamA.forEach((player) => {
    teamB.forEach((opponent) => {
      if (
        player.lastOpponents.includes(
          opponent.id
        ) ||
        opponent.lastOpponents.includes(
          player.id
        )
      ) {
        opponentPenalty -= 5;
      }
    });
  });

  const opponentDiversity =
    Math.max(
      0,
      weights.opponentDiversity +
        opponentPenalty
    );
  const genderBonus =
    isCompatibleGenderMatch(
      teamA,
      teamB
    )
      ? weights.genderBalance
      : 0;
  let fixedPartnerBonus = 0;

  const teamAFixedPartnerReady =
    getRestMinutes(
      teamA[0].waitingStartedAt
    ) >=
      MIN_FIXED_PARTNER_REST_MINUTES &&
    getRestMinutes(
      teamA[1].waitingStartedAt
    ) >=
      MIN_FIXED_PARTNER_REST_MINUTES;
  const teamBFixedPartnerReady =
    getRestMinutes(
      teamB[0].waitingStartedAt
    ) >=
      MIN_FIXED_PARTNER_REST_MINUTES &&
    getRestMinutes(
      teamB[1].waitingStartedAt
    ) >=
      MIN_FIXED_PARTNER_REST_MINUTES;

  if (
    teamAFixedPartnerReady &&
    (teamA[0].fixedPartner ===
      teamA[1].id ||
      teamA[1].fixedPartner ===
        teamA[0].id)
  ) {
    fixedPartnerBonus += 1;
  }

  if (
    teamBFixedPartnerReady &&
    (teamB[0].fixedPartner ===
      teamB[1].id ||
      teamB[1].fixedPartner ===
        teamB[0].id)
  ) {
    fixedPartnerBonus += 1;
  }

  const diversity =
    partnerDiversity +
    opponentDiversity;
  const total =
    balance +
    partnerDiversity +
    opponentDiversity +
    genderBonus +
    fixedPartnerBonus *
      FIXED_PARTNER_TEAM_BONUS;

  return {
    total,
    balance,
    diversity,
    partnerDiversity,
    opponentDiversity,
    partnerPenalty,
    opponentPenalty,
    genderBonus,
    fixedPartnerBonus,
  };
}
