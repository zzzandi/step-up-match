import assert from "node:assert/strict";

import {
  createLiveStatePatch,
  mergeLiveStateSnapshot,
  type LiveStateSnapshot,
} from "../src/services/liveStateSync.ts";
import type {
  AccessRole,
} from "../src/auth/access.ts";
import type {
  Court,
} from "../src/types/court.ts";
import type {
  MatchHistory,
} from "../src/types/matchHistory.ts";
import type {
  Player,
} from "../src/types/player.ts";

function player(
  id: string,
  status: Player["status"] = "WAITING"
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
        "2026-07-09T10:00:00Z"
      ),
    matchCount: 0,
    consecutiveMatches: 0,
    status,
    waitingStartedAt:
      new Date(
        "2026-07-09T10:00:00Z"
      ),
    playingStartedAt:
      status === "PLAYING"
        ? new Date(
            "2026-07-09T10:10:00Z"
          )
        : undefined,
    lastPartners: [],
    lastOpponents: [],
  };
}

const players = Array.from(
  { length: 12 },
  (_, index) =>
    player(`p-${index + 1}`)
);

function emptyCourt(id: number): Court {
  return {
    id,
    status: "EMPTY",
    teamA: null,
    teamB: null,
    startedAt: null,
  };
}

function playingCourt(
  id: number,
  ids: [number, number, number, number],
  startedAt =
    "2026-07-09T10:10:00Z"
): Court {
  const courtPlayers = ids.map(
    (index) => ({
      ...players[index - 1],
      status:
        "PLAYING" as const,
      playingStartedAt:
        new Date(startedAt),
    })
  );

  return {
    id,
    status: "PLAYING",
    teamA: [
      courtPlayers[0],
      courtPlayers[1],
    ],
    teamB: [
      courtPlayers[2],
      courtPlayers[3],
    ],
    startedAt:
      new Date(startedAt),
  };
}

function queuedCourt(
  id: number,
  ids: [number, number, number, number],
  startedAt =
    "2026-07-09T10:12:00Z"
): Court {
  const courtPlayers = ids.map(
    (index) => players[index - 1]
  );

  return {
    id,
    status: "QUEUED",
    teamA: [
      courtPlayers[0],
      courtPlayers[1],
    ],
    teamB: [
      courtPlayers[2],
      courtPlayers[3],
    ],
    startedAt:
      new Date(startedAt),
  };
}

function snapshot(
  overrides: Partial<LiveStateSnapshot> =
    {}
): LiveStateSnapshot {
  return {
    players,
    courts: [
      emptyCourt(1),
      emptyCourt(2),
      emptyCourt(3),
    ],
    queuedCourts: [
      emptyCourt(1),
      emptyCourt(2),
    ],
    fixedPartnerRequests: [],
    fixedPartnerAssignments: [],
    fixedPartnerRequestResolutions:
      [],
    notifications: [],
    dismissedNotificationIds: [],
    matchHistory: [],
    workoutReportEvents: [],
    workoutReportSnapshots: [],
    womenDoublesPriority: false,
    excludedMatchPairs: [],
    ...overrides,
  };
}

function finishCourt(
  state: LiveStateSnapshot,
  courtId: number,
  endedAt =
    "2026-07-09T10:25:00Z"
): LiveStateSnapshot {
  const court = state.courts.find(
    (item) => item.id === courtId
  );

  assert.ok(
    court?.teamA && court.teamB,
    "finishCourt requires an active court"
  );

  const history: MatchHistory = {
    id: `history-${courtId}-${endedAt}`,
    courtId,
    teamA: court.teamA.map(
      (item) => item.id
    ),
    teamB: court.teamB.map(
      (item) => item.id
    ),
    startedAt:
      court.startedAt ??
      new Date(
        "2026-07-09T10:10:00Z"
      ),
    endedAt: new Date(endedAt),
  };

  return {
    ...state,
    courts: state.courts.map(
      (item) =>
        item.id === courtId
          ? emptyCourt(courtId)
          : item
    ),
    matchHistory: [
      ...state.matchHistory,
      history,
    ],
    players: state.players.map(
      (item) =>
        [
          ...court.teamA!,
          ...court.teamB!,
        ].some(
          (assigned) =>
            assigned.id === item.id
        )
          ? {
              ...item,
              status:
                "WAITING" as const,
              playingStartedAt:
                undefined,
              waitingStartedAt:
                new Date(endedAt),
              matchCount:
                item.matchCount + 1,
            }
          : item
    ),
  };
}

function serverAcceptsSnapshot(
  currentUpdatedAt: string | null,
  incomingUpdatedAt: string
) {
  return (
    !currentUpdatedAt ||
    new Date(currentUpdatedAt).getTime() <=
      new Date(
        incomingUpdatedAt
      ).getTime()
  );
}

function applyServerSnapshot(
  local: LiveStateSnapshot,
  server: LiveStateSnapshot,
  sourceRole: AccessRole
) {
  return mergeLiveStateSnapshot(
    local,
    server,
    sourceRole
  );
}

// TC-SYNC-001: Player misses realtime, then recovers current court from server snapshot.
{
  const managerState = snapshot({
    courts: [
      playingCourt(1, [
        1, 2, 3, 4,
      ]),
      emptyCourt(2),
      emptyCourt(3),
    ],
  });
  const playerLocal = snapshot({
    courts: [
      emptyCourt(1),
      emptyCourt(2),
      emptyCourt(3),
    ],
  });
  const recovered =
    applyServerSnapshot(
      playerLocal,
      managerState,
      "ADMIN"
    );

  assert.equal(
    recovered.courts[0].status,
    "PLAYING",
    "TC-SYNC-001 failed: missed realtime client must recover active game court from server snapshot."
  );
}

