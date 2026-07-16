"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MapPin, SlidersHorizontal } from "lucide-react";
import { Protected } from "../../components/auth/Protected";
import { LeafletMap, type MapMarker } from "../../components/map/LeafletMap";
import { Button } from "../../components/ui/Button";
import { PillGroup } from "../../components/ui/PillGroup";
import { Switch } from "../../components/ui/Switch";
import { Slider } from "../../components/ui/slider";
import { ListSkeleton, WalkerCardSkeleton } from "../../components/ui/Skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "../../components/ui/sheet";
import { BackButton } from "../../components/ui/BackButton";
import { apiFetch } from "../../lib/api";
import { api, routes } from "../../lib/paths";
import type { WalkerCard } from "../../lib/types";

const BEIRUT = { lat: 33.8938, lng: 35.5018 };
type Service = "all" | "walk" | "sit";

function DiscoverInner() {
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [service, setService] = useState<Service>("all");
  const [walkShare, setWalkShare] = useState(false);
  const [maxDistance, setMaxDistance] = useState(20);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setLoc(BEIRUT)
      );
    } else setLoc(BEIRUT);
  }, []);

  const center = loc ?? BEIRUT;

  const { data: walkers, isLoading } = useQuery({
    queryKey: ["walkers", center.lat, center.lng, service, walkShare],
    enabled: !!loc,
    queryFn: async () => {
      const qs = new URLSearchParams({
        lat: String(center.lat),
        lng: String(center.lng),
      });
      if (service !== "all") qs.set("service", service);
      if (walkShare) qs.set("walkShare", "1");
      return (
        await apiFetch<{ walkers: WalkerCard[] }>(
          `${api.walkers}?${qs.toString()}`
        )
      ).walkers;
    },
  });

  const filtered = useMemo(
    () =>
      (walkers ?? []).filter(
        (w) => w.distanceKm == null || w.distanceKm <= maxDistance
      ),
    [walkers, maxDistance]
  );

  const markers: MapMarker[] = useMemo(() => {
    const m: MapMarker[] = [
      { lat: center.lat, lng: center.lng, kind: "you", label: "You" },
    ];
    filtered.forEach((w) => {
      if (w.latitude != null && w.longitude != null)
        m.push({
          id: w.id,
          lat: w.latitude,
          lng: w.longitude,
          kind: "walker",
          label: w.priceFrom ? `$${w.priceFrom}` : undefined,
        });
    });
    return m;
  }, [filtered, center.lat, center.lng]);

  const activeCount =
    (service !== "all" ? 1 : 0) +
    (walkShare ? 1 : 0) +
    (maxDistance < 20 ? 1 : 0);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Walkers near you</h1>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> Verified walkers &amp; sitters
          </p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal className="h-4 w-4" />
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="space-y-6">
              <PillGroup
                label="Service"
                options={[
                  { value: "all", label: "All" },
                  { value: "walk", label: "Walk" },
                  { value: "sit", label: "Sit" },
                ]}
                value={service}
                onChange={setService}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Walk Share only</span>
                <Switch
                  checked={walkShare}
                  onChange={setWalkShare}
                  ariaLabel="Walk Share only"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Max distance</span>
                  <span className="text-muted-foreground">
                    {maxDistance} km
                  </span>
                </div>
                <Slider
                  min={1}
                  max={20}
                  step={1}
                  value={[maxDistance]}
                  onValueChange={(v) => setMaxDistance(v[0])}
                />
              </div>
              <SheetClose asChild>
                <Button className="w-full">
                  Show {filtered.length} walkers
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="mb-5">
        <LeafletMap center={center} markers={markers} height={200} />
      </div>

      {isLoading || !loc ? (
        <ListSkeleton count={4}>
          <WalkerCardSkeleton />
        </ListSkeleton>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No verified walkers match your filters. Try widening the distance.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((w) => (
            <div
              key={w.id}
              className="lift flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-subtle text-sm font-medium text-link">
                {w.firstName[0]}
                {w.lastInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {w.firstName} {w.lastInitial}.{" "}
                  <span className="text-xs text-trust-strong">✓ Verified</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {w.ratingCount > 0 ? (
                    <span className="text-primary">
                      ★ {w.ratingAvg.toFixed(1)}
                    </span>
                  ) : (
                    "New"
                  )}
                  {w.distanceKm != null && <> · {w.distanceKm} km</>}
                  {w.priceFrom && <> · from ${w.priceFrom}/walk</>}
                </p>
                <div className="mt-1 flex gap-1">
                  {w.serviceTypes.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {s === "walk" ? "Walk" : "Sit"}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href={routes.walker(w.id)}
                className="lift rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
              >
                View
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function DiscoverPage() {
  return (
    <Protected>
      <DiscoverInner />
    </Protected>
  );
}
