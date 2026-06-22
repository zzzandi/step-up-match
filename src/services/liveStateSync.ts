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
  | "recommendations"
  | "selectedRecommendation"
  | "womenDoublesPriority"
  | "excludedMatchPairs"
>;

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
    recommendations:
      state.recommendations,
    selectedRecommendation:
      state.selectedRecommendation,
    womenDoublesPriority:
      state.womenDoublesPriority,
    excludedMatchPairs:
      state.excludedMatchPairs,
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

export function mergeLiveStateSnapshot(
  current: LiveStateSnapshot,
  incoming: LiveStateSnapshot,
  sourceRole: AccessRole,
  sourceUserId?: string
): LiveStateSnapshot {
  if (
    sourceRole === "ADMIN" ||
    sourceRole === "MASTER"
  ) {
    return incoming;
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
      mergeById(
        current.fixedPartnerRequests,
        incoming.fixedPartnerRequests
      ),
    notifications:
      mergeById(
        current.notifications,
        incoming.notifications
      ),
    matchHistory:
      mergeById(
        current.matchHistory,
        incoming.matchHistory,
        true
      ),
  };
}
