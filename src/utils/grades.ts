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
  "A+": 62,
  A: 58,
  "A-": 54,
  "B+": 52,
  B: 50,
  "B-": 47,
  "C+": 48,
  C: 45,
  "C-": 42,
  "D+": 38,
  D: 35,
  "D-": 30,
  "E+": 15,
  E: 10,
  "E-": 8,
  "F+": 8,
  F: 5,
  "F-": 3,
};

export function getSingleWomanMixedSkill(
  grade: Grade
) {
  return singleWomanMixedSkillByGrade[
    grade
  ];
}
