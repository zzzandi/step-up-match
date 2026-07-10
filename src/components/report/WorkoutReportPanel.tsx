import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useMatchStore,
} from "@/store/useMatchStore";
import {
  useAccessSession,
} from "@/auth/access";
import type {
  MatchHistory,
} from "@/types/matchHistory";
import type {
  WorkoutReportEvent,
} from "@/types/workoutReport";
import {
  deleteWorkoutReportSnapshotsByDateFromServer,
  deleteWorkoutReportSnapshotFromServer,
  getWorkoutReportSnapshotsFromServer,
  saveWorkoutReportSnapshotToServer,
} from "@/services/workoutReportSnapshotService";

interface MixingRow {
  id: string;
  name: string;
  arrivalTimeText: string;
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
    const isQueueAssignment =
      (event.type === "AUTO_MATCH" ||
        event.type ===
          "MANUAL_MATCH") &&
      event.target === "QUEUE";

    if (
      (!isQueueAssignment &&
        event.courtId !==
          history.courtId) ||
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
    const eventAt =
      new Date(
        event.createdAt
      ).getTime();
    const startedAt =
      new Date(
        history.startedAt
      ).getTime();
    const allowedDiffMs =
      isQueueAssignment
        ? 90 * 60 * 1000
        : 10 * 60 * 1000;

    return (
      samePlayerSet(
        getHistoryPlayerIds(
          history
        ),
        event.playerIds
      ) &&
      diffMs <= allowedDiffMs &&
      (!isQueueAssignment ||
        eventAt <=
          startedAt + 60 * 1000)
    );
  });
}

