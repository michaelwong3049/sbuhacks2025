import JamSessionClient from "@/components/jam/jam-session-client";

export default function JamSessionPage() {
  return (
    <div className="flex justify-center">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50">🎵 Jam Session</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Play music together in real-time with friends!</p>
        </div>

        <JamSessionClient />
      </main>
    </div>
  );
}

