import type {
  LiveSessionEvent,
} from "@/services/liveSessionService";

export const SNAPSHOT_REQUEST_RETRY_DELAYS =
  [500, 1200, 3000, 6000] as const;

type StateSnapshotEvent = Extract<
  LiveSessionEvent,
  { type: "STATE_SNAPSHOT" }
>;

export function shouldApplyStateSnapshot(
  event: StateSnapshotEvent,
  clientId: string,
  pendingRequestIds: ReadonlySet<string>
) {
  if (
    event.sourceClientId === clientId
  ) {
    return false;
  }

  return (
    !event.responseToRequestId ||
    pendingRequestIds.has(
      event.responseToRequestId
    )
  );
}

export function shouldClearSessionForForceLogout(
  targetUserId: string | undefined,
  currentUserId: string | undefined
) {
  return (
    !targetUserId ||
    targetUserId === currentUserId
  );
}
