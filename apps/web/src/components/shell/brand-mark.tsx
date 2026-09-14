import { LocaleLink } from "@/components/shell/locale-link";
import { cn, controlSize, focusRing } from "@/lib/utils";

export function BrandMark({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <LocaleLink href={href} className={cn("inline-flex items-center font-semibold text-text", controlSize, focusRing)}>
      <svg width={compact ? 55 : 65} height="35" viewBox="0 0 65 35" fill="none" aria-hidden><path d="M4 29V22L15 10Q18 7 21 11L28 19L37 9Q40 7 43 11L51 21" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="59" cy="22" r="3" fill="#F9683A"/></svg><span className="ms-1 flex flex-col leading-none"><span className={compact ? "text-[23px] tracking-[-.06em]" : "text-heading"}>mshwar</span><span lang="ar" className="mt-1 text-[11px]">مشوار</span></span>
    </LocaleLink>
  );
}
