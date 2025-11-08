"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
        <Sun className="h-4 w-4 shrink-0" />
        <span className="group-data-[collapsible=icon]:hidden">Theme</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
    >
      {theme === "light" ? (
        <>
          <Sun className="h-4 w-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Light Mode</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Dark Mode</span>
        </>
      )}
    </button>
  );
}
