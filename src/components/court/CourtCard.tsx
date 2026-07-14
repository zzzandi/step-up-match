import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Court } from "@/types/court";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import {
  useAccessSession,
} from "@/auth/access";

const text = {
  queueCourt: "\uB300\uAE30 \uCF54\uD2B8",
  empty: "\uBE44\uC5B4 \uC788\uC74C",
  playing: "\uACBD\uAE30 \uC911",
  queued: "\uB300\uAE30 \uB300\uC9C4",
  noGame:
    "\uD604\uC7AC \uBE44\uC5B4 \uC788\uB294 \uCF54\uD2B8\uC785\uB2C8\uB2E4.",
  noQueue:
    "\uC544\uC9C1 \uC900\uBE44\uB41C \uB300\uAE30 \uB300\uC9C4\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
  autoMatch: "\uC790\uB3D9 \uB300\uC9C4",
  manualMatch: "\uC218\uB3D9 \uB300\uC9C4",
  gameTime: "\uACBD\uAE30 \uC2DC\uAC04",
  queueHelp:
    "\uAC8C\uC784 \uCF54\uD2B8\uAC00 \uBE44\uBA74 \uC774 \uB300\uC9C4\uC774 \uC790\uB3D9\uC73C\uB85C \uC62C\uB77C\uAC11\uB2C8\uB2E4.",
  replacePlayer: "\uC120\uC218 \uAD50\uCCB4",
  replaceHelp:
    "\uAD50\uCCB4\uD560 \uACBD\uAE30 \uC911 \uC120\uC218\uC640 \uB4E4\uC5B4\uC62C \uB300\uAE30\uC790\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.",
  outgoing: "\uB098\uAC00\uB294 \uC120\uC218",
  incoming: "\uB4E4\uC5B4\uC62C \uB300\uAE30\uC790",
  selectPlayer:
    "\uC120\uC218\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694",
  selectWaiting:
    "\uB300\uAE30\uC790\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694",
  noWaiting:
    "\uAD50\uCCB4 \uAC00\uB2A5\uD55C \uB300\uAE30\uC790\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  playingBadge:
    "\uACBD\uAE30\uC911",
  applyReplace: "\uAD50\uCCB4 \uC801\uC6A9",
  close: "\uB2EB\uAE30",
  swap: "\uCF54\uD2B8 \uC548 \uC120\uC218 \uC790\uB9AC \uAD50\uD658",
  swapHelp:
    "\uAC19\uC740 \uCF54\uD2B8 \uC548\uC5D0\uC11C \uB450 \uC120\uC218\uB97C \uC120\uD0DD\uD558\uBA74 \uD300 \uAD6C\uC131\uC774\uB098 \uC790\uB9AC\uAC00 \uC11C\uB85C \uBC14\uB00D\uB2C8\uB2E4.",
  firstPlayer: "\uCCAB \uBC88\uC9F8 \uC120\uC218",
  secondPlayer: "\uB450 \uBC88\uC9F8 \uC120\uC218",
  applySwap: "\uC790\uB9AC \uAD50\uD658 \uC801\uC6A9",
  swapFailed:
    "\uC120\uC218 \uAD6C\uC131\uC774 \uBCC0\uACBD\uB418\uC5B4 \uAD50\uD658\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
  finishConfirm:
    "\uC815\uB9D0 \uACBD\uAE30\uB97C \uC885\uB8CC\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?",
  finishMatch: "\uACBD\uAE30 \uC885\uB8CC",
  manualHelp:
    "\uB300\uAE30\uC790 \uC911 4\uBA85\uC744 \uC9C1\uC811 \uC120\uD0DD\uD574 \uD300\uC744 \uAD6C\uC131\uD574 \uC8FC\uC138\uC694.",
  teamA1: "A\uD300 \uC120\uC218 1",
  teamA2: "A\uD300 \uC120\uC218 2",
  teamB1: "B\uD300 \uC120\uC218 1",
  teamB2: "B\uD300 \uC120\uC218 2",
  needFour:
    "\uC218\uB3D9 \uB300\uC9C4\uC5D0\uB294 \uB300\uAE30\uC790 4\uBA85\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.",
  confirmQueue:
    "\uB300\uAE30 \uB300\uC9C4 \uD655\uC815",
  deleteQueueCourt:
    "\uB300\uAE30\uCF54\uD2B8 \uC0AD\uC81C",
  moveQueueUp: "\uC55E\uC73C\uB85C",
  moveQueueDown: "\uB4A4\uB85C",
  swapGameCourt:
    "\uB2E4\uB978 \uCF54\uD2B8\uC640 \uB300\uC9C4 \uAD50\uD658",
  swapGameCourtHelp:
    "\uC2E4\uC81C \uCF54\uD2B8\uC640 \uC571\uC758 \uCF54\uD2B8 \uBC88\uD638\uAC00 \uBC14\uB00C \uACBD\uC6B0 \uB450 \uAC8C\uC784\uCF54\uD2B8\uC758 \uB300\uC9C4\uC744 \uADF8\uB300\uB85C \uBC14\uAFC9\uB2C8\uB2E4.",
  targetCourt:
    "\uBC14\uAFC0 \uCF54\uD2B8",
  applyGameCourtSwap:
    "\uCF54\uD2B8 \uB300\uC9C4 \uAD50\uD658",
  deleteQueueCourtConfirm:
    "\uC774 \uB300\uAE30\uCF54\uD2B8\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C? \uC900\uBE44\uB41C \uB300\uC9C4\uC774 \uC788\uC73C\uBA74 \uD568\uAED8 \uC0AD\uC81C\uB429\uB2C8\uB2E4.",
  startGame: "\uACBD\uAE30 \uC2DC\uC791",
  assignFailed:
    "\uC120\uC218 \uC0C1\uD0DC\uAC00 \uBCC0\uACBD\uB418\uC5C8\uAC70\uB098 \uAC19\uC740 \uACBD\uAE30 \uBC30\uCE58 \uC81C\uC678 \uC870\uAC74\uC5D0 \uAC78\uB824 \uB300\uC9C4\uC744 \uC0DD\uC131\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uB300\uAE30\uC5F4\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
};

