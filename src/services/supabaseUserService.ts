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
      .eq("is_active", true)
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
    .order("is_active", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    const { data, error } =
      await supabase
        .from("users")
        .update({
          gender,
          grade,
          hidden_skill:
            hiddenSkill,
          is_active: true,
        })
        .eq("id", existing.id)
        .select()
        .single();

    if (error) {
      throw error;
    }

    return data;
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

export async function createGuestUser({
  name,
  gender,
  grade,
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
}) {
  ensureSupabaseConfigured();

  const normalizedName =
    name.trim();
  const skillMap = {
    A: 85,
    B: 75,
    C: 65,
    D: 55,
    E: 45,
    F: 35,
  };

  if (!normalizedName) {
    throw new Error(
      "Guest name is required."
    );
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
          skillMap[grade],
        is_active: false,
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
      .neq("status", "OPEN")
      .neq("status", "PENDING");

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

  const pending =
    await activatePendingCheckIn(
      userId
    );

  if (pending) {
    return pending;
  }

  return pending;
}

export async function queuePendingCheckIn(
  userId: string
) {
  ensureSupabaseConfigured();

  const today =
    getKstDateKey();
  const { data: existing, error } =
    await supabase
      .from("attendances")
      .select("*")
      .eq("attendance_date", today)
      .eq("user_id", userId)
      .neq("status", "OPEN")
      .order("arrival_time", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (existing) {
    return existing;
  }

  const { data, error: insertError } =
    await supabase
      .from("attendances")
      .insert({
        session_id: SESSION_ID,
        user_id: userId,
        status: "PENDING",
        attendance_date: today,
      })
      .select()
      .single();

  if (insertError) {
    throw insertError;
  }

  return data;
}

export async function activatePendingCheckIn(
  userId: string,
  allowDirectCheckIn = true
) {
  ensureSupabaseConfigured();

  const today =
    getKstDateKey();
  const {
    data: activeAttendance,
    error: activeError,
  } = await supabase
    .from("attendances")
    .select("*")
    .eq("attendance_date", today)
    .eq("user_id", userId)
    .neq("status", "OPEN")
    .neq("status", "PENDING")
    .order("arrival_time", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (activeError) {
    throw activeError;
  }

  if (activeAttendance) {
    return activeAttendance;
  }

  const {
    data: workoutMarker,
    error: workoutError,
  } = await supabase
    .from("attendances")
    .select("arrival_time")
    .eq("attendance_date", today)
    .eq("status", "OPEN")
    .order("arrival_time", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (workoutError) {
    throw workoutError;
  }

  const cutoffTime =
    workoutMarker?.arrival_time
      ? new Date(
          new Date(
            workoutMarker.arrival_time
          ).getTime() -
            30 * 60 * 1000
        ).toISOString()
      : null;

  const { data, error } =
    await supabase
      .from("attendances")
      .update({
        status: "WAITING",
      })
      .eq("attendance_date", today)
      .eq("user_id", userId)
      .eq("status", "PENDING")
      .gte(
        "arrival_time",
        cutoffTime ??
          new Date().toISOString()
      )
      .select()
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  const {
    data: stalePending,
    error: staleError,
  } = await supabase
    .from("attendances")
    .select("id")
    .eq("attendance_date", today)
    .eq("user_id", userId)
    .eq("status", "PENDING")
    .limit(1)
    .maybeSingle();

  if (staleError) {
    throw staleError;
  }

  if (stalePending) {
    await supabase
      .from("attendances")
      .delete()
      .eq("id", stalePending.id);
    return null;
  }

  if (!allowDirectCheckIn) {
    return null;
  }

  const inserted =
    await checkIn(userId);

  return inserted?.[0];
}

export async function activateAllPendingCheckIns(
  workoutOpenedAt: string
) {
  ensureSupabaseConfigured();

  const today =
    getKstDateKey();
  const cutoff =
    new Date(
      new Date(
        workoutOpenedAt
      ).getTime() -
        30 * 60 * 1000
    ).toISOString();
  const { data, error } =
    await supabase
      .from("attendances")
      .update({
        status: "WAITING",
      })
      .eq(
        "attendance_date",
        today
      )
      .eq("status", "PENDING")
      .gte(
        "arrival_time",
        cutoff
      )
      .select()
      .order("arrival_time", {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  const { error: cleanupError } =
    await supabase
      .from("attendances")
      .delete()
      .eq(
        "attendance_date",
        today
      )
      .eq("status", "PENDING")
      .lt(
        "arrival_time",
        cutoff
      );

  if (cleanupError) {
    throw cleanupError;
  }

  return data ?? [];
}

export async function updateUserProfile({
  userId,
  name,
  gender,
  grade,
  hiddenSkill,
}: {
  userId: string;
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

  const { data, error } =
    await supabase
      .from("users")
      .update({
        name: name.trim(),
        gender,
        grade,
        hidden_skill:
          hiddenSkill,
      })
      .eq("id", userId)
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}
