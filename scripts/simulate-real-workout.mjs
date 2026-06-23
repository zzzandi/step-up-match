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
        next.matchHistory.length,
        historyCount
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
