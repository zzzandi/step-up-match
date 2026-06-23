import { useEffect, useState } from "react";

import {
  getAttendanceListByDate,
    getActiveWorkoutAttendanceList,
  } from "@/services/attendanceService";
import CourtCard from "@/components/court/CourtCard";
import WaitingList from "@/components/waiting/WaitingList";
import PreWorkoutQueueGate from "@/components/waiting/PreWorkoutQueueGate";
import MatchRecommendModal from "@/components/match/MatchRecommendModal";
import AddPlayerModal from "@/components/player/AddPlayerModal";
import MasterAddParticipantModal from "@/components/player/MasterAddParticipantModal";
import MasterManagementPanel from "@/components/player/MasterManagementPanel";
import FixedPartnerModal from "@/components/player/FixedPartnerModal";
import MatchHistoryPanel from "@/components/history/MatchHistoryPanel";
import {
  adminNames,
  masterNames,
  useAccessSession,
} from "@/auth/access";

import type { Player } from "@/types/player";

import { useMatchStore } from "@/store/useMatchStore";
import {
  uniqueByUserId,
} from "@/utils/participants";
import {
  getKstDateKey,
  isWorkoutOpen,
  openWorkout,
  resetTodayWorkoutData as resetTodayWorkoutDataInDatabase,
} from "@/services/workoutSessionService";
import {
  publishLiveSessionEvent,
} from "@/services/liveSessionService";
import {
  activateAllPendingCheckIns,
  createGuestUser,
  ensureTodayCheckIn,
  getOrCreateUser,
  getUsers,
  clearFixedPartner,
  saveFixedPartner,
} from "@/services/supabaseUserService";
import {
  getTestRosterDate,
  setTestAttendanceDates,
  setTestRosterDate as saveTestRosterDate,
  setTestWorkoutDate,
  setTestWorkoutOpen,
  useTestMode,
} from "@/services/testModeService";

interface TestAttendanceUser {
  id: string;
  name: string;
  gender?: "M" | "F" | null;
  grade?: Player["grade"] | null;
  hidden_skill?: number | null;
  fixed_partner_id?: string | null;
}

interface TestAttendanceRow {
  users:
    | TestAttendanceUser
    | TestAttendanceUser[]
    | null;
}

