export type Gender =
  | "M"
  | "F";

export type Grade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D+"
  | "D"
  | "D-"
  | "E+"
  | "E"
  | "E-"
  | "F+"
  | "F"
  | "F-";

export type PlayerStatus =
  | "WAITING"
  | "PLAYING"
  | "LEFT";

export interface Player {
  id: string;

  name: string;

  gender: Gender;

  grade: Grade;

  hiddenSkill: number;

  isPresent: boolean;

  arrivalTime: Date;

  matchCount: number;

  consecutiveMatches: number;

  status: PlayerStatus;

  waitingStartedAt?: Date;

  playingStartedAt?: Date;

  lastMatchAt?: Date;

  lastPartners: string[];

  lastOpponents: string[];

  fixedPartner?: string;
}
