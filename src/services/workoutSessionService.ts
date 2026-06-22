import {
  isSupabaseConfigured,
  supabase,
} from "@/lib/supabase";

const SESSION_ID =
  "c3112be7-3e3d-4db4-9850-2ff305095a76";

export function getKstDateKey() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }
}

export async function isWorkoutOpen(
  workoutDate = getKstDateKey()
) {
  ensureConfigured();

  const { data, error } =
    await supabase
      .from("attendances")
      .select("id")
      .eq(
        "attendance_date",
        workoutDate
      )
      .eq("status", "OPEN")
      .limit(1);

  if (error) {
    throw error;
  }

  return Boolean(
    data?.length
  );
}

export async function openWorkout(
  workoutDate: string,
  operatorUserId: string
) {
  ensureConfigured();

  if (
    await isWorkoutOpen(
      workoutDate
    )
  ) {
    return false;
  }

  const { data, error } =
    await supabase
      .from("attendances")
      .insert({
        session_id: SESSION_ID,
        user_id:
          operatorUserId,
        status: "OPEN",
        attendance_date:
          workoutDate,
      })
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function closeWorkout(
  workoutDate = getKstDateKey()
) {
  ensureConfigured();

  const { error } =
    await supabase
      .from("attendances")
      .delete()
      .eq(
        "attendance_date",
        workoutDate
      )
      .eq("status", "OPEN");

  if (error) {
    throw error;
  }
}

export async function resetTodayWorkoutData(
  workoutDate = getKstDateKey()
) {
  ensureConfigured();

  const { error } =
    await supabase
      .from("attendances")
      .delete()
      .eq(
        "attendance_date",
        workoutDate
      );

  if (error) {
    throw error;
  }
}
