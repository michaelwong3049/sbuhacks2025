"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

export function Breadcrumbs() {
  const pathname = usePathname();
  
  // Split the pathname into segments and filter out empty strings
  const segments = pathname.split("/").filter(Boolean);
  
  // Create breadcrumb items
  const breadcrumbs = segments.map((segment, index) => {
    // Build the href for each breadcrumb
    const href = "/" + segments.slice(0, index + 1).join("/");
    
    // Capitalize and format the segment name
    const label = segment
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    
    return {
      label,
      href,
      isLast: index === segments.length - 1,
    };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {/* Home icon as first breadcrumb */}
      <Link
        href="/dashboard"
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {breadcrumbs.length > 0 && (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
      
      {/* Render breadcrumb items */}
      {breadcrumbs.map((breadcrumb, index) => (
        <Fragment key={breadcrumb.href}>
          {breadcrumb.isLast ? (
            <span className="font-medium text-foreground">
              {breadcrumb.label}
            </span>
          ) : (
            <>
              <Link
                href={breadcrumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {breadcrumb.label}
              </Link>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

