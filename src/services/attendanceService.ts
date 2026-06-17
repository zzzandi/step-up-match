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