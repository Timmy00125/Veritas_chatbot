import Chat from "@/components/Chat";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#fef3c7,_transparent_48%),radial-gradient(circle_at_top_right,_#cffafe,_transparent_40%),linear-gradient(180deg,_#fff7ed,_#ffffff_40%,_#f8fafc)] px-3 pb-4 pt-4 text-slate-900 sm:px-5 sm:pb-6 sm:pt-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col sm:min-h-[calc(100dvh-3rem)]">
        <header className="w-full px-2 pb-4 pt-2 sm:px-3 sm:pb-6 sm:pt-4">
          <h1 className="bg-gradient-to-r from-cyan-700 via-cyan-600 to-amber-500 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
            Veritas Chatbot
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">
            Your personal AI school assistant for admissions, deadlines, and
            campus guidance.
          </p>
        </header>

        <div className="min-h-0 flex-1 rounded-[1.6rem] border border-white/70 bg-white/70 p-1 shadow-[0_16px_60px_-20px_rgba(14,116,144,0.45)] backdrop-blur">
          <Chat />
        </div>
      </div>
    </main>
  );
}
