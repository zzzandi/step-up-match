import {
    useMatchStore,
  } from "@/store/useMatchStore";
  
  export default function MatchRecommendModal() {
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
      recommendations[0]
        ?.courtId;
  
    return (
      <div
        className="
          fixed
          inset-0
          bg-black/70
          flex
          items-center
          justify-center
          z-50
        "
      >
        <div
          className="
            bg-slate-900
            rounded-3xl
            p-8
            w-[800px]
            max-h-[90vh]
            overflow-y-auto
            text-white
          "
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">
              추천 대진
            </h2>
  
            <button
              onClick={() =>
                rerollRecommendations(
                  courtId
                )
              }
              className="
                px-4
                py-2
                rounded-xl
                bg-blue-500
                text-white
                font-semibold
              "
            >
              재추천
            </button>
          </div>
  
          <div className="space-y-4">
            {recommendations.map(
              (
                recommendation
              ) => (
                <button
                  key={
                    recommendation.id
                  }
                  onClick={() =>
                    selectRecommendation(
                      recommendation.id
                    )
                  }
                  className={`
                    w-full
                    rounded-2xl
                    border
                    p-5
                    text-left
                    transition
  
                    ${
                      selectedRecommendation?.id ===
                      recommendation.id
                        ? "border-lime-400 bg-slate-800"
                        : "border-slate-700"
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-bold text-lime-400">
                      총점
                      {" "}
                      {
                        recommendation
                          .score.total
                      }
                    </div>
  
                    {selectedRecommendation?.id ===
                      recommendation.id && (
                      <div className="text-xs bg-lime-400 text-black px-3 py-1 rounded-full font-bold">
                        선택됨
                      </div>
                    )}
                  </div>
  
                  <div className="mt-4">
                    <div className="font-semibold">
                      {
                        recommendation
                          .teamA[0]
                          .name
                      }
                      {" + "}
                      {
                        recommendation
                          .teamA[1]
                          .name
                      }
                    </div>
  
                    <div className="my-2 text-slate-400">
                      VS
                    </div>
  
                    <div className="font-semibold">
                      {
                        recommendation
                          .teamB[0]
                          .name
                      }
                      {" + "}
                      {
                        recommendation
                          .teamB[1]
                          .name
                      }
                    </div>
                  </div>
  
                  <div className="grid grid-cols-3 gap-3 mt-5 text-sm">
  <div>
    실력 : {recommendation.score.balance}
  </div>

  <div>
    섞기 : {recommendation.score.diversity ?? 0}
  </div>

  <div>
    파트너 : {recommendation.score.partnerPenalty}
  </div>

  <div>
    상대 : {recommendation.score.opponentPenalty}
  </div>

  <div>
    성별 : {recommendation.score.genderBonus}
  </div>

  <div>
    고정 : {recommendation.score.fixedPartnerBonus}
  </div>
</div>
  
                  <div className="flex flex-wrap gap-2 mt-4">
                    {recommendation
                      .score.balance >=
                      35 && (
                      <span
                        className="
                          px-2
                          py-1
                          rounded-lg
                          bg-green-500/20
                          text-green-400
                          text-xs
                        "
                      >
                        실력 균형 우수
                      </span>
                    )}
  
                    {recommendation
                      .score
                      .partnerPenalty <
                      0 && (
                      <span
                        className="
                          px-2
                          py-1
                          rounded-lg
                          bg-red-500/20
                          text-red-400
                          text-xs
                        "
                      >
                        최근 파트너 중복
                      </span>
                    )}
  
                    {recommendation
                      .score
                      .opponentPenalty <
                      0 && (
                      <span
                        className="
                          px-2
                          py-1
                          rounded-lg
                          bg-yellow-500/20
                          text-yellow-400
                          text-xs
                        "
                      >
                        최근 상대 중복
                      </span>
                    )}
  
                    {recommendation
                      .score
                      .genderBonus >
                      0 && (
                      <span
                        className="
                          px-2
                          py-1
                          rounded-lg
                          bg-pink-500/20
                          text-pink-400
                          text-xs
                        "
                      >
                        성별 조합 우수
                      </span>
                    )}
  
                    {recommendation
                      .score
                      .fixedPartnerBonus >
                      0 && (
                      <span
                        className="
                          px-2
                          py-1
                          rounded-lg
                          bg-blue-500/20
                          text-blue-400
                          text-xs
                        "
                      >
                        고정 파트너
                      </span>
                    )}
                  </div>
                </button>
              )
            )}
          </div>
  
          <div className="flex gap-3 mt-8">
            <button
              onClick={
                approveRecommendation
              }
              disabled={
                !selectedRecommendation
              }
              className="
                flex-1
                bg-lime-400
                text-black
                rounded-xl
                py-3
                font-bold
                disabled:opacity-50
              "
            >
              경기 시작
            </button>
  
            <button
              onClick={
                clearRecommendation
              }
              className="
                flex-1
                bg-slate-700
                rounded-xl
                py-3
                font-bold
              "
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }