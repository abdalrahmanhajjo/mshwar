"use client";

import * as React from "react";
import { MapPin } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { LogoSymbol } from "@/components/shell/brand-mark";
import { BidiText } from "@/components/ui/bidi-text";
import { useAuthCopy } from "@/lib/auth-copy";

/** A real destination photo for the side panel, chosen on the server from the catalogue. */
export type AuthVisual = { image: string; alt: string; name: string; region: string };

export type AuthScene = "signup" | "signin" | "verify" | "recover";

const SCENE_COPY = {
  signup: ["visSignupLead", "visSignupAccent", "visSignupBody"],
  signin: ["visSigninLead", "visSigninAccent", "visSigninBody"],
  verify: ["visVerifyLead", "visVerifyAccent", "visVerifyBody"],
  recover: ["visRecoverLead", "visRecoverAccent", "visRecoverBody"],
} as const;

/**
 * Shared frame for every auth screen: the task on one side, Lebanon on the other.
 * On phones only the task is shown, so the form is the first thing on screen.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
  visual,
  scene,
}: {
  /** The screen's h1. Result screens pass none and render their own heading. */
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  visual?: AuthVisual | null;
  scene: AuthScene;
}) {
  const copy = useAuthCopy();
  const [lead, accent, body] = SCENE_COPY[scene];
  const photoFrame = React.useRef<HTMLDivElement>(null);
  const [photoFailed, setPhotoFailed] = React.useState(false);

  // If the photo cannot load, show the cedar panel instead of a broken image.
  // The error can fire before hydration, so check the finished image as well.
  React.useEffect(() => {
    const img = photoFrame.current?.querySelector("img");
    if (!img) return;
    const fail = () => setPhotoFailed(true);
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener("error", fail);
    return () => img.removeEventListener("error", fail);
  }, [visual?.image]);
  const photo = visual && !photoFailed ? visual : null;

  return (
    <div className="mx-auto grid w-full max-w-[76rem] overflow-hidden sm:rounded-[1.375rem] sm:border sm:border-border-subtle sm:bg-surface-raised sm:shadow-[0_24px_60px_-40px_rgb(18_53_47/0.35)] lg:grid-cols-[48fr_52fr]">
      <div className="flex flex-col justify-center gap-8 py-2 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
        <div className="mx-auto grid w-full max-w-[26rem] gap-8">
          {title ? (
            <div className="grid gap-3">
              <LogoSymbol className="h-7" />
              <h1 className="mt-2 text-[clamp(1.75rem,1.45rem+1vw,2.25rem)] font-[560] leading-[1.1] tracking-[-0.035em] text-text">
                {title}
              </h1>
              {description ? (
                <div className="text-[0.9375rem] leading-relaxed text-text-muted">{description}</div>
              ) : null}
            </div>
          ) : null}
          {children}
          {footer ? <div className="border-t border-border-subtle pt-6 text-sm text-text-muted">{footer}</div> : null}
        </div>
      </div>

      <div className="relative isolate hidden min-h-[40rem] overflow-hidden bg-brand lg:block" aria-hidden={!photo}>
        {photo ? (
          <div ref={photoFrame} className="absolute inset-0">
            <CatalogImage src={photo.image} alt={photo.alt} sizes="52vw" priority />
          </div>
        ) : (
          <LogoSymbol tone="inverse" className="absolute -end-16 top-16 h-auto w-[28rem] opacity-[0.07]" />
        )}
        <div className="photo-scrim absolute inset-0" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 grid gap-4 p-12 text-white">
          <p className="max-w-md text-[2.25rem] font-[560] leading-[1.05] tracking-[-0.035em]">
            {copy[lead]} <span className="text-serif text-accent">{copy[accent]}</span>
          </p>
          <p className="max-w-sm text-[0.9375rem] leading-relaxed text-white/85">{copy[body]}</p>
          {photo ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/75">
              <MapPin className="size-3.5" strokeWidth={1.75} aria-hidden />
              <BidiText>{photo.name}</BidiText>
              {photo.region && photo.region !== photo.name ? (
                <>
                  <span aria-hidden>·</span>
                  <BidiText>{photo.region}</BidiText>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
