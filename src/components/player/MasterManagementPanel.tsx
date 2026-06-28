import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  adminNames,
  masterNames,
} from "@/auth/access";
import {
  getUsers,
  updateUserProfile,
} from "@/services/supabaseUserService";
import {
  getKstDateKey,
} from "@/services/workoutSessionService";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import type {
  Grade,
  Gender,
} from "@/types/player";
import {
  getSkillByGrade,
  gradeOptions,
} from "@/utils/grades";

interface Member {
  id: string;
  name: string;
  gender: Gender | null;
  grade: Grade | null;
  hidden_skill: number | null;
}

const text = {
  unknown: "\uC54C \uC218 \uC5C6\uC74C",
  selectDifferentMembers:
    "\uC11C\uB85C \uB2E4\uB978 \uB450 \uD68C\uC6D0\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.",
  noExcludedPairs:
    "\uC124\uC815\uB41C \uC81C\uC678 \uAD00\uACC4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  selectFirstMember:
    "\uCCAB \uBC88\uC9F8 \uD68C\uC6D0",
  selectSecondMember:
    "\uB450 \uBC88\uC9F8 \uD68C\uC6D0",
  addExcludedPair:
    "\uC81C\uC678 \uAD00\uACC4 \uCD94\uAC00",
  remove: "\uD574\uC81C",
  memberInfoEdit:
    "\uD68C\uC6D0 \uC815\uBCF4 \uC218\uC815",
  memberInfoDescription:
    "\uC77C\uBC18 \uD68C\uC6D0\uACFC \uC6B4\uC601\uC9C4\uC758 \uC131\uBCC4, \uAE09\uC218\uB97C \uBCC0\uACBD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC131\uBCC4\uACFC \uAE09\uC218\uB294 \uC2E4\uC81C \uACBD\uAE30 \uB9E4\uCE6D \uAE30\uC900\uC5D0 \uC989\uC2DC \uBC18\uC601\uB429\uB2C8\uB2E4.",
  selectMemberToEdit:
    "\uC218\uC815\uD560 \uD68C\uC6D0 \uC120\uD0DD",
  name: "\uC774\uB984",
  male: "\uB0A8\uC790",
  female: "\uC5EC\uC790",
  gradeSuffix: "\uAE09",
  saving: "\uC800\uC7A5 \uC911...",
  saveChanges: "\uBCC0\uACBD \uC800\uC7A5",
  operatorNameLocked:
    "\uC6B4\uC601\uC9C4 \uB85C\uADF8\uC778 \uAD8C\uD55C\uC744 \uC720\uC9C0\uD558\uAE30 \uC704\uD574 \uC774\uB984\uC740 \uBCC0\uACBD\uD560 \uC218 \uC5C6\uC73C\uBA70, \uC131\uBCC4\uACFC \uAE09\uC218\uB294 \uC218\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  serviceDataTitle:
    "\uC11C\uBE44\uC2A4 \uB370\uC774\uD130 \uBC0F \uD68C\uC6D0 \uAD00\uB9AC",
  resetTitle:
    "\uC120\uD0DD\uD55C \uB0A0\uC9DC\uC758 \uC6B4\uB3D9 \uC815\uBCF4 \uCD08\uAE30\uD654",
  resetDescription:
    "\uC120\uD0DD\uD55C \uB0A0\uC9DC\uC758 \uCD9C\uC11D, \uB300\uAE30\uC5F4, \uCF54\uD2B8, \uC9C4\uD589\u00B7\uC885\uB8CC \uACBD\uAE30\uC640 \uCD5C\uADFC \uACBD\uAE30 \uD45C\uC2DC\uB97C \uCD08\uAE30\uD654\uD569\uB2C8\uB2E4.",
  resetButton:
    "\uC120\uD0DD \uB0A0\uC9DC \uC6B4\uB3D9 \uC815\uBCF4 \uCD08\uAE30\uD654",
  excludedTitle:
    "\uAC19\uC740 \uACBD\uAE30 \uBC30\uCE58 \uC81C\uC678",
  excludedDescription:
    "\uC120\uD0DD\uD55C \uB450 \uC0AC\uB78C\uC740 \uD30C\uD2B8\uB108\uC9C0 \uC0C1\uB300\uB97C \uD3EC\uD568\uD574 \uAC19\uC740 4\uC778 \uACBD\uAE30\uC5D0 \uBC30\uCE58\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
  selectMemberAndName:
    "\uC218\uC815\uD560 \uD68C\uC6D0\uC744 \uC120\uD0DD\uD558\uACE0 \uC774\uB984\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.",
  memberSaved:
    "\uD68C\uC6D0 \uC815\uBCF4\uAC00 \uC800\uC7A5\uB418\uC5C8\uACE0 \uB2E4\uC74C \uB300\uC9C4\uBD80\uD130 \uC989\uC2DC \uBC18\uC601\uB429\uB2C8\uB2E4.",
  memberSaveFailed:
    "\uD68C\uC6D0 \uC815\uBCF4\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
} as const;

