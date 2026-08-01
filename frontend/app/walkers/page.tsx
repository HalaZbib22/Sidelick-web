"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Cat,
  Dog,
  Heart,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { Protected } from "../../components/auth/Protected";
import { FavoriteHeart } from "../../components/walkers/FavoriteHeart";
import { VerifiedBadge } from "../../components/walkers/VerifiedBadge";
import { AmenityPicker } from "../../components/walkers/AmenityChips";
import { useToggleFavorite } from "../../hooks/useFavorites";
import { LeafletMap, type MapMarker } from "../../components/map/LeafletMap";
import { Button } from "../../components/ui/Button";
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
import { SERVICES, SERVICE_CHIP, SERVICE_LABEL } from "../../lib/services";
import type { ServiceType, WalkerCard } from "../../lib/types";

const BEIRUT = { lat: 33.8938, lng: 35.5018 };
type Service = "all" | ServiceType;

const SERVICE_OPTIONS: { value: Service; label: string; icon: typeof Sparkles }[] = [
  { value: "all", label: "All", icon: Sparkles },
  ...SERVICES.map((s) => ({ value: s.value as Service, label: s.short, icon: s.icon })),
];

type PetType = "all" | "dog" | "cat";

const PET_TYPE_OPTIONS = [
  { value: "all", label: "All", icon: Sparkles },
  { value: "dog", label: "Dogs", icon: Dog },
  { value: "cat", label: "Cats", icon: Cat },
] as const;

