import { useState } from "react";

import type {
  Grade,
} from "@/types/player";
import {
  gradeOptions,
} from "@/utils/grades";

interface AddPlayerModalProps {
  open: boolean;
  showGrade?: boolean;
  title?: string;
  submitLabel?: string;

  onClose: () => void;

  onAdd: (
    player: {
      name: string;
      gender: "M" | "F";
      grade: Grade;
    }
  ) => void | Promise<void>;
}

export default function AddPlayerModal({
  open,
  showGrade = false,
  title = "참가자 추가",
  submitLabel = "추가",
  onClose,
  onAdd,
}: AddPlayerModalProps) {
  const [name, setName] =
    useState("");

  const [gender, setGender] =
    useState<"M" | "F">(
      "M"
    );

  const [grade, setGrade] =
    useState<Grade>("C");

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
          w-[420px]
          text-white
        "
      >
        <h2 className="text-2xl font-bold mb-6">
          {title}
        </h2>

        <div className="space-y-4">
          <input
            value={name}
            onChange={(e) =>
              setName(
                e.target.value
              )
            }
            placeholder="이름"
            className="
              w-full
              rounded-xl
              bg-slate-800
              px-4
              py-3
            "
          />

          <select
            value={gender}
            onChange={(e) =>
              setGender(
                e.target
                  .value as
                  "M" | "F"
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
            <option value="M">
              남자
            </option>

            <option value="F">
              여자
            </option>
          </select>

          {showGrade && (
            <select
              value={grade}
              onChange={(e) =>
                setGrade(
                  e.target
                    .value as Grade
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
              {gradeOptions.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          )}
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={async () => {
              if (
                !name.trim()
              )
                return;

              await onAdd({
                name,
                gender,
                grade,
              });

              setName("");
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
            {submitLabel}
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
