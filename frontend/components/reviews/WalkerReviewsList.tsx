"use client";

import { StarRating } from "../ui/StarRating";
import { useWalkerReviews } from "../../hooks/useReviews";

const fmtDate = (dt: string) =>
  new Date(dt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function WalkerReviewsList({ walkerId }: { walkerId: string }) {
  const { data, isLoading } = useWalkerReviews(walkerId);

  if (isLoading) {
    return (
      <div className="mt-8 space-y-3">
        <div className="h-5 w-24 animate-pulse rounded-md bg-muted" aria-hidden="true" />
        <div className="h-20 w-full animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
        <div className="h-20 w-full animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
      </div>
    );
  }

  if (!data || data.ratingCount === 0) {
    return (
      <div className="mt-8">
        <h2 className="text-sm font-semibold">Reviews</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No reviews yet — be the first after your booking.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Reviews <span className="text-muted-foreground">({data.ratingCount})</span>
        </h2>
        <span className="flex items-center gap-1.5 text-sm">
          <StarRating value={data.ratingAvg} size="h-4 w-4" />
          <span className="font-medium">{data.ratingAvg.toFixed(1)}</span>
        </span>
      </div>
      <ul className="mt-3 space-y-3">
        {data.reviews.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{r.reviewerName}</span>
              <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
            </div>
            <StarRating value={r.rating} size="h-4 w-4" className="mt-1.5" />
            {r.comment && <p className="mt-2 text-sm text-foreground">{r.comment}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
