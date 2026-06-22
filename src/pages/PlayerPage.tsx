import {
  useEffect,
  useState,
} from "react";

import CourtCard from "@/components/court/CourtCard";
import MatchHistoryPanel from "@/components/history/MatchHistoryPanel";
import WaitingList from "@/components/waiting/WaitingList";
import {
  clearAccessSession,
  useAccessSession,
} from "@/auth/access";
import {
  getActiveWorkoutAttendanceList,
} from "@/services/attendanceService";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import type { Player } from "@/types/player";
import {
  useNavigate,
} from "react-router-dom";
import {
  uniqueByUserId,
} from "@/utils/participants";

export default function PlayerPage() {
  const navigate =
    useNavigate();
  const session =
    useAccessSession();

  const [
    ,
    setAttendanceList,
  ] = useState<any[]>([]);

  const players =
    useMatchStore(
      (state) => state.players
    );

  const courts =
    useMatchStore(
      (state) => state.courts
    );

  const setPlayers =
    useMatchStore(
      (state) => state.setPlayers
    );

  const setCourts =
    useMatchStore(
      (state) => state.setCourts
    );

  const notifications =
    useMatchStore(
      (state) =>
        state.notifications
    );

  const dismissNotification =
    useMatchStore(
      (state) =>
        state.dismissNotification
    );

  const dismissNotifications =
    useMatchStore(
      (state) =>
        state.dismissNotifications
    );

  useEffect(() => {
    if (
      session?.participationMode ===
      "PENDING"
    ) {
      return;
    }

    getActiveWorkoutAttendanceList()
      .then((data) => {
        const uniqueAttendance =
          uniqueByUserId(data);

        setAttendanceList(
          uniqueAttendance
        );

        if (
          uniqueAttendance.length ===
          0
        ) {
          setPlayers([]);
          setCourts([]);
          return;
        }

        if (players.length > 0) {
          const existingIds =
            new Set(
              players.map(
                (player) => player.id
              )
            );

          const newPlayers =
            uniqueAttendance
              .filter(
                (attendance: any) =>
                  !existingIds.has(
                    attendance.users.id
                  )
              )
              .map(
                (attendance: any) => ({
                  id:
                    attendance.users.id,
                  name:
                    attendance.users.name,
                  gender:
                    attendance.users.gender ??
                    "M",
                  grade:
                    attendance.users.grade,
                  hiddenSkill:
                    attendance.users.hidden_skill,
                  isPresent: true,
                  arrivalTime:
                    new Date(
                      attendance.arrival_time ??
                        Date.now()
                    ),
                  matchCount: 0,
                  consecutiveMatches: 0,
                  status: "WAITING" as const,
                  waitingStartedAt:
                    new Date(
                      attendance.arrival_time ??
                        Date.now()
                    ),
                  lastPartners: [],
                  lastOpponents: [],
                })
              );

          if (newPlayers.length > 0) {
            setPlayers([
              ...players,
              ...newPlayers,
            ]);
          }

          return;
        }

        const playerList: Player[] =
          uniqueAttendance.map(
            (attendance: any) => ({
              id: attendance.users.id,
              name:
                attendance.users.name,
              gender:
                attendance.users.gender ??
                "M",
              grade:
                attendance.users.grade,
              hiddenSkill:
                attendance.users.hidden_skill,
              isPresent: true,
              arrivalTime:
                new Date(
                  attendance.arrival_time ??
                    Date.now()
                ),
              matchCount: 0,
              consecutiveMatches: 0,
              status: "WAITING",
              waitingStartedAt:
                new Date(
                  attendance.arrival_time ??
                    Date.now()
                ),
              lastPartners: [],
              lastOpponents: [],
            })
          );

        setPlayers(playerList);

        if (courts.length === 0) {
          setCourts([
            {
              id: 1,
              status: "EMPTY",
              teamA: null,
              teamB: null,
              startedAt: null,
            },
            {
              id: 2,
              status: "EMPTY",
              teamA: null,
              teamB: null,
              startedAt: null,
            },
            {
              id: 3,
              status: "EMPTY",
              teamA: null,
              teamB: null,
              startedAt: null,
            },
          ]);
        }
      })
      .catch(console.error);
  }, [
    session?.participationMode,
  ]);

  const waitingPlayers =
    players.filter(
      (player) =>
        player.status === "WAITING"
    );

  const playingPlayers =
    players.filter(
      (player) =>
        player.status === "PLAYING"
    );

  const currentPlayer =
    players.find(
      (player) =>
        player.id ===
        session?.userId
    );

  const playerNotifications =
    notifications.filter(
      (notification) =>
        notification.audience ===
          "PLAYER" &&
        notification.recipientId ===
          session?.userId
    );

  if (
    session?.participationMode ===
    "PENDING"
  ) {
    return (
      <main className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-slate-950 p-6 text-white">
        <div className="w-full max-w-xl rounded-3xl border border-amber-400/30 bg-slate-900 p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/15 text-3xl">
            🏸
          </div>
          <p className="text-sm font-bold text-amber-300">
            오늘 운동 미개설
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            운영진이 아직 오늘 운동을 열지 않았습니다
          </h1>
          <p className="mt-4 leading-7 text-slate-400">
            이 화면에서 기다리면 됩니다.
            Admin 또는 Master가 오늘
            운동을 열면 자동으로 출석 처리되고
            대기열과 대시보드로 전환됩니다.
          </p>
          <div className="mt-6 rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-300">
            {session.userName}님 참가 대기 중
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">
            STEP UP MATCH
          </h1>

          <p className="text-slate-400 mt-2">
            Player View
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-2 overflow-x-auto [&>div]:min-w-[76px] [&>div]:rounded-xl [&>div]:p-3 [&>div>div:last-child]:mt-1 [&>div>div:last-child]:text-2xl">
        <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
          <div className="text-slate-400 text-sm">
            참가자
          </div>

          <div className="text-3xl font-bold mt-2">
            {players.length}
          </div>
        </div>

        <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
          <div className="text-slate-400 text-sm">
            경기중
          </div>

          <div className="text-3xl font-bold mt-2">
            {playingPlayers.length}
          </div>
        </div>

        <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
          <div className="text-slate-400 text-sm">
            대기중
          </div>

          <div className="text-3xl font-bold mt-2">
            {waitingPlayers.length}
          </div>
        </div>

        <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
          <div className="text-slate-400 text-sm">
            코트 수
          </div>

          <div className="text-3xl font-bold mt-2">
            {courts.length}
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
        <span className="text-sm text-slate-400">
          현재 내 상태
        </span>
        <span className="rounded-lg bg-cyan-400/15 px-3 py-1 text-sm font-bold text-cyan-300">
          {currentPlayer?.status ===
          "PLAYING"
            ? "경기 중"
            : currentPlayer?.status ===
                "WAITING"
              ? "대기 중"
              : "운동 종료"}
        </span>
      </div>

      {playerNotifications.length > 0 && (
        <div className="mb-8 rounded-3xl bg-slate-900 p-6 border border-cyan-500/30">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              내 알림
            </h2>

            <button
              type="button"
              onClick={() =>
                dismissNotifications(
                  playerNotifications.map(
                    (notification) =>
                      notification.id
                  )
                )
              }
              className="
                rounded-lg
                bg-cyan-500
                px-3
                py-2
                text-sm
                font-bold
                text-slate-950
              "
            >
              전체 확인
            </button>
          </div>

          <div className="space-y-3">
            {playerNotifications.map(
              (notification) => (
                <div
                  key={notification.id}
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                    rounded-xl
                    bg-slate-800
                    px-4
                    py-3
                  "
                >
                  <div className="text-slate-200">
                    {notification.message}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      dismissNotification(
                        notification.id
                      )
                    }
                    className="
                      rounded-lg
                      bg-slate-700
                      px-3
                      py-1
                      text-sm
                    "
                  >
                    확인
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {courts.map(
          (court) => (
            <CourtCard
              key={court.id}
              court={court}
              readOnly
            />
          )
        )}
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-6">
        <WaitingList
          players={
            waitingPlayers
          }
          readOnly
          leaveablePlayerIds={
            session?.userId
              ? [session.userId]
              : []
          }
          onLeave={() => {
            clearAccessSession();
            navigate("/");
          }}
        />

        <MatchHistoryPanel />
      </div>

    </div>
  );
}
