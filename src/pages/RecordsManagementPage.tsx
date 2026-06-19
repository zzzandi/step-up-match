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
  getUserAttendanceHistory,
  updateAttendanceDate,
} from "@/services/attendanceService";
import {
  getUsers,
} from "@/services/supabaseUserService";

interface UserOption {
  id: string;
  name: string;
  grade?: string;
}

interface AttendanceRecord {
  id: string;
  attendance_date: string;
}

export default function RecordsManagementPage() {
  const session =
    useAccessSession();
  const [users, setUsers] =
    useState<UserOption[]>([]);
  const [
    selectedUserId,
    setSelectedUserId,
  ] = useState("");
  const [
    attendanceRecords,
    setAttendanceRecords,
  ] = useState<
    AttendanceRecord[]
  >([]);
  const [loading, setLoading] =
    useState(false);
  const [message, setMessage] =
    useState("");

  useEffect(() => {
    getUsers()
      .then((data) =>
        setUsers(
          (data ?? []) as UserOption[]
        )
      )
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;

    getUserAttendanceHistory(
      selectedUserId
    )
      .then((data) =>
        setAttendanceRecords(
          data as AttendanceRecord[]
        )
      )
      .catch((error) => {
        console.error(error);
        setMessage(
          "참가이력을 불러오지 못했습니다."
        );
      })
      .finally(() =>
        setLoading(false)
      );
  }, [selectedUserId]);

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
    recordId: string,
    date: string
  ) {
    try {
      await updateAttendanceDate(
        recordId,
        date
      );
      setAttendanceRecords(
        attendanceRecords.map(
          (record) =>
            record.id === recordId
              ? {
                  ...record,
                  attendance_date:
                    date,
                }
              : record
        )
      );
      setMessage(
        "운동 참가일을 수정했습니다."
      );
    } catch (error) {
      console.error(error);
      setMessage(
        "운동 참가일 수정에 실패했습니다."
      );
    }
  }

  async function handleDeleteAttendance(
    recordId: string
  ) {
    if (
      !window.confirm(
        "이 운동 참가이력을 삭제하시겠습니까?"
      )
    ) {
      return;
    }

    try {
      await deleteAttendanceRecord(
        recordId
      );
      setAttendanceRecords(
        attendanceRecords.filter(
          (record) =>
            record.id !== recordId
        )
      );
      setMessage(
        "운동 참가이력을 삭제했습니다."
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
          회원별 운동 참가이력 관리
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          본인을 포함한 모든 회원의 운동 참가일을 수정하거나 참가이력을 삭제할 수 있습니다.
        </p>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <label className="text-sm text-slate-400">
            회원 선택
            <select
              value={
                selectedUserId
              }
              onChange={(event) => {
                const userId =
                  event.target.value;
                setSelectedUserId(
                  userId
                );
                setAttendanceRecords(
                  []
                );
                setMessage("");
                setLoading(
                  Boolean(userId)
                );
              }}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            >
              <option value="">
                회원을 선택하세요
              </option>
              {users.map((user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.name}
                  {user.grade
                    ? ` (${user.grade})`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          {message && (
            <p className="mt-3 text-sm text-cyan-300">
              {message}
            </p>
          )}
        </section>

        {selectedUserId && (
          <section className="mt-6">
            <h2 className="mb-3 text-xl font-bold">
              운동 참가이력
            </h2>
            <div className="space-y-3">
              {loading ? (
                <div className="rounded-xl bg-slate-900 p-5 text-slate-400">
                  불러오는 중...
                </div>
              ) : attendanceRecords.length ===
                0 ? (
                <div className="rounded-xl bg-slate-900 p-5 text-slate-500">
                  운동 참가이력이 없습니다.
                </div>
              ) : (
                attendanceRecords.map(
                  (record) => (
                    <div
                      key={record.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3"
                    >
                      <input
                        type="date"
                        value={
                          record.attendance_date
                        }
                        onChange={(
                          event
                        ) =>
                          void handleAttendanceDate(
                            record.id,
                            event.target
                              .value
                          )
                        }
                        className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void handleDeleteAttendance(
                            record.id
                          )
                        }
                        className="rounded-lg bg-red-500 px-3 py-2 font-bold"
                      >
                        삭제
                      </button>
                    </div>
                  )
                )
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