export default function MasterManagementPanel({
  onResetToday,
}: {
  onResetToday: (
    targetDate?: string
  ) => Promise<void>;
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
  const [
    selectedMemberId,
    setSelectedMemberId,
  ] = useState("");
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
  const [resetDate, setResetDate] =
    useState(getKstDateKey());

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
  const selectedIsOperator =
    Boolean(
      selectedMember &&
        (adminNames.includes(
          selectedMember.name
        ) ||
          masterNames.includes(
            selectedMember.name
          ))
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
      text.unknown
    );
  }

  async function saveMember() {
    if (
      !selectedMember ||
      !name.trim()
    ) {
      setMessage(
        text.selectMemberAndName
      );
      return;
    }

    try {
      setSaving(true);
      const hiddenSkill =
        getSkillByGrade(grade);
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
            ? (court.teamA.map(
                updatePlayer
              ) as typeof court.teamA)
            : null,
          teamB: court.teamB
            ? (court.teamB.map(
                updatePlayer
              ) as typeof court.teamB)
            : null,
        }))
      );
      clearRecommendation();
      await refreshMembers();
      setMessage(
        text.memberSaved
      );
    } catch (error) {
      console.error(error);
      setMessage(
        text.memberSaveFailed
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
        text.selectDifferentMembers
      );
      return;
    }

    addExcludedMatchPair(
      pairA,
      pairB
    );
    setMessage(
      `${memberName(pairA)}\uB2D8\uACFC ${memberName(pairB)}\uB2D8\uC740 \uAC19\uC740 \uACBD\uAE30\uC5D0 \uBC30\uCE58\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`
    );
  }

  return (
    <section className="mt-8 space-y-6 rounded-3xl border border-purple-500/30 bg-slate-900 p-6">
      <div>
        <p className="text-sm font-bold text-purple-300">
          MASTER ONLY
        </p>
        <h2 className="mt-1 text-xl font-bold">
          {text.serviceDataTitle}
        </h2>
      </div>

      <div className="rounded-2xl border border-red-400/30 bg-red-400/5 p-4">
        <h3 className="font-bold text-red-200">
          {text.resetTitle}
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          {text.resetDescription}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            type="date"
            value={resetDate}
            onChange={(event) =>
              setResetDate(
                event.target.value
              )
            }
            className="min-w-0 rounded-xl border border-red-400/30 bg-slate-950 px-3 py-2"
          />
          <button
            type="button"
            onClick={() =>
              void onResetToday(
                resetDate
              )
            }
            className="rounded-xl bg-red-500 px-4 py-2 font-bold"
          >
            {text.resetButton}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800 p-4">
        <h3 className="font-bold">
          {text.excludedTitle}
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          {text.excludedDescription}
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
              {text.selectFirstMember}
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
              {text.selectSecondMember}
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
            {text.addExcludedPair}
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {excludedMatchPairs.length ===
          0 ? (
            <p className="text-sm text-slate-500">
              {text.noExcludedPairs}
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
                    -{" "}
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
                    {text.remove}
                  </button>
                </div>
              )
            )
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800 p-4">
        <h3 className="font-bold">
          {text.memberInfoEdit}
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          {text.memberInfoDescription}
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
            {text.selectMemberToEdit}
          </option>
          {members.map((member) => (
            <option
              key={member.id}
              value={member.id}
            >
              {member.name}
              {masterNames.includes(
                member.name
              )
                ? " · Master"
                : adminNames.includes(
                      member.name
                    )
                  ? " · Admin"
                  : ""}
            </option>
          ))}
        </select>

        {selectedMember && (
          <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <input
              value={name}
              disabled={
                selectedIsOperator
              }
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder={text.name}
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
                {text.male}
              </option>
              <option value="F">
                {text.female}
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
              {gradeOptions.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                    {text.gradeSuffix}
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
                ? text.saving
                : text.saveChanges}
            </button>
            {selectedIsOperator && (
              <p className="text-xs text-amber-300 sm:col-span-4">
                {text.operatorNameLocked}
              </p>
            )}
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
