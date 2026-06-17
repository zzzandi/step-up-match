import { useEffect, useState } from "react";

import type { Court } from "@/types/court";

import {
  useMatchStore,
} from "@/store/useMatchStore";

function formatDuration(
  startedAt: Date | null
) {
  if (!startedAt) {
    return "00:00";
  }

  const seconds =
    Math.floor(
      (Date.now() -
        new Date(startedAt).getTime()) /
        1000
    );

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remainSeconds =
    seconds % 60;

  return `${minutes
    .toString()
    .padStart(2, "0")}:${remainSeconds
    .toString()
    .padStart(2, "0")}`;
}

interface CourtCardProps {
  court: Court;
}

export default function CourtCard({
  court,
}: CourtCardProps) {

  

  const finishCourtMatch =
    useMatchStore(
      (state) =>
        state.finishCourtMatch
    );

  const rerollRecommendations =
    useMatchStore(
      (state) =>
        state.rerollRecommendations
    );

  const [duration, setDuration] =
    useState(
      formatDuration(
        court.startedAt
      )
    );

  useEffect(() => {
    const timer =
      setInterval(() => {
        setDuration(
          formatDuration(
            court.startedAt
          )
        );
      }, 1000);

    return () =>
      clearInterval(timer);
  }, [court.startedAt]);

  if (
    !court.teamA ||
    !court.teamB
  ) {
    return (
      <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800">
        <div className="flex justify-between mb-4">
          <h2 className="font-bold text-xl">
            Court {court.id}
          </h2>

          <span className="text-xs px-3 py-1 rounded-full bg-slate-700 text-slate-300">
            EMPTY
          </span>
        </div>

        <div className="mt-6 text-slate-500">
          비어있음
        </div>

        <button
          onClick={() =>
            rerollRecommendations(
              court.id
            )
          }
          className="
            mt-6
            w-full
            rounded-xl
            bg-blue-500
            py-3
            font-bold
            text-white
          "
        >
          대진 생성
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800">
      <div className="flex justify-between mb-4">
        <h2 className="font-bold text-xl">
          Court {court.id}
        </h2>

        <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
          PLAYING
        </span>
      </div>

      <div className="mb-4 text-center">
        <div className="text-slate-400 text-sm">
          경기시간
        </div>

        <div className="text-xl font-bold text-lime-400">
          {duration}
        </div>
      </div>

      <div className="text-center space-y-4">
        <div>
          {court.teamA[0].name}
          <br />
          {court.teamA[1].name}
        </div>

        <div className="text-slate-400">
          VS
        </div>

        <div>
          {court.teamB[0].name}
          <br />
          {court.teamB[1].name}
        </div>
      </div>

      <button
        onClick={() => {
            const confirmed =
              window.confirm(
                "정말 경기를 종료하시겠습니까?"
              );
          
            if (!confirmed) {
              return;
            }
          
            finishCourtMatch(
              court.id
            );
          }}
        className="
          mt-6
          w-full
          rounded-xl
          bg-lime-400
          py-3
          text-black
          font-bold
        "
      >
        경기 종료
      </button>
    </div>
  );
}