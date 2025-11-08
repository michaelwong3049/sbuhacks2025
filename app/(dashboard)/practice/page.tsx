import PracticeClient from "@/components/practice/practice-client";

export default function PracticePage() {
  return (
    <div className="flex justify-center">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50">Practice Session</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Select an instrument and start playing</p>
        </div>

        <PracticeClient />
      </main>
    </div>
  );
}
