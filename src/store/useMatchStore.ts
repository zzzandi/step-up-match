import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Court } from "@/types/court";
import type { Player } from "@/types/player";
import type { MatchHistory } from "@/types/matchHistory";
import type {
  MatchRecommendation,
} from "@/types/match";

import {
  generateRecommendations,
} from "@/engine/matchEngine";

import {
  createMatchHistory,
} from "@/engine/historyManager";
import {
  uniquePlayers,
} from "@/utils/participants";
import {
  normalizePersistedMatchState,
} from "@/store/persistedState";
import {
  syncActiveAttendanceStats,
} from "@/services/attendanceService";

export interface FixedPartnerRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  partnerId: string;
  partnerName: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  audience:
    | "ADMIN"
    | "PLAYER";
  recipientId?: string;
  message: string;
  createdAt: string;
}

export interface FixedPartnerAssignment {
  id: string;
  playerAId: string;
  playerBId: string;
  approvedAt: string;
}

export interface FixedPartnerRequestResolution {
  id: string;
  requestId: string;
  resolvedAt: string;
  result: "APPROVED" | "REJECTED";
}

export type ExcludedMatchPair = [
  string,
  string,
];

function isAllowedNotificationMessage(
  message: string
) {
  if (/[\uFFFD\u4E00-\u9FFF]/.test(message)) {
    return false;
  }

  const blockedKeywords = [
    "\uad50\uccb4",
    "\ucc38\uac00",
    "\uac8c\uc2a4\ud2b8",
  ];

  if (
    blockedKeywords.some((keyword) =>
      message.includes(keyword)
    )
  ) {
    return false;
  }

  return [
    "\ub300\uc9c4",
    "\ubc30\uc815",
    "\uacbd\uae30 \uc885\ub8cc",
    "\uace0\uc815 \ud30c\ud2b8\ub108",
    "\ud30c\ud2b8\ub108",
    "Court",
    "\ucf54\ud2b8",
  ].some((keyword) =>
    message.includes(keyword)
  );
}
function createNotification(
  notification: Omit<
    AppNotification,
    "id" | "createdAt"
  >,
  createdAt = new Date()
): AppNotification | null {
  if (
    !isAllowedNotificationMessage(
      notification.message
    )
  ) {
    return null;
  }

  return {
    ...notification,
    id: crypto.randomUUID(),
    createdAt:
      createdAt.toISOString(),
  };
}

const DEFAULT_QUEUED_COURT_COUNT = 2;

function createEmptyCourt(id: number): Court {
  return {
    id,
    status: "EMPTY",
    teamA: null,
    teamB: null,
    startedAt: null,
  };
}

function createDefaultQueuedCourts() {
  return Array.from(
    {
      length: DEFAULT_QUEUED_COURT_COUNT,
    },
    (_, index) =>
      createEmptyCourt(index + 1)
  );
}

function ensureDefaultQueuedCourts(
  courts: Court[]
) {
  const next = [...courts].sort(
    (a, b) => a.id - b.id
  );
  let nextId =
    Math.max(
      0,
      ...next.map((court) => court.id)
    ) + 1;

  while (
    next.length <
    DEFAULT_QUEUED_COURT_COUNT
  ) {
    next.push(
      createEmptyCourt(nextId)
    );
    nextId += 1;
  }

  return next;
}

function compactNotifications(
  notifications: AppNotification[],
  dismissedNotificationIds: string[]
) {
  const dismissed = new Set(
    dismissedNotificationIds
  );
  const seen = new Set<string>();

  return notifications.filter(
    (notification) => {
      if (
        dismissed.has(notification.id) ||
        !isAllowedNotificationMessage(
          notification.message
        )
      ) {
        return false;
      }

      const key = [
        notification.audience,
        notification.recipientId ?? "",
        notification.message,
        Math.floor(
          new Date(
            notification.createdAt
          ).getTime() / 60_000
        ),
      ].join("|");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    }
  );
}

export interface MatchStore {
  players: Player[];

  courts: Court[];

  queuedCourts: Court[];

  fixedPartnerRequests:
    FixedPartnerRequest[];

  fixedPartnerAssignments:
    FixedPartnerAssignment[];

  fixedPartnerRequestResolutions:
    FixedPartnerRequestResolution[];

  notifications:
    AppNotification[];

  dismissedNotificationIds:
    string[];

  matchHistory: MatchHistory[];

  recommendations:
    MatchRecommendation[];

  selectedRecommendation:
    MatchRecommendation | null;

  recommendationTarget:
    "GAME" | "QUEUE";

  womenDoublesPriority:
    boolean;

  excludedMatchPairs:
    ExcludedMatchPair[];

  setPlayers: (
    players: Player[]
  ) => void;

  setCourts: (
    courts: Court[]
  ) => void;

  setWomenDoublesPriority: (
    enabled: boolean
  ) => void;

  addExcludedMatchPair: (
    playerAId: string,
    playerBId: string
  ) => void;

  removeExcludedMatchPair: (
    playerAId: string,
    playerBId: string
  ) => void;

  setFixedPartner: (
    playerAId: string,
    playerBId: string
  ) => void;

  removeFixedPartner: (
    playerAId: string,
    playerBId: string
  ) => void;

  requestFixedPartner: (
    requesterId: string,
    partnerId: string,
    requesterName?: string,
    partnerName?: string
  ) => void;

  approveFixedPartnerRequest: (
    requestId: string
  ) => void;

  rejectFixedPartnerRequest: (
    requestId: string
  ) => void;

  addNotification: (
    notification: Omit<
      AppNotification,
      "id" | "createdAt"
    >
  ) => void;

  dismissNotification: (
    notificationId: string
  ) => void;

  dismissNotifications: (
    notificationIds: string[]
  ) => void;

  endTodaySession: () => void;

  resetTodayWorkoutData: (
    workoutDate?: string
  ) => void;

  updateMatchScore: (
    matchId: string,
    teamAScore: number,
    teamBScore: number
  ) => void;

  addCourt: () => void;

  addQueuedCourt: () => void;

  removeCourt: (
    courtId: number
  ) => void;

  removeQueuedCourt: (
    courtId: number
  ) => void;

  finishCourtMatch: (
    courtId: number
  ) => void;

  replaceCourtPlayer: (
    courtId: number,
    outgoingPlayerId: string,
    incomingPlayerId: string
  ) => void;

