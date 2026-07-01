import type { AccessRole } from "@/auth/access";
import type {
  MatchStore,
} from "@/store/useMatchStore";
import {
  normalizePersistedMatchState,
} from "../store/persistedState.ts";

export type LiveStateSnapshot = Pick<
  MatchStore,
  | "players"
  | "courts"
  | "queuedCourts"
  | "fixedPartnerRequests"
  | "fixedPartnerAssignments"
  | "fixedPartnerRequestResolutions"
  | "notifications"
  | "dismissedNotificationIds"
  | "matchHistory"
  | "workoutReportEvents"
  | "workoutReportSnapshots"
  | "womenDoublesPriority"
  | "excludedMatchPairs"
>;

export type LiveStateKey =
  keyof LiveStateSnapshot;

export type LiveStateEntityKey =
  | "players"
  | "courts"
  | "queuedCourts"
  | "fixedPartnerRequests"
  | "fixedPartnerAssignments"
  | "fixedPartnerRequestResolutions"
  | "notifications"
  | "matchHistory"
  | "workoutReportEvents"
  | "workoutReportSnapshots";

export interface LiveStatePatch {
  changedKeys: LiveStateKey[];
  changedEntityIds?: Partial<
    Record<
      LiveStateEntityKey,
      Array<string | number>
    >
  >;
  removedEntityIds?: Partial<
    Record<
      LiveStateEntityKey,
      Array<string | number>
    >
  >;
  addedExcludedPairKeys?: string[];
  removedExcludedPairKeys?: string[];
}

export function getSnapshotResponseDelay(
  role: AccessRole,
  clientId: string
) {
  const hash =
    Array.from(clientId).reduce(
      (total, character) =>
        (
          total * 31 +
          character.charCodeAt(0)
        ) %
        300,
      0
    );

  return (
    (role === "MASTER"
      ? 0
      : 500) + hash
  );
}

function excludedPairKey(
  pair: [string, string]
) {
  return [...pair]
    .sort()
    .join("|");
}

export function createLiveStateSnapshot(
  state: MatchStore
): LiveStateSnapshot {
  return {
    players: state.players,
    courts: state.courts,
    queuedCourts:
      state.queuedCourts,
    fixedPartnerRequests:
      state.fixedPartnerRequests,
    fixedPartnerAssignments:
      state.fixedPartnerAssignments,
    fixedPartnerRequestResolutions:
      state.fixedPartnerRequestResolutions,
    notifications:
      state.notifications,
    dismissedNotificationIds:
      state.dismissedNotificationIds,
    matchHistory:
      state.matchHistory,
    workoutReportEvents:
      state.workoutReportEvents,
    workoutReportSnapshots:
      state.workoutReportSnapshots,
    womenDoublesPriority:
      state.womenDoublesPriority,
    excludedMatchPairs:
      state.excludedMatchPairs,
  };
}

function normalizeLiveStateSnapshot(
  snapshot: LiveStateSnapshot
): LiveStateSnapshot {
  const normalized =
    normalizePersistedMatchState(
      snapshot
    );
  const removeUndefinedOptionalDates = <
    T extends Record<string, unknown>,
  >(
    item: T
  ) => {
    const next = { ...item };

    ["lastMatchAt"].forEach((key) => {
      if (next[key] === undefined) {
        delete next[key];
      }
    });

    return next as T;
  };
  const normalizeCourtPlayers = (
    players: unknown
  ) =>
    Array.isArray(players)
      ? players.map((player) =>
          removeUndefinedOptionalDates(
            player as unknown as Record<
              string,
              unknown
            >
          )
        )
      : players;
  const normalizedSnapshot = {
    ...snapshot,
    ...normalized,
  } as LiveStateSnapshot;

  normalizedSnapshot.players =
    normalizedSnapshot.players.map(
      (player) =>
        removeUndefinedOptionalDates(
          player as unknown as Record<
            string,
            unknown
          >
        ) as unknown as typeof player
    );
  normalizedSnapshot.courts =
    normalizedSnapshot.courts.map(
      (court) => ({
        ...court,
        teamA:
          normalizeCourtPlayers(
            court.teamA
          ) as typeof court.teamA,
        teamB:
          normalizeCourtPlayers(
            court.teamB
          ) as typeof court.teamB,
      })
    );
  normalizedSnapshot.queuedCourts =
    normalizedSnapshot.queuedCourts.map(
      (court) => ({
        ...court,
        teamA:
          normalizeCourtPlayers(
            court.teamA
          ) as typeof court.teamA,
        teamB:
          normalizeCourtPlayers(
            court.teamB
          ) as typeof court.teamB,
      })
    );
  normalizedSnapshot.notifications =
    filterDismissedNotifications(
      normalizedSnapshot.notifications,
      normalizedSnapshot.dismissedNotificationIds
    );

  return normalizedSnapshot;
}

const liveStateKeys: LiveStateKey[] =
  [
    "players",
    "courts",
    "queuedCourts",
    "fixedPartnerRequests",
    "fixedPartnerAssignments",
    "fixedPartnerRequestResolutions",
    "notifications",
    "dismissedNotificationIds",
    "matchHistory",
    "workoutReportEvents",
    "workoutReportSnapshots",
    "womenDoublesPriority",
    "excludedMatchPairs",
  ];

