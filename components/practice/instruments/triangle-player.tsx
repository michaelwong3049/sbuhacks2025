"use client";

export default function TrianglePlayer() {
  return (
    <div className="w-full max-w-2xl flex flex-col items-center gap-6 p-8">
      <div className="w-full aspect-video rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔺</div>
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Triangle Coming Soon
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This instrument is currently in development
          </p>
        </div>
      </div>
    </div>
  );
}

