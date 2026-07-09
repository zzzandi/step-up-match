import {
  lazy,
  Suspense,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
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
import ThemeToggleButton from "@/components/theme/ThemeToggleButton";
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
import {
  getLiveStateSnapshotFromServer,
  saveLiveStateSnapshotToServer,
} from "@/services/liveStateSnapshotService";
import type {
  Player,
} from "@/types/player";
import {
  getDashboardDateAction,
} from "@/services/dashboardDateRollover";
import {
  isLocalOnlyMutationActive,
  runLocalOnlyMutation,
  runLocalOnlyMutationAsync,
} from "@/services/localStateMutationGuard";
import {
  getEffectiveHiddenSkill,
} from "@/utils/skillOverrides";
import {
  useAppTheme,
} from "@/services/themeService";

const AdminPage =
  lazy(() => import("@/pages/AdminPage"));
const AttendancePage =
  lazy(() => import("@/pages/AttendancePage"));
const FixedPartnerPage =
  lazy(() => import("@/pages/FixedPartnerPage"));
const FeedbackPage =
  lazy(() => import("@/pages/FeedbackPage"));
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
const WorkoutReportPage =
  lazy(() => import("@/pages/WorkoutReportPage"));

const DASHBOARD_DATE_KEY =
  "step-up-match-dashboard-date";
const LIVE_SNAPSHOT_REQUEST_EVENT =
  "step-up-match-request-live-snapshot";
const CRITICAL_REBROADCAST_DELAYS =
  [250, 900, 2200] as const;

function isCriticalLiveStatePatch(
  patch: LiveStatePatch
) {
  return patch.changedKeys.some(
    (key) =>
      key === "players" ||
      key === "courts" ||
      key === "queuedCourts" ||
      key === "matchHistory"
  );
}

function ProtectedRoute({
  role,
  children,
}: {
  role: AccessRole | AccessRole[];
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

  const allowedRoles =
    Array.isArray(role)
      ? role
      : [role];

  if (
    !allowedRoles.includes(
      session.role
    )
  ) {
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
  const snapshot =
    createLiveStateSnapshot(
      state
    );

  publishLiveSessionEvent({
    type: "STATE_SNAPSHOT",
    snapshot,
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

  if (canManage(session.role)) {
    void saveLiveStateSnapshotToServer({
      workoutDate:
        getWorkoutDateKey(),
      snapshot,
      updatedById:
        session.userId,
      updatedByName:
        session.userName,
      updatedByRole:
        session.role,
    }).catch(console.error);
  }
}

function normalizeLivePlayer(
  player: Player
): Player {
  return {
    ...player,
    arrivalTime:
      new Date(player.arrivalTime),
    waitingStartedAt:
      player.waitingStartedAt
        ? new Date(
            player.waitingStartedAt
          )
        : undefined,
    playingStartedAt:
      player.playingStartedAt
        ? new Date(
            player.playingStartedAt
          )
        : undefined,
    lastMatchAt:
      player.lastMatchAt
        ? new Date(
            player.lastMatchAt
          )
        : undefined,
  };
}

function applyActivatedParticipant(
  player: Player
) {
  const activatedPlayer =
    normalizeLivePlayer(player);

  runLocalOnlyMutation(() => {
    const state =
      useMatchStore.getState();

    state.setPlayers([
      ...state.players.filter(
        (item) =>
          item.id !==
          activatedPlayer.id
      ),
      activatedPlayer,
    ]);

    state.addNotification({
      audience: "ADMIN",
      message: `${activatedPlayer.name}님이 오늘 운동에 참가했습니다.`,
    });

    useMatchStore
      .getState()
      .players.filter(
        (item) =>
          item.id !==
            activatedPlayer.id &&
          item.status !== "LEFT" &&
          !adminNames.includes(
            item.name
          ) &&
          !masterNames.includes(
            item.name
          )
      )
      .forEach((item) => {
        useMatchStore
          .getState()
          .addNotification({
            audience: "PLAYER",
            recipientId:
              item.id,
            message: `${activatedPlayer.name}님이 오늘 운동에 참가했습니다.`,
          });
      });
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
      getEffectiveHiddenSkill(
        user.name,
        user.hidden_skill ?? 35
      ),
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

  applyActivatedParticipant(
    nextPlayer
  );

  setAccessSession({
    ...session,
    participationMode:
      "PARTICIPANT",
  });

  window.localStorage.setItem(
    DASHBOARD_DATE_KEY,
    today
  );

  publishLiveSessionEvent({
    type: "PARTICIPANT_ACTIVATED",
    player: nextPlayer,
    sourceUserId:
      nextPlayer.id,
    sourceClientId:
      getLiveSessionClientId(),
    sentAt:
      new Date().toISOString(),
  });

  window.dispatchEvent(
    new Event(
      LIVE_SNAPSHOT_REQUEST_EVENT
    )
  );

  return true;

  /*
   * Legacy stale-snapshot activation path intentionally disabled.
   * Pending browsers can resume with old dashboard state, so the
   * participant activation above must be sent only through the
   * PARTICIPANT_ACTIVATED single-player event.

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

*/
}

function App() {
  useAppTheme();

  const navigate =
    useNavigate();
  const accessSession =
    useAccessSession();
  const suppressLocalBroadcastUntilRef =
    useRef(0);

  const recoverDashboardLocally =
    useCallback(async () => {
      return runLocalOnlyMutationAsync(
        recoverOpenWorkoutDashboard
      );
    }, []);
  const recoverServerLiveStateLocally =
    useCallback(async () => {
      return runLocalOnlyMutationAsync(
        async () => {
          let row: Awaited<
            ReturnType<
              typeof getLiveStateSnapshotFromServer
            >
          > = null;

          try {
            row =
              await getLiveStateSnapshotFromServer(
                getWorkoutDateKey()
              );
          } catch (error) {
            console.error(error);
            return false;
          }

          if (!row?.snapshot) {
            return false;
          }

          const currentSnapshot =
            createLiveStateSnapshot(
              useMatchStore.getState()
            );
          const mergedSnapshot =
            mergeLiveStateSnapshot(
              currentSnapshot,
              row.snapshot,
              row.updated_by_role ??
                "MASTER",
              row.updated_by_id ??
                undefined
            );

          useMatchStore.setState(
            mergedSnapshot
          );
          return true;
        }
      );
    }, []);

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
      useMatchStore
        .getState()
        .endTodaySession();
      clearAccessSession();
      navigate("/");
      return;
    }

  }, [
    navigate,
  ]);

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
    const criticalRebroadcastTimers =
      new Set<number>();
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

      suppressLocalBroadcastUntilRef.current =
        Date.now() + 3000;
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
    const scheduleCriticalRebroadcast =
      (patch: LiveStatePatch) => {
        if (
          !isCriticalLiveStatePatch(
            patch
          )
        ) {
          return;
        }

        publishLiveSessionEvent({
          type: "STATE_CHANGED",
        });

        CRITICAL_REBROADCAST_DELAYS.forEach(
          (delay) => {
            const timer =
              window.setTimeout(() => {
                criticalRebroadcastTimers.delete(
                  timer
                );
                publishStateSnapshot(patch);
              }, delay);

            criticalRebroadcastTimers.add(
              timer
            );
          }
        );
      };
    const refreshLiveSnapshot = () => {
      if (
        getTestModeState().active
      ) {
        return;
      }

      void recoverDashboardLocally()
        .then(() =>
          recoverServerLiveStateLocally()
        )
        .catch(console.error);
      requestSnapshot();
    };
    const handleVisibilityRefresh =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          refreshLiveSnapshot();
        }
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
                    await recoverDashboardLocally();

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
            "PARTICIPANT_ACTIVATED"
          ) {
            if (
              event.sourceClientId ===
              getLiveSessionClientId()
            ) {
              return;
            }

            applyActivatedParticipant(
              event.player
            );
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
              suppressLocalBroadcastUntilRef.current =
                0;
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
            "WORKOUT_CLOSED"
          ) {
            if (
              event.workoutDate ===
              getWorkoutDateKey()
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
            }
            return;
          }

          if (
            event.type ===
            "STATE_CHANGED"
          ) {
            requestSnapshot();
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
          if (
            applyingRemoteSnapshot
            ||
            isLocalOnlyMutationActive()
            ||
            getTestModeState()
              .active
          ) {
            return;
          }

          const session =
            getAccessSession();

          if (
            session &&
            !canManage(session.role) &&
            (
              pendingSnapshotRequestIds.size >
                0 ||
              Date.now() <
                suppressLocalBroadcastUntilRef.current
            )
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
            scheduleCriticalRebroadcast(
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

    window.addEventListener(
      "focus",
      refreshLiveSnapshot
    );
    window.addEventListener(
      "pageshow",
      refreshLiveSnapshot
    );
    document.addEventListener(
      "visibilitychange",
      handleVisibilityRefresh
    );
    window.addEventListener(
      LIVE_SNAPSHOT_REQUEST_EVENT,
      refreshLiveSnapshot
    );

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
      criticalRebroadcastTimers.forEach(
        (timer) =>
          window.clearTimeout(
            timer
          )
      );
      clearPendingSnapshotRequests();
      window.removeEventListener(
        "focus",
        refreshLiveSnapshot
      );
      window.removeEventListener(
        "pageshow",
        refreshLiveSnapshot
      );
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityRefresh
      );
      window.removeEventListener(
        LIVE_SNAPSHOT_REQUEST_EVENT,
        refreshLiveSnapshot
      );
      unsubscribeLive();
      unsubscribeStore();
    };
  }, [
    navigate,
    recoverDashboardLocally,
    recoverServerLiveStateLocally,
  ]);

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
          await recoverDashboardLocally();
          await recoverServerLiveStateLocally();

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
    recoverDashboardLocally,
    recoverServerLiveStateLocally,
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
          const open =
            await isWorkoutOpen();

          if (!open) {
            const session =
              getAccessSession();
            const shouldKeepSession =
              !session ||
              canManage(session.role) ||
              session.participationMode ===
                "PREOPEN" ||
              session.participationMode ===
                "PENDING" ||
              session.participationMode ===
                "PENDING_MANAGER" ||
              session.participationMode ===
                "VIEWER";

            useMatchStore
              .getState()
              .endTodaySession();
            window.localStorage.setItem(
              DASHBOARD_DATE_KEY,
              getWorkoutDateKey()
            );

            if (!shouldKeepSession) {
              clearAccessSession();
              navigate("/");
            }
            return;
          }

          await recoverDashboardLocally();
          await recoverServerLiveStateLocally();
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
    navigate,
    recoverDashboardLocally,
    recoverServerLiveStateLocally,
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
      {!accessSession && (
        <div className="fixed right-4 top-4 z-50">
          <ThemeToggleButton />
        </div>
      )}

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
          path="/feedback"
          element={
            <AuthenticatedRoute>
              <FeedbackPage />
            </AuthenticatedRoute>
          }
        />

        <Route
          path="/records-management"
          element={
            <ProtectedRoute role="MASTER">
              <RecordsManagementPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/workout-report"
          element={
            <ProtectedRoute
              role={[
                "ADMIN",
                "MASTER",
              ]}
            >
              <WorkoutReportPage />
            </ProtectedRoute>
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