  assignManualMatch: (
    courtId: number,
    teamAPlayerIds: [
      string,
      string,
    ],
    teamBPlayerIds: [
      string,
      string,
    ],
    target?: "GAME" | "QUEUE"
  ) => boolean;

  swapCourtPlayers: (
    courtId: number,
    firstPlayerId: string,
    secondPlayerId: string
  ) => boolean;

  selectRecommendation: (
    recommendationId: string
  ) => void;

  rerollRecommendations: (
    courtId: number,
    target?: "GAME" | "QUEUE"
  ) => void;

  approveRecommendation: (
    target?: "GAME" | "QUEUE"
  ) => void;

  clearRecommendation: () => void;
}

export const useMatchStore =
  create<MatchStore>()(
    persist(
      (set, get) => ({
      players: [],

      courts: [],

      queuedCourts:
        createDefaultQueuedCourts(),

      fixedPartnerRequests: [],

      fixedPartnerAssignments: [],

      fixedPartnerRequestResolutions:
        [],

      notifications: [],

      dismissedNotificationIds: [],

      matchHistory: [],

      recommendations: [],

      selectedRecommendation:
        null,

      recommendationTarget:
        "GAME",

      womenDoublesPriority:
        false,

      excludedMatchPairs: [],

      setPlayers: (
        players
      ) => {
        const storedAssignments =
          get()
            .fixedPartnerAssignments;
        const incomingAssignments =
          players
            .filter(
              (player) =>
                player.fixedPartner
            )
            .map((player) => {
              const pair = [
                player.id,
                player.fixedPartner!,
              ].sort();

              return {
                id: pair.join("|"),
                playerAId: pair[0],
                playerBId: pair[1],
                approvedAt:
                  new Date(0).toISOString(),
              };
            });
        const assignments =
          Array.from(
            new Map(
              [
                ...storedAssignments,
                ...incomingAssignments,
              ].map(
                (assignment) => [
                  assignment.id,
                  assignment,
                ]
              )
            ).values()
          );
        const partnerByPlayer =
          new Map<string, string>();

        assignments.forEach(
          (assignment) => {
            partnerByPlayer.set(
              assignment.playerAId,
              assignment.playerBId
            );
            partnerByPlayer.set(
              assignment.playerBId,
              assignment.playerAId
            );
          }
        );

        set({
          fixedPartnerAssignments:
            assignments,
          players:
            uniquePlayers(
              players
            ).map((player) => ({
              ...player,
              fixedPartner:
                partnerByPlayer.get(
                  player.id
                ),
            })),
        });
      },

      setCourts: (
        courts
      ) =>
        set({
          courts,
        }),

      setWomenDoublesPriority:
        (enabled) =>
          set({
            womenDoublesPriority:
              enabled,
          }),

      addExcludedMatchPair: (
        playerAId,
        playerBId
      ) => {
        if (
          !playerAId ||
          !playerBId ||
          playerAId === playerBId
        ) {
          return;
        }

        const pair = [
          playerAId,
          playerBId,
        ].sort() as ExcludedMatchPair;
        const exists =
          get().excludedMatchPairs.some(
            ([a, b]) =>
              a === pair[0] &&
              b === pair[1]
          );

        if (!exists) {
          set({
            excludedMatchPairs: [
              ...get().excludedMatchPairs,
              pair,
            ],
          });
        }
      },

      removeExcludedMatchPair: (
        playerAId,
        playerBId
      ) => {
        const pair = [
          playerAId,
          playerBId,
        ].sort();

        set({
          excludedMatchPairs:
            get().excludedMatchPairs.filter(
              ([a, b]) =>
                a !== pair[0] ||
                b !== pair[1]
            ),
        });
      },

      setFixedPartner: (
        playerAId,
        playerBId
      ) => {
        const {
          players,
          fixedPartnerAssignments,
        } = get();
        const pair = [
          playerAId,
          playerBId,
        ].sort();
        const assignment: FixedPartnerAssignment =
          {
            id: pair.join("|"),
            playerAId: pair[0],
            playerBId: pair[1],
            approvedAt:
              new Date().toISOString(),
          };
        const assignments = [
          ...fixedPartnerAssignments.filter(
            (item) =>
              item.playerAId !==
                playerAId &&
              item.playerBId !==
                playerAId &&
              item.playerAId !==
                playerBId &&
              item.playerBId !==
                playerBId
          ),
          assignment,
        ];
        const partnerByPlayer =
          new Map<string, string>();

        assignments.forEach(
          (item) => {
            partnerByPlayer.set(
              item.playerAId,
              item.playerBId
            );
            partnerByPlayer.set(
              item.playerBId,
              item.playerAId
            );
          }
        );

        const updated =
          players.map(
            (player) => ({
              ...player,
              fixedPartner:
                partnerByPlayer.get(
                  player.id
                ),
            })
          );

        set({
          players: updated,
          fixedPartnerAssignments:
            assignments,
        });
      },

      requestFixedPartner: (
        requesterId,
        partnerId,
        requesterName,
        partnerName
      ) => {
        const {
          players,
          fixedPartnerRequests,
        } = get();

        if (
          requesterId ===
          partnerId
        ) {
          return;
        }

        const requester =
          players.find(
            (player) =>
              player.id ===
              requesterId
          );

        const partner =
          players.find(
            (player) =>
              player.id ===
              partnerId
          );

        const resolvedRequesterName =
          requester?.name ??
          requesterName?.trim();
        const resolvedPartnerName =
          partner?.name ??
          partnerName?.trim();

        if (
          !resolvedRequesterName ||
          !resolvedPartnerName
        ) {
          return;
        }

        const alreadyRequested =
          fixedPartnerRequests.some(
            (request) =>
              (request.requesterId ===
                requesterId &&
                request.partnerId ===
                  partnerId) ||
              (request.requesterId ===
                partnerId &&
                request.partnerId ===
                  requesterId)
          );

        if (alreadyRequested) {
          return;
        }

        set({
          fixedPartnerRequests: [
            ...fixedPartnerRequests,
            {
              id:
                crypto.randomUUID(),
              requesterId,
              requesterName:
                resolvedRequesterName,
              partnerId,
              partnerName:
                resolvedPartnerName,
              createdAt:
                new Date().toISOString(),
            },
          ],
          notifications: [
            ...get().notifications,
            {
              id:
                crypto.randomUUID(),
              audience: "ADMIN",
              message: `${resolvedRequesterName}????癰궽블뀮??${resolvedPartnerName}???꿔꺂?????沅????????????????댄뱼???? ??????읐?????????????놁졄.`,
              createdAt:
                new Date().toISOString(),
            },
            {
              id:
                crypto.randomUUID(),
              audience: "PLAYER",
              recipientId: partnerId,
              message: `${resolvedRequesterName}????癰궽블뀮????????????????댄뱼???? ??????읐?????????????놁졄.`,
              createdAt:
                new Date().toISOString(),
            },
          ],
        });
        get().addNotification({
          audience: "ADMIN",
          message: `${resolvedRequesterName}\uB2D8\uC774 ${resolvedPartnerName}\uB2D8\uC744 \uACE0\uC815 \uD30C\uD2B8\uB108\uB85C \uC2E0\uCCAD\uD588\uC2B5\uB2C8\uB2E4.`,
        });
        get().addNotification({
          audience: "PLAYER",
          recipientId: partnerId,
          message: `${resolvedRequesterName}\uB2D8\uC774 \uACE0\uC815 \uD30C\uD2B8\uB108\uB97C \uC2E0\uCCAD\uD588\uC2B5\uB2C8\uB2E4.`,
        });
      },

      approveFixedPartnerRequest:
        (requestId) => {
          const {
            fixedPartnerRequests,
            setFixedPartner,
            fixedPartnerRequestResolutions,
          } = get();

          const request =
            fixedPartnerRequests.find(
              (item) =>
                item.id === requestId
            );

          if (!request) {
            return;
          }

          setFixedPartner(
            request.requesterId,
            request.partnerId
          );

          set({
            fixedPartnerRequests:
              fixedPartnerRequests.filter(
                (item) =>
                  item.id !==
                  requestId
                ),
            fixedPartnerRequestResolutions:
              [
                ...fixedPartnerRequestResolutions,
                {
                  id: request.id,
                  requestId:
                    request.id,
                  resolvedAt:
                    new Date().toISOString(),
                  result:
                    "APPROVED" as const,
                },
              ],
            notifications: [
              ...get().notifications,
              {
                id:
                  crypto.randomUUID(),
                audience: "PLAYER",
                recipientId:
                  request.requesterId,
                message: `${request.partnerName}?????嚥▲꺆?????????????????댄뱼?????????읐??????????????????`,
                createdAt:
                  new Date().toISOString(),
              },
              {
                id:
                  crypto.randomUUID(),
                audience: "PLAYER",
                recipientId:
                  request.partnerId,
                message: `${request.requesterName}?????嚥▲꺆?????????????????댄뱼?????????읐??????????????????`,
                createdAt:
                  new Date().toISOString(),
              },
            ],
          });
          get().addNotification({
            audience: "PLAYER",
            recipientId:
              request.requesterId,
            message: `${request.partnerName}\uB2D8\uACFC \uACE0\uC815 \uD30C\uD2B8\uB108\uB85C \uC124\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`,
          });
          get().addNotification({
            audience: "PLAYER",
            recipientId:
              request.partnerId,
            message: `${request.requesterName}\uB2D8\uACFC \uACE0\uC815 \uD30C\uD2B8\uB108\uB85C \uC124\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`,
          });
        },

      rejectFixedPartnerRequest:
        (requestId) => {
          const {
            fixedPartnerRequests,
            fixedPartnerRequestResolutions,
          } = get();

          const request =
            fixedPartnerRequests.find(
              (item) =>
                item.id === requestId
            );

          set({
            fixedPartnerRequests:
              fixedPartnerRequests.filter(
                (item) =>
                  item.id !==
                  requestId
              ),
            fixedPartnerRequestResolutions:
              request
                ? [
                    ...fixedPartnerRequestResolutions,
                    {
                      id: request.id,
                      requestId:
                        request.id,
                      resolvedAt:
                        new Date().toISOString(),
                      result:
                        "REJECTED" as const,
                    },
                  ]
                : fixedPartnerRequestResolutions,
            notifications: request
              ? [
                  ...get().notifications,
                  {
                    id:
                      crypto.randomUUID(),
                    audience: "PLAYER",
                    recipientId:
                      request.requesterId,
                    message: `${request.partnerName}?????嚥▲꺆?????????????????댄뱼?????????읐????饔낅챷維??????????????`,
                    createdAt:
                      new Date().toISOString(),
                  },
                  {
                    id:
                      crypto.randomUUID(),
                    audience: "PLAYER",
                    recipientId:
                      request.partnerId,
                    message: `${request.requesterName}?????嚥▲꺆?????????????????댄뱼?????????읐????饔낅챷維??????????????`,
                    createdAt:
                      new Date().toISOString(),
                  },
                ]
              : get().notifications,
          });
          if (request) {
            get().addNotification({
              audience: "PLAYER",
              recipientId:
                request.requesterId,
              message: `${request.partnerName}\uB2D8\uACFC\uC758 \uACE0\uC815 \uD30C\uD2B8\uB108 \uC2E0\uCCAD\uC774 \uAC70\uC808\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`,
            });
            get().addNotification({
              audience: "PLAYER",
              recipientId:
                request.partnerId,
              message: `${request.requesterName}\uB2D8\uACFC\uC758 \uACE0\uC815 \uD30C\uD2B8\uB108 \uC2E0\uCCAD\uC774 \uAC70\uC808\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`,
            });
          }
        },

      addNotification:
        (notification) => {
          const {
            notifications,
            dismissedNotificationIds,
          } = get();
          const nextNotification =
            createNotification(
              notification
            );

          if (!nextNotification) {
            return;
          }

          set({
            notifications:
              compactNotifications(
                [
                  ...notifications,
                  nextNotification,
                ],
                dismissedNotificationIds
              ),
          });
        },

      dismissNotification:
        (notificationId) => {
          const {
            notifications,
            dismissedNotificationIds,
          } = get();
          const nextDismissedIds =
            Array.from(
              new Set([
                ...dismissedNotificationIds,
                notificationId,
              ])
            );

          set({
            dismissedNotificationIds:
              nextDismissedIds,
            notifications:
              compactNotifications(
                notifications,
                nextDismissedIds
              ),
          });
        },

      dismissNotifications:
        (notificationIds) => {
          const {
            notifications,
            dismissedNotificationIds,
          } = get();
          const targetIds =
            new Set(
              notificationIds
            );
          const nextDismissedIds =
            Array.from(
              new Set([
                ...dismissedNotificationIds,
                ...notificationIds,
              ])
            );

          set({
            dismissedNotificationIds:
              nextDismissedIds,
            notifications:
              compactNotifications(
                notifications.filter(
                  (notification) =>
                    !targetIds.has(
                      notification.id
                    )
                ),
                nextDismissedIds
              ),
          });
        },

      endTodaySession: () => {
        set({
          players: [],
          courts: [],
          queuedCourts:
            createDefaultQueuedCourts(),
          fixedPartnerRequests:
            [],
          fixedPartnerAssignments:
            [],
          fixedPartnerRequestResolutions:
            [],
          excludedMatchPairs: [],
          notifications: [],
          dismissedNotificationIds:
            [],
          recommendations: [],
          selectedRecommendation:
            null,
          womenDoublesPriority:
            false,
          matchHistory: [],
        });
      },

      removeFixedPartner: (
        playerAId,
        playerBId
      ) => {
        const assignments =
          get().fixedPartnerAssignments.filter(
            (assignment) =>
              !(
                (
                  assignment.playerAId ===
                    playerAId &&
                  assignment.playerBId ===
                    playerBId
                ) ||
                (
                  assignment.playerAId ===
                    playerBId &&
                  assignment.playerBId ===
                    playerAId
                )
              )
          );
        const partnerByPlayer =
          new Map<string, string>();

        assignments.forEach(
          (assignment) => {
            partnerByPlayer.set(
              assignment.playerAId,
              assignment.playerBId
            );
            partnerByPlayer.set(
              assignment.playerBId,
              assignment.playerAId
            );
          }
        );

        set({
          fixedPartnerAssignments:
            assignments,
          players:
            get().players.map(
              (player) => ({
                ...player,
                fixedPartner:
                  partnerByPlayer.get(
                    player.id
                  ),
              })
            ),
        });
      },

      resetTodayWorkoutData: (
        workoutDate
      ) => {
        const formatter =
          new Intl.DateTimeFormat(
            "en-CA",
            {
              timeZone:
                "Asia/Seoul",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }
          );
        const todayDate =
          formatter.format(
            new Date()
          );
        const targetDate =
          workoutDate ??
          todayDate;

        if (targetDate !== todayDate) {
          set({
            matchHistory:
              get().matchHistory.filter(
                (history) =>
                  formatter.format(
                    new Date(
                      history.endedAt
                    )
                  ) !== targetDate
              ),
          });
          return;
        }

        set({
          players: [],
          courts: [],
          queuedCourts:
            createDefaultQueuedCourts(),
          fixedPartnerRequests: [],
          fixedPartnerAssignments: [],
          fixedPartnerRequestResolutions:
            [],
          excludedMatchPairs: [],
          notifications: [],
          dismissedNotificationIds:
            [],
          matchHistory:
            get().matchHistory.filter(
              (history) =>
                formatter.format(
                  new Date(
                    history.endedAt
                  )
                ) !== targetDate
            ),
          recommendations: [],
          selectedRecommendation:
            null,
          womenDoublesPriority:
            false,
        });
      },

      updateMatchScore: (
        matchId,
        teamAScore,
        teamBScore
      ) => {
        set({
          matchHistory:
            get().matchHistory.map(
              (history) =>
                history.id === matchId
                  ? {
                      ...history,
                      teamAScore,
                      teamBScore,
                    }
                  : history
            ),
        });
      },

      addCourt: () => {
        const {
          courts,
        } = get();
      
        const nextId =
          courts.length === 0
            ? 1
            : Math.max(
                ...courts.map(
                  (court) =>
                    court.id
                )
              ) + 1;
      
        const newCourt: Court = {
          id: nextId,
      
          status: "EMPTY",
      
          teamA: null,
      
          teamB: null,
      
          startedAt: null,
        };
      
        set({
          courts: [
            ...courts,
            newCourt,
          ],
        });
      },

      addQueuedCourt: () => {
        const {
          queuedCourts,
        } = get();

        const nextId =
          Math.max(
            0,
            ...queuedCourts.map(
              (court) => court.id
            )
          ) + 1;

        set({
          queuedCourts: [
            ...queuedCourts,
            createEmptyCourt(nextId),
          ],
        });
      },
       
      removeCourt: (
        courtId
      ) => {
        const {
          courts,
        } = get();
      
        if (
          courts.length <= 1
        ) {
          return;
        }
      
        const targetCourt =
          courts.find(
            (court) =>
              court.id ===
              courtId
          );
      
        if (
          !targetCourt
        ) {
          return;
        }
      
        if (
          targetCourt.status ===
          "PLAYING"
        ) {
          alert(
            "??棺堉?뤃????????關???꾨き??熬곥룊??????????????????????깅즽????????놁졄."
          );
      
          return;
        }
      
        set({
          courts:
            courts.filter(
              (court) =>
                court.id !==
                courtId
            ),
        });
      },

      removeQueuedCourt: (
        courtId
      ) => {
        const {
          queuedCourts,
        } = get();

        set({
          queuedCourts:
            ensureDefaultQueuedCourts(
              queuedCourts.filter(
                (court) =>
                  court.id !== courtId
              )
            ),
        });
      },

      clearRecommendation:
        () =>
          set({
            recommendations:
              [],
            selectedRecommendation:
              null,
            recommendationTarget:
              "GAME",
          }),

      finishCourtMatch: (
        courtId
      ) => {
        const {
          players,
          courts,
          queuedCourts,
          matchHistory,
        } = get();

        const targetCourt =
          courts.find(
            (court) =>
              court.id ===
              courtId
          );

        if (!targetCourt) {
          return;
        }

        const history =
          createMatchHistory(
            targetCourt
          );

        const teamA =
          targetCourt.teamA ??
          [];

        const teamB =
          targetCourt.teamB ??
          [];

        const finishedIds =
          [
            ...teamA,
            ...teamB,
          ].map(
            (player) =>
              player.id
          );

        const nextQueuedCourt =
          queuedCourts.find(
            (court) =>
              court.teamA &&
              court.teamB
          );
        const promotedTeamA =
          nextQueuedCourt?.teamA ?? null;
        const promotedTeamB =
          nextQueuedCourt?.teamB ?? null;
        const promotedIds =
          new Set(
            [
              ...(promotedTeamA ?? []),
              ...(promotedTeamB ?? []),
            ].map(
              (player) =>
                player.id
            )
          );
        const promotedAt =
          new Date();

        const updatedPlayers =
          players.map(
            (player) => {
              const played =
                finishedIds.includes(
                  player.id
                );

              if (
                played
              ) {
                const isTeamA =
                  teamA.some(
                    (p) =>
                      p.id ===
                      player.id
                  );

                const partners =
                  isTeamA
                    ? teamA
                    : teamB;

                const opponents =
                  isTeamA
                    ? teamB
                    : teamA;

                return {
                  ...player,

                  status:
                    "WAITING" as const,

                  waitingStartedAt:
                    new Date(),

                  playingStartedAt:
                    undefined,

                  lastPartners:
                    [
                      ...player.lastPartners,
                      ...partners
                        .filter(
                          (p) =>
                            p.id !==
                            player.id
                        )
                        .map((p) => p.id),
                    ].slice(
                      -2
                    ),
 
                  lastOpponents:
                    [
                      ...player.lastOpponents,
                      ...opponents.map(
                        (p) => p.id
                      ),
                    ].slice(
                      -6
                    ),
                };
              }

              if (
                promotedIds.has(
                  player.id
                )
              ) {
                return {
                  ...player,
                  status:
                    "PLAYING" as const,
                  matchCount:
                    player.matchCount +
                    1,
                  consecutiveMatches:
                    player.consecutiveMatches +
                    1,
                  playingStartedAt:
                    promotedAt,
                  lastMatchAt:
                    promotedAt,
                };
              }

              if (
                player.status ===
                "WAITING"
              ) {
                return {
                  ...player,

                  consecutiveMatches: 0,
                };
              }

              return player;
            }
          );

          void syncActiveAttendanceStats(
            updatedPlayers.filter(
              (player) =>
                finishedIds.includes(
                  player.id
                ) ||
                promotedIds.has(
                  player.id
                )
            )
          ).catch(console.error);

          

          const promotedPlayerById =
            new Map(
              updatedPlayers.map(
                (player) => [
                  player.id,
                  player,
                ]
              )
            );
          const promotedCourt:
            | Court
            | null =
            promotedTeamA &&
            promotedTeamB
              ? {
                  id: courtId,
                  status:
                    "PLAYING",
                  teamA:
                    promotedTeamA.map(
                      (player) =>
                        promotedPlayerById.get(
                          player.id
                        ) ?? player
                    ) as [Player, Player],
                  teamB:
                    promotedTeamB.map(
                      (player) =>
                        promotedPlayerById.get(
                          player.id
                        ) ?? player
                    ) as [Player, Player],
                  startedAt:
                    promotedAt,
                }
              : null;
          const finishNotification =
            createNotification(
              {
                audience: "ADMIN",
                message: `Court ${courtId} \uacbd\uae30 \uc885\ub8cc`,
              },
              promotedAt
            );
          const promoteNotification =
            promotedCourt
              ? createNotification(
                  {
                    audience: "ADMIN",
                    message: `\ub300\uae30 \ucf54\ud2b8 ${nextQueuedCourt?.id} \ub300\uc9c4\uc774 Court ${courtId}\ub85c \uc790\ub3d9 \ubc30\uc815\ub418\uc5c8\uc2b5\ub2c8\ub2e4.`,
                  },
                  promotedAt
                )
              : null;
          const nextNotifications =
            compactNotifications(
              [
                ...get().notifications,
                ...[
                  finishNotification,
                  promoteNotification,
                ].filter(
                  Boolean
                ) as AppNotification[],
              ],
              get().dismissedNotificationIds
            );

          set({
            players:
              updatedPlayers,
          
            recommendations: [],
          
            selectedRecommendation:
              null,
          
            matchHistory:
              history
                ? [
                    history,
                    ...matchHistory,
                  ]
                : matchHistory,
          
            courts:
              courts.map(
                (court) =>
                  court.id ===
                  courtId
                    ? promotedCourt ?? {
                        ...court,
           
                        status:
                          "EMPTY",
          
                        teamA:
                          null,
          
                        teamB:
                          null,
          
                        startedAt:
                          null,
                      }
                    : court
              ),
            queuedCourts:
              nextQueuedCourt
                ? ensureDefaultQueuedCourts(
                    queuedCourts.map(
                    (court) =>
                      court.id ===
                      nextQueuedCourt.id
                        ? createEmptyCourt(
                            court.id
                          )
                        : court
                    )
                  )
                : queuedCourts,
            notifications:
              nextNotifications,
          });
        },

      replaceCourtPlayer: (
        courtId,
        outgoingPlayerId,
        incomingPlayerId
      ) => {
        const {
          courts,
          players,
          notifications,
          dismissedNotificationIds,
          excludedMatchPairs,
        } = get();

        const court =
          courts.find(
            (item) =>
              item.id === courtId
          );

        const incomingPlayer =
          players.find(
            (player) =>
              player.id ===
              incomingPlayerId
          );

        const outgoingPlayer =
          players.find(
            (player) =>
              player.id ===
              outgoingPlayerId
          );

        if (
          !court ||
          !court.teamA ||
          !court.teamB ||
          !incomingPlayer ||
          !outgoingPlayer
        ) {
          return;
        }

        const replacementIds =
          new Set(
            [
              ...court.teamA,
              ...court.teamB,
            ].map((player) =>
              player.id ===
              outgoingPlayerId
                ? incomingPlayerId
                : player.id
            )
          );
        const violatesExcludedPair =
          excludedMatchPairs.some(
            ([
              playerAId,
              playerBId,
            ]) =>
              replacementIds.has(
                playerAId
              ) &&
              replacementIds.has(
                playerBId
              )
          );

        if (
          violatesExcludedPair
        ) {
          window.alert(
            "\uAC19\uC740 \uACBD\uAE30 \uBC30\uCE58 \uC81C\uC678\uB85C \uC124\uC815\uB41C \uC120\uC218\uB294 \uAD50\uCCB4\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."
          );
          return;
          window.alert(
            "???꿔꺂??틝??轅멸눼 ????ル늉??? ??棺堉?뤃????????????썹땟戮녹?????? ??????紐껊쑋?????嚥싲갭큔????????????嶺뚮슣??쮼?????쎛 ?????????얠? ???????????????깅즽????????놁졄."
          );
          return;
        }

        const restoredWaitingAt =
          outgoingPlayer.waitingStartedAt ??
          new Date();

        const updatedPlayers =
          players.map(
            (player) => {
              if (
                player.id ===
                outgoingPlayerId
              ) {
                return {
                  ...player,
                  status:
                    "WAITING" as const,
                  waitingStartedAt:
                    restoredWaitingAt,
                  playingStartedAt:
                    undefined,
                  consecutiveMatches: 0,
                };
              }

              if (
                player.id ===
                incomingPlayerId
              ) {
                return {
                  ...player,
                  status:
                    "PLAYING" as const,
                  playingStartedAt:
                    new Date(),
                  matchCount:
                    player.matchCount +
                    1,
                  consecutiveMatches:
                    player.consecutiveMatches +
                    1,
                  lastMatchAt:
                    new Date(),
                };
              }

              return player;
            }
          );

        const replacementPlayer =
          updatedPlayers.find(
            (player) =>
              player.id ===
              incomingPlayerId
          );

        if (!replacementPlayer) {
          return;
        }

        const replaceTeamPlayer =
          (
            team: [Player, Player]
          ): [Player, Player] =>
            team.map((player) =>
              player.id ===
              outgoingPlayerId
                ? replacementPlayer
                : player
            ) as [Player, Player];

        const updatedCourts =
          courts.map((item) => {
            if (
              item.id !==
                courtId ||
              !item.teamA ||
              !item.teamB
            ) {
              return item;
            }

            return {
              ...item,
              teamA:
                replaceTeamPlayer(
                  item.teamA
                ),
              teamB:
                replaceTeamPlayer(
                  item.teamB
                ),
            };
          });

        const updatedCourt =
          updatedCourts.find(
            (item) =>
              item.id === courtId
          );

        const teamAText =
          updatedCourt?.teamA
            ?.map(
              (player) =>
                player.name
            )
            .join(" + ") ?? "";

        const teamBText =
          updatedCourt?.teamB
            ?.map(
              (player) =>
                player.name
            )
            .join(" + ") ?? "";

        const message =
          `Court ${courtId} player replacement: ${outgoingPlayer.name} -> ${incomingPlayer.name}. ${teamAText} vs ${teamBText}`;

        set({
          players: updatedPlayers,
          courts: updatedCourts,
          notifications: compactNotifications([
            ...notifications,
            {
              id:
                crypto.randomUUID(),
              audience: "ADMIN",
              message,
              createdAt:
                new Date().toISOString(),
            },
            {
              id:
                crypto.randomUUID(),
              audience: "PLAYER",
              recipientId:
                incomingPlayer.id,
              message:
                `Court ${courtId} player replacement assigned.`,
              createdAt:
                new Date().toISOString(),
            },
            {
              id:
                crypto.randomUUID(),
              audience: "PLAYER",
              recipientId:
                outgoingPlayer.id,
              message:
                `Court ${courtId} player replacement completed.`,
              createdAt:
                new Date().toISOString(),
            },
          ], dismissedNotificationIds)
        });

        void syncActiveAttendanceStats(
          updatedPlayers.filter(
            (player) =>
              player.id ===
                outgoingPlayerId ||
              player.id ===
                incomingPlayerId
          )
        ).catch(console.error);
      },

        rerollRecommendations:
        (
          courtId,
          target = "GAME"
        ) => {
          const {
            players,
            queuedCourts,
            womenDoublesPriority,
            excludedMatchPairs,
          } = get();
          void target;
          const queuedPlayerIds =
            new Set(
              queuedCourts.flatMap(
                (court) =>
                  [
                    ...(court.teamA ?? []),
                    ...(court.teamB ?? []),
                  ].map(
                    (player) =>
                      player.id
                  )
              )
            );
          const candidatePlayers =
            players.filter(
              (player) =>
                !queuedPlayerIds.has(
                  player.id
                )
            );
        
          const recommendations =
            generateRecommendations(
              courtId,
              [...candidatePlayers].sort(
                () =>
                  Math.random() -
                  0.5
              ),
              get().courts.length,
              womenDoublesPriority,
              excludedMatchPairs
            );

          if (
            recommendations.length === 0
          ) {
            window.alert(
              "\uD604\uC7AC \uB300\uAE30\uC5F4\uC5D0\uC11C \uC0DD\uC131\uD560 \uC218 \uC788\uB294 \uB300\uC9C4\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC778\uC6D0, \uC131\uBCC4, \uACE0\uC815 \uD30C\uD2B8\uB108, \uBC30\uCE58 \uC81C\uC678 \uC124\uC815\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694."
            );
          }
        
          set({
            recommendations,
        
            selectedRecommendation:
              recommendations[0] ??
              null,
            recommendationTarget:
              target,
          });
        },

      selectRecommendation:
        (
          recommendationId
        ) => {
          const {
            recommendations,
          } = get();

          const selected =
            recommendations.find(
              (item) =>
                item.id ===
                recommendationId
            ) ?? null;

          set({
            selectedRecommendation:
              selected,
          });
        },

        approveRecommendation:
        (target) => {
          const {
            selectedRecommendation,
            recommendationTarget,
            courts,
            queuedCourts,
            players,
          } = get();
          const activeTarget =
            target ?? recommendationTarget;

          if (
            !selectedRecommendation
          ) {
            return;
          }

          const selectedIds =
            [
              ...selectedRecommendation.teamA,
              ...selectedRecommendation.teamB,
            ].map(
              (player) =>
                player.id
            );
          const targetCourt =
            (activeTarget === "QUEUE"
              ? queuedCourts
              : courts
            ).find(
              (court) =>
                court.id ===
                selectedRecommendation.courtId
            );
          const currentSelectedPlayers =
            selectedIds.map(
              (playerId) =>
                players.find(
                  (player) =>
                    player.id ===
                      playerId &&
                    player.status ===
                      "WAITING" &&
                    player.isPresent
                )
            );

          if (
            !targetCourt ||
            targetCourt.status ===
              "PLAYING" ||
            currentSelectedPlayers.some(
              (player) => !player
            )
          ) {
            set({
              recommendations: [],
              selectedRecommendation:
                null,
            });
            window.alert(
              "\uC120\uC218 \uC0C1\uD0DC\uAC00 \uBCC0\uACBD\uB418\uC5C8\uAC70\uB098 \uB300\uC0C1 \uCF54\uD2B8\uAC00 \uC774\uBBF8 \uC0AC\uC6A9 \uC911\uC785\uB2C8\uB2E4. \uD604\uC7AC \uB300\uAE30\uC5F4\uACFC \uCF54\uD2B8 \uC0C1\uD0DC\uB97C \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694."
            );
            return;
            window.alert(
              "선수 상태가 변경되었거나 대상 코트가 이미 사용 중입니다. 현재 대기열과 코트 상태를 다시 확인해 주세요."
            );
            return;
            window.alert(
              "???饔낅떽????????棺堉?뤃??????影?력??????????낇룇 ???????????????????????됰Ŧ鍮???戮?걫癲?????쎛 ????쇰뮛????棺堉?뤃???삳ħ??????????????놁졄. ??????살퓢?????熬곣뫖利??????鰲????轅붽틓?????"
            );
            return;
          }

          const startedAt =
            new Date();
          const currentPlayerById =
            new Map(
              currentSelectedPlayers.map(
                (player) => [
                  player!.id,
                  player!,
                ]
              )
            );
          const teamA =
            selectedRecommendation.teamA.map(
              (player) =>
                currentPlayerById.get(
                  player.id
                )!
            ) as [Player, Player];
          const teamB =
            selectedRecommendation.teamB.map(
              (player) =>
                currentPlayerById.get(
                  player.id
                )!
            ) as [Player, Player];

          const updatedPlayers =
            players.map(
              (player) => {
                if (activeTarget === "QUEUE") {
                  return player;
                }

                if (
                  !selectedIds.includes(
                    player.id
                  )
                ) {
                  return player;
                }

                return {
                  ...player,
                  status:
                    "PLAYING" as const,
                  matchCount:
                    player.matchCount +
                    1,
                  consecutiveMatches:
                    player.consecutiveMatches +
                    1,
                  playingStartedAt:
                    startedAt,
                  lastMatchAt:
                    startedAt,
                };
              }
            );

          const updatedCourt: Court =
            {
              id:
                selectedRecommendation.courtId,
              status:
                activeTarget === "QUEUE"
                  ? "QUEUED"
                  : "PLAYING",
              teamA:
                teamA,
              teamB:
                teamB,
              startedAt:
                activeTarget === "QUEUE"
                  ? null
                  : startedAt,
            };

          const teamAText =
            teamA
              .map(
                (player) =>
                  player.name
              )
              .join(" + ");

          const teamBText =
            teamB
              .map(
                (player) =>
                  player.name
              )
              .join(" + ");

          const displayAssignmentMessage =
            activeTarget === "QUEUE"
              ? `\ub300\uae30 \ucf54\ud2b8 ${selectedRecommendation.courtId} \ub300\uc9c4 \uc0dd\uc131: ${teamAText} vs ${teamBText}`
              : `Court ${selectedRecommendation.courtId} \ub300\uc9c4 \uc0dd\uc131: ${teamAText} vs ${teamBText}`;

          const assignedNotifications =
            teamA
              .concat(
                teamB
              )
              .flatMap((player) => [
                {
                  id:
                    crypto.randomUUID(),
                  audience:
                    "PLAYER" as const,
                  recipientId:
                    player.id,
                  message:
                    displayAssignmentMessage,
                  createdAt:
                    startedAt.toISOString(),
                },
              ]);

        set({
          players:
            updatedPlayers,
            courts:
              activeTarget === "GAME"
                ? courts.map(
                    (court) =>
                      court.id ===
                      selectedRecommendation.courtId
                        ? updatedCourt
                        : court
                  )
                : courts,
            queuedCourts:
              activeTarget === "QUEUE"
                ? queuedCourts.map(
                    (court) =>
                      court.id ===
                      selectedRecommendation.courtId
                        ? updatedCourt
                        : court
                  )
                : queuedCourts,
            recommendations:
              [],
            selectedRecommendation:
              null,
            notifications: compactNotifications([
              ...get().notifications,
              {
                id:
                  crypto.randomUUID(),
                audience: "ADMIN",
                message:
                  displayAssignmentMessage,
                createdAt:
                  startedAt.toISOString(),
              },
                ...(activeTarget === "GAME"
                ? assignedNotifications
                : []),
          ], get().dismissedNotificationIds),
        });

          if (activeTarget === "GAME") {
            void syncActiveAttendanceStats(
              updatedPlayers.filter(
                (player) =>
                  selectedIds.includes(
                    player.id
                  )
              )
            ).catch(console.error);
          }
      },

      assignManualMatch: (
        courtId,
        teamAPlayerIds,
        teamBPlayerIds,
        target = "GAME"
      ) => {
        const {
          courts,
          queuedCourts,
          players,
          excludedMatchPairs,
        } = get();
        const selectedIds = [
          ...teamAPlayerIds,
          ...teamBPlayerIds,
        ];
        const selectedIdSet =
          new Set(selectedIds);
        const hasExcludedPair =
          excludedMatchPairs.some(
            ([
              playerAId,
              playerBId,
            ]) =>
              selectedIdSet.has(
                playerAId
              ) &&
              selectedIdSet.has(
                playerBId
              )
          );

        if (
          selectedIdSet.size !== 4 ||
          hasExcludedPair
        ) {
          return false;
        }

        const courtList =
          target === "QUEUE"
            ? queuedCourts
            : courts;
        const court =
          courtList.find(
            (item) =>
              item.id === courtId
          );
        const selectedPlayers =
          selectedIds.map(
            (playerId) =>
              players.find(
                (player) =>
                  player.id ===
                    playerId &&
                  player.status ===
                    "WAITING" &&
                  player.isPresent
              )
          );

        if (
          !court ||
          court.status === "PLAYING" ||
          selectedPlayers.some(
            (player) => !player
          )
        ) {
          return false;
        }

        const playerById =
          new Map(
            selectedPlayers.map(
              (player) => [
                player!.id,
                player!,
              ]
            )
          );
        const teamA = [
          playerById.get(
            teamAPlayerIds[0]
          )!,
          playerById.get(
            teamAPlayerIds[1]
          )!,
        ] as [Player, Player];
        const teamB = [
          playerById.get(
            teamBPlayerIds[0]
          )!,
          playerById.get(
            teamBPlayerIds[1]
          )!,
        ] as [Player, Player];
        const startedAt =
          new Date();
        const teamAText = teamA
          .map((player) => player.name)
          .join(" + ");
        const teamBText = teamB
          .map((player) => player.name)
          .join(" + ");
        const assignmentMessage =
          target === "QUEUE"
            ? `\ub300\uae30 \ucf54\ud2b8 ${courtId} \uc218\ub3d9 \ub300\uc9c4 \uc0dd\uc131: ${teamAText} vs ${teamBText}`
            : `Court ${courtId} \uc218\ub3d9 \ub300\uc9c4 \uc0dd\uc131: ${teamAText} vs ${teamBText}`;
        const updatedCourt: Court = {
          ...court,
          status:
            target === "QUEUE"
              ? "QUEUED"
              : "PLAYING",
          teamA,
          teamB,
          startedAt:
            target === "QUEUE"
              ? null
              : startedAt,
        };
        const playerNotifications =
          target === "GAME"
            ? selectedPlayers.map(
                (player) => ({
                  id:
                    crypto.randomUUID(),
                  audience:
                    "PLAYER" as const,
                  recipientId:
                    player!.id,
                  message:
                    assignmentMessage,
                  createdAt:
                    startedAt.toISOString(),
                })
              )
            : [];

        set({
          players:
            target === "GAME"
              ? players.map(
                  (player) =>
                    selectedIds.includes(
                      player.id
                    )
                      ? {
                          ...player,
                          status:
                            "PLAYING" as const,
                          matchCount:
                            player.matchCount +
                            1,
                          consecutiveMatches:
                            player.consecutiveMatches +
                            1,
                          playingStartedAt:
                            startedAt,
                          lastMatchAt:
                            startedAt,
                        }
                      : player
                )
              : players,
          courts:
            target === "GAME"
              ? courts.map((item) =>
                  item.id === courtId
                    ? updatedCourt
                    : item
                )
              : courts,
          queuedCourts:
            target === "QUEUE"
              ? queuedCourts.map((item) =>
                  item.id === courtId
                    ? updatedCourt
                    : item
                )
              : queuedCourts,
          notifications: compactNotifications(
            [
              ...get().notifications,
              {
                id:
                  crypto.randomUUID(),
                audience:
                  "ADMIN" as const,
                message:
                  assignmentMessage,
                createdAt:
                  startedAt.toISOString(),
              },
              ...playerNotifications,
            ],
            get().dismissedNotificationIds
          ),
        });

        if (target === "GAME") {
          void syncActiveAttendanceStats(
            get().players.filter(
              (player) =>
                selectedIds.includes(
                  player.id
                )
            )
          ).catch(console.error);
        }

        return true;
      },

      swapCourtPlayers: (
        courtId,
        firstPlayerId,
        secondPlayerId
      ) => {
        if (
          !firstPlayerId ||
          !secondPlayerId ||
          firstPlayerId ===
            secondPlayerId
        ) {
          return false;
        }

        const {
          courts,
        } = get();
        const court =
          courts.find(
            (item) =>
              item.id === courtId
          );

        if (
          !court?.teamA ||
          !court.teamB
        ) {
          return false;
        }

        const assigned = [
          ...court.teamA,
          ...court.teamB,
        ];

        if (
          !assigned.some(
            (player) =>
              player.id ===
              firstPlayerId
          ) ||
          !assigned.some(
            (player) =>
              player.id ===
              secondPlayerId
          )
        ) {
          return false;
        }

        const swapPlayer = (
          player: Player
        ) =>
          player.id ===
          firstPlayerId
            ? assigned.find(
                (item) =>
                  item.id ===
                  secondPlayerId
              )!
            : player.id ===
                secondPlayerId
              ? assigned.find(
                  (item) =>
                    item.id ===
                    firstPlayerId
                )!
              : player;

        set({
          courts:
            courts.map(
              (item) =>
                item.id === courtId &&
                item.teamA &&
                item.teamB
                  ? {
                      ...item,
                      teamA:
                        item.teamA.map(
                          swapPlayer
                        ) as [
                          Player,
                          Player,
                        ],
                      teamB:
                        item.teamB.map(
                          swapPlayer
                        ) as [
                          Player,
                          Player,
                        ],
                    }
                  : item
            ),
        });

        return true;
      },
      }),
      {
        name:
          "step-up-match-storage",
        version: 10,
        partialize: (state) => ({
          ...state,
          recommendations: [],
          selectedRecommendation:
            null,
        }),
        migrate: (
          persistedState,
          version
        ) => {
          const state =
            normalizePersistedMatchState(
              persistedState
            ) as unknown as MatchStore;

          if (version < 5) {
            window.sessionStorage.removeItem(
              "step-up-match-test-snapshot"
            );

            return {
              ...state,
              players: [],
              courts: [],
              notifications: [],
              matchHistory: [],
              recommendations: [],
              selectedRecommendation:
                null,
              womenDoublesPriority:
                false,
              fixedPartnerRequests:
                state.fixedPartnerRequests ??
                [],
              fixedPartnerAssignments:
                state.fixedPartnerAssignments ??
                [],
              fixedPartnerRequestResolutions:
                state.fixedPartnerRequestResolutions ??
                [],
              excludedMatchPairs:
                state.excludedMatchPairs ??
                [],
            };
          }

          if (version < 6) {
            return {
              ...state,
              recommendations: [],
              selectedRecommendation:
                null,
              fixedPartnerAssignments:
                state.fixedPartnerAssignments ??
                [],
              fixedPartnerRequestResolutions:
                state.fixedPartnerRequestResolutions ??
                [],
            };
          }

          if (version < 7) {
            return {
              ...state,
              fixedPartnerAssignments:
                state.fixedPartnerAssignments ??
                [],
              fixedPartnerRequestResolutions:
                state.fixedPartnerRequestResolutions ??
                [],
            };
          }

          if (version < 8) {
            return {
              ...state,
              fixedPartnerAssignments:
                state.fixedPartnerAssignments ??
                [],
              fixedPartnerRequestResolutions:
                state.fixedPartnerRequestResolutions ??
                [],
            };
          }

          if (version < 10) {
            return {
              ...state,
              queuedCourts:
                ensureDefaultQueuedCourts(
                  state.queuedCourts ?? []
                ),
              notifications:
                compactNotifications(
                  state.notifications ?? [],
                  state.dismissedNotificationIds ?? []
                ),
            };
          }

          return normalizePersistedMatchState(
            state
          );
        },
        merge: (
          persistedState,
          currentState
        ) => ({
          ...currentState,
          ...normalizePersistedMatchState(
            persistedState
          ),
        }),
      }
    )
  );
