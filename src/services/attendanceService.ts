import { supabase } from "@/lib/supabase";
import {
  isWorkoutOpen,
} from "@/services/workoutSessionService";

export async function getTodayAttendanceList() {
  const today =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).format(new Date());

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
          hidden_skill
        )
      `)
      .eq(
        "attendance_date",
        today
      )
      .neq("status", "OPEN");

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

  return getTodayAttendanceList();
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
          hidden_skill
        )
      `)
      .eq(
        "attendance_date",
        attendanceDate
      )
      .neq("status", "OPEN")
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
