const MAX_DISPLAY_REST_MINUTES = 60;

export function getRestMinutes(
  waitingStartedAt?: Date
): number {
  if (!waitingStartedAt) {
    return 0;
  }

  const startedAt =
    new Date(
      waitingStartedAt
    ).getTime();

  if (
    Number.isNaN(startedAt)
  ) {
    return 0;
  }

  const diff =
    Date.now() - startedAt;
  const minutes =
    Math.floor(
      diff / 1000 / 60
    );

  return Math.min(
    MAX_DISPLAY_REST_MINUTES,
    Math.max(0, minutes)
  );
}
  
  export function getMatchDuration(
    startedAt?: Date | null
  ): string {
    if (
      !startedAt
    ) {
      return "00:00";
    }
  
    const seconds =
      Math.floor(
        (Date.now() -
          new Date(
            startedAt
          ).getTime()) /
          1000
      );
  
    const minutes =
      Math.floor(
        seconds / 60
      );
  
    const remain =
      seconds % 60;
  
    return `${minutes
      .toString()
      .padStart(2, "0")}:${remain
      .toString()
      .padStart(2, "0")}`;
  }
