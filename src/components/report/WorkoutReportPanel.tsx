import {
  useMemo,
  useState,
} from "react";

import {
  useMatchStore,
} from "@/store/useMatchStore";
import type {
  MatchHistory,
} from "@/types/matchHistory";
import type {
  WorkoutReportEvent,
} from "@/types/workoutReport";

interface MixingRow {
  id: string;
  name: string;
  matchCount: number;
  metCount: number;
  possibleCount: number;
  missedCount: number;
  mixPercent: number;
}

interface WorkoutReportPanelProps {
  preferSnapshot?: boolean;
}

function getDateText() {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }
  ).format(new Date());
}

function formatKstTime(
  value: Date | string
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(new Date(value));
}

function getKstDateKey(
  value: Date | string = new Date()
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date(value));
}

function getLatestWorkoutDateFromReportData({
  histories,
  events,
  fallbackDate,
}: {
  histories: MatchHistory[];
  events: {
    createdAt: string;
  }[];
  fallbackDate: string;
}) {
  const datedItems = [
    ...histories.map(
      (history) => ({
        date: getKstDateKey(
          history.endedAt
        ),
        time: new Date(
          history.endedAt
        ).getTime(),
      })
    ),
    ...events.map((event) => ({
      date: getKstDateKey(
        event.createdAt
      ),
      time: new Date(
        event.createdAt
      ).getTime(),
    })),
  ].filter((item) =>
    Number.isFinite(item.time)
  );

  if (datedItems.length === 0) {
    return fallbackDate;
  }

  return datedItems.sort(
    (a, b) => b.time - a.time
  )[0].date;
}

function getHistoryPlayerIds(
  history: MatchHistory
) {
  return [
    ...history.teamA,
    ...history.teamB,
  ];
}

function getPlayerName(
  playerId: string,
  histories: MatchHistory[],
  currentNames: Map<
    string,
    string
  >
) {
  return (
    currentNames.get(playerId) ??
    histories.find(
      (history) =>
        history.playerNames?.[
          playerId
        ]
    )?.playerNames?.[
      playerId
    ] ??
    "알 수 없음"
  );
}

function formatTeam(
  playerIds: [string, string],
  histories: MatchHistory[],
  names: Map<string, string>
) {
  return playerIds
    .map((playerId) =>
      getPlayerName(
        playerId,
        histories,
        names
      )
    )
    .join(" + ");
}

function samePlayerSet(
  playerIdsA: string[],
  playerIdsB: string[]
) {
  if (
    playerIdsA.length !==
    playerIdsB.length
  ) {
    return false;
  }

  return (
    [...playerIdsA].sort().join("|") ===
    [...playerIdsB].sort().join("|")
  );
}

function formatEventPlayers(
  playerIds: string[],
  playerNames: Record<string, string>
) {
  const names = playerIds.map(
    (playerId) =>
      playerNames[playerId] ??
      playerId
  );

  if (names.length >= 4) {
    return `${names[0]} + ${names[1]} vs ${names[2]} + ${names[3]}`;
  }

  return names.join(" + ");
}

function formatOperator(
  event: Pick<
    WorkoutReportEvent,
    "operator"
  >
) {
  if (!event.operator?.name) {
    return "조작자 기록 없음";
  }

  const roleText =
    event.operator.role ===
    "MASTER"
      ? "Master"
      : event.operator.role ===
          "ADMIN"
        ? "운영진"
        : "Player";

  return `${event.operator.name}(${roleText})`;
}

function getOperationLabel(
  event: WorkoutReportEvent
) {
  if (event.type === "AUTO_MATCH") {
    return event.target === "QUEUE"
      ? "대기코트 자동 대진 확정"
      : "게임코트 자동 대진 확정";
  }

  if (event.type === "MANUAL_MATCH") {
    return event.target === "QUEUE"
      ? "대기코트 수동 대진 확정"
      : "게임코트 수동 대진 확정";
  }

  if (
    event.type === "QUEUED_PROMOTED"
  ) {
    return "대기 대진 게임코트 승격";
  }

  if (
    event.type === "MATCH_FINISHED"
  ) {
    return "경기 종료";
  }

  if (
    event.type === "PLAYER_REPLACED"
  ) {
    return "선수 교체";
  }

  if (
    event.type ===
    "COURT_PLAYERS_SWAPPED"
  ) {
    return "코트 내 선수 위치 교환";
  }

  return event.type;
}

