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
  activatePendingCheckIn,
  getTodayAttendances,
  getUsers,
} from "@/services/supabaseUserService";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import {
  getKstDateKey,
  isWorkoutOpen,
} from "@/services/workoutSessionService";
import {
  saveTestSnapshot,
  setTestMode,
  setTestWorkoutOpen,
} from "@/services/testModeService";
import {
  shouldActivateAttendance,
} from "@/utils/attendanceState";
import type {
  Gender,
  Grade,
  Player,
} from "@/types/player";
import {
  getEffectiveHiddenSkill,
} from "@/utils/skillOverrides";

interface User {
  id: string;
  name: string;
  gender?: string;
  grade?: string;
}

const defaultHiddenSkillByGrade: Record<
  Grade,
  number
> = {
  A: 95,
  B: 80,
  C: 65,
  D: 50,
  E: 35,
  F: 20,
};

function toGender(
  value: string | undefined
): Gender {
  return value === "F"
    ? "F"
    : "M";
}

function toGrade(
  value: string | undefined
): Grade {
  return [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
  ].includes(value ?? "")
    ? (value as Grade)
    : "F";
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
  const setPlayers =
    useMatchStore(
      (state) =>
        state.setPlayers
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
        .map((name) => {
          const sourceNames =
            name === "김영진"
              ? [
                  "김영진",
                  "큰영진",
                ]
              : [name];
          const user =
            users.find(
              (item) =>
                sourceNames.includes(
                  item.name
                )
            );

          return user
            ? {
                ...user,
                name,
              }
            : undefined;
        })
        .filter(
          (user) =>
            user !== undefined
        );
    }, [role, users]);

  const requiresPassword =
    role === "ADMIN" ||
    Boolean(config?.password);

  useEffect(() => {
    let cancelled = false;

    getUsers()
      .then((data) => {
        if (!cancelled) {
          setUsers(data ?? []);
        }
      })
      .catch((error) => {
        console.error(error);

        if (!cancelled) {
          setUsers([]);
          setMessage(
            "회원 목록을 불러오지 못했습니다. Supabase 설정을 확인해주세요."
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
  }, []);

  async function markAttendance(
    userId: string
  ) {
    const attendances =
      await getTodayAttendances();

    const existingAttendance =
      attendances?.find(
        (attendance: {
          user_id?: string;
          status?: string;
        }) =>
          attendance.user_id ===
          userId
      );
    const shouldJoin =
      shouldActivateAttendance(
        existingAttendance
      );

    if (shouldJoin) {
      await activatePendingCheckIn(
        userId
      );
    }

    return shouldJoin;
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
            ) ||
            masterNames.includes(
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

  async function handleJoin(
    participationMode:
      | "PARTICIPANT"
      | "VIEWER"
      | "TEST"
  ) {
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

      if (
        participationMode ===
        "TEST"
      ) {
        const state =
          useMatchStore.getState();

        saveTestSnapshot({
          players: state.players,
          courts: state.courts,
          fixedPartnerRequests:
            state.fixedPartnerRequests,
          notifications:
            state.notifications,
          matchHistory:
            state.matchHistory,
          recommendations:
            state.recommendations,
          selectedRecommendation:
            state.selectedRecommendation,
          womenDoublesPriority:
            state.womenDoublesPriority,
          excludedMatchPairs:
            state.excludedMatchPairs,
        });
        useMatchStore.setState({
          players: [],
          courts: [],
          fixedPartnerRequests: [],
          notifications: [],
          matchHistory: [],
          recommendations: [],
          selectedRecommendation:
            null,
          womenDoublesPriority:
            false,
          excludedMatchPairs:
            state.excludedMatchPairs,
        });
        setTestMode(true);
        setTestWorkoutOpen(false);
        setAccessSession({
          role,
          userId:
            selectedUser.id,
          userName:
            selectedUser.name,
          testMode: true,
          participationMode:
            "VIEWER",
        });
        navigate(
          getRolePath(role),
          {
            replace: true,
          }
        );
        return;
      }

      const workoutOpen =
        participationMode ===
          "PARTICIPANT"
          ? await isWorkoutOpen(
              getKstDateKey()
            )
          : false;
      const resolvedMode =
        participationMode ===
          "PARTICIPANT" &&
        !workoutOpen
          ? "PREOPEN"
          : participationMode;

      const existingPlayer =
        players.find(
          (player) =>
            player.id ===
            selectedUser.id
        );
      const isReturningAfterEnd =
        existingPlayer?.status ===
        "LEFT";
      const didJoinToday =
        resolvedMode ===
        "PARTICIPANT"
          ? await markAttendance(
              selectedUser.id
            )
          : false;

      const shouldNotifyParticipation =
        resolvedMode ===
          "PARTICIPANT" &&
        (
          didJoinToday ||
          isReturningAfterEnd
        );

      if (
        resolvedMode ===
        "PARTICIPANT"
      ) {
        const joinedAt =
          new Date();
        const grade =
          toGrade(
            selectedUser.grade
          );
        const restoredPlayer: Player =
          {
            id: selectedUser.id,
            name: selectedUser.name,
            gender:
              toGender(
                selectedUser.gender
              ),
            grade,
            hiddenSkill:
              getEffectiveHiddenSkill(
                selectedUser.name,
                existingPlayer?.hiddenSkill ??
                  defaultHiddenSkillByGrade[
                    grade
                  ]
              ),
            isPresent: true,
            arrivalTime:
              existingPlayer?.arrivalTime ??
              joinedAt,
            matchCount:
              existingPlayer?.matchCount ??
              0,
            consecutiveMatches:
              existingPlayer?.consecutiveMatches ??
              0,
            status: "WAITING",
            waitingStartedAt:
              joinedAt,
            lastPartners:
              existingPlayer?.lastPartners ??
              [],
            lastOpponents:
              existingPlayer?.lastOpponents ??
              [],
            fixedPartner:
              existingPlayer?.fixedPartner,
          };

        if (!existingPlayer) {
          setPlayers([
            ...players,
            restoredPlayer,
          ]);
        } else if (
          existingPlayer.status ===
          "LEFT"
        ) {
          setPlayers(
            players.map((player) =>
              player.id ===
              selectedUser.id
                ? restoredPlayer
                : player
            )
          );
        }
      }

      if (
        shouldNotifyParticipation
      ) {
        notifyNewParticipant(
          selectedUser
        );
      }

      setAccessSession({
        role,
        userId: selectedUser.id,
        userName: selectedUser.name,
        participationMode:
          resolvedMode,
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

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    handleJoin(
                      "PARTICIPANT"
                    )
                  }
                  disabled={
                    submitting ||
                    visibleUsers.length ===
                      0
                  }
                  className="
                    w-full
                    rounded-xl
                    bg-emerald-600
                    py-3
                    font-bold
                    hover:bg-emerald-500
                    disabled:opacity-50
                  "
                >
                  {submitting
                    ? "처리 중..."
                    : "오늘 운동 참가하기"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleJoin(
                      "VIEWER"
                    )
                  }
                  disabled={
                    submitting ||
                    visibleUsers.length ===
                      0
                  }
                  className="
                    w-full
                    rounded-xl
                    border
                    border-slate-700
                    bg-slate-800
                    py-3
                    font-bold
                    text-slate-200
                    hover:bg-slate-700
                    disabled:opacity-50
                  "
                >
                  조회 전용 로그인
                </button>

                {(role === "ADMIN" ||
                  role ===
                    "MASTER") && (
                  <button
                    type="button"
                    onClick={() =>
                      handleJoin(
                        "TEST"
                      )
                    }
                    disabled={
                      submitting ||
                      visibleUsers.length ===
                        0
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-fuchsia-400/40
                      bg-fuchsia-500/15
                      py-3
                      font-bold
                      text-fuchsia-200
                      hover:bg-fuchsia-500/25
                      disabled:opacity-50
                    "
                  >
                    테스트 모드로 로그인
                  </button>
                )}

                <p className="text-center text-xs leading-5 text-slate-500">
                  조회 전용 로그인은 오늘
                  대기자와 출석현황에 영향을
                  주지 않습니다.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
