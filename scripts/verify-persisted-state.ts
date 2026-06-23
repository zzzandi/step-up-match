import assert from "node:assert/strict";

import {
  normalizePersistedMatchState,
} from "../src/store/persistedState.ts";

const activePlayer = {
  id: "master",
  name: "김민수",
  status: "WAITING",
  arrivalTime:
    "2026-06-23T10:00:00.000Z",
  waitingStartedAt:
    "2026-06-23T10:01:00.000Z",
  lastPartners: null,
  lastOpponents: null,
};
const activeCourt = {
  id: 1,
  status: "PLAYING",
  startedAt:
    "2026-06-23T11:00:00.000Z",
  teamA: [
    {
      ...activePlayer,
      arrivalTime:
        "2026-06-23T10:30:00.000Z",
    },
  ],
  teamB: null,
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
    matchHistory: [
      {
        id: "match-1",
        startedAt:
          "2026-06-23T11:00:00.000Z",
        endedAt:
          "2026-06-23T11:20:00.000Z",
      },
    ],
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
  normalized.players.length,
  1,
  "정상 참가자 정보는 보존되어야 합니다."
);
assert.equal(
  normalized.players[0].name,
  activePlayer.name
);
assert.ok(
  normalized.players[0]
    .waitingStartedAt instanceof Date,
  "대기 시작 시간은 Date로 복원되어야 합니다."
);
assert.deepEqual(
  normalized.players[0]
    .lastPartners,
  []
);
assert.equal(
  normalized.courts.length,
  1,
  "진행 중인 코트 정보는 보존되어야 합니다."
);
assert.ok(
  normalized.courts[0]
    .startedAt instanceof Date,
  "코트 시작 시간은 Date로 복원되어야 합니다."
);
assert.ok(
  normalized.courts[0].teamA[0]
    .arrivalTime instanceof Date,
  "코트 선수 시간도 Date로 복원되어야 합니다."
);
assert.ok(
  normalized.matchHistory[0]
    .endedAt instanceof Date,
  "경기 기록 시간은 Date로 복원되어야 합니다."
);

[
  "fixedPartnerRequests",
  "fixedPartnerAssignments",
  "fixedPartnerRequestResolutions",
  "notifications",
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
  "Persisted state recovery: 15 checks passed."
);
