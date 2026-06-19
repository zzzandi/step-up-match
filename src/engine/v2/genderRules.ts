import type { Player } from "@/types/player";

export type DoublesType =
  | "MENS"
  | "WOMENS"
  | "MIXED";

export function getDoublesType(
  team: [Player, Player]
): DoublesType {
  const femaleCount =
    team.filter(
      (player) =>
        player.gender === "F"
    ).length;

  if (femaleCount === 0) {
    return "MENS";
  }

  if (femaleCount === 2) {
    return "WOMENS";
  }

  return "MIXED";
}

export function isCompatibleGenderMatch(
  teamA: [Player, Player],
  teamB: [Player, Player]
) {
  return (
    getDoublesType(teamA) ===
    getDoublesType(teamB)
  );
}
