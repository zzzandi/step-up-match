import type {
  Grade,
} from "@/types/player";

export const gradeOptions: Grade[] = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "E+",
  "E",
  "E-",
  "F+",
  "F",
  "F-",
];

export const skillByGrade: Record<
  Grade,
  number
> = {
  "A+": 90,
  A: 85,
  "A-": 80,
  "B+": 78,
  B: 75,
  "B-": 70,
  "C+": 68,
  C: 65,
  "C-": 60,
  "D+": 58,
  D: 55,
  "D-": 50,
  "E+": 48,
  E: 45,
  "E-": 40,
  "F+": 38,
  F: 35,
  "F-": 30,
};

export function getSkillByGrade(
  grade: Grade
) {
  return skillByGrade[grade];
}

const singleWomanMixedSkillByGrade: Record<
  Grade,
  number
> = {
  "A+": 70,
  A: 65,
  "A-": 60,
  "B+": 58,
  B: 55,
  "B-": 52,
  "C+": 52,
  C: 50,
  "C-": 47,
  "D+": 43,
  D: 40,
  "D-": 37,
  "E+": 38,
  E: 35,
  "E-": 32,
  "F+": 32,
  F: 30,
  "F-": 28,
};

export function getSingleWomanMixedSkill(
  grade: Grade
) {
  return singleWomanMixedSkillByGrade[
    grade
  ];
}
