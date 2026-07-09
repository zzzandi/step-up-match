import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getTodayAttendances,
  getUsers,
} from "@/services/supabaseUserService";
import {
  useTestMode,
} from "@/services/testModeService";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import type {
  Grade,
} from "@/types/player";
import {
  gradeOptions,
} from "@/utils/grades";

interface Member {
  id: string;
  name: string;
  gender?: "M" | "F" | null;
  grade?: Grade | null;
  hidden_skill?: number | null;
  is_active?: boolean | null;
  fixed_partner_id?: string | null;
}

interface GuestDraft {
  id: string;
  name: string;
  gender: "M" | "F";
  grade: Grade;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (
    members: Member[]
  ) => Promise<void>;
  onAddGuests: (
    guests: Omit<GuestDraft, "id">[]
  ) => Promise<void>;
}

function createGuestDraft(): GuestDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    gender: "M",
    grade: "E",
  };
}

export default function MasterAddParticipantModal({
  open,
  onClose,
  onAdd,
  onAddGuests,
}: Props) {
  const [members, setMembers] =
    useState<Member[]>([]);
  const [
    attendingUserIds,
    setAttendingUserIds,
  ] = useState<Set<string>>(
    new Set()
  );
  const [
    selectedIds,
    setSelectedIds,
  ] = useState<Set<string>>(
    new Set()
  );
  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");
  const [
    guestDrafts,
    setGuestDrafts,
  ] = useState<GuestDraft[]>([
    createGuestDraft(),
  ]);
  const [loading, setLoading] =
    useState(true);
  const [adding, setAdding] =
    useState(false);
  const testMode =
    useTestMode();
  const players =
    useMatchStore(
      (state) => state.players
    );

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setSelectedIds(new Set());
    setSearchTerm("");
    setGuestDrafts([
      createGuestDraft(),
    ]);

    Promise.all([
      getUsers(),
      testMode.active
        ? Promise.resolve([])
        : getTodayAttendances(),
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
  }, [open, testMode.active]);

  const availableMembers =
    useMemo(
      () =>
        members.filter(
          (member) =>
            member.is_active !==
              false &&
            !attendingUserIds.has(
              member.id
            ) &&
            !players.some(
              (player) =>
                player.id ===
                  member.id &&
                player.status !==
                  "LEFT"
            )
        ),
      [
        members,
        attendingUserIds,
        players,
      ]
    );

  const selectedMembers =
    useMemo(
      () =>
        availableMembers.filter(
          (member) =>
            selectedIds.has(member.id)
        ),
      [
        availableMembers,
        selectedIds,
      ]
    );

  const filteredMembers =
    useMemo(() => {
      const keyword =
        searchTerm
          .trim()
          .toLowerCase();

      if (!keyword) {
        return availableMembers;
      }

      return availableMembers.filter(
        (member) =>
          member.name
            .toLowerCase()
            .includes(keyword) ||
          member.grade
            ?.toLowerCase()
            .includes(keyword) ||
          (
            member.gender === "F"
              ? "여자"
              : "남자"
          ).includes(keyword)
      );
    }, [
      availableMembers,
      searchTerm,
    ]);

  const validGuests =
    useMemo(
      () =>
        guestDrafts
          .map((guest) => ({
            name: guest.name.trim(),
            gender: guest.gender,
            grade: guest.grade,
          }))
          .filter(
            (guest) =>
              guest.name.length > 0
          ),
      [guestDrafts]
    );

  const totalAddCount =
    selectedMembers.length +
    validGuests.length;

  if (!open) return null;

  function toggleMember(
    memberId: string
  ) {
    setSelectedIds((current) => {
      const next =
        new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(
      new Set(
        filteredMembers.map(
          (member) => member.id
        )
      )
    );
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function updateGuest(
    guestId: string,
    patch: Partial<GuestDraft>
  ) {
    setGuestDrafts((current) =>
      current.map((guest) =>
        guest.id === guestId
          ? {
              ...guest,
              ...patch,
            }
          : guest
      )
    );
  }

  function addGuestDraft() {
    setGuestDrafts((current) => [
      ...current,
      createGuestDraft(),
    ]);
  }

  function removeGuestDraft(
    guestId: string
  ) {
    setGuestDrafts((current) =>
      current.length <= 1
        ? [
            createGuestDraft(),
          ]
        : current.filter(
            (guest) =>
              guest.id !== guestId
          )
    );
  }

  async function handleAdd() {
    if (totalAddCount === 0) {
      return;
    }

    try {
      setAdding(true);
      if (
        selectedMembers.length > 0
      ) {
        await onAdd(
          selectedMembers
        );
      }
      if (validGuests.length > 0) {
        await onAddGuests(
          validGuests
        );
      }
      setSelectedIds(new Set());
      setGuestDrafts([
        createGuestDraft(),
      ]);
      onClose();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-slate-900 p-6 text-white">
        <h2 className="text-2xl font-bold">
          오늘 참가자 일괄 등록
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          모임원을 검색해 선택하거나 게스트 정보를 입력해 오늘 출석과 대기열에 한 번에 등록합니다.
        </p>

        <section className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-2 text-sm">
            <div>
              <h3 className="font-bold">
                모임원 선택
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                이미 오늘 참가 중인 회원은 목록에서 제외됩니다.
              </p>
            </div>
            <span className="font-bold text-cyan-300">
              선택 {selectedMembers.length}명
            </span>
          </div>

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value
              )
            }
            placeholder="이름, 성별, 급수로 검색"
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-cyan-400"
          />

          <div className="mt-3 flex gap-2 text-sm">
            <button
              type="button"
              onClick={selectAll}
              disabled={
                loading ||
                filteredMembers.length ===
                  0
              }
              className="rounded-lg bg-slate-800 px-3 py-2 font-bold disabled:opacity-40"
            >
              검색 결과 전체 선택
            </button>
            <button
              type="button"
              onClick={
                clearSelection
              }
              disabled={
                selectedMembers.length ===
                0
              }
              className="rounded-lg bg-slate-800 px-3 py-2 font-bold disabled:opacity-40"
            >
              선택 해제
            </button>
          </div>

          <div className="mt-3 max-h-[32vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-2">
            {loading ? (
              <div className="px-3 py-4 text-sm text-slate-400">
                회원 목록을 불러오는 중...
              </div>
            ) : availableMembers.length ===
              0 ? (
              <div className="px-3 py-4 text-sm text-amber-300">
                추가 가능한 미참가 회원이 없습니다.
              </div>
            ) : filteredMembers.length ===
              0 ? (
              <div className="px-3 py-4 text-sm text-slate-400">
                검색 결과가 없습니다.
              </div>
            ) : (
              filteredMembers.map(
                (member) => (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(
                        member.id
                      )}
                      onChange={() =>
                        toggleMember(
                          member.id
                        )
                      }
                      className="h-5 w-5 accent-cyan-400"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">
                        {member.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {member.gender ===
                        "F"
                          ? "여자"
                          : "남자"}
                        {member.grade
                          ? ` · ${member.grade}급`
                          : ""}
                      </span>
                    </span>
                  </label>
                )
              )
            )}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-bold">
                게스트 추가
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                이름을 입력한 게스트만 등록됩니다. 여러 명을 한 번에 추가할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={addGuestDraft}
              className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950"
            >
              게스트 행 추가
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {guestDrafts.map(
              (guest, index) => (
                <div
                  key={guest.id}
                  className="grid gap-2 rounded-xl bg-slate-900 p-3 sm:grid-cols-[1fr_110px_110px_auto]"
                >
                  <input
                    value={guest.name}
                    onChange={(event) =>
                      updateGuest(
                        guest.id,
                        {
                          name:
                            event.target
                              .value,
                        }
                      )
                    }
                    placeholder={`게스트 ${index + 1} 이름`}
                    className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                  <select
                    value={guest.gender}
                    onChange={(event) =>
                      updateGuest(
                        guest.id,
                        {
                          gender:
                            event.target
                              .value as
                              | "M"
                              | "F",
                        }
                      )
                    }
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                  >
                    <option value="M">
                      남자
                    </option>
                    <option value="F">
                      여자
                    </option>
                  </select>
                  <select
                    value={guest.grade}
                    onChange={(event) =>
                      updateGuest(
                        guest.id,
                        {
                          grade:
                            event.target
                              .value as Grade,
                        }
                      )
                    }
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                  >
                    {gradeOptions.map(
                      (grade) => (
                        <option
                          key={grade}
                          value={grade}
                        >
                          {grade}
                        </option>
                      )
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      removeGuestDraft(
                        guest.id
                      )
                    }
                    className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-slate-300"
                  >
                    삭제
                  </button>
                </div>
              )
            )}
          </div>
        </section>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={
              totalAddCount === 0 ||
              adding
            }
            onClick={() =>
              void handleAdd()
            }
            className="flex-1 rounded-xl bg-purple-500 py-3 font-bold disabled:opacity-40"
          >
            {adding
              ? "등록 중..."
              : `총 ${totalAddCount}명 등록`}
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
