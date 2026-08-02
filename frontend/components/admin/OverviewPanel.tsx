"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  Flag,
  HandCoins,
  ShieldCheck,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { ListSkeleton, Skeleton } from "../ui/Skeleton";
import { apiFetch } from "../../lib/api";
import { api } from "../../lib/paths";

interface Overview {
  users: { owners: number; walkers: number; verifiedWalkers: number; newThisWeek: number };
  bookings: { total: number; requested: number; active: number; completed: number; newThisWeek: number };
  revenueThisMonth: { currency: string; volume: number; commission: number }[];
  outstandingCashDebt: { currency: string; amount: number }[];
  queues: {
    pendingVerifications: number;
    openDisputes: number;
    openPetReports: number;
    pendingSettlements: number;
    pendingPayments: number;
  };
  reviews: { avgRating: number | null; count: number };
}

const money = (n: number, cur: string) =>
  cur === "USD" ? `$${n.toFixed(0)}` : `${n.toFixed(0)} ${cur}`;

function Tile({
  icon: Icon,
  value,
  label,
  tone = "accent",
  onClick,
  attention = false,
}: {
  icon: typeof Users;
  value: string;
  label: string;
  tone?: "accent" | "trust" | "primary" | "warning";
  onClick?: () => void;
  attention?: boolean;
}) {
  const toneCls = {
    accent: "bg-accent-subtle text-link",
    trust: "bg-trust-subtle text-trust-strong",
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
  }[tone];
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left shadow-sm ${
        attention ? "border-warning/40 bg-warning/5" : "border-border bg-surface"
      } ${onClick ? "lift w-full hover:shadow-md" : ""}`}
    >
      <span className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full ${toneCls}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="font-display text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </Wrapper>
  );
}

/** The daily numbers, with attention-needing queues surfaced first. */
export function OverviewPanel({ goTo }: { goTo: (tab: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => (await apiFetch<{ overview: Overview }>(api.adminOverview)).overview,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <ListSkeleton count={2}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </ListSkeleton>
    );
  }

  const q = data.queues;
  const revenue = data.revenueThisMonth.find((r) => r.currency === "USD") ??
    data.revenueThisMonth[0] ?? { currency: "USD", volume: 0, commission: 0 };
  const debt = data.outstandingCashDebt.find((d) => d.currency === "USD");

  return (
    <div className="space-y-6">
      {/* Needs attention — every tile is a jump link into its queue. */}
      <div>
        <h2 className="font-display mb-3 text-lg font-medium">Needs attention</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            icon={ShieldCheck}
            value={String(q.pendingVerifications)}
            label="Verifications waiting"
            tone="trust"
            attention={q.pendingVerifications > 0}
            onClick={() => goTo("verifications")}
          />
          <Tile
            icon={Wallet}
            value={String(q.pendingPayments + q.pendingSettlements)}
            label="Payments to confirm"
            tone="primary"
            attention={q.pendingPayments + q.pendingSettlements > 0}
            onClick={() => goTo("payments")}
          />
          <Tile
            icon={AlertTriangle}
            value={String(q.openDisputes)}
            label="Open disputes"
            tone="warning"
            attention={q.openDisputes > 0}
            onClick={() => goTo("disputes")}
          />
          <Tile
            icon={Flag}
            value={String(q.openPetReports)}
            label="Pet reports"
            tone="warning"
            attention={q.openPetReports > 0}
            onClick={() => goTo("petReports")}
          />
        </div>
      </div>

      {/* Business health */}
      <div>
        <h2 className="font-display mb-3 text-lg font-medium">This month</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            icon={Wallet}
            value={money(revenue.commission, revenue.currency)}
            label={`Commission earned · ${money(revenue.volume, revenue.currency)} volume`}
            tone="primary"
          />
          <Tile
            icon={HandCoins}
            value={debt ? money(debt.amount, debt.currency) : "$0"}
            label="Cash commission outstanding"
            tone="warning"
          />
          <Tile
            icon={CalendarDays}
            value={String(data.bookings.newThisWeek)}
            label={`Bookings this week · ${data.bookings.active} active now`}
            tone="trust"
          />
          <Tile
            icon={Star}
            value={data.reviews.avgRating != null ? data.reviews.avgRating.toFixed(1) : "—"}
            label={`Avg rating · ${data.reviews.count} review${data.reviews.count === 1 ? "" : "s"}`}
            tone="accent"
          />
        </div>
      </div>

      {/* Platform totals */}
      <div>
        <h2 className="font-display mb-3 text-lg font-medium">Platform</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile icon={Users} value={String(data.users.owners)} label="Pet owners" />
          <Tile
            icon={Users}
            value={`${data.users.verifiedWalkers}/${data.users.walkers}`}
            label="Walkers verified"
            tone="trust"
          />
          <Tile icon={Users} value={String(data.users.newThisWeek)} label="New signups this week" />
          <Tile
            icon={CalendarDays}
            value={String(data.bookings.completed)}
            label={`Completed bookings · ${data.bookings.total} all-time`}
          />
        </div>
      </div>
    </div>
  );
}
