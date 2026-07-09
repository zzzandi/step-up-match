import {
  isSupabaseConfigured,
  supabase,
} from "@/lib/supabase";
import type {
  AccessRole,
} from "@/auth/access";
import type {
  LiveStateSnapshot,
} from "@/services/liveStateSync";

const TABLE =
  "live_state_snapshots";

interface LiveStateSnapshotRow {
  workout_date: string;
  updated_at: string;
  updated_by_id?: string | null;
  updated_by_name?: string | null;
  updated_by_role?: AccessRole | null;
  snapshot: LiveStateSnapshot;
}

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }
}

export async function saveLiveStateSnapshotToServer({
  workoutDate,
  snapshot,
  updatedById,
  updatedByName,
  updatedByRole,
}: {
  workoutDate: string;
  snapshot: LiveStateSnapshot;
  updatedById?: string;
  updatedByName?: string;
  updatedByRole?: AccessRole;
}) {
  ensureConfigured();

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        workout_date: workoutDate,
        updated_at:
          new Date().toISOString(),
        updated_by_id:
          updatedById ?? null,
        updated_by_name:
          updatedByName ?? null,
        updated_by_role:
          updatedByRole ?? null,
        snapshot,
      },
      {
        onConflict: "workout_date",
      }
    );

  if (error) {
    throw error;
  }
}

export async function getLiveStateSnapshotFromServer(
  workoutDate: string
) {
  ensureConfigured();

  const { data, error } =
    await supabase
      .from(TABLE)
      .select(
        "workout_date, updated_at, updated_by_id, updated_by_name, updated_by_role, snapshot"
      )
      .eq("workout_date", workoutDate)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? (data as LiveStateSnapshotRow)
    : null;
}

