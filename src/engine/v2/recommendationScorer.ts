import type {
  TeamMatch,
} from "./recommendationBuilder";

export interface RecommendationScore {
  total: number;

  balance: number;

  diversity: number;

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

  let total = 0;

  /*
   * 1. 실력 밸런스
   * 최대 40
   */

  const teamASkill =
    teamA[0].hiddenSkill +
    teamA[1].hiddenSkill;

  const teamBSkill =
    teamB[0].hiddenSkill +
    teamB[1].hiddenSkill;

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
   * 2. 사람 섞기
   * 최대 30
   */

  let diversity = 30;

  [...teamA, ...teamB].forEach(
    (player) => {
      diversity -=
        player.lastPartners.length *
        0.5;

      diversity -=
        player.lastOpponents.length *
        0.25;
    }
  );

  diversity =
    Math.max(
      0,
      diversity
    );

  total += diversity;

  /*
   * 3. 파트너 중복
   */

  let partnerPenalty = 0;

  if (
    teamA[0].lastPartners.includes(
      teamA[1].id
    )
  ) {
    partnerPenalty -= 15;
  }

  if (
    teamB[0].lastPartners.includes(
      teamB[1].id
    )
  ) {
    partnerPenalty -= 15;
  }

  total += partnerPenalty;

  /*
   * 4. 상대 중복
   */

  let opponentPenalty = 0;

  teamA.forEach(
    (player) => {
      teamB.forEach(
        (opponent) => {
          if (
            player.lastOpponents.includes(
              opponent.id
            )
          ) {
            opponentPenalty -= 5;
          }
        }
      );
    }
  );

  total += opponentPenalty;

  /*
   * 5. 성별 정책
   */

  let genderBonus = 0;

  const teamAFemale =
    teamA.filter(
      (p) =>
        p.gender === "F"
    ).length;

  const teamBFemale =
    teamB.filter(
      (p) =>
        p.gender === "F"
    ).length;

  if (
    teamAFemale === 2 &&
    teamBFemale === 2
  ) {
    genderBonus += 30;
  }

  if (
    teamAFemale === 1 &&
    teamBFemale === 1
  ) {
    genderBonus += 20;
  }

  total += genderBonus;

  /*
   * 6. 고정 파트너
   */

  let fixedPartnerBonus = 0;

  if (
    teamA[0]
      .fixedPartner ===
    teamA[1].id
  ) {
    fixedPartnerBonus += 100;
  }

  if (
    teamB[0]
      .fixedPartner ===
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
