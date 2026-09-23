"use client";

import * as React from "react";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { useGuideTrustCopy } from "@/lib/guide-trust-copy";
import { reportGuideDay, type GuideReportInput } from "@/lib/guides";

type Category = GuideReportInput["category"];

/** "Report a problem" for one day, from either side. Opens a support case. */
export function ReportProblem({ engagementId, bookingId }: { engagementId?: string; bookingId?: string }) {
  const copy = useGuideTrustCopy();
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<Category>("other");
  const [details, setDetails] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState<null | boolean>(null);
  const [error, setError] = React.useState<string | null>(null);
  const id = engagementId ?? bookingId ?? "day";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await reportGuideDay({
        category,
        details: details.trim(),
        engagement_id: engagementId,
        booking_id: bookingId,
      });
      setSent(result.escalated);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setPending(false);
    }
  }

  if (sent !== null) {
    return (
      <Notice tone="success" role="status">
        {sent ? copy.reportSentSafety : copy.reportSent}
      </Notice>
    );
  }
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="w-fit print:hidden" onClick={() => setOpen(true)}>
        <Flag aria-hidden />
        {copy.reportOpen}
      </Button>
    );
  }
  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 print:hidden"
      aria-label={copy.reportTitle}
    >
      <h3 className="font-semibold">{copy.reportTitle}</h3>
      <div className="grid gap-1.5 sm:max-w-xs">
        <Label htmlFor={`report-kind-${id}`}>{copy.reportCategory}</Label>
        <NativeSelect
          id={`report-kind-${id}`}
          value={category}
          onChange={(event) => setCategory(event.target.value as Category)}
        >
          <option value="safety">{copy.reportSafety}</option>
          <option value="no_show">{copy.reportNoShow}</option>
          <option value="payment">{copy.reportPayment}</option>
          <option value="conduct">{copy.reportConduct}</option>
          <option value="other">{copy.reportOther}</option>
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`report-details-${id}`}>{copy.reportDetails}</Label>
        <Textarea
          id={`report-details-${id}`}
          rows={3}
          minLength={10}
          maxLength={4000}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || details.trim().length < 10}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Flag aria-hidden />}
          {copy.reportSend}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {copy.reportCancel}
        </Button>
      </div>
    </form>
  );
}
