import assert from "node:assert/strict";
import {
  createServer,
} from "vite";

const memoryStorage = new Map();

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
    mergeLiveStateSnapshot,
  } = await server.ssrLoadModule(
    "/src/services/liveStateSync.ts"
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

  function makePlayer(index) {
    const waitingStartedAt =
      new Date(
        Date.parse(
          "2026-07-14T10:00:00.000Z"
        ) +
          index * 10_000
      );

    return {
      id: `player-${String(
        index + 1
      ).padStart(2, "0")}`,
      name: `SQA${String(
        index + 1
      ).padStart(2, "0")}`,
      gender:
        index % 5 === 0
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
        88 - (index % 6) * 9,
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
    playerCount = 36,
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
      queuedCourts: [],
      fixedPartnerRequests: [],
      fixedPartnerAssignments: [],
      fixedPartnerRequestResolutions:
        [],
      notifications: [],
      dismissedNotificationIds: [],
      matchHistory: [],
      workoutReportEvents: [],
      workoutReportSnapshots: [],
      deletedWorkoutReportSnapshotIds:
        [],
      recommendations: [],
      selectedRecommendation:
        null,
      womenDoublesPriority:
        false,
      excludedMatchPairs: [],
    });
  }

  function snapshot() {
    return createLiveStateSnapshot(
      useMatchStore.getState()
    );
  }

  function loadSnapshot(state) {
    useMatchStore.setState(
      structuredClone(state)
    );
  }

  function playerIds(court) {
    return [
      ...(court.teamA ?? []),
      ...(court.teamB ?? []),
    ].map((player) => player.id);
  }

  function compactState(state) {
    return {
      players: state.players
        .map((player) => ({
          id: player.id,
          status: player.status,
          matchCount:
            player.matchCount,
          consecutiveMatches:
            player.consecutiveMatches,
          waitingStartedAt:
            player.waitingStartedAt
              ? new Date(
                  player.waitingStartedAt
                ).getTime()
              : null,
          playingStartedAt:
            player.playingStartedAt
              ? new Date(
                  player.playingStartedAt
                ).getTime()
              : null,
        }))
        .sort((a, b) =>
          a.id.localeCompare(b.id)
        ),
      courts: state.courts.map(
        (court) => ({
          id: court.id,
          status: court.status,
          players: playerIds(court),
        })
      ),
      queuedCourts:
        state.queuedCourts.map(
          (court) => ({
            id: court.id,
            players:
              playerIds(court),
          })
        ),
      matchHistoryCount:
        state.matchHistory.length,
    };
  }

  function assertNoDuplicates(
    ids,
    message
  ) {
    const seen = new Set();

    ids.forEach((id) => {
      assert.equal(
        seen.has(id),
        false,
        `${message}: ${id}`
      );
      seen.add(id);
    });
  }

  function assertInvariants(
    state,
    label
  ) {
    assert.ok(
      state.courts.length >= 1,
      `${label}: game courts disappeared`
    );

    state.queuedCourts.forEach(
      (court, index) => {
        assert.equal(
          court.id,
          index + 1,
          `${label}: queued court ids must stay compact`
        );
      }
    );

    const playingCourtIds =
      state.courts.flatMap(
        playerIds
      );
    assertNoDuplicates(
      playingCourtIds,
      `${label}: duplicate player across game courts`
    );

    const queuedPlayerIds =
      state.queuedCourts.flatMap(
        playerIds
      );
    assertNoDuplicates(
      queuedPlayerIds,
      `${label}: duplicate player across queued courts`
    );

    const playingSet = new Set(
      playingCourtIds
    );

    state.players.forEach(
      (player) => {
        if (
          playingSet.has(player.id)
        ) {
          assert.equal(
            player.status,
            "PLAYING",
            `${label}: game court player must be PLAYING (${player.id})`
          );
        }

        if (
          player.status ===
          "PLAYING"
        ) {
          assert.equal(
            playingSet.has(
              player.id
            ),
            true,
            `${label}: PLAYING player must exist in a game court (${player.id})`
          );
        }
      }
    );
  }

  function assertStatsDelta(
    before,
    after,
    allowedIncrements,
    label
  ) {
    before.players.forEach(
      (previous) => {
        const next =
          after.players.find(
            (player) =>
              player.id ===
              previous.id
          );
        assert.ok(
          next,
          `${label}: missing player ${previous.id}`
        );
        const delta =
          next.matchCount -
          previous.matchCount;
        const expected =
          allowedIncrements.has(
            previous.id
          )
            ? 1
            : 0;

        assert.equal(
          delta,
          expected,
          `${label}: unexpected matchCount delta for ${previous.id}`
        );
      }
    );
  }

  function operate(
    state,
    label,
    action,
    allowedIncrements =
      new Set()
  ) {
    loadSnapshot(state);
    const before = snapshot();
    action(
      useMatchStore.getState()
    );
    const after = snapshot();
    assertInvariants(
      after,
      label
    );
    assertStatsDelta(
      before,
      after,
      allowedIncrements,
      label
    );

    return after;
  }

  function idsFromCourt(
    state,
    courtId
  ) {
    const court =
      state.courts.find(
        (item) =>
          item.id === courtId
      );

    return new Set(
      court ? playerIds(court) : []
    );
  }

  function syncClients(
    previousCanonical,
    nextCanonical,
    clients,
    label,
    sourceRole = "MASTER"
  ) {
    const patch =
      createLiveStatePatch(
        previousCanonical,
        nextCanonical
      );
    return clients.map(
      (client, index) => {
        let current =
          structuredClone(client);

        if (index % 2 === 0) {
          current =
            mergeLiveStateSnapshot(
              current,
              previousCanonical,
              "ADMIN",
              undefined
            );
        }

        current =
          mergeLiveStateSnapshot(
            current,
            nextCanonical,
            sourceRole,
            undefined,
            patch
          );

        if (index % 3 === 0) {
          current =
            mergeLiveStateSnapshot(
              current,
              nextCanonical,
              sourceRole,
              undefined
            );
        }

        assertInvariants(
          current,
          `${label}: client ${index}`
        );

        assert.deepEqual(
          compactState(current),
          compactState(
            nextCanonical
          ),
          `${label}: client ${index} did not converge`
        );

        return current;
      }
    );
  }

  function assignGame(
    courtId,
    ids
  ) {
    assert.equal(
      useMatchStore
        .getState()
        .assignManualMatch(
          courtId,
          [ids[0], ids[1]],
          [ids[2], ids[3]]
        ),
      true
    );
  }

  function assignQueue(
    courtId,
    ids
  ) {
    assert.equal(
      useMatchStore
        .getState()
        .assignManualMatch(
          courtId,
          [ids[0], ids[1]],
          [ids[2], ids[3]],
          "QUEUE"
        ),
      true
    );
  }

  function runManagerQueueWorkflow(
    sourceRole
  ) {
      resetStore(36, 3);
      assignGame(1, [
        "player-01",
        "player-02",
        "player-03",
        "player-04",
      ]);
      assignGame(2, [
        "player-05",
        "player-06",
        "player-07",
        "player-08",
      ]);
      assignGame(3, [
        "player-09",
        "player-10",
        "player-11",
        "player-12",
      ]);
      Array.from({
        length: 4,
      }).forEach(() =>
        useMatchStore
          .getState()
          .addQueuedCourt()
      );
      assignQueue(1, [
        "player-01",
        "player-13",
        "player-14",
        "player-15",
      ]);
      assignQueue(2, [
        "player-16",
        "player-17",
        "player-18",
        "player-19",
      ]);
      assignQueue(3, [
        "player-09",
        "player-20",
        "player-21",
        "player-22",
      ]);
      assignQueue(4, [
        "player-23",
        "player-24",
        "player-25",
        "player-26",
      ]);

      let canonical =
        snapshot();
      assertInvariants(
        canonical,
        "initial"
      );
      let clients = [
        structuredClone(
          canonical
        ),
        structuredClone(
          canonical
        ),
        structuredClone(
          canonical
        ),
        structuredClone(
          canonical
        ),
      ];

      let previous =
        canonical;
      const court2Finishers =
        idsFromCourt(
          canonical,
          2
        );
      canonical = operate(
        canonical,
        "finish court 2 skips queue 1 because player-01 is still playing",
        () =>
          useMatchStore
            .getState()
            .finishCourtMatch(2),
        court2Finishers
      );
      assert.deepEqual(
        playerIds(
          canonical.courts[1]
        ),
        [
          "player-16",
          "player-17",
          "player-18",
          "player-19",
        ]
      );
      assert.equal(
        canonical.queuedCourts.some(
          (court) =>
            playerIds(court).includes(
              "player-01"
            )
        ),
        true
      );
      clients = syncClients(
        previous,
        canonical,
        clients,
        `${sourceRole} after blocked promotion`,
        sourceRole
      );

      previous = canonical;
      canonical = operate(
        canonical,
        "delete occupied queued court and rebuild without changing stats",
        () => {
          const store =
            useMatchStore.getState();
          store.removeQueuedCourt(1);
          store.addQueuedCourt();
          assignQueue(4, [
            "player-27",
            "player-28",
            "player-29",
            "player-30",
          ]);
        }
      );
      assert.equal(
        canonical.queuedCourts.length,
        4
      );
      clients = syncClients(
        previous,
        canonical,
        clients,
        `${sourceRole} after queue delete rebuild`,
        sourceRole
      );

      previous = canonical;
      canonical = operate(
        canonical,
        "move queued court 4 to the first promotion slot",
        () => {
          const store =
            useMatchStore.getState();
          store.moveQueuedCourt(4, -1);
          store.moveQueuedCourt(3, -1);
          store.moveQueuedCourt(2, -1);
        }
      );
      assert.deepEqual(
        playerIds(
          canonical.queuedCourts[0]
        ),
        [
          "player-27",
          "player-28",
          "player-29",
          "player-30",
        ]
      );
      clients = syncClients(
        previous,
        canonical,
        clients,
        `${sourceRole} after queue reorder`,
        sourceRole
      );

      previous = canonical;
      canonical = operate(
        canonical,
        "replace currently playing player inside queued court without touching game court stats",
        () =>
          useMatchStore
            .getState()
            .replaceCourtPlayer(
              2,
              "player-09",
              "player-31",
              "QUEUE"
            )
      );
      assert.equal(
        canonical.courts
          .flatMap(playerIds)
          .includes("player-09"),
        true
      );
      clients = syncClients(
        previous,
        canonical,
        clients,
        `${sourceRole} after queued replacement`,
        sourceRole
      );

      previous = canonical;
      canonical = operate(
        canonical,
        "swap game court assignments without changing any match count",
        () =>
          useMatchStore
            .getState()
            .swapGameCourts(1, 3)
      );
      clients = syncClients(
        previous,
        canonical,
        clients,
        `${sourceRole} after game court swap`,
        sourceRole
      );

      previous = canonical;
      const finishers =
        idsFromCourt(
          canonical,
          1
        );
      canonical = operate(
        canonical,
        "finish swapped court and promote first visible queued court",
        () =>
          useMatchStore
            .getState()
            .finishCourtMatch(1),
        finishers
      );
      assert.deepEqual(
        playerIds(
          canonical.courts[0]
        ),
        [
          "player-27",
          "player-28",
          "player-29",
          "player-30",
        ]
      );
      clients = syncClients(
        previous,
        canonical,
        clients,
        `${sourceRole} after finish swapped court`,
        sourceRole
      );
  }

  run(
    "MASTER can operate queued courts and game court swaps with all clients converged",
    () => runManagerQueueWorkflow("MASTER")
  );

  run(
    "ADMIN can operate queued courts and game court swaps with all clients converged",
    () => runManagerQueueWorkflow("ADMIN")
  );

  run(
    "random black-box operations with 3 game courts and up to 4 queued courts keep all clients converged",
    () => {
      resetStore(40, 3);
      assignGame(1, [
        "player-01",
        "player-02",
        "player-03",
        "player-04",
      ]);
      assignGame(2, [
        "player-05",
        "player-06",
        "player-07",
        "player-08",
      ]);
      assignGame(3, [
        "player-09",
        "player-10",
        "player-11",
        "player-12",
      ]);
      Array.from({
        length: 2,
      }).forEach(() =>
        useMatchStore
          .getState()
          .addQueuedCourt()
      );
      assignQueue(1, [
        "player-13",
        "player-14",
        "player-15",
        "player-16",
      ]);
      assignQueue(2, [
        "player-17",
        "player-18",
        "player-19",
        "player-20",
      ]);

      let canonical =
        snapshot();
      let clients = [
        structuredClone(
          canonical
        ),
        structuredClone(
          canonical
        ),
        structuredClone(
          canonical
        ),
        structuredClone(
          canonical
        ),
      ];
      let seed = 73129;
      const random = () => {
        seed =
          (seed * 48271) %
          0x7fffffff;
        return (
          seed / 0x7fffffff
        );
      };

      const choose = (items) =>
        items[
          Math.floor(
            random() * items.length
          )
        ];

      for (
        let step = 0;
        step < 220;
        step += 1
      ) {
        const previous =
          canonical;
        const op = Math.floor(
          random() * 9
        );
        const playingCourts =
          canonical.courts.filter(
            (court) =>
              court.status ===
              "PLAYING"
          );
        const occupiedQueues =
          canonical.queuedCourts.filter(
            (court) =>
              court.teamA &&
              court.teamB
          );
        const waitingIds =
          canonical.players
            .filter(
              (player) =>
                player.status ===
                  "WAITING" &&
                player.isPresent
            )
            .map(
              (player) =>
                player.id
            );
        const queueIds =
          canonical.queuedCourts.flatMap(
            playerIds
          );
        const availableWaiting =
          waitingIds.filter(
            (id) =>
              !queueIds.includes(id)
          );

        let allowed =
          new Set();
        let label =
          `random step ${step}`;

        canonical = operate(
          canonical,
          label,
          () => {
            const store =
              useMatchStore.getState();

            if (
              op === 0 &&
              store.queuedCourts
                .length < 4
            ) {
              store.addQueuedCourt();
              return;
            }

            if (
              op === 1 &&
              store.queuedCourts
                .length > 0
            ) {
              store.removeQueuedCourt(
                choose(
                  store.queuedCourts
                ).id
              );
              return;
            }

            if (
              op === 2 &&
              store.queuedCourts
                .length > 1
            ) {
              const court =
                choose(
                  store.queuedCourts
                );
              store.moveQueuedCourt(
                court.id,
                random() > 0.5
                  ? 1
                  : -1
              );
              return;
            }

            if (
              op === 3 &&
              store.queuedCourts
                .length > 0 &&
              availableWaiting
                .length >= 4
            ) {
              const emptyQueue =
                store.queuedCourts.find(
                  (court) =>
                    !court.teamA ||
                    !court.teamB
                ) ??
                choose(
                  store.queuedCourts
                );
              const ids =
                availableWaiting.slice(
                  0,
                  4
                );
              store.assignManualMatch(
                emptyQueue.id,
                [ids[0], ids[1]],
                [ids[2], ids[3]],
                "QUEUE"
              );
              return;
            }

            if (
              op === 4 &&
              occupiedQueues.length > 0 &&
              availableWaiting
                .length > 0
            ) {
              const court =
                choose(
                  occupiedQueues
                );
              const outgoing =
                choose(
                  playerIds(court)
                );
              store.replaceCourtPlayer(
                court.id,
                outgoing,
                availableWaiting[0],
                "QUEUE"
              );
              return;
            }

            if (
              op === 5 &&
              occupiedQueues.length > 0
            ) {
              const court =
                choose(
                  occupiedQueues
                );
              const ids =
                playerIds(court);
              store.swapCourtPlayers(
                court.id,
                ids[0],
                ids[3],
                "QUEUE"
              );
              return;
            }

            if (
              op === 6 &&
              playingCourts.length > 0
            ) {
              const court =
                choose(
                  playingCourts
                );
              idsFromCourt(
                canonical,
                court.id
              ).forEach((id) =>
                allowed.add(id)
              );
              store.finishCourtMatch(
                court.id
              );
              return;
            }

            if (
              op === 7 &&
              store.courts.length >
                1
            ) {
              const first =
                choose(
                  store.courts
                );
              const second =
                choose(
                  store.courts.filter(
                    (court) =>
                      court.id !==
                      first.id
                  )
                );
              store.swapGameCourts(
                first.id,
                second.id
              );
              return;
            }

            if (
              op === 8 &&
              store.queuedCourts
                .length > 0
            ) {
              const court =
                choose(
                  store.queuedCourts
                );
              store.rerollRecommendations(
                court.id,
                "QUEUE"
              );
              if (
                store
                  .recommendations
                  .length > 0
              ) {
                store.selectRecommendation(
                  store
                    .recommendations[0]
                    .id
                );
                store.approveRecommendation(
                  "QUEUE"
                );
              }
            }
          },
          allowed
        );

        if (step % 7 === 0) {
          const stale =
            structuredClone(
              previous
            );
          clients = clients.map(
            (client, index) =>
              index % 2 === 0
                ? mergeLiveStateSnapshot(
                    client,
                    stale,
                    "ADMIN"
                  )
                : client
          );
        }

        clients = syncClients(
          previous,
          canonical,
          clients,
          label
        );
      }
    }
  );

  console.log(
    `queue-court SQA black-box simulation: PASS (${results.length} scenario groups)`
  );
  for (const result of results) {
    console.log(
      `- ${result.scenario}: ${result.duration.toFixed(1)}ms`
    );
  }
} finally {
  await server.close();
}
