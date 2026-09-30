"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "@/components/shell/locale-provider";

/**
 * Cloudflare Turnstile on sign-up and password reset (security plan SEC-55). Shown only when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; the API checks the token with TURNSTILE_SECRET_KEY.
 * Turnstile asks nothing of most people and uses no image puzzles.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const humanCheckEnabled = SITE_KEY !== "";

interface Turnstile {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function HumanCheck({
  action,
  onToken,
}: {
  action: "register" | "reset";
  onToken: (token: string | null) => void;
}) {
  const { locale } = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!humanCheckEnabled || !container.current) return;
    let widget: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) return;
        widget = turnstile.render(container.current, {
          sitekey: SITE_KEY,
          action,
          language: locale,
          appearance: "interaction-only",
          callback: (token: string) => callback.current(token),
          "expired-callback": () => callback.current(null),
          "error-callback": () => callback.current(null),
        });
      })
      .catch(() => callback.current(null));
    return () => {
      cancelled = true;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, [action, locale]);

  if (!humanCheckEnabled) return null;
  return <div ref={container} className="min-h-0" />;
}
