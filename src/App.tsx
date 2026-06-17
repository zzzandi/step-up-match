import { useState } from "react";

import AdminPage from "@/pages/AdminPage";
import PlayerPage from "@/pages/PlayerPage";
import MasterPage from "@/pages/MasterPage";
import JoinPage from "@/pages/JoinPage";

type PageType =
  | "ADMIN"
  | "PLAYER"
  | "MASTER"
  | "JOIN";

function App() {
  const [page, setPage] =
    useState<PageType>(
      "ADMIN"
    );

  return (
    <div>
      <div
        className="
          fixed
          top-4
          right-4
          z-50
          flex
          gap-2
        "
      >
        <button
          onClick={() =>
            setPage("ADMIN")
          }
          className="
            px-4
            py-2
            rounded-xl
            bg-slate-800
            text-white
          "
        >
          Admin
        </button>

        <button
          onClick={() =>
            setPage("PLAYER")
          }
          className="
            px-4
            py-2
            rounded-xl
            bg-slate-800
            text-white
          "
        >
          Player
        </button>

        <button
          onClick={() =>
            setPage("MASTER")
          }
          className="
            px-4
            py-2
            rounded-xl
            bg-slate-800
            text-white
          "
        >
          Master
        </button>

        <button
          onClick={() =>
            setPage("JOIN")
          }
          className="
            px-4
            py-2
            rounded-xl
            bg-green-600
            text-white
          "
        >
          Join
        </button>
      </div>

      {page ===
        "ADMIN" && (
        <AdminPage />
      )}

      {page ===
        "PLAYER" && (
        <PlayerPage />
      )}

      {page ===
        "MASTER" && (
        <MasterPage />
      )}

      {page ===
        "JOIN" && (
        <JoinPage />
      )}
    </div>
  );
}

export default App;