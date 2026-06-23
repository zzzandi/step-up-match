import assert from "node:assert/strict";

import {
  SNAPSHOT_REQUEST_RETRY_DELAYS,
  shouldApplyStateSnapshot,
  shouldClearSessionForForceLogout,
} from "../src/services/liveEventGuards.ts";
import type {
  LiveSessionEvent,
} from "../src/services/liveSessionService.ts";
import type {
  LiveStateSnapshot,
} from "../src/services/liveStateSync.ts";

const emptySnapshot: LiveStateSnapshot = {
  players: [],
  courts: [],
  fixedPartnerRequests: [],
  fixedPartnerAssignments: [],
  fixedPartnerRequestResolutions: [],
  notifications: [],
  matchHistory: [],
  womenDoublesPriority: false,
  excludedMatchPairs: [],
};

function snapshotEvent(
  overrides: Partial<
    Extract<
      LiveSessionEvent,
      { type: "STATE_SNAPSHOT" }
    >
  > = {}
): Extract<
  LiveSessionEvent,
  { type: "STATE_SNAPSHOT" }
> {
  return {
    type: "STATE_SNAPSHOT",
    snapshot: emptySnapshot,
    sourceRole: "MASTER",
    sourceUserId: "master-1",
    sourceClientId: "master-client",
    sentAt: "2026-06-23T12:00:00.000Z",
    ...overrides,
  };
}

const clients = Array.from(
  { length: 30 },
  (_, index) => `client-${index + 1}`
);
const requester = "client-17";
const requestId = "request-17";
const response = snapshotEvent({
  responseToRequestId: requestId,
});

const applyingClients = clients.filter(
  (clientId) =>
    shouldApplyStateSnapshot(
      response,
      clientId,
      clientId === requester
        ? new Set([requestId])
        : new Set()
    )
);

assert.deepEqual(
  applyingClients,
  [requester],
  "전체 상태 응답은 요청한 기기 한 대에만 적용되어야 합니다."
);

assert.equal(
  shouldApplyStateSnapshot(
    response,
    requester,
    new Set(["different-request"])
  ),
  false,
  "만료되었거나 다른 요청의 응답은 적용되면 안 됩니다."
);

assert.equal(
  shouldApplyStateSnapshot(
    snapshotEvent({
      sourceClientId: requester,
    }),
    requester,
    new Set()
  ),
  false,
  "자신이 방송한 상태를 다시 적용하면 안 됩니다."
);

assert.equal(
  shouldApplyStateSnapshot(
    snapshotEvent(),
    requester,
    new Set()
  ),
  true,
  "일반 증분 상태 방송은 다른 기기에서 적용되어야 합니다."
);

const users = Array.from(
  { length: 30 },
  (_, index) => `user-${index + 1}`
);
const targetUser = "user-12";
const clearedUsers = users.filter(
  (userId) =>
    shouldClearSessionForForceLogout(
      targetUser,
      userId
    )
);

assert.deepEqual(
  clearedUsers,
  [targetUser],
  "개인 퇴장 신호는 대상 사용자만 로그아웃시켜야 합니다."
);

assert.equal(
  shouldClearSessionForForceLogout(
    undefined,
    targetUser
  ),
  true,
  "전체 종료 로그아웃 신호는 모든 사용자에게 적용되어야 합니다."
);

assert.equal(
  SNAPSHOT_REQUEST_RETRY_DELAYS.some(
    (delay) => delay > 2200
  ),
  true,
  "모든 운영진과 Master가 동시에 새로고침해도 권한 준비 이후 상태 요청을 다시 시도해야 합니다."
);

console.log(
  "live-event routing scenarios: PASS (7)"
);