const entityKeys:
  LiveStateEntityKey[] = [
    "players",
    "courts",
    "queuedCourts",
    "fixedPartnerRequests",
    "fixedPartnerAssignments",
    "fixedPartnerRequestResolutions",
    "notifications",
    "matchHistory",
    "workoutReportEvents",
    "workoutReportSnapshots",
  ];

export function createLiveStatePatch(
  previous: LiveStateSnapshot,
  next: LiveStateSnapshot
): LiveStatePatch {
  const changedKeys =
    liveStateKeys.filter(
      (key) =>
        previous[key] !== next[key]
    );
  const changedEntityIds:
    LiveStatePatch["changedEntityIds"] =
      {};
  const removedEntityIds:
    LiveStatePatch["removedEntityIds"] =
      {};

  entityKeys.forEach((key) => {
    if (
      !changedKeys.includes(key)
    ) {
      return;
    }

    const previousItems =
      previous[key] as Array<{
        id: string | number;
      }>;
    const nextItems =
      next[key] as Array<{
        id: string | number;
      }>;
    const previousById =
      new Map(
        previousItems.map(
          (item) => [
            item.id,
            item,
          ]
        )
      );
    const nextIds =
      new Set(
        nextItems.map(
          (item) => item.id
        )
      );

    changedEntityIds[key] =
      nextItems
        .filter(
          (item) =>
            previousById.get(
              item.id
            ) !== item
        )
        .map((item) => item.id);
    removedEntityIds[key] =
      previousItems
        .filter(
          (item) =>
            !nextIds.has(item.id)
        )
        .map((item) => item.id);
  });

  const previousExcludedKeys =
    new Set(
      previous.excludedMatchPairs.map(
        excludedPairKey
      )
    );
  const nextExcludedKeys =
    new Set(
      next.excludedMatchPairs.map(
        excludedPairKey
      )
    );

  return {
    changedKeys,
    changedEntityIds,
    removedEntityIds,
    addedExcludedPairKeys:
      next.excludedMatchPairs
        .map(excludedPairKey)
        .filter(
          (key) =>
            !previousExcludedKeys.has(
              key
            )
        ),
    removedExcludedPairKeys:
      previous.excludedMatchPairs
        .map(excludedPairKey)
        .filter(
          (key) =>
            !nextExcludedKeys.has(key)
        ),
  };
}

function mergeById<
  T extends {
    id: string | number;
  },
>(
  current: T[],
  incoming: T[],
  mergeExisting = false
) {
  const merged = new Map(
    current.map((item) => [
      item.id,
      item,
    ])
  );

  incoming.forEach((item) => {
    const existing =
      merged.get(item.id);

    merged.set(
      item.id,
      mergeExisting && existing
        ? {
            ...existing,
            ...item,
          }
        : item
    );
  });

  return Array.from(
    merged.values()
  );
}

function filterDismissedNotifications(
  notifications:
    LiveStateSnapshot["notifications"],
  dismissedNotificationIds:
    LiveStateSnapshot["dismissedNotificationIds"]
) {
  const dismissed = new Set(
    dismissedNotificationIds
  );

  return notifications.filter(
    (notification) =>
      !dismissed.has(notification.id)
  );
}

function hasActiveCourtAssignment(
  court: LiveStateSnapshot["courts"][number]
) {
  return (
    court.status === "PLAYING" &&
    Boolean(court.teamA?.length) &&
    Boolean(court.teamB?.length)
  );
}

function courtPlayerKey(
  court:
    | LiveStateSnapshot["courts"][number]
    | undefined
) {
  if (
    !court?.teamA ||
    !court.teamB
  ) {
    return "";
  }

  return [
    ...court.teamA,
    ...court.teamB,
  ]
    .map((player) => player.id)
    .sort()
    .join("|");
}

function emptyCourtLike<
  T extends LiveStateSnapshot["courts"][number],
>(court: T): T {
  return {
    ...court,
    status: "EMPTY",
    teamA: null,
    teamB: null,
    startedAt: null,
  } as T;
}

function reconcileQueuedCourts(
  courts: LiveStateSnapshot["courts"],
  queuedCourts: LiveStateSnapshot["queuedCourts"]
) {
  const activeCourtKeys =
    new Set(
      courts
        .filter(hasActiveCourtAssignment)
        .map(courtPlayerKey)
        .filter(Boolean)
    );

  return queuedCourts
    .map((court) => {
      const queuedKey =
        courtPlayerKey(court);

      return queuedKey &&
        activeCourtKeys.has(queuedKey)
        ? emptyCourtLike(court)
        : court;
    })
    .sort((a, b) => a.id - b.id);
}

function getOldestQueuedCourt(
  queuedCourts: LiveStateSnapshot["queuedCourts"]
) {
  return queuedCourts
    .filter(
      (court) =>
        court.teamA &&
        court.teamB
    )
    .sort((a, b) => {
      const aCreatedAt =
        a.startedAt
          ? new Date(
              a.startedAt
            ).getTime()
          : 0;
      const bCreatedAt =
        b.startedAt
          ? new Date(
              b.startedAt
            ).getTime()
          : 0;

      if (
        aCreatedAt !== bCreatedAt
      ) {
        return (
          aCreatedAt -
          bCreatedAt
        );
      }

      return a.id - b.id;
    })[0];
}

