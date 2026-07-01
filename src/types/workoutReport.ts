import type {
  MatchHistory,
} from "@/types/matchHistory";
import type {
  Player,
} from "@/types/player";

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

export interface WorkoutReportSnapshot {
  id: string;
  workoutDate: string;
  createdAt: string;
  players: Player[];
  matchHistory: MatchHistory[];
  workoutReportEvents: WorkoutReportEvent[];
}
