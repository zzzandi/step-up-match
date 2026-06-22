import {
  useEffect,
  useState,
} from "react";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import {
  getUsers,
} from "@/services/supabaseUserService";

export default function MatchHistoryPanel() {
  const matchHistory =
    useMatchStore(
      (state) =>
        state.matchHistory
    );

  const players =
    useMatchStore(
      (state) =>
        state.players
    );

  const [
    memberNames,
    setMemberNames,
  ] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    getUsers()
      .then((users) => {
        setMemberNames(
          Object.fromEntries(
            (users ?? []).map(
              (user) => [
                user.id,
                user.name,
              ]
            )
          )
        );
      })
      .catch(console.error);
  }, []);

  const getPlayerName = (
    playerId: string,
    playerNames?: Record<
      string,
      string
    >
  ) =>
    players.find(
      (player) =>
        player.id === playerId
    )?.name ??
    playerNames?.[playerId] ??
    memberNames[playerId] ??
    "알 수 없음";

  const recentHistory =
    [...matchHistory]
      .sort(
        (a, b) =>
          new Date(
            b.endedAt
          ).getTime() -
          new Date(
            a.endedAt
          ).getTime()
      )
      .slice(0, 10);

  return (
    <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800">
      <h2 className="text-xl font-bold mb-5">
        최근 경기
      </h2>

      {recentHistory.length === 0 && (
        <div className="text-slate-500">
          아직 경기 기록이 없습니다.
        </div>
      )}

      <div className="space-y-3">
        {recentHistory.map(
          (history) => (
            <div
              key={history.id}
              className="
                rounded-2xl
                bg-slate-800
                p-4
              "
            >
              <div className="flex items-center justify-between gap-3 text-sm text-slate-400 mb-2">
                <span>
                  Court {history.courtId}
                </span>

                <span>
                  {new Date(
                    history.endedAt
                  ).toLocaleTimeString()}
                </span>
              </div>

              <div>
                {getPlayerName(
                  history.teamA[0],
                  history.playerNames
                )}
                {" + "}
                {getPlayerName(
                  history.teamA[1],
                  history.playerNames
                )}
              </div>

              <div className="my-1 text-slate-400">
                VS
              </div>

              <div>
                {getPlayerName(
                  history.teamB[0],
                  history.playerNames
                )}
                {" + "}
                {getPlayerName(
                  history.teamB[1],
                  history.playerNames
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
