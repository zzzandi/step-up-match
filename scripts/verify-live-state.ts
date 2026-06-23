import assert from "node:assert/strict";

import {
  createLiveStatePatch,
  createLiveStateSnapshot,
  mergeLiveStateSnapshot,
  type LiveStateSnapshot,
} from "../src/services/liveStateSync.ts";
import type {
  Player,
} from "../src/types/player.ts";

function player(
  id: string,
  status:
    | "WAITING"
    | "PLAYING"
    | "LEFT" = "WAITING"
): Player {
  return {
    id,
    name: id,
    gender: "M",
    grade: "E",
    hiddenSkill: 40,
    isPresent:
      status !== "LEFT",
    arrivalTime:
      new Date(
        "2026-06-22T10:00:00Z"
      ),
    matchCount:
      status === "PLAYING"
        ? 2
        : 0,
    consecutiveMatches: 0,
    status,
    waitingStartedAt:
      new Date(
        "2026-06-22T10:00:00Z"
      ),
    playingStartedAt:
      status === "PLAYING"
        ? new Date(
            "2026-06-22T10:20:00Z"
          )
        : undefined,
    lastPartners: [],
    lastOpponents: [],
  };
}

const p1 = player(
  "player-1",
  "PLAYING"
);
const p2 = player("player-2");
const p3 = player("player-3");
const p4 = player("player-4");

function snapshot(
  overrides: Partial<LiveStateSnapshot> =
    {}
): LiveStateSnapshot {
  return {
    players: [p1, p2, p3, p4],
    courts: [
      {
        id: 1,
        status: "PLAYING",
        teamA: [p1, p2],
        teamB: [p3, p4],
        startedAt:
          new Date(
            "2026-06-22T10:20:00Z"
          ),
      },
    ],
    fixedPartnerRequests: [
      {
        id: "fixed-1",
        requesterId: p1.id,
        requesterName: p1.name,
        partnerId: p2.id,
        partnerName: p2.name,
        createdAt:
          "2026-06-22T10:05:00Z",
      },
    ],
    notifications: [],
    matchHistory: [
      {
        id: "match-1",
        courtId: 1,
        teamA: [p1.id, p2.id],
        teamB: [p3.id, p4.id],
        startedAt:
          new Date(
            "2026-06-22T09:30:00Z"
          ),
        endedAt:
          new Date(
            "2026-06-22T09:50:00Z"
          ),
      },
    ],
    womenDoublesPriority: true,
    excludedMatchPairs: [
      [p1.id, p4.id],
    ],
    ...overrides,
  };
}

const live = snapshot();
const stalePlayerSnapshot =
  snapshot({
    players: [
      player("new-player"),
    ],
    courts: [],
    fixedPartnerRequests: [],
    matchHistory: [],
    womenDoublesPriority: false,
    excludedMatchPairs: [],
  });
const playerJoinResult =
  mergeLiveStateSnapshot(
    live,
    stalePlayerSnapshot,
    "PLAYER",
    "new-player"
  );

assert.deepEqual(
  playerJoinResult.courts,
  live.courts,
  "새 플레이어가 진행 중 코트를 지우면 안 됩니다."
);
assert.deepEqual(
  playerJoinResult.fixedPartnerRequests,
  live.fixedPartnerRequests,
  "새 플레이어가 고정 파트너 신청을 지우면 안 됩니다."
);
assert.deepEqual(
  playerJoinResult.excludedMatchPairs,
  live.excludedMatchPairs,
  "새 플레이어가 경기 회피 설정을 지우면 안 됩니다."
);
assert.equal(
  playerJoinResult.players.at(-1)
    ?.id,
  "new-player",
  "새 플레이어는 기존 상태에 추가되어야 합니다."
);

const staleOwnState =
  snapshot({
    players: [
      player(
        "player-1",
        "WAITING"
      ),
      player(
        "player-2",
        "LEFT"
      ),
    ],
  });
const playingResult =
  mergeLiveStateSnapshot(
    live,
    staleOwnState,
    "PLAYER",
    "player-1"
  );

assert.equal(
  playingResult.players.find(
    (item) =>
      item.id === "player-1"
  )?.status,
  "PLAYING",
  "경기 중 선수는 본인의 오래된 WAITING 상태로 되돌아가면 안 됩니다."
);
assert.equal(
  playingResult.players.find(
    (item) =>
      item.id === "player-2"
  )?.status,
  "WAITING",
  "플레이어가 다른 참가자의 상태를 바꾸면 안 됩니다."
);

const leftResult =
  mergeLiveStateSnapshot(
    live,
    snapshot({
      players: [
        player(
          "player-1",
          "LEFT"
        ),
      ],
    }),
    "PLAYER",
    "player-1"
  );

assert.equal(
  leftResult.players.find(
    (item) =>
      item.id === "player-1"
  )?.status,
  "LEFT",
  "본인의 운동 종료 상태는 반영되어야 합니다."
);

const scoreResult =
  mergeLiveStateSnapshot(
    live,
    snapshot({
      players: [p1],
      matchHistory: [
        {
          ...live.matchHistory[0],
          teamAScore: 25,
          teamBScore: 18,
        },
      ],
    }),
    "PLAYER",
    "player-1"
  );

assert.equal(
  scoreResult.matchHistory[0]
    .teamAScore,
  25,
  "플레이어가 저장한 경기 점수는 반영되어야 합니다."
);

const newRequest = {
  id: "fixed-2",
  requesterId: "player-2",
  requesterName: "player-2",
  partnerId: "player-3",
  partnerName: "player-3",
  createdAt:
    "2026-06-22T10:30:00Z",
};
const requestResult =
  mergeLiveStateSnapshot(
    live,
    snapshot({
      players: [p2],
      fixedPartnerRequests: [
        newRequest,
      ],
    }),
    "PLAYER",
    "player-2"
  );

assert.deepEqual(
  requestResult.fixedPartnerRequests.map(
    (request) => request.id
  ),
  ["fixed-1", "fixed-2"],
  "새 고정 파트너 신청은 기존 신청을 보존하면서 추가되어야 합니다."
);

const managerSnapshot =
  snapshot({
    players: [
      ...live.players,
      player("new-admin"),
    ],
  });

for (const role of [
  "ADMIN",
  "MASTER",
] as const) {
  const result =
    mergeLiveStateSnapshot(
      snapshot(),
      managerSnapshot,
      role
    );

  assert.deepEqual(
    result,
    managerSnapshot,
    `${role}의 권한 있는 공유 상태는 동일하게 동기화되어야 합니다.`
  );
}

const localUiState = {
  ...live,
  recommendations: [],
  selectedRecommendation: null,
};
const localUiChangedState = {
  ...localUiState,
  recommendations: [
    {
      id: "local-only",
    },
  ],
  selectedRecommendation: {
    id: "local-only",
  },
};
const localUiPatch =
  createLiveStatePatch(
    createLiveStateSnapshot(
      localUiState as never
    ),
    createLiveStateSnapshot(
      localUiChangedState as never
    )
  );

assert.deepEqual(
  localUiPatch.changedKeys,
  [],
  "추천 모달 상태는 다른 기기로 방송되면 안 됩니다."
);

console.log(
  "live-state regression scenarios: PASS (9)"
);
