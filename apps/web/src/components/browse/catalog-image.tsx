import { cn } from "@/lib/utils";

export function CatalogImage({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    // External Unsplash sample photography; next/image remote config is set in next.config.ts.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn("h-full w-full object-cover", className)}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
