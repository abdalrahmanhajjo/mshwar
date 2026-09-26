import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const RESPONSIVE_WIDTHS = [480, 800, 1200, 1600, 2000];
const CARD_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";
// Priority images are the large page heroes.
const HERO_SIZES = "100vw";

const IMAGEKIT_ENDPOINT = (process.env.NEXT_PUBLIC_IMAGEKIT_URL ?? "").replace(/\/+$/, "");

function isImageKit(url: URL): boolean {
  return (
    url.hostname === "ik.imagekit.io" || (IMAGEKIT_ENDPOINT !== "" && url.href.startsWith(`${IMAGEKIT_ENDPOINT}/`))
  );
}

/**
 * Listing photos arrive either as full URLs or as storage keys relative to the
 * ImageKit URL endpoint (MSHWAR-112). Keys resolve against NEXT_PUBLIC_IMAGEKIT_URL;
 * without it there is nothing to show.
 */
export function resolveImageSrc(src: string): string {
  if (!src) return "";
  if (/^(https?:)?\/\//.test(src) || src.startsWith("/") || src.startsWith("data:")) return src;
  if (!IMAGEKIT_ENDPOINT) return "";
  return `${IMAGEKIT_ENDPOINT}/${src.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Width-based srcset. Unsplash resizes through `w`; ImageKit resizes, compresses and
 * picks the format through `tr` - no image processing happens in our own servers.
 */
export function responsiveSrcSet(src: string): string | undefined {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return undefined;
  }
  if (url.hostname === "images.unsplash.com") {
    return RESPONSIVE_WIDTHS.map((width) => {
      url.searchParams.set("w", String(width));
      return `${url.toString()} ${width}w`;
    }).join(", ");
  }
  if (isImageKit(url)) {
    return RESPONSIVE_WIDTHS.map((width) => {
      url.searchParams.set("tr", `w-${width},q-auto,f-auto`);
      return `${url.toString()} ${width}w`;
    }).join(", ");
  }
  return undefined;
}

export function CatalogImage({
  src,
  alt,
  className,
  priority = false,
  sizes,
  areaLabel,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Set when the photo shows the place's town, not the place itself (it has no photo yet). */
  areaLabel?: string;
  /** Above-the-fold images load eagerly with high priority; everything else is lazy. */
  priority?: boolean;
  sizes?: string;
}) {
  const resolved = resolveImageSrc(src);
  if (!resolved) {
    // An empty src makes the browser request the current page again.
    return (
      <div
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={cn(
          "grid h-full w-full place-items-center bg-gradient-to-br from-brand-subtle to-surface-sunken text-brand/60",
          className,
        )}
      >
        <ImageIcon className="size-8" aria-hidden />
      </div>
    );
  }
  if (areaLabel) {
    return (
      <div className={cn("relative h-full w-full", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolved}
          srcSet={responsiveSrcSet(resolved)}
          sizes={sizes ?? (priority ? HERO_SIZES : CARD_SIZES)}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="h-full w-full object-cover"
        />
        <span className="absolute bottom-1.5 start-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[0.7rem] font-medium text-white">
          {areaLabel}
        </span>
      </div>
    );
  }
  return (
    // Plain <img>: catalogue photos come from several hosts (sample CDN, ImageKit) without a
    // configured next/image loader; srcset and lazy loading keep the payload small.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      srcSet={responsiveSrcSet(resolved)}
      sizes={sizes ?? (priority ? HERO_SIZES : CARD_SIZES)}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
