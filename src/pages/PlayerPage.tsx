import {
  useEffect,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";

import {
  clearAccessSession,
  useAccessSession,
} from "@/auth/access";
import CourtCard from "@/components/court/CourtCard";
import MatchHistoryPanel from "@/components/history/MatchHistoryPanel";
import WaitingList from "@/components/waiting/WaitingList";
import PreWorkoutQueueGate from "@/components/waiting/PreWorkoutQueueGate";
import {
  getActiveWorkoutAttendanceList,
} from "@/services/attendanceService";
import {
  runLocalOnlyMutation,
} from "@/services/localStateMutationGuard";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import type { Player } from "@/types/player";
import {
  getEffectiveHiddenSkill,
} from "@/utils/skillOverrides";
import {
  uniqueByUserId,
} from "@/utils/participants";

const label = {
  participant: "\uCC38\uAC00\uC790",
  playing: "\uACBD\uAE30 \uC911",
  waiting: "\uB300\uAE30 \uC911",
  court: "\uCF54\uD2B8",
  status: "\uD604\uC7AC \uB0B4 \uC0C1\uD0DC",
  ended: "\uC6B4\uB3D9 \uC885\uB8CC",
  alert: "\uC54C\uB9BC",
  confirmAll: "\uC804\uCCB4 \uD655\uC778",
  confirm: "\uD655\uC778",
  queueCourt: "\uB300\uAE30 \uCF54\uD2B8",
  queueHelp:
    "\uAC8C\uC784 \uCF54\uD2B8\uAC00 \uBE44\uBA74 \uB300\uAE30 \uCF54\uD2B8\uC758 \uB300\uC9C4\uC774 \uC790\uB3D9\uC73C\uB85C \uC62C\uB77C\uAC11\uB2C8\uB2E4.",
};

function attendanceToPlayer(
  attendance: any,
  existing?: Player
): Player {
  const user =
    attendance.users;
  const arrivalTime =
    new Date(
      attendance.arrival_time ??
        existing?.arrivalTime ??
        Date.now()
    );

  return {
    id: user.id,
    name: user.name,
    gender:
      user.gender ??
      existing?.gender ??
      "M",
    grade:
      user.grade ??
      existing?.grade ??
      "F",
    hiddenSkill:
      getEffectiveHiddenSkill(
        user.name,
        user.hidden_skill ??
          existing?.hiddenSkill ??
          35
      ),
    isPresent: true,
    arrivalTime:
      existing?.arrivalTime ??
      arrivalTime,
    matchCount:
      attendance.match_count ??
      existing?.matchCount ??
      0,
    consecutiveMatches:
      attendance.consecutive_matches ??
      existing?.consecutiveMatches ??
      0,
    status:
      existing?.status ?? "WAITING",
    waitingStartedAt:
      existing?.waitingStartedAt ??
      arrivalTime,
    playingStartedAt:
      existing?.playingStartedAt,
    lastMatchAt:
      existing?.lastMatchAt,
    lastPartners:
      existing?.lastPartners ?? [],
    lastOpponents:
      existing?.lastOpponents ?? [],
    fixedPartner:
      user.fixed_partner_id ??
      existing?.fixedPartner,
  };
}

export default function PlayerPage() {
  const navigate =
    useNavigate();
  const session =
    useAccessSession();
  const [, setAttendanceList] =
    useState<any[]>([]);
  const players =
    useMatchStore(
      (state) => state.players
    );
  const courts =
    useMatchStore(
      (state) => state.courts
    );
  const queuedCourts =
    useMatchStore(
      (state) =>
        state.queuedCourts
    );
  const setPlayers =
    useMatchStore(
      (state) =>
        state.setPlayers
    );
  const notifications =
    useMatchStore(
      (state) =>
        state.notifications
    );
  const dismissNotification =
    useMatchStore(
      (state) =>
        state.dismissNotification
    );
  const dismissNotifications =
    useMatchStore(
      (state) =>
        state.dismissNotifications
    );

  useEffect(() => {
    if (
      session?.participationMode ===
        "PENDING" ||
      session?.participationMode ===
        "PREOPEN"
    ) {
      return;
    }

    getActiveWorkoutAttendanceList()
      .then((data) => {
        const uniqueAttendance =
          uniqueByUserId(data);
        setAttendanceList(
          uniqueAttendance
        );

        if (
          uniqueAttendance.length === 0
        ) {
          return;
        }

        const currentPlayers =
          useMatchStore.getState()
            .players;
        const currentById =
          new Map(
            currentPlayers.map(
              (player) => [
                player.id,
                player,
              ]
            )
          );
        const existingIds =
          new Set(
            currentPlayers.map(
              (player) => player.id
            )
          );
        const newPlayers =
          uniqueAttendance
            .filter(
              (attendance: any) =>
                !existingIds.has(
                  attendance.users.id
                )
            )
            .map(
              (attendance: any) =>
                attendanceToPlayer(
                  attendance,
                  currentById.get(
                    attendance.users.id
                  )
                )
            );

        if (
          currentPlayers.length === 0
        ) {
          runLocalOnlyMutation(() => {
            setPlayers(
              uniqueAttendance.map(
                (attendance: any) =>
                  attendanceToPlayer(
                    attendance
                  )
              )
            );
          });
          return;
        }

        if (newPlayers.length > 0) {
          runLocalOnlyMutation(() => {
            setPlayers([
              ...currentPlayers,
              ...newPlayers,
            ]);
          });
        }
      })
      .catch(console.error);
  }, [
    session?.participationMode,
    setPlayers,
  ]);

  const waitingPlayers =
    players.filter(
      (player) =>
        player.status ===
          "WAITING" &&
        player.isPresent
    );
  const playingPlayers =
    players.filter(
      (player) =>
        player.status ===
        "PLAYING"
    );
  const currentPlayer =
    players.find(
      (player) =>
        player.id ===
        session?.userId
    );
  const playerNotifications =
    notifications.filter(
      (notification) =>
        notification.audience ===
          "PLAYER" &&
        notification.recipientId ===
          session?.userId
    );

  if (
    session &&
    (
      session.participationMode ===
        "PENDING" ||
      session.participationMode ===
        "PREOPEN"
    )
  ) {
    return (
      <PreWorkoutQueueGate
        session={session}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">
            STEP UP MATCH
          </h1>
          <p className="mt-2 text-slate-400">
            Player View
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-2 overflow-x-auto [&>div]:min-w-[76px] [&>div]:rounded-xl [&>div]:p-3 [&>div>div:last-child]:mt-1 [&>div>div:last-child]:text-2xl">
        {[
          [
            label.participant,
            players.length,
          ],
          [
            label.playing,
            playingPlayers.length,
          ],
          [
            label.waiting,
            waitingPlayers.length,
          ],
          [
            label.court,
            courts.length,
          ],
        ].map(([title, value]) => (
          <div
            key={String(title)}
            className="border border-slate-800 bg-slate-900"
          >
            <div className="text-sm text-slate-400">
              {title}
            </div>
            <div className="mt-2 text-3xl font-bold">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
        <span className="text-sm text-slate-400">
          {label.status}
        </span>
        <span className="rounded-lg bg-cyan-400/15 px-3 py-1 text-sm font-bold text-cyan-300">
          {currentPlayer?.status ===
          "PLAYING"
            ? label.playing
            : currentPlayer?.status ===
                "WAITING"
              ? label.waiting
              : label.ended}
        </span>
      </div>

      {playerNotifications.length > 0 && (
        <div className="mb-8 rounded-3xl border border-cyan-500/30 bg-slate-900 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              {label.alert}
            </h2>
            <button
              type="button"
              onClick={() =>
                dismissNotifications(
                  playerNotifications.map(
                    (notification) =>
                      notification.id
                  )
                )
              }
              className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950"
            >
              {label.confirmAll}
            </button>
          </div>
          <div className="space-y-3">
            {playerNotifications.map(
              (notification) => (
                <div
                  key={notification.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-800 px-4 py-3"
                >
                  <div className="text-slate-200">
                    {notification.message}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      dismissNotification(
                        notification.id
                      )
                    }
                    className="rounded-lg bg-slate-700 px-3 py-1 text-sm"
                  >
                    {label.confirm}
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {courts.map((court) => (
          <CourtCard
            key={court.id}
            court={court}
            readOnly
          />
        ))}
      </div>

      {queuedCourts.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 rounded-2xl border border-indigo-400/30 bg-indigo-400/10 p-4">
            <p className="text-sm font-bold text-indigo-200">
              {label.queueCourt}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {label.queueHelp}
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {queuedCourts.map(
              (court) => (
                <CourtCard
                  key={`queue-${court.id}`}
                  court={court}
                  readOnly
                  matchTarget="QUEUE"
                />
              )
            )}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <WaitingList
          players={waitingPlayers}
          readOnly
          leaveablePlayerIds={
            session?.userId
              ? [session.userId]
              : []
          }
          onLeave={() => {
            clearAccessSession();
            navigate("/");
          }}
        />
        <MatchHistoryPanel />
      </div>
    </div>
  );
}
