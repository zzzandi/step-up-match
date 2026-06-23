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
  canManage,
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
  getLiveSessionClientId,
  publishLiveSessionEvent,
  subscribeLiveSessionEvents,
} from "@/services/liveSessionService";
import {
  SNAPSHOT_REQUEST_RETRY_DELAYS,
  shouldApplyStateSnapshot,
  shouldClearSessionForForceLogout,
} from "@/services/liveEventGuards";
import {
  createLiveStatePatch,
  createLiveStateSnapshot,
  getSnapshotResponseDelay,
  mergeLiveStateSnapshot,
  type LiveStatePatch,
} from "@/services/liveStateSync";
import {
  getTestModeState,
} from "@/services/testModeService";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import {
  activatePendingCheckIn,
  getUserById,
} from "@/services/supabaseUserService";
import {
  getKstDateKey as getWorkoutDateKey,
  isWorkoutOpen,
} from "@/services/workoutSessionService";
import {
  recoverOpenWorkoutDashboard,
} from "@/services/dashboardRecoveryService";
import type {
  Player,
} from "@/types/player";
import {
  getDashboardDateAction,
} from "@/services/dashboardDateRollover";

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

function publishStateSnapshot(
  patch?: LiveStatePatch,
  responseToRequestId?: string
) {
  const session =
    getAccessSession();

  if (!session) {
    return;
  }

  const state =
    useMatchStore.getState();

  publishLiveSessionEvent({
    type: "STATE_SNAPSHOT",
    snapshot:
      createLiveStateSnapshot(
        state
      ),
    sourceRole: session.role,
    sourceUserId:
      session.userId,
    sourceClientId:
      getLiveSessionClientId(),
    sentAt:
      new Date().toISOString(),
    patch,
    responseToRequestId,
  });
}

