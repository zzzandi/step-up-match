import WorkoutReportPanel from "@/components/report/WorkoutReportPanel";

export default function WorkoutReportPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-screen-lg space-y-4">
        <section>
          <div className="text-sm font-black uppercase tracking-wide text-cyan-300">
            MASTER ONLY
          </div>
          <h1 className="mt-2 text-3xl font-black">
            운동 리포트
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            오늘 운동 전체 종료 시 저장된 리포트를 다시 확인합니다. 이 화면은 마스터 계정에서만 접근할 수 있습니다.
          </p>
        </section>

        <WorkoutReportPanel preferSnapshot />
      </div>
    </main>
  );
}