export default function AdminPage() {
  const session =
    useAccessSession();
  const testMode =
    useTestMode();
  const isMaster =
    session?.role === "MASTER";
  const isReadOnly =
    !testMode.active &&
    !isMaster &&
    session?.participationMode ===
    "VIEWER";
  const [
    workoutDate,
    setWorkoutDate,
  ] = useState(
    getKstDateKey
  );
  const [
    workoutOpen,
    setWorkoutOpen,
  ] = useState(false);
  const [
    workoutStatusLoading,
    setWorkoutStatusLoading,
  ] = useState(true);
  const [
    openingWorkout,
    setOpeningWorkout,
  ] = useState(false);
  const [
    testRosterDate,
    setTestRosterDateState,
  ] = useState(
    () =>
      getTestRosterDate() ||
      getKstDateKey()
  );
  const [
    importingTestRoster,
    setImportingTestRoster,
  ] = useState(false);
  const [
    testRosterMessage,
    setTestRosterMessage,
  ] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] =
    useState(false);
  const [
    isMasterParticipantModalOpen,
    setIsMasterParticipantModalOpen,
  ] = useState(false);
  const [
    isMemberModalOpen,
    setIsMemberModalOpen,
  ] = useState(false);

  const [
    isFixedPartnerOpen,
    setIsFixedPartnerOpen,
  ] = useState(false);

  const [
    ,
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

  const womenDoublesPriority =
    useMatchStore(
      (state) =>
        state.womenDoublesPriority
    );

  const setWomenDoublesPriority =
    useMatchStore(
      (state) =>
        state.setWomenDoublesPriority
    );

  const setFixedPartner =
    useMatchStore(
      (state) =>
        state.setFixedPartner
    );
  const removeFixedPartner =
    useMatchStore(
      (state) =>
        state.removeFixedPartner
    );

  const fixedPartnerRequests =
    useMatchStore(
      (state) =>
        state.fixedPartnerRequests
    );

  const approveFixedPartnerRequest =
    useMatchStore(
      (state) =>
        state.approveFixedPartnerRequest
    );

  const rejectFixedPartnerRequest =
    useMatchStore(
      (state) =>
        state.rejectFixedPartnerRequest
    );

  const notifications =
    useMatchStore(
      (state) =>
        state.notifications
    );

  const addNotification =
    useMatchStore(
      (state) =>
        state.addNotification
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

  const resetTodayWorkoutData =
    useMatchStore(
      (state) =>
        state.resetTodayWorkoutData
    );

  useEffect(() => {
    if (testMode.active) {
      setWorkoutOpen(
        testMode.workoutOpen
      );
      setWorkoutStatusLoading(
        false
      );
      return;
    }

    let cancelled = false;

    async function refreshStatus() {
      try {
        const open =
          await isWorkoutOpen(
            workoutDate
          );

        if (!cancelled) {
          setWorkoutOpen(open);
          if (!open) {
            setAttendanceList([]);
            useMatchStore
              .getState()
              .endTodaySession();
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setWorkoutStatusLoading(
            false
          );
        }
      }
    }

    void refreshStatus();
    const timer =
      window.setInterval(
        refreshStatus,
        5000
      );

    return () => {
      cancelled = true;
      window.clearInterval(
        timer
      );
    };
  }, [
    workoutDate,
    testMode.active,
    testMode.workoutOpen,
  ]);

  async function handleOpenWorkout() {
    if (testMode.active) {
      setOpeningWorkout(true);
      setTestWorkoutOpen(true);
      setWorkoutOpen(true);
      setTestWorkoutDate(
        workoutDate
      );
      setTestRosterMessage(
        `${workoutDate} 테스트 운동을 열었습니다. 아래에서 참석자 데이터 날짜를 별도로 선택해 주세요.`
      );
      setOpeningWorkout(false);
      return;
    }

    if (!session?.userId) {
      window.alert(
        "운영진 회원 정보를 찾을 수 없습니다."
      );
      return;
    }

    if (
      workoutDate !==
      getKstDateKey()
    ) {
      window.alert(
        "오늘 날짜로만 운동을 열 수 있습니다."
      );
      return;
    }

    try {
      setOpeningWorkout(true);
      const workoutMarker =
        await openWorkout(
        workoutDate,
        session.userId
      );
      await activateAllPendingCheckIns(
        workoutMarker &&
          typeof workoutMarker ===
            "object" &&
          "arrival_time" in
            workoutMarker
          ? String(
              workoutMarker.arrival_time
            )
          : new Date().toISOString()
      );
      setWorkoutOpen(true);
      await refreshAttendance();
      publishLiveSessionEvent({
        type: "WORKOUT_OPENED",
        workoutDate,
      });
    } catch (error) {
      console.error(error);
      window.alert(
        "오늘 운동을 열지 못했습니다."
      );
    } finally {
      setOpeningWorkout(false);
    }
  }

  async function importTestRoster(
    sourceDate = workoutDate,
    confirmReplacement = true
  ) {
    if (
      !testMode.active
    ) {
      return;
    }

    if (
      confirmReplacement &&
      players.length > 0 &&
      !window.confirm(
        "현재 테스트 참가자와 경기 상태를 지우고 선택한 날짜의 참석자 명단으로 교체하시겠습니까?"
      )
    ) {
      return;
    }

    try {
      setImportingTestRoster(true);
      setTestRosterMessage("");
      if (!workoutOpen) {
        setTestWorkoutOpen(true);
        setWorkoutOpen(true);
      }
      setTestWorkoutDate(
        workoutDate
      );
      const rows =
        await getAttendanceListByDate(
          sourceDate
        ) as TestAttendanceRow[];
      const uniqueUsers =
        new Map<
          string,
          TestAttendanceUser
        >();

      rows.forEach((row) => {
        const user =
          Array.isArray(row.users)
            ? row.users[0]
            : row.users;

        if (user?.id) {
          uniqueUsers.set(
            user.id,
            user
          );
        }
      });

      const now = Date.now();
      const importedPlayers: Player[] =
        [...uniqueUsers.values()].map(
          (user, index) => {
            const restMinutes =
              2 +
              index * 3 +
              (
                index % 4
              );
            const waitingStartedAt =
              new Date(
                now -
                  restMinutes *
                    60_000
              );

            return {
              id: user.id,
              name: user.name,
              gender:
                user.gender ?? "M",
              grade:
                user.grade ?? "F",
              hiddenSkill:
                user.hidden_skill ??
                35,
              isPresent: true,
              arrivalTime:
                waitingStartedAt,
              matchCount: 0,
              consecutiveMatches: 0,
              status: "WAITING",
              waitingStartedAt,
              lastPartners: [],
              lastOpponents: [],
            };
          }
        );

      useMatchStore.setState({
        players: importedPlayers,
        courts: [
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
        ],
        fixedPartnerRequests: [],
        notifications: [],
        matchHistory: [],
        recommendations: [],
        selectedRecommendation:
          null,
      });
      setTestAttendanceDates([
        workoutDate,
      ]);
      setTestRosterMessage(
        importedPlayers.length > 0
          ? `${sourceDate} 참석자 ${importedPlayers.length}명을 테스트 대기열에 불러왔습니다. 휴식시간은 서로 다르게 설정되었습니다.`
          : `${sourceDate}에는 저장된 참석자가 없습니다.`
      );
    } catch (error) {
      console.error(error);
      setTestRosterMessage(
        "테스트 참가자 명단을 불러오지 못했습니다."
      );
    } finally {
      setImportingTestRoster(
        false
      );
    }
  }

  function handleRemoveCourt() {
    if (isReadOnly) {
      window.alert(
        "조회 전용 로그인에서는 코트를 삭제할 수 없습니다."
      );
      return;
    }

    if (courts.length <= 1) {
      window.alert(
        "코트는 최소 1개를 유지해야 합니다."
      );
      return;
    }

    const lastCourt =
      courts[
        courts.length - 1
      ];

    if (
      lastCourt.status ===
      "PLAYING"
    ) {
      window.alert(
        `경기 중인 ${lastCourt.id}번 코트는 삭제할 수 없습니다.`
      );
      return;
    }

    const confirmed =
      window.confirm(
        `${lastCourt.id}번 코트를 삭제하시겠습니까?`
      );

    if (!confirmed) {
      return;
    }

    removeCourt(
      lastCourt.id
    );
  }

  const refreshAttendance =
  async () => {
    if (testMode.active) {
      return;
    }

    try {
      const data =
        await getActiveWorkoutAttendanceList();

      console.log(
        "갱신 데이터",
        data
      );

      setAttendanceList(
        uniqueByUserId(data)
      );

      const uniqueAttendance =
        uniqueByUserId(data);
      const currentPlayers =
        useMatchStore.getState()
          .players;
      const refreshedPlayers =
        currentPlayers.slice();

      uniqueAttendance.forEach(
        (attendance: any) => {
          const existingIndex =
            refreshedPlayers.findIndex(
              (player) =>
                player.id ===
                attendance.users.id
            );

          if (existingIndex >= 0) {
            const existing =
              refreshedPlayers[
                existingIndex
              ];

            refreshedPlayers[
              existingIndex
            ] = {
              ...existing,
              isPresent: true,
              status:
                existing.status,
            };
          } else {
            refreshedPlayers.push({
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
                    new Date(
                      attendance.arrival_time ??
                        Date.now()
                    ),
                  matchCount:
                    attendance.match_count ??
                    0,
                  consecutiveMatches:
                    attendance.consecutive_matches ??
                    0,
                  status:
                    "WAITING" as const,
                  waitingStartedAt:
                    new Date(
                      attendance.arrival_time ??
                        Date.now()
                    ),
                  lastPartners: [],
                  lastOpponents: [],
                  fixedPartner:
                    attendance.users
                      .fixed_partner_id ??
                    undefined,
                });
          }
        }
      );

      setPlayers(refreshedPlayers);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!workoutOpen) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          void refreshAttendance();
        },
        5000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [workoutOpen]);

    useEffect(() => {
        getActiveWorkoutAttendanceList()
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
                          new Date(
                            attendance.arrival_time ??
                              Date.now()
                          ),
              
                        matchCount: 0,
              
                        consecutiveMatches: 0,
              
                        status: "WAITING" as const,
              
                        waitingStartedAt:
                          new Date(
                            attendance.arrival_time ??
                              Date.now()
                          ),
              
                        lastPartners: [],
              
                        lastOpponents: [],
                        fixedPartner:
                          attendance.users
                            .fixed_partner_id ??
                          undefined,
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
  uniqueAttendance.map((attendance: any) => ({
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
      new Date(
        attendance.arrival_time ??
          Date.now()
      ),
    matchCount: 0,
    consecutiveMatches: 0,
    status: "WAITING",
    waitingStartedAt:
      new Date(
        attendance.arrival_time ??
          Date.now()
      ),
    lastPartners: [],
    lastOpponents: [],
    fixedPartner:
      attendance.users
        .fixed_partner_id ??
      undefined,
  }));
      
            setPlayers(playerList);
      
            if (
              courts.length === 0
            ) {
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

  const handleAddPlayer = async ({
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

    try {
      if (testMode.active) {
        const newPlayer: Player = {
          id: `test-${crypto.randomUUID()}`,
          name: name.trim(),
          gender,
          grade,
          hiddenSkill:
            skillMap[grade],
          isPresent: true,
          arrivalTime: new Date(),
          matchCount: 0,
          consecutiveMatches: 0,
          status: "WAITING",
          waitingStartedAt:
            new Date(),
          lastPartners: [],
          lastOpponents: [],
        };
        setPlayers([
          ...useMatchStore.getState()
            .players,
          newPlayer,
        ]);
        return;
      }

      const user =
        await createGuestUser({
          name,
          gender,
          grade,
        });
      await ensureTodayCheckIn(
        user.id
      );

      const currentPlayers =
        useMatchStore.getState()
          .players;
      const existingPlayer =
        currentPlayers.find(
          (player) =>
            player.id === user.id
        );
      const newPlayer: Player = {
        id: user.id,

        name: user.name,

        gender:
          user.gender ?? gender,

        grade:
          user.grade ?? grade,

        hiddenSkill:
          user.hidden_skill ??
          skillMap[grade],

        isPresent: true,

        arrivalTime:
          existingPlayer?.arrivalTime ??
          new Date(),

        matchCount:
          existingPlayer?.matchCount ??
          0,

        consecutiveMatches:
          existingPlayer?.consecutiveMatches ??
          0,

        status:
          existingPlayer?.status ===
          "PLAYING"
            ? "PLAYING"
            : "WAITING",

        waitingStartedAt:
          existingPlayer?.waitingStartedAt ??
          new Date(),

        lastPartners:
          existingPlayer?.lastPartners ??
          [],

        lastOpponents:
          existingPlayer?.lastOpponents ??
          [],
        fixedPartner:
          user.fixed_partner_id ??
          existingPlayer?.fixedPartner,
      };

      setPlayers([
        ...currentPlayers.filter(
          (player) =>
            player.id !== user.id
        ),
        newPlayer,
      ]);

      addNotification({
        audience: "ADMIN",
        message: `${user.name} 게스트님이 오늘 운동에 참가했습니다.`,
      });

      currentPlayers
        .filter(
          (player) =>
            player.status !==
              "LEFT" &&
            player.id !== user.id &&
            !adminNames.includes(
              player.name
            ) &&
            !masterNames.includes(
              player.name
            )
        )
        .forEach((player) => {
          addNotification({
            audience: "PLAYER",
            recipientId: player.id,
            message: `${user.name} 게스트님이 오늘 운동에 참가했습니다.`,
          });
        });

      await refreshAttendance();
    } catch (error) {
      console.error(error);
      window.alert(
        "참가자를 추가하지 못했습니다."
      );
    }
  };

  const handleAddMember = async ({
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
    if (!isMaster) {
      return;
    }

    if (testMode.active) {
      window.alert(
        "신규 모임원 등록은 실제 서비스 모드에서만 가능합니다."
      );
      return;
    }

    const skillMap = {
      A: 85,
      B: 75,
      C: 65,
      D: 55,
      E: 45,
      F: 35,
    };

    try {
      await getOrCreateUser({
        name,
        gender,
        grade,
        hiddenSkill:
          skillMap[grade],
      });
      window.alert(
        `${name.trim()}님을 모임원으로 등록했습니다. 이제 Player로 로그인할 수 있습니다.`
      );
    } catch (error) {
      console.error(error);
      window.alert(
        "신규 모임원을 등록하지 못했습니다."
      );
      throw error;
    }
  };

  const handleMasterAddParticipant =
    async (member: {
      id: string;
      name: string;
      gender?: "M" | "F" | null;
      grade?:
        | "A"
        | "B"
        | "C"
        | "D"
        | "E"
        | "F"
        | null;
      hidden_skill?: number | null;
      fixed_partner_id?: string | null;
    }) => {
      try {
        if (testMode.active) {
          const userData =
            await getUsers();
          const user =
            userData?.find(
              (item) =>
                item.id === member.id
            );

          if (!user) {
            throw new Error(
              "Member not found"
            );
          }
        } else {
        await ensureTodayCheckIn(
          member.id
        );
        }

        const currentPlayers =
          useMatchStore.getState()
            .players;
        const existingPlayer =
          currentPlayers.find(
            (player) =>
              player.id === member.id
          );
        const participant: Player = {
          id: member.id,
          name: member.name,
          gender:
            member.gender ?? "M",
          grade:
            member.grade ?? "F",
          hiddenSkill:
            member.hidden_skill ?? 35,
          isPresent: true,
          arrivalTime:
            existingPlayer?.arrivalTime ??
            new Date(),
          matchCount:
            existingPlayer?.matchCount ??
            0,
          consecutiveMatches:
            existingPlayer?.consecutiveMatches ??
            0,
          status:
            existingPlayer?.status ===
            "PLAYING"
              ? "PLAYING"
              : "WAITING",
          waitingStartedAt:
            existingPlayer?.waitingStartedAt ??
            new Date(),
          lastPartners:
            existingPlayer?.lastPartners ??
            [],
          lastOpponents:
            existingPlayer?.lastOpponents ??
            [],
          fixedPartner:
            member.fixed_partner_id ??
            existingPlayer?.fixedPartner,
        };

        setPlayers([
          ...currentPlayers.filter(
            (player) =>
              player.id !== member.id
          ),
          participant,
        ]);
        await refreshAttendance();
      } catch (error) {
        console.error(error);
        window.alert(
          "오늘 참가자로 등록하지 못했습니다."
        );
        throw error;
      }
    };

  const handleResetTodayWorkout =
    async () => {
      if (!isMaster) {
        return;
      }

      const confirmed =
        window.confirm(
          "오늘 출석, 대기열, 코트와 모든 경기 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        );

      if (!confirmed) {
        return;
      }

      try {
        if (!testMode.active) {
          await resetTodayWorkoutDataInDatabase(
            getKstDateKey()
          );
        }

        resetTodayWorkoutData(
          testMode.active
            ? workoutDate
            : getKstDateKey()
        );
        setWorkoutOpen(false);
        if (testMode.active) {
          setTestWorkoutOpen(
            false
          );
        } else {
          publishLiveSessionEvent({
            type: "WORKOUT_CLOSED",
            workoutDate:
              getKstDateKey(),
          });
        }
        window.alert(
          "오늘 운동 정보가 모두 초기화되었습니다."
        );
      } catch (error) {
        console.error(error);
        window.alert(
          "오늘 운동 정보를 초기화하지 못했습니다."
        );
      }
    };

  const handleRemoveFixedPartner =
    (
      playerId: string,
      partnerId: string
    ) => {
      const player =
        players.find(
          (item) =>
            item.id === playerId
        );

      const partner =
        players.find(
          (item) =>
            item.id === partnerId
        );

      const confirmed =
        window.confirm(
          `${player?.name ?? "선수"}님과 ${partner?.name ?? "선수"}님의 고정 파트너를 해제하시겠습니까?`
        );

      if (!confirmed) {
        return;
      }

      void clearFixedPartner({
        playerAId: playerId,
        playerBId: partnerId,
      }).catch((error) => {
        console.error(error);
        window.alert(
          "고정 파트너 해제를 서버에 저장하지 못했습니다."
        );
      });
      removeFixedPartner(
        playerId,
        partnerId
      );

      if (player) {
        addNotification({
          audience: "PLAYER",
          recipientId: player.id,
          message: `${partner?.name ?? "파트너"}님과의 고정 파트너가 해제되었습니다.`,
        });
      }

      if (partner) {
        addNotification({
          audience: "PLAYER",
          recipientId: partner.id,
          message: `${player?.name ?? "파트너"}님과의 고정 파트너가 해제되었습니다.`,
        });
      }
    };

  const handleSaveFixedPartner =
    (
      playerAId: string,
      playerBId: string
    ) => {
      const playerA =
        players.find(
          (player) =>
            player.id === playerAId
        );

      const playerB =
        players.find(
          (player) =>
            player.id === playerBId
        );

      setFixedPartner(
        playerAId,
        playerBId
      );
      void saveFixedPartner({
        playerAId,
        playerBId,
      }).catch((error) => {
        console.error(error);
        window.alert(
          "고정 파트너를 서버에 저장하지 못했습니다."
        );
      });

      if (playerA) {
        addNotification({
          audience: "PLAYER",
          recipientId: playerA.id,
          message: `${playerB?.name ?? "선수"}님과 고정 파트너로 설정되었습니다.`,
        });
      }

      if (playerB) {
        addNotification({
          audience: "PLAYER",
          recipientId: playerB.id,
          message: `${playerA?.name ?? "선수"}님과 고정 파트너로 설정되었습니다.`,
        });
      }
    };

  const adminNotifications =
    notifications.filter(
      (notification) =>
        notification.audience ===
          "ADMIN" &&
        (!notification.recipientId ||
          notification.recipientId ===
            session?.userId)
    );

  const currentAdmin =
    players.find(
      (player) =>
        player.id ===
        session?.userId
    );

  if (
    session &&
    !testMode.active &&
    !workoutOpen &&
    (
      session.participationMode ===
        "PREOPEN" ||
      session.participationMode ===
        "PENDING"
    )
  ) {
    return (
      <PreWorkoutQueueGate
        session={session}
        allowManagementWithoutQueue
      />
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
        <section
          className={`mb-6 rounded-2xl border p-5 ${
            workoutOpen
              ? "border-emerald-400/30 bg-emerald-400/10"
              : "border-amber-400/30 bg-amber-400/10"
          }`}
        >
          {testMode.active && (
            <div className="mb-4 rounded-xl border border-fuchsia-400/40 bg-fuchsia-400/10 p-4 text-fuchsia-100">
              <div className="font-bold">
                테스트 모드 · 출석과 경기 결과가 실제 통계에 저장되지 않습니다.
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-fuchsia-200">
                  테스트 운동 날짜
                  <input
                    type="date"
                    value={
                      workoutDate
                    }
                    max={
                      getKstDateKey()
                    }
                    disabled={
                      workoutOpen
                    }
                    onChange={(
                      event
                    ) =>
                      setWorkoutDate(
                        event.target
                          .value
                      )
                    }
                    className="mt-1 block min-w-0 max-w-full box-border w-full rounded-xl border border-fuchsia-400/30 bg-slate-900 px-3 py-2 text-white disabled:opacity-60"
                  />
                </label>
                <label className="text-xs text-fuchsia-200">
                  참석자 데이터 원본 날짜
                  <input
                    type="date"
                    value={
                      testRosterDate
                    }
                    max={
                      getKstDateKey()
                    }
                    onChange={(
                      event
                    ) => {
                      const date =
                        event.target
                          .value;
                      setTestRosterDateState(
                        date
                      );
                      saveTestRosterDate(
                        date
                      );
                      setTestRosterMessage(
                        ""
                      );
                    }}
                    className="mt-1 block min-w-0 max-w-full box-border w-full rounded-xl border border-fuchsia-400/30 bg-slate-900 px-3 py-2 text-white"
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={
                    workoutOpen ||
                    openingWorkout ||
                    !workoutDate
                  }
                  onClick={
                    handleOpenWorkout
                  }
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {workoutOpen
                    ? "테스트 운동 열림"
                    : openingWorkout
                      ? "여는 중..."
                      : "테스트 운동 열기"}
                </button>
                <button
                  type="button"
                  disabled={
                    importingTestRoster ||
                    !testRosterDate
                  }
                  onClick={() =>
                    void importTestRoster(
                      testRosterDate
                    )
                  }
                  className="self-end rounded-xl bg-fuchsia-500 px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {importingTestRoster
                    ? "불러오는 중..."
                    : "참석자 전체 불러오기"}
                </button>
              </div>
              {testRosterMessage && (
                <p className="mt-3 text-sm text-fuchsia-100">
                  {testRosterMessage}
                </p>
              )}
              <p className="mt-3 text-xs text-fuchsia-200">
                테스트 운동 날짜는 상단의 운동 날짜를 사용하며, 참석자 명단은 여기에서 선택한 다른 날짜의 실제 출석 데이터를 사용할 수 있습니다.
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p
                className={`text-sm font-bold ${
                  workoutOpen
                    ? "text-emerald-300"
                    : "text-amber-200"
                }`}
              >
                오늘 운동{" "}
                {workoutOpen
                  ? "진행 중"
                  : "미개설"}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {workoutOpen
                  ? `${workoutDate} 운동이 열려 있습니다.`
                  : "운영진이 오늘 운동을 열어야 참가 대기자가 자동으로 등록됩니다."}
              </p>
            </div>

            {!workoutOpen &&
              !testMode.active && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-slate-300">
                  운동 날짜
                  <input
                    type="date"
                    value={
                      workoutDate
                    }
                    max={
                      getKstDateKey()
                    }
                    onChange={(
                      event
                    ) => {
                      setWorkoutDate(
                        event.target
                          .value
                      );
                      setWorkoutStatusLoading(
                        true
                      );
                    }}
                    className="mt-1 block rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={
                    handleOpenWorkout
                  }
                  disabled={
                    openingWorkout ||
                    workoutStatusLoading
                  }
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 font-bold text-slate-950 disabled:opacity-50"
                >
                  {openingWorkout
                    ? "여는 중..."
                    : "오늘 운동 열기"}
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="mb-6 lg:flex lg:items-start lg:justify-between lg:gap-6">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">
              STEP UP MATCH
            </h1>

            <p className="text-slate-400 mt-2">
              {isMaster
                ? "Master Dashboard"
                : "Admin Dashboard"}
            </p>

            <div
              className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold ${
                womenDoublesPriority
                  ? "border-pink-300 bg-pink-400/20 text-pink-200"
                  : "border-slate-700 bg-slate-800 text-slate-400"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  womenDoublesPriority
                    ? "bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.9)]"
                    : "bg-slate-500"
                }`}
              />
              여복 우선 모드:{" "}
              {womenDoublesPriority
                ? "활성화됨"
                : "꺼짐"}
            </div>
          </div>

          {isReadOnly && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200 lg:mt-0">
              조회 전용 로그인: 관리 기능은 사용할 수 없습니다.
            </div>
          )}

          <details className="mt-5 lg:mt-0 lg:min-w-[520px]">
            <summary className="cursor-pointer rounded-xl bg-slate-800 px-4 py-3 text-center font-bold">
              관리 기능
            </summary>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:gap-3 sm:text-base lg:mt-0 lg:flex lg:flex-wrap lg:justify-end [&>button]:w-full [&>button]:whitespace-nowrap lg:[&>button]:w-auto">
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
              onClick={() => {
                if (isReadOnly) {
                  window.alert(
                    "조회 전용 로그인에서는 코트를 추가할 수 없습니다."
                  );
                  return;
                }

                addCourt();
              }}
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
              onClick={
                handleRemoveCourt
              }
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
              onClick={() => {
                if (isReadOnly) {
                  window.alert(
                    "조회 전용 로그인에서는 고정 파트너를 변경할 수 없습니다."
                  );
                  return;
                }

                setIsFixedPartnerOpen(
                  true
                );
              }}
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
              onClick={() => {
                if (isReadOnly) {
                  window.alert(
                    "조회 전용 로그인에서는 참가자를 추가할 수 없습니다."
                  );
                  return;
                }

                setIsAddModalOpen(
                  true
                );
              }}
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

            <button
              type="button"
              aria-pressed={
                womenDoublesPriority
              }
              onClick={() => {
                if (isReadOnly) {
                  window.alert(
                    "조회 전용 로그인에서는 여복 우선 모드를 변경할 수 없습니다."
                  );
                  return;
                }

                setWomenDoublesPriority(
                  !womenDoublesPriority
                );
              }}
              className={`rounded-2xl border-2 px-6 py-3 font-bold shadow-lg transition ${
                womenDoublesPriority
                  ? "border-pink-200 bg-pink-400 text-slate-950 shadow-pink-500/30"
                  : "border-slate-600 bg-slate-800 text-slate-300 shadow-none"
              }`}
            >
              <span className="block">
                {womenDoublesPriority
                  ? "✓ 여복 우선 모드 ON"
                  : "○ 여복 우선 모드 OFF"}
              </span>
              <span
                className={`mt-1 block text-xs ${
                  womenDoublesPriority
                    ? "text-pink-950"
                    : "text-slate-500"
                }`}
              >
                눌러서{" "}
                {womenDoublesPriority
                  ? "비활성화"
                  : "활성화"}
              </span>
            </button>

            {isMaster && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setIsMasterParticipantModalOpen(
                      true
                    )
                  }
                  className="rounded-2xl bg-purple-500 px-6 py-3 font-bold"
                >
                  오늘 참가자 대신 등록
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setIsMemberModalOpen(
                      true
                    )
                  }
                  className="rounded-2xl bg-indigo-500 px-6 py-3 font-bold"
                >
                  신규 모임원 등록
                </button>
              </>
            )}
          </div>
          </details>
        </div>

        <div className="mb-6 grid grid-cols-4 gap-2 overflow-x-auto [&>div]:min-w-[76px] [&>div]:rounded-xl [&>div]:p-3 [&>div>div:last-child]:mt-1 [&>div>div:last-child]:text-2xl">
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

        <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <span className="text-sm text-slate-400">
            현재 내 상태
          </span>
          <span className="rounded-lg bg-cyan-400/15 px-3 py-1 text-sm font-bold text-cyan-300">
            {currentAdmin?.status ===
            "PLAYING"
              ? "경기 중"
              : currentAdmin?.status ===
                  "WAITING"
                ? "대기 중"
                : "운동 종료"}
          </span>
        </div>

        {adminNotifications.length > 0 && (
          <div className="mb-8 rounded-3xl bg-slate-900 p-6 border border-cyan-500/30">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                Admin 알림
              </h2>

              <button
                type="button"
                onClick={() =>
                  dismissNotifications(
                    adminNotifications.map(
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
              {adminNotifications.map(
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
                readOnly={
                  isReadOnly
                }
              />
            )
          )}
        </div>

        <div className="mt-8 grid lg:grid-cols-2 gap-6">
          <WaitingList
            players={
              waitingPlayers
            }
            showGrade={
              isMaster
            }
            readOnly={
              isReadOnly
            }
          />

          <MatchHistoryPanel />
        </div>

        {isMaster && (
          <MasterManagementPanel
            onResetToday={
              handleResetTodayWorkout
            }
          />
        )}

        {isMaster && (
          <div className="mt-8 rounded-3xl border border-purple-500/30 bg-slate-900 p-6">
            <div className="mb-4">
              <p className="text-sm font-bold text-purple-300">
                MASTER ONLY
              </p>
              <h2 className="mt-1 text-xl font-bold">
                전체 선수 정보
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-slate-400">
                  <tr className="border-b border-slate-800">
                    <th className="px-3 py-3">
                      이름
                    </th>
                    <th className="px-3 py-3">
                      성별
                    </th>
                    <th className="px-3 py-3">
                      등급
                    </th>
                    <th className="px-3 py-3">
                      내부 점수
                    </th>
                    <th className="px-3 py-3">
                      상태
                    </th>
                    <th className="px-3 py-3">
                      경기 수
                    </th>
                    <th className="px-3 py-3">
                      고정 파트너
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(
                    (player) => {
                      const partner =
                        players.find(
                          (item) =>
                            item.id ===
                            player.fixedPartner
                        );

                      return (
                        <tr
                          key={player.id}
                          className="border-b border-slate-800/70"
                        >
                          <td className="px-3 py-3 font-bold">
                            {
                              player.name
                            }
                          </td>
                          <td className="px-3 py-3">
                            {player.gender ===
                            "M"
                              ? "남"
                              : "여"}
                          </td>
                          <td className="px-3 py-3 font-bold text-purple-300">
                            {
                              player.grade
                            }
                          </td>
                          <td className="px-3 py-3">
                            {
                              player.hiddenSkill
                            }
                          </td>
                          <td className="px-3 py-3">
                            {
                              player.status
                            }
                          </td>
                          <td className="px-3 py-3">
                            {
                              player.matchCount
                            }
                          </td>
                          <td className="px-3 py-3">
                            {partner?.name ??
                              "-"}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-3xl bg-slate-900 p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              고정 파트너 신청 알림
            </h2>

            <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300">
              {fixedPartnerRequests.length}
            </span>
          </div>

          {fixedPartnerRequests.length === 0 ? (
            <div className="text-slate-500">
              대기 중인 신청이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {fixedPartnerRequests.map(
                (request) => (
                  <div
                    key={request.id}
                    className="
                      flex
                      flex-wrap
                      items-center
                      justify-between
                      gap-3
                      rounded-xl
                      bg-slate-800
                      px-4
                      py-3
                    "
                  >
                    <div>
                      <div className="font-bold">
                        {request.requesterName}
                        {" ↔ "}
                        {request.partnerName}
                      </div>

                      <div className="text-xs text-slate-400">
                        Player 신청
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            isReadOnly
                          ) {
                            window.alert(
                              "조회 전용 로그인에서는 신청을 승인할 수 없습니다."
                            );
                            return;
                          }

                          approveFixedPartnerRequest(
                            request.id
                          );
                          void saveFixedPartner({
                            playerAId:
                              request.requesterId,
                            playerBId:
                              request.partnerId,
                          }).catch(
                            (error) => {
                              console.error(
                                error
                              );
                              window.alert(
                                "고정 파트너 승인을 서버에 저장하지 못했습니다."
                              );
                            }
                          );
                        }}
                        className="
                          rounded-xl
                          bg-lime-400
                          px-4
                          py-2
                          text-sm
                          font-bold
                          text-black
                        "
                      >
                        승인
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (
                            isReadOnly
                          ) {
                            window.alert(
                              "조회 전용 로그인에서는 신청을 거절할 수 없습니다."
                            );
                            return;
                          }

                          rejectFixedPartnerRequest(
                            request.id
                          );
                        }}
                        className="
                          rounded-xl
                          bg-slate-700
                          px-4
                          py-2
                          text-sm
                          font-bold
                          text-white
                        "
                      >
                        거절
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
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
        showGrade
        title="오늘 게스트 참가자 추가"
        submitLabel="게스트 참가 등록"
        onClose={() =>
          setIsAddModalOpen(
            false
          )
        }
        onAdd={
          handleAddPlayer
        }
      />

      <AddPlayerModal
        open={
          isMemberModalOpen
        }
        showGrade
        title="신규 모임원 등록"
        submitLabel="Player 계정 등록"
        onClose={() =>
          setIsMemberModalOpen(
            false
          )
        }
        onAdd={
          handleAddMember
        }
      />

      {isMasterParticipantModalOpen && (
        <MasterAddParticipantModal
          open
          onClose={() =>
            setIsMasterParticipantModalOpen(
              false
            )
          }
          onAdd={
            handleMasterAddParticipant
          }
        />
      )}

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
          handleSaveFixedPartner(
            playerA,
            playerB
          )
        }
      />
    </>
  );
}
