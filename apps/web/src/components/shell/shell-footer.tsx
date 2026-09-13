"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";
import { useLocale } from "@/components/shell/locale-provider";
import type { ShellSurface } from "@/components/shell/nav-config";

const FOOTER_COPY: Record<ShellSurface, "travellerFooter" | "businessFooter" | "adminFooter"> = {
  traveller: "travellerFooter",
  business: "businessFooter",
  admin: "adminFooter",
};

export function ShellFooter({ surface }: { surface: ShellSurface }) {
  const { t } = useLocale();
  const copy = useBrowseCopy();

  if (surface !== "traveller") {
    return (
      <footer className="mt-auto border-t border-border bg-surface">
        <div className="shell-frame flex flex-col gap-3 py-6 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{t(FOOTER_COPY[surface])}</p>
          <nav aria-label={t("contact")} className="flex flex-wrap gap-4">
            <Link href="/privacy" className={cn("hover:text-text", focusRing)}>
              {t("privacy")}
            </Link>
            <Link href="/terms" className={cn("hover:text-text", focusRing)}>
              {t("terms")}
            </Link>
            <Link href="/contact" className={cn("hover:text-text", focusRing)}>
              {t("contact")}
            </Link>
          </nav>
        </div>
      </footer>
    );
  }

  const columns = [
    { href: "/destinations", label: copy.exploreLebanon },
    { href: "/plan", label: copy.planATrip },
    { href: "/business", label: copy.partnerWithUs },
    { href: "/ideas", label: copy.tripIdeas },
    { href: "/contact", label: copy.aboutMshwar },
    { href: "/contact", label: copy.helpCenter },
    { href: "/experiences", label: copy.allPages },
    { href: "/privacy", label: copy.photoCredits },
  ];

  return (
    <footer className="mt-auto">
      <div className="bg-brand text-brand-foreground">
        <div className="shell-frame flex flex-col items-start justify-between gap-6 py-12 md:flex-row md:items-center">
          <h2 className="max-w-xl text-4xl font-semibold tracking-tight md:text-5xl">{copy.yallaTitle}</h2>
          <Button asChild size="icon" className="size-14 rounded-full bg-surface text-text hover:bg-surface-sunken">
            <Link href="/plan" aria-label={copy.planATrip}>
              <ArrowUpRight className="size-5" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
      <div className="border-t border-border bg-surface-sunken">
        <div className="shell-frame grid gap-8 py-10 md:grid-cols-[1.2fr_2fr]">
          <div>
            <p className="text-heading font-semibold">mshwar.</p>
            <p className="mt-2 text-sm text-text-muted">{copy.footerPace}</p>
          </div>
          <nav aria-label={t("contact")} className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {columns.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={cn("text-text hover:underline", focusRing)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="shell-frame flex flex-col gap-3 border-t border-border py-6 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 mshwar · {copy.sampleDisclaimer}</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className={cn("hover:text-text", focusRing)}>
              {t("privacy")}
            </Link>
            <Link href="/terms" className={cn("hover:text-text", focusRing)}>
              {t("terms")}
            </Link>
            <Link href="/contact" className={cn("hover:text-text", focusRing)}>
              {t("contact")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
