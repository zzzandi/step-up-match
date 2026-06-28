import {
  useState,
} from "react";
import {
  Navigate,
  useNavigate,
} from "react-router-dom";

import {
  getRolePath,
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
import {
  getSkillByGrade,
  gradeOptions,
} from "@/utils/grades";

const label = {
  required:
    "\uC774\uB984\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.",
  error:
    "\uAC8C\uC2A4\uD2B8 \uCC38\uAC00 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.",
  title: "Guest \uCC38\uAC00",
  description:
    "\uC774\uB984, \uC131\uBCC4, \uAE09\uC218\uB97C \uC785\uB825\uD558\uBA74 \uC624\uB298 \uC6B4\uB3D9 \uB300\uAE30\uC5F4\uC5D0 \uCC38\uAC00\uD569\uB2C8\uB2E4.",
  name: "\uC774\uB984",
  male: "\uB0A8\uC790",
  female: "\uC5EC\uC790",
  processing:
    "\uCC98\uB9AC \uC911...",
  submit:
    "\uAC8C\uC2A4\uD2B8\uB85C \uC624\uB298 \uC6B4\uB3D9 \uCC38\uAC00\uD558\uAE30",
};

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
      setMessage(label.required);
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
        state.setPlayers([
          ...state.players.filter(
            (player) =>
              player.id !== guest.id
          ),
          {
            id: guest.id,
            name: guest.name,
            gender:
              guest.gender ?? gender,
            grade:
              guest.grade ?? grade,
            hiddenSkill:
              guest.hidden_skill ??
              getSkillByGrade(grade),
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
          },
        ]);
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
      setMessage(label.error);
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
          {label.title}
        </h1>
        <p className="mt-2 text-slate-400">
          {label.description}
        </p>

        <div className="mt-8 space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <input
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
            placeholder={label.name}
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
              {label.male}
            </option>
            <option value="F">
              {label.female}
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
            {gradeOptions.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
                {"\uAE09"}
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
              ? label.processing
              : label.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
