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
const BALANCE_SOFT_LIMIT = 8;
const BALANCE_HEAVY_LIMIT = 16;
const BALANCE_PENALTY_PER_POINT = 2.5;
const BALANCE_HEAVY_PENALTY_PER_POINT = 3;
const PARTNER_REPEAT_PENALTY = 18;
const OPPONENT_REPEAT_PENALTY = 8;
const SINGLE_WOMAN_MIXED_PENALTY = 60;

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

function countOccurrences(
  items: string[],
  target: string
) {
  return items.filter(
    (item) => item === target
  ).length;
}

function countRecentPartnerRepeats(
  playerA: TeamMatch["teamA"][number],
  playerB: TeamMatch["teamA"][number]
) {
  return (
    countOccurrences(
      playerA.lastPartners,
      playerB.id
    ) +
    countOccurrences(
      playerB.lastPartners,
      playerA.id
    )
  );
}

function countRecentOpponentRepeats(
  playerA: TeamMatch["teamA"][number],
  playerB: TeamMatch["teamA"][number]
) {
  return (
    countOccurrences(
      playerA.lastOpponents,
      playerB.id
    ) +
    countOccurrences(
      playerB.lastOpponents,
      playerA.id
    )
  );
}

export interface RecommendationScore {
  total: number;
  balance: number;
  balanceGap: number;
  balanceGapPenalty: number;
  diversity: number;
  partnerDiversity: number;
  opponentDiversity: number;
  partnerPenalty: number;
  opponentPenalty: number;
  genderBonus: number;
  fixedPartnerBonus: number;
  fixedPartnerBalancePenalty: number;
  singleWomanMixedPenalty: number;
}

export function scoreMatch(
  match: TeamMatch,
  {
    discourageSingleWomanMixed = false,
  }: {
    discourageSingleWomanMixed?: boolean;
  } = {}
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
  const balanceGapPenalty =
    Math.max(
      0,
      gap - BALANCE_SOFT_LIMIT
    ) *
      BALANCE_PENALTY_PER_POINT +
    Math.max(
      0,
      gap - BALANCE_HEAVY_LIMIT
    ) *
      BALANCE_HEAVY_PENALTY_PER_POINT;

  let partnerPenalty = 0;

  if (
    !isFixedPartnerPair(
      teamA[0],
      teamA[1]
    )
  ) {
    partnerPenalty -=
      Math.min(
        3,
        countRecentPartnerRepeats(
          teamA[0],
          teamA[1]
        )
      ) * PARTNER_REPEAT_PENALTY;
  }

  if (
    !isFixedPartnerPair(
      teamB[0],
      teamB[1]
    )
  ) {
    partnerPenalty -=
      Math.min(
        3,
        countRecentPartnerRepeats(
          teamB[0],
          teamB[1]
        )
      ) * PARTNER_REPEAT_PENALTY;
  }

  const partnerDiversity =
    Math.max(
      -weights.partnerDiversity,
      weights.partnerDiversity +
        partnerPenalty
    );
  let opponentPenalty = 0;

  teamA.forEach((player) => {
    teamB.forEach((opponent) => {
      opponentPenalty -=
        Math.min(
          3,
          countRecentOpponentRepeats(
            player,
            opponent
          )
        ) * OPPONENT_REPEAT_PENALTY;
    });
  });

  const opponentDiversity =
    Math.max(
      -weights.opponentDiversity,
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
  const femaleCount =
    allPlayers.filter(
      (player) =>
        player.gender === "F"
    ).length;
  const singleWomanMixedPenalty =
    discourageSingleWomanMixed &&
    femaleCount === 1
      ? SINGLE_WOMAN_MIXED_PENALTY
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
    balanceGapPenalty -
    fixedPartnerBalancePenalty -
    singleWomanMixedPenalty;

  return {
    total,
    balance,
    balanceGap: gap,
    balanceGapPenalty,
    diversity,
    partnerDiversity,
    opponentDiversity,
    partnerPenalty,
    opponentPenalty,
    genderBonus,
    fixedPartnerBonus,
    fixedPartnerBalancePenalty,
    singleWomanMixedPenalty,
  };
}
