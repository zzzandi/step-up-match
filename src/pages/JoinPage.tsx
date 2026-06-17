import {
    useEffect,
    useState,
  } from "react";
  
  import {
    checkIn,
    getTodayAttendances,
    getUsers,
  } from "@/services/supabaseUserService";
  
  interface User {
    id: string;
    name: string;
    gender?: string;
    grade?: string;
  }
  
  export default function JoinPage() {
    const [users, setUsers] =
      useState<User[]>([]);
  
    const [selectedUserId, setSelectedUserId] =
      useState("");
  
    const [loading, setLoading] =
      useState(true);
  
    const [submitting, setSubmitting] =
      useState(false);
  
    const [message, setMessage] =
      useState("");
  
    useEffect(() => {
      loadUsers();
    }, []);
  
    async function loadUsers() {
      try {
        setLoading(true);
  
        const data =
          await getUsers();
  
        setUsers(data ?? []);
      } catch (error) {
        console.error(error);
  
        setMessage(
          "회원 목록을 불러오지 못했습니다."
        );
      } finally {
        setLoading(false);
      }
    }
  
    async function handleJoin() {
      if (!selectedUserId) {
        setMessage(
          "회원을 선택해주세요."
        );
        return;
      }
  
      try {
        setSubmitting(true);
        setMessage("");
  
        const attendances =
          await getTodayAttendances();
  
        const alreadyJoined =
          attendances?.some(
            (attendance: any) =>
              attendance.user_id ===
              selectedUserId
          );
  
        if (alreadyJoined) {
          setMessage(
            "이미 오늘 참가했습니다."
          );
          return;
        }
  
        await checkIn(
          selectedUserId
        );
  
        setMessage(
          "참가 완료"
        );
      } catch (error) {
        console.error(error);
  
        setMessage(
          "참가 처리 중 오류가 발생했습니다."
        );
      } finally {
        setSubmitting(false);
      }
    }
  
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">
            오늘 운동 참가
          </h1>
  
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            {loading ? (
              <div className="text-slate-400">
                회원 불러오는 중...
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block mb-2 text-slate-400">
                    회원 선택
                  </label>
  
                  <select
                    value={
                      selectedUserId
                    }
                    onChange={(e) =>
                      setSelectedUserId(
                        e.target.value
                      )
                    }
                    className="
                      w-full
                      p-3
                      rounded-xl
                      bg-slate-800
                      border
                      border-slate-700
                      text-white
                    "
                  >
                    <option value="">
                      회원을 선택하세요
                    </option>
  
                    {users.map(
                      (user) => (
                        <option
                          key={
                            user.id
                          }
                          value={
                            user.id
                          }
                        >
                          {user.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
  
                <button
                  onClick={
                    handleJoin
                  }
                  disabled={
                    submitting
                  }
                  className="
                    w-full
                    py-3
                    rounded-xl
                    font-bold
                    bg-emerald-600
                    hover:bg-emerald-500
                    disabled:opacity-50
                  "
                >
                  {submitting
                    ? "참가 처리 중..."
                    : "참가하기"}
                </button>
  
                {message && (
                  <div
                    className="
                      mt-4
                      p-3
                      rounded-xl
                      bg-slate-800
                      text-center
                    "
                  >
                    {message}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }