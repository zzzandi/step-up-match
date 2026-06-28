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
  getSingleWomanMixedSkill,
} from "@/utils/grades";
import {
  getRestMinutes,
} from "@/utils/time";

const FIXED_PARTNER_TEAM_BONUS = 8;
const MIN_FIXED_PARTNER_REST_MINUTES = 8;
const MAX_FIXED_PARTNER_BALANCE_GAP = 10;
const FIXED_PARTNER_IMBALANCE_PENALTY_PER_POINT = 2;

function isFixedPartnerPair(
  playerA: TeamMatch["teamA"][number],
  playerB: TeamMatch["teamA"][number]
) {
  return (
    playerA.fixedPartner === playerB.id ||
    playerB.fixedPartner === playerA.id
  );
}

function getBalanceSkill(
  player: TeamMatch["teamA"][number],
  allPlayers: TeamMatch["teamA"][number][]
) {
  const womanCount =
    allPlayers.filter(
      (item) =>
        item.gender === "F"
    ).length;

  if (
    womanCount === 1 &&
    player.gender === "F"
  ) {
    return getSingleWomanMixedSkill(
      player.grade
    );
  }

  return getEffectiveHiddenSkill(
    player
  );
}

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
  fixedPartnerBalancePenalty: number;
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
  const allPlayers = [
    ...teamA,
    ...teamB,
  ];
  const teamASkill =
    getBalanceSkill(
      teamA[0],
      allPlayers
    ) +
    getBalanceSkill(
      teamA[1],
      allPlayers
    );
  const teamBSkill =
    getBalanceSkill(
      teamB[0],
      allPlayers
    ) +
    getBalanceSkill(
      teamB[1],
      allPlayers
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
    !isFixedPartnerPair(
      teamA[0],
      teamA[1]
    ) &&
    (teamA[0].lastPartners.includes(
      teamA[1].id
    ) ||
      teamA[1].lastPartners.includes(
        teamA[0].id
      ))
  ) {
    partnerPenalty -= 15;
  }

  if (
    !isFixedPartnerPair(
      teamB[0],
      teamB[1]
    ) &&
    (teamB[0].lastPartners.includes(
      teamB[1].id
    ) ||
      teamB[1].lastPartners.includes(
        teamB[0].id
      ))
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
  let fixedPartnerBalancePenalty = 0;

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

  const hasTeamAFixedPartner =
    isFixedPartnerPair(
      teamA[0],
      teamA[1]
    );
  const hasTeamBFixedPartner =
    isFixedPartnerPair(
      teamB[0],
      teamB[1]
    );
  const hasFixedPartnerTeam =
    hasTeamAFixedPartner ||
    hasTeamBFixedPartner;
  const isFixedPartnerMatchBalanced =
    gap <= MAX_FIXED_PARTNER_BALANCE_GAP;

  if (
    teamAFixedPartnerReady &&
    hasTeamAFixedPartner &&
    isFixedPartnerMatchBalanced
  ) {
    fixedPartnerBonus += 1;
  }

  if (
    teamBFixedPartnerReady &&
    hasTeamBFixedPartner &&
    isFixedPartnerMatchBalanced
  ) {
    fixedPartnerBonus += 1;
  }

  if (
    hasFixedPartnerTeam &&
    !isFixedPartnerMatchBalanced
  ) {
    fixedPartnerBalancePenalty =
      (gap - MAX_FIXED_PARTNER_BALANCE_GAP) *
      FIXED_PARTNER_IMBALANCE_PENALTY_PER_POINT;
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
      FIXED_PARTNER_TEAM_BONUS -
    fixedPartnerBalancePenalty;

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
    fixedPartnerBalancePenalty,
  };
}