function getLatestEndedAtForCourt(
  histories: LiveStateSnapshot["matchHistory"],
  courtId: number
) {
  return histories
    .filter(
      (history) =>
        history.courtId === courtId
    )
    .sort(
      (a, b) =>
        new Date(
          b.endedAt
        ).getTime() -
        new Date(
          a.endedAt
        ).getTime()
    )[0]?.endedAt;
}

function promoteQueuedCourtsAfterStaleFinish(
  snapshot: LiveStateSnapshot,
  current: LiveStateSnapshot,
  incoming: LiveStateSnapshot,
  patch: LiveStatePatch
) {
  const changedCourtIds =
    patch.changedEntityIds?.courts ??
    [];

  if (
    changedCourtIds.length === 0 ||
    patch.changedKeys.includes(
      "queuedCourts"
    )
  ) {
    return snapshot;
  }

  const currentCourtById =
    new Map(
      current.courts.map(
        (court) => [
          court.id,
          court,
        ]
      )
    );
  const incomingCourtById =
    new Map(
      incoming.courts.map(
        (court) => [
          court.id,
          court,
        ]
      )
    );

  let players =
    snapshot.players;
  let courts =
    snapshot.courts;
  let queuedCourts =
    snapshot.queuedCourts;
  let changed = false;

  changedCourtIds
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((courtId) => {
      const currentCourt =
        currentCourtById.get(courtId);
      const incomingCourt =
        incomingCourtById.get(courtId);
      const mergedCourt =
        courts.find(
          (court) =>
            court.id === courtId
        );

      if (
        !currentCourt?.teamA ||
        !currentCourt.teamB ||
        incomingCourt?.teamA ||
        incomingCourt?.teamB ||
        mergedCourt?.teamA ||
        mergedCourt?.teamB
      ) {
        return;
      }

      const queuedCourt =
        getOldestQueuedCourt(
          queuedCourts
        );

      if (
        !queuedCourt?.teamA ||
        !queuedCourt.teamB
      ) {
        return;
      }

      const promotedAt =
        new Date(
          getLatestEndedAtForCourt(
            incoming.matchHistory,
            courtId
          ) ?? new Date()
        );
      const promotedIds =
        new Set(
          [
            ...queuedCourt.teamA,
            ...queuedCourt.teamB,
          ].map((player) => player.id)
        );

      players = players.map(
        (player) =>
          promotedIds.has(player.id)
            ? {
                ...player,
                status:
                  "PLAYING" as const,
                playingStartedAt:
                  promotedAt,
              }
            : player
      );

      const playerById =
        new Map(
          players.map((player) => [
            player.id,
            player,
          ])
        );

      courts = courts.map((court) =>
        court.id === courtId
          ? {
              ...court,
              status:
                "PLAYING" as const,
              teamA:
                queuedCourt.teamA!.map(
                  (player) =>
                    playerById.get(
                      player.id
                    ) ?? player
                ) as typeof queuedCourt.teamA,
              teamB:
                queuedCourt.teamB!.map(
                  (player) =>
                    playerById.get(
                      player.id
                    ) ?? player
                ) as typeof queuedCourt.teamB,
              startedAt:
                promotedAt,
            }
          : court
      );

      queuedCourts =
        queuedCourts.map((court) =>
          court.id === queuedCourt.id
            ? emptyCourtLike(court)
            : court
        );
      changed = true;
    });

  return changed
    ? {
        ...snapshot,
        players,
        courts,
        queuedCourts:
          reconcileQueuedCourts(
            courts,
            queuedCourts
          ),
      }
    : snapshot;
}

function hasFinishedMatchForCourt(
  histories: LiveStateSnapshot["matchHistory"],
  court: LiveStateSnapshot["courts"][number]
) {
  if (
    !court.teamA ||
    !court.teamB
  ) {
    return false;
  }

  const teamAIds = court.teamA
    .map((player) => player.id)
    .sort()
    .join(",");
  const teamBIds = court.teamB
    .map((player) => player.id)
    .sort()
    .join(",");
  const startedAt =
    new Date(
      court.startedAt ?? 0
    ).getTime();

  return histories.some((history) => {
    const historyTeamA =
      [...history.teamA]
        .sort()
        .join(",");
    const historyTeamB =
      [...history.teamB]
        .sort()
        .join(",");
    const sameTeams =
      (historyTeamA === teamAIds &&
        historyTeamB === teamBIds) ||
      (historyTeamA === teamBIds &&
        historyTeamB === teamAIds);

    return (
      history.courtId === court.id &&
      sameTeams &&
      new Date(
        history.startedAt
      ).getTime() === startedAt
    );
  });
}

