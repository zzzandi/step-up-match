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

function getKstDateKey() {
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

export async function getUserById(
  userId: string
) {
  ensureSupabaseConfigured();

  const { data, error } =
    await supabase
      .from("users")
      .select("*")
      .eq(
        "id",
        userId
      )
      .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function getOrCreateUser({
  name,
  gender,
  grade,
  hiddenSkill,
}: {
  name: string;
  gender: "M" | "F";
  grade:
    | "A"
    | "B"
    | "C"
    | "D"
    | "E"
    | "F";
  hiddenSkill: number;
}) {
  ensureSupabaseConfigured();

  const normalizedName =
    name.trim();
  const {
    data: existing,
    error: findError,
  } = await supabase
    .from("users")
    .select("*")
    .eq("name", normalizedName)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    return existing;
  }

  const { data, error } =
    await supabase
      .from("users")
      .insert({
        id: crypto.randomUUID(),
        name: normalizedName,
        gender,
        grade,
        hidden_skill:
          hiddenSkill,
        is_active: true,
      })
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getTodayAttendances() {
  ensureSupabaseConfigured();

  const today =
    getKstDateKey();

  const { data, error } =
    await supabase
      .from("attendances")
      .select("*")
      .eq(
        "attendance_date",
        today
      )
      .neq("status", "OPEN");

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
    getKstDateKey();

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

export async function ensureTodayCheckIn(
  userId: string
) {
  const attendances =
    await getTodayAttendances();
  const existing =
    attendances?.find(
      (attendance) =>
        attendance.user_id ===
        userId
    );

  if (existing) {
    return existing;
  }

  const inserted =
    await checkIn(userId);

  return inserted?.[0];
}
