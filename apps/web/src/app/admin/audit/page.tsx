"use client";
import { FormEvent, useState } from "react";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { securityFetch } from "@/lib/security";
const labels = {
  en: { title: "Audit log", action: "Action", target: "Target type", actor: "Actor UUID", since: "From", until: "Until", query: "Target ID or reason", search: "Search", empty: "No events found.", error: "Unable to load audit events.", next: "Next", prev: "Previous", time: "Time", reason: "Reason" },
  fr: { title: "Journal d’audit", action: "Action", target: "Type de cible", actor: "UUID de l’acteur", since: "Depuis", until: "Jusqu’au", query: "Identifiant ou motif", search: "Rechercher", empty: "Aucun événement.", error: "Impossible de charger le journal.", next: "Suivant", prev: "Précédent", time: "Date", reason: "Motif" },
  ar: { title: "سجل التدقيق", action: "الإجراء", target: "نوع المورد", actor: "معرّف المنفّذ", since: "من", until: "حتى", query: "معرّف المورد أو السبب", search: "بحث", empty: "لا توجد أحداث.", error: "تعذّر تحميل السجل.", next: "التالي", prev: "السابق", time: "الوقت", reason: "السبب" },
};
type Event = { id: string; actor_id: string | null; action: string; target_type: string; target: Record<string, string>; reason: string; created_at: string; request_id: string };
export default function AuditPage() {
  const { locale } = useLocale(); const copy = labels[locale];
  const [filters, setFilters] = useState({ action: "", target: "", actor: "", since: "", until: "", q: "" });
  const [events, setEvents] = useState<Event[]>([]); const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function load(next = 1) {
    setPending(true); setError("");
    const params = new URLSearchParams({ page: String(next), page_size: "25" });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, key === "since" || key === "until" ? new Date(value).toISOString() : value);
    try { const response = await securityFetch(`/api/v1/admin/audit?${params}`, { credentials: "include" }); if (!response.ok) throw new Error(); const data = await response.json(); setEvents(data.items); setTotal(data.total); setPage(next); }
    catch { setError(copy.error); } finally { setPending(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void load(); }
  return <section className="grid min-w-0 gap-6"><h1 className="text-3xl font-semibold">{copy.title}</h1>
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(Object.keys(filters) as (keyof typeof filters)[]).map(key => <label key={key} className="grid gap-2">{copy[key === "q" ? "query" : key]}<Input type={key === "since" || key === "until" ? "datetime-local" : "text"} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })} /></label>)}
      <Button disabled={pending} type="submit">{copy.search}</Button>
    </form>
    {error && <p role="alert">{error}</p>}
    <div className="overflow-auto"><table className="w-full text-start text-sm"><caption className="sr-only">{copy.title}</caption><thead><tr>{[copy.time, copy.actor, copy.action, copy.target, copy.reason].map(label => <th scope="col" className="p-3 text-start" key={label}>{label}</th>)}</tr></thead><tbody>{events.map(event => <tr className="border-t border-border" key={event.id}><td className="p-3"><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(locale)}</time></td><td className="p-3"><bdi>{event.actor_id ?? "system"}</bdi></td><td className="p-3">{event.action}</td><td className="p-3">{event.target_type}<pre className="max-w-64 whitespace-pre-wrap break-all">{JSON.stringify(event.target)}</pre></td><td className="p-3">{event.reason}</td></tr>)}</tbody></table></div>
    {!events.length && <p role="status">{copy.empty}</p>}
    <div className="flex gap-3"><Button variant="outline" disabled={pending || page <= 1} onClick={() => void load(page - 1)}>{copy.prev}</Button><span className="self-center">{page} / {Math.max(1, Math.ceil(total / 25))}</span><Button variant="outline" disabled={pending || page * 25 >= total} onClick={() => void load(page + 1)}>{copy.next}</Button></div>
  </section>;
}
