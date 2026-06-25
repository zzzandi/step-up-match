import type { Player } from "@/types/player";

import type {
  MatchScoreDetail,
} from "@/types/match";
import {
  getEffectiveHiddenSkill,
} from "@/utils/skillOverrides";

function getPartnerDiversityScore(
  playerA: Player,
  playerB: Player
) {
  const index =
    playerA.lastPartners.indexOf(
      playerB.id
    );

  if (index === -1) {
    return 10;
  }

  if (
    index ===
    playerA.lastPartners.length - 1
  ) {
    return -50;
  }

  if (
    index ===
    playerA.lastPartners.length - 2
  ) {
    return -20;
  }

  return -10;
}

function getOpponentDiversityScore(
  player: Player,
  opponent: Player
) {
  const index =
    player.lastOpponents.indexOf(
      opponent.id
    );

  if (index === -1) {
    return 5;
  }

  if (
    index ===
    player.lastOpponents.length - 1
  ) {
    return -15;
  }

  return -5;
}

export function calculateMatchScore(
  teamA: [Player, Player],
  teamB: [Player, Player]
): MatchScoreDetail {
  let total = 0;

  /*
   * 실력 밸런스
   * 최대 40
   */

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
      40 - gap
    );

  total += balance;

  /*
   * 사람 섞기
   */

  let diversity = 0;

  diversity +=
    getPartnerDiversityScore(
      teamA[0],
      teamA[1]
    );

  diversity +=
    getPartnerDiversityScore(
      teamB[0],
      teamB[1]
    );

  teamA.forEach(
    (player) => {
      teamB.forEach(
        (opponent) => {
          diversity +=
            getOpponentDiversityScore(
              player,
              opponent
            );
        }
      );
    }
  );

  total += diversity;

  /*
   * 최근 파트너 패널티
   */

  let partnerPenalty = 0;

  const teamAPartnerIndex =
    teamA[0].lastPartners.indexOf(
      teamA[1].id
    );

  if (
    teamAPartnerIndex !== -1
  ) {
    if (
      teamAPartnerIndex ===
      teamA[0].lastPartners.length - 1
    ) {
      partnerPenalty -= 100;
    } else if (
      teamAPartnerIndex ===
      teamA[0].lastPartners.length - 2
    ) {
      partnerPenalty -= 50;
    } else {
      partnerPenalty -= 20;
    }
  }

  const teamBPartnerIndex =
    teamB[0].lastPartners.indexOf(
      teamB[1].id
    );

  if (
    teamBPartnerIndex !== -1
  ) {
    if (
      teamBPartnerIndex ===
      teamB[0].lastPartners.length - 1
    ) {
      partnerPenalty -= 100;
    } else if (
      teamBPartnerIndex ===
      teamB[0].lastPartners.length - 2
    ) {
      partnerPenalty -= 50;
    } else {
      partnerPenalty -= 20;
    }
  }

  total += partnerPenalty;

  /*
   * 최근 상대 패널티
   */

  let opponentPenalty = 0;

  teamA.forEach(
    (player) => {
      teamB.forEach(
        (opponent) => {
          const index =
            player.lastOpponents.indexOf(
              opponent.id
            );

          if (
            index !== -1
          ) {
            if (
              index ===
              player.lastOpponents.length - 1
            ) {
              opponentPenalty -= 30;
            } else if (
              index ===
              player.lastOpponents.length - 2
            ) {
              opponentPenalty -= 15;
            } else {
              opponentPenalty -= 5;
            }
          }
        }
      );
    }
  );

  total += opponentPenalty;

  /*
   * 성별 보너스
   */

  let genderBonus = 0;

  const femaleCount =
    [
      ...teamA,
      ...teamB,
    ].filter(
      (player) =>
        player.gender === "F"
    ).length;

  const teamAFemale =
    teamA.filter(
      (player) =>
        player.gender === "F"
    ).length;

  const teamBFemale =
    teamB.filter(
      (player) =>
        player.gender === "F"
    ).length;

  /*
   * 여복 우선
   */

  if (
    femaleCount === 4
  ) {
    genderBonus += 30;
  }

  /*
   * 혼복 vs 혼복
   */

  if (
    teamAFemale === 1 &&
    teamBFemale === 1
  ) {
    genderBonus += 20;
  }

  /*
   * 여자 2명 활용
   */

  if (
    femaleCount === 2
  ) {
    genderBonus += 10;
  }

  total += genderBonus;

  /*
   * 고정 파트너
   */

  let fixedPartnerBonus = 0;

  if (
    teamA[0].fixedPartner ===
    teamA[1].id
  ) {
    fixedPartnerBonus += 100;
  }

  if (
    teamB[0].fixedPartner ===
    teamB[1].id
  ) {
    fixedPartnerBonus += 100;
  }

  total +=
    fixedPartnerBonus;

  return {
    total,

    balance,

    diversity,

    partnerPenalty,

    opponentPenalty,

    genderBonus,

    fixedPartnerBonus,
  };
}
