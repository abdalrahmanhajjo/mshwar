"use client";

import Link from "next/link";
import { cn, focusRing } from "@/lib/utils";
import { useLocale } from "@/components/shell/locale-provider";
import type { ShellSurface } from "@/components/shell/nav-config";

const FOOTER_COPY: Record<ShellSurface, "travellerFooter" | "businessFooter" | "adminFooter"> = {
  traveller: "travellerFooter",
  business: "businessFooter",
  admin: "adminFooter",
};

export function ShellFooter({ surface }: { surface: ShellSurface }) {
  const { t } = useLocale();

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
