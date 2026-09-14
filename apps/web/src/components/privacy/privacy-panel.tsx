"use client";
import { ConsentControls } from "@/components/privacy/consent-controls";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOutAccount } from "@/lib/auth";
import { withLocalePrefix } from "@/lib/locale";
import { deleteAccount, downloadDataExport, resetPersonalisation } from "@/lib/privacy";
import { usePrivacyCopy } from "@/lib/privacy-copy";
import { useLocale } from "@/components/shell/locale-provider";

export function PrivacyPanel() {
  const copy = usePrivacyCopy();
  const { locale } = useLocale();
  const router = useRouter();
  const [confirmation, setConfirmation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function run(action: () => Promise<void>, done: string) {
    setPending(true);
    setError(null);
    try {
      await action();
      setStatus(done);
    } catch {
      setError(copy.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="grid gap-6" aria-labelledby="privacy-heading">
      <header>
        <h2 id="privacy-heading" className="text-3xl font-semibold tracking-tight">
          {copy.privacyTitle}
        </h2>
        <p className="mt-3 text-text-muted">{copy.privacyBody}</p>
      </header>

      <ConsentControls />

      <Card>
        <CardHeader>
          <CardTitle>{copy.exportTitle}</CardTitle>
          <CardDescription>{copy.exportBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" disabled={pending} onClick={() => void run(downloadDataExport, copy.exportDone)}>
            {copy.exportAction}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.resetTitle}</CardTitle>
          <CardDescription>{copy.resetBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => void run(resetPersonalisation, copy.resetDone)}
          >
            {copy.resetAction}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.deleteTitle}</CardTitle>
          <CardDescription>{copy.deleteBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="delete-confirm">{copy.deleteConfirm}</Label>
          <Input
            id="delete-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending || confirmation.trim().toUpperCase() !== "DELETE"}
            onClick={() =>
              void run(async () => {
                await deleteAccount(confirmation);
                await signOutAccount();
                router.replace(withLocalePrefix(locale, "/"));
              }, copy.deleteTitle)
            }
          >
            {copy.deleteAction}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.retentionTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-text-muted">
          <p>{copy.retentionProfile}</p>
          <p>{copy.retentionTrips}</p>
          <p>{copy.retentionFavorites}</p>
          <p>{copy.retentionReviews}</p>
          <p>{copy.retentionBookings}</p>
          <p>{copy.retentionPayments}</p>
        </CardContent>
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-text">
          {status}
        </p>
      ) : null}
    </section>
  );
}