function mergeBootstrapCourt(
  current:
    | LiveStateSnapshot["courts"][number]
    | undefined,
  incoming:
    | LiveStateSnapshot["courts"][number]
    | undefined,
  currentHistory:
    LiveStateSnapshot["matchHistory"],
  incomingHistory:
    LiveStateSnapshot["matchHistory"]
) {
  if (!current) {
    return incoming;
  }

  if (!incoming) {
    return current;
  }

  const currentActive =
    hasActiveCourtAssignment(current);
  const incomingActive =
    hasActiveCourtAssignment(incoming);

  if (
    incomingActive &&
    !currentActive
  ) {
    if (
      hasFinishedMatchForCourt(
        currentHistory,
        incoming
      )
    ) {
      return current;
    }

    return incoming;
  }

  if (
    currentActive &&
    !incomingActive
  ) {
    if (
      hasFinishedMatchForCourt(
        incomingHistory,
        current
      )
    ) {
      return incoming;
    }

    return current;
  }

  if (
    incomingActive &&
    currentActive
  ) {
    if (
      hasFinishedMatchForCourt(
        currentHistory,
        incoming
      )
    ) {
      return current;
    }

    if (
      hasFinishedMatchForCourt(
        incomingHistory,
        current
      )
    ) {
      return incoming;
    }

    const currentStartedAt =
      new Date(
        current.startedAt ?? 0
      ).getTime();
    const incomingStartedAt =
      new Date(
        incoming.startedAt ?? 0
      ).getTime();

    return incomingStartedAt >=
      currentStartedAt
      ? incoming
      : current;
  }

  return incoming;
}

function mergeChangedEntities<
  T extends {
    id: string | number;
  },
>(
  current: T[],
  incoming: T[],
  changedIds:
    | Array<string | number>
    | undefined,
  removedIds:
    | Array<string | number>
    | undefined
) {
  const changed =
    new Set(changedIds ?? []);
  const removed =
    new Set(removedIds ?? []);
  const merged = new Map(
    current
      .filter(
        (item) =>
          !removed.has(item.id)
      )
      .map((item) => [
        item.id,
        item,
      ])
  );

  incoming.forEach((item) => {
    if (changed.has(item.id)) {
      merged.set(item.id, item);
    }
  });

  return Array.from(
    merged.values()
  );
}

function mergeChangedCourts(
  current: LiveStateSnapshot["courts"],
  incoming: LiveStateSnapshot["courts"],
  changedIds:
    | Array<string | number>
    | undefined,
  removedIds:
    | Array<string | number>
    | undefined,
  currentHistory:
    LiveStateSnapshot["matchHistory"],
  incomingHistory:
    LiveStateSnapshot["matchHistory"]
) {
  const changed =
    new Set(
      (changedIds ?? []).map(String)
    );
  const removed =
    new Set(
      (removedIds ?? []).map(String)
    );
  const incomingById = new Map(
    incoming.map((court) => [
      String(court.id),
      court,
    ])
  );
  const merged = new Map(
    current
      .filter(
        (court) =>
          !removed.has(
            String(court.id)
          )
      )
      .map((court) => [
        String(court.id),
        court,
      ])
  );

  incoming.forEach((court) => {
    if (
      !changed.has(String(court.id))
    ) {
      return;
    }

    const nextCourt =
      mergeBootstrapCourt(
        merged.get(
          String(court.id)
        ),
        court,
        currentHistory,
        incomingHistory
      );

    if (nextCourt) {
      merged.set(
        String(court.id),
        nextCourt
      );
    }
  });

  changed.forEach((courtId) => {
    if (merged.has(courtId)) {
      return;
    }

    const incomingCourt =
      incomingById.get(courtId);

    if (incomingCourt) {
      merged.set(
        String(incomingCourt.id),
        incomingCourt
      );
    }
  });

  return Array.from(
    merged.values()
  ).sort((a, b) => a.id - b.id);
}

function dedupeNotifications(
  notifications:
    LiveStateSnapshot["notifications"]
) {
  const seen = new Map<
    string,
    (typeof notifications)[number]
  >();

  notifications
    .slice()
    .sort(
      (a, b) =>
        new Date(
          a.createdAt
        ).getTime() -
        new Date(
          b.createdAt
        ).getTime()
    )
    .forEach((notification) => {
      const minuteBucket =
        Math.floor(
          new Date(
            notification.createdAt
          ).getTime() /
            60_000
        );
      const key = [
        notification.audience,
        notification.recipientId ??
          "",
        notification.message,
        minuteBucket,
      ].join("|");

      if (!seen.has(key)) {
        seen.set(
          key,
          notification
        );
      }
    });

  return Array.from(
    seen.values()
  );
}

function dedupeFixedPartnerRequests(
  requests:
    LiveStateSnapshot["fixedPartnerRequests"]
) {
  const seen = new Map<
    string,
    (typeof requests)[number]
  >();

  requests.forEach((request) => {
    const pairKey = [
      request.requesterId,
      request.partnerId,
    ]
      .sort()
      .join("|");

    if (!seen.has(pairKey)) {
      seen.set(pairKey, request);
    }
  });

  return Array.from(
    seen.values()
  );
}

