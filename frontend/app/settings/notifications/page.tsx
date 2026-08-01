"use client";

import { BellRing } from "lucide-react";
import { Protected } from "../../../components/auth/Protected";
import { BackButton } from "../../../components/ui/BackButton";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Switch } from "../../../components/ui/Switch";
import {
  useNotificationPrefs,
  type NotificationPrefs,
} from "../../../hooks/useNotificationPrefs";
import { usePush } from "../../../hooks/usePush";

/** Copy for each mutable category (mirrors backend TYPE_CATEGORY grouping). */
const CATEGORIES: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  {
    key: "booking_updates",
    label: "Booking updates",
    hint: "Requests, acceptances, cancellations, check-ins, and completed walks.",
  },
  {
    key: "reviews",
    label: "Reviews",
    hint: "When someone leaves a review on one of your walks.",
  },
  {
    key: "reminders",
    label: "Reminders & offers",
    hint: "Expiring requests and the occasional Sidelick promotion.",
  },
];

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
        <Switch checked={checked} onChange={onChange} ariaLabel={label} />
      </div>
    </div>
  );
}

function NotificationSettingsInner() {
  const { prefs, isLoading, setPref } = useNotificationPrefs();
  const push = usePush();

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <BackButton />
      <h1 className="font-display mb-1 text-3xl font-semibold">Notifications</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Choose what Sidelick can notify you about. Turning a category off silences
        both the in-app bell and closed-app alerts.
      </p>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        {isLoading || !prefs ? (
          <div className="space-y-4">
            {CATEGORIES.map((c) => (
              <div key={c.key} className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-52" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          CATEGORIES.map((c) => (
            <ToggleRow
              key={c.key}
              label={c.label}
              hint={c.hint}
              checked={prefs[c.key]}
              onChange={(v) => setPref(c.key, v)}
            />
          ))
        )}
      </div>

      {/* Closed-app delivery (Web Push) — device-level, separate from categories. */}
      {push.supported && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <BellRing className="h-4 w-4 shrink-0" /> Alerts when Sidelick is closed
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {push.denied
                  ? "Notifications are blocked in your browser settings."
                  : "Get push notifications on this device even when the app isn't open."}
              </p>
            </div>
            <div className={push.denied ? "pointer-events-none opacity-50" : undefined}>
              <Switch
                checked={push.subscribed}
                onChange={(v) => (v ? void push.enable() : void push.disable())}
                ariaLabel="Closed-app notifications"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function NotificationSettingsPage() {
  return (
    <Protected>
      <NotificationSettingsInner />
    </Protected>
  );
}
