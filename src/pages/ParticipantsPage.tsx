import {
  Navigate,
} from "react-router-dom";

import {
  useAccessSession,
} from "@/auth/access";
import {
  useMatchStore,
} from "@/store/useMatchStore";

const statusLabels = {
  WAITING: "대기 중",
  PLAYING: "경기 중",
  LEFT: "운동 종료",
};

export default function ParticipantsPage() {
  const session =
    useAccessSession();
  const players =
    useMatchStore(
      (state) => state.players
    );

  if (!session) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  const activePlayers =
    players.filter(
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

        {activePlayers.length === 0 ? (
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
                      {player.grade}등급 · {player.matchCount}경기
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
