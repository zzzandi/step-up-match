import { useEffect, useState } from "react";

import type { Player } from "@/types/player";

import {
  useMatchStore,
} from "@/store/useMatchStore";

import {
  getRestMinutes,
} from "@/utils/time";

interface WaitingListProps {
  players: Player[];
}

export default function WaitingList({
  players,
}: WaitingListProps) {
  const allPlayers =
    useMatchStore(
      (state) =>
        state.players
    );

  const setPlayers =
    useMatchStore(
      (state) =>
        state.setPlayers
    );

  const [, forceUpdate] =
    useState(0);

  useEffect(() => {
    const timer =
      setInterval(() => {
        forceUpdate(
          (prev) =>
            prev + 1
        );
      }, 1000);

    return () =>
      clearInterval(timer);
  }, []);

  const handleLeave =
    (
      playerId: string
    ) => {
      const updated =
        allPlayers.map(
          (player) => {
            if (
              player.id !==
              playerId
            ) {
              return player;
            }

            return {
              ...player,

              status:
                "LEFT",

              isPresent:
                false,
            };
          }
        );

      setPlayers(
        updated
      );
    };

  const sortedPlayers =
    [...players].sort(
      (a, b) =>
        getRestMinutes(
          b.waitingStartedAt
        ) -
        getRestMinutes(
          a.waitingStartedAt
        )
    );

  return (
    <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">
          대기자
        </h2>

        <div className="text-sm text-slate-400">
          휴식시간 순
        </div>
      </div>

      <div className="space-y-3">
        {sortedPlayers.map(
          (
            player,
            index
          ) => (
            <div
              key={
                player.id
              }
              className="
                flex
                items-center
                justify-between
                rounded-2xl
                bg-slate-800
                px-4
                py-3
              "
            >
              <div className="flex items-center gap-3">
                <div
                  className="
                    w-8
                    h-8
                    rounded-full
                    bg-slate-700
                    flex
                    items-center
                    justify-center
                    text-sm
                    font-bold
                  "
                >
                  {index + 1}
                </div>

                <div>
                  <div className="font-medium">
                    {player.name}
                  </div>

                  <div className="text-xs text-slate-400">
                    {player.grade}
                    등급
                    {" · "}
                    경기{" "}
                    {
                      player.matchCount
                    }
                    회
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-lime-400 font-semibold text-lg">
                    {getRestMinutes(
                      player.waitingStartedAt
                    )}
                    분
                  </div>

                  <div className="text-xs text-slate-500">
                    휴식
                  </div>
                </div>

                <button
                  onClick={() =>
                    handleLeave(
                      player.id
                    )
                  }
                  className="
                    px-3
                    py-2
                    rounded-xl
                    bg-red-500
                    text-white
                    text-sm
                  "
                >
                  퇴장
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}