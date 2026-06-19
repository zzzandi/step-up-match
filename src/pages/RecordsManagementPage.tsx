import {
  useEffect,
  useState,
} from "react";
import {
  Navigate,
} from "react-router-dom";

import {
  useAccessSession,
} from "@/auth/access";
import {
  deleteAttendanceRecord,
  getAttendanceListByDate,
  updateAttendanceDate,
} from "@/services/attendanceService";

interface AttendanceUser {
  id: string;
  name: string;
  gender?: "M" | "F" | null;
  grade?: string | null;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  attendance_date: string;
  arrival_time?: string | null;
  status?: string | null;
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

function getAttendanceUser(
  record: AttendanceRecord
) {
  return Array.isArray(record.users)
    ? record.users[0]
    : record.users;
}

export default function RecordsManagementPage() {
  const session =
    useAccessSession();
  const [
    selectedDate,
    setSelectedDate,
  ] = useState(getKstDateKey);
  const [
    attendanceRecords,
    setAttendanceRecords,
  ] = useState<
    AttendanceRecord[]
  >([]);
  const [loading, setLoading] =
    useState(true);
  const [message, setMessage] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    getAttendanceListByDate(
      selectedDate
    )
      .then((data) => {
        if (!cancelled) {
          setAttendanceRecords(
            data as AttendanceRecord[]
          );
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setMessage(
            "참가이력을 불러오지 못했습니다."
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
  }, [selectedDate]);

  if (!session) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (
    session.role !== "MASTER"
  ) {
    return (
      <Navigate
        to={
          session.role ===
          "ADMIN"
            ? "/admin"
            : "/player"
        }
        replace
      />
    );
  }

  async function handleAttendanceDate(
    record: AttendanceRecord,
    newDate: string
  ) {
    if (
      !newDate ||
      newDate ===
        record.attendance_date
    ) {
      return;
    }

    const user =
      getAttendanceUser(record);

    if (
      !window.confirm(
        `${user?.name ?? "회원"}님의 참가일을 ${newDate}(으)로 변경하시겠습니까?`
      )
    ) {
      return;
    }

    try {
      await updateAttendanceDate(
        record.id,
        newDate
      );
      setAttendanceRecords(
        attendanceRecords.filter(
          (item) =>
            item.id !== record.id
        )
      );
      setMessage(
        `${user?.name ?? "회원"}님의 참가일을 ${newDate}(으)로 변경했습니다.`
      );
    } catch (error) {
      console.error(error);
      setMessage(
        "운동 참가일 수정에 실패했습니다."
      );
    }
  }

  async function handleDeleteAttendance(
    record: AttendanceRecord
  ) {
    const user =
      getAttendanceUser(record);

    if (
      !window.confirm(
        `${user?.name ?? "회원"}님의 ${selectedDate} 참가이력을 삭제하시겠습니까?`
      )
    ) {
      return;
    }

    try {
      await deleteAttendanceRecord(
        record.id
      );
      setAttendanceRecords(
        attendanceRecords.filter(
          (item) =>
            item.id !== record.id
        )
      );
      setMessage(
        `${user?.name ?? "회원"}님의 참가이력을 삭제했습니다.`
      );
    } catch (error) {
      console.error(error);
      setMessage(
        "운동 참가이력 삭제에 실패했습니다."
      );
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-screen-md">
        <p className="text-sm font-bold text-purple-300">
          MASTER ONLY
        </p>
        <h1 className="mt-1 text-3xl font-bold">
          날짜별 운동 참가이력 관리
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          날짜를 선택하면 해당 날짜의 전체 참석자가 표시됩니다.
        </p>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <label className="text-sm text-slate-400">
            조회 날짜
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(
                  event.target.value
                );
                setAttendanceRecords(
                  []
                );
                setMessage("");
                setLoading(true);
              }}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />
          </label>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              참석 인원
            </span>
            <strong className="text-2xl text-cyan-300">
              {attendanceRecords.length}명
            </strong>
          </div>

          {message && (
            <p className="mt-3 text-sm text-cyan-300">
              {message}
            </p>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-xl font-bold">
            {selectedDate} 참석자 명단
          </h2>
          <div className="space-y-3">
            {loading ? (
              <div className="rounded-xl bg-slate-900 p-5 text-slate-400">
                불러오는 중...
              </div>
            ) : attendanceRecords.length ===
              0 ? (
              <div className="rounded-xl bg-slate-900 p-5 text-slate-500">
                선택한 날짜의 참가이력이 없습니다.
              </div>
            ) : (
              attendanceRecords.map(
                (record) => {
                  const user =
                    getAttendanceUser(
                      record
                    );

                  return (
                    <div
                      key={record.id}
                      className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <strong className="text-lg">
                            {user?.name ??
                              "알 수 없는 회원"}
                          </strong>
                          <div className="mt-1 text-sm text-slate-400">
                            {user?.gender ===
                            "F"
                              ? "여자"
                              : "남자"}
                            {user?.grade
                              ? ` · ${user.grade}급`
                              : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteAttendance(
                              record
                            )
                          }
                          className="rounded-lg bg-red-500 px-3 py-2 font-bold"
                        >
                          삭제
                        </button>
                      </div>

                      <label className="mt-4 block text-xs text-slate-400">
                        참가일 변경
                        <input
                          type="date"
                          value={
                            record.attendance_date
                          }
                          onChange={(
                            event
                          ) =>
                            void handleAttendanceDate(
                              record,
                              event.target
                                .value
                            )
                          }
                          className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-white"
                        />
                      </label>
                    </div>
                  );
                }
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
