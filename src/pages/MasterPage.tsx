import { useMatchStore } from "@/store/useMatchStore";

export default function MasterPage() {
  const players =
    useMatchStore(
      (state) => state.players
    );

  const courts =
    useMatchStore(
      (state) => state.courts
    );

  const matchHistory =
    useMatchStore(
      (state) =>
        state.matchHistory
    );

  const totalMatches =
    matchHistory.length;

  const playingCount =
    players.filter(
      (player) =>
        player.status === "PLAYING"
    ).length;

  const waitingCount =
    players.filter(
      (player) =>
        player.status === "WAITING"
    ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">
          MASTER DASHBOARD
        </h1>

        <p className="text-slate-400 mt-2">
          STEP UP MATCH
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
          <div className="text-slate-400 text-sm">
            총 참가자
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
            {playingCount}
          </div>
        </div>

        <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
          <div className="text-slate-400 text-sm">
            대기중
          </div>

          <div className="text-3xl font-bold mt-2">
            {waitingCount}
          </div>
        </div>

        <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
          <div className="text-slate-400 text-sm">
            총 경기수
          </div>

          <div className="text-3xl font-bold mt-2">
            {totalMatches}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-3xl bg-slate-900 p-6 border border-slate-800">
        <h2 className="text-xl font-bold mb-4">
          선수 통계
        </h2>

        <div className="space-y-3">
          {players
            .sort(
              (a, b) =>
                b.matchCount -
                a.matchCount
            )
            .map((player) => (
              <div
                key={player.id}
                className="
                  flex
                  justify-between
                  rounded-xl
                  bg-slate-800
                  px-4
                  py-3
                "
              >
                <div>
                  {player.name}
                </div>

                <div className="text-lime-400">
                  {player.matchCount} 경기
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}