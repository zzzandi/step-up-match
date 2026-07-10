import {
  isSupabaseConfigured,
  supabase,
} from "@/lib/supabase";
import type {
  WorkoutReportSnapshot,
} from "@/types/workoutReport";

const TABLE =
  "workout_report_snapshots";

interface WorkoutReportSnapshotRow {
  id: string;
  workout_date: string;
  created_at: string;
  snapshot: WorkoutReportSnapshot;
}

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }
}

function normalizeSnapshot(
  row: WorkoutReportSnapshotRow
) {
  return {
    ...row.snapshot,
    id: row.id,
    workoutDate:
      row.snapshot.workoutDate ??
      row.workout_date,
    createdAt:
      row.snapshot.createdAt ??
      row.created_at,
  } satisfies WorkoutReportSnapshot;
}

export async function saveWorkoutReportSnapshotToServer(
  snapshot: WorkoutReportSnapshot
) {
  ensureConfigured();

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        id: snapshot.id,
        workout_date:
          snapshot.workoutDate,
        created_at:
          snapshot.createdAt,
        snapshot,
      },
      {
        onConflict: "id",
      }
    );

  if (error) {
    throw error;
  }

  return snapshot;
}

export async function getWorkoutReportSnapshotsFromServer(
  workoutDate?: string
) {
  ensureConfigured();

  let query = supabase
    .from(TABLE)
    .select(
      "id, workout_date, created_at, snapshot"
    );

  if (workoutDate) {
    query = query.eq(
      "workout_date",
      workoutDate
    );
  }

  const { data, error } =
    await query
      .order("workout_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      })
      .limit(60);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    normalizeSnapshot(
      row as WorkoutReportSnapshotRow
    )
  );
}

export async function deleteWorkoutReportSnapshotFromServer(
  snapshotId: string
) {
  ensureConfigured();

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", snapshotId);

  if (error) {
    throw error;
  }

  const {
    data: remaining,
    error: verifyError,
  } = await supabase
    .from(TABLE)
    .select("id")
    .eq("id", snapshotId)
    .maybeSingle();

  if (verifyError) {
    throw verifyError;
  }

  if (remaining) {
    throw new Error(
      "Workout report was not deleted. Check Supabase delete policy."
    );
  }
}

export async function deleteWorkoutReportSnapshotsByDateFromServer(
  workoutDate: string
) {
  ensureConfigured();

  const {
    data: existingRows,
    error: fetchError,
  } = await supabase
    .from(TABLE)
    .select("id")
    .eq("workout_date", workoutDate);

  if (fetchError) {
    throw fetchError;
  }

  const deletedIds = (
    existingRows ?? []
  ).map((row) => row.id as string);

  if (deletedIds.length === 0) {
    return deletedIds;
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("workout_date", workoutDate);

  if (error) {
    throw error;
  }

  const {
    data: remaining,
    error: verifyError,
  } = await supabase
    .from(TABLE)
    .select("id")
    .eq("workout_date", workoutDate)
    .limit(1);

  if (verifyError) {
    throw verifyError;
  }

  if ((remaining ?? []).length > 0) {
    throw new Error(
      "Workout reports were not deleted. Check Supabase delete policy."
    );
  }

  return deletedIds;
}
