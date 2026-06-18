import {
  Navigate,
  useNavigate,
} from "react-router-dom";

import {
  getRolePath,
  useAccessSession,
} from "@/auth/access";

const roles = [
  {
    label: "Admin",
    description:
      "경기 운영, 코트 관리, 참가자 관리를 진행합니다.",
    path: "/join/admin",
    className:
      "bg-cyan-500 hover:bg-cyan-400 text-slate-950",
  },
  {
    label: "Player",
    description:
      "오늘 STEP UP MATCH 모임에 참가 신청합니다.",
    path: "/join/player",
    className:
      "bg-emerald-500 hover:bg-emerald-400 text-slate-950",
  },
  {
    label: "Master",
    description:
      "전체 경기 현황과 선수 통계를 확인합니다.",
    path: "/join/master",
    className:
      "bg-purple-500 hover:bg-purple-400 text-white",
  },
];

export default function RoleSelectPage() {
  const navigate = useNavigate();
  const session =
    useAccessSession();

  if (session) {
    return (
      <Navigate
        to={getRolePath(
          session.role
        )}
        replace
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold">
            STEP UP MATCH
          </h1>

          <p className="text-slate-400 mt-2">
            접속할 권한을 선택하세요.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {roles.map((role) => (
            <button
              key={role.label}
              onClick={() =>
                navigate(role.path)
              }
              className={`
                rounded-3xl
                border
                border-slate-800
                bg-slate-900
                p-6
                text-left
                transition
                hover:border-slate-600
              `}
            >
              <div
                className={`
                  mb-6
                  inline-flex
                  rounded-2xl
                  px-5
                  py-3
                  text-lg
                  font-bold
                  transition
                  ${role.className}
                `}
              >
                {role.label}
              </div>

              <div className="text-slate-300">
                {role.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
