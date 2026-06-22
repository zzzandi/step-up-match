import {
  lazy,
  Suspense,
  type ReactElement,
  useEffect,
} from "react";
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

import {
  AccessRole,
  adminNames,
  clearAccessSession,
  getAccessSession,
  getRolePath,
  masterNames,
  setAccessSession,
  useAccessSession,
} from "@/auth/access";
import AppNavigation from "@/components/navigation/AppNavigation";
import RoleSelectPage from "@/pages/RoleSelectPage";
import {
  publishLiveSessionEvent,
  subscribeLiveSessionEvents,
} from "@/services/liveSessionService";
import {
  getTestModeState,
} from "@/services/testModeService";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import {
  checkIn,
  getTodayAttendances,
  getUserById,
} from "@/services/supabaseUserService";
import {
  closeWorkout,
  getKstDateKey as getWorkoutDateKey,
  isWorkoutOpen,
} from "@/services/workoutSessionService";
import type {
  Player,
} from "@/types/player";

const AdminPage =
  lazy(() => import("@/pages/AdminPage"));
const AttendancePage =
  lazy(() => import("@/pages/AttendancePage"));
const FixedPartnerPage =
  lazy(() => import("@/pages/FixedPartnerPage"));
const GuestJoinPage =
  lazy(() => import("@/pages/GuestJoinPage"));
const JoinPage =
  lazy(() => import("@/pages/JoinPage"));
const MyPage =
  lazy(() => import("@/pages/MyPage"));
const PlayerPage =
  lazy(() => import("@/pages/PlayerPage"));
const RecordsManagementPage =
  lazy(() => import("@/pages/RecordsManagementPage"));
const ParticipantsPage =
  lazy(() => import("@/pages/ParticipantsPage"));

const DASHBOARD_DATE_KEY =
  "step-up-match-dashboard-date";

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

function getMillisecondsUntilKstMidnight() {
  const now = new Date();
  const kstNow = new Date(
    now.toLocaleString(
      "en-US",
      {
        timeZone:
          "Asia/Seoul",
      }
    )
  );
  const nextMidnight =
    new Date(kstNow);

  nextMidnight.setHours(
    24,
    0,
    0,
    0
  );

  return Math.max(
    1000,
    nextMidnight.getTime() -
      kstNow.getTime()
  );
}

function ProtectedRoute({
  role,
  children,
}: {
  role: AccessRole;
  children: ReactElement;
}) {
  const session =
    useAccessSession();

  if (!session) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (session.role !== role) {
    return (
      <Navigate
        to={getRolePath(
          session.role
        )}
        replace
      />
    );
  }

  return children;
}

function AuthenticatedRoute({
  children,
}: {
  children: ReactElement;
}) {
  const session =
    useAccessSession();

  if (!session) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}

function publishStateSnapshot() {
  const state =
    useMatchStore.getState();

  publishLiveSessionEvent({
    type: "STATE_SNAPSHOT",
    snapshot: {
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
    },
  });
}

async function activatePendingParticipant() {
  const session =
    getAccessSession();

  if (
    !session?.userId ||
    session.participationMode !==
      "PENDING"
  ) {
    return false;
  }

  const today =
    getWorkoutDateKey();
  const attendances =
    await getTodayAttendances();
  const alreadyJoined =
    attendances?.some(
      (attendance: {
        user_id?: string;
      }) =>
        attendance.user_id ===
        session.userId
    );

  if (!alreadyJoined) {
    await checkIn(
      session.userId
    );
  }

  const user =
    await getUserById(
      session.userId
    );
  const state =
    useMatchStore.getState();
  const existing =
    state.players.find(
      (player) =>
        player.id ===
        session.userId
    );
  const nextPlayer: Player = {
    id: user.id,
    name:
      session.userName ??
      user.name,
    gender:
      user.gender ?? "M",
    grade:
      user.grade ?? "F",
    hiddenSkill:
      user.hidden_skill ?? 35,
    isPresent: true,
    arrivalTime: new Date(),
    matchCount:
      existing?.matchCount ?? 0,
    consecutiveMatches:
      existing?.consecutiveMatches ??
      0,
    status: "WAITING",
    waitingStartedAt:
      new Date(),
    lastPartners:
      existing?.lastPartners ?? [],
    lastOpponents:
      existing?.lastOpponents ?? [],
    fixedPartner:
      existing?.fixedPartner,
  };

  state.setPlayers([
    ...state.players.filter(
      (player) =>
        player.id !==
        nextPlayer.id
    ),
    nextPlayer,
  ]);

  state.addNotification({
    audience: "ADMIN",
    message: `${nextPlayer.name}님이 오늘 운동에 참가했습니다.`,
  });

  state.players
    .filter(
      (player) =>
        player.id !==
          nextPlayer.id &&
        player.status !== "LEFT" &&
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
        recipientId:
          player.id,
        message: `${nextPlayer.name}님이 오늘 운동에 참가했습니다.`,
      });
    });

  setAccessSession({
    ...session,
    participationMode:
      "PARTICIPANT",
  });

  window.localStorage.setItem(
    DASHBOARD_DATE_KEY,
    today
  );

  return true;
}

