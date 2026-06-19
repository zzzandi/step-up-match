import {
  useState,
} from "react";
import {
  Menu,
  X,
} from "lucide-react";
import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import {
  adminNames,
  canManage,
  clearAccessSession,
  getRolePath,
  setAccessSession,
  useAccessSession,
} from "@/auth/access";
import {
  publishLiveSessionEvent,
} from "@/services/liveSessionService";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import {
  closeWorkout,
  getKstDateKey,
} from "@/services/workoutSessionService";

const roleLabels = {
  ADMIN: "Admin",
  PLAYER: "Player",
  MASTER: "Master",
};

export default function AppNavigation() {
  const navigate =
    useNavigate();
  const session =
    useAccessSession();
  const [isOpen, setIsOpen] =
    useState(false);
  const players =
    useMatchStore(
      (state) => state.players
    );
  const setPlayers =
    useMatchStore(
      (state) => state.setPlayers
    );
  const endTodaySession =
    useMatchStore(
      (state) =>
        state.endTodaySession
    );
  const addNotification =
    useMatchStore(
      (state) =>
        state.addNotification
    );

  if (!session) {
    return null;
  }

  const activeSession =
    session;
  const homePath =
    getRolePath(
      activeSession.role
    );
  const currentUserId =
    activeSession.userId;
  const isParticipant =
    (activeSession.participationMode ??
      "PARTICIPANT") ===
    "PARTICIPANT";
  const sessionModeLabel =
    activeSession.participationMode ===
    "PENDING"
      ? " · 개설 대기"
      : !isParticipant
        ? " · 조회 전용"
        : "";

  function logout() {
    const confirmed =
      window.confirm(
        "로그아웃하시겠습니까?"
      );

    if (!confirmed) {
      return;
    }

    clearAccessSession();
    setIsOpen(false);
    navigate("/");
  }

  function notifyPlayerLeft() {
    if (
      activeSession.role !==
        "PLAYER" ||
      !currentUserId
    ) {
      return;
    }

    const message =
      `${activeSession.userName ?? "회원"}님이 개인 운동을 종료했습니다.`;

    players
      .filter(
        (player) =>
          player.id !==
          currentUserId &&
          player.status !== "LEFT" &&
          !adminNames.includes(
            player.name ===
              "큰영진"
              ? "김영진"
              : player.name
          )
      )
      .forEach((player) => {
        addNotification({
          audience: "PLAYER",
          recipientId: player.id,
          message,
        });
      });

    addNotification({
      audience: "ADMIN",
      message,
    });
  }

  function endPersonalWorkout() {
    if (!currentUserId) {
      return;
    }

    const confirmed =
      window.confirm(
        "오늘 운동을 종료하고 퇴장하시겠습니까?"
      );

    if (!confirmed) {
      return;
    }

    setPlayers(
      players.map((player) =>
        player.id === currentUserId
          ? {
              ...player,
              status: "LEFT",
              isPresent: false,
            }
          : player
      )
    );
    notifyPlayerLeft();

    if (
      canManage(
        activeSession.role
      )
    ) {
      setAccessSession({
        role:
          activeSession.role,
        userId:
          activeSession.userId,
        userName:
          activeSession.userName,
        participationMode:
          "VIEWER",
      });
      setIsOpen(false);
      return;
    }

    publishLiveSessionEvent({
      type: "FORCE_LOGOUT",
      userId: currentUserId,
      reason: "LEFT",
    });
    logout();
  }

  async function endAdminWorkout() {
    const confirmed =
      window.confirm(
        "오늘 운동을 종료하시겠습니까? 모든 참가자가 로그아웃되고 오늘 대시보드가 초기화됩니다."
      );

    if (!confirmed) {
      return;
    }

    try {
      await closeWorkout();
      endTodaySession();
      publishLiveSessionEvent({
        type: "WORKOUT_CLOSED",
        workoutDate:
          getKstDateKey(),
      });
      publishLiveSessionEvent({
        type: "END_TODAY",
        reason: "ADMIN_END",
      });
      clearAccessSession();
      setIsOpen(false);
      navigate("/");
    } catch (error) {
      console.error(error);
      window.alert(
        "오늘 운동 종료 처리에 실패했습니다."
      );
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur sm:px-6">
        <div className="mx-auto flex h-11 max-w-screen-2xl items-center gap-3">
          <NavLink
            to={homePath}
            className={({ isActive }) => `
              flex
              h-10
              items-center
              rounded-lg
              px-4
              text-sm
              font-bold
              ${
                isActive
                  ? "bg-lime-400 text-black"
                  : "bg-slate-800 text-white"
              }
            `}
          >
            Home
          </NavLink>

          <div className="min-w-0 flex-1 text-right">
            <div className="truncate text-sm font-bold text-white">
              {session.userName}
              <span className="ml-2 text-xs font-medium text-cyan-300">
                {roleLabels[session.role]}
                {sessionModeLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setIsOpen(true)
            }
            aria-label="전체 메뉴 열기"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-white"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {isOpen && (
        <div className="fixed inset-0 z-[100]">
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() =>
              setIsOpen(false)
            }
            className="absolute inset-0 bg-black/60"
          />

          <aside className="absolute right-0 top-0 flex h-full w-[min(86vw,340px)] flex-col border-l border-slate-800 bg-slate-950 p-5 text-white shadow-2xl">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="font-bold">
                  {session.userName}
                </div>
                <div className="text-sm text-cyan-300">
                  {roleLabels[session.role]}
                </div>
              </div>
              <button
                type="button"
                aria-label="메뉴 닫기"
                onClick={() =>
                  setIsOpen(false)
                }
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="space-y-2">
              <NavLink
                to={homePath}
                onClick={() =>
                  setIsOpen(false)
                }
                className="block rounded-xl bg-slate-900 px-4 py-4 font-bold"
              >
                Home 대시보드
              </NavLink>

              <NavLink
                to="/participants"
                onClick={() =>
                  setIsOpen(false)
                }
                className="block rounded-xl bg-slate-900 px-4 py-4 font-bold"
              >
                오늘 참가자
              </NavLink>

              {session.role ===
                "PLAYER" && (
                <NavLink
                  to="/fixed-partner"
                  onClick={() =>
                    setIsOpen(false)
                  }
                  className="block rounded-xl bg-slate-900 px-4 py-4 font-bold"
                >
                  고정 파트너 신청
                </NavLink>
              )}

              {canManage(
                session.role
              ) && (
                <NavLink
                  to="/attendance"
                  onClick={() =>
                    setIsOpen(false)
                  }
                  className="block rounded-xl bg-slate-900 px-4 py-4 font-bold"
                >
                  월별 출석현황
                </NavLink>
              )}

              <NavLink
                to="/my"
                onClick={() =>
                  setIsOpen(false)
                }
                className="block rounded-xl bg-slate-900 px-4 py-4 font-bold"
              >
                My 페이지
              </NavLink>
            </nav>

            <div className="mt-auto space-y-2">
              {isParticipant && (
                <button
                  type="button"
                  onClick={
                    endPersonalWorkout
                  }
                  className="w-full rounded-xl bg-amber-400 px-4 py-4 text-left font-bold text-black"
                >
                  개인 운동 종료
                </button>
              )}

              {canManage(
                session.role
              ) && (
                <button
                  type="button"
                  onClick={
                    endAdminWorkout
                  }
                  className="w-full rounded-xl bg-amber-400 px-4 py-4 text-left font-bold text-black"
                >
                  오늘 모임 전체 운동 종료
                </button>
              )}

              <button
                type="button"
                onClick={logout}
                className="w-full rounded-xl bg-slate-800 px-4 py-4 text-left font-bold"
              >
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
