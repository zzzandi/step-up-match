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

export interface MatchStore {
  players: Player[];

  courts: Court[];

  fixedPartnerRequests:
    FixedPartnerRequest[];

  fixedPartnerAssignments:
    FixedPartnerAssignment[];

  fixedPartnerRequestResolutions:
    FixedPartnerRequestResolution[];

  notifications:
    AppNotification[];

  matchHistory: MatchHistory[];

  recommendations:
    MatchRecommendation[];

  selectedRecommendation:
    MatchRecommendation | null;

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

  removeCourt: (
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
    ]
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
    courtId: number
  ) => void;

  approveRecommendation: () => void;

  clearRecommendation: () => void;
}

export const useMatchStore =
  create<MatchStore>()(
    persist(
      (set, get) => ({
      players: [],

      courts: [],

      fixedPartnerRequests: [],

      fixedPartnerAssignments: [],

      fixedPartnerRequestResolutions:
        [],

      notifications: [],

      matchHistory: [],

      recommendations: [],

      selectedRecommendation:
        null,

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
              message: `${resolvedRequesterName}님이 ${resolvedPartnerName}님에게 고정 파트너를 신청했습니다.`,
              createdAt:
                new Date().toISOString(),
            },
            {
              id:
                crypto.randomUUID(),
              audience: "PLAYER",
              recipientId: partnerId,
              message: `${resolvedRequesterName}님이 고정 파트너를 신청했습니다.`,
              createdAt:
                new Date().toISOString(),
            },
          ],
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
                message: `${request.partnerName}님과의 고정 파트너 신청이 승인되었습니다.`,
                createdAt:
                  new Date().toISOString(),
              },
              {
                id:
                  crypto.randomUUID(),
                audience: "PLAYER",
                recipientId:
                  request.partnerId,
                message: `${request.requesterName}님과의 고정 파트너 신청이 승인되었습니다.`,
                createdAt:
                  new Date().toISOString(),
              },
            ],
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
                    message: `${request.partnerName}님과의 고정 파트너 신청이 거절되었습니다.`,
                    createdAt:
                      new Date().toISOString(),
                  },
                  {
                    id:
                      crypto.randomUUID(),
                    audience: "PLAYER",
                    recipientId:
                      request.partnerId,
                    message: `${request.requesterName}님과의 고정 파트너 신청이 거절되었습니다.`,
                    createdAt:
                      new Date().toISOString(),
                  },
                ]
              : get().notifications,
          });
        },

      addNotification:
        (notification) => {
          const {
            notifications,
          } = get();

          set({
            notifications: [
              ...notifications,
              {
                ...notification,
                id:
                  crypto.randomUUID(),
                createdAt:
                  new Date().toISOString(),
              },
            ],
          });
        },

      dismissNotification:
        (notificationId) => {
          const {
            notifications,
          } = get();

          set({
            notifications:
              notifications.filter(
                (notification) =>
                  notification.id !==
                  notificationId
              ),
          });
        },

      dismissNotifications:
        (notificationIds) => {
          const {
            notifications,
          } = get();
          const targetIds =
            new Set(
              notificationIds
            );

          set({
            notifications:
              notifications.filter(
                (notification) =>
                  !targetIds.has(
                    notification.id
                  )
              ),
          });
        },

      endTodaySession: () => {
        set({
          players: [],
          courts: [],
          fixedPartnerRequests:
            [],
          notifications: [],
          recommendations: [],
          selectedRecommendation:
            null,
          womenDoublesPriority:
            false,
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
        const targetDate =
          workoutDate ??
          new Intl.DateTimeFormat(
            "en-CA",
            {
              timeZone:
                "Asia/Seoul",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }
          ).format(new Date());

        set({
          players: [],
          courts: [],
          fixedPartnerRequests: [],
          notifications: [],
          matchHistory:
            get().matchHistory.filter(
              (history) =>
                new Intl.DateTimeFormat(
                  "en-CA",
                  {
                    timeZone:
                      "Asia/Seoul",
                    year:
                      "numeric",
                    month:
                      "2-digit",
                    day: "2-digit",
                  }
                ).format(
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
            "경기 중인 코트는 삭제할 수 없습니다."
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

      clearRecommendation:
        () =>
          set({
            recommendations:
              [],
            selectedRecommendation:
              null,
          }),

      finishCourtMatch: (
        courtId
      ) => {
        const {
          players,
          courts,
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
                      ...new Set(
                        [
                          ...player.lastPartners,

                          ...partners
                            .filter(
                              (
                                p
                              ) =>
                                p.id !==
                                player.id
                            )
                            .map(
                              (
                                p
                              ) =>
                                p.id
                            ),
                        ]
                      ),
                    ].slice(
                      -3
                    ),

                  lastOpponents:
                    [
                      ...new Set(
                        [
                          ...player.lastOpponents,

                          ...opponents.map(
                            (
                              p
                            ) =>
                              p.id
                          ),
                        ]
                      ),
                    ].slice(
                      -6
                    ),
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
                    ? {
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
            "서로 같은 경기에 배치하지 않도록 설정된 선수가 있어 교체할 수 없습니다."
          );
          return;
        }

        const priorityWaitingAt =
          new Date(
            Date.now() -
              60 * 60 * 1000
          );

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
                    priorityWaitingAt,
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
                  waitingStartedAt:
                    undefined,
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
          `Court ${courtId} 교체: ${outgoingPlayer.name}님 대신 ${incomingPlayer.name}님이 배정되었습니다. ${teamAText} vs ${teamBText}`;

        set({
          players: updatedPlayers,
          courts: updatedCourts,
          notifications: [
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
                `Court ${courtId}에 교체 배정되었습니다.`,
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
                `Court ${courtId} 배정에서 빠졌습니다. 다음 대진에 우선 배정됩니다.`,
              createdAt:
                new Date().toISOString(),
            },
          ],
        });
      },

        rerollRecommendations:
        (
          courtId
        ) => {
          const {
            players,
            womenDoublesPriority,
            excludedMatchPairs,
          } = get();
        
          const recommendations =
            generateRecommendations(
              courtId,
              [...players].sort(
                () =>
                  Math.random() -
                  0.5
              ),
              get().courts.length,
              womenDoublesPriority,
              excludedMatchPairs
            );
        
          set({
            recommendations,
        
            selectedRecommendation:
              recommendations[0] ??
              null,
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
        () => {
          const {
            selectedRecommendation,
            courts,
            players,
          } = get();

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
            courts.find(
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
            targetCourt.status !==
              "EMPTY" ||
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
              "대진을 검토하는 동안 선수 또는 코트 상태가 변경되었습니다. 다시 생성해주세요."
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
                  waitingStartedAt:
                    undefined,
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
                "PLAYING",
              teamA:
                teamA,
              teamB:
                teamB,
              startedAt:
                startedAt,
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

          const assignmentMessage =
            `Court ${selectedRecommendation.courtId}에 배정되었습니다. ${teamAText} vs ${teamBText}`;

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
                    assignmentMessage,
                  createdAt:
                    startedAt.toISOString(),
                },
              ]);

        set({
          players:
            updatedPlayers,
            courts:
              courts.map(
                (court) =>
                  court.id ===
                  selectedRecommendation.courtId
                    ? updatedCourt
                    : court
              ),
            recommendations:
              [],
            selectedRecommendation:
              null,
            notifications: [
              ...get().notifications,
              {
                id:
                  crypto.randomUUID(),
                audience: "ADMIN",
                message:
                  assignmentMessage,
                createdAt:
                  startedAt.toISOString(),
              },
              ...assignedNotifications,
          ],
        });
      },

      assignManualMatch: (
        courtId,
        teamAPlayerIds,
        teamBPlayerIds
      ) => {
        const {
          courts,
          players,
        } = get();
        const selectedIds = [
          ...teamAPlayerIds,
          ...teamBPlayerIds,
        ];
        const selectedIdSet =
          new Set(selectedIds);
        const hasExcludedPair =
          get().excludedMatchPairs.some(
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
          new Set(selectedIds)
            .size !== 4 ||
          hasExcludedPair
        ) {
          return false;
        }

        const court =
          courts.find(
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
          court.status !== "EMPTY" ||
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
        const assignmentMessage =
          `Court ${courtId}에 수동 배정되었습니다. ${teamA
            .map((player) => player.name)
            .join(" + ")} vs ${teamB
            .map((player) => player.name)
            .join(" + ")}`;

        set({
          players:
            players.map(
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
                      waitingStartedAt:
                        undefined,
                      lastMatchAt:
                        startedAt,
                    }
                  : player
            ),
          courts:
            courts.map(
              (item) =>
                item.id === courtId
                  ? {
                      ...item,
                      status:
                        "PLAYING" as const,
                      teamA,
                      teamB,
                      startedAt,
                    }
                  : item
            ),
          notifications: [
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
            ...selectedPlayers.map(
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
            ),
          ],
        });

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
        version: 9,
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
