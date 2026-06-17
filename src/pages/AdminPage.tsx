import { useEffect, useState } from "react";

import {
    getTodayAttendanceList,
  } from "@/services/attendanceService";
import CourtCard from "@/components/court/CourtCard";
import WaitingList from "@/components/waiting/WaitingList";
import MatchRecommendModal from "@/components/match/MatchRecommendModal";
import AddPlayerModal from "@/components/player/AddPlayerModal";
import FixedPartnerModal from "@/components/player/FixedPartnerModal";
import MatchHistoryPanel from "@/components/history/MatchHistoryPanel";

import type { Player } from "@/types/player";

import { useMatchStore } from "@/store/useMatchStore";

export default function AdminPage() {
  const [isAddModalOpen, setIsAddModalOpen] =
    useState(false);

  const [
    isFixedPartnerOpen,
    setIsFixedPartnerOpen,
  ] = useState(false);

  const [
    attendanceList,
    setAttendanceList,
  ] = useState<any[]>([]);

  const players =
    useMatchStore(
      (state) => state.players
    );

console.log(
    "PLAYERS",
    players.length
  );

  const courts =
    useMatchStore(
      (state) => state.courts
    );

  const setPlayers =
    useMatchStore(
      (state) => state.setPlayers
    );

  const setCourts =
    useMatchStore(
      (state) => state.setCourts
    );

  const setFixedPartner =
    useMatchStore(
      (state) =>
        state.setFixedPartner
    );

  const addCourt =
    useMatchStore(
      (state) =>
        state.addCourt
    );

  const removeCourt =
    useMatchStore(
      (state) =>
        state.removeCourt
    );

    const refreshAttendance =
  async () => {
    try {
      const data =
        await getTodayAttendanceList();

      console.log(
        "갱신 데이터",
        data
      );

      setAttendanceList(data);
    } catch (error) {
      console.error(error);
    }
  };

    useEffect(() => {
        getTodayAttendanceList()
          .then((data) => {
      
            setAttendanceList(data);
      
            if (players.length > 0) {

                const existingIds =
                  new Set(
                    players.map(
                      (player) => player.id
                    )
                  );
              
                const newPlayers =
                  data
                    .filter(
                      (attendance: any) =>
                        !existingIds.has(
                          attendance.users.id
                        )
                    )
                    .map(
                      (attendance: any) => ({
                        id:
                          attendance.users.id,
              
                        name:
                          attendance.users.name,
              
                        gender:
                          attendance.users.gender ??
                          "M",
              
                        grade:
                          attendance.users.grade,
              
                        hiddenSkill:
                          attendance.users.hidden_skill,
              
                        isPresent: true,
              
                        arrivalTime:
                          new Date(),
              
                        matchCount: 0,
              
                        consecutiveMatches: 0,
              
                        status: "WAITING",
              
                        waitingStartedAt:
                          new Date(),
              
                        lastPartners: [],
              
                        lastOpponents: [],
                      })
                    );
              
                if (newPlayers.length > 0) {
                  setPlayers([
                    ...players,
                    ...newPlayers,
                  ]);
                }
              
                return;
              }
      
            const playerList: Player[] =
  data.map((attendance: any) => ({
    id: attendance.users.id,
    name: attendance.users.name,
    gender:
      attendance.users.gender ??
      "M",
    grade:
      attendance.users.grade,
    hiddenSkill:
      attendance.users.hidden_skill,
    isPresent: true,
    arrivalTime:
      new Date(),
    matchCount: 0,
    consecutiveMatches: 0,
    status: "WAITING",
    waitingStartedAt:
      new Date(),
    lastPartners: [],
    lastOpponents: [],
  }));
      
            setPlayers(playerList);
      
            setCourts([
              {
                id: 1,
                status: "EMPTY",
                teamA: null,
                teamB: null,
                startedAt: null,
              },
              {
                id: 2,
                status: "EMPTY",
                teamA: null,
                teamB: null,
                startedAt: null,
              },
              {
                id: 3,
                status: "EMPTY",
                teamA: null,
                teamB: null,
                startedAt: null,
              },
            ]);
          })
          .catch(console.error);
      }, []);

  const waitingPlayers =
    players.filter(
      (player) =>
        player.status === "WAITING"
    );

  const playingPlayers =
    players.filter(
      (player) =>
        player.status === "PLAYING"
    );

  const handleAddPlayer = ({
    name,
    gender,
    grade,
  }: {
    name: string;
    gender: "M" | "F";
    grade:
      | "A"
      | "B"
      | "C"
      | "D"
      | "E"
      | "F";
  }) => {
    const skillMap = {
      A: 85,
      B: 75,
      C: 65,
      D: 55,
      E: 45,
      F: 35,
    };

    const newPlayer = {
      id: crypto.randomUUID(),

      name,

      gender,

      grade,

      hiddenSkill:
        skillMap[grade],

      isPresent: true,

      arrivalTime:
        new Date(),

      matchCount: 0,

      consecutiveMatches: 0,

      status: "WAITING" as const,

      waitingStartedAt:
        new Date(),

      lastPartners: [],

      lastOpponents: [],
    };

    setPlayers([
      ...players,
      newPlayer,
    ]);
  };

  const handleRemoveFixedPartner =
    (
      playerId: string,
      partnerId: string
    ) => {
      const updated =
        players.map(
          (player) => {
            if (
              player.id ===
                playerId ||
              player.id ===
                partnerId
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

      setPlayers(updated);
    };

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">
              STEP UP MATCH
            </h1>

            <p className="text-slate-400 mt-2">
              Admin Dashboard
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
          <button
  onClick={
    refreshAttendance
  }
  className="
    rounded-2xl
    bg-cyan-500
    px-6
    py-3
    font-bold
  "
>
  참가자 갱신
</button>


            <button
              onClick={addCourt}
              className="
                rounded-2xl
                bg-purple-500
                px-6
                py-3
                font-bold
              "
            >
              + 코트 추가
            </button>

            <button
              onClick={() => {
                const lastCourt =
                  courts[
                    courts.length -
                      1
                  ];

                if (
                  lastCourt
                ) {
                  removeCourt(
                    lastCourt.id
                  );
                }
              }}
              className="
                rounded-2xl
                bg-red-500
                px-6
                py-3
                font-bold
              "
            >
              - 코트 삭제
            </button>

            <button
              onClick={() =>
                setIsFixedPartnerOpen(
                  true
                )
              }
              className="
                rounded-2xl
                bg-blue-500
                px-6
                py-3
                font-bold
              "
            >
              고정 파트너
            </button>

            <button
              onClick={() =>
                setIsAddModalOpen(
                  true
                )
              }
              className="
                rounded-2xl
                bg-lime-400
                px-6
                py-3
                font-bold
                text-black
              "
            >
              참가자 추가
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
            <div className="text-slate-400 text-sm">
              참석자
            </div>

            <div className="text-3xl font-bold mt-2">
              {players.length}
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
            <div className="text-slate-400 text-sm">
              경기중
            </div>

            <div className="text-3xl font-bold mt-2">
              {playingPlayers.length}
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
            <div className="text-slate-400 text-sm">
              대기중
            </div>

            <div className="text-3xl font-bold mt-2">
              {waitingPlayers.length}
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
            <div className="text-slate-400 text-sm">
              코트 수
            </div>

            <div className="text-3xl font-bold mt-2">
              {courts.length}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {courts.map(
            (court) => (
              <CourtCard
                key={court.id}
                court={court}
              />
            )
          )}
        </div>

        <div className="mt-8 grid lg:grid-cols-2 gap-6">
          <WaitingList
            players={
              waitingPlayers
            }
          />

          <MatchHistoryPanel />
        </div>

        <div className="mt-8 rounded-3xl bg-slate-900 p-6 border border-slate-800">
  <h2 className="text-xl font-bold mb-4">
    오늘 참가자
  </h2>

  <div className="grid md:grid-cols-3 gap-3">
    {attendanceList.map(
      (attendance) => (
        <div
          key={
            attendance.id
          }
          className="
            rounded-xl
            bg-slate-800
            px-4
            py-3
          "
        >
          {attendance.users?.name ??
            attendance.user_id}
        </div>
      )
    )}
  </div>
</div>

        <div className="mt-8 rounded-3xl bg-slate-900 p-6 border border-slate-800">
          <h2 className="text-xl font-bold mb-4">
            고정 파트너 현황
          </h2>

          <div className="space-y-2">
            {players
              .filter(
                (player) =>
                  player.fixedPartner &&
                  player.id <
                    player.fixedPartner
              )
              .map(
                (player) => {
                  const partner =
                    players.find(
                      (p) =>
                        p.id ===
                        player.fixedPartner
                    );

                  if (!partner)
                    return null;

                  return (
                    <div
                      key={
                        player.id
                      }
                      className="
                        flex
                        items-center
                        justify-between
                        rounded-xl
                        bg-slate-800
                        px-4
                        py-3
                      "
                    >
                      <div>
                        {player.name}
                        {" ↔ "}
                        {
                          partner.name
                        }
                      </div>

                      <button
                        onClick={() =>
                          handleRemoveFixedPartner(
                            player.id,
                            partner.id
                          )
                        }
                        className="
                          px-3
                          py-1
                          rounded-lg
                          bg-red-500
                          text-sm
                        "
                      >
                        해제
                      </button>
                    </div>
                  );
                }
              )}
          </div>
        </div>
      </div>

      <MatchRecommendModal />

      <AddPlayerModal
        open={
          isAddModalOpen
        }
        onClose={() =>
          setIsAddModalOpen(
            false
          )
        }
        onAdd={
          handleAddPlayer
        }
      />

      <FixedPartnerModal
        open={
          isFixedPartnerOpen
        }
        players={players}
        onClose={() =>
          setIsFixedPartnerOpen(
            false
          )
        }
        onSave={(
          playerA,
          playerB
        ) =>
          setFixedPartner(
            playerA,
            playerB
          )
        }
      />
    </>
  );
}