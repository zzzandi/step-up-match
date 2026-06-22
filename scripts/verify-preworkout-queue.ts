import assert from "node:assert/strict";

import {
  getQueuedParticipationMode,
  sortWaitingPlayersByQueue,
} from "../src/utils/preWorkoutQueue.ts";
import type {
  Player,
} from "../src/types/player.ts";

function queuedPlayer(
  id: string,
  name: string,
  registeredAt: string
): Player {
  const registeredDate =
    new Date(registeredAt);

  return {
    id,
    name,
    gender: "M",
    grade: "E",
    hiddenSkill: 45,
    isPresent: true,
    arrivalTime:
      registeredDate,
    matchCount: 0,
    consecutiveMatches: 0,
    status: "WAITING",
    waitingStartedAt:
      registeredDate,
    lastPartners: [],
    lastOpponents: [],
  };
}

assert.equal(
  getQueuedParticipationMode(
    false
  ),
  "PENDING",
  "플레이어는 등록 후 운동 개설을 기다려야 합니다."
);
assert.equal(
  getQueuedParticipationMode(
    true
  ),
  "PENDING_MANAGER",
  "운영진과 마스터는 대기 순서를 유지한 채 대시보드로 이동해야 합니다."
);

const jeongSeongHo =
  queuedPlayer(
    "player-jeong",
    "정성호",
    "2026-06-22T10:00:00.100Z"
  );
const yooWonSeok =
  queuedPlayer(
    "admin-yoo",
    "유원석",
    "2026-06-22T10:00:00.200Z"
  );
const kimMinSoo =
  queuedPlayer(
    "master-kim",
    "김민수",
    "2026-06-22T10:00:00.300Z"
  );

const queue =
  sortWaitingPlayersByQueue([
    kimMinSoo,
    jeongSeongHo,
    yooWonSeok,
  ]);

assert.deepEqual(
  queue.map(
    (player) => player.name
  ),
  [
    "정성호",
    "유원석",
    "김민수",
  ],
  "역할과 관계없이 대기열 등록 시각 순서가 유지되어야 합니다."
);

console.log(
  "pre-workout queue scenarios: PASS (3)"
);
