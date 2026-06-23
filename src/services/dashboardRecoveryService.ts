import {
  getActiveWorkoutAttendanceList,
} from "@/services/attendanceService";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import type {
  Player,
} from "@/types/player";

interface AttendanceUser {
  id: string;
  name: string;
  gender?: "M" | "F" | null;
  grade?: Player["grade"] | null;
  hidden_skill?: number | null;
  fixed_partner_id?: string | null;
}

interface ActiveAttendanceRow {
  user_id?: string;
  arrival_time?: string | null;
  match_count?: number | null;
  consecutive_matches?: number | null;
  users?: AttendanceUser | AttendanceUser[];
}

export const DEFAULT_COURT_COUNT = 3;

function getAttendanceUser(
  row: ActiveAttendanceRow
) {
  return Array.isArray(row.users)
    ? row.users[0]
    : row.users;
}

export function mergeAttendancePlayers(
  currentPlayers: Player[],
  rows: ActiveAttendanceRow[]
) {
  const playersById =
    new Map(
      currentPlayers.map(
        (player) => [
          player.id,
          player,
        ]
      )
    );

  const uniqueRows =
    new Map<
      string,
      ActiveAttendanceRow
    >();

  rows.forEach((row) => {
    const user =
      getAttendanceUser(row);
    const userId =
      user?.id ?? row.user_id;

    if (
      userId &&
      !uniqueRows.has(userId)
    ) {
      uniqueRows.set(userId, row);
    }
  });

  uniqueRows.forEach(
    (row) => {
      const user =
        getAttendanceUser(row);

      if (!user?.id) {
        return;
      }

      const existing =
        playersById.get(user.id);
      const arrivalTime =
        new Date(
          row.arrival_time ??
            existing?.arrivalTime ??
            Date.now()
        );
      const nextPlayer: Player = {
        id: user.id,
        name: user.name,
        gender:
          user.gender ??
          existing?.gender ??
          "M",
        grade:
          user.grade ??
          existing?.grade ??
          "F",
        hiddenSkill:
          user.hidden_skill ??
          existing?.hiddenSkill ??
          35,
        isPresent: true,
        arrivalTime:
          existing?.arrivalTime ??
          arrivalTime,
        matchCount:
          existing?.matchCount ??
          row.match_count ??
          0,
        consecutiveMatches:
          existing?.consecutiveMatches ??
          row.consecutive_matches ??
          0,
        status:
          existing?.status ===
          "PLAYING"
            ? "PLAYING"
            : "WAITING",
        waitingStartedAt:
          existing?.status ===
          "PLAYING"
            ? existing.waitingStartedAt
            : existing?.waitingStartedAt ??
              arrivalTime,
        playingStartedAt:
          existing?.playingStartedAt,
        lastMatchAt:
          existing?.lastMatchAt,
        lastPartners:
          existing?.lastPartners ?? [],
        lastOpponents:
          existing?.lastOpponents ?? [],
        fixedPartner:
          user.fixed_partner_id ??
          existing?.fixedPartner,
      };
      const unchanged =
        existing &&
        existing.name ===
          nextPlayer.name &&
        existing.gender ===
          nextPlayer.gender &&
        existing.grade ===
          nextPlayer.grade &&
        existing.hiddenSkill ===
          nextPlayer.hiddenSkill &&
        existing.isPresent &&
        existing.status ===
          nextPlayer.status &&
        existing.fixedPartner ===
          nextPlayer.fixedPartner;

      playersById.set(
        user.id,
        unchanged
          ? existing
          : nextPlayer
      );
    }
  );

  return Array.from(
    playersById.values()
  );
}

export function createDefaultCourts() {
  return Array.from(
    {
      length: DEFAULT_COURT_COUNT,
    },
    (_, index) => ({
      id: index + 1,
      status: "EMPTY" as const,
      teamA: null,
      teamB: null,
      startedAt: null,
    })
  );
}

export async function recoverOpenWorkoutDashboard() {
  const attendance =
    await getActiveWorkoutAttendanceList();

  if (attendance.length === 0) {
    return false;
  }

  const state =
    useMatchStore.getState();
  const players =
    mergeAttendancePlayers(
      state.players,
      attendance as ActiveAttendanceRow[]
    );
  const playersChanged =
    players.length !==
      state.players.length ||
    players.some(
      (player, index) =>
        player !== state.players[index]
    );
  const needsDefaultCourts =
    state.courts.length === 0;

  if (
    playersChanged ||
    needsDefaultCourts
  ) {
    useMatchStore.setState({
      players,
      courts:
        needsDefaultCourts
          ? createDefaultCourts()
          : state.courts,
    });
  }

  return true;
}
