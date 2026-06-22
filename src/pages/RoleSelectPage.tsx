import {
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

import {
  getRolePath,
  useAccessSession,
} from "@/auth/access";

const PUBLIC_APP_URL =
  import.meta.env.VITE_PUBLIC_APP_URL ??
  "https://zzzandi.github.io/step-up-match/";

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
  {
    label: "Guest",
    description:
      "모임원이 아닌 게스트가 이름과 성별, 급수를 입력해 참가합니다.",
    path: "/join/guest",
    className:
      "bg-orange-500 hover:bg-orange-400 text-slate-950",
  },
];

export default function RoleSelectPage() {
  const navigate = useNavigate();
  const session =
    useAccessSession();
  const [qrCodeUrl, setQrCodeUrl] =
    useState("");
  const [copied, setCopied] =
    useState(false);

  useEffect(() => {
    QRCode.toDataURL(
      PUBLIC_APP_URL,
      {
        width: 320,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
        errorCorrectionLevel: "H",
      }
    )
      .then(setQrCodeUrl)
      .catch(console.error);
  }, []);

  async function copyAddress() {
    await navigator.clipboard.writeText(
      PUBLIC_APP_URL
    );
    setCopied(true);
    window.setTimeout(
      () => setCopied(false),
      1600
    );
  }

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

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
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

        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
          <div className="grid items-center gap-8 p-6 md:grid-cols-[1fr_auto] md:p-8">
            <div>
              <div className="mb-3 inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">
                고정 접속 주소
              </div>

              <h2 className="text-2xl font-bold">
                주소를 입력하거나 QR을 찍어 접속하세요
              </h2>

              <p className="mt-2 text-slate-400">
                이 주소는 저장소 이름이나 GitHub 계정을 바꾸지 않는 한
                그대로 유지됩니다.
              </p>

              <a
                href={PUBLIC_APP_URL}
                className="mt-5 block break-all rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-cyan-300 hover:border-cyan-500"
              >
                {PUBLIC_APP_URL}
              </a>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={copyAddress}
                  className="rounded-xl bg-cyan-500 px-4 py-2 font-bold text-slate-950 transition hover:bg-cyan-400"
                >
                  {copied
                    ? "복사 완료"
                    : "주소 복사"}
                </button>

                {qrCodeUrl && (
                  <a
                    href={qrCodeUrl}
                    download="step-up-match-qr.png"
                    className="rounded-xl bg-slate-800 px-4 py-2 font-bold text-slate-200 transition hover:bg-slate-700"
                  >
                    QR 이미지 저장
                  </a>
                )}
              </div>
            </div>

            <div className="mx-auto rounded-3xl bg-white p-4 shadow-2xl shadow-cyan-950/40">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="STEP UP MATCH 고정 접속 주소 QR 코드"
                  className="h-56 w-56"
                />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center text-slate-500">
                  QR 생성 중...
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
