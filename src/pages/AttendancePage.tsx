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
  getAttendanceListByDate,
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
  arrival_time?: string;
  users:
    | AttendanceUser
    | AttendanceUser[]
    | null;
}

function getKstDateKey() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}

function moveDate(
  date: string,
  amount: number
) {
  const target =
    new Date(
      `${date}T12:00:00+09:00`
    );
  target.setDate(
    target.getDate() + amount
  );

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(target);
}

function formatDisplayDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }
  ).format(
    new Date(
      `${date}T12:00:00+09:00`
    )
  );
}

function formatArrivalTime(
  arrivalTime?: string
) {
  if (!arrivalTime) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(
    new Date(arrivalTime)
  );
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
    selectedDate,
    setSelectedDate,
  ] = useState(getKstDateKey);
  const [records, setRecords] =
    useState<
      AttendanceRecord[]
    >([]);
  const [loading, setLoading] =
    useState(true);
  const [message, setMessage] =
    useState("");

  function changeDate(
    date: string
  ) {
    setLoading(true);
    setMessage("");
    setSelectedDate(date);
  }

  useEffect(() => {
    if (
      !session ||
      !canManage(session.role)
    ) {
      return;
    }

    let cancelled = false;

    getAttendanceListByDate(
      selectedDate
    )
      .then((data) => {
        if (!cancelled) {
          setRecords(
            data as AttendanceRecord[]
          );
        }
      })
      .catch((error) => {
        console.error(error);

        if (!cancelled) {
          setRecords([]);
          setMessage(
            "출석 기록을 불러오지 못했습니다."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, selectedDate]);

  const dailyAttendance =
    useMemo(() => {
      const unique =
        new Map<
          string,
          AttendanceRecord
        >();

      records.forEach(
        (record) => {
          if (
            !unique.has(
              record.user_id
            )
          ) {
            unique.set(
              record.user_id,
              record
            );
          }
        }
      );

      return Array.from(
        unique.values()
      ).sort(
        (a, b) =>
          new Date(
            a.arrival_time ?? 0
          ).getTime() -
          new Date(
            b.arrival_time ?? 0
          ).getTime()
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
  const isToday =
    selectedDate ===
    getKstDateKey();

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-2xl">
        <div>
          <p className="text-sm font-bold text-cyan-300">
            ATTENDANCE
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            일별 출석현황
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            날짜를 선택하면 해당 운동일의 참석자를 확인할 수 있습니다.
          </p>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-5">
          <label className="block text-sm font-bold text-slate-300">
            조회 날짜
            <input
              type="date"
              value={selectedDate}
              onChange={(event) =>
                changeDate(
                  event.target.value
                )
              }
              className="mt-2 block w-full min-w-0 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white [color-scheme:dark]"
            />
          </label>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                changeDate(
                  moveDate(
                    selectedDate,
                    -1
                  )
                )
              }
              className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200"
            >
              이전날
            </button>
            <button
              type="button"
              onClick={() =>
                changeDate(
                  getKstDateKey()
                )
              }
              disabled={isToday}
              className="rounded-xl bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-40"
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() =>
                changeDate(
                  moveDate(
                    selectedDate,
                    1
                  )
                )
              }
              className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200"
            >
              다음날
            </button>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-5">
            <div>
              <div className="text-sm text-slate-400">
                선택한 운동일
              </div>
              <h2 className="mt-1 text-xl font-bold">
                {formatDisplayDate(
                  selectedDate
                )}
              </h2>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm text-slate-400">
                참석 인원
              </div>
              <div className="mt-1 text-3xl font-black text-cyan-300">
                {
                  dailyAttendance.length
                }
                명
              </div>
            </div>
          </div>

          {loading ? (
            <div className="px-5 py-8 text-center text-slate-400">
              출석현황을 불러오는 중...
            </div>
          ) : message ? (
            <div className="m-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
              {message}
            </div>
          ) : dailyAttendance.length ===
            0 ? (
            <div className="px-5 py-10 text-center text-slate-400">
              선택한 날짜의 출석 기록이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {dailyAttendance.map(
                (
                  record,
                  index
                ) => {
                  const user =
                    getUser(
                      record
                    );
                  const arrivalTime =
                    formatArrivalTime(
                      record.arrival_time
                    );

                  return (
                    <div
                      key={record.id}
                      className="flex items-center gap-3 px-5 py-4"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-slate-300">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">
                          {user?.name ??
                            "알 수 없는 회원"}
                        </div>
                        {arrivalTime && (
                          <div className="mt-1 text-xs text-slate-500">
                            입장{" "}
                            {arrivalTime}
                          </div>
                        )}
                      </div>
                      {showGrade &&
                        user?.grade && (
                          <span className="shrink-0 rounded-lg bg-purple-400/15 px-2 py-1 text-xs font-bold text-purple-300">
                            {user.grade}
                            등급
                          </span>
                        )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
