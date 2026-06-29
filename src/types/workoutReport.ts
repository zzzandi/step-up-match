export type WorkoutReportEventType =
  | "AUTO_MATCH"
  | "MANUAL_MATCH"
  | "QUEUED_PROMOTED"
  | "PLAYER_REPLACED"
  | "COURT_PLAYERS_SWAPPED";

export interface WorkoutReportEvent {
  id: string;
  type: WorkoutReportEventType;
  courtId: number;
  target?: "GAME" | "QUEUE";
  createdAt: string;
  playerIds: string[];
  playerNames: Record<
    string,
    string
  >;
  description: string;
}
