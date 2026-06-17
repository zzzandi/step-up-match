import { useState } from "react";

import type { Player } from "@/types/player";

interface FixedPartnerModalProps {
  open: boolean;

  players: Player[];

  onClose: () => void;

  onSave: (
    playerA: string,
    playerB: string
  ) => void;
}

export default function FixedPartnerModal({
  open,
  players,
  onClose,
  onSave,
}: FixedPartnerModalProps) {
  const [playerA, setPlayerA] =
    useState("");

  const [playerB, setPlayerB] =
    useState("");

  if (!open) {
    return null;
  }

  return (
    <div
      className="
        fixed
        inset-0
        bg-black/70
        flex
        items-center
        justify-center
        z-50
      "
    >
      <div
        className="
          bg-slate-900
          rounded-3xl
          p-8
          w-[450px]
          text-white
        "
      >
        <h2 className="text-2xl font-bold mb-6">
          고정 파트너
        </h2>

        <div className="space-y-4">
          <select
            value={playerA}
            onChange={(e) =>
              setPlayerA(
                e.target.value
              )
            }
            className="
              w-full
              rounded-xl
              bg-slate-800
              px-4
              py-3
            "
          >
            <option value="">
              첫 번째 선수
            </option>

            {players.map(
              (player) => (
                <option
                  key={
                    player.id
                  }
                  value={
                    player.id
                  }
                >
                  {player.name}
                </option>
              )
            )}
          </select>

          <select
            value={playerB}
            onChange={(e) =>
              setPlayerB(
                e.target.value
              )
            }
            className="
              w-full
              rounded-xl
              bg-slate-800
              px-4
              py-3
            "
          >
            <option value="">
              두 번째 선수
            </option>

            {players.map(
              (player) => (
                <option
                  key={
                    player.id
                  }
                  value={
                    player.id
                  }
                >
                  {player.name}
                </option>
              )
            )}
          </select>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => {
              if (
                !playerA ||
                !playerB
              )
                return;

              onSave(
                playerA,
                playerB
              );

              onClose();
            }}
            className="
              flex-1
              bg-lime-400
              text-black
              rounded-xl
              py-3
              font-bold
            "
          >
            저장
          </button>

          <button
            onClick={
              onClose
            }
            className="
              flex-1
              bg-slate-700
              rounded-xl
              py-3
            "
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}