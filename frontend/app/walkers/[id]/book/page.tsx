"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Protected } from "../../../../components/auth/Protected";
import { Button } from "../../../../components/ui/Button";
import { Skeleton } from "../../../../components/ui/Skeleton";
import { PillGroup } from "../../../../components/ui/PillGroup";
import { DateTimePicker } from "../../../../components/ui/DateTimePicker";
import { NumberStepper } from "../../../../components/ui/NumberStepper";
import { Switch } from "../../../../components/ui/Switch";
import { BackButton } from "../../../../components/ui/BackButton";
import { TextareaField } from "../../../../components/ui/Textarea";
import { usePets } from "../../../../hooks/usePets";
import { apiFetch } from "../../../../lib/api";
import { api, routes } from "../../../../lib/paths";
import { getApiErrorMessage } from "../../../../lib/forms";
import { cn } from "../../../../lib/utils";
import type { WalkerProfile, BookingServiceType, Quote } from "../../../../lib/types";

const money = (cur: string, n: number) => (cur === "USD" ? `$${n.toFixed(2)}` : `${n.toFixed(2)} ${cur}`);
const TOTAL = 3;
const pad = (n: number) => String(n).padStart(2, "0");
const dayISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Mirrors the backend rule: a start must be at least 30 min out.
const MIN_LEAD_MINUTES = 30;
/** A tidy default start: now + lead time, rounded up to the next 5 minutes. */
function earliestStart(): Date {
  const d = new Date(Date.now() + MIN_LEAD_MINUTES * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

function BookInner() {
  const id = useParams<{ id: string }>().id;
  const router = useRouter();
  const { data: walker } = useQuery({
    queryKey: ["walker", id],
    queryFn: async () => (await apiFetch<{ walker: WalkerProfile }>(api.walker(id))).walker,
  });
  const { data: pets } = usePets();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);

  const offers = walker?.serviceTypes ?? [];
  const serviceOptions: { value: BookingServiceType; label: string }[] = [];
  if (offers.includes("walk")) serviceOptions.push({ value: "walk", label: "Walk" });
  if (offers.includes("sit")) serviceOptions.push({ value: "sit", label: "Sit" });
  if (offers.includes("walk") && offers.includes("sit")) serviceOptions.push({ value: "walk_sit", label: "Walk & Sit" });

  const [serviceType, setServiceType] = useState<BookingServiceType>("walk");
  const [start, setStart] = useState<Date>(earliestStart);
  const [walkMinutes, setWalkMinutes] = useState(60);
  const [sitHours, setSitHours] = useState(4);
  const [petIds, setPetIds] = useState<string[]>([]);
  // Pre-select the customer's dog when they only have one — saves a click and
  // avoids the "Pick at least one dog" stumble in the common single-pet case.
  useEffect(() => {
    if (pets?.length === 1 && petIds.length === 0) setPetIds([pets[0].id]);
  }, [pets, petIds.length]);
  const [isSharedWalk, setIsSharedWalk] = useState(false);
  const [foodDays, setFoodDays] = useState(0);
  const [dropoff, setDropoff] = useState(false);
  const [notes, setNotes] = useState("");

  // Recurrence: "once" creates a single booking; weekly/monthly repeat the same
  // slot for `repeatCount` occurrences, every `repeatInterval` periods.
  const [repeat, setRepeat] = useState<"once" | "weekly" | "monthly">("once");
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatCount, setRepeatCount] = useState(4);
  const isRecurring = repeat !== "once";

  const startTooSoon = start.getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000;

  function continueFromStep1() {
    if (startTooSoon) {
      return toast.error(`Start time must be at least ${MIN_LEAD_MINUTES} minutes from now.`);
    }
    setStep(2);
  }

  const hasWalk = serviceType === "walk" || serviceType === "walk_sit";
  const hasSit = serviceType === "sit" || serviceType === "walk_sit";
  const selectedPets = (pets ?? []).filter((p) => petIds.includes(p.id));
  const shareEligible = hasWalk && selectedPets.length > 0 && selectedPets.every((p) => p.friendlyWithPets === "friendly");

  function body() {
    return {
      walkerId: id,
      serviceType,
      date: dayISO(start),
      startTime: hhmm(start),
      walkDurationMinutes: hasWalk ? walkMinutes : undefined,
      sitDurationHours: hasSit ? sitHours : undefined,
      petIds,
      foodDays: hasSit ? foodDays : undefined,
      isSharedWalk: shareEligible ? isSharedWalk : undefined,
      dropoff: hasSit ? dropoff : undefined,
      notes: notes || undefined,
      recurrence: isRecurring
        ? { frequency: repeat, interval: repeatInterval, count: repeatCount }
        : undefined,
    };
  }

  async function goReview() {
    if (petIds.length === 0) return toast.error("Pick at least one dog.");
    setBusy(true);
    try {
      const d = await apiFetch<{ quote: Quote }>(api.bookingQuote, { method: "POST", body: JSON.stringify(body()) });
      setQuote(d.quote);
      setStep(3);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function request() {
    setBusy(true);
    try {
      const d = await apiFetch<{ booking: { id: string }; series?: { count: number } }>(api.bookings, {
        method: "POST",
        body: JSON.stringify(body()),
      });
      toast.success(d.series ? `${d.series.count} bookings requested!` : "Booking requested!");
      router.push(routes.booking(d.booking.id));
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!walker) {
    return (
      <main className="mx-auto max-w-md px-6 py-10">
        <Skeleton className="mb-4 h-4 w-16" />
        <Skeleton className="mb-1 h-7 w-40" />
        <Skeleton className="mb-6 h-4 w-48" />
        <Skeleton className="mb-6 h-1 w-full rounded-full" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <BackButton />
      <h1 className="mb-1 text-2xl font-semibold">Book {walker.firstName}</h1>
      <p className="mb-6 text-sm text-muted-foreground">Pick a date &amp; time that works for you</p>
      <div className="mb-6 h-1 rounded-full bg-muted">
        <div className="h-1 rounded-full bg-primary transition-all" style={{ width: `${(step / TOTAL) * 100}%` }} />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <PillGroup label="Service" options={serviceOptions} value={serviceType} onChange={setServiceType} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">Starts</label>
            <DateTimePicker
              value={start}
              onChange={setStart}
              minDate={earliestStart()}
              ariaLabel="Start date and time"
            />
            <p className={cn("mt-1.5 text-xs", startTooSoon ? "text-primary" : "text-muted-foreground")}>
              {startTooSoon
                ? `Too soon — pick a time at least ${MIN_LEAD_MINUTES} min from now.`
                : "Bookings must start at least 30 minutes from now."}
            </p>
          </div>
          {hasWalk && (
            <PillGroup
              label="Walk duration"
              options={[
                { value: "30", label: "30 min" },
                { value: "60", label: "1 hr" },
                { value: "90", label: "1.5 hr" },
              ]}
              value={String(walkMinutes)}
              onChange={(v) => setWalkMinutes(Number(v))}
            />
          )}
          {hasSit && <NumberStepper label="Sitting hours" value={sitHours} onChange={setSitHours} min={1} max={12} />}

          <PillGroup
            label="Repeat"
            options={[
              { value: "once", label: "One-time" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
            value={repeat}
            onChange={(v) => setRepeat(v as "once" | "weekly" | "monthly")}
          />
          {isRecurring && (
            <div className="space-y-4 rounded-xl bg-muted/40 p-3">
              <NumberStepper
                label={repeat === "weekly" ? "Every (weeks)" : "Every (months)"}
                value={repeatInterval}
                onChange={setRepeatInterval}
                min={1}
                max={4}
              />
              <NumberStepper
                label="Number of bookings"
                value={repeatCount}
                onChange={setRepeatCount}
                min={2}
                max={26}
              />
              <p className="text-xs text-muted-foreground">
                Creates {repeatCount} bookings, one every {repeatInterval}{" "}
                {repeat === "weekly"
                  ? repeatInterval === 1 ? "week" : "weeks"
                  : repeatInterval === 1 ? "month" : "months"}
                . Each is requested separately — {walker.firstName} accepts them one by one.
              </p>
            </div>
          )}

          <Button onClick={continueFromStep1} disabled={startTooSoon} className="w-full">Continue</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Which dog?</p>
            <div className="space-y-2">
              {(pets ?? []).map((p) => {
                const on = petIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPetIds((ids) => (on ? ids.filter((x) => x !== p.id) : [...ids, p.id]))}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl bg-surface p-3 text-left transition",
                      on ? "border-2 border-primary" : "border border-border hover:bg-muted/40"
                    )}
                  >
                    <span>
                      <span className="block text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{p.breed ?? "Dog"}</span>
                    </span>
                    {on && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
              {(pets ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Add a pet first from “My pets”.</p>
              )}
            </div>
          </div>

          {shareEligible && (
            <div className="flex items-center justify-between rounded-xl bg-trust-subtle p-3">
              <span>
                <span className="block text-sm font-medium text-trust-strong">Share this walk · save 20%</span>
                <span className="block text-xs text-trust-strong">Your friendly dog joins a small group walk</span>
              </span>
              <Switch checked={isSharedWalk} onChange={setIsSharedWalk} ariaLabel="Walk Share" />
            </div>
          )}

          {hasSit && (
            <>
              <NumberStepper label="Food handling (days)" value={foodDays} onChange={setFoodDays} min={0} max={14} />
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
                <span className="text-sm font-medium">Drop my dog home after</span>
                <Switch checked={dropoff} onChange={setDropoff} ariaLabel="Drop-off" />
              </div>
            </>
          )}

          <TextareaField
            label="Notes for the walker (optional)"
            placeholder="Anything they should know — leash habits, treats, allergies…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={goReview} loading={busy} className="flex-1">Review</Button>
          </div>
        </div>
      )}

      {step === 3 && quote && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="space-y-2">
              {quote.lines.map((l, i) => (
                <div key={i} className={cn("flex justify-between text-sm", l.amount < 0 ? "text-trust-strong" : "text-foreground")}>
                  <span>{l.label}</span>
                  <span>{l.amount < 0 ? `−${money(quote.currency, Math.abs(l.amount))}` : money(quote.currency, l.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 text-base font-medium">
                <span>Total</span>
                <span>{money(quote.currency, quote.total)}</span>
              </div>
            </div>
          </div>
          {isRecurring && (
            <p className="rounded-xl bg-trust-subtle p-3 text-center text-xs text-trust-strong">
              This price is per booking. We&apos;ll request {repeatCount} bookings
              ({repeat === "weekly" ? "weekly" : "monthly"}), each billed separately on acceptance.
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            You won&apos;t be charged until {walker.firstName} accepts your request.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={request} loading={busy} className="flex-1">Request booking</Button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function BookPage() {
  return (
    <Protected>
      <BookInner />
    </Protected>
  );
}
