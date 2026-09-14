"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAdminCopy } from "@/lib/admin-copy";
import { getVerificationCase, listVerificationQueue, transitionVerification, type VerificationCase, type VerificationRow } from "@/lib/admin";

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
    void reload();
  }, [reload]);

  async function act(id: string, action: "verify" | "reject" | "suspend" | "re-verify") {
    await transitionVerification(id, action, reason);
    await reload();
    if (detail?.id === id) {
      setDetail(await getVerificationCase(id));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.queueTitle}</CardTitle>
        <CardDescription>{copy.reasonRequired}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <label className="grid gap-1 text-sm">
          {copy.reasonRequired}
          <Input aria-label="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          <label className="grid gap-1 text-sm">
            {copy.filterStatus}
            <Input aria-label={copy.filterStatus} value={status} onChange={(event) => setStatus(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            {copy.slaHours}
            <Input aria-label={copy.slaHours} value={sla} onChange={(event) => setSla(event.target.value)} />
          </label>
        </div>
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">{copy.slaHours}</th>
              <th className="py-2 font-medium">{copy.documents}</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border">
                <td className="py-2">
                  <button type="button" className="underline" onClick={() => void getVerificationCase(row.id).then(setDetail)}>
                    {row.name}
                  </button>
                </td>
                <td className="py-2">{row.verification}</td>
                <td className="py-2">{row.sla_hours ?? "—"}</td>
                <td className="py-2">{row.document_count ?? 0}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => void act(row.id, "verify")}>
                      {copy.approve}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void act(row.id, "reject")}>
                      {copy.reject}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void act(row.id, "suspend")}>
                      {copy.suspend}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void act(row.id, "re-verify")}>
                      {copy.reVerify}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {detail ? (
          <section className="grid gap-2 rounded-card border border-border p-3" aria-label={copy.documents}>
            <h3 className="text-sm font-semibold">{detail.name}</h3>
            <p className="text-sm text-text-muted">Badge: {detail.verified_badge ? "verified" : "not verified"}</p>
            <ul className="grid gap-2">
              {detail.documents.map((doc) => (
                <li key={doc.id}>
                  {doc.signed_url ? (
                    <a href={doc.signed_url} className="underline">
                      {doc.filename}
                    </a>
                  ) : (
                    doc.filename
                  )}
                </li>
              ))}
            </ul>
            <ul className="text-sm text-text-muted">
              {detail.events.map((event) => (
                <li key={event.id}>
                  {event.decision}: {event.reason}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
