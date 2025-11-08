import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Separator } from "@/components/ui/separator";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="flex flex-col flex-1 overflow-hidden">
        {/* Header with sidebar trigger and breadcrumbs */}
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="text-foreground hover:bg-accent hover:text-accent-foreground" />
            <Separator orientation="vertical" className="h-6 bg-border" />
            <Breadcrumbs />
          </div>
        </header>

        {/* Main content area - responsive padding and max-width */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
