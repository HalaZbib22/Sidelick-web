"use client";

import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { ListSkeleton, BookingCardSkeleton } from "../ui/Skeleton";
import { apiFetch } from "../../lib/api";
import { api } from "../../lib/paths";
import { SERVICE_LABEL } from "../../lib/services";
import type { BookingServiceType } from "../../lib/types";

interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewerName: string;
  walkerName: string;
  serviceType: BookingServiceType;
}

/** Every customer review, newest first — the platform's word-of-mouth feed. */
export function ReviewsLog() {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: async () => (await apiFetch<{ reviews: AdminReview[] }>(api.adminReviews)).reviews,
  });

  if (isLoading) {
    return (
      <ListSkeleton count={3}>
        <BookingCardSkeleton />
      </ListSkeleton>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No reviews yet — they'll appear as customers rate completed bookings.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {r.reviewerName} <span className="text-muted-foreground">on</span> {r.walkerName}
              <span className="ml-1.5 text-xs text-muted-foreground">
                · {SERVICE_LABEL[r.serviceType]} ·{" "}
                {new Date(r.createdAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </p>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                r.rating >= 4
                  ? "bg-trust-subtle text-trust-strong"
                  : r.rating === 3
                    ? "bg-muted text-muted-foreground"
                    : "bg-danger/10 text-danger"
              }`}
            >
              <Star className="h-3 w-3" /> {r.rating}
            </span>
          </div>
          {r.comment && <p className="mt-2 text-sm leading-relaxed">{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}
