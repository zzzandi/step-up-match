import {
  useEffect,
  useState,
} from "react";
import {
  Navigate,
} from "react-router-dom";

import {
  useAccessSession,
} from "@/auth/access";
import {
  useMatchStore,
} from "@/store/useMatchStore";
import {
  getUsers,
} from "@/services/supabaseUserService";

interface Member {
  id: string;
  name: string;
}

export default function FixedPartnerPage() {
  const session =
    useAccessSession();
  const [
    selectedPartnerId,
    setSelectedPartnerId,
  ] = useState("");
  const [message, setMessage] =
    useState("");
  const [members, setMembers] =
    useState<Member[]>([]);
  const players =
    useMatchStore(
      (state) => state.players
    );
  const requests =
    useMatchStore(
      (state) =>
        state.fixedPartnerRequests
    );
  const requestFixedPartner =
    useMatchStore(
      (state) =>
        state.requestFixedPartner
    );
  const assignments =
    useMatchStore(
      (state) =>
        state.fixedPartnerAssignments
    );

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
      .catch(() => {
        if (!cancelled) {
          setMessage(
            "전체 회원 목록을 불러오지 못했습니다."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!session) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (
    session.role !== "PLAYER"
  ) {
    return (
      <Navigate
        to={session.role ===
        "MASTER"
          ? "/master"
          : "/admin"}
        replace
      />
    );
  }

  const currentUserId =
    session.userId;
  const currentPlayer =
    players.find(
      (player) =>
        player.id ===
        currentUserId
    );
  const currentAssignment =
    assignments.find(
      (assignment) =>
        assignment.playerAId ===
          currentUserId ||
        assignment.playerBId ===
          currentUserId
    );
  const currentPartnerId =
    currentAssignment
      ? currentAssignment.playerAId ===
        currentUserId
        ? currentAssignment.playerBId
        : currentAssignment.playerAId
      : currentPlayer?.fixedPartner;
  const currentPartner =
    currentPartnerId
      ? members.find(
          (member) =>
            member.id ===
            currentPartnerId
        ) ??
        players.find(
          (player) =>
            player.id ===
            currentPartnerId
        )
      : null;
  const pendingRequest =
    requests.find(
      (request) =>
        request.requesterId ===
          currentUserId ||
        request.partnerId ===
          currentUserId
    );
  const candidates =
    Array.from(
      new Map(
        [
          ...members,
          ...players
            .filter(
              (player) =>
                player.isPresent &&
                player.status !==
                  "LEFT"
            )
            .map((player) => ({
              id: player.id,
              name: player.name,
            })),
        ]
          .filter(
            (member) =>
              member.id !==
              currentUserId
          )
          .map((member) => [
            member.id,
            member,
          ])
      ).values()
    );

  function submitRequest() {
    if (
      !currentUserId ||
      !selectedPartnerId
    ) {
      setMessage(
        "파트너를 선택해주세요."
      );
      return;
    }

    requestFixedPartner(
      currentUserId,
      selectedPartnerId,
      currentPlayer?.name ??
        session?.userName,
      candidates.find(
        (member) =>
          member.id ===
          selectedPartnerId
      )?.name
    );
    setSelectedPartnerId("");
    setMessage(
      "고정 파트너 신청이 Admin에게 전달되었습니다."
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-bold text-cyan-300">
          PARTNER
        </p>
        <h1 className="mt-1 text-3xl font-bold">
          고정 파트너
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          함께 경기할 고정 파트너를 신청합니다.
        </p>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          {currentPartner ? (
            <div className="rounded-xl bg-slate-800 px-4 py-4 text-slate-200">
              현재 고정 파트너는{" "}
              <strong>
                {currentPartner.name}
              </strong>
              님입니다.
            </div>
          ) : pendingRequest ? (
            <div className="rounded-xl bg-slate-800 px-4 py-4 text-slate-200">
              {
                pendingRequest.requesterName
              }{" "}
              ↔{" "}
              {
                pendingRequest.partnerName
              }{" "}
              신청 승인 대기 중
            </div>
          ) : (
            <>
              <label className="block text-sm text-slate-400">
                파트너 선택
                <select
                  value={
                    selectedPartnerId
                  }
                  onChange={(event) => {
                    setSelectedPartnerId(
                      event.target.value
                    );
                    setMessage("");
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
                >
                  <option value="">
                    파트너를 선택하세요
                  </option>
                  {candidates.map(
                    (player) => (
                      <option
                        key={player.id}
                        value={
                          player.id
                        }
                      >
                        {player.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              {message && (
                <div className="mt-4 rounded-xl bg-slate-800 px-4 py-3 text-center text-slate-300">
                  {message}
                </div>
              )}

              <button
                type="button"
                onClick={
                  submitRequest
                }
                className="mt-4 w-full rounded-xl bg-cyan-500 py-3 font-bold text-slate-950 hover:bg-cyan-400"
              >
                신청하기
              </button>
            </>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-bold">
            고정 파트너 현황
          </h2>
          <div className="mt-4 space-y-2">
            {assignments
              .map((assignment) => {
                const player =
                  members.find(
                    (item) =>
                      item.id ===
                      assignment.playerAId
                  ) ??
                  players.find(
                    (item) =>
                      item.id ===
                      assignment.playerAId
                  );
                const partner =
                  members.find(
                    (item) =>
                      item.id ===
                      assignment.playerBId
                  ) ??
                  players.find(
                    (item) =>
                      item.id ===
                      assignment.playerBId
                  );

                return player &&
                  partner ? (
                  <div
                    key={assignment.id}
                    className="rounded-xl bg-slate-800 px-4 py-3"
                  >
                    {player.name} ↔{" "}
                    {partner.name}
                  </div>
                ) : null;
              })}
          </div>
        </section>
      </div>
    </main>
  );
}
