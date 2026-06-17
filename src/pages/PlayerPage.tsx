import {
    useEffect,
    useState,
  } from "react";
  
  import {
    getUsers,
  } from "@/services/supabaseUserService";
  
  import {
    useMatchStore,
  } from "@/store/useMatchStore";
  
  export default function PlayerPage() {
    const players =
      useMatchStore(
        (state) => state.players
      );
  
    const [users, setUsers] =
      useState<any[]>([]);
  
    useEffect(() => {
      getUsers()
        .then(setUsers)
        .catch(console.error);
    }, []);
  
    const me =
      players[0];
  
    if (!me) {
      return (
        <div className="min-h-screen bg-slate-950 text-white p-6">
          <h1 className="text-4xl font-bold mb-8">
            PLAYER
          </h1>
  
          <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800">
            플레이어가 없습니다.
          </div>
  
          <div className="mt-8 rounded-3xl bg-slate-900 p-6 border border-slate-800">
            <h2 className="text-xl font-bold mb-4">
              Supabase Users
            </h2>
  
            {users.map(
              (user) => (
                <div
                  key={
                    user.id
                  }
                  className="py-2 border-b border-slate-800"
                >
                  {
                    user.name
                  }
                </div>
              )
            )}
          </div>
        </div>
      );
    }
  
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <h1 className="text-4xl font-bold mb-8">
          PLAYER
        </h1>
  
        <div className="grid gap-4">
          <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800">
            <div className="text-slate-400">
              이름
            </div>
  
            <div className="text-2xl font-bold">
              {me.name}
            </div>
          </div>
  
          <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800">
            <div className="text-slate-400">
              상태
            </div>
  
            <div className="text-2xl font-bold">
              {me.status}
            </div>
          </div>
  
          <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800">
            <div className="text-slate-400">
              오늘 경기 수
            </div>
  
            <div className="text-2xl font-bold">
              {me.matchCount}
            </div>
          </div>
  
          <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800">
            <div className="text-slate-400">
              휴식시간
            </div>
  
            <div className="text-2xl font-bold">
              {me.restMinutes}분
            </div>
          </div>
        </div>
  
        <div className="mt-8 rounded-3xl bg-slate-900 p-6 border border-slate-800">
          <h2 className="text-xl font-bold mb-4">
            Supabase Users
          </h2>
  
          {users.map(
            (user) => (
              <div
                key={
                  user.id
                }
                className="py-2 border-b border-slate-800"
              >
                {user.name}
              </div>
            )
          )}
        </div>
      </div>
    );
  }