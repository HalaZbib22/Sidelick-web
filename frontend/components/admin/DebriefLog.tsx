"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Repeat, Star } from "lucide-react";
import { ListSkeleton, BookingCardSkeleton } from "../ui/Skeleton";
import { apiFetch } from "../../lib/api";
import { api } from "../../lib/paths";
import type { AdminDebrief, DebriefStats } from "../../lib/types";

const CHIP_TONE: Record<string, string> = {
  // positive
  yes: "bg-trust-subtle text-trust-strong",
  great: "bg-trust-subtle text-trust-strong",
  smooth: "bg-trust-subtle text-trust-strong",
  // neutral
  mostly: "bg-muted text-muted-foreground",
  fine: "bg-muted text-muted-foreground",
  minor_issues: "bg-muted text-muted-foreground",
  maybe: "bg-muted text-muted-foreground",
  // negative
  no: "bg-danger/10 text-danger",
  difficult: "bg-danger/10 text-danger",
  problematic: "bg-danger/10 text-danger",
};

const FIELD_LABEL: Record<string, string> = {
  yes: "Pet as described",
  mostly: "Pet mostly as described",
  no: "Pet not as described",
  great: "Owner great",
  fine: "Owner fine",
  difficult: "Owner difficult",
  smooth: "Handoff smooth",
  minor_issues: "Handoff hiccups",
  problematic: "Handoff problematic",
};

function StatTile({
  icon: Icon,
  value,
  label,
  tone = "accent",
}: {
  icon: typeof Star;
  value: string;
  label: string;
  tone?: "accent" | "trust" | "primary";
}) {
  const toneCls =
    tone === "trust"
      ? "bg-trust-subtle text-trust-strong"
      : tone === "primary"
        ? "bg-primary/10 text-primary"
        : "bg-accent-subtle text-link";
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <span className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full ${toneCls}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="font-display text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Internal service analytics from walker debriefs. */
export function DebriefLog() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "debriefs"],
    queryFn: async () =>
      apiFetch<{ stats: DebriefStats; debriefs: AdminDebrief[] }>(api.adminDebriefs),
  });

  if (isLoading || !data) {
    return (
      <ListSkeleton count={3}>
        <BookingCardSkeleton />
      </ListSkeleton>
    );
  }

  const { stats, debriefs } = data;
  const responseRate =
    stats.submitted + stats.skipped > 0
      ? Math.round((100 * stats.submitted) / (stats.submitted + stats.skipped))
      : null;

  return (
    <div>
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatTile
          icon={Star}
          value={stats.avgOverall != null ? stats.avgOverall.toFixed(1) : "—"}
          label={`Avg rating · ${stats.submitted} debrief${stats.submitted === 1 ? "" : "s"}${
            responseRate != null ? ` · ${responseRate}% response` : ""
          }`}
          tone="primary"
        />
        <StatTile
          icon={Repeat}
          value={stats.workAgainYesPct != null ? `${stats.workAgainYesPct}%` : "—"}
          label="Would work with owner again"
          tone="trust"
        />
        <StatTile
          icon={AlertTriangle}
          value={stats.petMismatchPct != null ? `${stats.petMismatchPct}%` : "—"}
          label="Pet profiles not fully accurate"
        />
      </div>

      {debriefs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No debriefs yet — they'll appear as walkers complete bookings.
        </div>
      ) : (
        <div className="space-y-3">
          {debriefs.map((d) => (
            <div key={d.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {d.walkerName} <span className="text-muted-foreground">on</span>{" "}
                  {d.ownerName}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    · {d.serviceType.replace("_", " & ")} ·{" "}
                    {new Date(d.startAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </p>
                <span className="text-sm font-semibold text-primary">★ {d.overall}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[d.petAsDescribed, d.ownerCommunication, d.handoff].map((v) => (
                  <span
                    key={v}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CHIP_TONE[v]}`}
                  >
                    {FIELD_LABEL[v]}
                  </span>
                ))}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CHIP_TONE[d.workAgain]}`}
                >
                  {d.workAgain === "yes"
                    ? "Would rebook owner"
                    : d.workAgain === "maybe"
                      ? "Might rebook owner"
                      : "Wouldn't rebook owner"}
                </span>
              </div>
              {d.note && <p className="mt-2 text-sm leading-relaxed">{d.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
