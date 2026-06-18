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
  clearAccessSession,
  getAccessSession,
  getRolePath,
  useAccessSession,
} from "@/auth/access";
import AppNavigation from "@/components/navigation/AppNavigation";
import RoleSelectPage from "@/pages/RoleSelectPage";
import {
  publishLiveSessionEvent,
  subscribeLiveSessionEvents,
} from "@/services/liveSessionService";
import {
  useMatchStore,
} from "@/store/useMatchStore";

const AdminPage =
  lazy(() => import("@/pages/AdminPage"));
const JoinPage =
  lazy(() => import("@/pages/JoinPage"));
const MasterPage =
  lazy(() => import("@/pages/MasterPage"));
const MyPage =
  lazy(() => import("@/pages/MyPage"));
const PlayerPage =
  lazy(() => import("@/pages/PlayerPage"));
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
    },
  });
}

function App() {
  const navigate =
    useNavigate();

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
            },
          });
        }
      );

    publishLiveSessionEvent({
      type: "REQUEST_SNAPSHOT",
    });

    return () => {
      unsubscribeLive();
      unsubscribeStore();
    };
  }, [navigate]);

  useEffect(() => {
    let timer = 0;

    function scheduleNextMidnight() {
      timer =
        window.setTimeout(() => {
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
              <MasterPage />
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
