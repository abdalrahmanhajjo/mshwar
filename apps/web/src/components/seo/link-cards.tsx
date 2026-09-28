import { ArrowUpRight } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { LocaleLink } from "@/components/shell/locale-link";
import { cn, focusRing } from "@/lib/utils";

export type LinkCard = { href: string; title: string; line?: string; image?: string; meta?: string };

/** Photo cards that are plain links: the internal-linking backbone of the hub pages. */
export function LinkCards({ cards, className }: { cards: LinkCard[]; className?: string }) {
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {cards.map((card) => (
        <li key={card.href}>
          <LocaleLink
            href={card.href}
            className={cn(
              "group relative isolate flex h-48 flex-col justify-end overflow-hidden rounded-[1.125rem] bg-brand p-5 text-white",
              focusRing,
            )}
          >
            {card.image ? (
              <CatalogImage
                src={card.image}
                alt=""
                className="absolute inset-0 -z-10 transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : null}
            <span className="photo-scrim absolute inset-0 -z-10" aria-hidden />
            <ArrowUpRight className="absolute end-4 top-4 size-5 rtl:-scale-x-100" aria-hidden />
            <span className="text-lg font-semibold tracking-[-0.02em]">{card.title}</span>
            {card.line ? <span className="mt-1 line-clamp-2 text-sm text-white/85">{card.line}</span> : null}
            {card.meta ? <span className="mt-2 text-xs font-medium text-white/75">{card.meta}</span> : null}
          </LocaleLink>
        </li>
      ))}
    </ul>
  );
}
