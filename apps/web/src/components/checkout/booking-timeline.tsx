"use client";

export function BookingTimeline({
  events,
  title,
}: {
  events: { to_status: string; reason?: string | null; created_at: string }[];
  title: string;
}) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ol className="grid gap-2">
        {events.map((event, index) => (
          <li key={`${event.created_at}-${index}`} className="rounded-card border border-border p-3 text-sm">
            <p className="font-medium">{event.to_status}</p>
            {event.reason ? <p className="text-text-muted">{event.reason}</p> : null}
            <p className="text-xs text-text-muted">{event.created_at}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
