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

interface MatchStore {
  players: Player[];

  courts: Court[];

  matchHistory: MatchHistory[];

  recommendations:
    MatchRecommendation[];

  selectedRecommendation:
    MatchRecommendation | null;

  setPlayers: (
    players: Player[]
  ) => void;

  setCourts: (
    courts: Court[]
  ) => void;

  setFixedPartner: (
    playerAId: string,
    playerBId: string
  ) => void;

  addCourt: () => void;

  removeCourt: (
    courtId: number
  ) => void;

  finishCourtMatch: (
    courtId: number
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

      matchHistory: [],

      recommendations: [],

      selectedRecommendation:
        null,

      setPlayers: (
        players
      ) =>
        set({
          players,
        }),

      setCourts: (
        courts
      ) =>
        set({
          courts,
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

              return player;
            }
          );

        set({
          players: updated,
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

        rerollRecommendations:
        (
          courtId
        ) => {
          const {
            players,
          } = get();
        
          const recommendations =
            generateRecommendations(
              courtId,
              [...players].sort(
                () =>
                  Math.random() -
                  0.5
              ),
              get().courts.length
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
          });
        },
      }),
      {
        name:
          "step-up-match-storage",
      }
    )
  );