import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getTodayAttendances,
  getUsers,
} from "@/services/supabaseUserService";

interface Member {
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
  is_active?: boolean | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (
    member: Member
  ) => Promise<void>;
}

export default function MasterAddParticipantModal({
  open,
  onClose,
  onAdd,
}: Props) {
  const [members, setMembers] =
    useState<Member[]>([]);
  const [
    attendingUserIds,
    setAttendingUserIds,
  ] = useState<Set<string>>(
    new Set()
  );
  const [selectedId, setSelectedId] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [adding, setAdding] =
    useState(false);

  useEffect(() => {
    if (!open) return;

    Promise.all([
      getUsers(),
      getTodayAttendances(),
    ])
      .then(
        ([
          userData,
          attendanceData,
        ]) => {
          setMembers(
            (userData ?? []) as Member[]
          );
          setAttendingUserIds(
            new Set(
              (
                attendanceData ?? []
              ).map(
                (attendance) =>
                  attendance.user_id
              )
            )
          );
        }
      )
      .catch(console.error)
      .finally(() =>
        setLoading(false)
      );
  }, [open]);

  const availableMembers =
    useMemo(
      () =>
        members.filter(
          (member) =>
            member.is_active !==
              false &&
            !attendingUserIds.has(
              member.id
            )
        ),
      [members, attendingUserIds]
    );

  if (!open) return null;

  async function handleAdd() {
    const member =
      availableMembers.find(
        (item) =>
          item.id === selectedId
      );

    if (!member) return;

    try {
      setAdding(true);
      await onAdd(member);
      setSelectedId("");
      onClose();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 p-6 text-white">
        <h2 className="text-2xl font-bold">
          오늘 참가자 대신 등록
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          휴대폰 없이 참석한 모임원을 선택하면 오늘 출석과 대기열에 등록됩니다.
        </p>

        <select
          value={selectedId}
          onChange={(event) =>
            setSelectedId(
              event.target.value
            )
          }
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-slate-800 px-4 py-3"
        >
          <option value="">
            {loading
              ? "회원 목록 불러오는 중..."
              : "모임원을 선택하세요"}
          </option>
          {availableMembers.map(
            (member) => (
              <option
                key={member.id}
                value={member.id}
              >
                {member.name}
                {member.grade
                  ? ` (${member.grade})`
                  : ""}
              </option>
            )
          )}
        </select>

        {!loading &&
          availableMembers.length ===
            0 && (
            <p className="mt-3 text-sm text-amber-300">
              추가할 수 있는 미참가 회원이 없습니다.
            </p>
          )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={
              !selectedId || adding
            }
            onClick={() =>
              void handleAdd()
            }
            className="flex-1 rounded-xl bg-purple-500 py-3 font-bold disabled:opacity-40"
          >
            {adding
              ? "등록 중..."
              : "오늘 참가자로 등록"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-700 py-3"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
