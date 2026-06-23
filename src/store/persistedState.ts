const ARRAY_FIELDS = [
  "players",
  "courts",
  "fixedPartnerRequests",
  "fixedPartnerAssignments",
  "fixedPartnerRequestResolutions",
  "notifications",
  "matchHistory",
  "excludedMatchPairs",
] as const;

function reviveDate(
  value: unknown,
  fallback?: Date
) {
  if (value instanceof Date) {
    return value;
  }

  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return fallback;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? fallback
    : date;
}

function revivePlayer(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const player = {
    ...(value as Record<
      string,
      unknown
    >),
  };

  player.arrivalTime =
    reviveDate(
      player.arrivalTime,
      new Date(0)
    );
  player.waitingStartedAt =
    reviveDate(
      player.waitingStartedAt
    );
  player.playingStartedAt =
    reviveDate(
      player.playingStartedAt
    );
  player.lastMatchAt =
    reviveDate(player.lastMatchAt);
  player.lastPartners =
    Array.isArray(
      player.lastPartners
    )
      ? player.lastPartners
      : [];
  player.lastOpponents =
    Array.isArray(
      player.lastOpponents
    )
      ? player.lastOpponents
      : [];

  return player;
}

export function normalizePersistedMatchState(
  persistedState: unknown
) {
  if (
    !persistedState ||
    typeof persistedState !== "object" ||
    Array.isArray(persistedState)
  ) {
    return {};
  }

  const normalized = {
    ...(persistedState as Record<
      string,
      unknown
    >),
  };

  ARRAY_FIELDS.forEach((field) => {
    if (!Array.isArray(normalized[field])) {
      normalized[field] = [];
    }
  });

  normalized.players = (
    normalized.players as unknown[]
  )
    .map(revivePlayer)
    .filter(Boolean);
  normalized.courts = (
    normalized.courts as unknown[]
  ).map((value) => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return value;
    }

    const court = {
      ...(value as Record<
        string,
        unknown
      >),
    };

    court.startedAt =
      reviveDate(court.startedAt) ??
      null;
    court.teamA =
      Array.isArray(court.teamA)
        ? court.teamA
            .map(revivePlayer)
            .filter(Boolean)
        : null;
    court.teamB =
      Array.isArray(court.teamB)
        ? court.teamB
            .map(revivePlayer)
            .filter(Boolean)
        : null;

    return court;
  });
  normalized.matchHistory = (
    normalized.matchHistory as unknown[]
  ).map((value) => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return value;
    }

    const history = {
      ...(value as Record<
        string,
        unknown
      >),
    };

    history.startedAt =
      reviveDate(
        history.startedAt,
        new Date(0)
      );
    history.endedAt =
      reviveDate(
        history.endedAt,
        new Date(0)
      );

    return history;
  });
  normalized.recommendations = [];
  normalized.selectedRecommendation =
    null;
  normalized.womenDoublesPriority =
    normalized.womenDoublesPriority ===
    true;

  return normalized;
}
