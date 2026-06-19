import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  AccessRole,
  adminNames,
  getRolePath,
  masterNames,
  setAccessSession,
  useAccessSession,
} from "@/auth/access";
import {
  checkIn,
  getTodayAttendances,
  getUsers,
} from "@/services/supabaseUserService";
import {
  useMatchStore,
} from "@/store/useMatchStore";

interface User {
  id: string;
  name: string;
  gender?: string;
  grade?: string;
}

const roleConfig: Record<
  AccessRole,
  {
    title: string;
    description: string;
    submitLabel: string;
    password?: string;
  }
> = {
  ADMIN: {
    title: "Admin 참가",
    description:
      "관리자 이름을 선택하고 비밀번호를 입력하세요.",
    submitLabel: "Admin으로 참가하기",
  },
  PLAYER: {
    title: "Player 참가",
    description:
      "본인 이름을 선택하고 오늘 모임에 참가하세요.",
    submitLabel: "Player로 참가하기",
  },
  MASTER: {
    title: "Master 참가",
    description:
      "본인 이름을 선택하고 마스터 비밀번호를 입력하세요.",
    submitLabel: "Master로 참가하기",
    password: "6037",
  },
};

const adminPasswords: Record<
  string,
  string
> = {
  유원석: "1028",
  이주민: "0226",
  김영진: "0001",
  박철상: "471312",
};

function toAccessRole(
  value: string | undefined
): AccessRole | null {
  const upper =
    value?.toUpperCase();

  if (
    upper === "ADMIN" ||
    upper === "PLAYER" ||
    upper === "MASTER"
  ) {
    return upper;
  }

  return null;
}

export default function JoinPage() {
  const { role: roleParam } =
    useParams();
  const navigate =
    useNavigate();
  const session =
    useAccessSession();
  const role =
    toAccessRole(roleParam);

  const [users, setUsers] =
    useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] =
    useState("");
  const [password, setPassword] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [submitting, setSubmitting] =
    useState(false);
  const [message, setMessage] =
    useState("");

  const players =
    useMatchStore(
      (state) => state.players
    );

  const addNotification =
    useMatchStore(
      (state) =>
        state.addNotification
    );

  const config =
    role ? roleConfig[role] : null;

  const visibleUsers =
    useMemo(() => {
      if (role === "PLAYER") {
        return users;
      }

      const allowedNames =
        role === "ADMIN"
          ? adminNames
          : masterNames;

      return allowedNames
        .map((name) =>
          users.find(
            (user) =>
              user.name === name
          )
        )
        .filter(
          (user): user is User =>
            Boolean(user)
        );
    }, [role, users]);

  const requiresPassword =
    role === "ADMIN" ||
    Boolean(config?.password);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      setMessage("");

      const data =
        await getUsers();

      setUsers(data ?? []);
    } catch (error) {
      console.error(error);
      setUsers([]);
      setMessage(
        "회원 목록을 불러오지 못했습니다. Supabase 설정을 확인해주세요."
      );
    } finally {
      setLoading(false);
    }
  }

  async function markAttendance(
    userId: string
  ) {
    const attendances =
      await getTodayAttendances();

    const alreadyJoined =
      attendances?.some(
        (attendance: any) =>
          attendance.user_id ===
          userId
      );

    if (!alreadyJoined) {
      await checkIn(userId);
    }

    return !alreadyJoined;
  }

  function notifyNewParticipant(
    selectedUser: User
  ) {
    players
      .filter(
        (player) =>
          player.status !==
            "LEFT" &&
          player.id !==
            selectedUser.id
      )
      .forEach((player) => {
        const isAdmin =
          adminNames.includes(
            player.name
          );

        addNotification({
          audience: isAdmin
            ? "ADMIN"
            : "PLAYER",
          recipientId: player.id,
          message: `${selectedUser.name}님이 오늘 운동에 참가했습니다.`,
        });
      });
  }

  async function handleJoin() {
    if (!role || !config) {
      return;
    }

    if (!selectedUserId) {
      setMessage(
        "본인 이름을 선택해주세요."
      );
      return;
    }

    const selectedUser =
      visibleUsers.find(
        (user) =>
          user.id === selectedUserId
      );

    if (!selectedUser) {
      setMessage(
        "선택한 회원을 찾을 수 없습니다."
      );
      return;
    }

    const expectedPassword =
      role === "ADMIN"
        ? adminPasswords[
            selectedUser.name
          ]
        : config.password;

    if (
      expectedPassword &&
      password !== expectedPassword
    ) {
      setMessage(
        "비밀번호가 올바르지 않습니다."
      );
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      const canRecordAttendance =
        role !== "ADMIN" ||
        selectedUser.id !==
          selectedUser.name;

      const didJoinToday =
        canRecordAttendance
          ? await markAttendance(
              selectedUser.id
            )
          : false;

      if (didJoinToday) {
        notifyNewParticipant(
          selectedUser
        );
      }

      setAccessSession({
        role,
        userId: selectedUser.id,
        userName: selectedUser.name,
      });

      navigate(
        getRolePath(role),
        {
          replace: true,
        }
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

  if (!role || !config) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (session) {
    return (
      <Navigate
        to={getRolePath(
          session.role
        )}
        replace
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-xl mx-auto py-12">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="
            mb-8
            rounded-xl
            bg-slate-800
            px-4
            py-2
            text-slate-200
            hover:bg-slate-700
          "
        >
          Home
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold">
            {config.title}
          </h1>

          <p className="text-slate-400 mt-2">
            {config.description}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          {loading ? (
            <div className="text-slate-400">
              회원 불러오는 중...
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block mb-2 text-slate-400">
                  이름 선택
                </label>

                <select
                  value={
                    selectedUserId
                  }
                  onChange={(event) =>
                    setSelectedUserId(
                      event.target.value
                    )
                  }
                  disabled={
                    visibleUsers.length === 0
                  }
                  className="
                    w-full
                    p-3
                    rounded-xl
                    bg-slate-800
                    border
                    border-slate-700
                    text-white
                    disabled:opacity-50
                  "
                >
                  <option value="">
                    본인 이름을 선택하세요
                  </option>

                  {visibleUsers.map(
                    (user) => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              {requiresPassword && (
                <div className="mb-4">
                  <label className="block mb-2 text-slate-400">
                    비밀번호
                  </label>

                  <input
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
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
                      outline-none
                      focus:border-cyan-400
                    "
                  />
                </div>
              )}

              {message && (
                <div
                  className="
                    mb-4
                    p-3
                    rounded-xl
                    bg-slate-800
                    text-center
                    text-slate-300
                  "
                >
                  {message}
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={
                  submitting ||
                  visibleUsers.length === 0
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
                  : config.submitLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
