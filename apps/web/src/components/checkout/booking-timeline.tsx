"use client";

import { CircleDot } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { formatDate } from "@/i18n/format";
import { cn } from "@/lib/utils";

export function BookingTimeline({
  events,
  title,
  emptyLabel,
}: {
  events: { to_status: string; reason?: string | null; created_at: string }[];
  title: string;
  emptyLabel?: string;
}) {
  const { locale } = useLocale();
  return (
    <section
      className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-7"
      aria-label={title}
    >
      <h2 className="title-card">{title}</h2>
      {events.length === 0 && emptyLabel ? <p className="text-sm text-text-muted">{emptyLabel}</p> : null}
      <ol className="grid">
        {events.map((event, index) => {
          const last = index === events.length - 1;
          let when = event.created_at;
          try {
            when = formatDate(locale, event.created_at, { dateStyle: "medium", timeStyle: "short" });
          } catch {
            when = event.created_at;
          }
          return (
            <li key={`${event.created_at}-${index}`} className="grid grid-cols-[1.5rem_1fr] gap-3">
              <div className="flex flex-col items-center">
                <CircleDot className={cn("size-5 shrink-0", last ? "text-accent" : "text-text-muted")} aria-hidden />
                {last ? null : <span className="w-px flex-1 bg-border-subtle" aria-hidden />}
              </div>
              <div className={cn("grid gap-0.5", last ? "pb-0" : "pb-5")}>
                <p className="font-semibold capitalize">{event.to_status}</p>
                {event.reason ? <p className="text-sm text-text-muted">{event.reason}</p> : null}
                <p className="text-xs text-text-muted">{when}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
