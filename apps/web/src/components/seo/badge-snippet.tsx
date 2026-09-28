"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/site";
import { cn, focusRing } from "@/lib/utils";

export type BadgeCopy = {
  urlLabel: string;
  urlHint: string;
  urlError: string;
  styleLabel: string;
  light: string;
  dark: string;
  codeLabel: string;
  copy: string;
  copied: string;
  preview: string;
};

/** Only links back to this site are offered, so the badge can never point elsewhere. */
function pageUrl(input: string): string | null {
  try {
    const url = new URL(input.trim() || SITE_URL);
    const site = new URL(SITE_URL);
    if (url.hostname !== site.hostname && url.hostname !== `www.${site.hostname}`) return null;
    url.hostname = site.hostname;
    url.protocol = "https:";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Builds the HTML a partner pastes into their site: a plain link with the badge image.
 * A normal (followed) link from a real partner is exactly the kind search engines trust.
 */
export function BadgeSnippet({ copy }: { copy: BadgeCopy }) {
  const [input, setInput] = React.useState("");
  const [tone, setTone] = React.useState<"light" | "dark">("light");
  const [copied, setCopied] = React.useState(false);
  const href = pageUrl(input);
  const image = `${SITE_URL}/badges/find-us-on-mshwar-${tone}.svg`;
  const code = href
    ? `<a href="${escapeAttr(href)}" title="Find us on Mshwar"><img src="${image}" alt="Find us on Mshwar" width="232" height="56" loading="lazy"></a>`
    : "";

  async function onCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code stays selectable in the box.
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <label htmlFor="badge-url" className="font-semibold">
          {copy.urlLabel}
        </label>
        <input
          id="badge-url"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={`${SITE_URL}/experiences/…`}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-invalid={href ? undefined : true}
          aria-describedby="badge-url-hint"
          className={cn(
            "h-12 rounded-[0.75rem] border border-border bg-surface-raised px-4 text-base text-text",
            "focus-visible:border-brand focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/15",
            !href && "border-danger",
          )}
        />
        <p id="badge-url-hint" className={cn("text-sm", href ? "text-text-muted" : "text-danger")}>
          {href ? copy.urlHint : copy.urlError}
        </p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 font-semibold">{copy.styleLabel}</legend>
        <div className="flex gap-2">
          {(["light", "dark"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border px-4 text-sm font-medium",
                tone === value ? "border-brand bg-brand-subtle" : "border-border-subtle",
              )}
            >
              <input
                type="radio"
                name="badge-tone"
                value={value}
                checked={tone === value}
                onChange={() => setTone(value)}
                className="accent-[var(--brand)]"
              />
              {value === "light" ? copy.light : copy.dark}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <p className="font-semibold">{copy.preview}</p>
        <div className="rounded-card border border-border-subtle bg-surface-sunken p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/badges/find-us-on-mshwar-${tone}.svg`} alt="Find us on Mshwar" width={232} height={56} />
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="badge-code" className="font-semibold">
          {copy.codeLabel}
        </label>
        <textarea
          id="badge-code"
          readOnly
          rows={4}
          value={code}
          onFocus={(event) => event.currentTarget.select()}
          dir="ltr"
          className={cn(
            "rounded-[0.75rem] border border-border bg-surface-raised p-4 font-mono text-sm text-text",
            focusRing,
          )}
        />
        <Button type="button" onClick={() => void onCopy()} disabled={!code} className="w-fit">
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          <span aria-live="polite">{copied ? copy.copied : copy.copy}</span>
        </Button>
      </div>
    </div>
  );
}
