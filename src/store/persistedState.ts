const ARRAY_FIELDS = [
  "players",
  "courts",
  "queuedCourts",
  "fixedPartnerRequests",
  "fixedPartnerAssignments",
  "fixedPartnerRequestResolutions",
  "notifications",
  "dismissedNotificationIds",
  "matchHistory",
  "workoutReportEvents",
  "workoutReportSnapshots",
  "deletedWorkoutReportSnapshotIds",
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
  if (
    player.status === "WAITING" &&
    player.lastMatchAt instanceof Date &&
    (!player.waitingStartedAt ||
      (player.waitingStartedAt instanceof
        Date &&
        player.waitingStartedAt.getTime() <
          player.lastMatchAt.getTime()))
  ) {
    player.waitingStartedAt =
      player.lastMatchAt;
    delete player.playingStartedAt;
  }
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

function isReadableNotification(
  value: unknown
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const message = (
    value as {
      message?: unknown;
    }
  ).message;

  return (
    typeof message === "string" &&
    !/[\uFFFD\u4E00-\u9FFF]/.test(
      message
    )
  );
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
  const reviveCourt = (value: unknown) => {
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
  };

  normalized.courts = (
    normalized.courts as unknown[]
  ).map(reviveCourt);
  normalized.queuedCourts = (
    normalized.queuedCourts as unknown[]
  ).map(reviveCourt);
  normalized.notifications = (
    normalized.notifications as unknown[]
  ).filter(isReadableNotification);
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
  normalized.workoutReportSnapshots = (
    normalized.workoutReportSnapshots as unknown[]
  ).map((value) => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return value;
    }

    const snapshot = {
      ...(value as Record<
        string,
        unknown
      >),
    };

    snapshot.players = Array.isArray(
      snapshot.players
    )
      ? snapshot.players
          .map(revivePlayer)
          .filter(Boolean)
      : [];
    snapshot.matchHistory =
      Array.isArray(
        snapshot.matchHistory
      )
        ? snapshot.matchHistory.map(
            (historyValue) => {
              if (
                !historyValue ||
                typeof historyValue !==
                  "object" ||
                Array.isArray(
                  historyValue
                )
              ) {
                return historyValue;
              }

              const history = {
                ...(historyValue as Record<
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
            }
          )
        : [];
    snapshot.workoutReportEvents =
      Array.isArray(
        snapshot.workoutReportEvents
      )
        ? snapshot.workoutReportEvents
        : [];

    return snapshot;
  });
  normalized.recommendations = [];
  normalized.selectedRecommendation =
    null;
  normalized.womenDoublesPriority =
    normalized.womenDoublesPriority ===
    true;

  return normalized;
}
