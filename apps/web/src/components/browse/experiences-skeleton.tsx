import { Skeleton } from "@/components/ui/skeleton";

export function ExperiencesSkeleton() {
  return (
    <div className="shell-frame grid gap-8 py-12">
      <Skeleton className="mx-auto h-12 w-80" />
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="aspect-[4/3] w-full rounded-card" />
        ))}
      </div>
    </div>
  );
}
