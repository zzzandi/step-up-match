import {
  useEffect,
  useState,
} from "react";

import {
  setAccessSession,
  type AccessSession,
} from "@/auth/access";
import {
  queuePendingCheckIn,
} from "@/services/supabaseUserService";
import {
  isWorkoutOpen,
} from "@/services/workoutSessionService";

export default function PreWorkoutQueueGate({
  session,
  allowManagementWithoutQueue = false,
}: {
  session: AccessSession;
  allowManagementWithoutQueue?: boolean;
}) {
  const [submitting, setSubmitting] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [workoutOpen, setWorkoutOpen] =
    useState(false);
  const registered =
    session.participationMode ===
      "PENDING" ||
    session.participationMode ===
      "PENDING_MANAGER";

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const open =
          await isWorkoutOpen();

        if (!cancelled) {
          setWorkoutOpen(open);
        }
      } catch (error) {
        console.error(error);
      }
    }

    void refresh();
    const timer =
      window.setInterval(
        refresh,
        5000
      );

    return () => {
      cancelled = true;
      window.clearInterval(
        timer
      );
    };
  }, []);

  async function registerQueue() {
    if (!session.userId) {
      setMessage(
        "회원 정보를 찾을 수 없습니다."
      );
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      await queuePendingCheckIn(
        session.userId
      );
      setAccessSession({
        ...session,
        participationMode:
          "PENDING",
      });
    } catch (error) {
      console.error(error);
      setMessage(
        "대기열 등록에 실패했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function continueWithoutQueue() {
    setAccessSession({
      ...session,
      participationMode:
        "VIEWER",
    });
  }

  function continueManagingWithQueue() {
    setAccessSession({
      ...session,
      participationMode:
        "PENDING_MANAGER",
    });
  }

  return (
    <main className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-xl rounded-3xl border border-amber-400/30 bg-slate-900 p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/15 text-3xl">
          🏸
        </div>
        <p className="text-sm font-bold text-amber-300">
          오늘 운동{" "}
          {workoutOpen
            ? "진행 중"
            : "미개설"}
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {workoutOpen
            ? "지금 오늘 운동에 합류하시겠어요?"
            : "오늘 운동 대기열에 참가하시겠어요?"}
        </h1>
        <p className="mt-4 leading-7 text-slate-400">
          {workoutOpen
            ? "현재 운동이 열려 있습니다. 아래 버튼을 누르면 누른 시각을 기준으로 대기열에 합류합니다."
            : "로그인만으로는 대기 순서가 부여되지 않습니다. 아래 버튼을 누른 시각을 기준으로 운동이 열릴 때 대기열에 등록됩니다."}
        </p>
        <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm leading-6 text-cyan-100">
          {workoutOpen
            ? "30분보다 일찍 등록했던 순서는 만료됩니다. 지금 다시 등록하면 새로운 시각으로 정상 합류합니다."
            : "운동 개설 시각 기준 최근 30분 안에 등록한 순서만 유효합니다. 너무 일찍 등록한 경우 운동이 열린 뒤 다시 등록해주세요."}
        </div>

        {registered ? (
          <div className="mt-6 rounded-xl bg-emerald-400/15 px-4 py-4 font-bold text-emerald-300">
            {session.userName}님 대기열
            등록 완료 · 운동 개설 대기 중
          </div>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={() =>
              void registerQueue()
            }
            className="mt-6 w-full rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 disabled:opacity-50"
          >
            {submitting
              ? "등록 중..."
              : workoutOpen
                ? "지금 오늘 운동에 참가하기"
                : "오늘 운동 대기열 등록하기"}
          </button>
        )}

        {allowManagementWithoutQueue &&
          (
            registered ? (
              <button
                type="button"
                onClick={
                  continueManagingWithQueue
                }
                className="mt-3 w-full rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950"
              >
                대기순서 유지하고 대시보드로 이동
              </button>
            ) : (
              <button
                type="button"
                onClick={
                  continueWithoutQueue
                }
                className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 font-bold text-slate-200"
              >
                대기열에 참가하지 않고 관리 화면으로 이동
              </button>
            )
          )}

        {message && (
          <p className="mt-4 text-sm text-red-300">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
