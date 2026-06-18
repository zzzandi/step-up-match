import {
  isSupabaseConfigured,
  supabase,
} from "@/lib/supabase";

const SESSION_ID =
  "c3112be7-3e3d-4db4-9850-2ff305095a76";

function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }
}

export async function getUsers() {
  ensureSupabaseConfigured();

  const { data, error } =
    await supabase
      .from("users")
      .select("*")
      .order("name");

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function getTodayAttendances() {
  ensureSupabaseConfigured();

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  const { data, error } =
    await supabase
      .from("attendances")
      .select("*")
      .eq(
        "attendance_date",
        today
      );

  if (error) {
    console.error(
      "GET ATTENDANCES ERROR",
      error
    );
    throw error;
  }

  return data;
}

export async function checkIn(
  userId: string
) {
  ensureSupabaseConfigured();

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  const { data, error } =
    await supabase
      .from("attendances")
      .insert({
        session_id: SESSION_ID,
        user_id: userId,
        status: "WAITING",
        attendance_date: today,
      })
      .select();

  console.log(
    "CHECKIN RESULT",
    data,
    error
  );

  if (error) {
    console.error(
      "CHECKIN ERROR",
      error
    );
    throw error;
  }

  return data;
}
