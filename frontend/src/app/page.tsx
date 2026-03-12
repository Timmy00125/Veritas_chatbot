import Chat from "@/components/Chat";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-[family-name:var(--font-geist-sans)]">
      <header className="w-full max-w-4xl pt-6 pb-4 md:py-8 pl-4">
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
          Veritas Chatbot
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Your personal AI school assistant
        </p>
      </header>
      
      <div className="w-full max-w-4xl flex-1 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl shadow-blue-900/5 bg-white dark:bg-slate-900">
        <Chat />
      </div>
    </main>
  );
}
