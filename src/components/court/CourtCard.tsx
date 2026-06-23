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
}

export default function CourtCard({
  court,
  readOnly = false,
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
          비어있음
        </div>

        {!readOnly && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  rerollRecommendations(
                    court.id
                  )
                }
                className="rounded-xl bg-blue-500 py-3 font-bold text-white"
              >
                자동 대진
              </button>
              <button
                type="button"
                onClick={() =>
                  setIsManualMatchOpen(
                    true
                  )
                }
                className="rounded-xl bg-cyan-400 py-3 font-bold text-slate-950"
              >
                수동 대진
              </button>
            </div>

            {isManualMatchOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-cyan-500/30 bg-slate-900 p-6">
                  <div className="mb-2 text-xl font-bold">
                    Court {court.id} 수동 대진
                  </div>
                  <p className="mb-5 text-sm text-slate-400">
                    대기자 중 4명을 직접 선택해 팀을 구성하세요.
                  </p>

                  <div className="grid gap-5 md:grid-cols-2">
                    {[
                      "A팀 선수 1",
                      "A팀 선수 2",
                      "B팀 선수 1",
                      "B팀 선수 2",
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
                              선수를 선택하세요
                            </option>
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
                      수동 대진에는 대기자 4명이 필요합니다.
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
                            ]
                          );

                        if (!assigned) {
                          window.alert(
                            "선수 상태가 변경되었거나 코트가 이미 사용 중입니다. 현재 대기열을 확인해주세요."
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
                      경기 시작
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
                      취소
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
        `${outgoing?.name ?? "선택한 선수"}님을 ${incoming?.name ?? "선택한 대기자"}님으로 교체하시겠습니까?`
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
          경기 시간
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
            선수 교체
          </button>

          {isReplacementOpen && (
            <div className="rounded-2xl border border-cyan-500/30 bg-slate-950 p-4">
              <div className="mb-4 text-sm text-slate-400">
                교체할 선수와 들어올 대기자를 선택하세요.
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-400">
                    나갈 선수
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
                      선수를 선택하세요
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
                    들어올 대기자
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
                      대기자를 선택하세요
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
                  교체 가능한 대기자가 없습니다.
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
                  교체 적용
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
                  취소
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              setIsCourtSwapOpen(
                (current) => !current
              )
            }
            className="w-full rounded-xl bg-indigo-500 py-3 font-bold text-white hover:bg-indigo-400"
          >
            코트 안 선수 자리 교환
          </button>

          {isCourtSwapOpen && (
            <div className="rounded-2xl border border-indigo-500/30 bg-slate-950 p-4">
              <div className="mb-4 text-sm text-slate-400">
                두 선수를 선택하면 같은 팀의 자리 또는 A팀·B팀 구성을 서로 바꿀 수 있습니다.
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    id: "first",
                    label:
                      "첫 번째 선수",
                    value:
                      firstSwapPlayerId,
                    setValue:
                      setFirstSwapPlayerId,
                  },
                  {
                    id: "second",
                    label:
                      "두 번째 선수",
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
                        선수를 선택하세요
                      </option>
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
                        "선수 구성이 변경되어 교환하지 못했습니다."
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
                  자리 교환 적용
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
                  취소
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              const confirmed =
                window.confirm(
                  "정말 경기를 종료하시겠습니까?"
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
            경기 종료
          </button>
        </div>
      )}
    </div>
  );
}
