import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Navigate,
} from "react-router-dom";

import {
  canManage,
  useAccessSession,
} from "@/auth/access";
import {
  getMonthlyAttendanceList,
} from "@/services/attendanceService";

interface AttendanceUser {
  id: string;
  name: string;
  gender?: string;
  grade?: string;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  attendance_date?: string;
  created_at?: string;
  users:
    | AttendanceUser
    | AttendanceUser[]
    | null;
}

function getCurrentYearMonth() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
    }
  )
    .format(new Date())
    .slice(0, 7);
}

function getUser(
  record: AttendanceRecord
) {
  return Array.isArray(
    record.users
  )
    ? record.users[0]
    : record.users;
}

export default function AttendancePage() {
  const session =
    useAccessSession();
  const [
    yearMonth,
    setYearMonth,
  ] = useState(
    getCurrentYearMonth
  );
  const [records, setRecords] =
    useState<
      AttendanceRecord[]
    >([]);
  const [loading, setLoading] =
    useState(true);
  const [message, setMessage] =
    useState("");

  useEffect(() => {
    if (
      !session ||
      !canManage(session.role)
    ) {
      return;
    }

    getMonthlyAttendanceList(
      yearMonth
    )
      .then((data) =>
        setRecords(
          data as AttendanceRecord[]
        )
      )
      .catch((error) => {
        console.error(error);
        setRecords([]);
        setMessage(
          "출석 기록을 불러오지 못했습니다."
        );
      })
      .finally(() =>
        setLoading(false)
      );
  }, [session, yearMonth]);

  const attendanceByDate =
    useMemo(() => {
      const grouped =
        new Map<
          string,
          AttendanceRecord[]
        >();

      records.forEach(
        (record) => {
          const date =
            record.attendance_date ??
            record.created_at?.slice(
              0,
              10
            );

          if (!date) {
            return;
          }

          const current =
            grouped.get(date) ?? [];
          const duplicate =
            current.some(
              (item) =>
                item.user_id ===
                record.user_id
            );

          if (!duplicate) {
            grouped.set(
              date,
              [
                ...current,
                record,
              ]
            );
          }
        }
      );

      return Array.from(
        grouped.entries()
      ).sort(([a], [b]) =>
        b.localeCompare(a)
      );
    }, [records]);

  if (!session) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (
    !canManage(session.role)
  ) {
    return (
      <Navigate
        to="/player"
        replace
      />
    );
  }

  const showGrade =
    session.role === "MASTER";
  const totalAttendances =
    attendanceByDate.reduce(
      (total, [, daily]) =>
        total + daily.length,
      0
    );

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-screen-lg">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-cyan-300">
              ATTENDANCE
            </p>
            <h1 className="mt-1 text-3xl font-bold">
              월별 출석현황
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              운동일별 출석 인원과 회원을 확인합니다.
            </p>
          </div>

          <label className="text-sm text-slate-400">
            조회 월
            <input
              type="month"
              value={yearMonth}
              onChange={(event) =>
                {
                  setLoading(true);
                  setMessage("");
                  setYearMonth(
                    event.target.value
                  );
                }
              }
              className="mt-2 block rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            />
          </label>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-sm text-slate-400">
              운동일
            </div>
            <div className="mt-1 text-3xl font-bold">
              {attendanceByDate.length}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-sm text-slate-400">
              월 누적 출석
            </div>
            <div className="mt-1 text-3xl font-bold">
              {totalAttendances}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
            출석현황을 불러오는 중...
          </div>
        ) : message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
            {message}
          </div>
        ) : attendanceByDate.length ===
          0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
            해당 월의 출석 기록이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {attendanceByDate.map(
              ([date, daily]) => (
                <section
                  key={date}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                    <h2 className="text-lg font-bold">
                      {date}
                    </h2>
                    <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-sm font-bold text-cyan-300">
                      {daily.length}명
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800">
                    {daily.map(
                      (
                        record,
                        index
                      ) => {
                        const user =
                          getUser(
                            record
                          );

                        return (
                          <div
                            key={
                              record.id
                            }
                            className="flex items-center gap-3 px-5 py-3"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-sm text-slate-300">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-bold">
                              {user?.name ??
                                "알 수 없는 회원"}
                            </span>
                            {showGrade &&
                              user?.grade && (
                                <span className="rounded-lg bg-purple-400/15 px-2 py-1 text-xs font-bold text-purple-300">
                                  {
                                    user.grade
                                  }
                                  등급
                                </span>
                              )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </section>
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}
