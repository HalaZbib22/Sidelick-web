"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Protected } from "../../../components/auth/Protected";
import { Skeleton, AvatarHeaderSkeleton } from "../../../components/ui/Skeleton";
import { WalkerReviewsList } from "../../../components/reviews/WalkerReviewsList";
import { apiFetch } from "../../../lib/api";
import { api, routes } from "../../../lib/paths";
import type { WalkerProfile } from "../../../lib/types";

function ProfileInner() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: w, isLoading, isError } = useQuery({
    queryKey: ["walker", id],
    queryFn: async () => {
      const d = await apiFetch<{ walker: WalkerProfile }>(api.walker(id));
      return d.walker;
    },
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-xl px-6 py-8">
        <Skeleton className="mb-6 h-4 w-24" />
        <AvatarHeaderSkeleton />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <Skeleton className="mt-5 h-16 w-full rounded-xl" />
        <Skeleton className="mt-6 h-24 w-full rounded-2xl" />
      </main>
    );
  }
  if (isError || !w) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">This walker isn&apos;t available.</p>
        <Link href={routes.walkers} className="mt-4 inline-block text-sm font-medium text-link">
          Back to walkers
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <Link href={routes.walkers} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All walkers
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-subtle text-lg font-medium text-link">
          {w.firstName[0]}
          {w.lastName[0]}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">
            {w.firstName} {w.lastName[0]}.
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="text-trust-strong">✓ Verified</span>
            {w.ratingCount > 0 ? (
              <> · <span className="text-primary">★ {w.ratingAvg.toFixed(1)}</span> ({w.ratingCount})</>
            ) : (
              " · New on Sidelick"
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {w.serviceTypes.map((s) => (
          <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {s === "walk" ? "Dog walking" : "Sitting / boarding"}
          </span>
        ))}
        {w.subscriptionTier && (
          <span className="rounded-full bg-accent-subtle px-3 py-1 text-xs capitalize text-link">
            {w.subscriptionTier}
          </span>
        )}
      </div>

      {w.bio && <p className="mt-5 text-sm leading-relaxed text-foreground">{w.bio}</p>}

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Starting from</p>
            <p className="text-xl font-semibold">{w.priceFrom ? `$${w.priceFrom}` : "—"}<span className="text-sm font-normal text-muted-foreground">/walk</span></p>
          </div>
          <Link
            href={routes.walkerBook(w.id)}
            className="lift rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Book
          </Link>
        </div>
      </div>

      <WalkerReviewsList walkerId={w.id} />
    </main>
  );
}

export default function WalkerProfilePage() {
  return (
    <Protected>
      <ProfileInner />
    </Protected>
  );
}