async function activatePendingParticipant() {
  const session =
    getAccessSession();

  if (
    !session?.userId ||
    (
      session.participationMode !==
        "PENDING" &&
      session.participationMode !==
        "PENDING_MANAGER"
    )
  ) {
    return false;
  }

  const today =
    getWorkoutDateKey();
  const attendance =
    await activatePendingCheckIn(
      session.userId,
      false
    );

  if (!attendance) {
    setAccessSession({
      ...session,
      participationMode:
        "PREOPEN",
    });
    return false;
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
      new Date(
        attendance?.arrival_time ??
          Date.now()
      ),
    lastPartners:
      existing?.lastPartners ?? [],
    lastOpponents:
      existing?.lastOpponents ?? [],
    fixedPartner:
      user.fixed_partner_id ??
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
      getWorkoutDateKey();
    const storedDate =
      window.localStorage.getItem(
        DASHBOARD_DATE_KEY
      );
    const action =
      getDashboardDateAction(
        storedDate,
        todayKey
      );

    window.localStorage.setItem(
      DASHBOARD_DATE_KEY,
      todayKey
    );

    if (
      action === "RECOVER" &&
      getAccessSession() &&
      !getTestModeState().active
    ) {
      void recoverOpenWorkoutDashboard()
        .catch(console.error);
    }
  }, [navigate]);

  useEffect(() => {
    let applyingRemoteSnapshot =
      false;
    const initialSession =
      getAccessSession();
    let authorityReady =
      !initialSession ||
      !canManage(
        initialSession.role
      );
    const snapshotResponseTimers =
      new Map<
        string,
        number
      >();
    const pendingSnapshotRequestIds =
      new Set<string>();
    const snapshotRequestExpiryTimers =
      new Map<string, number>();
    const clearPendingSnapshotRequests =
      () => {
        pendingSnapshotRequestIds.clear();
        snapshotRequestExpiryTimers.forEach(
          (timer) =>
            window.clearTimeout(timer)
        );
        snapshotRequestExpiryTimers.clear();
      };
    const requestSnapshot = () => {
      const requestId =
        crypto.randomUUID();

      pendingSnapshotRequestIds.add(
        requestId
      );
      snapshotRequestExpiryTimers.set(
        requestId,
        window.setTimeout(() => {
          pendingSnapshotRequestIds.delete(
            requestId
          );
          snapshotRequestExpiryTimers.delete(
            requestId
          );
        }, 10000)
      );
      publishLiveSessionEvent({
        type: "REQUEST_SNAPSHOT",
        requestId,
      });
    };
    const authorityTimer =
      window.setTimeout(() => {
        authorityReady = true;
        if (
          !getTestModeState()
            .active
        ) {
          requestSnapshot();
        }
      }, 2200);
    const snapshotRetryTimers =
      SNAPSHOT_REQUEST_RETRY_DELAYS.map(
        (delay) =>
          window.setTimeout(() => {
            if (
              !getTestModeState()
                .active
            ) {
              requestSnapshot();
            }
          }, delay)
      );

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
                  async (activated) => {
                    await recoverOpenWorkoutDashboard();

                    if (activated) {
                      const activeRole =
                        getAccessSession()
                          ?.role;

                      if (activeRole) {
                      navigate(
                          getRolePath(
                            activeRole
                          )
                      );
                      }
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
            if (
              event.responseToRequestId
            ) {
              const responseTimer =
                snapshotResponseTimers.get(
                  event.responseToRequestId
                );

              if (
                responseTimer !==
                undefined
              ) {
                window.clearTimeout(
                  responseTimer
                );
                snapshotResponseTimers.delete(
                  event.responseToRequestId
                );
              }
            }

            if (
              !shouldApplyStateSnapshot(
                event,
                getLiveSessionClientId(),
                pendingSnapshotRequestIds
              )
            ) {
              return;
            }

            if (
              event.responseToRequestId
            ) {
              clearPendingSnapshotRequests();
            }

            const currentState =
              useMatchStore.getState();
            const currentSnapshot =
              createLiveStateSnapshot(
                currentState
              );
            const mergedSnapshot =
              mergeLiveStateSnapshot(
                currentSnapshot,
                event.snapshot,
                event.sourceRole,
                event.sourceUserId,
                event.patch
              );

            applyingRemoteSnapshot =
              true;
            try {
              useMatchStore.setState(
                mergedSnapshot
              );
              if (
                event.sourceRole ===
                  "ADMIN" ||
                event.sourceRole ===
                  "MASTER"
              ) {
                authorityReady = true;
              }
            } finally {
              applyingRemoteSnapshot =
                false;
            }
            return;
          }

          if (
            event.type ===
            "REQUEST_SNAPSHOT"
          ) {
            const session =
              getAccessSession();

            if (
              session &&
              canManage(
                session.role
              ) &&
              authorityReady
            ) {
              if (
                snapshotResponseTimers.has(
                  event.requestId
                )
              ) {
                return;
              }

              const responseTimer =
                window.setTimeout(
                  () => {
                    snapshotResponseTimers.delete(
                      event.requestId
                    );
                    publishStateSnapshot(
                      undefined,
                      event.requestId
                    );
                  },
                  getSnapshotResponseDelay(
                    session.role,
                    getLiveSessionClientId()
                  )
                );

              snapshotResponseTimers.set(
                event.requestId,
                responseTimer
              );
            }
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
              getWorkoutDateKey()
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
              shouldClearSessionForForceLogout(
                event.userId,
                session?.userId
              )
            ) {
              clearAccessSession();
              navigate("/");
            }
          }
        }
      );

    const unsubscribeStore =
      useMatchStore.subscribe(
        (state, previousState) => {
          const session =
            getAccessSession();

          if (
            applyingRemoteSnapshot
            ||
            (
              session &&
              canManage(
                session.role
              ) &&
              !authorityReady
            )
            ||
            getTestModeState()
              .active
          ) {
            return;
          }

          const previousSnapshot =
            createLiveStateSnapshot(
              previousState
            );
          const nextSnapshot =
            createLiveStateSnapshot(
              state
            );

          const patch =
            createLiveStatePatch(
              previousSnapshot,
              nextSnapshot
            );

          if (
            patch.changedKeys.length >
            0
          ) {
            publishStateSnapshot(
              patch
            );
          }
        }
      );

    if (
      !getTestModeState().active
    ) {
      requestSnapshot();
    }

    return () => {
      window.clearTimeout(
        authorityTimer
      );
      snapshotRetryTimers.forEach(
        (timer) =>
          window.clearTimeout(
            timer
          )
      );
      snapshotResponseTimers.forEach(
        (timer) =>
          window.clearTimeout(
            timer
          )
      );
      clearPendingSnapshotRequests();
      unsubscribeLive();
      unsubscribeStore();
    };
  }, [navigate]);

  useEffect(() => {
    if (
      accessSession?.participationMode !==
        "PENDING" &&
      accessSession?.participationMode !==
        "PENDING_MANAGER"
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
          await recoverOpenWorkoutDashboard();

          if (activated) {
            const activeRole =
              getAccessSession()
                ?.role;

            if (activeRole) {
              navigate(
                getRolePath(
                  activeRole
                )
              );
            }
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
    if (
      !accessSession ||
      getTestModeState().active
    ) {
      return;
    }

    let cancelled = false;

    async function recoverDashboard() {
      try {
        if (!cancelled) {
          await recoverOpenWorkoutDashboard();
        }
      } catch (error) {
        console.error(error);
      }
    }

    void recoverDashboard();
    const timer =
      window.setInterval(
        recoverDashboard,
        3000
      );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    accessSession,
    accessSession?.role,
    accessSession?.userId,
    accessSession?.participationMode,
  ]);

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