function DiscoverInner() {
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [service, setService] = useState<Service>("all");
  const [walkShare, setWalkShare] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [petType, setPetType] = useState<PetType>("all");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [maxDistance, setMaxDistance] = useState(20);
  const toggleFavorite = useToggleFavorite();

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
    queryKey: ["walkers", center.lat, center.lng, service, walkShare, savedOnly, petType, amenities.slice().sort().join(",")],
    enabled: !!loc,
    queryFn: async () => {
      const qs = new URLSearchParams({
        lat: String(center.lat),
        lng: String(center.lng),
      });
      if (service !== "all") qs.set("service", service);
      if (walkShare) qs.set("walkShare", "1");
      if (savedOnly) qs.set("favorites", "1");
      if (petType !== "all") qs.set("species", petType);
      if (amenities.length > 0) qs.set("amenities", amenities.join(","));
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
    (petType !== "all" ? 1 : 0) +
    (walkShare ? 1 : 0) +
    (maxDistance < 20 ? 1 : 0) +
    amenities.length;

  const savedCount = useMemo(
    () => (walkers ?? []).filter((w) => w.isFavorite).length,
    [walkers]
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      {/* Ambient hero band — matches the dashboard's design language. */}
      <header className="relative mb-5 overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-accent-subtle/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-trust-subtle/60 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Discover
            </p>
            <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">
              Walkers near you
            </h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> Verified walkers &amp; sitters
              {!isLoading && filtered.length > 0 && <> · {filtered.length} nearby</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
          {/* Saved-only toggle — a heart pill that fills coral when active. */}
          <button
            type="button"
            onClick={() => setSavedOnly((s) => !s)}
            aria-pressed={savedOnly}
            className={`lift inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
              savedOnly
                ? "border-primary bg-primary text-primary-foreground shadow-glow"
                : "border-border bg-surface text-foreground shadow-sm hover:shadow-md"
            }`}
          >
            <Heart
              className={`h-4 w-4 ${savedOnly ? "fill-primary-foreground" : ""}`}
            />
            Saved{!savedOnly && savedCount > 0 ? ` (${savedCount})` : ""}
          </button>
          <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal className="h-4 w-4" />
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
          </SheetTrigger>
          <SheetContent className="flex h-full flex-col gap-0 overflow-hidden p-0">
            {/* Scrollable body — the footer below stays pinned. */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-6">
            <SheetHeader className="mb-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Refine
              </p>
              <SheetTitle className="font-display text-2xl font-medium">
                Filters
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-6">
              {/* Service — icon chips (wraps on small screens) */}
              <div>
                <p className="mb-2 text-sm font-medium">Service</p>
                <div className="flex flex-wrap gap-1.5">
                  {SERVICE_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setService(value)}
                      aria-pressed={service === value}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
                        service === value
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pet type — who needs the care */}
              <div>
                <p className="mb-2 text-sm font-medium">Pet type</p>
                <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-muted/40 p-1">
                  {PET_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPetType(value)}
                      aria-pressed={petType === value}
                      className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs font-medium transition-colors ${
                        petType === value
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Walk Share — explains itself instead of a bare switch */}
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-link">
                  <Users className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Walk Share only</span>
                  <span className="block text-xs text-muted-foreground">
                    Group walks with a buddy — save 20%
                  </span>
                </span>
                <Switch
                  checked={walkShare}
                  onChange={setWalkShare}
                  ariaLabel="Walk Share only"
                />
              </div>

              {/* Distance */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Max distance</span>
                  <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-medium text-link">
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
                <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                  <span>1 km</span>
                  <span>20 km</span>
                </div>
              </div>

              {/* Skills & amenities */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Skills &amp; amenities</span>
                  {amenities.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmenities([])}
                      className="text-xs font-medium text-link hover:opacity-80"
                    >
                      Clear ({amenities.length})
                    </button>
                  )}
                </div>
                <AmenityPicker value={amenities} onChange={setAmenities} compact />
              </div>
            </div>
            </div>

            {/* Pinned footer — outside the scroll region, flush with the sheet edge */}
            <div className="flex items-center gap-2 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setService("all");
                    setPetType("all");
                    setWalkShare(false);
                    setMaxDistance(20);
                    setAmenities([]);
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
              )}
              <SheetClose asChild>
                <Button className="flex-1">
                  Show {filtered.length} walker{filtered.length === 1 ? "" : "s"}
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
          </Sheet>
          </div>
        </div>
      </header>

      <div className="mb-5 overflow-hidden rounded-3xl border border-border shadow-md">
        <LeafletMap center={center} markers={markers} height={200} />
      </div>

      {isLoading || !loc ? (
        <ListSkeleton count={4}>
          <WalkerCardSkeleton />
        </ListSkeleton>
      ) : filtered.length === 0 ? (
        savedOnly ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle">
              <Heart className="h-5 w-5 text-primary" />
            </span>
            <p className="mt-3 font-display text-lg font-medium">No saved walkers yet</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              Tap the heart on any walker to save them here for quick rebooking.
            </p>
            <button
              type="button"
              onClick={() => setSavedOnly(false)}
              className="lift mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Browse walkers
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No verified walkers match your filters. Try widening the distance.
          </div>
        )
      ) : (
        <div className="space-y-3">
          {filtered.map((w, i) => (
            <div
              key={w.id}
              className="slk-rise lift flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm hover:shadow-md"
              style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}
            >
              {w.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={w.profilePhotoUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-subtle to-trust-subtle text-sm font-medium text-link">
                  {w.firstName[0]}
                  {w.lastInitial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-medium">
                  {w.firstName} {w.lastInitial}.
                  <VerifiedBadge className="h-4 w-4" />
                  {(w.subscriptionTier === "pro" || w.subscriptionTier === "elite") && (
                    <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[10px] font-medium capitalize text-link">
                      {w.subscriptionTier}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {w.ratingCount > 0 ? (
                    <span className="font-medium text-primary">
                      ★ {w.ratingAvg.toFixed(1)}
                      <span className="font-normal text-muted-foreground">
                        {" "}({w.ratingCount})
                      </span>
                    </span>
                  ) : (
                    "New on Sidelick"
                  )}
                  {w.distanceKm != null && <> · {w.distanceKm} km</>}
                  {w.priceFrom != null && (
                    <>
                      {" · from "}
                      <span className="font-medium text-foreground">${w.priceFrom}</span>
                      /{w.priceFromUnit ?? "walk"}
                    </>
                  )}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {w.serviceTypes.map((s) => (
                    <span
                      key={s}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SERVICE_CHIP[s]}`}
                    >
                      {SERVICE_LABEL[s]}
                    </span>
                  ))}
                </div>
              </div>
              <FavoriteHeart
                size="sm"
                active={w.isFavorite}
                onToggle={() =>
                  toggleFavorite.mutate({ walkerId: w.id, next: !w.isFavorite })
                }
              />
              <Link
                href={routes.walker(w.id)}
                className="lift rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
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
