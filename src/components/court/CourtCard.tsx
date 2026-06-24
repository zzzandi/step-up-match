import {
  useEffect,
  useState,
} from "react";

import type { Court } from "@/types/court";
import {
  useMatchStore,
} from "@/store/useMatchStore";

function formatDuration(
  startedAt: Date | null
) {
  if (!startedAt) {
    return "00:00";
  }

  const seconds =
    Math.floor(
      (Date.now() -
        new Date(startedAt).getTime()) /
        1000
    );

  const minutes =
    Math.floor(seconds / 60);
  const remainSeconds =
    seconds % 60;

  return `${minutes
    .toString()
    .padStart(2, "0")}:${remainSeconds
    .toString()
    .padStart(2, "0")}`;
}

interface CourtCardProps {
  court: Court;
  readOnly?: boolean;
  matchTarget?: "GAME" | "QUEUE";
}

export default function CourtCard({
  court,
  readOnly = false,
  matchTarget = "GAME",
}: CourtCardProps) {
  const finishCourtMatch =
    useMatchStore(
      (state) =>
        state.finishCourtMatch
    );
  const rerollRecommendations =
    useMatchStore(
      (state) =>
        state.rerollRecommendations
    );
  const replaceCourtPlayer =
    useMatchStore(
      (state) =>
        state.replaceCourtPlayer
    );
  const assignManualMatch =
    useMatchStore(
      (state) =>
        state.assignManualMatch
    );
  const swapCourtPlayers =
    useMatchStore(
      (state) =>
        state.swapCourtPlayers
    );
  const players =
    useMatchStore(
      (state) =>
        state.players
    );

  const waitingPlayers =
    players.filter(
      (player) =>
        player.status ===
          "WAITING" &&
        player.isPresent
    );

  const [
    isReplacementOpen,
    setIsReplacementOpen,
  ] = useState(false);
  const [
    outgoingPlayerId,
    setOutgoingPlayerId,
  ] = useState("");
  const [
    incomingPlayerId,
    setIncomingPlayerId,
  ] = useState("");
  const [
    isManualMatchOpen,
    setIsManualMatchOpen,
  ] = useState(false);
  const [
    manualPlayerIds,
    setManualPlayerIds,
  ] = useState([
    "",
    "",
    "",
    "",
  ]);
  const [
    isCourtSwapOpen,
    setIsCourtSwapOpen,
  ] = useState(false);
  const [
    firstSwapPlayerId,
    setFirstSwapPlayerId,
  ] = useState("");
  const [
    secondSwapPlayerId,
    setSecondSwapPlayerId,
  ] = useState("");
  const [duration, setDuration] =
    useState(
      formatDuration(
        court.startedAt
      )
    );

  useEffect(() => {
    const timer =
      setInterval(() => {
        setDuration(
          formatDuration(
            court.startedAt
          )
        );
      }, 1000);

    return () =>
      clearInterval(timer);
  }, [court.startedAt]);

  if (
    !court.teamA ||
    !court.teamB
  ) {
    return (
      <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800">
        <div className="flex justify-between mb-4">
          <h2 className="font-bold text-xl">
            Court {court.id}
          </h2>

          <span className="text-xs px-3 py-1 rounded-full bg-slate-700 text-slate-300">
            EMPTY
          </span>
        </div>

        <div className="mt-6 text-slate-500">
          鍮꾩뼱?덉쓬
        </div>

        {!readOnly && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  rerollRecommendations(
                    court.id,
                    matchTarget
                  )
                }
                className="rounded-xl bg-blue-500 py-3 font-bold text-white"
              >
                ?먮룞 ?吏?              </button>
              <button
                type="button"
                onClick={() =>
                  setIsManualMatchOpen(
                    true
                  )
                }
                className="rounded-xl bg-cyan-400 py-3 font-bold text-slate-950"
              >
                ?섎룞 ?吏?              </button>
            </div>

            {isManualMatchOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-cyan-500/30 bg-slate-900 p-6">
                  <div className="mb-2 text-xl font-bold">
                    Court {court.id} ?섎룞 ?吏?                  </div>
                  <p className="mb-5 text-sm text-slate-400">
                    ?湲곗옄 以?4紐낆쓣 吏곸젒 ?좏깮?????援ъ꽦?섏꽭??
                  </p>

                  <div className="grid gap-5 md:grid-cols-2">
                    {[
                      "A? ?좎닔 1",
                      "A? ?좎닔 2",
                      "B? ?좎닔 1",
                      "B? ?좎닔 2",
                    ].map(
                      (label, index) => (
                        <label
                          key={label}
                          className="block"
                        >
                          <span className="mb-2 block text-sm font-bold text-slate-300">
                            {label}
                          </span>
                          <select
                            value={
                              manualPlayerIds[
                                index
                              ]
                            }
                            onChange={(
                              event
                            ) =>
                              setManualPlayerIds(
                                (
                                  current
                                ) =>
                                  current.map(
                                    (
                                      value,
                                      itemIndex
                                    ) =>
                                      itemIndex ===
                                      index
                                        ? event
                                            .target
                                            .value
                                        : value
                                  )
                              )
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white"
                          >
                            <option value="">
                              ?좎닔瑜??좏깮?섏꽭??                            </option>
                            {waitingPlayers.map(
                              (player) => (
                                <option
                                  key={
                                    player.id
                                  }
                                  value={
                                    player.id
                                  }
                                  disabled={manualPlayerIds.some(
                                    (
                                      selectedId,
                                      selectedIndex
                                    ) =>
                                      selectedIndex !==
                                        index &&
                                      selectedId ===
                                        player.id
                                  )}
                                >
                                  {
                                    player.name
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </label>
                      )
                    )}
                  </div>

                  {waitingPlayers.length <
                    4 && (
                    <div className="mt-4 text-sm text-amber-300">
                      ?섎룞 ?吏꾩뿉???湲곗옄 4紐낆씠 ?꾩슂?⑸땲??
                    </div>
                  )}

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      disabled={
                        manualPlayerIds.some(
                          (playerId) =>
                            !playerId
                        ) ||
                        new Set(
                          manualPlayerIds
                        ).size !== 4
                      }
                      onClick={() => {
                        const assigned =
                          assignManualMatch(
                            court.id,
                            [
                              manualPlayerIds[0],
                              manualPlayerIds[1],
                            ],
                            [
                              manualPlayerIds[2],
                              manualPlayerIds[3],
                            ],
                            matchTarget
                          );

                        if (!assigned) {
                          window.alert(
                            "?좎닔 ?곹깭媛 蹂寃쎈릺?덇굅??肄뷀듃媛 ?대? ?ъ슜 以묒엯?덈떎. ?꾩옱 ?湲곗뿴???뺤씤?댁＜?몄슂."
                          );
                          return;
                        }

                        setManualPlayerIds(
                          [
                            "",
                            "",
                            "",
                            "",
                          ]
                        );
                        setIsManualMatchOpen(
                          false
                        );
                      }}
                      className="flex-1 rounded-xl bg-cyan-400 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      寃쎄린 ?쒖옉
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManualPlayerIds(
                          [
                            "",
                            "",
                            "",
                            "",
                          ]
                        );
                        setIsManualMatchOpen(
                          false
                        );
                      }}
                      className="rounded-xl bg-slate-700 px-5 py-3 font-bold"
                    >
                      痍⑥냼
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  const assignedPlayers = [
    ...court.teamA,
    ...court.teamB,
  ];

  function handleReplacePlayer() {
    if (
      !outgoingPlayerId ||
      !incomingPlayerId
    ) {
      return;
    }

    const outgoing =
      assignedPlayers.find(
        (player) =>
          player.id ===
          outgoingPlayerId
      );
    const incoming =
      waitingPlayers.find(
        (player) =>
          player.id ===
          incomingPlayerId
      );

    const confirmed =
      window.confirm(
        `${outgoing?.name ?? "?좏깮???좎닔"}?섏쓣 ${incoming?.name ?? "?좏깮???湲곗옄"}?섏쑝濡?援먯껜?섏떆寃좎뒿?덇퉴?`
      );

    if (!confirmed) {
      return;
    }

    replaceCourtPlayer(
      court.id,
      outgoingPlayerId,
      incomingPlayerId
    );

    setOutgoingPlayerId("");
    setIncomingPlayerId("");
    setIsReplacementOpen(false);
  }

  return (
    <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800">
      <div className="flex justify-between mb-4">
        <h2 className="font-bold text-xl">
          Court {court.id}
        </h2>

        <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
          PLAYING
        </span>
      </div>

      <div className="mb-4 text-center">
        <div className="text-slate-400 text-sm">
          寃쎄린 ?쒓컙
        </div>

        <div className="text-xl font-bold text-lime-400">
          {duration}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl bg-slate-800 p-4">
          <div className="mb-3 text-center text-sm text-slate-400">
            Team A
          </div>

          <div className="grid grid-cols-2 gap-3">
            {court.teamA.map(
              (player) => (
                <div
                  key={player.id}
                  className="rounded-xl bg-slate-900 px-3 py-3 text-center font-bold"
                >
                  {player.name}
                </div>
              )
            )}
          </div>
        </div>

        <div className="text-center text-slate-400">
          VS
        </div>

        <div className="rounded-2xl bg-slate-800 p-4">
          <div className="mb-3 text-center text-sm text-slate-400">
            Team B
          </div>

          <div className="grid grid-cols-2 gap-3">
            {court.teamB.map(
              (player) => (
                <div
                  key={player.id}
                  className="rounded-xl bg-slate-900 px-3 py-3 text-center font-bold"
                >
                  {player.name}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className="mt-6 space-y-3">
          {matchTarget === "GAME" && (
          <button
            type="button"
            onClick={() =>
              setIsReplacementOpen(
                (current) => !current
              )
            }
            className="
              w-full
              rounded-xl
              bg-slate-800
              py-3
              font-bold
              text-white
              hover:bg-slate-700
            "
          >
            ?좎닔 援먯껜
          </button>
          )}

          {matchTarget === "GAME" && isReplacementOpen && (
            <div className="rounded-2xl border border-cyan-500/30 bg-slate-950 p-4">
              <div className="mb-4 text-sm text-slate-400">
                援먯껜???좎닔? ?ㅼ뼱???湲곗옄瑜??좏깮?섏꽭??
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-400">
                    ?섍컝 ?좎닔
                  </span>
                  <select
                    value={outgoingPlayerId}
                    onChange={(event) =>
                      setOutgoingPlayerId(
                        event.target.value
                      )
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-slate-700
                      bg-slate-900
                      px-3
                      py-3
                      text-white
                    "
                  >
                    <option value="">
                      ?좎닔瑜??좏깮?섏꽭??
                    </option>
                    {assignedPlayers.map(
                      (player) => (
                        <option
                          key={player.id}
                          value={player.id}
                        >
                          {player.name}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-400">
                    ?ㅼ뼱???湲곗옄
                  </span>
                  <select
                    value={incomingPlayerId}
                    onChange={(event) =>
                      setIncomingPlayerId(
                        event.target.value
                      )
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-slate-700
                      bg-slate-900
                      px-3
                      py-3
                      text-white
                    "
                  >
                    <option value="">
                      ?湲곗옄瑜??좏깮?섏꽭??
                    </option>
                    {waitingPlayers.map(
                      (player) => (
                        <option
                          key={player.id}
                          value={player.id}
                        >
                          {player.name}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              {waitingPlayers.length === 0 && (
                <div className="mt-3 text-sm text-amber-300">
                  援먯껜 媛?ν븳 ?湲곗옄媛 ?놁뒿?덈떎.
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleReplacePlayer}
                  disabled={
                    !outgoingPlayerId ||
                    !incomingPlayerId
                  }
                  className="
                    flex-1
                    rounded-xl
                    bg-cyan-400
                    py-3
                    font-bold
                    text-slate-950
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  援먯껜 ?곸슜
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOutgoingPlayerId("");
                    setIncomingPlayerId("");
                    setIsReplacementOpen(false);
                  }}
                  className="
                    rounded-xl
                    bg-slate-800
                    px-4
                    py-3
                    font-bold
                    text-slate-200
                    hover:bg-slate-700
                  "
                >
                  痍⑥냼
                </button>
              </div>
            </div>
          )}

          {matchTarget === "GAME" && (
          <button
            type="button"
            onClick={() =>
              setIsCourtSwapOpen(
                (current) => !current
              )
            }
            className="w-full rounded-xl bg-indigo-500 py-3 font-bold text-white hover:bg-indigo-400"
          >
            肄뷀듃 ???좎닔 ?먮━ 援먰솚
          </button>
          )}

          {matchTarget === "GAME" && isCourtSwapOpen && (
            <div className="rounded-2xl border border-indigo-500/30 bg-slate-950 p-4">
              <div className="mb-4 text-sm text-slate-400">
                ???좎닔瑜??좏깮?섎㈃ 媛숈? ????먮━ ?먮뒗 A?쨌B? 援ъ꽦???쒕줈 諛붽? ???덉뒿?덈떎.
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    id: "first",
                    label:
                      "泥?踰덉㎏ ?좎닔",
                    value:
                      firstSwapPlayerId,
                    setValue:
                      setFirstSwapPlayerId,
                  },
                  {
                    id: "second",
                    label:
                      "??踰덉㎏ ?좎닔",
                    value:
                      secondSwapPlayerId,
                    setValue:
                      setSecondSwapPlayerId,
                  },
                ].map((field) => (
                  <label
                    key={field.id}
                    className="block"
                  >
                    <span className="mb-2 block text-sm text-slate-400">
                      {field.label}
                    </span>
                    <select
                      value={
                        field.value
                      }
                      onChange={(
                        event
                      ) =>
                        field.setValue(
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-white"
                    >
                      <option value="">
                        ?좎닔瑜??좏깮?섏꽭??                      </option>
                      {assignedPlayers.map(
                        (player) => (
                          <option
                            key={
                              player.id
                            }
                            value={
                              player.id
                            }
                            disabled={
                              (
                                field.id ===
                                "first"
                                  ? secondSwapPlayerId
                                  : firstSwapPlayerId
                              ) ===
                              player.id
                            }
                          >
                            {player.name}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={
                    !firstSwapPlayerId ||
                    !secondSwapPlayerId ||
                    firstSwapPlayerId ===
                      secondSwapPlayerId
                  }
                  onClick={() => {
                    if (
                      !swapCourtPlayers(
                        court.id,
                        firstSwapPlayerId,
                        secondSwapPlayerId
                      )
                    ) {
                      window.alert(
                        "?좎닔 援ъ꽦??蹂寃쎈릺??援먰솚?섏? 紐삵뻽?듬땲??"
                      );
                      return;
                    }

                    setFirstSwapPlayerId(
                      ""
                    );
                    setSecondSwapPlayerId(
                      ""
                    );
                    setIsCourtSwapOpen(
                      false
                    );
                  }}
                  className="flex-1 rounded-xl bg-indigo-500 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ?먮━ 援먰솚 ?곸슜
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFirstSwapPlayerId(
                      ""
                    );
                    setSecondSwapPlayerId(
                      ""
                    );
                    setIsCourtSwapOpen(
                      false
                    );
                  }}
                  className="rounded-xl bg-slate-800 px-4 py-3 font-bold"
                >
                  痍⑥냼
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              const confirmed =
                window.confirm(
                  "?뺣쭚 寃쎄린瑜?醫낅즺?섏떆寃좎뒿?덇퉴?"
                );

              if (!confirmed) {
                return;
              }

              finishCourtMatch(
                court.id
              );
            }}
            className="
              w-full
              rounded-xl
              bg-lime-400
              py-3
              text-black
              font-bold
            "
          >
            寃쎄린 醫낅즺
          </button>
        </div>
      )}
    </div>
  );
}
