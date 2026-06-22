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

interface MatchStore {
  players: Player[];

  courts: Court[];

  fixedPartnerRequests:
    FixedPartnerRequest[];

  notifications:
    AppNotification[];

  matchHistory: MatchHistory[];

  recommendations:
    MatchRecommendation[];

  selectedRecommendation:
    MatchRecommendation | null;

  womenDoublesPriority:
    boolean;

  setPlayers: (
    players: Player[]
  ) => void;

  setCourts: (
    courts: Court[]
  ) => void;

  setWomenDoublesPriority: (
    enabled: boolean
  ) => void;

  setFixedPartner: (
    playerAId: string,
    playerBId: string
  ) => void;

  requestFixedPartner: (
    requesterId: string,
    partnerId: string
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

      notifications: [],

      matchHistory: [],

      recommendations: [],

      selectedRecommendation:
        null,

      womenDoublesPriority:
        false,

      setPlayers: (
        players
      ) =>
        set({
          players:
            uniquePlayers(
              players
            ),
        }),

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

      setFixedPartner: (
        playerAId,
        playerBId
      ) => {
        const {
          players,
        } = get();

        const updated =
          players.map(
            (player) => {
              if (
                player.id ===
                playerAId
              ) {
                return {
                  ...player,
                  fixedPartner:
                    playerBId,
                };
              }

              if (
                player.id ===
                playerBId
              ) {
                return {
                  ...player,
                  fixedPartner:
                    playerAId,
                };
              }

              if (
                player.fixedPartner ===
                  playerAId ||
                player.fixedPartner ===
                  playerBId
              ) {
                return {
                  ...player,
                  fixedPartner:
                    undefined,
                };
              }

              return player;
            }
          );

        set({
          players: updated,
        });
      },

      requestFixedPartner: (
        requesterId,
        partnerId
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

        if (
          !requester ||
          !partner
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
                requester.name,
              partnerId,
              partnerName:
                partner.name,
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
              message: `${requester.name}님이 ${partner.name}님에게 고정 파트너를 신청했습니다.`,
              createdAt:
                new Date().toISOString(),
            },
            {
              id:
                crypto.randomUUID(),
              audience: "PLAYER",
              recipientId: partner.id,
              message: `${requester.name}님이 고정 파트너를 신청했습니다.`,
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
                    "WAITING",

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
              womenDoublesPriority
            );
        
          console.log(
            "RECOMMENDATIONS",
            recommendations
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
                    "PLAYING",
                  matchCount:
                    player.matchCount +
                    1,
                  consecutiveMatches:
                    player.consecutiveMatches +
                    1,
                  playingStartedAt:
                    new Date(),
                  waitingStartedAt:
                    undefined,
                  lastMatchAt:
                    new Date(),
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
                selectedRecommendation.teamA,
              teamB:
                selectedRecommendation.teamB,
              startedAt:
                new Date(),
            };

          const teamAText =
            selectedRecommendation.teamA
              .map(
                (player) =>
                  player.name
              )
              .join(" + ");

          const teamBText =
            selectedRecommendation.teamB
              .map(
                (player) =>
                  player.name
              )
              .join(" + ");

          const assignmentMessage =
            `Court ${selectedRecommendation.courtId}에 배정되었습니다. ${teamAText} vs ${teamBText}`;

          const assignedNotifications =
            selectedRecommendation.teamA
              .concat(
                selectedRecommendation.teamB
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
                    new Date().toISOString(),
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
                  new Date().toISOString(),
              },
              ...assignedNotifications,
            ],
          });
        },
      }),
      {
        name:
          "step-up-match-storage",
        version: 3,
        migrate: (
          persistedState,
          version
        ) => {
          const state =
            persistedState as MatchStore;

          if (version < 3) {
            return {
              ...state,
              players: [],
              courts: [],
              fixedPartnerRequests:
                [],
              notifications: [],
              matchHistory: [],
              recommendations: [],
              selectedRecommendation:
                null,
              womenDoublesPriority:
                false,
            };
          }

          return state;
        },
      }
    )
  );
