import type { Player } from "./player";

export interface Court {
  id: number;

  status: "PLAYING" | "EMPTY";

  teamA: [Player, Player] | null;

  teamB: [Player, Player] | null;

  startedAt: Date | null;
}