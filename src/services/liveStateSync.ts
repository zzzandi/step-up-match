import type { AccessRole } from "@/auth/access";
import type {
  MatchStore,
} from "@/store/useMatchStore";

export type LiveStateSnapshot = Pick<
  MatchStore,
  | "players"
  | "courts"
  | "fixedPartnerRequests"
  | "notifications"
  | "matchHistory"
  | "womenDoublesPriority"
  | "excludedMatchPairs"
>;

export type LiveStateKey =
  keyof LiveStateSnapshot;

export type LiveStateEntityKey =
  | "players"
  | "courts"
  | "fixedPartnerRequests"
  | "notifications"
  | "matchHistory";

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
    fixedPartnerRequests:
      state.fixedPartnerRequests,
    notifications:
      state.notifications,
    matchHistory:
      state.matchHistory,
    womenDoublesPriority:
      state.womenDoublesPriority,
    excludedMatchPairs:
      state.excludedMatchPairs,
  };
}

const liveStateKeys: LiveStateKey[] =
  [
    "players",
    "courts",
    "fixedPartnerRequests",
    "notifications",
    "matchHistory",
    "womenDoublesPriority",
    "excludedMatchPairs",
  ];

const entityKeys:
  LiveStateEntityKey[] = [
    "players",
    "courts",
    "fixedPartnerRequests",
    "notifications",
    "matchHistory",
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

function mergeById<T extends { id: string }>(
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
  if (
    sourceRole === "ADMIN" ||
    sourceRole === "MASTER"
  ) {
    if (!patch) {
      return incoming;
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
        mergeChangedEntities(
          current.courts,
          incoming.courts,
          patch.changedEntityIds
            ?.courts,
          patch.removedEntityIds
            ?.courts
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
      changed.has("notifications")
    ) {
      next.notifications =
        dedupeNotifications(
          mergeChangedEntities(
            current.notifications,
            incoming.notifications,
            patch.changedEntityIds
              ?.notifications,
            patch.removedEntityIds
              ?.notifications
          )
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

    return changed.has("courts")
      ? reconcilePlayingPlayers(
          next
        )
      : next;
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

  return {
    ...current,
    players,
    fixedPartnerRequests:
      dedupeFixedPartnerRequests(
        mergeById(
          current.fixedPartnerRequests,
          incoming.fixedPartnerRequests
        )
      ),
    notifications:
      dedupeNotifications(
        mergeById(
          current.notifications,
          incoming.notifications
        )
      ),
    matchHistory:
      dedupeMatchHistory(
        mergeById(
          current.matchHistory,
          incoming.matchHistory,
          true
        )
      ),
  };
}
