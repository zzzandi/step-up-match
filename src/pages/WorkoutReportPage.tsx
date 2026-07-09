import WorkoutReportPanel from "@/components/report/WorkoutReportPanel";

export default function WorkoutReportPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-screen-lg space-y-4">
        <section>
          <div className="text-sm font-black uppercase tracking-wide text-cyan-300">
            MANAGER REPORT
          </div>
          <h1 className="mt-2 text-3xl font-black">
            운동 리포트
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            오늘 운동의 실시간 리포트와 저장된 운동 리포트를 확인합니다. 이 화면은 운영진과 마스터 계정에서 접근할 수 있습니다.
          </p>
        </section>

        <WorkoutReportPanel preferSnapshot />
      </div>
    </main>
  );
}
