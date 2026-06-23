export type DashboardDateAction =
  | "INITIALIZE"
  | "UNCHANGED"
  | "RECOVER";

export function getDashboardDateAction(
  storedDate: string | null,
  today: string
): DashboardDateAction {
  if (!storedDate) {
    return "INITIALIZE";
  }

  return storedDate === today
    ? "UNCHANGED"
    : "RECOVER";
}
