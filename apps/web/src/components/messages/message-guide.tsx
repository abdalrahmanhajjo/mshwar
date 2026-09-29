"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { startConversation, useMessagesCopy } from "@/lib/guide-messages";
import { withLocalePrefix } from "@/lib/locale";

/** "Message the guide": a short form that opens the conversation. */
export function MessageGuide({ guideSlug, next }: { guideSlug: string; next: string }) {
  const copy = useMessagesCopy();
  const { user } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  if (!user) {
    return (
      <Button asChild variant="outline">
        <LocaleLink href={`/signin?next=${encodeURIComponent(next)}`}>
          <MessageCircle aria-hidden />
          {copy.signIn}
        </LocaleLink>
      </Button>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const thread = await startConversation(guideSlug, body.trim());
      router.push(withLocalePrefix(locale, `/messages/${thread.id}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <MessageCircle aria-hidden />
        {copy.messageGuide}
      </Button>
    );
  }
  return (
    <form className="grid gap-2" onSubmit={onSubmit}>
      <Label htmlFor={`${id}-body`}>{copy.messageGuide}</Label>
      <Textarea
        id={`${id}-body`}
        rows={3}
        maxLength={2000}
        placeholder={copy.firstPlaceholder}
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <p className="text-xs text-text-muted">{copy.contactClosed}</p>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div>
        <Button type="submit" disabled={pending || !body.trim()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {copy.startSend}
        </Button>
      </div>
    </form>
  );
}
