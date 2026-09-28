import { ChevronRight } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import type { Crumb } from "@/lib/seo/schema";
import { cn, focusRing } from "@/lib/utils";

/**
 * The visible trail that matches the page's BreadcrumbList data. The last crumb is the
 * current page and is not a link. `tone="inverse"` sits on photos.
 */
export function Breadcrumbs({
  crumbs,
  label,
  tone = "default",
  className,
}: {
  crumbs: Crumb[];
  /** Accessible name for the nav, e.g. "Breadcrumb". */
  label: string;
  tone?: "default" | "inverse";
  className?: string;
}) {
  const inverse = tone === "inverse";
  return (
    <nav aria-label={label} className={className}>
      <ol
        className={cn(
          "flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm",
          inverse ? "text-white/85" : "text-text-muted",
        )}
      >
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="inline-flex min-w-0 items-center gap-1.5">
              {last ? (
                <span aria-current="page" className={cn("truncate", inverse ? "text-white" : "text-text")}>
                  {crumb.name}
                </span>
              ) : (
                <>
                  <LocaleLink
                    href={crumb.path}
                    className={cn(
                      "inline-flex min-h-8 items-center rounded-sm underline-offset-4 hover:underline",
                      inverse ? "hover:text-white" : "hover:text-text",
                      focusRing,
                    )}
                  >
                    {crumb.name}
                  </LocaleLink>
                  <ChevronRight className="size-3.5 shrink-0 opacity-70 rtl:-scale-x-100" aria-hidden />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