function reconcileFixedPartnerAssignments(
  assignments:
    LiveStateSnapshot["fixedPartnerAssignments"]
) {
  const usedPlayerIds =
    new Set<string>();

  return assignments
    .slice()
    .sort(
      (a, b) =>
        new Date(
          a.approvedAt
        ).getTime() -
          new Date(
            b.approvedAt
          ).getTime() ||
        a.id.localeCompare(b.id)
    )
    .filter((assignment) => {
      if (
        usedPlayerIds.has(
          assignment.playerAId
        ) ||
        usedPlayerIds.has(
          assignment.playerBId
        )
      ) {
        return false;
      }

      usedPlayerIds.add(
        assignment.playerAId
      );
      usedPlayerIds.add(
        assignment.playerBId
      );
      return true;
    });
}

function filterResolvedPartnerRequests(
  snapshot: LiveStateSnapshot
) {
  const resolvedIds =
    new Set(
      snapshot.fixedPartnerRequestResolutions.map(
        (resolution) =>
          resolution.requestId
      )
    );
  const assignedPlayerIds =
    new Set(
      snapshot.fixedPartnerAssignments.flatMap(
        (assignment) => [
          assignment.playerAId,
          assignment.playerBId,
        ]
      )
    );

  return {
    ...snapshot,
    fixedPartnerRequests:
      snapshot.fixedPartnerRequests.filter(
        (request) =>
          !resolvedIds.has(
            request.id
          ) &&
          !assignedPlayerIds.has(
            request.requesterId
          ) &&
          !assignedPlayerIds.has(
            request.partnerId
          )
      ),
  };
}

function applyFixedPartners(
  snapshot: LiveStateSnapshot
) {
  const partnerByPlayer =
    new Map<string, string>();

  snapshot.fixedPartnerAssignments.forEach(
    (assignment) => {
      partnerByPlayer.set(
        assignment.playerAId,
        assignment.playerBId
      );
      partnerByPlayer.set(
        assignment.playerBId,
        assignment.playerAId
      );
    }
  );

  return {
    ...snapshot,
    players:
      snapshot.players.map(
        (player) => ({
          ...player,
          fixedPartner:
            partnerByPlayer.get(
              player.id
            ),
        })
      ),
  };
}

function mergeBootstrapSnapshots(
  current: LiveStateSnapshot,
  incoming: LiveStateSnapshot
) {
  const currentHasLiveState =
    current.players.length > 0 ||
    current.courts.length > 0 ||
    current.queuedCourts.length > 0 ||
    current.fixedPartnerRequests
      .length > 0 ||
    current.fixedPartnerAssignments
      .length > 0 ||
    current.matchHistory.length > 0 ||
    current.excludedMatchPairs.length >
      0;

  if (!currentHasLiveState) {
    return incoming;
  }

  const courtById =
    new Map(
      current.courts.map(
        (court) => [
          court.id,
          court,
        ]
      )
    );

  incoming.courts.forEach(
    (incomingCourt) => {
      courtById.set(
        incomingCourt.id,
        mergeBootstrapCourt(
          courtById.get(
            incomingCourt.id
          ),
          incomingCourt,
          current.matchHistory,
          incoming.matchHistory
        )!
      );
    }
  );
  const courts = Array.from(
    courtById.values()
  ).sort((a, b) => a.id - b.id);

  const incomingQueuedCourtIds =
    new Set(
      incoming.queuedCourts.map(
        (court) => court.id
      )
    );
  const baseQueuedCourts =
    incoming.queuedCourts.length <
    current.queuedCourts.length
      ? current.queuedCourts.filter(
          (court) =>
            incomingQueuedCourtIds.has(
              court.id
            )
        )
      : current.queuedCourts;
  const baseQueuedCourtIds =
    new Set(
      baseQueuedCourts.map(
        (court) => court.id
      )
    );
  const incomingQueuedCourtsToMerge =
    incoming.queuedCourts.filter(
      (court) =>
        baseQueuedCourtIds.has(
          court.id
        ) ||
        Boolean(
          court.teamA?.length &&
            court.teamB?.length
        )
    );
  const queuedCourts =
    reconcileQueuedCourts(
      courts,
      mergeById(
        baseQueuedCourts,
        incomingQueuedCourtsToMerge
      )
    );

  const excludedPairs =
    new Map(
      current.excludedMatchPairs.map(
        (pair) => [
          excludedPairKey(pair),
          pair,
        ]
      )
    );

  incoming.excludedMatchPairs.forEach(
    (pair) =>
      excludedPairs.set(
        excludedPairKey(pair),
        pair
      )
  );

  return {
    ...current,
    players: mergeById(
      current.players,
      incoming.players
    ),
    courts,
    queuedCourts,
    fixedPartnerRequests:
      dedupeFixedPartnerRequests(
        mergeById(
          incoming.fixedPartnerRequests,
          current.fixedPartnerRequests
        )
      ),
    fixedPartnerAssignments:
      reconcileFixedPartnerAssignments(
        mergeById(
          incoming.fixedPartnerAssignments,
          current.fixedPartnerAssignments
        )
      ),
    fixedPartnerRequestResolutions:
      mergeById(
        incoming.fixedPartnerRequestResolutions,
        current.fixedPartnerRequestResolutions
      ),
    dismissedNotificationIds:
      Array.from(
        new Set([
          ...incoming.dismissedNotificationIds,
          ...current.dismissedNotificationIds,
        ])
      ),
    notifications:
      filterDismissedNotifications(
        dedupeNotifications(
          mergeById(
            incoming.notifications,
            current.notifications
          )
        ),
        [
          ...incoming.dismissedNotificationIds,
          ...current.dismissedNotificationIds,
        ]
      ),
    matchHistory:
      dedupeMatchHistory(
        mergeById(
          incoming.matchHistory,
          current.matchHistory,
          true
        )
      ),
    workoutReportEvents:
      mergeById(
        incoming.workoutReportEvents,
        current.workoutReportEvents,
        true
      ),
    workoutReportSnapshots:
      mergeById(
        incoming.workoutReportSnapshots,
        current.workoutReportSnapshots,
        true
      ),
    womenDoublesPriority:
      current.womenDoublesPriority ||
      incoming.womenDoublesPriority,
    excludedMatchPairs:
      Array.from(
        excludedPairs.values()
      ),
  };
}

