import assert from "node:assert/strict";

import {
  normalizePersistedMatchState,
} from "../src/store/persistedState.ts";

const activeCourt = {
  id: 1,
  status: "PLAYING",
};
const activePlayer = {
  id: "master",
  name: "김민수",
  status: "WAITING",
};

const normalized =
  normalizePersistedMatchState({
    players: [activePlayer],
    courts: [activeCourt],
    fixedPartnerRequests: null,
    fixedPartnerAssignments:
      undefined,
    fixedPartnerRequestResolutions:
      "invalid",
    notifications: null,
    matchHistory: {},
    excludedMatchPairs: null,
    recommendations: [
      {
        id: "stale",
      },
    ],
    selectedRecommendation: {
      id: "stale",
    },
    womenDoublesPriority: "true",
  });

assert.deepEqual(
  normalized.players,
  [activePlayer],
  "정상 참가자 정보는 보존되어야 합니다."
);
assert.deepEqual(
  normalized.courts,
  [activeCourt],
  "진행 중인 코트 정보는 보존되어야 합니다."
);

[
  "fixedPartnerRequests",
  "fixedPartnerAssignments",
  "fixedPartnerRequestResolutions",
  "notifications",
  "matchHistory",
  "excludedMatchPairs",
  "recommendations",
].forEach((field) => {
  assert.deepEqual(
    normalized[field],
    [],
    `${field}의 손상된 값은 빈 배열로 복구되어야 합니다.`
  );
});

assert.equal(
  normalized.selectedRecommendation,
  null
);
assert.equal(
  normalized.womenDoublesPriority,
  false
);
assert.deepEqual(
  normalizePersistedMatchState(null),
  {}
);

console.log(
  "Persisted state recovery: 11 checks passed."
);