function formatDuration(
  startedAt: Date | null
) {
  if (!startedAt) {
    return "00:00";
  }

  const seconds = Math.max(
    0,
    Math.floor(
      (Date.now() -
        new Date(startedAt).getTime()) /
        1000
    )
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
  const isQueueCourt =
    matchTarget === "QUEUE";
  const courtLabel =
    isQueueCourt
      ? `${text.queueCourt} ${court.id}`
      : `Court ${court.id}`;
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
  const removeQueuedCourt =
    useMatchStore(
      (state) =>
        state.removeQueuedCourt
    );
  const moveQueuedCourt =
    useMatchStore(
      (state) =>
        state.moveQueuedCourt
    );
  const swapGameCourts =
    useMatchStore(
      (state) =>
        state.swapGameCourts
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
  const courts =
    useMatchStore(
      (state) =>
        state.courts
    );
  const queuedCourts =
    useMatchStore(
      (state) =>
        state.queuedCourts
    );
  const assignedPlayers =
    useMemo(
      () => [
        ...(court.teamA ?? []),
        ...(court.teamB ?? []),
      ],
      [court.teamA, court.teamB]
    );
  const otherQueuedPlayerIds =
    useMemo(
      () =>
        new Set(
          isQueueCourt
            ? queuedCourts
                .filter(
                  (item) =>
                    item.id !==
                    court.id
                )
                .flatMap(
                  (item) => [
                    ...(item.teamA ?? []),
                    ...(item.teamB ?? []),
                  ]
                )
                .map(
                  (player) =>
                    player.id
                )
            : []
        ),
      [
        court.id,
        isQueueCourt,
        queuedCourts,
      ]
    );
  const waitingPlayers =
    players.filter(
      (player) =>
        player.status === "WAITING" &&
        player.isPresent &&
        !otherQueuedPlayerIds.has(
          player.id
        ) &&
        !assignedPlayers.some(
          (assigned) =>
            assigned.id === player.id
        )
    );
  const manualCandidatePlayers =
    players.filter(
      (player) =>
        (isQueueCourt
          ? player.status ===
              "WAITING" ||
            player.status ===
              "PLAYING"
          : player.status ===
            "WAITING") &&
        player.isPresent &&
        !otherQueuedPlayerIds.has(
          player.id
        ) &&
        !assignedPlayers.some(
          (assigned) =>
            assigned.id === player.id
        )
    );
  const otherGameCourts =
    courts.filter(
      (item) =>
        item.id !== court.id &&
        item.status === "PLAYING" &&
        item.teamA &&
        item.teamB
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
    isGameCourtSwapOpen,
    setIsGameCourtSwapOpen,
  ] = useState(false);
  const [
    targetSwapCourtId,
    setTargetSwapCourtId,
  ] = useState("");
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

  const isAssigned =
    Boolean(
      court.teamA &&
        court.teamB
    );

  function resetManualMatchForm() {
    setManualPlayerIds([
      "",
      "",
      "",
      "",
    ]);
    setIsManualMatchOpen(false);
  }

  function handleManualMatch() {
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
        matchTarget,
        operator
      );

    if (!assigned) {
      window.alert(
        text.assignFailed
      );
      return;
    }

    resetManualMatchForm();
  }

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

    if (
      !window.confirm(
        `${outgoing?.name ?? text.outgoing}\uB2D8\uC744 ${incoming?.name ?? text.incoming}\uB2D8\uC73C\uB85C \uAD50\uCCB4\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`
      )
    ) {
      return;
    }

    replaceCourtPlayer(
      court.id,
      outgoingPlayerId,
      incomingPlayerId,
      matchTarget,
      operator
    );
    setOutgoingPlayerId("");
    setIncomingPlayerId("");
    setIsReplacementOpen(false);
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-4 flex justify-between gap-3">
        <h2 className="text-xl font-bold">
          {courtLabel}
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs ${
              isAssigned
                ? isQueueCourt
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "bg-emerald-500/20 text-emerald-400"
                : "bg-slate-700 text-slate-300"
            }`}
          >
            {isAssigned
              ? isQueueCourt
                ? text.queued
                : text.playing
              : text.empty}
          </span>
          {!readOnly && isQueueCourt && (
            <>
            <button
              type="button"
              onClick={() =>
                moveQueuedCourt(
                  court.id,
                  -1
                )
              }
              className="rounded-full bg-slate-700 px-3 py-1 text-xs font-bold text-slate-100 hover:bg-slate-600"
            >
              {text.moveQueueUp}
            </button>
            <button
              type="button"
              onClick={() =>
                moveQueuedCourt(
                  court.id,
                  1
                )
              }
              className="rounded-full bg-slate-700 px-3 py-1 text-xs font-bold text-slate-100 hover:bg-slate-600"
            >
              {text.moveQueueDown}
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    text.deleteQueueCourtConfirm
                  )
                ) {
                  removeQueuedCourt(
                    court.id
                  );
                }
              }}
              className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-200 hover:bg-red-500/30"
            >
              {text.deleteQueueCourt}
            </button>
            </>
          )}
        </div>
      </div>

      {!isAssigned ? (
        <>
          <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-center text-slate-400">
            {isQueueCourt
              ? text.noQueue
              : text.noGame}
          </div>
          {!readOnly && (
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
                {text.autoMatch}
              </button>
              <button
                type="button"
                onClick={() =>
                  setIsManualMatchOpen(true)
                }
                className="rounded-xl bg-cyan-400 py-3 font-bold text-slate-950"
              >
                {text.manualMatch}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {!isQueueCourt && (
            <div className="mb-4 text-center">
              <div className="text-sm text-slate-400">
                {text.gameTime}
              </div>
              <div className="text-xl font-bold text-lime-400">
                {duration}
              </div>
            </div>
          )}
          {isQueueCourt && (
            <div className="mb-4 rounded-2xl bg-indigo-500/10 p-3 text-center text-sm text-indigo-200">
              {text.queueHelp}
            </div>
          )}
          <div className="space-y-4">
            {[
              ["Team A", court.teamA],
              ["Team B", court.teamB],
            ].map(([label, team], index) => (
              <div key={String(label)}>
                {index === 1 && (
                  <div className="mb-4 text-center text-slate-400">
                    VS
                  </div>
                )}
                <div className="rounded-2xl bg-slate-800 p-4">
                  <div className="mb-3 text-center text-sm text-slate-400">
                    {String(label)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(team as Court["teamA"])?.map(
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
            ))}
          </div>
        </>
      )}

      {!readOnly && isAssigned && (
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() =>
              setIsReplacementOpen(
                (current) => !current
              )
            }
            className="w-full rounded-xl bg-slate-800 py-3 font-bold text-white hover:bg-slate-700"
          >
            {text.replacePlayer}
          </button>
          {isReplacementOpen && (
            <div className="rounded-2xl border border-cyan-500/30 bg-slate-950 p-4">
              <div className="mb-4 text-sm text-slate-400">
                {text.replaceHelp}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    label: text.outgoing,
                    value: outgoingPlayerId,
                    setValue:
                      setOutgoingPlayerId,
                    options: assignedPlayers,
                    placeholder:
                      text.selectPlayer,
                  },
                  {
                    label: text.incoming,
                    value: incomingPlayerId,
                    setValue:
                      setIncomingPlayerId,
                    options: waitingPlayers,
                    placeholder:
                      text.selectWaiting,
                  },
                ].map((field) => (
                  <label
                    key={field.label}
                    className="block"
                  >
                    <span className="mb-2 block text-sm text-slate-400">
                      {field.label}
                    </span>
                    <select
                      value={field.value}
                      onChange={(event) =>
                        field.setValue(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-white"
                    >
                      <option value="">
                        {field.placeholder}
                      </option>
                      {field.options.map(
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
                ))}
              </div>
              {waitingPlayers.length ===
                0 && (
                <div className="mt-3 text-sm text-amber-300">
                  {text.noWaiting}
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
                  className="flex-1 rounded-xl bg-cyan-400 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {text.applyReplace}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOutgoingPlayerId("");
                    setIncomingPlayerId("");
                    setIsReplacementOpen(false);
                  }}
                  className="rounded-xl bg-slate-800 px-4 py-3 font-bold text-slate-200 hover:bg-slate-700"
                >
                  {text.close}
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
            {text.swap}
          </button>
          {isCourtSwapOpen && (
            <div className="rounded-2xl border border-indigo-500/30 bg-slate-950 p-4">
              <div className="mb-4 text-sm text-slate-400">
                {text.swapHelp}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    label: text.firstPlayer,
                    value: firstSwapPlayerId,
                    setValue:
                      setFirstSwapPlayerId,
                    other:
                      secondSwapPlayerId,
                  },
                  {
                    label: text.secondPlayer,
                    value: secondSwapPlayerId,
                    setValue:
                      setSecondSwapPlayerId,
                    other:
                      firstSwapPlayerId,
                  },
                ].map((field) => (
                  <label
                    key={field.label}
                    className="block"
                  >
                    <span className="mb-2 block text-sm text-slate-400">
                      {field.label}
                    </span>
                    <select
                      value={field.value}
                      onChange={(event) =>
                        field.setValue(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-white"
                    >
                      <option value="">
                        {text.selectPlayer}
                      </option>
                      {assignedPlayers.map(
                        (player) => (
                          <option
                            key={player.id}
                            value={player.id}
                            disabled={
                              field.other ===
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
                        secondSwapPlayerId,
                        matchTarget,
                        operator
                      )
                    ) {
                      window.alert(
                        text.swapFailed
                      );
                      return;
                    }
                    setFirstSwapPlayerId("");
                    setSecondSwapPlayerId("");
                    setIsCourtSwapOpen(false);
                  }}
                  className="flex-1 rounded-xl bg-indigo-500 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {text.applySwap}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFirstSwapPlayerId("");
                    setSecondSwapPlayerId("");
                    setIsCourtSwapOpen(false);
                  }}
                  className="rounded-xl bg-slate-800 px-4 py-3 font-bold"
                >
                  {text.close}
                </button>
              </div>
            </div>
          )}

          {!isQueueCourt && (
            <>
              <button
                type="button"
                onClick={() =>
                  setIsGameCourtSwapOpen(
                    (current) => !current
                  )
                }
                className="w-full rounded-xl bg-violet-500 py-3 font-bold text-white hover:bg-violet-400"
              >
                {text.swapGameCourt}
              </button>
              {isGameCourtSwapOpen && (
                <div className="rounded-2xl border border-violet-500/30 bg-slate-950 p-4">
                  <div className="mb-4 text-sm text-slate-400">
                    {text.swapGameCourtHelp}
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm text-slate-400">
                      {text.targetCourt}
                    </span>
                    <select
                      value={targetSwapCourtId}
                      onChange={(event) =>
                        setTargetSwapCourtId(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-white"
                    >
                      <option value="">
                        {text.targetCourt}
                      </option>
                      {otherGameCourts.map(
                        (item) => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            Court {item.id}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={
                        !targetSwapCourtId
                      }
                      onClick={() => {
                        const targetCourtId =
                          Number(
                            targetSwapCourtId
                          );

                        if (
                          !swapGameCourts(
                            court.id,
                            targetCourtId,
                            operator
                          )
                        ) {
                          window.alert(
                            text.swapFailed
                          );
                          return;
                        }

                        setTargetSwapCourtId(
                          ""
                        );
                        setIsGameCourtSwapOpen(
                          false
                        );
                      }}
                      className="flex-1 rounded-xl bg-violet-500 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {text.applyGameCourtSwap}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetSwapCourtId(
                          ""
                        );
                        setIsGameCourtSwapOpen(
                          false
                        );
                      }}
                      className="rounded-xl bg-slate-800 px-4 py-3 font-bold"
                    >
                      {text.close}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {!isQueueCourt && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    text.finishConfirm
                  )
                ) {
                  finishCourtMatch(
                    court.id,
                    operator
                  );
                }
              }}
              className="w-full rounded-xl bg-lime-400 py-3 font-bold text-black"
            >
              {text.finishMatch}
            </button>
          )}
        </div>
      )}

      {!readOnly &&
        isManualMatchOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-cyan-500/30 bg-slate-900 p-6">
              <div className="mb-2 text-xl font-bold">
                {courtLabel} {text.manualMatch}
              </div>
              <p className="mb-5 text-sm text-slate-400">
                {text.manualHelp}
              </p>
              <div className="grid gap-5 md:grid-cols-2">
                {[
                  text.teamA1,
                  text.teamA2,
                  text.teamB1,
                  text.teamB2,
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
                        onChange={(event) =>
                          setManualPlayerIds(
                            (current) =>
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
                          {text.selectPlayer}
                        </option>
                        {manualCandidatePlayers.map(
                          (player) => (
                            <option
                              key={player.id}
                              value={player.id}
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
                              {player.name}
                              {player.status ===
                                "PLAYING"
                                ? ` (${text.playingBadge})`
                                : ""}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                  )
                )}
              </div>
              {manualCandidatePlayers.length < 4 && (
                <div className="mt-4 text-sm text-amber-300">
                  {text.needFour}
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
                  onClick={handleManualMatch}
                  className="flex-1 rounded-xl bg-cyan-400 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isQueueCourt
                    ? text.confirmQueue
                    : text.startGame}
                </button>
                <button
                  type="button"
                  onClick={resetManualMatchForm}
                  className="rounded-xl bg-slate-700 px-5 py-3 font-bold"
                >
                  {text.close}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
