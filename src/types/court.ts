import type { Player } from "./player";

export interface Court {
  id: number;

  status: "PLAYING" | "EMPTY" | "QUEUED";

  teamA: [Player, Player] | null;

  teamB: [Player, Player] | null;

  startedAt: Date | null;
}
