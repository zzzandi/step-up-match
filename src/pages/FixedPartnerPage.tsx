import {
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

export default function FixedPartnerPage() {
  const session =
    useAccessSession();
  const [
    selectedPartnerId,
    setSelectedPartnerId,
  ] = useState("");
  const [message, setMessage] =
    useState("");
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
  const currentPartner =
    currentPlayer?.fixedPartner
      ? players.find(
          (player) =>
            player.id ===
            currentPlayer.fixedPartner
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
    players.filter(
      (player) =>
        player.id !==
          currentUserId &&
        player.status !== "LEFT"
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
      selectedPartnerId
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
            {players
              .filter(
                (player) =>
                  player.fixedPartner &&
                  player.id <
                    player.fixedPartner
              )
              .map((player) => {
                const partner =
                  players.find(
                    (item) =>
                      item.id ===
                      player.fixedPartner
                  );

                return partner ? (
                  <div
                    key={player.id}
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
