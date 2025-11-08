export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-card-foreground mb-2">Welcome to Your Dashboard</h2>
        <p className="text-muted-foreground">Get started with your music learning journey.</p>
      </div>

      {/* Grid layout for cards - responsive */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Practice Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">🎵</span>
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">Practice</h3>
          </div>
          <p className="text-sm text-muted-foreground">Start practicing with interactive lessons</p>
        </div>

        {/* Learn Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">📚</span>
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">Learn</h3>
          </div>
          <p className="text-sm text-muted-foreground">Explore music theory and concepts</p>
        </div>

        {/* Progress Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">Progress</h3>
          </div>
          <p className="text-sm text-muted-foreground">Track your learning achievements</p>
        </div>
      </div>
    </div>
  );
}