// TC-SYNC-002: Admin-only operation without Master restores to Guest.
{
  const adminState = snapshot({
    courts: [
      playingCourt(2, [
        5, 6, 7, 8,
      ]),
      emptyCourt(1),
      emptyCourt(3),
    ].sort((a, b) => a.id - b.id),
  });
  const guestLocal = snapshot({
    players: [
      ...players,
      {
        ...player("guest-1"),
        name: "게스트",
      },
    ],
    courts: [
      emptyCourt(1),
      emptyCourt(2),
      emptyCourt(3),
    ],
  });
  const recovered =
    applyServerSnapshot(
      guestLocal,
      adminState,
      "ADMIN"
    );

  assert.equal(
    recovered.courts.find(
      (court) => court.id === 2
    )?.status,
    "PLAYING",
    "TC-SYNC-002 failed: guest must recover admin-created match without Master online."
  );
}

// TC-SYNC-003: Older server save must not overwrite newer server state.
{
  assert.equal(
    serverAcceptsSnapshot(
      "2026-07-09T10:20:00.000Z",
      "2026-07-09T10:19:59.999Z"
    ),
    false,
    "TC-SYNC-003 failed: older delayed save must be rejected."
  );
  assert.equal(
    serverAcceptsSnapshot(
      "2026-07-09T10:20:00.000Z",
      "2026-07-09T10:20:00.001Z"
    ),
    true,
    "TC-SYNC-003 failed: newer save must be accepted."
  );
}

// TC-SYNC-004: Stale manager full snapshot cannot bring back a finished match.
{
  const playing = snapshot({
    courts: [
      playingCourt(1, [
        1, 2, 3, 4,
      ]),
      emptyCourt(2),
      emptyCourt(3),
    ],
  });
  const finished =
    finishCourt(playing, 1);
  const recovered =
    mergeLiveStateSnapshot(
      finished,
      playing,
      "ADMIN"
    );

  assert.equal(
    recovered.courts[0].status,
    "EMPTY",
    "TC-SYNC-004 failed: stale full snapshot must not revive a finished court."
  );
}

// TC-SYNC-005: Queued court promoted to game court must not remain duplicated in queued court after server recovery.
{
  const promoted = snapshot({
    courts: [
      playingCourt(1, [
        5, 6, 7, 8,
      ]),
      emptyCourt(2),
      emptyCourt(3),
    ],
    queuedCourts: [
      queuedCourt(1, [
        5, 6, 7, 8,
      ]),
      queuedCourt(2, [
        9, 10, 11, 12,
      ]),
    ],
  });
  const recovered =
    applyServerSnapshot(
      snapshot(),
      promoted,
      "MASTER"
    );

  assert.notEqual(
    recovered.queuedCourts[0]
      .teamA?.[0]?.id,
    "p-5",
    "TC-SYNC-005 failed: promoted queued match must not remain duplicated in queued courts."
  );
  assert.equal(
    recovered.queuedCourts[0]
      .teamA?.[0]?.id,
    "p-9",
    "TC-SYNC-005 failed: remaining queued match should compact to queued court 1."
  );
}

// TC-SYNC-006: Deleted queued court stays deleted/compacted for late client recovery.
{
  const managerState = snapshot({
    queuedCourts: [
      queuedCourt(1, [
        9, 10, 11, 12,
      ]),
      emptyCourt(2),
    ],
  });
  const lateClientState = snapshot({
    queuedCourts: [
      queuedCourt(1, [
        5, 6, 7, 8,
      ]),
      queuedCourt(2, [
        9, 10, 11, 12,
      ]),
    ],
  });
  const recovered =
    applyServerSnapshot(
      lateClientState,
      managerState,
      "ADMIN"
    );

  assert.equal(
    recovered.queuedCourts[0]
      .teamA?.[0]?.id,
    "p-9",
    "TC-SYNC-006 failed: deleted queued court must not reappear during late recovery."
  );
}

// TC-SYNC-007: Patch rebroadcast preserves court deletion semantics.
{
  const before = snapshot({
    courts: [
      playingCourt(1, [
        1, 2, 3, 4,
      ]),
      emptyCourt(2),
      emptyCourt(3),
    ],
  });
  const after =
    finishCourt(before, 1);
  const patch =
    createLiveStatePatch(
      before,
      after
    );
  const staleClient = before;
  const recovered =
    mergeLiveStateSnapshot(
      staleClient,
      after,
      "MASTER",
      undefined,
      patch
    );

  assert.equal(
    recovered.courts[0].status,
    "EMPTY",
    "TC-SYNC-007 failed: critical rebroadcast patch must preserve finished court."
  );
}

// TC-SYNC-008: Player/Guest local stale state must not remove manager-created courts.
{
  const managerState = snapshot({
    courts: [
      playingCourt(1, [
        1, 2, 3, 4,
      ]),
      playingCourt(2, [
        5, 6, 7, 8,
      ]),
      emptyCourt(3),
    ],
  });
  const stalePlayerState = snapshot({
    players: [player("late-player")],
    courts: [],
    queuedCourts: [],
  });
  const recovered =
    mergeLiveStateSnapshot(
      managerState,
      stalePlayerState,
      "PLAYER",
      "late-player"
    );

  assert.equal(
    recovered.courts.filter(
      (court) =>
        court.status === "PLAYING"
    ).length,
    2,
    "TC-SYNC-008 failed: stale player state must not remove manager-created courts."
  );
}

console.log(
  "sync SQA scenarios: PASS (8)"
);

