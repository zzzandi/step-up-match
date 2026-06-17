import type { Player } from "@/types/player";

const now = Date.now();

export const mockPlayers: Player[] = [
  {
    id: "1",
    name: "김민수",
    gender: "M",
    grade: "B",
    hiddenSkill: 72,
    isPresent: true,
    arrivalTime: new Date(now - 120 * 60 * 1000),

    matchCount: 2,
    consecutiveMatches: 1,

    status: "PLAYING",

    playingStartedAt:
      new Date(
        now - 5 * 60 * 1000
      ),

    lastPartners: [],
    lastOpponents: [],
  },

  {
    id: "2",
    name: "허은비",
    gender: "F",
    grade: "B",
    hiddenSkill: 70,
    isPresent: true,
    arrivalTime: new Date(now - 120 * 60 * 1000),

    matchCount: 2,
    consecutiveMatches: 1,

    status: "PLAYING",

    playingStartedAt:
      new Date(
        now - 5 * 60 * 1000
      ),

    lastPartners: [],
    lastOpponents: [],
  },

  {
    id: "3",
    name: "유원석",
    gender: "M",
    grade: "A",
    hiddenSkill: 84,
    isPresent: true,
    arrivalTime: new Date(now - 120 * 60 * 1000),

    matchCount: 2,
    consecutiveMatches: 1,

    status: "PLAYING",

    playingStartedAt:
      new Date(
        now - 5 * 60 * 1000
      ),

    lastPartners: [],
    lastOpponents: [],
  },

  {
    id: "4",
    name: "이주민",
    gender: "F",
    grade: "A",
    hiddenSkill: 82,
    isPresent: true,
    arrivalTime: new Date(now - 120 * 60 * 1000),

    matchCount: 2,
    consecutiveMatches: 1,

    status: "PLAYING",

    playingStartedAt:
      new Date(
        now - 5 * 60 * 1000
      ),

    lastPartners: [],
    lastOpponents: [],
  },

  {
    id: "5",
    name: "박성훈",
    gender: "M",
    grade: "C",
    hiddenSkill: 60,
    isPresent: true,
    arrivalTime: new Date(now - 120 * 60 * 1000),

    matchCount: 1,
    consecutiveMatches: 0,

    status: "WAITING",

    waitingStartedAt:
      new Date(
        now - 30 * 60 * 1000
      ),

    lastPartners: [],
    lastOpponents: [],
  },

  {
    id: "6",
    name: "최은지",
    gender: "F",
    grade: "C",
    hiddenSkill: 61,
    isPresent: true,
    arrivalTime: new Date(now - 120 * 60 * 1000),

    matchCount: 1,
    consecutiveMatches: 0,

    status: "WAITING",

    waitingStartedAt:
      new Date(
        now - 35 * 60 * 1000
      ),

    lastPartners: [],
    lastOpponents: [],
  },

  {
    id: "7",
    name: "강민석",
    gender: "M",
    grade: "D",
    hiddenSkill: 55,
    isPresent: true,
    arrivalTime: new Date(now - 120 * 60 * 1000),

    matchCount: 1,
    consecutiveMatches: 0,

    status: "WAITING",

    waitingStartedAt:
      new Date(
        now - 28 * 60 * 1000
      ),

    lastPartners: [],
    lastOpponents: [],
  },

  {
    id: "8",
    name: "정유진",
    gender: "F",
    grade: "D",
    hiddenSkill: 56,
    isPresent: true,
    arrivalTime: new Date(now - 120 * 60 * 1000),

    matchCount: 1,
    consecutiveMatches: 0,

    status: "WAITING",

    waitingStartedAt:
      new Date(
        now - 40 * 60 * 1000
      ),

    lastPartners: [],
    lastOpponents: [],
  },

  {
    id: "9",
    name: "김태우",
    gender: "M",
    grade: "B",
    hiddenSkill: 73,
    isPresent: true,
    arrivalTime: new Date(now - 120 * 60 * 1000),

    matchCount: 0,
    consecutiveMatches: 0,

    status: "WAITING",

    waitingStartedAt:
      new Date(
        now - 45 * 60 * 1000
      ),

    lastPartners: [],
    lastOpponents: [],
  },

  {
    id: "10",
    name: "서지수",
    gender: "F",
    grade: "B",
    hiddenSkill: 74,
    isPresent: true,
    arrivalTime: new Date(now - 120 * 60 * 1000),

    matchCount: 0,
    consecutiveMatches: 0,

    status: "WAITING",

    waitingStartedAt:
      new Date(
        now - 50 * 60 * 1000
      ),

    lastPartners: [],
    lastOpponents: [],
  },

  {
    id: "11",
    name: "한준혁",
    gender: "M",
    grade: "A",
    hiddenSkill: 85,
    isPresent: true,
    arrivalTime: new Date(now - 120 * 60 * 1000),

    matchCount: 0,
    consecutiveMatches: 0,

    status: "WAITING",

    waitingStartedAt:
      new Date(
        now - 60 * 60 * 1000
      ),

    lastPartners: [],
    lastOpponents: [],
  },

  {
    id: "12",
    name: "이수빈",
    gender: "F",
    grade: "A",
    hiddenSkill: 83,
    isPresent: true,
    arrivalTime: new Date(now - 120 * 60 * 1000),

    matchCount: 0,
    consecutiveMatches: 0,

    status: "WAITING",

    waitingStartedAt:
      new Date(
        now - 55 * 60 * 1000
      ),

    lastPartners: [],
    lastOpponents: [],
  },
];