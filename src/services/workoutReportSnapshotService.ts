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
}
