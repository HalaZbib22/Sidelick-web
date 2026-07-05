"use client";

import { Camera } from "lucide-react";
import { ProtectedImage } from "../ui/ProtectedImage";
import { useWalkPhotos } from "../../hooks/useBookings";
import { api } from "../../lib/paths";
import type { WalkCheckpoint } from "../../lib/types";

const ORDER: { key: WalkCheckpoint; label: string }[] = [
  { key: "start", label: "Start" },
  { key: "mid", label: "Halfway" },
  { key: "end", label: "End" },
];

const time = (dt: string) =>
  new Date(dt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/**
 * The three live checkpoint photos for a walk/sit. Polls while the walk is in
 * progress so the owner sees each photo appear. Empty slots show as pending.
 */
export function WalkPhotos({ bookingId, live }: { bookingId: string; live: boolean }) {
  const { data: photos, isLoading } = useWalkPhotos(bookingId, live ? 15000 : undefined);

  if (isLoading || !photos) {
    return (
      <div className="mt-5">
        <h2 className="text-sm font-semibold">Live photos</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {ORDER.map((c) => (
            <div key={c.key} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const byKey = new Map(photos.map((p) => [p.checkpoint, p]));

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Live photos</h2>
        {live && <span className="text-xs text-trust-strong">Updates as they arrive</span>}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {ORDER.map((c) => {
          const p = byKey.get(c.key);
          return (
            <div key={c.key} className="overflow-hidden rounded-xl border border-border bg-muted">
              <div className="relative aspect-square">
                {p ? (
                  <ProtectedImage
                    url={api.bookingPhotoFile(bookingId, c.key)}
                    alt={`${c.label} photo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                    <Camera className="h-4 w-4" />
                    <span className="text-[10px]">Pending</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[11px] font-medium">{c.label}</span>
                {p && <span className="text-[10px] text-muted-foreground">{time(p.takenAt)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
