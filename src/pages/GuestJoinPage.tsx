import {
  useState,
} from "react";
import {
  Navigate,
  useNavigate,
} from "react-router-dom";

import {
  adminNames,
  getRolePath,
  masterNames,
  setAccessSession,
  useAccessSession,
} from "@/auth/access";
import {
  createGuestUser,
  ensureTodayCheckIn,
} from "@/services/supabaseUserService";
import {
  getKstDateKey,
  isWorkoutOpen,
} from "@/services/workoutSessionService";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import type {
  Grade,
} from "@/types/player";

export default function GuestJoinPage() {
  const navigate =
    useNavigate();
  const session =
    useAccessSession();
  const [name, setName] =
    useState("");
  const [gender, setGender] =
    useState<"M" | "F">("M");
  const [grade, setGrade] =
    useState<Grade>("E");
  const [submitting, setSubmitting] =
    useState(false);
  const [message, setMessage] =
    useState("");

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

  async function joinGuest() {
    const normalizedName =
      name.trim();

    if (!normalizedName) {
      setMessage(
        "이름을 입력해주세요."
      );
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      const guest =
        await createGuestUser({
          name: normalizedName,
          gender,
          grade,
        });
      const workoutOpen =
        await isWorkoutOpen(
          getKstDateKey()
        );
      const participationMode =
        workoutOpen
          ? "PARTICIPANT"
          : "PREOPEN";

      if (workoutOpen) {
        await ensureTodayCheckIn(
          guest.id
        );

        const state =
          useMatchStore.getState();
        const guestPlayer = {
          id: guest.id,
          name: guest.name,
          gender:
            guest.gender ?? gender,
          grade:
            guest.grade ?? grade,
          hiddenSkill:
            guest.hidden_skill ?? 35,
          isPresent: true,
          arrivalTime: new Date(),
          matchCount: 0,
          consecutiveMatches: 0,
          status:
            "WAITING" as const,
          waitingStartedAt:
            new Date(),
          lastPartners: [],
          lastOpponents: [],
        };

        state.setPlayers([
          ...state.players.filter(
            (player) =>
              player.id !== guest.id
          ),
          guestPlayer,
        ]);

        state.addNotification({
          audience: "ADMIN",
          message: `${guest.name} 게스트님이 오늘 운동에 참가했습니다.`,
        });

        state.players
          .filter(
            (player) =>
              player.status !==
                "LEFT" &&
              player.id !== guest.id &&
              !adminNames.includes(
                player.name
              ) &&
              !masterNames.includes(
                player.name
              )
          )
          .forEach((player) => {
            state.addNotification({
              audience: "PLAYER",
              recipientId: player.id,
              message: `${guest.name} 게스트님이 오늘 운동에 참가했습니다.`,
            });
          });
      }

      setAccessSession({
        role: "PLAYER",
        userId: guest.id,
        userName: guest.name,
        isGuest: true,
        participationMode,
      });
      navigate("/player", {
        replace: true,
      });
    } catch (error) {
      console.error(error);
      setMessage(
        "게스트 참가 처리 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-xl py-12">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-8 rounded-xl bg-slate-800 px-4 py-2 text-slate-200"
        >
          Home
        </button>

        <h1 className="text-4xl font-bold">
          Guest 참가
        </h1>
        <p className="mt-2 text-slate-400">
          이름, 성별, 급수를 입력하면 오늘 운동 대기열에 참가합니다.
        </p>

        <div className="mt-8 space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <input
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
            placeholder="이름"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3"
          />

          <select
            value={gender}
            onChange={(event) =>
              setGender(
                event.target
                  .value as "M" | "F"
              )
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3"
          >
            <option value="M">
              남자
            </option>
            <option value="F">
              여자
            </option>
          </select>

          <select
            value={grade}
            onChange={(event) =>
              setGrade(
                event.target
                  .value as Grade
              )
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3"
          >
            {[
              "A",
              "B",
              "C",
              "D",
              "E",
              "F",
            ].map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}급
              </option>
            ))}
          </select>

          {message && (
            <div className="rounded-xl bg-slate-800 p-3 text-center text-slate-300">
              {message}
            </div>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={() =>
              void joinGuest()
            }
            className="w-full rounded-xl bg-orange-500 py-3 font-bold text-slate-950 disabled:opacity-50"
          >
            {submitting
              ? "처리 중..."
              : "게스트로 오늘 운동 참가하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