function dedupeMatchHistory(
  histories:
    LiveStateSnapshot["matchHistory"]
) {
  const seen = new Map<
    string,
    (typeof histories)[number]
  >();

  histories.forEach((history) => {
    const key = [
      history.courtId,
      new Date(
        history.startedAt
      ).getTime(),
      [...history.teamA]
        .sort()
        .join(","),
      [...history.teamB]
        .sort()
        .join(","),
    ].join("|");
    const existing =
      seen.get(key);

    seen.set(
      key,
      existing
        ? {
            ...existing,
            ...history,
            playerNames: {
              ...existing.playerNames,
              ...history.playerNames,
            },
          }
        : history
    );
  });

  return Array.from(
    seen.values()
  );
}

function reconcilePlayingPlayers(
  snapshot: LiveStateSnapshot
) {
  const claimedPlayerIds =
    new Set<string>();
  const acceptedCourtIds =
    new Set<number>();

  snapshot.courts
    .filter(
      (court) =>
        court.status ===
          "PLAYING" &&
        court.teamA &&
        court.teamB
    )
    .slice()
    .sort((a, b) => {
      const startedDifference =
        new Date(
          a.startedAt ?? 0
        ).getTime() -
        new Date(
          b.startedAt ?? 0
        ).getTime();

      return (
        startedDifference ||
        a.id - b.id
      );
    })
    .forEach((court) => {
      const playerIds = [
        ...(court.teamA ?? []),
        ...(court.teamB ?? []),
      ].map(
        (player) => player.id
      );
      const validAssignment =
        playerIds.length === 4 &&
        new Set(playerIds).size ===
          4 &&
        playerIds.every(
          (playerId) =>
            !claimedPlayerIds.has(
              playerId
            )
        );

      if (!validAssignment) {
        return;
      }

      acceptedCourtIds.add(
        court.id
      );
      playerIds.forEach(
        (playerId) =>
          claimedPlayerIds.add(
            playerId
          )
      );
    });

  const courts =
    snapshot.courts.map(
      (court) =>
        court.status ===
          "PLAYING" &&
        !acceptedCourtIds.has(
          court.id
        )
          ? {
              ...court,
              status:
                "EMPTY" as const,
              teamA: null,
              teamB: null,
              startedAt: null,
            }
          : court
    );
  const playingIds =
    new Set(
      courts.flatMap(
        (court) =>
          court.status ===
            "PLAYING"
            ? [
                ...(court.teamA ??
                  []),
                ...(court.teamB ??
                  []),
              ].map(
                (player) =>
                  player.id
              )
            : []
      )
    );

  return {
    ...snapshot,
    courts,
    players:
      snapshot.players.map(
        (player) => {
          if (
            playingIds.has(
              player.id
            )
          ) {
            return player.status ===
              "PLAYING"
              ? player
              : {
                  ...player,
                  status:
                    "PLAYING" as const,
                  waitingStartedAt:
                    undefined,
                  playingStartedAt:
                    player.playingStartedAt ??
                    new Date(),
                };
          }

          if (
            player.status ===
            "PLAYING"
          ) {
            return {
              ...player,
              status:
                "WAITING" as const,
              playingStartedAt:
                undefined,
              waitingStartedAt:
                player.waitingStartedAt ??
                new Date(),
            };
          }

          return player;
        }
      ),
  };
}

