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

type PairCount = {
  names: string;
  count: number;
};

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

function pairKey(
  playerAId: string,
  playerBId: string
) {
  return [
    playerAId,
    playerBId,
  ]
    .sort()
    .join("|");
}

function addPair(
  counts: Map<string, number>,
  playerAId: string,
  playerBId: string
) {
  const key =
    pairKey(
      playerAId,
      playerBId
    );
  counts.set(
    key,
    (counts.get(key) ?? 0) +
      1
  );
}

function formatTopPairs(
  counts: Map<string, number>,
  histories: MatchHistory[],
  names: Map<string, string>
): PairCount[] {
  return [
    ...counts.entries(),
  ]
    .map(
      ([key, count]) => {
        const [
          playerAId,
          playerBId,
        ] = key.split("|");

        return {
          names: `${getPlayerName(playerAId, histories, names)}-${getPlayerName(playerBId, histories, names)}`,
          count,
        };
      }
    )
    .filter(
      (item) =>
        item.count > 1
    )
    .sort(
      (a, b) =>
        b.count - a.count
    )
    .slice(0, 5);
}

export default function WorkoutReportPanel() {
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
  const [
    copied,
    setCopied,
  ] = useState(false);

  const report =
    useMemo(() => {
      const histories =
        [...matchHistory].sort(
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
          players.map(
            (player) => [
              player.id,
              player.name,
            ]
          )
        );
      const participantIds =
        new Set<string>();

      players
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
      const partnerCounts =
        new Map<string, number>();
      const sameGameCounts =
        new Map<string, number>();

      histories.forEach(
        (history) => {
          const ids =
            getHistoryPlayerIds(
              history
            );

          ids.forEach((playerId) =>
            matchCountByPlayer.set(
              playerId,
              (matchCountByPlayer.get(
                playerId
              ) ?? 0) + 1
            )
          );

          addPair(
            partnerCounts,
            history.teamA[0],
            history.teamA[1]
          );
          addPair(
            partnerCounts,
            history.teamB[0],
            history.teamB[1]
          );

          for (
            let i = 0;
            i < ids.length;
            i += 1
          ) {
            for (
              let j = i + 1;
              j < ids.length;
              j += 1
            ) {
              addPair(
                sameGameCounts,
                ids[i],
                ids[j]
              );
            }
          }
        }
      );

      const participantRows =
        [...participantIds]
          .map((playerId) => ({
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
          }))
          .sort((a, b) => {
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

      const matchCounts =
        participantRows.map(
          (row) => row.matchCount
        );
      const totalMatches =
        histories.length;
      const participantCount =
        participantRows.length;
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
              (totalMatches * 4) /
              participantCount
            ).toFixed(1)
          : "0.0";

      const autoGameEvents =
        workoutReportEvents.filter(
          (event) =>
            event.type ===
              "AUTO_MATCH" &&
            event.target === "GAME"
        ).length;
      const manualGameEvents =
        workoutReportEvents.filter(
          (event) =>
            event.type ===
              "MANUAL_MATCH" &&
            event.target === "GAME"
        ).length;
      const autoQueuedEvents =
        workoutReportEvents.filter(
          (event) =>
            event.type ===
              "AUTO_MATCH" &&
            event.target ===
              "QUEUE"
        ).length;
      const manualQueuedEvents =
        workoutReportEvents.filter(
          (event) =>
            event.type ===
              "MANUAL_MATCH" &&
            event.target ===
              "QUEUE"
        ).length;
      const promotedEvents =
        workoutReportEvents.filter(
          (event) =>
            event.type ===
            "QUEUED_PROMOTED"
        ).length;
      const replacementEvents =
        workoutReportEvents.filter(
          (event) =>
            event.type ===
            "PLAYER_REPLACED"
        ).length;
      const swapEvents =
        workoutReportEvents.filter(
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

      const repeatedPartnerPairs =
        formatTopPairs(
          partnerCounts,
          histories,
          currentNames
        );
      const repeatedSameGamePairs =
        formatTopPairs(
          sameGameCounts,
          histories,
          currentNames
        );
      const duplicatePartnerCount =
        [...partnerCounts.values()]
          .map((count) =>
            Math.max(
              0,
              count - 1
            )
          )
          .reduce(
            (sum, count) =>
              sum + count,
            0
          );
      const duplicateSameGameCount =
        [...sameGameCounts.values()]
          .map((count) =>
            Math.max(
              0,
              count - 1
            )
          )
          .reduce(
            (sum, count) =>
              sum + count,
            0
          );

      const fairnessLine =
        totalMatches === 0
          ? "아직 종료된 경기 기록이 없습니다."
          : `최다 ${maxMatches}경기 / 최소 ${minMatches}경기 / 평균 ${averageMatches}경기입니다.`;
      const mixLine =
        totalMatches === 0
          ? "섞임 지표는 경기 종료 후 집계됩니다."
          : `파트너 반복 ${duplicatePartnerCount}건, 같은 경기 반복 ${duplicateSameGameCount}건이 기록되었습니다.`;
      const participantLine =
        participantRows
          .map(
            (row) =>
              `${row.name} ${row.matchCount}경기`
          )
          .join(", ");
      const topPartnerLine =
        repeatedPartnerPairs.length > 0
          ? repeatedPartnerPairs
              .map(
                (item) =>
                  `${item.names} ${item.count}회`
              )
              .join(", ")
          : "2회 이상 반복 파트너 없음";
      const topSameGameLine =
        repeatedSameGamePairs.length > 0
          ? repeatedSameGamePairs
              .map(
                (item) =>
                  `${item.names} ${item.count}회`
              )
              .join(", ")
          : "2회 이상 같은 경기 반복 없음";

      const copyText = [
        `🏸 STEP UP MATCH 오늘 운동 리포트 (${getDateText()})`,
        "",
        `참여 인원: ${participantCount}명`,
        `종료된 경기: ${totalMatches}경기`,
        `점수 입력 완료: ${scoredMatches}/${totalMatches}경기`,
        `경기 수 분포: ${fairnessLine}`,
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
        `- ${mixLine}`,
        `- 반복 파트너 상위: ${topPartnerLine}`,
        `- 같은 경기 반복 상위: ${topSameGameLine}`,
        "",
        "인원별 경기 수",
        participantLine || "기록 없음",
      ].join("\n");

      return {
        participantRows,
        participantCount,
        totalMatches,
        scoredMatches,
        maxMatches,
        minMatches,
        averageMatches,
        autoGameEvents,
        manualGameEvents,
        autoQueuedEvents,
        manualQueuedEvents,
        promotedEvents,
        replacementEvents,
        swapEvents,
        duplicatePartnerCount,
        duplicateSameGameCount,
        repeatedPartnerPairs,
        repeatedSameGamePairs,
        copyText,
      };
    }, [
      matchHistory,
      players,
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

  return (
    <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-cyan-100">
            오늘 운동 리포트
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            종료된 경기와 운영 이벤트를 기준으로 단톡방에 공유할 객관 수치를 정리합니다.
          </p>
        </div>
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
            종료 경기
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
            최다/최소
          </div>
          <div className="mt-1 text-2xl font-black text-white">
            {report.maxMatches}/{report.minMatches}
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
          </div>
        </div>

        <div className="rounded-xl bg-slate-950/60 p-3">
          <div className="font-bold text-slate-200">
            섞임 지표
          </div>
          <div className="mt-2 space-y-1 text-slate-400">
            <p>
              파트너 반복: {report.duplicatePartnerCount}건
            </p>
            <p>
              같은 경기 반복: {report.duplicateSameGameCount}건
            </p>
            <p>
              점수 입력: {report.scoredMatches}/{report.totalMatches}경기
            </p>
          </div>
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

      <textarea
        readOnly
        value={report.copyText}
        className="mt-4 h-72 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-200"
      />
    </div>
  );
}
