import assert from "node:assert/strict";
import {
  createServer,
} from "vite";

const memoryStorage =
  new Map();

globalThis.window = {
  localStorage: {
    getItem(key) {
      return (
        memoryStorage.get(key) ??
        null
      );
    },
    setItem(key, value) {
      memoryStorage.set(
        key,
        value
      );
    },
    removeItem(key) {
      memoryStorage.delete(key);
    },
  },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  alert() {},
};
globalThis.alert = () => {};

const server =
  await createServer({
    server: {
      middlewareMode: true,
    },
    appType: "custom",
  });

try {
  const {
    useMatchStore,
  } = await server.ssrLoadModule(
    "/src/store/useMatchStore.ts"
  );
  const {
    createLiveStatePatch,
    createLiveStateSnapshot,
    getSnapshotResponseDelay,
    mergeLiveStateSnapshot,
  } = await server.ssrLoadModule(
    "/src/services/liveStateSync.ts"
  );
  const {
    isPendingQueueValid,
    sortWaitingPlayersByQueue,
  } = await server.ssrLoadModule(
    "/src/utils/preWorkoutQueue.ts"
  );
  const {
    isCompatibleGenderMatch,
  } = await server.ssrLoadModule(
    "/src/engine/v2/genderRules.ts"
  );
  const {
    isActiveAttendance,
    selectCanonicalAttendance,
    shouldActivateAttendance,
  } = await server.ssrLoadModule(
    "/src/utils/attendanceState.ts"
  );
  const {
    createDefaultCourts,
    mergeAttendancePlayers,
  } = await server.ssrLoadModule(
    "/src/services/dashboardRecoveryService.ts"
  );
  const {
    getRestMinutes,
  } = await server.ssrLoadModule(
    "/src/utils/time.ts"
  );

  const results = [];
  const run = (
    scenario,
    test
  ) => {
    const startedAt =
      performance.now();

    test();
    results.push({
      scenario,
      duration:
        performance.now() -
        startedAt,
    });
  };

  function makePlayer(
    index,
    waitingOffsetMs = index
  ) {
    const waitingStartedAt =
      new Date(
        Date.parse(
          "2026-06-22T10:00:00.000Z"
        ) +
          waitingOffsetMs
      );

    return {
      id: `player-${String(
        index + 1
      ).padStart(2, "0")}`,
      name: `선수${String(
        index + 1
      ).padStart(2, "0")}`,
      gender:
        index % 3 === 0
          ? "F"
          : "M",
      grade: [
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
      ][index % 6],
      hiddenSkill:
        85 -
        (index % 6) * 10,
      isPresent: true,
      arrivalTime:
        waitingStartedAt,
      matchCount: 0,
      consecutiveMatches: 0,
      status: "WAITING",
      waitingStartedAt,
      lastPartners: [],
      lastOpponents: [],
    };
  }

  function resetStore(
    playerCount = 30,
    courtCount = 3
  ) {
    useMatchStore.setState({
      players: Array.from(
        {
          length: playerCount,
        },
        (_, index) =>
          makePlayer(index)
      ),
      courts: Array.from(
        {
          length: courtCount,
        },
        (_, index) => ({
          id: index + 1,
          status: "EMPTY",
          teamA: null,
          teamB: null,
          startedAt: null,
        })
      ),
      fixedPartnerRequests: [],
      fixedPartnerAssignments: [],
      fixedPartnerRequestResolutions:
        [],
      queuedCourts: [],
      dismissedNotificationIds: [],
      notifications: [],
      matchHistory: [],
      recommendations: [],
      selectedRecommendation:
        null,
      womenDoublesPriority:
        false,
      excludedMatchPairs: [],
    });
  }

  run(
    "30명이 역할과 무관하게 등록 시각순으로 대기",
    () => {
      const players =
        Array.from(
          {
            length: 30,
          },
          (_, index) =>
            makePlayer(
              index,
              29 - index
            )
        );
      const sorted =
        sortWaitingPlayersByQueue(
          players
        );

      assert.equal(
        sorted[0].id,
        "player-30"
      );
      assert.equal(
        sorted.at(-1).id,
        "player-01"
      );
      assert.equal(
        new Set(
          sorted.map(
            (player) =>
              player.id
          )
        ).size,
        30
      );
    }
  );

  run(
    "동시 로그인으로 동일 출석이 여러 건 생겨도 활성 출석 한 건을 기준으로 정리",
    () => {
      const rows =
        Array.from(
          {
            length: 30,
          },
          (_, index) => ({
            id: `attendance-${String(
              index + 1
            ).padStart(2, "0")}`,
            status:
              index === 17
                ? "WAITING"
                : "PENDING",
            arrival_time:
              new Date(
                Date.parse(
                  "2026-06-22T10:00:00Z"
                ) + index
              ).toISOString(),
          })
        );
      const canonical =
        selectCanonicalAttendance(
          rows
        );

      assert.equal(
        canonical.id,
        "attendance-18"
      );
      assert.equal(
        canonical.status,
        "WAITING"
      );
    }
  );

  run(
    "운동 개설 30분 전 이후 등록만 유효하고 31분 전 등록은 제외",
    () => {
      const openedAt =
        "2026-06-22T11:00:00Z";

      assert.equal(
        isPendingQueueValid(
          "2026-06-22T10:30:00Z",
          openedAt
        ),
        true
      );
      assert.equal(
        isPendingQueueValid(
          "2026-06-22T10:31:00Z",
          openedAt
        ),
        true
      );
      assert.equal(
        isPendingQueueValid(
          "2026-06-22T10:29:00Z",
          openedAt
        ),
        false
      );
    }
  );

  run(
    "개인 운동 종료자는 활성 명단에서 제외되고 재참가 시 다시 활성화 대상",
    () => {
      assert.equal(
        isActiveAttendance({
          status: "LEFT",
        }),
        false
      );
      assert.equal(
        shouldActivateAttendance({
          status: "LEFT",
        }),
        true
      );
      assert.equal(
        shouldActivateAttendance({
          status: "WAITING",
        }),
        false
      );
    }
  );

  run(
    "30명의 동시 상태 방송이 코트·설정을 삭제하지 않음",
    () => {
      resetStore();
      const state =
        useMatchStore.getState();
      state.setFixedPartner(
        "player-01",
        "player-02"
      );
      state.addExcludedMatchPair(
        "player-03",
        "player-04"
      );
      let live =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );

      for (
        let index = 0;
        index < 30;
        index += 1
      ) {
        const source =
          makePlayer(index);
        const stale = {
          ...live,
          players: [source],
          courts: [],
          fixedPartnerRequests: [],
          recommendations: [],
          excludedMatchPairs: [],
        };

        live =
          mergeLiveStateSnapshot(
            live,
            stale,
            "PLAYER",
            source.id
          );
      }

      assert.equal(
        live.courts.length,
        3
      );
      assert.equal(
        live.excludedMatchPairs
          .length,
        1
      );
      assert.equal(
        live.players.find(
          (player) =>
            player.id ===
            "player-01"
        ).fixedPartner,
        "player-02"
      );
    }
  );

  run(
    "신규 접속자의 전체 상태 요청에는 마스터가 운영진보다 먼저 응답",
    () => {
      const masterDelays =
        Array.from(
          {
            length: 30,
          },
          (_, index) =>
            getSnapshotResponseDelay(
              "MASTER",
              `master-${index}`
            )
        );
      const adminDelays =
        Array.from(
          {
            length: 30,
          },
          (_, index) =>
            getSnapshotResponseDelay(
              "ADMIN",
              `admin-${index}`
            )
        );

      assert.ok(
        Math.max(
          ...masterDelays
        ) <
          Math.min(
            ...adminDelays
          )
      );
    }
  );

  run(
    "운영진 두 명이 서로 다른 코트를 동시에 수정해도 둘 다 보존",
    () => {
      resetStore(30, 3);
      const base =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const adminA = {
        ...base,
        courts: [
          {
            ...base.courts[0],
            status: "PLAYING",
            teamA: [
              base.players[0],
              base.players[1],
            ],
            teamB: [
              base.players[2],
              base.players[3],
            ],
            startedAt:
              new Date(),
          },
          base.courts[1],
          base.courts[2],
        ],
      };
      const adminB = {
        ...base,
        courts: [
          base.courts[0],
          {
            ...base.courts[1],
            status: "PLAYING",
            teamA: [
              base.players[4],
              base.players[5],
            ],
            teamB: [
              base.players[6],
              base.players[7],
            ],
            startedAt:
              new Date(),
          },
          base.courts[2],
        ],
      };
      const patchA =
        createLiveStatePatch(
          base,
          adminA
        );
      const patchB =
        createLiveStatePatch(
          base,
          adminB
        );
      const afterA =
        mergeLiveStateSnapshot(
          base,
          adminA,
          "ADMIN",
          "admin-a",
          patchA
        );
      const afterBoth =
        mergeLiveStateSnapshot(
          afterA,
          adminB,
          "MASTER",
          "master-b",
          patchB
        );

      assert.equal(
        afterBoth.courts[0]
          .status,
        "PLAYING"
      );
      assert.equal(
        afterBoth.courts[1]
          .status,
        "PLAYING"
      );
    }
  );

  run(
    "같은 코트에 서로 다른 대진을 동시에 승인해도 코트 밖 선수는 경기 중으로 남지 않음",
    () => {
      resetStore(12, 1);
      const base =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const assignment = (
        selectedPlayers
      ) => {
        const selectedIds =
          new Set(
            selectedPlayers.map(
              (player) =>
                player.id
            )
          );

        return {
          ...base,
          players:
            base.players.map(
              (player) =>
                selectedIds.has(
                  player.id
                )
                  ? {
                      ...player,
                      status:
                        "PLAYING",
                      waitingStartedAt:
                        undefined,
                      playingStartedAt:
                        new Date(),
                    }
                  : player
            ),
          courts: [
            {
              id: 1,
              status: "PLAYING",
              teamA: [
                selectedPlayers[0],
                selectedPlayers[1],
              ],
              teamB: [
                selectedPlayers[2],
                selectedPlayers[3],
              ],
              startedAt:
                new Date(),
            },
          ],
        };
      };
      const adminA =
        assignment(
          base.players.slice(0, 4)
        );
      const adminB =
        assignment(
          base.players.slice(4, 8)
        );
      let merged =
        mergeLiveStateSnapshot(
          base,
          adminA,
          "ADMIN",
          "admin-a",
          createLiveStatePatch(
            base,
            adminA
          )
        );
      merged =
        mergeLiveStateSnapshot(
          merged,
          adminB,
          "MASTER",
          "master-b",
          createLiveStatePatch(
            base,
            adminB
          )
        );
      const courtPlayerIds =
        new Set(
          [
            ...merged.courts[0]
              .teamA,
            ...merged.courts[0]
              .teamB,
          ].map(
            (player) =>
              player.id
          )
        );
      const playingIds =
        merged.players
          .filter(
            (player) =>
              player.status ===
              "PLAYING"
          )
          .map(
            (player) =>
              player.id
          );

      assert.equal(
        playingIds.length,
        4
      );
      assert.ok(
        playingIds.every(
          (id) =>
            courtPlayerIds.has(id)
        )
      );
    }
  );

  run(
    "코트 추가와 다른 코트 경기 배정이 동시에 발생해도 신규 코트 보존",
    () => {
      resetStore(30, 3);
      const base =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const withCourt = {
        ...base,
        courts: [
          ...base.courts,
          {
            id: 4,
            status: "EMPTY",
            teamA: null,
            teamB: null,
            startedAt: null,
          },
        ],
      };
      const withMatch = {
        ...base,
        courts:
          base.courts.map(
            (court) =>
              court.id === 1
                ? {
                    ...court,
                    status:
                      "PLAYING",
                    teamA: [
                      base.players[0],
                      base.players[1],
                    ],
                    teamB: [
                      base.players[2],
                      base.players[3],
                    ],
                    startedAt:
                      new Date(),
                  }
                : court
          ),
      };
      let merged =
        mergeLiveStateSnapshot(
          base,
          withCourt,
          "ADMIN",
          "admin-a",
          createLiveStatePatch(
            base,
            withCourt
          )
        );
      merged =
        mergeLiveStateSnapshot(
          merged,
          withMatch,
          "MASTER",
          "master-b",
          createLiveStatePatch(
            base,
            withMatch
          )
        );

      assert.equal(
        merged.courts.length,
        4
      );
      assert.equal(
        merged.courts.find(
          (court) =>
            court.id === 1
        ).status,
        "PLAYING"
      );
    }
  );

  run(
    "운영진 두 명이 서로 다른 매칭 제외 쌍을 동시에 추가해도 둘 다 보존",
    () => {
      resetStore();
      const base =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const adminA = {
        ...base,
        excludedMatchPairs: [
          [
            "player-01",
            "player-02",
          ],
        ],
      };
      const adminB = {
        ...base,
        excludedMatchPairs: [
          [
            "player-03",
            "player-04",
          ],
        ],
      };
      let merged =
        mergeLiveStateSnapshot(
          base,
          adminA,
          "ADMIN",
          "admin-a",
          createLiveStatePatch(
            base,
            adminA
          )
        );
      merged =
        mergeLiveStateSnapshot(
          merged,
          adminB,
          "MASTER",
          "master-b",
          createLiveStatePatch(
            base,
            adminB
          )
        );

      assert.deepEqual(
        merged.excludedMatchPairs
          .map((pair) =>
            [...pair]
              .sort()
              .join("|")
          )
          .sort(),
        [
          "player-01|player-02",
          "player-03|player-04",
        ]
      );
    }
  );

  run(
    "운영진 4명과 마스터 1명의 자동 대진 검토 화면은 각 기기에만 유지",
    () => {
      resetStore(30, 4);
      const before =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );

      for (
        let managerIndex = 0;
        managerIndex < 5;
        managerIndex += 1
      ) {
        useMatchStore
          .getState()
          .rerollRecommendations(
            (managerIndex % 4) +
              1
          );
        const after =
          createLiveStateSnapshot(
            useMatchStore.getState()
          );
        const patch =
          createLiveStatePatch(
            before,
            after
          );

        assert.deepEqual(
          patch.changedKeys,
          []
        );
      }
    }
  );

  run(
    "운영진 4명·마스터 1명·플레이어 25명의 동시 변경 후에도 4개 코트와 설정 유지",
    () => {
      resetStore(30, 4);
      const base =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const managerSnapshots =
        Array.from(
          {
            length: 4,
          },
          (_, courtIndex) => {
            const selected =
              base.players.slice(
                courtIndex * 4,
                courtIndex * 4 + 4
              );
            const selectedIds =
              new Set(
                selected.map(
                  (player) =>
                    player.id
                )
              );

            return {
              ...base,
              players:
                base.players.map(
                  (player) =>
                    selectedIds.has(
                      player.id
                    )
                      ? {
                          ...player,
                          status:
                            "PLAYING",
                          waitingStartedAt:
                            undefined,
                          playingStartedAt:
                            new Date(
                              `2026-06-22T11:0${courtIndex}:00.000Z`
                            ),
                        }
                      : player
                ),
              courts:
                base.courts.map(
                  (court) =>
                    court.id ===
                    courtIndex + 1
                      ? {
                          ...court,
                          status:
                            "PLAYING",
                          teamA: [
                            selected[0],
                            selected[1],
                          ],
                          teamB: [
                            selected[2],
                            selected[3],
                          ],
                          startedAt:
                            new Date(
                              `2026-06-22T11:0${courtIndex}:00.000Z`
                            ),
                        }
                      : court
                ),
            };
          }
        );
      const masterSnapshot = {
        ...base,
        womenDoublesPriority:
          true,
      };
      let merged = base;

      managerSnapshots.forEach(
        (managerSnapshot, index) => {
          merged =
            mergeLiveStateSnapshot(
              merged,
              managerSnapshot,
              "ADMIN",
              `admin-${index + 1}`,
              createLiveStatePatch(
                base,
                managerSnapshot
              )
            );
        }
      );
      merged =
        mergeLiveStateSnapshot(
          merged,
          masterSnapshot,
          "MASTER",
          "master",
          createLiveStatePatch(
            base,
            masterSnapshot
          )
        );

      for (
        let index = 0;
        index < 25;
        index += 1
      ) {
        merged =
          mergeLiveStateSnapshot(
            merged,
            {
              ...base,
              players: [
                makePlayer(index),
              ],
              courts: [],
            },
            "PLAYER",
            makePlayer(index).id
          );
      }

      const assignedIds =
        merged.courts.flatMap(
          (court) => [
            ...court.teamA,
            ...court.teamB,
          ].map(
            (player) => player.id
          )
        );

      assert.equal(
        merged.courts.filter(
          (court) =>
            court.status ===
            "PLAYING"
        ).length,
        4
      );
      assert.equal(
        assignedIds.length,
        16
      );
      assert.equal(
        new Set(assignedIds).size,
        16
      );
      assert.equal(
        merged.womenDoublesPriority,
        true
      );
    }
  );

  run(
    "수동 대진은 대기자 4명을 지정한 팀 구성으로 경기 시작",
    () => {
      resetStore(12, 2);
      const assigned =
        useMatchStore
          .getState()
          .assignManualMatch(
            1,
            [
              "player-01",
              "player-02",
            ],
            [
              "player-03",
              "player-04",
            ]
          );
      const next =
        useMatchStore.getState();

      assert.equal(
        assigned,
        true
      );
      assert.deepEqual(
        next.courts[0].teamA.map(
          (player) => player.id
        ),
        [
          "player-01",
          "player-02",
        ]
      );
      assert.deepEqual(
        next.courts[0].teamB.map(
          (player) => player.id
        ),
        [
          "player-03",
          "player-04",
        ]
      );
      assert.equal(
        next.players.filter(
          (player) =>
            player.status ===
            "PLAYING"
        ).length,
        4
      );
    }
  );

  run(
    "수동 대진에서 같은 선수를 두 자리에 중복 선택하면 거부",
    () => {
      resetStore(12, 2);
      const assigned =
        useMatchStore
          .getState()
          .assignManualMatch(
            1,
            [
              "player-01",
              "player-01",
            ],
            [
              "player-03",
              "player-04",
            ]
          );

      assert.equal(
        assigned,
        false
      );
      assert.equal(
        useMatchStore.getState()
          .courts[0].status,
        "EMPTY"
      );
    }
  );

  run(
    "경기 중 코트 안 선수 두 명을 교환하면 팀 구성만 변경",
    () => {
      resetStore(12, 2);
      const state =
        useMatchStore.getState();
      state.assignManualMatch(
        1,
        [
          "player-01",
          "player-02",
        ],
        [
          "player-03",
          "player-04",
        ]
      );
      const swapped =
        useMatchStore
          .getState()
          .swapCourtPlayers(
            1,
            "player-02",
            "player-03"
          );
      const next =
        useMatchStore.getState();

      assert.equal(
        swapped,
        true
      );
      assert.deepEqual(
        next.courts[0].teamA.map(
          (player) => player.id
        ),
        [
          "player-01",
          "player-03",
        ]
      );
      assert.deepEqual(
        next.courts[0].teamB.map(
          (player) => player.id
        ),
        [
          "player-02",
          "player-04",
        ]
      );
      assert.equal(
        next.players.filter(
          (player) =>
            player.status ===
            "PLAYING"
        ).length,
        4
      );
    }
  );

  run(
    "queued court manual match keeps players waiting until promoted",
    () => {
      resetStore(12, 1);
      const state =
        useMatchStore.getState();
      state.addQueuedCourt();
      const assigned =
        useMatchStore
          .getState()
          .assignManualMatch(
            1,
            [
              "player-05",
              "player-06",
            ],
            [
              "player-07",
              "player-08",
            ],
            "QUEUE"
          );
      const next =
        useMatchStore.getState();

      assert.equal(assigned, true);
      assert.equal(next.queuedCourts[0].status, "QUEUED");
      assert.deepEqual(
        next.queuedCourts[0].teamA.map((player) => player.id),
        ["player-05", "player-06"]
      );
      assert.equal(
        next.players.filter((player) => player.status === "PLAYING").length,
        0
      );
    }
  );

  run(
    "queued court auto match is promoted when a game court finishes",
    () => {
      resetStore(16, 1);
      useMatchStore
        .getState()
        .assignManualMatch(
          1,
          ["player-01", "player-02"],
          ["player-03", "player-04"]
        );
      useMatchStore.getState().addQueuedCourt();
      useMatchStore
        .getState()
        .rerollRecommendations(1, "QUEUE");
      useMatchStore
        .getState()
        .approveRecommendation("QUEUE");
      const queuedBefore =
        useMatchStore.getState().queuedCourts[0];
      const queuedIds = [
        ...queuedBefore.teamA,
        ...queuedBefore.teamB,
      ].map((player) => player.id);

      useMatchStore.getState().finishCourtMatch(1);
      const next = useMatchStore.getState();

      assert.equal(next.queuedCourts.length, 0);
      assert.equal(next.courts[0].status, "PLAYING");
      assert.deepEqual(
        [
          ...next.courts[0].teamA,
          ...next.courts[0].teamB,
        ].map((player) => player.id),
        queuedIds
      );
      assert.ok(
        queuedIds.every((id) =>
          next.players.some(
            (player) => player.id === id && player.status === "PLAYING"
          )
        )
      );
      assert.equal(next.matchHistory.length, 1);
    }
  );

  run(
    "두 운영자가 같은 선수를 서로 다른 코트에 동시에 수동 배정해도 한 코트만 유지",
    () => {
      resetStore(12, 2);
      const base =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const startedAt =
        new Date(
          "2026-06-22T11:00:00.000Z"
        );
      const makeAssignment = (
        courtId,
        ids,
        offsetMs
      ) => ({
        ...base,
        players:
          base.players.map(
            (player) =>
              ids.includes(
                player.id
              )
                ? {
                    ...player,
                    status:
                      "PLAYING",
                    playingStartedAt:
                      new Date(
                        startedAt.getTime() +
                          offsetMs
                      ),
                    waitingStartedAt:
                      undefined,
                  }
                : player
          ),
        courts:
          base.courts.map(
            (court) =>
              court.id === courtId
                ? {
                    ...court,
                    status:
                      "PLAYING",
                    teamA: [
                      base.players.find(
                        (player) =>
                          player.id ===
                          ids[0]
                      ),
                      base.players.find(
                        (player) =>
                          player.id ===
                          ids[1]
                      ),
                    ],
                    teamB: [
                      base.players.find(
                        (player) =>
                          player.id ===
                          ids[2]
                      ),
                      base.players.find(
                        (player) =>
                          player.id ===
                          ids[3]
                      ),
                    ],
                    startedAt:
                      new Date(
                        startedAt.getTime() +
                          offsetMs
                      ),
                  }
                : court
          ),
      });
      const adminA =
        makeAssignment(
          1,
          [
            "player-01",
            "player-02",
            "player-03",
            "player-04",
          ],
          0
        );
      const adminB =
        makeAssignment(
          2,
          [
            "player-01",
            "player-05",
            "player-06",
            "player-07",
          ],
          50
        );
      let merged =
        mergeLiveStateSnapshot(
          base,
          adminA,
          "ADMIN",
          "admin-a",
          createLiveStatePatch(
            base,
            adminA
          )
        );
      merged =
        mergeLiveStateSnapshot(
          merged,
          adminB,
          "MASTER",
          "master",
          createLiveStatePatch(
            base,
            adminB
          )
        );
      const playingCourts =
        merged.courts.filter(
          (court) =>
            court.status ===
            "PLAYING"
        );
      const playingIds =
        playingCourts.flatMap(
          (court) => [
            ...court.teamA,
            ...court.teamB,
          ].map(
            (player) => player.id
          )
        );

      assert.equal(
        playingCourts.length,
        1
      );
      assert.equal(
        playingCourts[0].id,
        1
      );
      assert.equal(
        playingIds.length,
        new Set(playingIds).size
      );
    }
  );

  run(
    "30명으로 3개 코트 대진 생성 시 선수 중복 배정 없음",
    () => {
      resetStore();
      const state =
        useMatchStore.getState();
      state.addExcludedMatchPair(
        "player-01",
        "player-02"
      );

      for (
        let courtId = 1;
        courtId <= 3;
        courtId += 1
      ) {
        state.rerollRecommendations(
          courtId
        );
        assert.ok(
          useMatchStore.getState()
            .selectedRecommendation
        );
        useMatchStore
          .getState()
          .approveRecommendation();
      }

      const next =
        useMatchStore.getState();
      const playing =
        next.players.filter(
          (player) =>
            player.status ===
            "PLAYING"
        );

      assert.equal(
        playing.length,
        12
      );
      assert.equal(
        new Set(
          playing.map(
            (player) =>
              player.id
          )
        ).size,
        12
      );

      next.courts.forEach(
        (court) => {
          assert.equal(
            court.status,
            "PLAYING"
          );
          assert.ok(
            isCompatibleGenderMatch(
              court.teamA,
              court.teamB
            )
          );
          const ids = [
            ...court.teamA,
            ...court.teamB,
          ].map(
            (player) =>
              player.id
          );
          assert.ok(
            !(
              ids.includes(
                "player-01"
              ) &&
              ids.includes(
                "player-02"
              )
            )
          );
        }
      );
    }
  );

  run(
    "경기 종료 후 12명이 대기열로 복귀하고 기록 3건 생성",
    () => {
      const state =
        useMatchStore.getState();

      [1, 2, 3].forEach(
        (courtId) =>
          state.finishCourtMatch(
            courtId
          )
      );

      const next =
        useMatchStore.getState();
      assert.equal(
        next.players.filter(
          (player) =>
            player.status ===
            "WAITING"
        ).length,
        30
      );
      assert.equal(
        next.matchHistory.length,
        3
      );
      assert.ok(
        next.matchHistory.every(
          (history) =>
            Object.keys(
              history.playerNames
            ).length === 4
        )
      );
    }
  );

  run(
    "3개 경기 점수 입력이 각각 독립적으로 저장",
    () => {
      const state =
        useMatchStore.getState();
      state.matchHistory.forEach(
        (history, index) => {
          state.updateMatchScore(
            history.id,
            25,
            18 + index
          );
        }
      );
      const scores =
        useMatchStore
          .getState()
          .matchHistory.map(
            (history) => [
              history.teamAScore,
              history.teamBScore,
            ]
          );

      assert.deepEqual(
        scores,
        [
          [25, 18],
          [25, 19],
          [25, 20],
        ]
      );
    }
  );

  run(
    "운영진 두 명이 서로 다른 경기 점수를 동시에 저장해도 둘 다 보존",
    () => {
      const base =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const historyA =
        base.matchHistory[0];
      const historyB =
        base.matchHistory[1];
      const adminA = {
        ...base,
        matchHistory:
          base.matchHistory.map(
            (history) =>
              history.id ===
              historyA.id
                ? {
                    ...history,
                    teamAScore: 25,
                    teamBScore: 17,
                  }
                : history
          ),
      };
      const adminB = {
        ...base,
        matchHistory:
          base.matchHistory.map(
            (history) =>
              history.id ===
              historyB.id
                ? {
                    ...history,
                    teamAScore: 23,
                    teamBScore: 25,
                  }
                : history
          ),
      };
      let merged =
        mergeLiveStateSnapshot(
          base,
          adminA,
          "ADMIN",
          "admin-a",
          createLiveStatePatch(
            base,
            adminA
          )
        );
      merged =
        mergeLiveStateSnapshot(
          merged,
          adminB,
          "MASTER",
          "master-b",
          createLiveStatePatch(
            base,
            adminB
          )
        );

      assert.deepEqual(
        merged.matchHistory
          .slice(0, 2)
          .map((history) => [
            history.teamAScore,
            history.teamBScore,
          ]),
        [
          [25, 17],
          [23, 25],
        ]
      );
    }
  );

  run(
    "같은 경기 종료를 운영진 두 명이 동시에 눌러도 기록은 한 건만 생성",
    () => {
      resetStore(8, 1);
      const waitingBase =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const startedAt =
        new Date(
          "2026-06-22T11:00:00Z"
        );
      const playingBase = {
        ...waitingBase,
        players:
          waitingBase.players.map(
            (player, index) =>
              index < 4
                ? {
                    ...player,
                    status:
                      "PLAYING",
                    waitingStartedAt:
                      undefined,
                    playingStartedAt:
                      startedAt,
                  }
                : player
          ),
        courts: [
          {
            id: 1,
            status: "PLAYING",
            teamA: [
              waitingBase.players[0],
              waitingBase.players[1],
            ],
            teamB: [
              waitingBase.players[2],
              waitingBase.players[3],
            ],
            startedAt,
          },
        ],
      };
      const finished = (
        historyId
      ) => ({
        ...playingBase,
        players:
          playingBase.players.map(
            (player) => ({
              ...player,
              status:
                "WAITING",
              playingStartedAt:
                undefined,
              waitingStartedAt:
                new Date(),
            })
          ),
        courts: [
          {
            id: 1,
            status: "EMPTY",
            teamA: null,
            teamB: null,
            startedAt: null,
          },
        ],
        matchHistory: [
          {
            id: historyId,
            courtId: 1,
            teamA: [
              waitingBase.players[0]
                .id,
              waitingBase.players[1]
                .id,
            ],
            teamB: [
              waitingBase.players[2]
                .id,
              waitingBase.players[3]
                .id,
            ],
            startedAt,
            endedAt:
              new Date(),
          },
        ],
      });
      const adminA =
        finished("history-a");
      const adminB =
        finished("history-b");
      let merged =
        mergeLiveStateSnapshot(
          playingBase,
          adminA,
          "ADMIN",
          "admin-a",
          createLiveStatePatch(
            playingBase,
            adminA
          )
        );
      merged =
        mergeLiveStateSnapshot(
          merged,
          adminB,
          "MASTER",
          "master-b",
          createLiveStatePatch(
            playingBase,
            adminB
          )
        );

      assert.equal(
        merged.matchHistory.length,
        1
      );
      assert.equal(
        merged.players.filter(
          (player) =>
            player.status ===
            "PLAYING"
        ).length,
        0
      );
    }
  );

  run(
    "경기 중 선수 교체 시 입장·퇴장 상태와 코트 명단 일치",
    () => {
      const state =
        useMatchStore.getState();
      state.rerollRecommendations(
        1
      );
      state.approveRecommendation();
      const before =
        useMatchStore.getState();
      const outgoing =
        before.courts[0]
          .teamA[0];
      const incoming =
        before.players.find(
          (player) =>
            player.status ===
            "WAITING"
        );

      state.replaceCourtPlayer(
        1,
        outgoing.id,
        incoming.id
      );
      const after =
        useMatchStore.getState();
      const courtIds = [
        ...after.courts[0]
          .teamA,
        ...after.courts[0]
          .teamB,
      ].map(
        (player) => player.id
      );

      assert.ok(
        courtIds.includes(
          incoming.id
        )
      );
      assert.ok(
        !courtIds.includes(
          outgoing.id
        )
      );
      assert.equal(
        after.players.find(
          (player) =>
            player.id ===
            incoming.id
        ).status,
        "PLAYING"
      );
      assert.equal(
        after.players.find(
          (player) =>
            player.id ===
            outgoing.id
        ).status,
        "WAITING"
      );
    }
  );

  run(
    "고정 파트너 신청 승인 후 양방향 연결",
    () => {
      resetStore();
      const state =
        useMatchStore.getState();
      state.requestFixedPartner(
        "player-01",
        "player-02"
      );
      const request =
        useMatchStore.getState()
          .fixedPartnerRequests[0];

      assert.ok(request);
      state.approveFixedPartnerRequest(
        request.id
      );
      const next =
        useMatchStore.getState();
      assert.equal(
        next.players[0]
          .fixedPartner,
        "player-02"
      );
      assert.equal(
        next.players[1]
          .fixedPartner,
        "player-01"
      );
      assert.equal(
        next.fixedPartnerRequests
          .length,
        0
      );
    }
  );

  run(
    "아직 로그인하지 않은 회원에게 고정 파트너 신청 후 승인 가능",
    () => {
      resetStore(8, 1);
      const state =
        useMatchStore.getState();
      state.requestFixedPartner(
        "player-01",
        "member-not-logged-in",
        "선수01",
        "미로그인회원"
      );
      const request =
        useMatchStore.getState()
          .fixedPartnerRequests[0];

      assert.ok(request);
      useMatchStore
        .getState()
        .approveFixedPartnerRequest(
          request.id
        );
      let next =
        useMatchStore.getState();

      assert.equal(
        next.fixedPartnerAssignments
          .length,
        1
      );
      assert.equal(
        next.players[0]
          .fixedPartner,
        "member-not-logged-in"
      );

      const lateMember = {
        ...makePlayer(20),
        id: "member-not-logged-in",
        name: "미로그인회원",
      };
      next.setPlayers([
        ...next.players,
        lateMember,
      ]);
      next =
        useMatchStore.getState();

      assert.equal(
        next.players.find(
          (player) =>
            player.id ===
            "member-not-logged-in"
        ).fixedPartner,
        "player-01"
      );
    }
  );

  run(
    "미로그인 고정 파트너는 승인돼도 대기열과 자동 대진 후보에 나타나지 않음",
    () => {
      resetStore(8, 1);
      const state =
        useMatchStore.getState();
      state.requestFixedPartner(
        "player-01",
        "member-not-logged-in",
        "선수01",
        "미로그인회원"
      );
      const request =
        useMatchStore.getState()
          .fixedPartnerRequests[0];
      state.approveFixedPartnerRequest(
        request.id
      );
      state.rerollRecommendations(
        1
      );
      const next =
        useMatchStore.getState();
      const recommendedIds =
        next.recommendations.flatMap(
          (recommendation) => [
            ...recommendation.teamA,
            ...recommendation.teamB,
          ].map(
            (player) => player.id
          )
        );

      assert.equal(
        next.players.some(
          (player) =>
            player.id ===
            "member-not-logged-in"
        ),
        false
      );
      assert.equal(
        recommendedIds.includes(
          "member-not-logged-in"
        ),
        false
      );
    }
  );

  run(
    "선발된 고정 파트너 두 명은 자동 대진에서 같은 팀 우선",
    () => {
      resetStore(4, 1);
      const state =
        useMatchStore.getState();
      state.setPlayers(
        state.players.map(
          (player) => ({
            ...player,
            gender: "M",
            hiddenSkill: 50,
          })
        )
      );
      state.setFixedPartner(
        "player-01",
        "player-02"
      );
      state.rerollRecommendations(
        1
      );
      const recommendation =
        useMatchStore.getState()
          .selectedRecommendation;

      assert.ok(recommendation);
      const sameTeam =
        recommendation.teamA
          .map(
            (player) => player.id
          )
          .includes(
            "player-01"
          ) &&
        recommendation.teamA
          .map(
            (player) => player.id
          )
          .includes(
            "player-02"
          ) ||
        recommendation.teamB
          .map(
            (player) => player.id
          )
          .includes(
            "player-01"
          ) &&
        recommendation.teamB
          .map(
            (player) => player.id
          )
          .includes(
            "player-02"
          );

      assert.equal(
        sameTeam,
        true
      );
    }
  );

  run(
    "고정 파트너가 있어도 휴식시간이 긴 인원을 우선 선발",
    () => {
      resetStore(6, 1);
      const now = Date.now();
      const state =
        useMatchStore.getState();

      state.setPlayers(
        state.players.map(
          (player, index) => ({
            ...player,
            gender: "M",
            hiddenSkill: 50,
            waitingStartedAt:
              new Date(
                now -
                  (index < 2
                    ? 1 * 60 * 1000
                    : 60 * 60 * 1000)
              ),
            arrivalTime:
              new Date(
                now -
                  (index < 2
                    ? 1 * 60 * 1000
                    : 60 * 60 * 1000)
              ),
          })
        )
      );
      useMatchStore
        .getState()
        .setFixedPartner(
          "player-01",
          "player-02"
        );
      useMatchStore
        .getState()
        .rerollRecommendations(1);

      const recommendation =
        useMatchStore.getState()
          .selectedRecommendation;
      assert.ok(recommendation);
      const selectedIds = [
        ...recommendation.teamA,
        ...recommendation.teamB,
      ].map((player) => player.id);

      assert.deepEqual(
        selectedIds.sort(),
        [
          "player-03",
          "player-04",
          "player-05",
          "player-06",
        ],
        "고정 파트너 보너스가 휴식시간 우선순위를 앞지르면 안 됩니다."
      );
    }
  );

  run(
    "게스트 고정 파트너 승인 후에도 자동 대진 생성 가능",
    () => {
      resetStore(8, 1);
      const state =
        useMatchStore.getState();
      const guest = {
        ...state.players[7],
        id: "guest-01",
        name: "게스트01",
        gender: "M",
        grade: "E",
        hiddenSkill: 45,
        status: "WAITING",
        isPresent: true,
        fixedPartner: undefined,
      };

      state.setPlayers([
        ...state.players
          .slice(0, 7)
          .map((player) => ({
            ...player,
            gender: "M",
            hiddenSkill: 50,
          })),
        guest,
      ]);
      useMatchStore
        .getState()
        .requestFixedPartner(
          guest.id,
          "player-01",
          guest.name,
          "player-01"
        );
      const request =
        useMatchStore.getState()
          .fixedPartnerRequests[0];

      assert.ok(request);
      useMatchStore
        .getState()
        .approveFixedPartnerRequest(
          request.id
        );
      useMatchStore
        .getState()
        .rerollRecommendations(1);

      const recommendation =
        useMatchStore.getState()
          .selectedRecommendation;

      assert.ok(
        recommendation,
        "게스트 고정 파트너 승인 후에도 자동 추천이 생성되어야 합니다."
      );
    }
  );

  run(
    "게스트 고정 파트너 조합이 성별 규칙에 맞지 않아도 자동 대진 대안 생성",
    () => {
      resetStore(8, 1);
      const state =
        useMatchStore.getState();
      const guest = {
        ...state.players[7],
        id: "guest-mixed-01",
        name: "혼복게스트",
        gender: "F",
        grade: "E",
        hiddenSkill: 45,
        status: "WAITING",
        isPresent: true,
        fixedPartner: undefined,
      };

      state.setPlayers([
        {
          ...state.players[0],
          gender: "M",
          hiddenSkill: 50,
        },
        {
          ...state.players[1],
          gender: "M",
          hiddenSkill: 50,
        },
        {
          ...state.players[2],
          gender: "M",
          hiddenSkill: 50,
        },
        {
          ...state.players[3],
          gender: "F",
          hiddenSkill: 50,
        },
        ...state.players
          .slice(4, 7)
          .map((player) => ({
            ...player,
            gender: "M",
            hiddenSkill: 50,
          })),
        guest,
      ]);
      useMatchStore
        .getState()
        .setFixedPartner(
          guest.id,
          "player-01"
        );
      useMatchStore
        .getState()
        .rerollRecommendations(1);

      const recommendation =
        useMatchStore.getState()
          .selectedRecommendation;

      assert.ok(
        recommendation,
        "고정 파트너 우선 조합이 성별 규칙에서 탈락해도 일반 조합 추천이 생성되어야 합니다."
      );
    }
  );

  run(
    "고정 파트너 해제 후 재로그인해도 관계가 다시 생기지 않음",
    () => {
      resetStore(8, 1);
      const state =
        useMatchStore.getState();
      state.setFixedPartner(
        "player-01",
        "player-02"
      );
      state.removeFixedPartner(
        "player-01",
        "player-02"
      );
      const players =
        useMatchStore.getState()
          .players.map(
            (player) => ({
              ...player,
              fixedPartner:
                undefined,
            })
          );
      useMatchStore
        .getState()
        .setPlayers(players);
      const next =
        useMatchStore.getState();

      assert.equal(
        next.fixedPartnerAssignments
          .length,
        0
      );
      assert.equal(
        next.players.find(
          (player) =>
            player.id ===
            "player-01"
        ).fixedPartner,
        undefined
      );
    }
  );

  run(
    "새 기기가 서버 회원 정보의 고정 파트너를 불러오면 양방향 관계 복원",
    () => {
      resetStore(0, 1);
      const playerA = {
        ...makePlayer(0),
        fixedPartner:
          "player-02",
      };
      const playerB = {
        ...makePlayer(1),
        fixedPartner:
          "player-01",
      };

      useMatchStore
        .getState()
        .setPlayers([
          playerA,
          playerB,
        ]);
      const next =
        useMatchStore.getState();

      assert.equal(
        next.fixedPartnerAssignments
          .length,
        1
      );
      assert.equal(
        next.players[0]
          .fixedPartner,
        "player-02"
      );
      assert.equal(
        next.players[1]
          .fixedPartner,
        "player-01"
      );
    }
  );

  run(
    "운동 종료 후 다시 로그인하면 고정 파트너와 만나지 않기 설정 초기화",
    () => {
      resetStore(8, 1);
      const state =
        useMatchStore.getState();
      state.setFixedPartner(
        "player-01",
        "player-02"
      );
      state.addExcludedMatchPair(
        "player-03",
        "player-04"
      );
      const returningPlayers =
        state.players.map(
          (player) => ({
            ...player,
            status: "WAITING",
            isPresent: true,
          })
        );
      state.endTodaySession();
      useMatchStore
        .getState()
        .setPlayers(
          returningPlayers
        );
      const next =
        useMatchStore.getState();

      assert.equal(
        next.players.find(
          (player) =>
            player.id ===
            "player-01"
        ).fixedPartner,
        undefined
      );
      assert.deepEqual(
        next.excludedMatchPairs,
        []
      );
    }
  );

  run(
    "미로그인 만나지 않기 대상은 대진에 없고 로그인 후에는 같은 경기 배치 차단",
    () => {
      resetStore(7, 1);
      const state =
        useMatchStore.getState();
      state.addExcludedMatchPair(
        "player-01",
        "member-not-logged-in"
      );
      state.rerollRecommendations(
        1
      );
      assert.equal(
        useMatchStore
          .getState()
          .recommendations.flatMap(
            (recommendation) => [
              ...recommendation.teamA,
              ...recommendation.teamB,
            ]
          )
          .some(
            (player) =>
              player.id ===
              "member-not-logged-in"
          ),
        false
      );

      const lateMember = {
        ...makePlayer(20),
        id: "member-not-logged-in",
        name: "미로그인회원",
      };
      state.setPlayers([
        ...useMatchStore
          .getState().players,
        lateMember,
      ]);
      state.rerollRecommendations(
        1
      );
      const recommendations =
        useMatchStore.getState()
          .recommendations;

      assert.equal(
        recommendations.some(
          (recommendation) => {
            const ids = [
              ...recommendation.teamA,
              ...recommendation.teamB,
            ].map(
              (player) => player.id
            );
            return (
              ids.includes(
                "player-01"
              ) &&
              ids.includes(
                "member-not-logged-in"
              )
            );
          }
        ),
        false
      );
    }
  );

  run(
    "만나지 않기 대상 두 명을 수동 대진에 함께 넣으면 거부",
    () => {
      resetStore(8, 1);
      const state =
        useMatchStore.getState();
      state.addExcludedMatchPair(
        "player-01",
        "player-02"
      );
      const assigned =
        state.assignManualMatch(
          1,
          [
            "player-01",
            "player-03",
          ],
          [
            "player-02",
            "player-04",
          ]
        );

      assert.equal(
        assigned,
        false
      );
      assert.equal(
        useMatchStore.getState()
          .courts[0].status,
        "EMPTY"
      );
    }
  );

  run(
    "신규 참가자 20명이 로그인해도 기존 고정 파트너와 만나지 않기 설정 유지",
    () => {
      resetStore(10, 2);
      const state =
        useMatchStore.getState();
      state.setFixedPartner(
        "player-01",
        "player-02"
      );
      state.addExcludedMatchPair(
        "player-03",
        "player-04"
      );
      let live =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );

      for (
        let index = 10;
        index < 30;
        index += 1
      ) {
        const newcomer =
          makePlayer(index);
        live =
          mergeLiveStateSnapshot(
            live,
            {
              ...live,
              players: [
                newcomer,
              ],
              courts: [],
              fixedPartnerAssignments:
                [],
              excludedMatchPairs:
                [],
            },
            "PLAYER",
            newcomer.id
          );
      }

      assert.equal(
        live.fixedPartnerAssignments
          .length,
        1
      );
      assert.equal(
        live.players.find(
          (player) =>
            player.id ===
            "player-01"
        ).fixedPartner,
        "player-02"
      );
      assert.deepEqual(
        live.excludedMatchPairs,
        [
          [
            "player-03",
            "player-04",
          ],
        ]
      );
    }
  );

  run(
    "여러 운영진이 같은 고정 파트너 신청을 동시에 승인해도 한 번만 적용",
    () => {
      resetStore(8, 1);
      const baseStore =
        useMatchStore.getState();
      baseStore.requestFixedPartner(
        "player-01",
        "player-02"
      );
      const base =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const request =
        base.fixedPartnerRequests[0];
      const approvedAt =
        "2026-06-22T11:00:00.000Z";
      const approved = {
        ...base,
        fixedPartnerRequests: [],
        fixedPartnerAssignments: [
          {
            id:
              "player-01|player-02",
            playerAId:
              "player-01",
            playerBId:
              "player-02",
            approvedAt,
          },
        ],
        fixedPartnerRequestResolutions:
          [
            {
              id: request.id,
              requestId:
                request.id,
              resolvedAt:
                approvedAt,
              result:
                "APPROVED",
            },
          ],
      };
      let merged =
        mergeLiveStateSnapshot(
          base,
          approved,
          "ADMIN",
          "admin-1",
          createLiveStatePatch(
            base,
            approved
          )
        );
      merged =
        mergeLiveStateSnapshot(
          merged,
          approved,
          "MASTER",
          "master",
          createLiveStatePatch(
            base,
            approved
          )
        );

      assert.equal(
        merged.fixedPartnerAssignments
          .length,
        1
      );
      assert.equal(
        merged.fixedPartnerRequests
          .length,
        0
      );
      assert.equal(
        merged.players.find(
          (player) =>
            player.id ===
            "player-01"
        ).fixedPartner,
        "player-02"
      );
    }
  );

  run(
    "승인 완료 후 플레이어가 오래된 화면을 새로고침해도 신청이 되살아나지 않음",
    () => {
      resetStore(8, 1);
      useMatchStore
        .getState()
        .requestFixedPartner(
          "player-01",
          "player-02"
        );
      const stalePlayerSnapshot =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const request =
        stalePlayerSnapshot
          .fixedPartnerRequests[0];
      const approved = {
        ...stalePlayerSnapshot,
        fixedPartnerRequests: [],
        fixedPartnerAssignments: [
          {
            id:
              "player-01|player-02",
            playerAId:
              "player-01",
            playerBId:
              "player-02",
            approvedAt:
              "2026-06-22T11:00:00.000Z",
          },
        ],
        fixedPartnerRequestResolutions:
          [
            {
              id: request.id,
              requestId:
                request.id,
              resolvedAt:
                "2026-06-22T11:00:00.000Z",
              result:
                "APPROVED",
            },
          ],
      };
      let live =
        mergeLiveStateSnapshot(
          stalePlayerSnapshot,
          approved,
          "ADMIN",
          "admin-1",
          createLiveStatePatch(
            stalePlayerSnapshot,
            approved
          )
        );
      live =
        mergeLiveStateSnapshot(
          live,
          stalePlayerSnapshot,
          "PLAYER",
          "player-01"
        );

      assert.equal(
        live.fixedPartnerRequests
          .length,
        0
      );
      assert.equal(
        live.fixedPartnerAssignments
          .length,
        1
      );
    }
  );

  run(
    "거절 완료 후 플레이어가 오래된 화면을 새로고침해도 신청이 되살아나지 않음",
    () => {
      resetStore(8, 1);
      useMatchStore
        .getState()
        .requestFixedPartner(
          "player-01",
          "player-02"
        );
      const stalePlayerSnapshot =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const request =
        stalePlayerSnapshot
          .fixedPartnerRequests[0];
      const rejected = {
        ...stalePlayerSnapshot,
        fixedPartnerRequests: [],
        fixedPartnerRequestResolutions:
          [
            {
              id: request.id,
              requestId:
                request.id,
              resolvedAt:
                "2026-06-22T11:00:00.000Z",
              result:
                "REJECTED",
            },
          ],
      };
      let live =
        mergeLiveStateSnapshot(
          stalePlayerSnapshot,
          rejected,
          "ADMIN",
          "admin-1",
          createLiveStatePatch(
            stalePlayerSnapshot,
            rejected
          )
        );
      live =
        mergeLiveStateSnapshot(
          live,
          stalePlayerSnapshot,
          "PLAYER",
          "player-01"
        );

      assert.equal(
        live.fixedPartnerRequests
          .length,
        0
      );
      assert.equal(
        live.fixedPartnerAssignments
          .length,
        0
      );
    }
  );

  run(
    "두 플레이어가 같은 고정 파트너 신청을 동시에 보내도 한 건만 유지",
    () => {
      resetStore(8, 1);
      const base =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const requestA = {
        id: "request-a",
        requesterId:
          "player-01",
        requesterName:
          "선수01",
        partnerId:
          "player-02",
        partnerName:
          "선수02",
        createdAt:
          "2026-06-22T10:00:00.000Z",
      };
      const requestB = {
        id: "request-b",
        requesterId:
          "player-02",
        requesterName:
          "선수02",
        partnerId:
          "player-01",
        partnerName:
          "선수01",
        createdAt:
          "2026-06-22T10:00:00.050Z",
      };
      let live =
        mergeLiveStateSnapshot(
          base,
          {
            ...base,
            fixedPartnerRequests: [
              requestA,
            ],
          },
          "PLAYER",
          "player-01"
        );
      live =
        mergeLiveStateSnapshot(
          live,
          {
            ...base,
            fixedPartnerRequests: [
              requestB,
            ],
          },
          "PLAYER",
          "player-02"
        );

      assert.equal(
        live.fixedPartnerRequests
          .length,
        1
      );
    }
  );

  run(
    "한 회원에 대한 서로 다른 고정 파트너 동시 승인 시 하나의 관계만 유지",
    () => {
      resetStore(8, 1);
      const base =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const adminA = {
        ...base,
        fixedPartnerAssignments: [
          {
            id:
              "player-01|player-02",
            playerAId:
              "player-01",
            playerBId:
              "player-02",
            approvedAt:
              "2026-06-22T11:00:00.000Z",
          },
        ],
      };
      const adminB = {
        ...base,
        fixedPartnerAssignments: [
          {
            id:
              "player-01|player-03",
            playerAId:
              "player-01",
            playerBId:
              "player-03",
            approvedAt:
              "2026-06-22T11:00:00.050Z",
          },
        ],
      };
      let merged =
        mergeLiveStateSnapshot(
          base,
          adminA,
          "ADMIN",
          "admin-1",
          createLiveStatePatch(
            base,
            adminA
          )
        );
      merged =
        mergeLiveStateSnapshot(
          merged,
          adminB,
          "MASTER",
          "master",
          createLiveStatePatch(
            base,
            adminB
          )
        );

      assert.equal(
        merged.fixedPartnerAssignments
          .length,
        1
      );
      assert.equal(
        merged.players.find(
          (player) =>
            player.id ===
            "player-01"
        ).fixedPartner,
        "player-02"
      );
      assert.equal(
        merged.players.find(
          (player) =>
            player.id ===
            "player-03"
        ).fixedPartner,
        undefined
      );
    }
  );

  run(
    "경기 진행 중 신규 참가자 10명이 연속 로그인해도 코트와 대진 유지",
    () => {
      resetStore(20, 3);
      for (
        let courtId = 1;
        courtId <= 3;
        courtId += 1
      ) {
        useMatchStore
          .getState()
          .rerollRecommendations(
            courtId
          );
        useMatchStore
          .getState()
          .approveRecommendation();
      }
      let live =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const originalCourtIds =
        live.courts.map(
          (court) => [
            court.id,
            ...court.teamA.map(
              (player) => player.id
            ),
            ...court.teamB.map(
              (player) => player.id
            ),
          ]
        );

      for (
        let index = 20;
        index < 30;
        index += 1
      ) {
        const newcomer =
          makePlayer(index);
        live =
          mergeLiveStateSnapshot(
            live,
            {
              ...live,
              players: [
                newcomer,
              ],
              courts: [],
            },
            "PLAYER",
            newcomer.id
          );
      }

      assert.equal(
        live.players.length,
        30
      );
      assert.deepEqual(
        live.courts.map(
          (court) => [
            court.id,
            ...court.teamA.map(
              (player) => player.id
            ),
            ...court.teamB.map(
              (player) => player.id
            ),
          ]
        ),
        originalCourtIds
      );
    }
  );

  run(
    "경기 중 선수가 퇴장하면 해당 코트는 비워지고 나머지 선수는 대기 복귀",
    () => {
      resetStore(12, 2);
      useMatchStore
        .getState()
        .assignManualMatch(
          1,
          [
            "player-01",
            "player-02",
          ],
          [
            "player-03",
            "player-04",
          ]
        );
      const live =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const leavingPlayer = {
        ...live.players.find(
          (player) =>
            player.id ===
            "player-01"
        ),
        status: "LEFT",
        isPresent: false,
      };
      const merged =
        mergeLiveStateSnapshot(
          live,
          {
            ...live,
            players: [
              leavingPlayer,
            ],
          },
          "PLAYER",
          "player-01"
        );

      assert.equal(
        merged.courts[0].status,
        "EMPTY"
      );
      assert.equal(
        merged.players.find(
          (player) =>
            player.id ===
            "player-01"
        ).status,
        "LEFT"
      );
      assert.equal(
        [
          "player-02",
          "player-03",
          "player-04",
        ].every(
          (playerId) =>
            merged.players.find(
              (player) =>
                player.id ===
                playerId
            ).status ===
            "WAITING"
        ),
        true
      );
    }
  );

  run(
    "운영진 수동 대진 선택 중 다른 운영진이 자동 대진을 확정하면 수동 확정 거부",
    () => {
      resetStore(20, 2);
      const manualSelection = [
        "player-01",
        "player-02",
        "player-03",
        "player-04",
      ];
      useMatchStore
        .getState()
        .rerollRecommendations(
          1
        );
      useMatchStore
        .getState()
        .approveRecommendation();
      const assigned =
        useMatchStore
          .getState()
          .assignManualMatch(
            1,
            [
              manualSelection[0],
              manualSelection[1],
            ],
            [
              manualSelection[2],
              manualSelection[3],
            ]
          );

      assert.equal(
        assigned,
        false
      );
      assert.equal(
        useMatchStore.getState()
          .courts.filter(
            (court) =>
              court.status ===
              "PLAYING"
          ).length,
        1
      );
    }
  );

  run(
    "대진 생성 완료 전후 플레이어 30명이 반복 새로고침해도 추천 창은 전파되지 않고 확정 코트 유지",
    () => {
      resetStore(30, 3);
      useMatchStore
        .getState()
        .rerollRecommendations(
          1
        );
      const beforeApproval =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );

      assert.equal(
        createLiveStatePatch(
          beforeApproval,
          createLiveStateSnapshot(
            useMatchStore.getState()
          )
        ).changedKeys.length,
        0
      );

      useMatchStore
        .getState()
        .approveRecommendation();
      let live =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const courtIds = [
        ...live.courts[0].teamA,
        ...live.courts[0].teamB,
      ].map((player) => player.id);

      for (
        let round = 0;
        round < 3;
        round += 1
      ) {
        for (
          let index = 0;
          index < 30;
          index += 1
        ) {
          live =
            mergeLiveStateSnapshot(
              live,
              {
                ...live,
                players: [
                  makePlayer(index),
                ],
                courts: [],
              },
              "PLAYER",
              makePlayer(index).id
            );
        }
      }

      assert.equal(
        live.courts[0].status,
        "PLAYING"
      );
      assert.deepEqual(
        [
          ...live.courts[0]
            .teamA,
          ...live.courts[0]
            .teamB,
        ].map(
          (player) => player.id
        ),
        courtIds
      );
    }
  );

  run(
    "여복 우선 조건 충족 시 여성 4명으로 추천",
    () => {
      resetStore(12, 1);
      const state =
        useMatchStore.getState();
      state.setPlayers(
        state.players.map(
          (player, index) => ({
            ...player,
            gender:
              index < 4
                ? "F"
                : "M",
          })
        )
      );
      state.setWomenDoublesPriority(
        true
      );
      state.rerollRecommendations(
        1
      );
      const recommendation =
        useMatchStore.getState()
          .selectedRecommendation;

      assert.ok(recommendation);
      assert.equal(
        [
          ...recommendation.teamA,
          ...recommendation.teamB,
        ].filter(
          (player) =>
            player.gender === "F"
        ).length,
        4
      );
    }
  );

  run(
    "30명·4코트에서 500회 무작위 동시 동작 후에도 핵심 상태 불변식 유지",
    () => {
      resetStore(30, 4);
      let seed = 20260623;
      const random = () => {
        seed =
          (
            seed * 1664525 +
            1013904223
          ) %
          4294967296;
        return seed / 4294967296;
      };
      const pick = (items) =>
        items[
          Math.floor(
            random() *
              items.length
          )
        ];

      for (
        let operation = 0;
        operation < 500;
        operation += 1
      ) {
        const state =
          useMatchStore.getState();
        const emptyCourts =
          state.courts.filter(
            (court) =>
              court.status ===
              "EMPTY"
          );
        const playingCourts =
          state.courts.filter(
            (court) =>
              court.status ===
              "PLAYING"
          );
        const waitingPlayers =
          state.players.filter(
            (player) =>
              player.status ===
                "WAITING" &&
              player.isPresent
          );
        const action =
          Math.floor(
            random() * 9
          );

        if (
          action === 0 &&
          emptyCourts.length > 0 &&
          waitingPlayers.length >= 4
        ) {
          state.rerollRecommendations(
            pick(emptyCourts).id
          );
          useMatchStore
            .getState()
            .approveRecommendation();
        } else if (
          action === 1 &&
          emptyCourts.length > 0 &&
          waitingPlayers.length >= 4
        ) {
          const selected =
            waitingPlayers
              .slice()
              .sort(
                () =>
                  random() - 0.5
              )
              .slice(0, 4);
          state.assignManualMatch(
            pick(emptyCourts).id,
            [
              selected[0].id,
              selected[1].id,
            ],
            [
              selected[2].id,
              selected[3].id,
            ]
          );
        } else if (
          action === 2 &&
          playingCourts.length > 0
        ) {
          state.finishCourtMatch(
            pick(playingCourts).id
          );
        } else if (
          action === 3 &&
          playingCourts.length > 0
        ) {
          const court =
            pick(playingCourts);
          const assigned = [
            ...court.teamA,
            ...court.teamB,
          ];
          const first =
            pick(assigned);
          const second =
            pick(
              assigned.filter(
                (player) =>
                  player.id !==
                  first.id
              )
            );
          state.swapCourtPlayers(
            court.id,
            first.id,
            second.id
          );
        } else if (
          action === 4 &&
          playingCourts.length > 0 &&
          waitingPlayers.length > 0
        ) {
          const court =
            pick(playingCourts);
          state.replaceCourtPlayer(
            court.id,
            pick([
              ...court.teamA,
              ...court.teamB,
            ]).id,
            pick(waitingPlayers).id
          );
        } else if (
          action === 5 &&
          state.players.length > 0
        ) {
          const source =
            pick(state.players);
          const merged =
            mergeLiveStateSnapshot(
              createLiveStateSnapshot(
                state
              ),
              {
                ...createLiveStateSnapshot(
                  state
                ),
                players: [
                  {
                    ...source,
                  },
                ],
                courts: [],
              },
              "PLAYER",
              source.id
            );
          useMatchStore.setState(
            merged
          );
        } else if (
          action === 6 &&
          waitingPlayers.length > 0
        ) {
          const source =
            pick(waitingPlayers);
          const current =
            createLiveStateSnapshot(
              state
            );
          const merged =
            mergeLiveStateSnapshot(
              current,
              {
                ...current,
                players: [
                  {
                    ...source,
                    status: "LEFT",
                    isPresent: false,
                  },
                ],
              },
              "PLAYER",
              source.id
            );
          useMatchStore.setState(
            merged
          );
        } else if (
          action === 7 &&
          state.players.length >= 2
        ) {
          const first =
            pick(state.players);
          const second =
            pick(
              state.players.filter(
                (player) =>
                  player.id !==
                  first.id
              )
            );
          state.setFixedPartner(
            first.id,
            second.id
          );
        } else if (
          action === 8 &&
          waitingPlayers.length >= 2
        ) {
          const first =
            pick(waitingPlayers);
          const second =
            pick(
              waitingPlayers.filter(
                (player) =>
                  player.id !==
                  first.id
              )
            );
          state.addExcludedMatchPair(
            first.id,
            second.id
          );
        }

        const next =
          useMatchStore.getState();
        const assignedIds =
          next.courts.flatMap(
            (court) =>
              court.status ===
                "PLAYING"
                ? [
                    ...court.teamA,
                    ...court.teamB,
                  ].map(
                    (player) =>
                      player.id
                  )
                : []
          );
        const playingIds =
          next.players
            .filter(
              (player) =>
                player.status ===
                "PLAYING"
            )
            .map(
              (player) =>
                player.id
            )
            .sort();
        const assignmentMemberIds =
          next.fixedPartnerAssignments.flatMap(
            (assignment) => [
              assignment.playerAId,
              assignment.playerBId,
            ]
          );

        assert.equal(
          new Set(
            next.players.map(
              (player) =>
                player.id
            )
          ).size,
          next.players.length,
          `${operation}번째 동작 후 참가자 중복`
        );
        assert.equal(
          new Set(assignedIds).size,
          assignedIds.length,
          `${operation}번째 동작 후 복수 코트 배정`
        );
        assert.deepEqual(
          [...assignedIds].sort(),
          playingIds,
          `${operation}번째 동작 후 코트와 PLAYING 상태 불일치`
        );
        assert.equal(
          new Set(
            assignmentMemberIds
          ).size,
          assignmentMemberIds.length,
          `${operation}번째 동작 후 고정 파트너 중복 관계`
        );
        next.courts
          .filter(
            (court) =>
              court.status ===
              "PLAYING"
          )
          .forEach((court) => {
            const courtPlayerIds =
              new Set(
                [
                  ...court.teamA,
                  ...court.teamB,
                ].map(
                  (player) =>
                    player.id
                )
              );

            assert.equal(
              next.excludedMatchPairs.some(
                ([
                  playerAId,
                  playerBId,
                ]) =>
                  courtPlayerIds.has(
                    playerAId
                  ) &&
                  courtPlayerIds.has(
                    playerBId
                  )
              ),
              false,
              `${operation}번째 동작 후 만나지 않기 대상이 같은 코트에 배정`
            );
          });
      }
    }
  );

  run(
    "30명·4코트·10라운드 연속 운영에도 중복 배정과 기록 유실 없음",
    () => {
      resetStore(30, 4);
      const expectedMatches =
        4 * 10;

      for (
        let round = 0;
        round < 10;
        round += 1
      ) {
        for (
          let courtId = 1;
          courtId <= 4;
          courtId += 1
        ) {
          useMatchStore
            .getState()
            .rerollRecommendations(
              courtId
            );
          assert.ok(
            useMatchStore.getState()
              .selectedRecommendation,
            `${round + 1}라운드 ${courtId}코트 추천 실패`
          );
          useMatchStore
            .getState()
            .approveRecommendation();
        }

        const playing =
          useMatchStore
            .getState()
            .players.filter(
              (player) =>
                player.status ===
                "PLAYING"
            );

        assert.equal(
          playing.length,
          16
        );
        assert.equal(
          new Set(
            playing.map(
              (player) =>
                player.id
            )
          ).size,
          16
        );

        for (
          let courtId = 1;
          courtId <= 4;
          courtId += 1
        ) {
          useMatchStore
            .getState()
            .finishCourtMatch(
              courtId
            );
        }
      }

      const finalState =
        useMatchStore.getState();
      assert.equal(
        finalState.matchHistory
          .length,
        expectedMatches
      );
      assert.equal(
        finalState.players.filter(
          (player) =>
            player.status ===
            "WAITING"
        ).length,
        30
      );
    }
  );

  run(
    "마스터가 경기 종료하면 운영진과 플레이어 화면에도 코트 종료와 기록이 반영",
    () => {
      resetStore(12, 1);
      const masterStore =
        useMatchStore.getState();
      masterStore.rerollRecommendations(
        1
      );
      masterStore.approveRecommendation();
      const before =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );

      useMatchStore
        .getState()
        .finishCourtMatch(1);
      const after =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const patch =
        createLiveStatePatch(
          before,
          after
        );
      const adminView =
        mergeLiveStateSnapshot(
          before,
          after,
          "MASTER",
          "master-player-id",
          patch
        );

      assert.equal(
        adminView.courts.find(
          (court) => court.id === 1
        )?.status,
        "EMPTY"
      );
      assert.equal(
        adminView.players.filter(
          (player) =>
            player.status ===
            "PLAYING"
        ).length,
        0
      );
      assert.equal(
        adminView.matchHistory.length,
        1
      );
    }
  );

  run(
    "운동 전체 종료 시 오늘 상태는 초기화되고 경기 기록은 유지",
    () => {
      const historyCount =
        useMatchStore.getState()
          .matchHistory.length;
      useMatchStore
        .getState()
        .endTodaySession();
      const next =
        useMatchStore.getState();

      assert.equal(
        next.players.length,
        0
      );
      assert.equal(
        next.courts.length,
        0
      );
      assert.equal(
        next.recommendations
          .length,
        0
      );
      assert.equal(
        next.fixedPartnerAssignments
          .length,
        0
      );
      assert.equal(
        next.excludedMatchPairs
          .length,
        0
      );
      assert.equal(
        next.matchHistory.length,
        historyCount
      );
    }
  );

  run(
    "운동 개설 직후 지연된 빈 운영진 응답이 도착해도 참가자·코트·설정 유지",
    () => {
      resetStore(12, 3);
      const liveState =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const merged =
        mergeLiveStateSnapshot(
          liveState,
          {
            ...liveState,
            players: [],
            courts: [],
            fixedPartnerRequests:
              [],
            fixedPartnerAssignments:
              [],
            fixedPartnerRequestResolutions:
              [],
            notifications: [],
            matchHistory: [],
            womenDoublesPriority:
              false,
            excludedMatchPairs:
              [],
          },
          "ADMIN"
        );

      useMatchStore.setState(
        merged
      );
      const next =
        useMatchStore.getState();

      assert.equal(
        next.players.length,
        12
      );
      assert.equal(
        next.courts.length,
        3
      );
    }
  );

  run(
    "지연된 빈 응답 직후 수동 대진을 생성해도 전체 정보가 사라지지 않음",
    () => {
      resetStore(12, 3);
      const before =
        createLiveStateSnapshot(
          useMatchStore.getState()
        );
      const merged =
        mergeLiveStateSnapshot(
          before,
          {
            ...before,
            players: [],
            courts: [],
            fixedPartnerRequests:
              [],
            fixedPartnerAssignments:
              [],
            fixedPartnerRequestResolutions:
              [],
            notifications: [],
            matchHistory: [],
            womenDoublesPriority:
              false,
            excludedMatchPairs:
              [],
          },
          "MASTER"
        );

      useMatchStore.setState(
        merged
      );
      const waiting =
        useMatchStore
          .getState()
          .players.filter(
            (player) =>
              player.status ===
              "WAITING"
          );
      const assigned =
        useMatchStore
          .getState()
          .assignManualMatch(
            1,
            [
              waiting[0].id,
              waiting[1].id,
            ],
            [
              waiting[2].id,
              waiting[3].id,
            ]
          );
      const next =
        useMatchStore.getState();

      assert.equal(assigned, true);
      assert.equal(
        next.players.length,
        12
      );
      assert.equal(
        next.courts.length,
        3
      );
      assert.equal(
        next.courts[0].status,
        "PLAYING"
      );
      assert.equal(
        next.players.filter(
          (player) =>
            player.status ===
            "PLAYING"
        ).length,
        4
      );
    }
  );

  run(
    "인원수와 무관하게 운동 개설 후 DB 출석으로 대시보드 참가자 복구",
    () => {
      [
        1,
        2,
        6,
        9,
        20,
        30,
      ].forEach((count) => {
        const rows =
          Array.from(
            { length: count },
            (_, index) => ({
              user_id:
                `recovery-${index}`,
              arrival_time:
                new Date(
                  Date.parse(
                    "2026-06-23T10:00:00.000Z"
                  ) + index * 1000
                ).toISOString(),
              users: {
                id:
                  `recovery-${index}`,
                name:
                  `복구선수${index}`,
                gender:
                  index % 3 === 0
                    ? "F"
                    : "M",
                grade: "E",
                hidden_skill: 45,
                fixed_partner_id:
                  null,
              },
            })
          );
        const recovered =
          mergeAttendancePlayers(
            [],
            rows
          );

        assert.equal(
          recovered.length,
          count,
          `${count}명 복구 실패`
        );
        assert.equal(
          recovered.every(
            (player) =>
              player.status ===
                "WAITING" &&
              player.isPresent
          ),
          true
        );
      });
    }
  );

  run(
    "DB 자동 복구가 진행 중 경기 상태를 훼손하거나 반복 갱신하지 않음",
    () => {
      const current = [
        {
          ...makePlayer(0),
          status: "PLAYING",
          waitingStartedAt:
            undefined,
          playingStartedAt:
            new Date(
              "2026-06-23T10:10:00.000Z"
            ),
        },
      ];
      const rows = [
        {
          user_id: current[0].id,
          arrival_time:
            current[0].arrivalTime.toISOString(),
          users: {
            id: current[0].id,
            name: current[0].name,
            gender:
              current[0].gender,
            grade: current[0].grade,
            hidden_skill:
              current[0].hiddenSkill,
            fixed_partner_id:
              null,
          },
        },
      ];
      const recovered =
        mergeAttendancePlayers(
          current,
          rows
        );

      assert.equal(
        recovered[0],
        current[0],
        "동일 데이터 복구는 상태 객체를 변경하면 안 됨"
      );
      assert.equal(
        recovered[0].status,
        "PLAYING"
      );
      assert.equal(
        createDefaultCourts()
          .length,
        3
      );
    }
  );

  run(
    "rest display is clamped and never jumps above 60 minutes",
    () => {
      const veryOldWaitingAt =
        new Date(Date.now() - 140 * 60 * 1000);

      assert.equal(
        getRestMinutes(veryOldWaitingAt),
        60
      );
      assert.equal(
        getRestMinutes(
          new Date(Date.now() + 10 * 60 * 1000)
        ),
        0
      );
    }
  );

  run(
    "replacement player increments match count exactly once",
    () => {
      resetStore(10, 1);
      useMatchStore
        .getState()
        .assignManualMatch(
          1,
          ["player-01", "player-02"],
          ["player-03", "player-04"]
        );
      const beforeReplacement =
        useMatchStore
          .getState()
          .players.find((player) => player.id === "player-05");

      useMatchStore
        .getState()
        .replaceCourtPlayer(
          1,
          "player-04",
          "player-05"
        );
      const next = useMatchStore.getState();
      const incoming = next.players.find(
        (player) => player.id === "player-05"
      );
      const outgoing = next.players.find(
        (player) => player.id === "player-04"
      );

      assert.equal(
        incoming.matchCount,
        beforeReplacement.matchCount + 1
      );
      assert.equal(incoming.status, "PLAYING");
      assert.equal(outgoing.status, "WAITING");
      assert.ok(
        getRestMinutes(outgoing.waitingStartedAt) <= 60
      );
    }
  );

  run(
    "fixed partner does not force a just-finished partner back in",
    () => {
      resetStore(12, 1);
      const now = Date.now();
      useMatchStore.setState((state) => ({
        players: state.players.map((player, index) => {
          if (player.id === "player-01") {
            return {
              ...player,
              fixedPartner: "player-02",
              waitingStartedAt:
                new Date(now - 25 * 60 * 1000),
            };
          }

          if (player.id === "player-02") {
            return {
              ...player,
              fixedPartner: "player-01",
              waitingStartedAt: new Date(now),
            };
          }

          return {
            ...player,
            waitingStartedAt:
              new Date(now - (18 - index) * 60 * 1000),
          };
        }),
      }));

      useMatchStore
        .getState()
        .rerollRecommendations(1);
      const recommendation =
        useMatchStore.getState().selectedRecommendation;
      const selectedIds = new Set([
        ...recommendation.teamA,
        ...recommendation.teamB,
      ].map((player) => player.id));

      assert.ok(selectedIds.has("player-01"));
      assert.equal(selectedIds.has("player-02"), false);
    }
  );

  run(
    "players who shared the last two games are avoided when alternatives exist",
    () => {
      resetStore(12, 1);
      useMatchStore.setState((state) => ({
        players: state.players.map((player) => {
          if (player.id === "player-01") {
            return {
              ...player,
              lastOpponents: ["player-02", "player-02"],
              waitingStartedAt:
                new Date(Date.now() - 20 * 60 * 1000),
            };
          }

          if (player.id === "player-02") {
            return {
              ...player,
              lastOpponents: ["player-01", "player-01"],
              waitingStartedAt:
                new Date(Date.now() - 19 * 60 * 1000),
            };
          }

          return {
            ...player,
            waitingStartedAt:
              new Date(Date.now() - 18 * 60 * 1000),
          };
        }),
      }));

      useMatchStore
        .getState()
        .rerollRecommendations(1);
      const recommendation =
        useMatchStore.getState().selectedRecommendation;
      const selectedIds = new Set([
        ...recommendation.teamA,
        ...recommendation.teamB,
      ].map((player) => player.id));

      assert.equal(
        selectedIds.has("player-01") &&
          selectedIds.has("player-02"),
        false
      );
    }
  );

  console.log(
    `real-workout simulation: PASS (${results.length} scenarios)`
  );
  results.forEach(
    ({
      scenario,
      duration,
    }) => {
      console.log(
        `- ${scenario}: ${duration.toFixed(
          1
        )}ms`
      );
    }
  );
} finally {
  await server.close();
}
