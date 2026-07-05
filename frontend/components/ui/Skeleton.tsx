import { cn } from "../../lib/utils";

/** Base shimmer block. Compose these to mirror a page's real layout while it loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden="true" />;
}

/** Mirrors the avatar + two text lines header used on profile and walker pages. */
export function AvatarHeaderSkeleton({ size = "h-16 w-16" }: { size?: string }) {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className={cn("rounded-full", size)} />
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

/** Mirrors a discovery walker card: avatar, name/meta lines, pills, View button. */
export function WalkerCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
      <Skeleton className="h-11 w-11 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-40" />
        <div className="flex gap-1">
          <Skeleton className="h-4 w-10 rounded-full" />
          <Skeleton className="h-4 w-10 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-8 w-16 rounded-full" />
    </div>
  );
}

/** Mirrors a bookings list item: title row + meta line. */
export function BookingCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

/** Mirrors a pet card: name, meta, temperament pill. */
export function PetCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-2 h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** Repeats a card skeleton to fill a list while data loads. */
export function ListSkeleton({
  count = 3,
  children,
}: {
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{children}</div>
      ))}
    </div>
  );
}