function findRelatedEvent(
  history: MatchHistory,
  events: WorkoutReportEvent[],
  types: WorkoutReportEvent["type"][]
) {
  return events.find((event) => {
    if (
      event.courtId !==
        history.courtId ||
      !types.includes(event.type)
    ) {
      return false;
    }

    const targetTime =
      event.type ===
      "MATCH_FINISHED"
        ? history.endedAt
        : history.startedAt;
    const diffMs =
      Math.abs(
        new Date(
          targetTime
        ).getTime() -
          new Date(
            event.createdAt
          ).getTime()
      );

    return (
      samePlayerSet(
        getHistoryPlayerIds(
          history
        ),
        event.playerIds
      ) &&
      diffMs <= 10 * 60 * 1000
    );
  });
}

function getSnapshotActivityCount(snapshot: {
  matchHistory: MatchHistory[];
  workoutReportEvents: unknown[];
}) {
  return (
    snapshot.matchHistory.length +
    snapshot.workoutReportEvents.length
  );
}

export default function WorkoutReportPanel({
  preferSnapshot = false,
}: WorkoutReportPanelProps) {
  const players =
    useMatchStore(
      (state) => state.players
    );
  const matchHistory =
    useMatchStore(
      (state) =>
        state.matchHistory
    );
  const workoutReportEvents =
    useMatchStore(
      (state) =>
        state.workoutReportEvents
    );
  const workoutReportSnapshots =
    useMatchStore(
      (state) =>
        state.workoutReportSnapshots
    );
  const saveWorkoutReportSnapshot =
    useMatchStore(
      (state) =>
        state.saveWorkoutReportSnapshot
    );
  const [
    copied,
    setCopied,
  ] = useState(false);
  const [
    saved,
    setSaved,
  ] = useState(false);
  const [
    selectedSnapshotId,
    setSelectedSnapshotId,
  ] = useState("");

  const sortedSnapshots =
    useMemo(
      () =>
        [...workoutReportSnapshots].sort(
          (a, b) => {
            const dateDiff =
              b.workoutDate.localeCompare(
                a.workoutDate
              );

            if (dateDiff !== 0) {
              return dateDiff;
            }

            const activityDiff =
              getSnapshotActivityCount(b) -
              getSnapshotActivityCount(a);

            if (activityDiff !== 0) {
              return activityDiff;
            }

            return (
              new Date(
                b.createdAt
              ).getTime() -
              new Date(
                a.createdAt
              ).getTime()
            );
          }
        ),
      [workoutReportSnapshots]
    );
  const latestSnapshot =
    sortedSnapshots[0];
  const effectiveSelectedSnapshotId =
    selectedSnapshotId ||
    (preferSnapshot
      ? latestSnapshot?.id ?? ""
      : "");
  const selectedSnapshot =
    sortedSnapshots.find(
      (snapshot) =>
        snapshot.id ===
        effectiveSelectedSnapshotId
    ) ?? null;

  const report =
    useMemo(() => {
      const snapshotToUse =
        selectedSnapshot ??
        latestSnapshot;
      const shouldUseSnapshot =
        Boolean(selectedSnapshot) ||
        (matchHistory.length === 0 &&
          workoutReportEvents.length ===
            0 &&
          Boolean(snapshotToUse));
      const reportDate =
        shouldUseSnapshot
          ? getLatestWorkoutDateFromReportData(
              {
                histories:
                  snapshotToUse!.matchHistory,
                events:
                  snapshotToUse!.workoutReportEvents,
                fallbackDate:
                  snapshotToUse!.workoutDate,
              }
            )
          : getKstDateKey();
      const reportPlayers =
        shouldUseSnapshot
          ? snapshotToUse!.players
          : players;
      const reportMatchHistory =
        (shouldUseSnapshot
          ? snapshotToUse!.matchHistory
          : matchHistory
        ).filter(
          (history) =>
            getKstDateKey(
              history.endedAt
            ) === reportDate
        );
      const reportEvents =
        (shouldUseSnapshot
          ? snapshotToUse!.workoutReportEvents
          : workoutReportEvents
        ).filter(
          (event) =>
            getKstDateKey(
              event.createdAt
            ) === reportDate
        );
      const histories =
        [...reportMatchHistory].sort(
          (a, b) =>
            new Date(
              a.startedAt
            ).getTime() -
            new Date(
              b.startedAt
            ).getTime()
        );
      const currentNames =
        new Map(
          reportPlayers.map(
            (player) => [
              player.id,
              player.name,
            ]
          )
        );
      const participantIds =
        new Set<string>();

      reportPlayers
        .filter(
          (player) =>
            player.isPresent &&
            player.status !==
              "LEFT"
        )
        .forEach((player) =>
          participantIds.add(
            player.id
          )
        );

      histories.forEach(
        (history) =>
          getHistoryPlayerIds(
            history
          ).forEach((playerId) =>
            participantIds.add(
              playerId
            )
          )
      );

      const matchCountByPlayer =
        new Map<string, number>();
      const sameGamePlayersByPlayer =
        new Map<string, Set<string>>();

      histories.forEach(
        (history) => {
          const ids =
            getHistoryPlayerIds(
              history
            );

          ids.forEach((playerId) => {
            matchCountByPlayer.set(
              playerId,
              (matchCountByPlayer.get(
                playerId
              ) ?? 0) + 1
            );

            if (
              !sameGamePlayersByPlayer.has(
                playerId
              )
            ) {
              sameGamePlayersByPlayer.set(
                playerId,
                new Set()
              );
            }

            ids
              .filter(
                (otherId) =>
                  otherId !== playerId
              )
              .forEach((otherId) =>
                sameGamePlayersByPlayer
                  .get(playerId)!
                  .add(otherId)
              );
          });
        }
      );

      const participantCount =
        participantIds.size;
      const possibleCount =
        Math.max(
          0,
          participantCount - 1
        );

      const mixingRows: MixingRow[] =
        [...participantIds]
          .map((playerId) => {
            const metCount =
              sameGamePlayersByPlayer.get(
                playerId
              )?.size ?? 0;
            const mixPercent =
              possibleCount > 0
                ? Math.round(
                    (metCount /
                      possibleCount) *
                      100
                  )
                : 0;

            return {
              id: playerId,
              name:
                getPlayerName(
                  playerId,
                  histories,
                  currentNames
                ),
              matchCount:
                matchCountByPlayer.get(
                  playerId
                ) ?? 0,
              metCount,
              possibleCount,
              missedCount:
                Math.max(
                  0,
                  possibleCount -
                    metCount
                ),
              mixPercent,
            };
          })
          .sort((a, b) => {
            if (
              a.mixPercent !==
              b.mixPercent
            ) {
              return (
                a.mixPercent -
                b.mixPercent
              );
            }

            if (
              b.matchCount !==
              a.matchCount
            ) {
              return (
                b.matchCount -
                a.matchCount
              );
            }

            return a.name.localeCompare(
              b.name,
              "ko"
            );
          });

      const participantRows =
        [...mixingRows].sort(
          (a, b) => {
            if (
              b.matchCount !==
              a.matchCount
            ) {
              return (
                b.matchCount -
                a.matchCount
              );
            }

            return a.name.localeCompare(
              b.name,
              "ko"
            );
          }
        );

      const matchCounts =
        participantRows.map(
          (row) => row.matchCount
        );
      const completedMatches =
        histories.length;
      const autoGameEvents =
        reportEvents.filter(
          (event) =>
            event.type ===
              "AUTO_MATCH" &&
            event.target === "GAME"
        ).length;
      const manualGameEvents =
        reportEvents.filter(
          (event) =>
            event.type ===
              "MANUAL_MATCH" &&
            event.target === "GAME"
        ).length;
      const promotedEvents =
        reportEvents.filter(
          (event) =>
            event.type ===
            "QUEUED_PROMOTED"
        ).length;
      const totalGameEvents =
        autoGameEvents +
        manualGameEvents +
        promotedEvents;
      const totalMatches =
        totalGameEvents > 0
          ? totalGameEvents
          : completedMatches;
      const maxMatches =
        Math.max(
          0,
          ...matchCounts
        );
      const minMatches =
        participantCount > 0
          ? Math.min(
              ...matchCounts
            )
          : 0;
      const averageMatches =
        participantCount > 0
          ? (
              (completedMatches * 4) /
              participantCount
            ).toFixed(1)
          : "0.0";
      const averageMixPercent =
        mixingRows.length > 0
          ? Math.round(
              mixingRows.reduce(
                (sum, row) =>
                  sum +
                  row.mixPercent,
                0
              ) / mixingRows.length
            )
          : 0;
      const leastMixedRows =
        mixingRows.slice(0, 5);
      const mostMixedRows =
        [...mixingRows]
          .sort(
            (a, b) =>
              b.mixPercent -
              a.mixPercent
          )
          .slice(0, 5);
      const noMissRows =
        mixingRows.filter(
          (row) =>
            row.missedCount === 0 &&
            row.possibleCount > 0
        );

      const autoQueuedEvents =
        reportEvents.filter(
          (event) =>
            event.type ===
              "AUTO_MATCH" &&
            event.target ===
              "QUEUE"
        ).length;
      const manualQueuedEvents =
        reportEvents.filter(
          (event) =>
            event.type ===
              "MANUAL_MATCH" &&
            event.target ===
              "QUEUE"
        ).length;
      const replacementEvents =
        reportEvents.filter(
          (event) =>
            event.type ===
            "PLAYER_REPLACED"
        ).length;
      const swapEvents =
        reportEvents.filter(
          (event) =>
            event.type ===
            "COURT_PLAYERS_SWAPPED"
        ).length;
      const scoredMatches =
        histories.filter(
          (history) =>
            typeof history.teamAScore ===
              "number" &&
            typeof history.teamBScore ===
              "number"
        ).length;
      const operationEvents =
        [...reportEvents].sort(
          (a, b) =>
            new Date(
              a.createdAt
            ).getTime() -
            new Date(
              b.createdAt
            ).getTime()
        );
      const gameAssignmentEvents =
        reportEvents
          .filter(
            (event) =>
              (event.type ===
                "AUTO_MATCH" &&
                event.target ===
                  "GAME") ||
              (event.type ===
                "MANUAL_MATCH" &&
                event.target ===
                  "GAME") ||
              event.type ===
                "QUEUED_PROMOTED"
          )
          .sort(
            (a, b) =>
              new Date(
                a.createdAt
              ).getTime() -
              new Date(
                b.createdAt
              ).getTime()
          );
      const uncompletedGameEvents =
        gameAssignmentEvents.filter(
          (event) =>
            !histories.some(
              (history) => {
                const startedDiffMs =
                  Math.abs(
                    new Date(
                      history.startedAt
                    ).getTime() -
                      new Date(
                        event.createdAt
                      ).getTime()
                  );

                return (
                  history.courtId ===
                    event.courtId &&
                  samePlayerSet(
                    getHistoryPlayerIds(
                      history
                    ),
                    event.playerIds
                  ) &&
                  startedDiffMs <=
                    5 * 60 * 1000
                );
              }
            )
        );

      const participantLine =
        participantRows
          .map(
            (row) =>
              `${row.name} ${row.matchCount}경기`
          )
          .join(", ");
      const mixingLine =
        mixingRows
          .map(
            (row) =>
              `${row.name} ${row.mixPercent}% - 교류 ${row.metCount}명 / 미교류 ${row.missedCount}명 (대상 ${row.possibleCount}명)`
          )
          .join(", ");
      const leastMixedLine =
        leastMixedRows.length > 0
          ? leastMixedRows
              .map(
                (row) =>
                  `${row.name} ${row.mixPercent}%`
              )
              .join(", ")
          : "기록 없음";
      const noMissLine =
        noMissRows.length > 0
          ? noMissRows
              .map((row) => row.name)
              .join(", ")
          : "없음";
      const matchLines =
        histories
          .map((history, index) => {
            const scoreText =
              typeof history.teamAScore ===
                "number" &&
              typeof history.teamBScore ===
                "number"
                ? ` ${history.teamAScore}:${history.teamBScore}`
                : "";
            const assignmentEvent =
              findRelatedEvent(
                history,
                reportEvents,
                [
                  "AUTO_MATCH",
                  "MANUAL_MATCH",
                  "QUEUED_PROMOTED",
                ]
              );
            const finishedEvent =
              findRelatedEvent(
                history,
                reportEvents,
                ["MATCH_FINISHED"]
              );
            const operationText =
              [
                assignmentEvent
                  ? `${getOperationLabel(assignmentEvent)}: ${formatOperator(assignmentEvent)}`
                  : "",
                finishedEvent
                  ? `경기 종료: ${formatOperator(finishedEvent)}`
                  : "",
              ]
                .filter(Boolean)
                .join(" / ");

            return `${index + 1}. Court ${history.courtId} ${formatKstTime(history.startedAt)}~${formatKstTime(history.endedAt)} ${formatTeam(history.teamA, histories, currentNames)} vs ${formatTeam(history.teamB, histories, currentNames)}${scoreText}${operationText ? ` / ${operationText}` : ""}`;
          })
          .join("\n");
      const uncompletedMatchLines =
        uncompletedGameEvents
          .map(
            (event, index) =>
              `${histories.length + index + 1}. Court ${event.courtId} ${formatKstTime(event.createdAt)}~종료 기록 없음 ${formatEventPlayers(event.playerIds, event.playerNames)}`
          )
          .join("\n");
      const allMatchLines =
        [
          matchLines,
          uncompletedMatchLines,
        ]
          .filter(Boolean)
          .join("\n");
      const operationLines =
        operationEvents
          .map(
            (event, index) =>
              `${index + 1}. ${formatKstTime(event.createdAt)} Court ${event.courtId} ${getOperationLabel(event)} / ${formatOperator(event)} / ${formatEventPlayers(event.playerIds, event.playerNames)}`
          )
          .join("\n");

      const copyText = [
        `🏸 STEP UP MATCH 오늘 운동 리포트 (${getDateText()})`,
        "",
        `참여 인원: ${participantCount}명`,
        `오늘 총 경기: ${totalMatches}경기`,
        `종료/점수 입력: ${completedMatches}경기 / ${scoredMatches}경기`,
        `경기 수 분포: 최다 ${maxMatches}경기 / 최소 ${minMatches}경기 / 평균 ${averageMatches}경기`,
        "",
        "대진 운영 기록",
        `- 게임코트 자동 대진: ${autoGameEvents}회`,
        `- 게임코트 수동 대진: ${manualGameEvents}회`,
        `- 대기코트 자동 대진: ${autoQueuedEvents}회`,
        `- 대기코트 수동 대진: ${manualQueuedEvents}회`,
        `- 대기코트 승격: ${promotedEvents}회`,
        `- 선수 교체: ${replacementEvents}회`,
        `- 코트 내 선수 위치 교체: ${swapEvents}회`,
        "",
        "섞임 지표",
        `- 평균 섞임률: ${averageMixPercent}%`,
        `- 가장 덜 섞인 인원: ${leastMixedLine}`,
        `- 오늘 모든 참가자와 한 번 이상 같은 경기를 한 인원: ${noMissLine}`,
        "",
        "개인별 섞임률",
        mixingLine || "기록 없음",
        "",
        "인원별 경기 수",
        participantLine || "기록 없음",
        "",
        "오늘 전체 경기",
        allMatchLines || "기록 없음",
        "",
        "운영 상세 로그",
        operationLines || "기록 없음",
      ].join("\n");

      return {
        participantRows,
        mixingRows,
        participantCount,
        totalMatches,
        completedMatches,
        scoredMatches,
        maxMatches,
        minMatches,
        averageMatches,
        averageMixPercent,
        leastMixedRows,
        mostMixedRows,
        noMissRows,
        autoGameEvents,
        manualGameEvents,
        autoQueuedEvents,
        manualQueuedEvents,
        promotedEvents,
        replacementEvents,
        swapEvents,
        operationEvents,
        histories,
        uncompletedGameEvents,
        currentNames,
        copyText,
        isSnapshotReport:
          shouldUseSnapshot,
        snapshotCreatedAt:
          snapshotToUse?.createdAt,
        snapshotWorkoutDate:
          snapshotToUse?.workoutDate,
      };
    }, [
      latestSnapshot,
      matchHistory,
      players,
      selectedSnapshot,
      workoutReportEvents,
    ]);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(
        report.copyText
      );
      setCopied(true);
      window.setTimeout(
        () => setCopied(false),
        2000
      );
    } catch {
      setCopied(false);
      window.alert(
        "복사에 실패했습니다. 리포트 문안을 길게 눌러 직접 복사해주세요."
      );
    }
  }

  function saveReport() {
    const ok =
      saveWorkoutReportSnapshot();

    if (!ok) {
      window.alert(
        "저장할 운동 리포트 데이터가 없습니다."
      );
      return;
    }

    setSelectedSnapshotId("");
    setSaved(true);
    window.setTimeout(
      () => setSaved(false),
      2000
    );
  }

  return (
    <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-cyan-100">
            오늘 운동 리포트
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            오늘 생성된 경기, 종료 기록, 개인별 섞임률을 기준으로 단톡방에 공유할 객관 수치를 정리합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveReport}
          className="rounded-xl bg-emerald-400 px-4 py-2 font-bold text-slate-950"
        >
          {saved
            ? "저장 완료"
            : "현재 리포트 저장"}
        </button>
        <button
          type="button"
          onClick={() =>
            void copyReport()
          }
          className="rounded-xl bg-cyan-400 px-4 py-2 font-bold text-slate-950"
        >
          {copied
            ? "복사 완료"
            : "문안 복사"}
        </button>
      </div>
      </div>

      {sortedSnapshots.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
          <label className="block text-sm font-bold text-slate-200">
            저장된 운동 리포트
          </label>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            오늘 운동 전체 종료 시점에 저장된 리포트입니다. 마스터만 이 화면에서 다시 확인할 수 있습니다.
          </p>
          <select
            value={
              effectiveSelectedSnapshotId
            }
            onChange={(event) =>
              setSelectedSnapshotId(
                event.target.value
              )
            }
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm font-bold text-white"
          >
            {!preferSnapshot && (
              <option value="">
                현재 진행 중인 리포트 보기
              </option>
            )}
            {sortedSnapshots.map(
              (snapshot) => (
                <option
                  key={snapshot.id}
                  value={snapshot.id}
                >
                  {snapshot.workoutDate} 저장 리포트 · {formatKstTime(snapshot.createdAt)}
                </option>
              )
            )}
          </select>
        </div>
      )}

      {report.isSnapshotReport && (
        <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
          오늘 운동 데이터가 초기화되어 마지막 백업 리포트를 표시합니다.
          {report.snapshotWorkoutDate &&
            ` 날짜: ${report.snapshotWorkoutDate}`}
          {report.snapshotCreatedAt &&
            ` / 백업 시각: ${formatKstTime(report.snapshotCreatedAt)}`}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-xl bg-slate-950/60 p-3">
          <div className="text-slate-400">
            참여 인원
          </div>
          <div className="mt-1 text-2xl font-black text-white">
            {report.participantCount}명
          </div>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-3">
          <div className="text-slate-400">
            오늘 총 경기
          </div>
          <div className="mt-1 text-2xl font-black text-white">
            {report.totalMatches}경기
          </div>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-3">
          <div className="text-slate-400">
            평균 경기
          </div>
          <div className="mt-1 text-2xl font-black text-white">
            {report.averageMatches}
          </div>
        </div>
        <div className="rounded-xl bg-slate-950/60 p-3">
          <div className="text-slate-400">
            평균 섞임률
          </div>
          <div className="mt-1 text-2xl font-black text-white">
            {report.averageMixPercent}%
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-xl bg-slate-950/60 p-3">
          <div className="font-bold text-slate-200">
            대진 운영 기록
          </div>
          <div className="mt-2 space-y-1 text-slate-400">
            <p>
              게임코트 자동/수동: {report.autoGameEvents}/{report.manualGameEvents}회
            </p>
            <p>
              대기코트 자동/수동: {report.autoQueuedEvents}/{report.manualQueuedEvents}회
            </p>
            <p>
              대기코트 승격: {report.promotedEvents}회
            </p>
            <p>
              선수 교체/코트 내 교체: {report.replacementEvents}/{report.swapEvents}회
            </p>
            <p>
              종료/점수 입력: {report.completedMatches}/{report.scoredMatches}경기
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-950/60 p-3">
          <div className="font-bold text-slate-200">
            섞임 지표
          </div>
          <div className="mt-2 space-y-1 text-slate-400">
            <p>
              평균 섞임률: {report.averageMixPercent}%
            </p>
            <p>
              가장 덜 섞인 인원:{" "}
              {report.leastMixedRows
                .map(
                  (row) =>
                    `${row.name} ${row.mixPercent}%`
                )
                .join(", ") || "기록 없음"}
            </p>
            <p>
              전체 참가자와 한 번 이상 만난 인원:{" "}
              {report.noMissRows
                .map((row) => row.name)
                .join(", ") || "없음"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-950/60 p-3">
        <div className="font-bold text-slate-200">
          개인별 섞임률
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          섞임률은 오늘 참가자 중 같은 경기에 한 번 이상 같이 배치된 사람의 비율입니다.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {report.mixingRows.length ===
          0 ? (
            <span className="text-slate-500">
              아직 집계할 경기 기록이 없습니다.
            </span>
          ) : (
            report.mixingRows.map(
              (row) => (
                <span
                  key={row.id}
                  className="rounded-full bg-slate-800 px-3 py-1 text-slate-200"
                  title={`오늘 같은 경기 교류 ${row.metCount}명, 미교류 ${row.missedCount}명, 대상 ${row.possibleCount}명`}
                >
                  {row.name} {row.mixPercent}% · 교류 {row.metCount}명 / 미교류 {row.missedCount}명 · 대상 {row.possibleCount}명
                </span>
              )
            )
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-950/60 p-3">
        <div className="font-bold text-slate-200">
          인원별 경기 수
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {report.participantRows.length ===
          0 ? (
            <span className="text-slate-500">
              아직 집계할 경기 기록이 없습니다.
            </span>
          ) : (
            report.participantRows.map(
              (row) => (
                <span
                  key={row.id}
                  className="rounded-full bg-slate-800 px-3 py-1 text-slate-200"
                >
                  {row.name} {row.matchCount}경기
                </span>
              )
            )
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-950/60 p-3">
        <div className="font-bold text-slate-200">
          오늘 전체 경기
        </div>
        <div className="mt-2 space-y-2 text-sm text-slate-300">
          {report.histories.length ===
          0 ? (
            <p className="text-slate-500">
              아직 종료된 경기 기록이 없습니다.
            </p>
          ) : (
            report.histories.map(
              (history, index) => {
                const scoreText =
                  typeof history.teamAScore ===
                    "number" &&
                  typeof history.teamBScore ===
                    "number"
                    ? ` · ${history.teamAScore}:${history.teamBScore}`
                    : "";
                const assignmentEvent =
                  findRelatedEvent(
                    history,
                    report.operationEvents,
                    [
                      "AUTO_MATCH",
                      "MANUAL_MATCH",
                      "QUEUED_PROMOTED",
                    ]
                  );
                const finishedEvent =
                  findRelatedEvent(
                    history,
                    report.operationEvents,
                    ["MATCH_FINISHED"]
                  );

                return (
                  <div
                    key={history.id}
                    className="rounded-xl bg-slate-900 px-3 py-2"
                  >
                    {index + 1}. Court {history.courtId}{" "}
                    {formatKstTime(
                      history.startedAt
                    )}
                    ~
                    {formatKstTime(
                      history.endedAt
                    )}{" "}
                    {formatTeam(
                      history.teamA,
                      report.histories,
                      report.currentNames
                    )}{" "}
                    vs{" "}
                    {formatTeam(
                      history.teamB,
                      report.histories,
                      report.currentNames
                    )}
                    {scoreText}
                    {(assignmentEvent ||
                      finishedEvent) && (
                      <div className="mt-1 text-xs leading-5 text-slate-400">
                        {assignmentEvent && (
                          <span>
                            {getOperationLabel(
                              assignmentEvent
                            )}
                            :{" "}
                            {formatOperator(
                              assignmentEvent
                            )}
                          </span>
                        )}
                        {assignmentEvent &&
                          finishedEvent &&
                          " / "}
                        {finishedEvent && (
                          <span>
                            경기 종료:{" "}
                            {formatOperator(
                              finishedEvent
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            )
          )}
        </div>
      </div>

      {report.uncompletedGameEvents.length >
        0 && (
        <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3">
          <div className="font-bold text-amber-100">
            종료 기록 없는 대진
          </div>
          <p className="mt-1 text-xs leading-5 text-amber-100/80">
            대진은 게임코트에 올라갔지만 경기 종료 기록이 없어 오늘 전체 경기 목록에는 시간 종료가 남지 않은 대진입니다.
          </p>
          <div className="mt-2 space-y-2 text-sm text-amber-100">
            {report.uncompletedGameEvents.map(
              (event, index) => (
                <div
                  key={event.id}
                  className="rounded-xl bg-slate-950/60 px-3 py-2"
                >
                  {report.histories.length +
                    index +
                    1}
                  . Court {event.courtId}{" "}
                  {formatKstTime(
                    event.createdAt
                  )}
                  ~종료 기록 없음{" "}
                  {formatEventPlayers(
                    event.playerIds,
                    event.playerNames
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl bg-slate-950/60 p-3">
        <div className="font-bold text-slate-200">
          운영 상세 로그
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          자동/수동 대진 확정, 대기코트 승격, 선수 교체, 코트 내 위치 교환, 경기 종료를 누가 조작했는지 기록합니다.
        </p>
        <div className="mt-2 space-y-2 text-sm text-slate-300">
          {report.operationEvents.length ===
          0 ? (
            <p className="text-slate-500">
              아직 운영 로그가 없습니다.
            </p>
          ) : (
            report.operationEvents.map(
              (event, index) => (
                <div
                  key={event.id}
                  className="rounded-xl bg-slate-900 px-3 py-2"
                >
                  <div className="font-semibold text-slate-100">
                    {index + 1}.{" "}
                    {formatKstTime(
                      event.createdAt
                    )}{" "}
                    Court {event.courtId} ·{" "}
                    {getOperationLabel(
                      event
                    )}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    조작자:{" "}
                    {formatOperator(event)}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    대상:{" "}
                    {formatEventPlayers(
                      event.playerIds,
                      event.playerNames
                    )}
                  </div>
                  {event.description && (
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      {event.description}
                    </div>
                  )}
                </div>
              )
            )
          )}
        </div>
      </div>

      <textarea
        readOnly
        value={report.copyText}
        className="mt-4 h-72 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-200"
      />
    </div>
  );
}
