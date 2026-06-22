export interface AttendanceStateRow {
  id: string;
  status?: string | null;
  arrival_time?: string | null;
}

export function shouldActivateAttendance(
  existing:
    | Pick<
        AttendanceStateRow,
        "status"
      >
    | null
    | undefined
) {
  return (
    !existing ||
    existing.status === "LEFT"
  );
}

export function isActiveAttendance(
  attendance: Pick<
    AttendanceStateRow,
    "status"
  >
) {
  return (
    attendance.status !== "LEFT"
  );
}

export function selectCanonicalAttendance<
  T extends AttendanceStateRow,
>(rows: T[]) {
  return (
    rows.find(
      (row) =>
        row.status !== "PENDING"
    ) ??
    rows[0] ??
    null
  );
}
