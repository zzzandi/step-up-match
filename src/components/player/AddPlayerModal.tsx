import { useState } from "react";

interface AddPlayerModalProps {
  open: boolean;
  showGrade?: boolean;

  onClose: () => void;

  onAdd: (
    player: {
      name: string;
      gender: "M" | "F";
      grade:
        | "A"
        | "B"
        | "C"
        | "D"
        | "E"
        | "F";
    }
  ) => void | Promise<void>;
}

export default function AddPlayerModal({
  open,
  showGrade = false,
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
    useState<
      "A" | "B" | "C" | "D" | "E" | "F"
    >("C");

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
          참가자 추가
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
                    .value as
                    | "A"
                    | "B"
                    | "C"
                    | "D"
                    | "E"
                    | "F"
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
              <option>A</option>
              <option>B</option>
              <option>C</option>
              <option>D</option>
              <option>E</option>
              <option>F</option>
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
            추가
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
