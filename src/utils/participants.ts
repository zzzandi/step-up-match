import type { Player } from "@/types/player";

export function uniqueByUserId<
  T extends {
    user_id?: string;
    users?: {
      id?: string;
    };
  },
>(items: T[]) {
  const unique =
    new Map<string, T>();

  items.forEach((item) => {
    const userId =
      item.users?.id ??
      item.user_id;

    if (
      userId &&
      !unique.has(userId)
    ) {
      unique.set(userId, item);
    }
  });

  return [...unique.values()];
}

export function uniquePlayers(
  players: Player[]
) {
  const unique =
    new Map<string, Player>();

  players.forEach((player) => {
    const existing =
      unique.get(player.id);

    if (!existing) {
      unique.set(
        player.id,
        player
      );
      return;
    }

    unique.set(player.id, {
      ...existing,
      ...player,
      status:
        existing.status ===
          "PLAYING" ||
        player.status === "PLAYING"
          ? "PLAYING"
          : player.status,
    });
  });

  return [...unique.values()];
}
