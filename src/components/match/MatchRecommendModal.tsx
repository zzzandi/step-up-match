import {
  useMatchStore,
} from "@/store/useMatchStore";
import {
  useAccessSession,
} from "@/auth/access";

const text = {
  title: "\uCD94\uCC9C \uB300\uC9C4",
  reroll: "\uB2E4\uC2DC \uCD94\uCC9C",
  total: "\uCD1D\uC810",
  selected: "\uC120\uD0DD\uB428",
  balance:
    "\uC2E4\uB825 \uBC38\uB7F0\uC2A4",
  partnerDiversity:
    "\uD30C\uD2B8\uB108 \uC911\uBCF5 \uBC29\uC9C0",
  opponentDiversity:
    "\uC0C1\uB300 \uC911\uBCF5 \uBC29\uC9C0",
  gender:
    "\uC131\uBCC4 \uBC38\uB7F0\uC2A4",
  partnerPenalty:
    "\uD30C\uD2B8\uB108 \uAC10\uC810",
  fixed:
    "\uACE0\uC815 \uD30C\uD2B8\uB108",
  goodBalance:
    "\uC2E4\uB825 \uADE0\uD615 \uC88B\uC74C",
  recentPartner:
    "\uCD5C\uADFC \uD30C\uD2B8\uB108 \uC911\uBCF5",
  recentOpponent:
    "\uCD5C\uADFC \uC0C1\uB300 \uC911\uBCF5",
  genderBonus:
    "\uC131\uBCC4 \uC870\uD569 \uC810\uC218",
  start: "\uACBD\uAE30 \uC2DC\uC791",
  confirmQueue:
    "\uB300\uAE30 \uB300\uC9C4 \uD655\uC815",
  close: "\uB2EB\uAE30",
};

export default function MatchRecommendModal() {
  const session =
    useAccessSession();
  const operator =
    session
      ? {
          id: session.userId,
          name: session.userName,
          role: session.role,
        }
      : undefined;
  const recommendations =
    useMatchStore(
      (state) =>
        state.recommendations
    );
  const selectedRecommendation =
    useMatchStore(
      (state) =>
        state.selectedRecommendation
    );
  const recommendationTarget =
    useMatchStore(
      (state) =>
        state.recommendationTarget
    );
  const selectRecommendation =
    useMatchStore(
      (state) =>
        state.selectRecommendation
    );
  const approveRecommendation =
    useMatchStore(
      (state) =>
        state.approveRecommendation
    );
  const clearRecommendation =
    useMatchStore(
      (state) =>
        state.clearRecommendation
    );
  const rerollRecommendations =
    useMatchStore(
      (state) =>
        state.rerollRecommendations
    );

  if (
    recommendations.length === 0
  ) {
    return null;
  }

  const courtId =
    recommendations[0]?.courtId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="max-h-[90vh] w-[800px] overflow-y-auto rounded-3xl bg-slate-900 p-8 text-white">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {text.title}
          </h2>
          <button
            type="button"
            onClick={() =>
              rerollRecommendations(
                courtId,
                recommendationTarget
              )
            }
            className="rounded-xl bg-blue-500 px-4 py-2 font-semibold text-white"
          >
            {text.reroll}
          </button>
        </div>

        <div className="space-y-4">
          {recommendations.map(
            (recommendation) => (
              <button
                key={recommendation.id}
                type="button"
                onClick={() =>
                  selectRecommendation(
                    recommendation.id
                  )
                }
                className={`w-full rounded-2xl border p-5 text-left transition ${
                  selectedRecommendation?.id ===
                  recommendation.id
                    ? "border-lime-400 bg-slate-800"
                    : "border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold text-lime-400">
                    {text.total}{" "}
                    {
                      recommendation.score
                        .total
                    }
                  </div>
                  {selectedRecommendation?.id ===
                    recommendation.id && (
                    <div className="rounded-full bg-lime-400 px-3 py-1 text-xs font-bold text-black">
                      {text.selected}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <div className="font-semibold">
                    {
                      recommendation.teamA[0]
                        .name
                    }{" "}
                    +{" "}
                    {
                      recommendation.teamA[1]
                        .name
                    }
                  </div>
                  <div className="my-2 text-slate-400">
                    VS
                  </div>
                  <div className="font-semibold">
                    {
                      recommendation.teamB[0]
                        .name
                    }{" "}
                    +{" "}
                    {
                      recommendation.teamB[1]
                        .name
                    }
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    {text.balance}:{" "}
                    {
                      recommendation.score
                        .balance
                    }
                    /40
                  </div>
                  <div>
                    {text.partnerDiversity}:{" "}
                    {recommendation.score
                      .partnerDiversity ??
                      0}
                    /30
                  </div>
                  <div>
                    {text.opponentDiversity}:{" "}
                    {recommendation.score
                      .opponentDiversity ??
                      0}
                    /20
                  </div>
                  <div>
                    {text.gender}:{" "}
                    {
                      recommendation.score
                        .genderBonus
                    }
                    /10
                  </div>
                  <div>
                    {text.partnerPenalty}:{" "}
                    {
                      recommendation.score
                        .partnerPenalty
                    }
                  </div>
                  <div>
                    {text.fixed}:{" "}
                    {
                      recommendation.score
                        .fixedPartnerBonus
                    }
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {recommendation.score
                    .balance >= 35 && (
                    <span className="rounded-lg bg-green-500/20 px-2 py-1 text-xs text-green-400">
                      {text.goodBalance}
                    </span>
                  )}
                  {recommendation.score
                    .partnerPenalty < 0 && (
                    <span className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-400">
                      {text.recentPartner}
                    </span>
                  )}
                  {recommendation.score
                    .opponentPenalty < 0 && (
                    <span className="rounded-lg bg-yellow-500/20 px-2 py-1 text-xs text-yellow-400">
                      {text.recentOpponent}
                    </span>
                  )}
                  {recommendation.score
                    .genderBonus > 0 && (
                    <span className="rounded-lg bg-pink-500/20 px-2 py-1 text-xs text-pink-400">
                      {text.genderBonus}
                    </span>
                  )}
                  {recommendation.score
                    .fixedPartnerBonus >
                    0 && (
                    <span className="rounded-lg bg-blue-500/20 px-2 py-1 text-xs text-blue-400">
                      {text.fixed}
                    </span>
                  )}
                </div>
              </button>
            )
          )}
        </div>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() =>
              approveRecommendation(
                undefined,
                operator
              )
            }
            disabled={
              !selectedRecommendation
            }
            className="flex-1 rounded-xl bg-lime-400 py-3 font-bold text-black disabled:opacity-50"
          >
            {recommendationTarget === "QUEUE"
              ? text.confirmQueue
              : text.start}
          </button>
          <button
            type="button"
            onClick={clearRecommendation}
            className="flex-1 rounded-xl bg-slate-700 py-3 font-bold"
          >
            {text.close}
          </button>
        </div>
      </div>
    </div>
  );
}
