import {
    useMatchStore,
  } from "@/store/useMatchStore";
  
  export default function MatchHistoryPanel() {
    const matchHistory =
      useMatchStore(
        (state) =>
          state.matchHistory
      );
  
    return (
      <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800">
        <h2 className="text-xl font-bold mb-5">
          최근 경기
        </h2>
  
        {matchHistory.length === 0 && (
          <div className="text-slate-500">
            아직 경기 기록이 없습니다.
          </div>
        )}
  
        <div className="space-y-3">
          {matchHistory
            .slice(0, 10)
            .map(
              (history) => (
                <div
                  key={
                    history.id
                  }
                  className="
                    rounded-2xl
                    bg-slate-800
                    p-4
                  "
                >
                  <div className="text-sm text-slate-400 mb-2">
                    {new Date(
                      history.finishedAt
                    ).toLocaleTimeString()}
                  </div>
  
                  <div>
                    {
                      history.teamA[0]
                        .name
                    }
                    {" + "}
                    {
                      history.teamA[1]
                        .name
                    }
                  </div>
  
                  <div className="my-1 text-slate-400">
                    VS
                  </div>
  
                  <div>
                    {
                      history.teamB[0]
                        .name
                    }
                    {" + "}
                    {
                      history.teamB[1]
                        .name
                    }
                  </div>
                </div>
              )
            )}
        </div>
      </div>
    );
  }