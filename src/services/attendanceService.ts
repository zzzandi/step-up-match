import { supabase } from "@/lib/supabase";

export async function getTodayAttendanceList() {
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
      `);

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
      .order("attendance_date", {
        ascending: false,
      });

  if (error) {
    throw error;
  }

  return data ?? [];
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
        created_at,
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
