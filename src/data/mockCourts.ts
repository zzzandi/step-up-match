import type { Court } from "@/types/court";
import { mockPlayers } from "./mockPlayers";

export const mockCourts: Court[] = [
  {
    id: 1,
    status: "PLAYING",
    teamA: [
      mockPlayers[0],
      mockPlayers[1],
    ],
    teamB: [
      mockPlayers[2],
      mockPlayers[3],
    ],
    startedAt: new Date(),
  },

  {
    id: 2,
    status: "PLAYING",
    teamA: [
      mockPlayers[4],
      mockPlayers[5],
    ],
    teamB: [
      mockPlayers[6],
      mockPlayers[7],
    ],
    startedAt: new Date(),
  },

  {
    id: 3,
    status: "PLAYING",
    teamA: [
      mockPlayers[8],
      mockPlayers[9],
    ],
    teamB: [
      mockPlayers[10],
      mockPlayers[11],
    ],
    startedAt: new Date(),
  },
];