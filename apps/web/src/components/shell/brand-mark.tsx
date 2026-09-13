import Link from "next/link";
import { cn, controlSize, focusRing } from "@/lib/utils";

export function BrandMark({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center font-semibold text-text", controlSize, focusRing)}>
      <span className={compact ? "text-title" : "text-heading"}>Mshwar</span>
    </Link>
  );
}
