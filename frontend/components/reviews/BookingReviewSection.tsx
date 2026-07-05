"use client";

import { useState } from "react";
import { toast } from "sonner";
import { StarRating } from "../ui/StarRating";
import { Button } from "../ui/Button";
import { TextareaField } from "../ui/Textarea";
import { useBookingReview, useCreateReview } from "../../hooks/useReviews";
import { getApiErrorMessage } from "../../lib/forms";

interface Props {
  bookingId: string;
  walkerName: string;
}

/** Shown on a completed booking the caller booked as a customer. */
export function BookingReviewSection({ bookingId, walkerName }: Props) {
  const { data, isLoading } = useBookingReview(bookingId);
  const create = useCreateReview();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  if (isLoading || !data) {
    return (
      <div className="mt-4 h-32 w-full animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
    );
  }

  // Already reviewed — show it back to them.
  if (data.review) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium text-muted-foreground">Your review</p>
        <StarRating value={data.review.rating} size="h-5 w-5" className="mt-2" />
        {data.review.comment && <p className="mt-2 text-sm">{data.review.comment}</p>}
      </div>
    );
  }

  if (!data.eligible) return null;

  function submit() {
    if (rating < 1) return toast.error("Pick a star rating first.");
    create.mutate(
      { bookingId, rating, comment: comment.trim() || undefined },
      {
        onSuccess: () => toast.success("Thanks for your review!"),
        onError: (e) => toast.error(getApiErrorMessage(e)),
      }
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-medium">How was your experience with {walkerName}?</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Your rating helps other pet owners choose with confidence.
      </p>
      <StarRating value={rating} onChange={setRating} ariaLabel="Your rating" />
      <div className="mt-3">
        <TextareaField
          label="Add a comment (optional)"
          placeholder="e.g. Punctual, sent photos, my dog loved her — would book again!"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
        />
      </div>
      <Button onClick={submit} loading={create.isPending} className="mt-3 w-full">
        Submit review
      </Button>
    </div>
  );
}
