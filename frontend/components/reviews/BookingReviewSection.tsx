"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { StarRating } from "../ui/StarRating";
import { Button } from "../ui/Button";
import { TextareaField } from "../ui/Textarea";
import { FavoriteHeart } from "../walkers/FavoriteHeart";
import { useBookingReview, useCreateReview } from "../../hooks/useReviews";
import { useToggleFavorite } from "../../hooks/useFavorites";
import { getApiErrorMessage } from "../../lib/forms";

interface Props {
  bookingId: string;
  walkerName: string;
  /** Enables the post-review "save walker" prompt. */
  walkerId?: string;
}

/** Shown on a completed booking the caller booked as a customer. */
export function BookingReviewSection({ bookingId, walkerName, walkerId }: Props) {
  const { data, isLoading } = useBookingReview(bookingId);
  const create = useCreateReview();
  const toggleFavorite = useToggleFavorite();
  const reduce = useReducedMotion();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  // Post-review save prompt: shown after a 4-5 star review, one tap to save.
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [saved, setSaved] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="mt-4 h-32 w-full animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
    );
  }

  const firstName = walkerName.split(" ")[0];

  function saveWalker() {
    if (!walkerId || saved) return;
    setSaved(true);
    toggleFavorite.mutate(
      { walkerId, next: true },
      { onError: () => setSaved(false) }
    );
  }

  const savePrompt = (
    <AnimatePresence>
      {showSavePrompt && walkerId && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/20 bg-accent-subtle/60 p-4 shadow-sm"
        >
          <FavoriteHeart active={saved} onToggle={saveWalker} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {saved
                ? `${firstName} is saved for next time`
                : `Loved your time with ${firstName}?`}
            </p>
            <p className="text-xs text-muted-foreground">
              {saved
                ? "Find them under Saved when you book again."
                : "Save them once — rebook in seconds next time."}
            </p>
          </div>
          {!saved ? (
            <button
              type="button"
              onClick={saveWalker}
              className="lift shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-glow hover:opacity-90"
            >
              Save for next time
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSavePrompt(false)}
              className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Done
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Already reviewed — show it back to them (plus the save prompt right after submit).
  if (data.review) {
    return (
      <>
        <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-muted-foreground">Your review</p>
          <StarRating value={data.review.rating} size="h-5 w-5" className="mt-2" />
          {data.review.comment && <p className="mt-2 text-sm">{data.review.comment}</p>}
        </div>
        {savePrompt}
      </>
    );
  }

  if (!data.eligible) return null;

  function submit() {
    if (rating < 1) return toast.error("Pick a star rating first.");
    create.mutate(
      { bookingId, rating, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Thanks for your review!");
          // Only invite a save after a great experience.
          if (rating >= 4 && walkerId) setShowSavePrompt(true);
        },
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