function App() {
  const navigate =
    useNavigate();
  const accessSession =
    useAccessSession();

  useEffect(() => {
    const todayKey =
      getKstDateKey();
    const storedDate =
      window.localStorage.getItem(
        DASHBOARD_DATE_KEY
      );

    if (
      storedDate &&
      storedDate !== todayKey
    ) {
      useMatchStore
        .getState()
        .endTodaySession();
      clearAccessSession();
      navigate("/");
    }

    window.localStorage.setItem(
      DASHBOARD_DATE_KEY,
      todayKey
    );
  }, [navigate]);

  useEffect(() => {
    let applyingRemoteSnapshot =
      false;

    const unsubscribeLive =
      subscribeLiveSessionEvents(
        (event) => {
          if (
            getTestModeState()
              .active
          ) {
            return;
          }

          if (
            event.type ===
            "WORKOUT_OPENED"
          ) {
            if (
              event.workoutDate ===
              getWorkoutDateKey()
            ) {
              void activatePendingParticipant()
                .then(
                  (activated) => {
                    if (
                      activated &&
                      getAccessSession()
                        ?.role ===
                        "PLAYER"
                    ) {
                      navigate(
                        "/player"
                      );
                    }
                  }
                );
            }
            return;
          }

          if (
            event.type ===
            "STATE_SNAPSHOT"
          ) {
            applyingRemoteSnapshot =
              true;
            useMatchStore.setState(
              event.snapshot as any
            );
            window.setTimeout(() => {
              applyingRemoteSnapshot =
                false;
            }, 0);
            return;
          }

          if (
            event.type ===
            "REQUEST_SNAPSHOT"
          ) {
            publishStateSnapshot();
            return;
          }

          if (
            event.type ===
            "END_TODAY"
          ) {
            useMatchStore
              .getState()
              .endTodaySession();
            clearAccessSession();
            window.localStorage.setItem(
              DASHBOARD_DATE_KEY,
              getKstDateKey()
            );
            navigate("/");
            return;
          }

          if (
            event.type ===
            "FORCE_LOGOUT"
          ) {
            const session =
              getAccessSession();

            if (
              !event.userId ||
              event.userId ===
                session?.userId
            ) {
              clearAccessSession();
              navigate("/");
            }
          }
        }
      );

    const unsubscribeStore =
      useMatchStore.subscribe(
        (state) => {
          if (
            applyingRemoteSnapshot
            ||
            getTestModeState()
              .active
          ) {
            return;
          }

          publishLiveSessionEvent({
            type: "STATE_SNAPSHOT",
            snapshot: {
              players:
                state.players,
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
            },
          });
        }
      );

    if (
      !getTestModeState().active
    ) {
      publishLiveSessionEvent({
        type: "REQUEST_SNAPSHOT",
      });
    }

    return () => {
      unsubscribeLive();
      unsubscribeStore();
    };
  }, [navigate]);

  useEffect(() => {
    if (
      accessSession?.participationMode !==
      "PENDING"
    ) {
      return;
    }

    let cancelled = false;

    async function checkOpenStatus() {
      try {
        const open =
          await isWorkoutOpen();

        if (
          open &&
          !cancelled
        ) {
          const activated =
            await activatePendingParticipant();

          if (
            activated &&
            getAccessSession()
              ?.role ===
              "PLAYER"
          ) {
            navigate(
              "/player"
            );
          }
        }
      } catch (error) {
        console.error(error);
      }
    }

    void checkOpenStatus();
    const timer =
      window.setInterval(
        checkOpenStatus,
        5000
      );

    return () => {
      cancelled = true;
      window.clearInterval(
        timer
      );
    };
  }, [
    accessSession?.participationMode,
    navigate,
  ]);

  useEffect(() => {
    let timer = 0;

    function scheduleNextMidnight() {
      timer =
        window.setTimeout(() => {
          void closeWorkout(
            getWorkoutDateKey()
          );
          publishLiveSessionEvent({
            type: "END_TODAY",
            reason: "MIDNIGHT",
          });
          publishLiveSessionEvent({
            type: "FORCE_LOGOUT",
            reason: "END_TODAY",
          });
          scheduleNextMidnight();
        }, getMillisecondsUntilKstMidnight());
    }

    scheduleNextMidnight();

    return () =>
      window.clearTimeout(timer);
  }, []);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white p-6">
          Loading...
        </div>
      }
    >
      <AppNavigation />

      <Routes>
        <Route
          path="/"
          element={<RoleSelectPage />}
        />

        <Route
          path="/join/:role"
          element={<JoinPage />}
        />

        <Route
          path="/join/guest"
          element={<GuestJoinPage />}
        />

        <Route
          path="/join"
          element={
            <Navigate
              to="/join/player"
              replace
            />
          }
        />

        <Route
          path="/admin-login"
          element={
            <Navigate
              to="/join/admin"
              replace
            />
          }
        />

        <Route
          path="/master-login"
          element={
            <Navigate
              to="/join/master"
              replace
            />
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute role="ADMIN">
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/player"
          element={
            <ProtectedRoute role="PLAYER">
              <PlayerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/master"
          element={
            <ProtectedRoute role="MASTER">
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my"
          element={
            <AuthenticatedRoute>
              <MyPage />
            </AuthenticatedRoute>
          }
        />

        <Route
          path="/participants"
          element={
            <AuthenticatedRoute>
              <ParticipantsPage />
            </AuthenticatedRoute>
          }
        />

        <Route
          path="/attendance"
          element={
            <AuthenticatedRoute>
              <AttendancePage />
            </AuthenticatedRoute>
          }
        />

        <Route
          path="/fixed-partner"
          element={
            <AuthenticatedRoute>
              <FixedPartnerPage />
            </AuthenticatedRoute>
          }
        />

        <Route
          path="/records-management"
          element={
            <AuthenticatedRoute>
              <RecordsManagementPage />
            </AuthenticatedRoute>
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </Suspense>
  );
}

export default App;
