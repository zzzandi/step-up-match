import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Navigate,
} from "react-router-dom";

import {
  setAccessSession,
  useAccessSession,
} from "@/auth/access";
import {
  deleteAttendanceRecord,
  getUserAttendanceHistory,
} from "@/services/attendanceService";
import {
  getUserById,
} from "@/services/supabaseUserService";
import {
  getTestAttendanceDates,
  useTestMode,
} from "@/services/testModeService";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import type {
  MatchHistory,
} from "@/types/matchHistory";
import type {
  Player,
} from "@/types/player";

type AttendanceRecord = {
  id: string;
  attendance_date?: string;
  created_at?: string;
};

type UserProfile = {
  id: string;
  name: string;
  gender?: string | null;
  grade?: string | null;
  hidden_skill?: number | null;
  fixed_partner_id?: string | null;
  is_active?: boolean;
};

function dateKey(
  value: Date | string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date(value));
}

function monthKey(
  value: Date | string
) {
  return dateKey(value).slice(
    0,
    7
  );
}

function durationMinutes(
  history: MatchHistory
) {
  return Math.max(
    0,
    Math.round(
      (new Date(
        history.endedAt
      ).getTime() -
        new Date(
          history.startedAt
        ).getTime()) /
        60000
    )
  );
}

function formatMinutes(
  minutes: number
) {
  const hours =
    Math.floor(minutes / 60);
  const rest = minutes % 60;

  return hours > 0
    ? `${hours}시간 ${rest}분`
    : `${rest}분`;
}

function partnerIdFor(
  history: MatchHistory,
  userId: string
) {
  const team =
    history.teamA.includes(userId)
      ? history.teamA
      : history.teamB.includes(
            userId
          )
        ? history.teamB
        : null;

  return team?.find(
    (id) => id !== userId
  );
}

function resultFor(
  history: MatchHistory,
  userId: string
) {
  if (
    history.teamAScore ===
      undefined ||
    history.teamBScore ===
      undefined ||
    history.teamAScore ===
      history.teamBScore
  ) {
    return "NONE";
  }

  const isTeamA =
    history.teamA.includes(userId);
  const teamAWon =
    history.teamAScore >
    history.teamBScore;

  return isTeamA === teamAWon
    ? "WIN"
    : "LOSS";
}

function playerName(
  players: Player[],
  id?: string
) {
  return (
    players.find(
      (player) =>
        player.id === id
    )?.name ?? "알 수 없음"
  );
}

