import {
  useEffect,
  useState,
} from "react";
import {
  Navigate,
} from "react-router-dom";

import {
  useAccessSession,
} from "@/auth/access";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import {
  getActiveWorkoutAttendanceList,
} from "@/services/attendanceService";
import type {
  Player,
} from "@/types/player";
import {
  uniqueByUserId,
} from "@/utils/participants";

const statusLabels = {
  WAITING: "대기 중",
  PLAYING: "경기 중",
  LEFT: "운동 종료",
};

interface AttendanceUser {
  id: string;
  name: string;
  gender?: "M" | "F" | null;
  grade: Player["grade"];
  hidden_skill: number;
}

interface AttendanceRow {
  users: AttendanceUser;
  arrival_time?: string;
  match_count?: number;
  consecutive_matches?: number;
  status?: Player["status"];
  waiting_started_at?: string;
}

export default function ParticipantsPage() {
  const session =
    useAccessSession();
  const players =
    useMatchStore(
      (state) => state.players
    );
  const [attendancePlayers, setAttendancePlayers] =
    useState<Player[]>([]);
  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    getActiveWorkoutAttendanceList()
      .then((data) => {
        const mapped =
          uniqueByUserId(data)
            .map(
              (
                attendance: AttendanceRow
              ) => ({
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
                matchCount:
                  attendance.match_count ??
                  0,
                consecutiveMatches:
                  attendance.consecutive_matches ??
                  0,
                status:
                  attendance.status ??
                  "WAITING",
                waitingStartedAt:
                  attendance.waiting_started_at
                    ? new Date(
                        attendance.waiting_started_at
                      )
                    : new Date(
                        attendance.arrival_time ??
                          Date.now()
                      ),
                lastPartners: [],
                lastOpponents: [],
              })
            ) as Player[];

        setAttendancePlayers(
          mapped
        );
      })
      .catch(console.error)
      .finally(() =>
        setLoading(false)
      );
  }, []);

  if (!session) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  const activePlayers =
    attendancePlayers
      .map(
        (attendancePlayer) =>
          players.find(
            (player) =>
              player.id ===
              attendancePlayer.id
          ) ??
          attendancePlayer
      )
      .filter(
      (player) =>
        player.status !== "LEFT" &&
        player.isPresent
      );

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-screen-lg">
        <div className="mb-6">
          <p className="text-sm font-bold text-cyan-300">
            TODAY
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            오늘 참가자
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            현재 운동에 참여 중인 회원 {activePlayers.length}명
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
            오늘 참가자를 불러오는 중...
          </div>
        ) : activePlayers.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
            현재 참가 중인 회원이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            {activePlayers.map(
              (player, index) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-sm font-bold text-slate-300">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">
                      {player.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {session.role ===
                        "MASTER" && (
                        <>
                          {player.grade}
                          등급 ·{" "}
                        </>
                      )}
                      {player.matchCount}경기
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
                      player.status ===
                      "PLAYING"
                        ? "bg-lime-400/15 text-lime-300"
                        : "bg-cyan-400/15 text-cyan-300"
                    }`}
                  >
                    {statusLabels[player.status]}
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}