export function mergeLiveStateSnapshot(
  current: LiveStateSnapshot,
  incoming: LiveStateSnapshot,
  sourceRole: AccessRole,
  sourceUserId?: string,
  patch?: LiveStatePatch
): LiveStateSnapshot {
  current =
    normalizeLiveStateSnapshot(
      current
    );
  incoming =
    normalizeLiveStateSnapshot(
      incoming
    );

  if (
    sourceRole === "ADMIN" ||
    sourceRole === "MASTER"
  ) {
    if (!patch) {
      return filterResolvedPartnerRequests(
        applyFixedPartners(
          reconcilePlayingPlayers(
            mergeBootstrapSnapshots(
              current,
              incoming
            )
          )
        )
      );
    }

    const changed =
      new Set(
        patch.changedKeys
      );
    const next = {
      ...current,
    };

    if (changed.has("players")) {
      next.players =
        mergeChangedEntities(
          current.players,
          incoming.players,
          patch.changedEntityIds
            ?.players,
          patch.removedEntityIds
            ?.players
        );
    }

    if (changed.has("courts")) {
      next.courts =
        mergeChangedCourts(
          current.courts,
          incoming.courts,
          patch.changedEntityIds
            ?.courts,
          patch.removedEntityIds
            ?.courts,
          current.matchHistory,
          incoming.matchHistory
        );
    }

    if (changed.has("queuedCourts")) {
      next.queuedCourts =
        reconcileQueuedCourts(
          next.courts,
          mergeChangedEntities(
            current.queuedCourts,
            incoming.queuedCourts,
            patch.changedEntityIds
              ?.queuedCourts,
            patch.removedEntityIds
              ?.queuedCourts
          )
        );
    }

    if (
      changed.has(
        "fixedPartnerRequests"
      )
    ) {
      next.fixedPartnerRequests =
        dedupeFixedPartnerRequests(
          mergeChangedEntities(
            current.fixedPartnerRequests,
            incoming.fixedPartnerRequests,
            patch.changedEntityIds
              ?.fixedPartnerRequests,
            patch.removedEntityIds
              ?.fixedPartnerRequests
          )
      );
    }

    if (
      changed.has(
        "fixedPartnerAssignments"
      )
    ) {
      next.fixedPartnerAssignments =
        reconcileFixedPartnerAssignments(
          mergeChangedEntities(
            current.fixedPartnerAssignments,
            incoming.fixedPartnerAssignments,
            patch.changedEntityIds
              ?.fixedPartnerAssignments,
            patch.removedEntityIds
              ?.fixedPartnerAssignments
          )
      );
    }

    if (
      changed.has(
        "fixedPartnerRequestResolutions"
      )
    ) {
      next.fixedPartnerRequestResolutions =
        mergeChangedEntities(
          current.fixedPartnerRequestResolutions,
          incoming.fixedPartnerRequestResolutions,
          patch.changedEntityIds
            ?.fixedPartnerRequestResolutions,
          patch.removedEntityIds
            ?.fixedPartnerRequestResolutions
        );
    }

    if (
      changed.has(
        "dismissedNotificationIds"
      )
    ) {
      next.dismissedNotificationIds =
        Array.from(
          new Set([
            ...current.dismissedNotificationIds,
            ...incoming.dismissedNotificationIds,
          ])
        );
    }

    if (
      changed.has("notifications") ||
      changed.has(
        "dismissedNotificationIds"
      )
    ) {
      next.notifications =
        filterDismissedNotifications(
          dedupeNotifications(
            changed.has(
              "notifications"
            )
              ? mergeChangedEntities(
                  current.notifications,
                  incoming.notifications,
                  patch.changedEntityIds
                    ?.notifications,
                  patch.removedEntityIds
                    ?.notifications
                )
              : current.notifications
          ),
          next.dismissedNotificationIds
        );
    }

    if (
      changed.has("matchHistory")
    ) {
      next.matchHistory =
        dedupeMatchHistory(
          mergeChangedEntities(
            current.matchHistory,
            incoming.matchHistory,
            patch.changedEntityIds
              ?.matchHistory,
            patch.removedEntityIds
              ?.matchHistory
          )
        );
    }

    if (
      changed.has(
        "workoutReportEvents"
      )
    ) {
      next.workoutReportEvents =
        mergeChangedEntities(
          current.workoutReportEvents,
          incoming.workoutReportEvents,
          patch.changedEntityIds
            ?.workoutReportEvents,
          patch.removedEntityIds
            ?.workoutReportEvents
        );
    }

    if (
      changed.has(
        "workoutReportSnapshots"
      )
    ) {
      next.workoutReportSnapshots =
        mergeChangedEntities(
          current.workoutReportSnapshots,
          incoming.workoutReportSnapshots,
          patch.changedEntityIds
            ?.workoutReportSnapshots,
          patch.removedEntityIds
            ?.workoutReportSnapshots
        );
    }

    if (
      changed.has(
        "womenDoublesPriority"
      )
    ) {
      next.womenDoublesPriority =
        incoming.womenDoublesPriority;
    }

    if (
      changed.has(
        "excludedMatchPairs"
      )
    ) {
      const removed =
        new Set(
          patch.removedExcludedPairKeys ??
            []
        );
      const mergedPairs =
        new Map(
          current.excludedMatchPairs
            .filter(
              (pair) =>
                !removed.has(
                  excludedPairKey(
                    pair
                  )
                )
            )
            .map((pair) => [
              excludedPairKey(pair),
              pair,
            ])
        );
      const added =
        new Set(
          patch.addedExcludedPairKeys ??
            []
        );

      incoming.excludedMatchPairs.forEach(
        (pair) => {
          const key =
            excludedPairKey(pair);

          if (added.has(key)) {
            mergedPairs.set(
              key,
              pair
            );
          }
        }
      );

      next.excludedMatchPairs =
        Array.from(
          mergedPairs.values()
        );
    }

    const reconciled =
      changed.has("courts")
        ? reconcilePlayingPlayers(
            next
          )
        : next;

    const withPartners =
      changed.has(
        "fixedPartnerAssignments"
      )
        ? applyFixedPartners(
            reconciled
          )
        : reconciled;

    const withReconciledQueuedCourts = {
      ...withPartners,
      queuedCourts:
        reconcileQueuedCourts(
          withPartners.courts,
          withPartners.queuedCourts
        ),
    };

    const withStaleFinishPromotion =
      changed.has("courts")
        ? promoteQueuedCourtsAfterStaleFinish(
            withReconciledQueuedCourts,
            current,
            incoming,
            patch
          )
        : withReconciledQueuedCourts;

    return (
      changed.has(
        "fixedPartnerAssignments"
      ) ||
      changed.has(
        "fixedPartnerRequestResolutions"
      )
    )
      ? filterResolvedPartnerRequests(
          withStaleFinishPromotion
        )
      : withStaleFinishPromotion;
  }

  const players =
    current.players.slice();
  const sourcePlayer =
    sourceUserId
      ? incoming.players.find(
          (player) =>
            player.id ===
            sourceUserId
        )
      : undefined;

  if (sourcePlayer) {
    const index =
      players.findIndex(
        (player) =>
          player.id ===
          sourcePlayer.id
      );

    if (index < 0) {
      players.push(sourcePlayer);
    } else {
      const existing =
        players[index];
      const preserveActiveMatch =
        existing.status ===
          "PLAYING" &&
        sourcePlayer.status !==
          "LEFT";

      players[index] = {
        ...existing,
        ...sourcePlayer,
        ...(preserveActiveMatch
          ? {
              status:
                existing.status,
              playingStartedAt:
                existing.playingStartedAt,
              waitingStartedAt:
                existing.waitingStartedAt,
              matchCount:
                existing.matchCount,
              consecutiveMatches:
                existing.consecutiveMatches,
            }
          : {}),
        fixedPartner:
          sourcePlayer.fixedPartner ??
          existing.fixedPartner,
      };
    }
  }

  const sourceLeft =
    sourcePlayer?.status ===
    "LEFT";
  const affectedCourtIds =
    sourceLeft
      ? new Set(
          current.courts
            .filter(
              (court) =>
                [
                  ...(court.teamA ??
                    []),
                  ...(court.teamB ??
                    []),
                ].some(
                  (player) =>
                    player.id ===
                    sourcePlayer.id
                )
            )
            .map(
              (court) => court.id
            )
        )
      : new Set<number>();
  const courts =
    affectedCourtIds.size > 0
      ? current.courts.map(
          (court) =>
            affectedCourtIds.has(
              court.id
            )
              ? {
                  ...court,
                  status:
                    "EMPTY" as const,
                  teamA: null,
                  teamB: null,
                  startedAt: null,
                }
              : court
        )
      : current.courts;
  const normalizedPlayers =
    affectedCourtIds.size > 0
      ? players.map((player) => {
          if (
            player.id ===
            sourcePlayer?.id
          ) {
            return player;
          }

          const wasAssigned =
            current.courts.some(
              (court) =>
                affectedCourtIds.has(
                  court.id
                ) &&
                [
                  ...(court.teamA ??
                    []),
                  ...(court.teamB ??
                    []),
                ].some(
                  (assigned) =>
                    assigned.id ===
                    player.id
                )
            );

          return wasAssigned
            ? {
                ...player,
                status:
                  "WAITING" as const,
                playingStartedAt:
                  undefined,
                waitingStartedAt:
                  new Date(),
                consecutiveMatches: 0,
              }
            : player;
        })
      : players;

  return filterResolvedPartnerRequests(
    applyFixedPartners({
    ...current,
    players:
      normalizedPlayers,
    courts,
    queuedCourts:
      current.queuedCourts,
    fixedPartnerRequests:
      dedupeFixedPartnerRequests(
        mergeById(
          current.fixedPartnerRequests,
          incoming.fixedPartnerRequests
        )
      ),
    fixedPartnerAssignments:
      current.fixedPartnerAssignments,
    fixedPartnerRequestResolutions:
      mergeById(
        current.fixedPartnerRequestResolutions,
        incoming.fixedPartnerRequestResolutions
      ),
    dismissedNotificationIds:
      Array.from(
        new Set([
          ...current.dismissedNotificationIds,
          ...incoming.dismissedNotificationIds,
        ])
      ),
    notifications:
      filterDismissedNotifications(
        dedupeNotifications(
          mergeById(
            current.notifications,
            incoming.notifications
          )
        ),
        [
          ...current.dismissedNotificationIds,
          ...incoming.dismissedNotificationIds,
        ]
      ),
    matchHistory:
      dedupeMatchHistory(
        mergeById(
          current.matchHistory,
          incoming.matchHistory,
          true
        )
      ),
    workoutReportEvents:
      mergeById(
        current.workoutReportEvents,
        incoming.workoutReportEvents,
        true
      ),
    workoutReportSnapshots:
      mergeById(
        current.workoutReportSnapshots,
        incoming.workoutReportSnapshots,
        true
      ),
    })
  );
}