function MatchScoreRow({
  history,
  userId,
  players,
}: {
  history: MatchHistory;
  userId: string;
  players: Player[];
}) {
  const updateMatchScore =
    useMatchStore(
      (state) =>
        state.updateMatchScore
    );
  const [teamAScore, setTeamAScore] =
    useState(
      history.teamAScore?.toString() ??
        ""
    );
  const [teamBScore, setTeamBScore] =
    useState(
      history.teamBScore?.toString() ??
        ""
    );
  const [isEditing, setIsEditing] =
    useState(
      history.teamAScore ===
        undefined ||
        history.teamBScore ===
          undefined
    );
  const [saved, setSaved] =
    useState(false);
  const partnerId =
    partnerIdFor(
      history,
      userId
    );
  const result =
    resultFor(history, userId);

  function saveScore() {
    const scoreA =
      Number(teamAScore);
    const scoreB =
      Number(teamBScore);

    if (
      !Number.isInteger(scoreA) ||
      !Number.isInteger(scoreB) ||
      scoreA < 0 ||
      scoreB < 0
    ) {
      window.alert(
        "점수를 올바르게 입력해주세요."
      );
      return;
    }

    updateMatchScore(
      history.id,
      scoreA,
      scoreB
    );
    setSaved(true);
    setIsEditing(false);
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold">
            Court {history.courtId}
          </div>
          <div className="text-xs text-slate-500">
            {new Date(
              history.endedAt
            ).toLocaleString()}
            {" · "}
            파트너{" "}
            {playerName(
              players,
              partnerId
            )}
          </div>
        </div>

        {result !== "NONE" && (
          <span
            className={`rounded-lg px-3 py-1 text-xs font-bold ${
              result === "WIN"
                ? "bg-lime-400/15 text-lime-300"
                : "bg-red-400/15 text-red-300"
            }`}
          >
            {result === "WIN"
              ? "승"
              : "패"}
          </span>
        )}
      </div>

      {isEditing ? (
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2">
          <label>
            <span className="mb-1 block text-xs text-slate-400">
              Team A
            </span>
            <input
              type="number"
              min="0"
              value={teamAScore}
              onChange={(event) =>
                setTeamAScore(
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center"
            />
          </label>
          <span className="pb-2 text-slate-500">
            :
          </span>
          <label>
            <span className="mb-1 block text-xs text-slate-400">
              Team B
            </span>
            <input
              type="number"
              min="0"
              value={teamBScore}
              onChange={(event) =>
                setTeamBScore(
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center"
            />
          </label>
          <button
            type="button"
            onClick={saveScore}
            className="rounded-lg bg-cyan-400 px-3 py-2 font-bold text-slate-950"
          >
            저장
          </button>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3">
          <div>
            <div className="text-xs text-slate-400">
              저장된 점수
            </div>
            <div className="mt-1 text-xl font-bold">
              {teamAScore} :{" "}
              {teamBScore}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="rounded-lg bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-300">
                저장 완료
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSaved(false);
                setIsEditing(true);
              }}
              className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-bold"
            >
              수정
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyPage() {
  const session =
    useAccessSession();
  const testMode =
    useTestMode();
  const players =
    useMatchStore(
      (state) => state.players
    );
  const matchHistory =
    useMatchStore(
      (state) =>
        state.matchHistory
    );
  const setPlayers =
    useMatchStore(
      (state) =>
        state.setPlayers
    );
  const [
    attendanceHistory,
    setAttendanceHistory,
  ] = useState<AttendanceRecord[]>([]);
  const [profile, setProfile] =
    useState<UserProfile | null>(
      null
    );
  const [resetMessage, setResetMessage] =
    useState("");

  async function handleCancelTodayAttendance() {
    if (!session?.userId) {
      return;
    }

    const today = dateKey(
      new Date()
    );
    const todayAttendance =
      attendanceHistory.find(
        (attendance) =>
          (attendance.attendance_date ??
            attendance.created_at?.slice(
              0,
              10
            )) === today
      );

    if (!todayAttendance) {
      setResetMessage(
        "오늘 운동 참가이력이 없습니다."
      );
      return;
    }

    if (
      !window.confirm(
        "실수로 등록한 오늘 운동 참가이력을 취소하시겠습니까?"
      )
    ) {
      return;
    }

    try {
      await deleteAttendanceRecord(
        todayAttendance.id
      );
      setAttendanceHistory(
        attendanceHistory.filter(
          (attendance) =>
            attendance.id !==
            todayAttendance.id
        )
      );
      setPlayers(
        players.map((player) =>
          player.id ===
          session.userId
            ? {
                ...player,
                status:
                  "LEFT" as const,
                isPresent: false,
              }
            : player
        )
      );
      setAccessSession({
        ...session,
        participationMode:
          "VIEWER",
      });
      setResetMessage(
        "오늘 운동 참가이력이 취소되었습니다."
      );
    } catch (error) {
      console.error(error);
      setResetMessage(
        "오늘 운동 참가이력 취소에 실패했습니다."
      );
    }
  }

  useEffect(() => {
    if (!session?.userId) {
      return;
    }

    if (!testMode.active) {
      getUserAttendanceHistory(
        session.userId
      )
        .then((data) =>
          setAttendanceHistory(
            data as AttendanceRecord[]
          )
        )
        .catch(console.error);
    }

    getUserById(
      session.userId
    )
      .then((data) =>
        setProfile(
          data as UserProfile
        )
      )
      .catch(console.error);
  }, [
    session?.userId,
    testMode.active,
  ]);

  const effectiveAttendanceHistory =
    testMode.active
      ? getTestAttendanceDates().map(
          (
            attendanceDate,
            index
          ) => ({
            id: `test-attendance-${index}`,
            attendance_date:
              attendanceDate,
          })
        )
      : attendanceHistory;

  const stats = useMemo(() => {
    const userId =
      session?.userId ?? "";
    const today =
      dateKey(new Date());
    const thisMonth =
      monthKey(new Date());
    const histories =
      matchHistory
        .filter(
          (history) =>
            history.teamA.includes(
              userId
            ) ||
            history.teamB.includes(
              userId
            )
        )
        .sort(
          (a, b) =>
            new Date(
              b.endedAt
            ).getTime() -
            new Date(
              a.endedAt
            ).getTime()
        );

    const attendanceDates = [
      ...new Set(
        effectiveAttendanceHistory
          .map(
            (attendance) =>
              attendance.attendance_date ??
              attendance.created_at?.slice(
                0,
                10
              )
          )
          .filter(Boolean) as string[]
      ),
    ];
    const monthDates =
      attendanceDates.filter(
        (date) =>
          date.startsWith(
            thisMonth
          )
      );
    const todayMatches =
      histories.filter(
        (history) =>
          dateKey(
            history.endedAt
          ) === today
      );
    const monthMatches =
      histories.filter(
        (history) =>
          monthKey(
            history.endedAt
          ) === thisMonth
      );

    const partnerMap =
      new Map<
        string,
        {
          games: number;
          wins: number;
        }
      >();

    histories.forEach(
      (history) => {
        const partnerId =
          partnerIdFor(
            history,
            userId
          );

        if (!partnerId) {
          return;
        }

        const current =
          partnerMap.get(
            partnerId
          ) ?? {
            games: 0,
            wins: 0,
          };
        const result =
          resultFor(
            history,
            userId
          );

        if (result === "NONE") {
          return;
        }

        partnerMap.set(
          partnerId,
          {
            games:
              current.games + 1,
            wins:
              current.wins +
              (result === "WIN"
                ? 1
                : 0),
          }
        );
      }
    );

    const partnerRanking = [
      ...partnerMap.entries(),
    ]
      .map(
        ([
          partnerId,
          record,
        ]) => ({
          partnerId,
          name: playerName(
            players,
            partnerId
          ),
          ...record,
          rate:
            record.games > 0
              ? Math.round(
                  (record.wins /
                    record.games) *
                    100
                )
              : 0,
        })
      )
      .sort(
        (a, b) =>
          b.rate - a.rate ||
          b.games - a.games
      );

    const scoredHistories =
      histories.filter(
        (history) =>
          resultFor(
            history,
            userId
          ) !== "NONE"
      );
    const wins =
      scoredHistories.filter(
        (history) =>
          resultFor(
            history,
            userId
          ) === "WIN"
      ).length;
    const losses =
      scoredHistories.length -
      wins;
    const totalMinutes =
      histories.reduce(
        (total, history) =>
          total +
          durationMinutes(history),
        0
      );
    const favoritePartner =
      [...partnerMap.entries()]
        .sort(
          (
            [, a],
            [, b]
          ) =>
            b.games -
            a.games
        )[0]?.[0];

    return {
      histories,
      monthDates,
      todayMatches,
      monthMatches,
      partnerRanking,
      totalGames:
        histories.length,
      scoredGames:
        scoredHistories.length,
      wins,
      losses,
      winRate:
        scoredHistories.length >
        0
          ? Math.round(
              (wins /
                scoredHistories.length) *
                100
            )
          : 0,
      averageMinutes:
        histories.length > 0
          ? Math.round(
              totalMinutes /
                histories.length
            )
          : 0,
      favoritePartnerName:
        favoritePartner
          ? playerName(
              players,
              favoritePartner
            )
          : "-",
      monthMinutes:
        monthMatches.reduce(
          (total, history) =>
            total +
            durationMinutes(
              history
            ),
          0
        ),
    };
  }, [
    effectiveAttendanceHistory,
    matchHistory,
    players,
    session?.userId,
  ]);

  if (!session?.userId) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-screen-lg">
        <div className="mb-6">
          {testMode.active && (
            <div className="mb-4 rounded-xl border border-fuchsia-400/40 bg-fuchsia-400/10 px-4 py-3 font-bold text-fuchsia-200">
              테스트 통계 · 실제 마이페이지 통계에는 반영되지 않습니다.
            </div>
          )}
          <p className="text-sm font-bold text-cyan-300">
            MY PAGE
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            {session.userName}님의 기록
          </h1>

          {(session.role ===
            "ADMIN" ||
            session.role ===
              "PLAYER") && (
            <div className="mt-4">
              {session.participationMode ===
                "PARTICIPANT" && (
                <button
                  type="button"
                  onClick={() =>
                    void handleCancelTodayAttendance()
                  }
                  className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold"
                >
                  오늘 운동 참가이력 취소
                </button>
              )}
              {resetMessage && (
                <p className="mt-2 text-sm text-slate-400">
                  {resetMessage}
                </p>
              )}
            </div>
          )}
        </div>

        <section className="mb-6 grid grid-cols-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="p-3 text-center">
            <div className="text-xs text-slate-400">
              이번 달 운동
            </div>
            <div className="mt-1 text-xl font-bold">
              {stats.monthDates.length}일
            </div>
          </div>
          <div className="border-x border-slate-800 p-3 text-center">
            <div className="text-xs text-slate-400">
              오늘 경기
            </div>
            <div className="mt-1 text-xl font-bold">
              {stats.todayMatches.length}
            </div>
          </div>
          <div className="p-3 text-center">
            <div className="text-xs text-slate-400">
              월 운동 시간
            </div>
            <div className="mt-1 text-lg font-bold">
              {formatMinutes(
                stats.monthMinutes
              )}
            </div>
          </div>
        </section>

        {profile && (
          <section className="mb-6 rounded-xl border border-purple-500/30 bg-slate-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-purple-300">
                  PLAYER PROFILE
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {profile.name}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {session.role ===
                  "MASTER" &&
                  profile.grade && (
                    <span className="rounded-lg bg-purple-400/15 px-3 py-2 text-sm font-bold text-purple-300">
                      {profile.grade}등급
                    </span>
                  )}
                {session.role ===
                  "MASTER" &&
                  profile.hidden_skill !==
                    null &&
                  profile.hidden_skill !==
                    undefined && (
                    <span className="rounded-lg bg-cyan-400/15 px-3 py-2 text-sm font-bold text-cyan-300">
                      내부 점수{" "}
                      {
                        profile.hidden_skill
                      }
                    </span>
                  )}
                <span className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">
                  {profile.is_active ===
                  false
                    ? "비활성 회원"
                    : "활성 회원"}
                </span>
              </div>
            </div>
          </section>
        )}

        <section className="mb-6">
          <h2 className="mb-3 text-lg font-bold">
            선수 리포트
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              [
                "전체 경기",
                `${stats.totalGames}경기`,
              ],
              [
                "승 / 패",
                `${stats.wins}승 ${stats.losses}패`,
              ],
              [
                "전체 승률",
                `${stats.winRate}%`,
              ],
              [
                "점수 입력",
                `${stats.scoredGames}경기`,
              ],
              [
                "평균 경기시간",
                `${stats.averageMinutes}분`,
              ],
              [
                "최다 파트너",
                stats.favoritePartnerName,
              ],
            ].map(
              ([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                >
                  <div className="text-xs text-slate-400">
                    {label}
                  </div>
                  <div className="mt-2 truncate text-lg font-bold">
                    {value}
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-lg font-bold">
              파트너 승률 랭킹
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              {stats.partnerRanking.length ===
              0 ? (
                <div className="p-5 text-sm text-slate-500">
                  점수가 입력된 경기 기록이 없습니다.
                </div>
              ) : (
                stats.partnerRanking
                  .slice(0, 8)
                  .map(
                    (
                      partner,
                      index
                    ) => (
                      <div
                        key={
                          partner.partnerId
                        }
                        className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 last:border-0"
                      >
                        <span className="w-6 text-center font-bold text-cyan-300">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-bold">
                          {partner.name}
                        </span>
                        <span className="text-sm text-slate-400">
                          {partner.wins}승 / {partner.games}경기
                        </span>
                        <span className="w-12 text-right font-bold text-lime-300">
                          {partner.rate}%
                        </span>
                      </div>
                    )
                  )
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold">
              이번 달 운동일
            </h2>
            <div className="flex min-h-20 flex-wrap content-start gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
              {stats.monthDates.length ===
              0 ? (
                <span className="text-sm text-slate-500">
                  출석 기록이 없습니다.
                </span>
              ) : (
                stats.monthDates.map(
                  (date) => (
                    <span
                      key={date}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm"
                    >
                      {date}
                    </span>
                  )
                )
              )}
            </div>
          </section>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold">
            최근 내 경기
          </h2>
          <div className="space-y-3">
            {stats.histories.length ===
            0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-500">
                아직 종료된 경기 기록이 없습니다.
              </div>
            ) : (
              stats.histories
                .slice(0, 10)
                .map((history) => (
                  <MatchScoreRow
                    key={history.id}
                    history={history}
                    userId={
                      session.userId!
                    }
                    players={players}
                  />
                ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
