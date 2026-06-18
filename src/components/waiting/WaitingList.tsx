import {
  useEffect,
  useState,
} from "react";

import type { Player } from "@/types/player";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import {
  getRestMinutes,
} from "@/utils/time";
import {
  publishLiveSessionEvent,
} from "@/services/liveSessionService";

interface WaitingListProps {
  players: Player[];
  readOnly?: boolean;
  leaveablePlayerIds?: string[];
  onLeave?: (player: Player) => void;
}

export default function WaitingList({
  players,
  readOnly = false,
  leaveablePlayerIds = [],
  onLeave,
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
      targetPlayer: Player
    ) => {
      const confirmed =
        window.confirm(
          `${targetPlayer.name}님을 퇴장 처리하시겠습니까?`
        );

      if (!confirmed) {
        return;
      }

      const updated =
        allPlayers.map(
          (player) => {
            if (
              player.id !==
              targetPlayer.id
            ) {
              return player;
            }

            return {
              ...player,
              status: "LEFT" as const,
              isPresent: false,
            };
          }
        );

      setPlayers(
        updated
      );

      publishLiveSessionEvent({
        type: "FORCE_LOGOUT",
        userId: targetPlayer.id,
        reason: "LEFT",
      });

      onLeave?.(
        targetPlayer
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
              key={player.id}
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
                    {player.matchCount}
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

                {(!readOnly ||
                  leaveablePlayerIds.includes(
                    player.id
                  )) && (
                  <button
                    onClick={() =>
                      handleLeave(
                        player
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
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
