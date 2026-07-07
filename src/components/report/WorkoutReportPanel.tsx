import {
  useEffect,
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
import {
  deleteWorkoutReportSnapshotFromServer,
  getWorkoutReportSnapshotsFromServer,
  saveWorkoutReportSnapshotToServer,
} from "@/services/workoutReportSnapshotService";

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
  const mergeWorkoutReportSnapshots =
    useMatchStore(
      (state) =>
        state.mergeWorkoutReportSnapshots
    );
  const deleteWorkoutReportSnapshot =
    useMatchStore(
      (state) =>
        state.deleteWorkoutReportSnapshot
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

        mergeWorkoutReportSnapshots(
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
    mergeWorkoutReportSnapshots,
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
      setSelectedSnapshotId("");
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
        {selectedReportDateHasSnapshot && (
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
            종료 기록 없는 대진
          </div>
          <p className="mt-1 text-xs leading-5 text-amber-100/80">
            대진은 게임코트에 올라갔지만 경기 종료 기록이 없어 오늘 전체 경기 목록에는 종료 시각이 남지 않은 대진입니다.
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

      <textarea
        readOnly
        value={report.copyText}
        className="mt-4 h-72 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-200"
      />
    </div>
  );
}
