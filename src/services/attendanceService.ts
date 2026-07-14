import {
  isSupabaseConfigured,
  supabase,
} from "@/lib/supabase";
import {
  isWorkoutOpen,
} from "@/services/workoutSessionService";
import {
  isActiveAttendance,
} from "@/utils/attendanceState";
import {
  getKstDateKey,
} from "@/utils/kstDate";
import type {
  Player,
} from "@/types/player";

export async function getTodayAttendanceList() {
  const today = getKstDateKey();

  const { data, error } =
    await supabase
      .from("attendances")
      .select(`
        *,
        users (
          id,
          name,
          gender,
          grade,
          hidden_skill,
          fixed_partner_id
        )
      `)
      .eq(
        "attendance_date",
        today
      )
      .neq("status", "OPEN")
      .neq("status", "PENDING")
      .order("arrival_time", {
        ascending: true,
      });

  console.log(
    "ATTENDANCE QUERY RESULT",
    data
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getUserAttendanceHistory(
  userId: string
) {
  const { data, error } =
    await supabase
      .from("attendances")
      .select("*")
      .eq("user_id", userId)
      .neq("status", "OPEN")
      .neq("status", "PENDING")
      .order("attendance_date", {
        ascending: false,
      });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getActiveWorkoutAttendanceList() {
  if (!(await isWorkoutOpen())) {
    return [];
  }

  const attendance =
    await getTodayAttendanceList();

  return attendance.filter(
    isActiveAttendance
  );
}

export async function getAttendanceListByDate(
  attendanceDate: string
) {
  const { data, error } =
    await supabase
      .from("attendances")
      .select(`
        id,
        user_id,
        attendance_date,
        arrival_time,
        status,
        users (
          id,
          name,
          gender,
          grade,
          hidden_skill,
          fixed_partner_id
        )
      `)
      .eq(
        "attendance_date",
        attendanceDate
      )
      .neq("status", "OPEN")
      .neq("status", "PENDING")
      .order("arrival_time", {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function updateAttendanceDate(
  attendanceId: string,
  attendanceDate: string
) {
  const { data, error } =
    await supabase
      .from("attendances")
      .update({
        attendance_date:
          attendanceDate,
      })
      .eq("id", attendanceId)
      .neq("status", "OPEN")
      .neq("status", "PENDING")
      .select();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function deleteAttendanceRecord(
  attendanceId: string
) {
  const { error } =
    await supabase
      .from("attendances")
      .delete()
      .eq("id", attendanceId)
      .neq("status", "OPEN");

  if (error) {
    throw error;
  }
}

export async function syncActiveAttendanceStats(
  players: Pick<
    Player,
    | "id"
    | "matchCount"
    | "consecutiveMatches"
    | "status"
    | "waitingStartedAt"
    | "playingStartedAt"
  >[]
) {
  if (
    !isSupabaseConfigured ||
    players.length === 0
  ) {
    return;
  }

  const today = getKstDateKey();

  await Promise.all(
    players.map((player) =>
      supabase
        .from("attendances")
        .update({
          match_count:
            player.matchCount,
          consecutive_matches:
            player.consecutiveMatches,
          status: player.status,
          waiting_started_at:
            player.waitingStartedAt
              ? new Date(
                  player.waitingStartedAt
                ).toISOString()
              : null,
        })
        .eq("attendance_date", today)
        .eq("user_id", player.id)
        .neq("status", "OPEN")
        .neq("status", "PENDING")
    )
  );
}

export async function getMonthlyAttendanceList(
  yearMonth: string
) {
  const [year, month] =
    yearMonth
      .split("-")
      .map(Number);

  if (!year || !month) {
    return [];
  }

  const start =
    `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data, error } =
    await supabase
      .from("attendances")
      .select(`
        id,
        user_id,
        attendance_date,
        arrival_time,
        users (
          id,
          name,
          gender,
          grade
        )
      `)
      .gte(
        "attendance_date",
        start
      )
      .lt(
        "attendance_date",
        nextMonth
      )
      .neq("status", "OPEN")
      .neq("status", "PENDING")
      .order(
        "attendance_date",
        {
          ascending: false,
        }
      );

  if (error) {
    throw error;
  }

  return data ?? [];
}