function findMatchOperationEvents(
  history: MatchHistory,
  events: WorkoutReportEvent[]
) {
  const startedAt =
    new Date(history.startedAt).getTime();
  const endedAt =
    new Date(history.endedAt).getTime();
  const assignmentEvent =
    findRelatedEvent(history, events, [
      "AUTO_MATCH",
      "MANUAL_MATCH",
      "QUEUED_PROMOTED",
    ]);
  const assignmentAt =
    assignmentEvent
      ? new Date(
          assignmentEvent.createdAt
        ).getTime()
      : startedAt;
  const lowerBound =
    Math.min(startedAt, assignmentAt) -
    5 * 60 * 1000;
  const upperBound =
    endedAt + 60 * 1000;
  const replacements =
    events
      .filter((event) => {
        if (
          event.type !==
            "PLAYER_REPLACED" ||
          event.courtId !==
            history.courtId
        ) {
          return false;
        }

        const eventAt =
          new Date(
            event.createdAt
          ).getTime();

        return (
          eventAt >= lowerBound &&
          eventAt <= upperBound
        );
      })
      .sort(
        (a, b) =>
          new Date(
            a.createdAt
          ).getTime() -
          new Date(
            b.createdAt
          ).getTime()
      );

  return {
    assignmentEvent,
    replacements,
  };
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function WorkoutReportPanel({
  preferSnapshot = false,
}: WorkoutReportPanelProps) {
  const session =
    useAccessSession();
  const canDeleteReport =
    session?.role === "MASTER";
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
  const replaceWorkoutReportSnapshotsForDate =
    useMatchStore(
      (state) =>
        state.replaceWorkoutReportSnapshotsForDate
    );
  const deleteWorkoutReportSnapshot =
    useMatchStore(
      (state) =>
        state.deleteWorkoutReportSnapshot
    );
  const deleteWorkoutReportSnapshots =
    useMatchStore(
      (state) =>
        state.deleteWorkoutReportSnapshots
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
    serverMessage,
    setServerMessage,
  ] = useState("");
  const [
    deleting,
    setDeleting,
  ] = useState(false);
  const [
    exportingImage,
    setExportingImage,
  ] = useState(false);
  const [
    selectedSnapshotId,
    setSelectedSnapshotId,
  ] = useState("");
  const [
    selectedReportDate,
    setSelectedReportDate,
  ] = useState(() =>
    getKstDateKey()
  );

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
  const selectedDateSnapshots =
    sortedSnapshots.filter(
      (snapshot) =>
        snapshot.workoutDate ===
        selectedReportDate
    );
  const latestSelectedDateSnapshot =
    selectedDateSnapshots[0] ??
    null;
  const effectiveSelectedSnapshotId =
    selectedDateSnapshots.some(
      (snapshot) =>
        snapshot.id ===
        selectedSnapshotId
    )
      ? selectedSnapshotId
      :
    (preferSnapshot
      ? latestSelectedDateSnapshot?.id ??
        ""
      : "");
  const selectedSnapshot =
    selectedDateSnapshots.find(
      (snapshot) =>
        snapshot.id ===
        effectiveSelectedSnapshotId
    ) ?? null;
  const selectedReportDateHasSnapshot =
    selectedDateSnapshots.length > 0;

  useEffect(() => {
    let cancelled = false;

    getWorkoutReportSnapshotsFromServer(
      selectedReportDate
    )
      .then((snapshots) => {
        if (cancelled) {
          return;
        }

        replaceWorkoutReportSnapshotsForDate(
          selectedReportDate,
          snapshots
        );
        if (snapshots.length > 0) {
          setServerMessage(
            "서버 저장 리포트를 불러왔습니다."
          );
          setSelectedSnapshotId(
            (current) =>
              snapshots.some(
                (snapshot) =>
                  snapshot.id ===
                  current
              )
                ? current
                :
              snapshots[0]?.id ||
              ""
          );
        } else {
          setSelectedSnapshotId("");
          setServerMessage(
            "선택한 날짜의 서버 저장 리포트가 없습니다."
          );
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setServerMessage(
            "서버 리포트 테이블이 아직 없거나 조회할 수 없습니다. Supabase SQL 설정 후 서버 저장이 활성화됩니다."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    replaceWorkoutReportSnapshotsForDate,
    selectedReportDate,
  ]);

  const report =
    (() => {
      const snapshotToUse =
        selectedSnapshot ??
        (preferSnapshot
          ? latestSelectedDateSnapshot
          : null);
      const shouldUseSnapshot =
        Boolean(snapshotToUse);
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
          : selectedReportDate ||
            getKstDateKey();
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
      const arrivalTimeByPlayer =
        new Map(
          reportPlayers.map(
            (player) => [
              player.id,
              player.arrivalTime
                ? formatKstTime(
                    player.arrivalTime
                  )
                : "-",
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
              arrivalTimeText:
                arrivalTimeByPlayer.get(
                  playerId
                ) ?? "-",
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
              `${row.name} 참가 ${row.arrivalTimeText} / ${row.matchCount}경기`
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
            const {
              assignmentEvent,
              replacements,
            } =
              findMatchOperationEvents(
                history,
                reportEvents
              );
            const operationText =
              [
                assignmentEvent
                  ? `${getOperationLabel(assignmentEvent)}: ${formatOperator(assignmentEvent)}`
                  : "",
                ...replacements.map(
                  (event) =>
                    `${getOperationLabel(event)}: ${formatOperator(event)} / ${event.description}`
                ),
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
              `${histories.length + index + 1}. Court ${event.courtId} ${formatKstTime(event.createdAt)}~종료 미기록 ${formatEventPlayers(event.playerIds, event.playerNames)}`
          )
          .join("\n");
      const allMatchLines =
        [
          matchLines,
          uncompletedMatchLines,
        ]
          .filter(Boolean)
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
    })();

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

  function getReportTitle() {
    return `STEP UP MATCH 운동 리포트 · ${report.snapshotWorkoutDate ?? selectedReportDate}`;
  }

  function getMatchOperationHtml(
    history: MatchHistory
  ) {
    const {
      assignmentEvent,
      replacements,
    } = findMatchOperationEvents(
      history,
      report.operationEvents
    );
    const items = [
      assignmentEvent
        ? `${getOperationLabel(assignmentEvent)}: ${formatOperator(assignmentEvent)}`
        : "",
      ...replacements.map(
        (event) =>
          `${getOperationLabel(event)}: ${formatOperator(event)}${event.description ? ` / ${event.description}` : ""}`
      ),
    ].filter(Boolean);

    if (items.length === 0) {
      return "";
    }

    return `<div class="match-ops">${items
      .map(
        (item) =>
          `<div>${escapeHtml(item)}</div>`
      )
      .join("")}</div>`;
  }

  function createReportExportHtml({
    includeToolbar,
    imageMode = false,
  }: {
    includeToolbar: boolean;
    imageMode?: boolean;
  }) {
    const mixingRows =
      report.mixingRows
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.name)}</td><td>${row.mixPercent}%</td><td>${row.metCount}명</td><td>${row.missedCount}명</td></tr>`
        )
        .join("");
    const matchRows =
      report.participantRows
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.arrivalTimeText)}</td><td>${row.matchCount}경기</td></tr>`
        )
        .join("");
    const historyCards =
      report.histories
        .map(
          (history, index) => {
            const scoreText =
              typeof history.teamAScore ===
                "number" &&
              typeof history.teamBScore ===
                "number"
                ? ` · ${history.teamAScore}:${history.teamBScore}`
                : "";
            return `
              <article class="match-card">
                <div class="match-head">
                  <span>${index + 1}. Court ${history.courtId}</span>
                  <span>${formatKstTime(history.startedAt)}~${formatKstTime(history.endedAt)}${scoreText}</span>
                </div>
                <div class="match-teams">
                  ${escapeHtml(formatTeam(history.teamA, report.histories, report.currentNames))}
                  <span>vs</span>
                  ${escapeHtml(formatTeam(history.teamB, report.histories, report.currentNames))}
                </div>
                ${getMatchOperationHtml(history)}
              </article>
            `;
          }
        )
        .join("");
    const uncompletedCards =
      report.uncompletedGameEvents
        .map(
          (event, index) => `
            <article class="match-card warning-card">
              <div class="match-head">
                <span>${report.histories.length + index + 1}. Court ${event.courtId}</span>
                <span>${formatKstTime(event.createdAt)}~종료 미기록</span>
              </div>
              <div class="match-teams">${escapeHtml(formatEventPlayers(event.playerIds, event.playerNames))}</div>
            </article>
          `
        )
        .join("");
    const toolbar = includeToolbar
      ? `<div class="toolbar"><button onclick="window.print()">PDF로 저장 / 인쇄</button></div>`
      : "";

    return `
      <!doctype html>
      <html lang="ko">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(getReportTitle())}</title>
          <style>
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            html, body { margin: 0; min-height: 100%; background: #020617; }
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #e5e7eb; }
            .export-root { width: ${imageMode ? "900px" : "100%"}; min-height: 100%; padding: ${imageMode ? "18px" : "24px"}; background: radial-gradient(circle at top left, rgba(34, 211, 238, 0.16), transparent 34%), linear-gradient(180deg, #020617 0%, #0f172a 52%, #020617 100%); }
            .page { max-width: ${imageMode ? "864px" : "1120px"}; margin: 0 auto; padding: ${imageMode ? "22px" : "30px"}; border: 1px solid rgba(34, 211, 238, 0.35); border-radius: 30px; background: rgba(15, 23, 42, 0.88); box-shadow: 0 28px 90px rgba(0, 0, 0, 0.35); }
            .toolbar { display: flex; justify-content: flex-end; margin-bottom: 18px; }
            button { border: 0; border-radius: 14px; background: #22d3ee; color: #020617; font-weight: 900; padding: 12px 18px; cursor: pointer; }
            .eyebrow { color: #67e8f9; font-weight: 900; letter-spacing: 0.08em; margin: 0 0 10px; }
            h1 { margin: 0 0 8px; font-size: ${imageMode ? "30px" : "36px"}; letter-spacing: -0.04em; color: #ffffff; }
            p { color: #94a3b8; line-height: 1.65; }
            h2 { margin: ${imageMode ? "18px" : "30px"} 0 10px; color: #ffffff; font-size: ${imageMode ? "19px" : "22px"}; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: ${imageMode ? "8px" : "12px"}; margin-top: ${imageMode ? "16px" : "24px"}; }
            .card { border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 18px; padding: ${imageMode ? "10px" : "16px"}; background: rgba(2, 6, 23, 0.72); color: #94a3b8; }
            .value { margin-top: 4px; font-size: ${imageMode ? "24px" : "30px"}; font-weight: 950; color: #ffffff; }
            .metric { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
            .metric .card { line-height: 1.8; }
            .section-card { margin-top: ${imageMode ? "12px" : "18px"}; border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 22px; padding: ${imageMode ? "12px" : "18px"}; background: rgba(2, 6, 23, 0.55); }
            table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 18px; background: rgba(2, 6, 23, 0.7); }
            th, td { border-bottom: 1px solid rgba(148, 163, 184, 0.16); padding: ${imageMode ? "7px 9px" : "10px 12px"}; text-align: left; vertical-align: top; }
            th { background: rgba(15, 23, 42, 0.95); color: #93c5fd; font-size: 13px; }
            td { color: #dbeafe; font-size: 13px; }
            tr:last-child td { border-bottom: 0; }
            .match-list { display: grid; gap: ${imageMode ? "7px" : "10px"}; }
            .match-card { border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 18px; padding: ${imageMode ? "9px 10px" : "13px 14px"}; background: rgba(15, 23, 42, 0.72); }
            .warning-card { border-color: rgba(252, 211, 77, 0.36); background: rgba(120, 53, 15, 0.18); }
            .match-head { display: flex; justify-content: space-between; gap: 12px; color: #f8fafc; font-weight: 850; }
            .match-teams { margin-top: 6px; color: #dbeafe; font-size: ${imageMode ? "13px" : "14px"}; line-height: 1.5; }
            .match-teams span { color: #94a3b8; margin: 0 8px; font-weight: 800; }
            .match-ops { margin-top: 7px; border-radius: 14px; padding: ${imageMode ? "6px 8px" : "8px 10px"}; background: rgba(34, 211, 238, 0.08); color: #a5f3fc; font-size: ${imageMode ? "11px" : "12px"}; line-height: 1.45; }
            .two-columns { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
            @media print {
              body { background: #020617; }
              button { display: none; }
              .export-root { padding: 0; }
              .page { margin: 0; max-width: none; min-height: 100vh; border-radius: 0; border: 0; box-shadow: none; }
            }
            @media (max-width: 760px) {
              .summary, .metric, .two-columns { grid-template-columns: 1fr; }
              .match-head { flex-direction: column; }
            }
          </style>
        </head>
        <body>
          <div class="export-root">
          <main class="page" id="report-export-page">
            ${toolbar}
            <p class="eyebrow">STEP UP MATCH</p>
            <h1>${escapeHtml(getReportTitle())}</h1>
            <div class="summary">
              <div class="card">참여 인원<div class="value">${report.participantCount}명</div></div>
              <div class="card">오늘 총 경기<div class="value">${report.totalMatches}경기</div></div>
              <div class="card">평균 경기<div class="value">${report.averageMatches}</div></div>
              <div class="card">평균 섞임률<div class="value">${report.averageMixPercent}%</div></div>
            </div>
            <div class="two-columns">
              <section class="section-card">
                <h2>대진 운영 기록</h2>
                <div class="metric">
                  <div class="card">게임코트 자동/수동<br /><strong>${report.autoGameEvents}/${report.manualGameEvents}회</strong></div>
                  <div class="card">대기코트 자동/수동<br /><strong>${report.autoQueuedEvents}/${report.manualQueuedEvents}회</strong></div>
                  <div class="card">대기코트 승격<br /><strong>${report.promotedEvents}회</strong></div>
                  <div class="card">선수 교체/코트 내 교체<br /><strong>${report.replacementEvents}/${report.swapEvents}회</strong></div>
                </div>
              </section>
              <section class="section-card">
                <h2>섞임 지표</h2>
                <div class="card">평균 섞임률: <strong>${report.averageMixPercent}%</strong><br />가장 덜 섞인 인원: ${escapeHtml(report.leastMixedRows.map((row) => `${row.name} ${row.mixPercent}%`).join(", ") || "기록 없음")}<br />전체 참가자와 한 번 이상 만난 인원: ${escapeHtml(report.noMissRows.map((row) => row.name).join(", ") || "없음")}</div>
              </section>
            </div>
            <section class="section-card">
              <h2>개인별 섞임률</h2>
              <table><thead><tr><th>이름</th><th>섞임률</th><th>같이 쳐본 사람</th><th>못 쳐본 사람</th></tr></thead><tbody>${mixingRows}</tbody></table>
            </section>
            <section class="section-card">
              <h2>인원별 경기 수</h2>
              <table><thead><tr><th>이름</th><th>참가 시간</th><th>경기 수</th></tr></thead><tbody>${matchRows}</tbody></table>
            </section>
            <section class="section-card">
              <h2>오늘 전체 경기</h2>
              <div class="match-list">${historyCards || `<div class="card">기록 없음</div>`}${uncompletedCards}</div>
            </section>
          </main>
          </div>
        </body>
      </html>
    `;
  }

  async function downloadCanvasAsPng(
    canvas: HTMLCanvasElement,
    filename: string
  ) {
    const blob =
      await new Promise<Blob | null>(
        (resolve) =>
          canvas.toBlob(
            resolve,
            "image/png",
            0.95
          )
      );

    if (!blob) {
      throw new Error(
        "PNG export failed."
      );
    }

    const url = URL.createObjectURL(blob);
    const link =
      document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function getImageReportRows() {
    const matchRows =
      report.histories.map(
        (history, index) => {
          const scoreText =
            typeof history.teamAScore ===
              "number" &&
            typeof history.teamBScore ===
              "number"
              ? ` · ${history.teamAScore}:${history.teamBScore}`
              : "";
          const {
            assignmentEvent,
            replacements,
          } =
            findMatchOperationEvents(
              history,
              report.operationEvents
            );
          const operationLines = [
            assignmentEvent
              ? `${getOperationLabel(assignmentEvent)}: ${formatOperator(assignmentEvent)}`
              : "",
            ...replacements.map(
              (event) =>
                `${getOperationLabel(event)}: ${formatOperator(event)}${event.description ? ` / ${event.description}` : ""}`
            ),
          ].filter(Boolean);

          return {
            title: `${index + 1}. Court ${history.courtId} · ${formatKstTime(history.startedAt)}~${formatKstTime(history.endedAt)}${scoreText}`,
            lines: [
              `${formatTeam(history.teamA, report.histories, report.currentNames)} vs ${formatTeam(history.teamB, report.histories, report.currentNames)}`,
              ...operationLines,
            ],
          };
        }
      );
    const uncompletedRows =
      report.uncompletedGameEvents.map(
        (event, index) => ({
          title: `${report.histories.length + index + 1}. Court ${event.courtId} · ${formatKstTime(event.createdAt)}~종료 미기록`,
          lines: [
            formatEventPlayers(
              event.playerIds,
              event.playerNames
            ),
            "게임코트 확정 기록은 있지만 경기 종료 기록이 없어 정식 종료 경기로 집계되지 않은 대진입니다.",
          ],
          warning: true,
        })
      );

    return {
      operations: [
        {
          title: "게임코트 대진",
          lines: [
            `자동 ${report.autoGameEvents}회 · 수동 ${report.manualGameEvents}회`,
          ],
        },
        {
          title: "대기코트 대진",
          lines: [
            `자동 ${report.autoQueuedEvents}회 · 수동 ${report.manualQueuedEvents}회`,
          ],
        },
        {
          title: "대기코트 승격",
          lines: [`${report.promotedEvents}회`],
        },
        {
          title: "선수 교체",
          lines: [
            `대기자 교체 ${report.replacementEvents}회 · 코트 내 교체 ${report.swapEvents}회`,
          ],
        },
        {
          title: "종료/점수 입력",
          lines: [
            `${report.completedMatches}경기 종료 · ${report.scoredMatches}경기 점수 입력`,
          ],
        },
      ],
      mixing: report.mixingRows.map(
        (row) => ({
          title: `${row.name} · ${row.mixPercent}%`,
          lines: [
            `같이 쳐본 사람 ${row.metCount}/${row.possibleCount}명 · 못 쳐본 사람 ${row.missedCount}명`,
          ],
        })
      ),
      participants:
        report.participantRows.map(
          (row) => ({
            title: `${row.name} · ${row.matchCount}경기`,
            lines: [
              `참가 시간 ${row.arrivalTimeText}`,
            ],
          })
        ),
      matches: [
        ...matchRows,
        ...uncompletedRows,
      ],
    };
  }

  function wrapCanvasText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ) {
    const words = text.split(/(\s+)/);
    const lines: string[] = [];
    let current = "";

    words.forEach((word) => {
      if (!word) {
        return;
      }

      const next = current
        ? `${current}${word}`
        : word;

      if (
        ctx.measureText(next).width <=
          maxWidth ||
        !current
      ) {
        current = next;
      } else {
        lines.push(current.trim());

        if (
          ctx.measureText(word).width <=
          maxWidth
        ) {
          current = word.trimStart();
          return;
        }

        let chunk = "";
        [...word].forEach((char) => {
          const nextChunk = `${chunk}${char}`;

          if (
            ctx.measureText(nextChunk).width <=
              maxWidth ||
            !chunk
          ) {
            chunk = nextChunk;
          } else {
            lines.push(chunk);
            chunk = char;
          }
        });
        current = chunk;
      }
    });

    if (current) {
      lines.push(current.trim());
    }

    return lines;
  }

  async function exportReportImagesToCanvas() {
    const width = 1080;
    const pageHeight = 1600;
    const pixelRatio = 2;
    const padding = 48;
    const contentWidth =
      width - padding * 2;
    const rows = getImageReportRows();
    const pages: HTMLCanvasElement[] = [];
    let canvas =
      document.createElement("canvas");
    canvas.width = width * pixelRatio;
    canvas.height =
      pageHeight * pixelRatio;
    let ctx = canvas.getContext("2d");
    let pageIndex = 1;

    if (!ctx) {
      throw new Error(
        "Canvas context is unavailable."
      );
    }

    ctx.scale(pixelRatio, pixelRatio);

    const paintBackground = () => {
      const gradient =
        ctx!.createLinearGradient(
          0,
          0,
          0,
          pageHeight
        );
      gradient.addColorStop(
        0,
        "#020617"
      );
      gradient.addColorStop(
        0.55,
        "#0f172a"
      );
      gradient.addColorStop(
        1,
        "#020617"
      );
      ctx!.fillStyle = gradient;
      ctx!.fillRect(
        0,
        0,
        width,
        pageHeight
      );

      const radial =
        ctx!.createRadialGradient(
          120,
          80,
          20,
          120,
          80,
          520
        );
      radial.addColorStop(
        0,
        "rgba(34, 211, 238, 0.22)"
      );
      radial.addColorStop(
        1,
        "rgba(34, 211, 238, 0)"
      );
      ctx!.fillStyle = radial;
      ctx!.fillRect(
        0,
        0,
        width,
        pageHeight
      );
    };

    const paintHeader = () => {
      ctx!.fillStyle = "#67e8f9";
      ctx!.font =
        "900 22px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx!.fillText(
        "STEP UP MATCH",
        padding,
        54
      );
      ctx!.fillStyle = "#ffffff";
      ctx!.font =
        "900 34px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx!.fillText(
        getReportTitle(),
        padding,
        102
      );
      ctx!.fillStyle = "#94a3b8";
      ctx!.font =
        "700 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx!.fillText(
        `Page ${pageIndex}`,
        width - padding - 70,
        54
      );
    };

    const startNewPage = () => {
      pages.push(canvas);
      pageIndex += 1;
      canvas =
        document.createElement("canvas");
      canvas.width =
        width * pixelRatio;
      canvas.height =
        pageHeight * pixelRatio;
      ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error(
          "Canvas context is unavailable."
        );
      }

      ctx.scale(
        pixelRatio,
        pixelRatio
      );
      paintBackground();
      paintHeader();
      return 142;
    };

    paintBackground();
    paintHeader();
    let y = 142;

    const drawCard = (
      x: number,
      top: number,
      cardWidth: number,
      cardHeight: number,
      fill = "rgba(15, 23, 42, 0.86)",
      stroke = "rgba(34, 211, 238, 0.22)"
    ) => {
      ctx!.fillStyle = fill;
      ctx!.strokeStyle = stroke;
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.roundRect(
        x,
        top,
        cardWidth,
        cardHeight,
        22
      );
      ctx!.fill();
      ctx!.stroke();
    };

    const ensureSpace = (
      requiredHeight: number
    ) => {
      if (
        y + requiredHeight >
        pageHeight - padding
      ) {
        y = startNewPage();
      }
    };

    const drawSectionTitle = (
      title: string
    ) => {
      ensureSpace(58);
      ctx!.fillStyle = "#67e8f9";
      ctx!.font =
        "900 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx!.fillText(
        title,
        padding,
        y
      );
      y += 28;
    };

    const drawRow = (
      title: string,
      lines: string[],
      warning = false
    ) => {
      ctx!.font =
        "900 20px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      const titleLines =
        wrapCanvasText(
          ctx!,
          title,
          contentWidth - 36
        );
      ctx!.font =
        "650 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      const bodyLines =
        lines.flatMap((line) =>
          wrapCanvasText(
            ctx!,
            line,
            contentWidth - 36
          )
        );
      const height =
        30 +
        titleLines.length * 26 +
        Math.max(0, bodyLines.length) *
          23 +
        22;

      ensureSpace(height + 10);
      drawCard(
        padding,
        y,
        contentWidth,
        height,
        warning
          ? "rgba(120, 53, 15, 0.24)"
          : "rgba(15, 23, 42, 0.82)",
        warning
          ? "rgba(252, 211, 77, 0.42)"
          : "rgba(148, 163, 184, 0.22)"
      );

      let rowY = y + 28;
      ctx!.fillStyle = warning
        ? "#fef3c7"
        : "#f8fafc";
      ctx!.font =
        "900 20px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      titleLines.forEach((line) => {
        ctx!.fillText(
          line,
          padding + 18,
          rowY
        );
        rowY += 26;
      });
      ctx!.fillStyle = "#dbeafe";
      ctx!.font =
        "650 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      bodyLines.forEach((line) => {
        ctx!.fillText(
          line,
          padding + 18,
          rowY
        );
        rowY += 23;
      });
      y += height + 10;
    };

    const drawSummary = () => {
      const gap = 12;
      const cardWidth =
        (contentWidth - gap * 3) / 4;
      const cards = [
        {
          label: "참여 인원",
          value: `${report.participantCount}명`,
        },
        {
          label: "오늘 총 경기",
          value: `${report.totalMatches}경기`,
        },
        {
          label: "평균 경기",
          value: report.averageMatches,
        },
        {
          label: "평균 섞임률",
          value: `${report.averageMixPercent}%`,
        },
      ];

      ensureSpace(118);
      cards.forEach((card, index) => {
        const x =
          padding +
          index * (cardWidth + gap);
        drawCard(
          x,
          y,
          cardWidth,
          100,
          "rgba(2, 6, 23, 0.78)",
          "rgba(148, 163, 184, 0.20)"
        );
        ctx!.fillStyle = "#94a3b8";
        ctx!.font =
          "700 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
        ctx!.fillText(
          card.label,
          x + 16,
          y + 30
        );
        ctx!.fillStyle = "#ffffff";
        ctx!.font =
          "950 30px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
        ctx!.fillText(
          card.value,
          x + 16,
          y + 70
        );
      });
      y += 124;
    };

    const drawSection = (
      title: string,
      sectionRows: {
        title: string;
        lines: string[];
        warning?: boolean;
      }[]
    ) => {
      drawSectionTitle(title);

      if (sectionRows.length === 0) {
        drawRow("기록 없음", []);
        return;
      }

      sectionRows.forEach((row) =>
        drawRow(
          row.title,
          row.lines,
          row.warning
        )
      );
      y += 14;
    };

    drawSummary();
    drawSection(
      "대진 운영 기록",
      rows.operations
    );
    drawSection(
      "섞임 지표",
      [
        {
          title: `평균 섞임률 ${report.averageMixPercent}%`,
          lines: [
            `가장 덜 섞인 인원: ${report.leastMixedRows.map((row) => `${row.name} ${row.mixPercent}%`).join(", ") || "기록 없음"}`,
            `전체 참가자와 한 번 이상 만난 인원: ${report.noMissRows.map((row) => row.name).join(", ") || "없음"}`,
          ],
        },
      ]
    );
    drawSection(
      "개인별 섞임률",
      rows.mixing
    );
    drawSection(
      "인원별 경기 수",
      rows.participants
    );
    drawSection(
      "오늘 전체 경기",
      rows.matches
    );

    pages.push(canvas);

    const sourceWidth =
      pages[0]?.width ?? width * pixelRatio;
    const sourceHeight =
      pages.reduce(
        (sum, page) =>
          sum + page.height,
        0
      );
    const maxCanvasHeight = 32760;
    const outputScale =
      sourceHeight > maxCanvasHeight
        ? maxCanvasHeight / sourceHeight
        : 1;
    const outputCanvas =
      document.createElement("canvas");
    outputCanvas.width = Math.max(
      1,
      Math.floor(
        sourceWidth * outputScale
      )
    );
    outputCanvas.height = Math.max(
      1,
      Math.floor(
        sourceHeight * outputScale
      )
    );

    const outputContext =
      outputCanvas.getContext("2d");

    if (!outputContext) {
      throw new Error(
        "Canvas context is unavailable."
      );
    }

    outputContext.imageSmoothingEnabled =
      true;
    outputContext.imageSmoothingQuality =
      "high";

    let outputY = 0;
    pages.forEach((page) => {
      const targetHeight =
        page.height * outputScale;
      outputContext.drawImage(
        page,
        0,
        outputY,
        outputCanvas.width,
        targetHeight
      );
      outputY += targetHeight;
    });

    await downloadCanvasAsPng(
      outputCanvas,
      `step-up-match-report-${report.snapshotWorkoutDate ?? selectedReportDate}.png`
    );
  }

  async function exportReportImage() {
    setExportingImage(true);

    try {
      await exportReportImagesToCanvas();
    } catch (error) {
      console.error(error);
      window.alert(
        "이미지 파일 생성에 실패했습니다. 브라우저 저장 권한 또는 다운로드 차단 설정을 확인한 뒤 다시 시도해 주세요."
      );
    } finally {
      setExportingImage(false);
    }
  }

  function openReportPrintView() {
    const printWindow =
      window.open("", "_blank");

    if (!printWindow) {
      window.alert(
        "팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요."
      );
      return;
    }

    printWindow.document.write(
      createReportExportHtml({
        includeToolbar: true,
      })
    );
    printWindow.document.close();
    printWindow.focus();
  }

  async function saveReport() {
    const snapshot =
      saveWorkoutReportSnapshot();

    if (!snapshot) {
      window.alert(
        "저장할 운동 리포트 데이터가 없습니다."
      );
      return;
    }

    setSelectedReportDate(
      snapshot.workoutDate
    );
    setSelectedSnapshotId(
      snapshot.id
    );
    try {
      await saveWorkoutReportSnapshotToServer(
        snapshot
      );
      setServerMessage(
        "서버에 운동 리포트를 저장했습니다."
      );
    } catch (error) {
      console.error(error);
      setServerMessage(
        "브라우저에는 저장했지만 서버 저장은 실패했습니다. Supabase SQL 테이블 설정을 확인해 주세요."
      );
    }
    setSaved(true);
    window.setTimeout(
      () => setSaved(false),
      2000
    );
  }

  async function deleteSelectedReport() {
    const snapshot =
      selectedSnapshot ??
      latestSelectedDateSnapshot;

    if (!snapshot) {
      setServerMessage(
        "삭제할 저장 리포트가 없습니다."
      );
      return;
    }

    if (
      !window.confirm(
        `${snapshot.workoutDate} 운동 리포트를 삭제하시겠습니까?`
      )
    ) {
      return;
    }

    setDeleting(true);

    try {
      await deleteWorkoutReportSnapshotFromServer(
        snapshot.id
      );
      deleteWorkoutReportSnapshot(
        snapshot.id
      );
      const nextSnapshot =
        selectedDateSnapshots.find(
          (item) =>
            item.id !== snapshot.id
        );
      setSelectedSnapshotId(
        nextSnapshot?.id ?? ""
      );
      setServerMessage(
        "운동 리포트를 삭제했습니다."
      );
    } catch (error) {
      console.error(error);
      setServerMessage(
        "서버 리포트 삭제에 실패했습니다. Supabase 삭제 정책이 적용되어 있는지 확인해 주세요."
      );
    } finally {
      setDeleting(false);
    }
  }

  async function deleteSelectedDateReports() {
    if (
      selectedDateSnapshots.length === 0
    ) {
      setServerMessage(
        "삭제할 저장 리포트가 없습니다."
      );
      return;
    }

    if (
      !window.confirm(
        `${selectedReportDate} 날짜의 저장 리포트 ${selectedDateSnapshots.length}개를 모두 삭제하시겠습니까? 오늘 실제 운동 전 테스트 리포트 정리에 사용하세요.`
      )
    ) {
      return;
    }

    setDeleting(true);

    try {
      const localIds =
        selectedDateSnapshots.map(
          (snapshot) => snapshot.id
        );
      const serverDeletedIds =
        await deleteWorkoutReportSnapshotsByDateFromServer(
          selectedReportDate
        );
      const deletedIds = Array.from(
        new Set([
          ...localIds,
          ...serverDeletedIds,
        ])
      );

      deleteWorkoutReportSnapshots(
        deletedIds
      );
      replaceWorkoutReportSnapshotsForDate(
        selectedReportDate,
        []
      );
      setSelectedSnapshotId("");
      setServerMessage(
        `${selectedReportDate} 저장 리포트 ${deletedIds.length}개를 모두 삭제했습니다.`
      );
    } catch (error) {
      console.error(error);
      setServerMessage(
        "선택 날짜 저장 리포트 전체 삭제에 실패했습니다. Supabase 삭제 정책을 확인해 주세요."
      );
    } finally {
      setDeleting(false);
    }
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
        <button
          type="button"
          onClick={() =>
            void exportReportImage()
          }
          disabled={exportingImage}
          className="rounded-xl bg-violet-400 px-4 py-2 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exportingImage
            ? "이미지 생성 중"
            : "이미지 저장"}
        </button>
        <button
          type="button"
          onClick={openReportPrintView}
          className="rounded-xl bg-white px-4 py-2 font-bold text-slate-950"
        >
          PDF 저장
        </button>
      </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
        <label className="block text-sm font-bold text-slate-200">
          조회 날짜
        </label>
        <input
          type="date"
          value={selectedReportDate}
          onChange={(event) => {
            setSelectedReportDate(
              event.target.value
            );
            const snapshot =
              sortedSnapshots.find(
                (item) =>
                  item.workoutDate ===
                  event.target.value
              );
            setSelectedSnapshotId(
              snapshot?.id ?? ""
            );
          }}
          className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm font-bold text-white"
        />

        <label className="mt-4 block text-sm font-bold text-slate-200">
          저장된 운동 리포트
        </label>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          선택한 날짜의 저장 리포트를 확인합니다. 오늘 운동 전체 종료 시 자동 저장되며, 필요하면 현재 리포트 저장 버튼으로 수동 저장할 수 있습니다.
        </p>
        {serverMessage && (
          <p className="mt-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs leading-5 text-cyan-100">
            {serverMessage}
          </p>
        )}
        {!selectedReportDateHasSnapshot && (
          <p className="mt-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
            선택한 날짜에 저장된 운동 리포트가 없습니다. 현재 진행 중인 리포트를 저장하거나, 다른 날짜를 선택해 주세요.
          </p>
        )}
        {selectedDateSnapshots.length >
          0 && (
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
            {selectedDateSnapshots.map((snapshot) => (
              <option
                key={snapshot.id}
                value={snapshot.id}
              >
                {snapshot.workoutDate} 저장 리포트 · {formatKstTime(snapshot.createdAt)}
              </option>
            ))}
          </select>
        )}
        {selectedReportDateHasSnapshot &&
          canDeleteReport && (
          <div>
          <button
            type="button"
            onClick={() =>
              void deleteSelectedReport()
            }
            disabled={deleting}
            className="mt-3 w-full rounded-xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm font-bold text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting
              ? "삭제 중..."
              : "선택한 리포트 삭제"}
          </button>
          <button
            type="button"
            onClick={() =>
              void deleteSelectedDateReports()
            }
            disabled={deleting}
            className="mt-2 w-full rounded-xl border border-red-400/60 bg-red-600/25 px-4 py-3 text-sm font-bold text-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting
              ? "삭제 중..."
              : "선택 날짜 리포트 전체 삭제"}
          </button>
          </div>
        )}
      </div>

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

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-slate-950/60 p-3">
          <div className="font-bold text-slate-200">
            개인별 섞임률
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            오늘 참가자 중 같은 경기에 한 번 이상 같이 배치된 사람의 비율입니다.
          </p>
          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-800">
            {report.mixingRows.length ===
            0 ? (
              <div className="p-3 text-sm text-slate-500">
                아직 집계할 경기 기록이 없습니다.
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="sticky top-0 bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">
                      이름
                    </th>
                    <th className="px-3 py-2">
                      섞임률
                    </th>
                    <th className="px-3 py-2">
                      교류
                    </th>
                    <th className="px-3 py-2">
                      미교류
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.mixingRows.map(
                    (row) => (
                      <tr
                        key={row.id}
                        className="border-t border-slate-800"
                      >
                        <td className="px-3 py-2 font-bold text-slate-100">
                          {row.name}
                        </td>
                        <td className="px-3 py-2 text-cyan-200">
                          {row.mixPercent}%
                        </td>
                        <td className="px-3 py-2">
                          {row.metCount}명
                        </td>
                        <td className="px-3 py-2">
                          {row.missedCount}명
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-slate-950/60 p-3">
          <div className="font-bold text-slate-200">
            인원별 경기 수
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            오늘 리포트 기준 각 참가자의 총 경기 수입니다.
          </p>
          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-800">
            {report.participantRows.length ===
            0 ? (
              <div className="p-3 text-sm text-slate-500">
                아직 집계할 경기 기록이 없습니다.
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="sticky top-0 bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">
                      이름
                    </th>
                    <th className="px-3 py-2">
                      참가 시간
                    </th>
                    <th className="px-3 py-2">
                      경기 수
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.participantRows.map(
                    (row) => (
                      <tr
                        key={row.id}
                        className="border-t border-slate-800"
                      >
                        <td className="px-3 py-2 font-bold text-slate-100">
                          {row.name}
                        </td>
                        <td className="px-3 py-2 text-slate-400">
                          {row.arrivalTimeText}
                        </td>
                        <td className="px-3 py-2 text-emerald-200">
                          {row.matchCount}경기
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
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
                const {
                  assignmentEvent,
                  replacements,
                } =
                  findMatchOperationEvents(
                    history,
                    report.operationEvents
                  );

                return (
                  <div
                    key={history.id}
                    className="rounded-xl bg-slate-900 px-3 py-2"
                  >
                    <div className="font-semibold text-slate-100">
                      {index + 1}. Court {history.courtId}{" "}
                      {formatKstTime(
                        history.startedAt
                      )}
                      ~
                      {formatKstTime(
                        history.endedAt
                      )}
                      {scoreText}
                    </div>
                    <div className="mt-1 text-slate-200">
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
                    </div>
                    {(assignmentEvent ||
                      replacements.length >
                        0) && (
                      <div className="mt-2 space-y-1 text-xs leading-5 text-slate-400">
                        {assignmentEvent && (
                          <div>
                            {getOperationLabel(
                              assignmentEvent
                            )}
                            : {formatOperator(
                              assignmentEvent
                            )}
                          </div>
                        )}
                        {replacements.map(
                          (event) => (
                            <div key={event.id}>
                              {getOperationLabel(
                                event
                              )}
                              : {formatOperator(
                                event
                              )}
                              {event.description
                                ? ` / ${event.description}`
                                : ""}
                            </div>
                          )
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
            경기 종료가 기록되지 않은 대진
          </div>
          <p className="mt-1 text-xs leading-5 text-amber-100/80">
            게임코트에 확정된 기록은 있지만 종료 버튼 또는 점수 저장 기록이 없어 정식 종료 경기로 집계되지 않은 대진입니다.
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
                  ~종료 미기록{" "}
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

      <textarea
        readOnly
        value={report.copyText}
        className="mt-4 h-72 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-200"
      />
    </div>
  );
}
