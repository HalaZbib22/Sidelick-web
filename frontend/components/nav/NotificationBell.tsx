"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  Check,
  CalendarPlus,
  CalendarCheck,
  CalendarX,
  CalendarClock,
  Play,
  CheckCircle2,
  Star,
  Wallet,
  Tag,
  Settings,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import { usePush } from "../../hooks/usePush";
import { routes } from "../../lib/paths";
import { cn } from "../../lib/utils";
import type { NotificationType, AppNotification } from "../../lib/types";

const ICON: Record<NotificationType, typeof Bell> = {
  booking_requested: CalendarPlus,
  booking_accepted: CalendarCheck,
  booking_declined: CalendarX,
  booking_cancelled: CalendarX,
  booking_expired: CalendarClock,
  walk_started: Play,
  walk_completed: CheckCircle2,
  review_received: Star,
  payment_received: Wallet,
  dispute_opened: ShieldAlert,
  dispute_resolved: ShieldCheck,
  promo: Tag,
};

/** Relative "time ago" for the notification row. */
function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const push = usePush();
  const [open, setOpen] = useState(false);

  const onClickItem = (n: AppNotification) => {
    if (!n.readAt) markRead(n.id);
    setOpen(false);
    // Expired requests have no actionable booking — send the customer to rebook.
    if (n.type === "booking_expired") router.push(routes.walkers);
    else if (n.bookingId) router.push(routes.booking(n.bookingId));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border transition hover:bg-muted"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  className="flex items-center gap-1 text-xs font-medium text-link hover:underline"
                >
                  <Check className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  You&apos;re all caught up.
                </p>
              ) : (
                notifications.map((n) => {
                  const Icon = ICON[n.type] ?? Bell;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onClickItem(n)}
                      className={cn(
                        "flex w-full gap-3 border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-muted/40",
                        !n.readAt && "bg-accent-subtle/40"
                      )}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-link">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{n.title}</span>
                          {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        </span>
                        {n.body && <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>}
                        <span className="mt-1 block text-[11px] text-muted-foreground">{ago(n.createdAt)}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Closed-app push: offer to enable when supported and not yet on. */}
            {push.supported && !push.subscribed && !push.denied && (
              <button
                type="button"
                onClick={() => void push.enable()}
                disabled={push.busy}
                className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-left text-xs font-medium text-link transition hover:bg-muted/40 disabled:opacity-60"
              >
                <BellRing className="h-4 w-4 shrink-0" />
                Get notified even when Sidelick is closed
              </button>
            )}
            {push.supported && push.subscribed && (
              <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <BellRing className="h-3.5 w-3.5" /> Closed-app alerts on
                </span>
                <button
                  type="button"
                  onClick={() => void push.disable()}
                  disabled={push.busy}
                  className="font-medium hover:underline disabled:opacity-60"
                >
                  Turn off
                </button>
              </div>
            )}
            {push.supported && push.denied && (
              <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
                Notifications are blocked in your browser settings.
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(routes.notificationSettings);
              }}
              className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-xs font-medium text-muted-foreground transition hover:bg-muted/40"
            >
              <Settings className="h-3.5 w-3.5 shrink-0" /> Notification settings
            </button>
          </div>
        </>
      )}
    </div>
  );
}
