import {
  useEffect,
  useState,
} from "react";

const TEST_MODE_KEY =
  "step-up-match-test-mode";
const TEST_WORKOUT_OPEN_KEY =
  "step-up-match-test-workout-open";
const TEST_MODE_EVENT =
  "step-up-match-test-mode-change";
const TEST_SNAPSHOT_KEY =
  "step-up-match-test-snapshot";
const TEST_ATTENDANCE_DATES_KEY =
  "step-up-match-test-attendance-dates";
const TEST_WORKOUT_DATE_KEY =
  "step-up-match-test-workout-date";
const TEST_ROSTER_DATE_KEY =
  "step-up-match-test-roster-date";

export interface TestModeState {
  active: boolean;
  workoutOpen: boolean;
}

export function getTestModeState(): TestModeState {
  const sessionTestMode = (() => {
    try {
      const storedSession =
        window.localStorage.getItem(
          "step-up-match-access-session"
        );
      return Boolean(
        storedSession &&
        JSON.parse(storedSession)
          .testMode
      );
    } catch {
      return false;
    }
  })();

  return {
    active:
      sessionTestMode ||
      window.sessionStorage.getItem(
        TEST_MODE_KEY
      ) === "true",
    workoutOpen:
      window.sessionStorage.getItem(
        TEST_WORKOUT_OPEN_KEY
      ) === "true",
  };
}

function notifyChange() {
  window.dispatchEvent(
    new Event(TEST_MODE_EVENT)
  );
}

export function setTestMode(
  active: boolean
) {
  window.sessionStorage.setItem(
    TEST_MODE_KEY,
    String(active)
  );

  if (!active) {
    window.sessionStorage.removeItem(
      TEST_WORKOUT_OPEN_KEY
    );
    window.sessionStorage.removeItem(
      TEST_ATTENDANCE_DATES_KEY
    );
    window.sessionStorage.removeItem(
      TEST_WORKOUT_DATE_KEY
    );
    window.sessionStorage.removeItem(
      TEST_ROSTER_DATE_KEY
    );
  }

  notifyChange();
}

export function setTestWorkoutOpen(
  workoutOpen: boolean
) {
  window.sessionStorage.setItem(
    TEST_WORKOUT_OPEN_KEY,
    String(workoutOpen)
  );
  notifyChange();
}

export function setTestAttendanceDates(
  dates: string[]
) {
  window.sessionStorage.setItem(
    TEST_ATTENDANCE_DATES_KEY,
    JSON.stringify([
      ...new Set(dates),
    ])
  );
  notifyChange();
}

export function getTestAttendanceDates() {
  const stored =
    window.sessionStorage.getItem(
      TEST_ATTENDANCE_DATES_KEY
    );

  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(
      stored
    ) as string[];
  } catch {
    return [];
  }
}

export function setTestWorkoutDate(
  date: string
) {
  window.sessionStorage.setItem(
    TEST_WORKOUT_DATE_KEY,
    date
  );
  notifyChange();
}

export function getTestWorkoutDate() {
  return (
    window.sessionStorage.getItem(
      TEST_WORKOUT_DATE_KEY
    ) ?? ""
  );
}

export function setTestRosterDate(
  date: string
) {
  window.sessionStorage.setItem(
    TEST_ROSTER_DATE_KEY,
    date
  );
  notifyChange();
}

export function getTestRosterDate() {
  return (
    window.sessionStorage.getItem(
      TEST_ROSTER_DATE_KEY
    ) ?? ""
  );
}

export function saveTestSnapshot(
  snapshot: unknown
) {
  window.sessionStorage.setItem(
    TEST_SNAPSHOT_KEY,
    JSON.stringify(snapshot)
  );
}

function reviveDates(
  value: unknown,
  key = ""
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      reviveDates(item)
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(value).map(
        ([childKey, childValue]) => [
          childKey,
          reviveDates(
            childValue,
            childKey
          ),
        ]
      )
    );
  }

  if (
    typeof value === "string" &&
    (
      key.endsWith("At") ||
      key === "arrivalTime"
    )
  ) {
    return new Date(value);
  }

  return value;
}

export function takeTestSnapshot() {
  const stored =
    window.sessionStorage.getItem(
      TEST_SNAPSHOT_KEY
    );
  window.sessionStorage.removeItem(
    TEST_SNAPSHOT_KEY
  );

  if (!stored) {
    return null;
  }

  return reviveDates(
    JSON.parse(stored)
  ) as Record<string, unknown>;
}

export function useTestMode() {
  const [state, setState] =
    useState<TestModeState>(
      getTestModeState
    );

  useEffect(() => {
    function refresh() {
      setState(
        getTestModeState()
      );
    }

    window.addEventListener(
      TEST_MODE_EVENT,
      refresh
    );
    window.addEventListener(
      "storage",
      refresh
    );

    return () => {
      window.removeEventListener(
        TEST_MODE_EVENT,
        refresh
      );
      window.removeEventListener(
        "storage",
        refresh
      );
    };
  }, []);

  return state;
}
