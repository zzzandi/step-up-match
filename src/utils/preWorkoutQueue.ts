import type {
  AccessSession,
} from "@/auth/access";
import type {
  Player,
} from "@/types/player";

export function getQueuedParticipationMode(
  allowManagementWithoutQueue: boolean
): AccessSession["participationMode"] {
  return allowManagementWithoutQueue
    ? "PENDING_MANAGER"
    : "PENDING";
}

function getWaitingTimestamp(
  player: Player
) {
  return (
    player.waitingStartedAt ??
    player.arrivalTime
  ).getTime();
}

export function sortWaitingPlayersByQueue(
  players: Player[]
) {
  return [...players].sort(
    (playerA, playerB) =>
      getWaitingTimestamp(
        playerA
      ) -
      getWaitingTimestamp(
        playerB
      )
  );
}
