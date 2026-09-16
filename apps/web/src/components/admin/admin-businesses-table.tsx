"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Building2, Check, FileText } from "lucide-react";
import { AdminHeader, EmptyRow, ReasonField, TableShell } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { statusTone } from "@/lib/status";
import { Input } from "@/components/ui/input";
import { useAdminCopy } from "@/lib/admin-copy";
import {
  getVerificationCase,
  listVerificationQueue,
  transitionVerification,
  type VerificationCase,
  type VerificationRow,
} from "@/lib/admin";

export function AdminBusinessesTable() {
  const copy = useAdminCopy();
  const [rows, setRows] = React.useState<VerificationRow[]>([]);
  const [reason, setReason] = React.useState("Documents reviewed");
  const [status, setStatus] = React.useState("");
  const [sla, setSla] = React.useState("");
  const [detail, setDetail] = React.useState<VerificationCase | null>(null);

  const reload = React.useCallback(async () => {
    const params = new URLSearchParams();
    if (status) {
      params.set("verification", status);
    }
    if (sla) {
      params.set("sla_hours_min", sla);
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    try {
      setRows(await listVerificationQueue(suffix));
    } catch {
      setRows([]);
    }
  }, [sla, status]);

  React.useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (status) {
      params.set("verification", status);
    }
    if (sla) {
      params.set("sla_hours_min", sla);
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    void listVerificationQueue(suffix)
      .then((next) => {
        if (!cancelled) {
          setRows(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sla, status]);

  async function act(id: string, action: "verify" | "reject" | "suspend" | "re-verify") {
    await transitionVerification(id, action, reason);
    await reload();
    if (detail?.id === id) {
      setDetail(await getVerificationCase(id));
    }
  }

  return (
    <div className="grid gap-8">
      <AdminHeader title={copy.queueTitle} description={copy.reasonRequired} />
      <div className="grid gap-4 rounded-card border border-border-subtle bg-surface-sunken/70 p-4 md:grid-cols-[2fr_1fr_1fr] md:items-end">
        <ReasonField id="verification-reason" value={reason} onChange={setReason} />
        <label className="grid gap-2 text-label font-medium">
          {copy.filterStatus}
          <NativeSelect
            aria-label={copy.filterStatus}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">—</option>
            {["pending", "verified", "rejected", "suspended"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-2 text-label font-medium">
          {copy.slaHours}
          <Input
            aria-label={copy.slaHours}
            inputMode="numeric"
            value={sla}
            onChange={(event) => setSla(event.target.value)}
          />
        </label>
      </div>
      <TableShell>
        <thead>
          <tr>
            <th scope="col">{copy.nameCol}</th>
            <th scope="col">{copy.statusCol}</th>
            <th scope="col">{copy.slaHours}</th>
            <th scope="col">{copy.documents}</th>
            <th scope="col">{copy.actionsCol}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={5} label={copy.queueEmpty} /> : null}
          {rows.map((row) => (
            <tr key={row.id} className={detail?.id === row.id ? "[&>td]:bg-brand-subtle/40" : undefined}>
              <td>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 font-semibold underline-offset-4 hover:underline"
                  onClick={() => void getVerificationCase(row.id).then(setDetail)}
                >
                  <Building2 className="size-4 text-text-muted" aria-hidden />
                  {row.name}
                </button>
              </td>
              <td>
                <Badge variant={statusTone(row.verification)}>{row.verification}</Badge>
              </td>
              <td className="tabular-nums">{row.sla_hours ?? "—"}</td>
              <td className="tabular-nums">{row.document_count ?? 0}</td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" onClick={() => void act(row.id, "verify")}>
                    <Check aria-hidden />
                    {copy.approve}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void act(row.id, "reject")}>
                    {copy.reject}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void act(row.id, "suspend")}>
                    {copy.suspend}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void act(row.id, "re-verify")}>
                    {copy.reVerify}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      {detail ? (
        <section
          className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:grid-cols-2 md:p-7"
          aria-label={copy.documents}
        >
          <div className="grid content-start gap-3">
            <h2 className="title-card">{detail.name}</h2>
            <Badge variant={detail.verified_badge ? "success" : "outline"} className="w-fit">
              {detail.verified_badge ? copy.verifiedBadge : copy.notVerified}
            </Badge>
            <h3 className="mt-2 text-sm font-semibold">{copy.documents}</h3>
            <ul className="grid gap-2">
              {detail.documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-2 rounded-control bg-surface-sunken px-3.5 py-2.5 text-sm"
                >
                  <FileText className="size-4 text-text-muted" aria-hidden />
                  {doc.signed_url ? (
                    <a href={doc.signed_url} className="font-medium underline underline-offset-4">
                      {doc.filename}
                    </a>
                  ) : (
                    doc.filename
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-3">
            <h3 className="text-sm font-semibold">{copy.timeline}</h3>
            <ol className="grid gap-2 text-sm">
              {detail.events.map((event) => (
                <li key={event.id} className="grid gap-0.5 border-s-2 border-border-subtle ps-3">
                  <span className="font-semibold capitalize">{event.decision}</span>
                  <span className="text-text-muted">{event.reason}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
    </div>
  );
}
