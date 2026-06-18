import {
  useEffect,
  useState,
} from "react";

import CourtCard from "@/components/court/CourtCard";
import MatchHistoryPanel from "@/components/history/MatchHistoryPanel";
import WaitingList from "@/components/waiting/WaitingList";
import {
  clearAccessSession,
  useAccessSession,
} from "@/auth/access";
import {
  getTodayAttendanceList,
} from "@/services/attendanceService";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import type { Player } from "@/types/player";
import {
  useNavigate,
} from "react-router-dom";
import {
  uniqueByUserId,
} from "@/utils/participants";

export default function PlayerPage() {
  const navigate =
    useNavigate();
  const session =
    useAccessSession();

  const [
    ,
    setAttendanceList,
  ] = useState<any[]>([]);
  const [
    selectedPartnerId,
    setSelectedPartnerId,
  ] = useState("");
  const [
    partnerRequestMessage,
    setPartnerRequestMessage,
  ] = useState("");

  const players =
    useMatchStore(
      (state) => state.players
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

  const fixedPartnerRequests =
    useMatchStore(
      (state) =>
        state.fixedPartnerRequests
    );

  const requestFixedPartner =
    useMatchStore(
      (state) =>
        state.requestFixedPartner
    );

  const notifications =
    useMatchStore(
      (state) =>
        state.notifications
    );

  const dismissNotification =
    useMatchStore(
      (state) =>
        state.dismissNotification
    );

  const dismissNotifications =
    useMatchStore(
      (state) =>
        state.dismissNotifications
    );

  useEffect(() => {
    getTodayAttendanceList()
      .then((data) => {
        const uniqueAttendance =
          uniqueByUserId(data);

        setAttendanceList(
          uniqueAttendance
        );

        if (players.length > 0) {
          const existingIds =
            new Set(
              players.map(
                (player) => player.id
              )
            );

          const newPlayers =
            uniqueAttendance
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
                  status: "WAITING" as const,
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
          uniqueAttendance.map(
            (attendance: any) => ({
              id: attendance.users.id,
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

        setPlayers(playerList);

        if (courts.length === 0) {
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
        }
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

  const currentPlayer =
    players.find(
      (player) =>
        player.id ===
        session?.userId
    );

  const partnerCandidates =
    players.filter(
      (player) =>
        player.id !==
          session?.userId &&
        player.status !== "LEFT"
    );

  const currentFixedPartner =
    currentPlayer?.fixedPartner
      ? players.find(
          (player) =>
            player.id ===
            currentPlayer.fixedPartner
        )
      : null;

  const pendingPartnerRequest =
    fixedPartnerRequests.find(
      (request) =>
        request.requesterId ===
          session?.userId ||
        request.partnerId ===
          session?.userId
    );

  const playerNotifications =
    notifications.filter(
      (notification) =>
        notification.audience ===
          "PLAYER" &&
        notification.recipientId ===
          session?.userId
    );

  function handlePartnerRequest() {
    if (!session?.userId) {
      setPartnerRequestMessage(
        "로그인 정보를 찾을 수 없습니다."
      );
      return;
    }

    if (!selectedPartnerId) {
      setPartnerRequestMessage(
        "파트너를 선택해주세요."
      );
      return;
    }

    requestFixedPartner(
      session.userId,
      selectedPartnerId
    );

    setSelectedPartnerId("");
    setPartnerRequestMessage(
      "고정 파트너 신청이 Admin에게 전달되었습니다."
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">
            STEP UP MATCH
          </h1>

          <p className="text-slate-400 mt-2">
            Player View
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-2 overflow-x-auto [&>div]:min-w-[76px] [&>div]:rounded-xl [&>div]:p-3 [&>div>div:last-child]:mt-1 [&>div>div:last-child]:text-2xl">
        <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
          <div className="text-slate-400 text-sm">
            참가자
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

      <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
        <span className="text-sm text-slate-400">
          현재 내 상태
        </span>
        <span className="rounded-lg bg-cyan-400/15 px-3 py-1 text-sm font-bold text-cyan-300">
          {currentPlayer?.status ===
          "PLAYING"
            ? "경기 중"
            : currentPlayer?.status ===
                "WAITING"
              ? "대기 중"
              : "운동 종료"}
        </span>
      </div>

      {playerNotifications.length > 0 && (
        <div className="mb-8 rounded-3xl bg-slate-900 p-6 border border-cyan-500/30">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              내 알림
            </h2>

            <button
              type="button"
              onClick={() =>
                dismissNotifications(
                  playerNotifications.map(
                    (notification) =>
                      notification.id
                  )
                )
              }
              className="
                rounded-lg
                bg-cyan-500
                px-3
                py-2
                text-sm
                font-bold
                text-slate-950
              "
            >
              전체 확인
            </button>
          </div>

          <div className="space-y-3">
            {playerNotifications.map(
              (notification) => (
                <div
                  key={notification.id}
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                    rounded-xl
                    bg-slate-800
                    px-4
                    py-3
                  "
                >
                  <div className="text-slate-200">
                    {notification.message}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      dismissNotification(
                        notification.id
                      )
                    }
                    className="
                      rounded-lg
                      bg-slate-700
                      px-3
                      py-1
                      text-sm
                    "
                  >
                    확인
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {courts.map(
          (court) => (
            <CourtCard
              key={court.id}
              court={court}
              readOnly
            />
          )
        )}
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-6">
        <WaitingList
          players={
            waitingPlayers
          }
          readOnly
          leaveablePlayerIds={
            session?.userId
              ? [session.userId]
              : []
          }
          onLeave={() => {
            clearAccessSession();
            navigate("/");
          }}
        />

        <MatchHistoryPanel />
      </div>

      <div className="mt-8 rounded-3xl bg-slate-900 p-6 border border-slate-800">
        <h2 className="text-xl font-bold mb-4">
          고정 파트너 신청
        </h2>

        {currentFixedPartner ? (
          <div className="rounded-xl bg-slate-800 px-4 py-3 text-slate-300">
            현재 고정 파트너는 {currentFixedPartner.name}님입니다.
          </div>
        ) : pendingPartnerRequest ? (
          <div className="rounded-xl bg-slate-800 px-4 py-3 text-slate-300">
            {pendingPartnerRequest.requesterName}
            {" ↔ "}
            {pendingPartnerRequest.partnerName}
            {" 신청 승인 대기 중"}
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block mb-2 text-slate-400">
                원하는 파트너
              </label>

              <select
                value={selectedPartnerId}
                onChange={(event) => {
                  setSelectedPartnerId(
                    event.target.value
                  );
                  setPartnerRequestMessage(
                    ""
                  );
                }}
                className="
                  w-full
                  rounded-xl
                  bg-slate-800
                  border
                  border-slate-700
                  px-4
                  py-3
                  text-white
                "
              >
                <option value="">
                  파트너를 선택하세요
                </option>

                {partnerCandidates.map(
                  (player) => (
                    <option
                      key={player.id}
                      value={player.id}
                    >
                      {player.name}
                    </option>
                  )
                )}
              </select>
            </div>

            {partnerRequestMessage && (
              <div className="mb-4 rounded-xl bg-slate-800 px-4 py-3 text-center text-slate-300">
                {partnerRequestMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handlePartnerRequest}
              className="
                w-full
                rounded-xl
                bg-cyan-500
                py-3
                font-bold
                text-slate-950
                hover:bg-cyan-400
              "
            >
              신청하기
            </button>
          </>
        )}
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
            .map((player) => {
              const partner =
                players.find(
                  (target) =>
                    target.id ===
                    player.fixedPartner
                );

              if (!partner) {
                return null;
              }

              return (
                <div
                  key={player.id}
                  className="
                    rounded-xl
                    bg-slate-800
                    px-4
                    py-3
                  "
                >
                  {player.name}
                  {" ↔ "}
                  {partner.name}
                </div>
              );
            })}
        </div>
      </div>

    </div>
  );
}
