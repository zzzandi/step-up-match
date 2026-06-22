import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getUsers,
  updateUserProfile,
} from "@/services/supabaseUserService";
import {
  adminNames,
  masterNames,
} from "@/auth/access";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import type {
  Grade,
  Gender,
} from "@/types/player";

interface Member {
  id: string;
  name: string;
  gender: Gender | null;
  grade: Grade | null;
  hidden_skill: number | null;
}

const skillByGrade: Record<
  Grade,
  number
> = {
  A: 85,
  B: 75,
  C: 65,
  D: 55,
  E: 45,
  F: 35,
};

export default function MasterManagementPanel({
  onResetToday,
}: {
  onResetToday: () => Promise<void>;
}) {
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
  const clearRecommendation =
    useMatchStore(
      (state) =>
        state.clearRecommendation
    );
  const excludedMatchPairs =
    useMatchStore(
      (state) =>
        state.excludedMatchPairs
    );
  const addExcludedMatchPair =
    useMatchStore(
      (state) =>
        state.addExcludedMatchPair
    );
  const removeExcludedMatchPair =
    useMatchStore(
      (state) =>
        state.removeExcludedMatchPair
    );
  const [members, setMembers] =
    useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] =
    useState("");
  const [name, setName] =
    useState("");
  const [gender, setGender] =
    useState<Gender>("M");
  const [grade, setGrade] =
    useState<Grade>("F");
  const [pairA, setPairA] =
    useState("");
  const [pairB, setPairB] =
    useState("");
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState("");

  async function refreshMembers() {
    const data =
      await getUsers();
    setMembers(
      (data ?? []) as Member[]
    );
  }

  useEffect(() => {
    let cancelled = false;

    getUsers()
      .then((data) => {
        if (!cancelled) {
          setMembers(
            (data ?? []) as Member[]
          );
        }
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedMember =
    useMemo(
      () =>
        members.find(
          (member) =>
            member.id ===
            selectedMemberId
        ),
      [members, selectedMemberId]
    );
  const editableMembers =
    useMemo(
      () =>
        members.filter(
          (member) =>
            !adminNames.includes(
              member.name
            ) &&
            !masterNames.includes(
              member.name
            )
        ),
      [members]
    );

  function selectMember(
    memberId: string
  ) {
    setSelectedMemberId(
      memberId
    );
    const member =
      members.find(
        (item) =>
          item.id === memberId
      );

    if (!member) {
      return;
    }

    setName(member.name);
    setGender(
      member.gender ?? "M"
    );
    setGrade(
      member.grade ?? "F"
    );
    setMessage("");
  }

  function memberName(
    memberId: string
  ) {
    return (
      members.find(
        (member) =>
          member.id === memberId
      )?.name ??
      players.find(
        (player) =>
          player.id === memberId
      )?.name ??
      "알 수 없음"
    );
  }

  async function saveMember() {
    if (
      !selectedMember ||
      !name.trim()
    ) {
      setMessage(
        "수정할 회원을 선택하고 이름을 입력해주세요."
      );
      return;
    }

    try {
      setSaving(true);
      const hiddenSkill =
        skillByGrade[grade];
      await updateUserProfile({
        userId:
          selectedMember.id,
        name,
        gender,
        grade,
        hiddenSkill,
      });

      const updatePlayer = (
        player: typeof players[number]
      ) =>
        player.id ===
        selectedMember.id
          ? {
              ...player,
              name: name.trim(),
              gender,
              grade,
              hiddenSkill,
            }
          : player;

      setPlayers(
        players.map(
          updatePlayer
        )
      );
      setCourts(
        courts.map((court) => ({
          ...court,
          teamA: court.teamA
            ? court.teamA.map(
                updatePlayer
              ) as typeof court.teamA
            : null,
          teamB: court.teamB
            ? court.teamB.map(
                updatePlayer
              ) as typeof court.teamB
            : null,
        }))
      );
      clearRecommendation();
      await refreshMembers();
      setMessage(
        "회원 정보가 저장되었고 다음 대진부터 즉시 반영됩니다."
      );
    } catch (error) {
      console.error(error);
      setMessage(
        "회원 정보를 저장하지 못했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  function addPair() {
    if (
      !pairA ||
      !pairB ||
      pairA === pairB
    ) {
      setMessage(
        "서로 다른 두 회원을 선택해주세요."
      );
      return;
    }

    addExcludedMatchPair(
      pairA,
      pairB
    );
    setMessage(
      `${memberName(pairA)}님과 ${memberName(pairB)}님은 같은 경기에 배치되지 않습니다.`
    );
  }

  return (
    <section className="mt-8 space-y-6 rounded-3xl border border-purple-500/30 bg-slate-900 p-6">
      <div>
        <p className="text-sm font-bold text-purple-300">
          MASTER ONLY
        </p>
        <h2 className="mt-1 text-xl font-bold">
          서비스 데이터 및 회원 관리
        </h2>
      </div>

      <div className="rounded-2xl border border-red-400/30 bg-red-400/5 p-4">
        <h3 className="font-bold text-red-200">
          오늘 운동 정보 모두 초기화
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          오늘 출석, 대기열, 코트, 진행·종료 경기와 최근 경기 표시를 모두 삭제합니다.
        </p>
        <button
          type="button"
          onClick={() =>
            void onResetToday()
          }
          className="mt-3 rounded-xl bg-red-500 px-4 py-2 font-bold"
        >
          오늘 운동 정보 초기화
        </button>
      </div>

      <div className="rounded-2xl bg-slate-800 p-4">
        <h3 className="font-bold">
          같은 경기 배치 제외
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          선택한 두 사람은 파트너와 상대를 포함해 같은 4인 경기에 배치되지 않습니다.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <select
            value={pairA}
            onChange={(event) =>
              setPairA(
                event.target.value
              )
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="">
              첫 번째 회원
            </option>
            {members.map((member) => (
              <option
                key={member.id}
                value={member.id}
              >
                {member.name}
              </option>
            ))}
          </select>
          <select
            value={pairB}
            onChange={(event) =>
              setPairB(
                event.target.value
              )
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="">
              두 번째 회원
            </option>
            {members.map((member) => (
              <option
                key={member.id}
                value={member.id}
              >
                {member.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addPair}
            className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-slate-950"
          >
            제외 관계 추가
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {excludedMatchPairs.length ===
          0 ? (
            <p className="text-sm text-slate-500">
              설정된 제외 관계가 없습니다.
            </p>
          ) : (
            excludedMatchPairs.map(
              ([playerAId, playerBId]) => (
                <div
                  key={`${playerAId}-${playerBId}`}
                  className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3"
                >
                  <span>
                    {memberName(
                      playerAId
                    )}{" "}
                    ↔{" "}
                    {memberName(
                      playerBId
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      removeExcludedMatchPair(
                        playerAId,
                        playerBId
                      )
                    }
                    className="rounded-lg bg-slate-700 px-3 py-1 text-sm"
                  >
                    해제
                  </button>
                </div>
              )
            )
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800 p-4">
        <h3 className="font-bold">
          회원 정보 수정
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          이름, 성별, 급수를 변경하면 회원 정보와 매칭 기준이 즉시 갱신됩니다.
        </p>
        <select
          value={selectedMemberId}
          onChange={(event) =>
            selectMember(
              event.target.value
            )
          }
          className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
        >
          <option value="">
            수정할 회원 선택
          </option>
          {editableMembers.map((member) => (
            <option
              key={member.id}
              value={member.id}
            >
              {member.name}
            </option>
          ))}
        </select>

        {selectedMember && (
          <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <input
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
              placeholder="이름"
            />
            <select
              value={gender}
              onChange={(event) =>
                setGender(
                  event.target
                    .value as Gender
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
              value={grade}
              onChange={(event) =>
                setGrade(
                  event.target
                    .value as Grade
                )
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
            >
              {([
                "A",
                "B",
                "C",
                "D",
                "E",
                "F",
              ] as Grade[]).map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}급
                  </option>
                )
              )}
            </select>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void saveMember()
              }
              className="rounded-xl bg-purple-500 px-4 py-2 font-bold disabled:opacity-50"
            >
              {saving
                ? "저장 중..."
                : "변경 저장"}
            </button>
          </div>
        )}
      </div>

      {message && (
        <p className="rounded-xl bg-slate-800 px-4 py-3 text-sm text-cyan-200">
          {message}
        </p>
      )}
    </section>
  );
}
