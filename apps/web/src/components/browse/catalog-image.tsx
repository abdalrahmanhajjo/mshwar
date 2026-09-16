import { cn } from "@/lib/utils";

const RESPONSIVE_WIDTHS = [480, 800, 1200, 1600, 2000];
const CARD_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";
// Priority images are the large page heroes.
const HERO_SIZES = "100vw";

/** Unsplash serves any width through the `w` parameter; other hosts get the original URL only. */
export function responsiveSrcSet(src: string): string | undefined {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return undefined;
  }
  if (url.hostname !== "images.unsplash.com") {
    return undefined;
  }
  return RESPONSIVE_WIDTHS.map((width) => {
    url.searchParams.set("w", String(width));
    return `${url.toString()} ${width}w`;
  }).join(", ");
}

export function CatalogImage({
  src,
  alt,
  className,
  priority = false,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Above-the-fold images load eagerly with high priority; everything else is lazy. */
  priority?: boolean;
  sizes?: string;
}) {
  if (!src) {
    // An empty src makes the browser request the current page again.
    return (
      <div
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={cn("h-full w-full bg-surface-sunken", className)}
      />
    );
  }
  return (
    // Plain <img>: catalogue photos come from several hosts (sample CDN, ImageKit) without a
    // configured next/image loader; srcset and lazy loading keep the payload small.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={responsiveSrcSet(src)}
      sizes={sizes ?? (priority ? HERO_SIZES : CARD_SIZES)}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
