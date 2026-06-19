import {
  useEffect,
  useState,
} from "react";

export type AccessRole =
  | "ADMIN"
  | "PLAYER"
  | "MASTER";

export interface AccessSession {
  role: AccessRole;
  userId?: string;
  userName?: string;
  participationMode?:
    | "PARTICIPANT"
    | "VIEWER"
    | "PENDING";
}

const ACCESS_SESSION_KEY =
  "step-up-match-access-session";

const ACCESS_SESSION_EVENT =
  "step-up-match-access-session-change";

const rolePathMap: Record<
  AccessRole,
  string
> = {
  ADMIN: "/admin",
  PLAYER: "/player",
  MASTER: "/master",
};

export const adminNames = [
  "유원석",
  "이주민",
  "김영진",
  "박철상",
];

export const masterNames = [
  "김민수",
];

export function canManage(
  role: AccessRole
) {
  return (
    role === "ADMIN" ||
    role === "MASTER"
  );
}

export function getRolePath(
  role: AccessRole
) {
  return rolePathMap[role];
}

export function getAccessSession():
  | AccessSession
  | null {
  const stored =
    window.localStorage.getItem(
      ACCESS_SESSION_KEY
    );

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(
      stored
    ) as AccessSession;
  } catch {
    window.localStorage.removeItem(
      ACCESS_SESSION_KEY
    );
    return null;
  }
}

export function setAccessSession(
  session: AccessSession
) {
  window.localStorage.setItem(
    ACCESS_SESSION_KEY,
    JSON.stringify(session)
  );

  window.dispatchEvent(
    new Event(ACCESS_SESSION_EVENT)
  );
}

export function clearAccessSession() {
  window.localStorage.removeItem(
    ACCESS_SESSION_KEY
  );

  window.dispatchEvent(
    new Event(ACCESS_SESSION_EVENT)
  );
}

export function useAccessSession() {
  const [session, setSession] =
    useState<
      AccessSession | null
    >(() => getAccessSession());

  useEffect(() => {
    function handleChange() {
      setSession(
        getAccessSession()
      );
    }

    window.addEventListener(
      ACCESS_SESSION_EVENT,
      handleChange
    );

    window.addEventListener(
      "storage",
      handleChange
    );

    return () => {
      window.removeEventListener(
        ACCESS_SESSION_EVENT,
        handleChange
      );

      window.removeEventListener(
        "storage",
        handleChange
      );
    };
  }, []);

  return session;
}
