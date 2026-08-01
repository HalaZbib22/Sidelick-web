"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Copy, HandCoins, Hourglass, Lock } from "lucide-react";
import { Button } from "../ui/Button";
import { useCashBalance, useCreateSettlement } from "../../hooks/useSettlements";
import { getApiErrorMessage } from "../../lib/forms";
import type { SettlementRail } from "../../lib/types";

const RAIL_LABEL: Record<SettlementRail, string> = {
  whish: "Whish Money",
  omt: "OMT",
  bob: "BOB Finance",
};

function money(amount: number | string, currency: string): string {
  const n = Number(amount);
  return `${currency === "USD" ? "$" : `${currency} `}${n.toFixed(2)}`;
}

/**
 * "You owe Sidelick $X" — the walker-side face of cash-commission collection.
 * Hidden at zero balance. Below the threshold it's a calm heads-up with a
 * progress bar; at the threshold it flips to blocked (can't accept bookings).
 * Settling: pick a rail → get a reference + destination → pay out-of-band →
 * admin confirms → balance clears.
 */
export function CashDebtCard() {
  const { data } = useCashBalance();
  const create = useCreateSettlement();
  const reduce = useReducedMotion();
  const [settling, setSettling] = useState(false);

  if (!data) return null;
  const usd = data.balances.find((b) => b.currency === "USD");
  const pending = data.pendingSettlement;
  if ((!usd || usd.amount <= 0) && !pending) return null;

  const amount = usd?.amount ?? 0;
  const pct = Math.min(100, Math.round((amount / data.threshold) * 100));

  function copyReference(ref: string) {
    navigator.clipboard?.writeText(ref).then(
      () => toast.success("Reference copied"),
      () => toast.error("Couldn't copy — note it down manually.")
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${
        data.blocked ? "border-danger/30 bg-danger/5" : "border-warning/30 bg-warning/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            data.blocked ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
          }`}
        >
          {data.blocked ? <Lock className="h-5 w-5" /> : <HandCoins className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold leading-tight">
            {pending
              ? "Settlement pending"
              : `You owe Sidelick ${money(amount, "USD")}`}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pending
              ? "We'll clear your balance as soon as your payment is confirmed."
              : data.blocked
                ? "New bookings are paused until you settle your cash-commission balance."
                : `Commission from cash bookings. At ${money(data.threshold, "USD")}, new bookings pause until you settle.`}
          </p>

          {/* Progress toward the block threshold */}
          {!pending && !data.blocked && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-warning/15">
              <div
                className="h-full rounded-full bg-warning transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}

          {/* In-flight settlement: reference + destination to pay */}
          {pending && (
            <div className="mt-3 space-y-1.5 rounded-xl border border-border bg-surface p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Send</span>
                <span className="font-semibold">{money(pending.amount, pending.currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Via</span>
                <span className="font-medium">{RAIL_LABEL[pending.method]}</span>
              </div>
              {pending.destination && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">To</span>
                  <span className="font-medium">{pending.destination}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Reference</span>
                <button
                  type="button"
                  onClick={() => copyReference(pending.reference)}
                  className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-link hover:opacity-80"
                >
                  {pending.reference}
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <Hourglass className="h-3 w-3" /> Quote the reference when sending — we confirm
                receipts within a day.
              </p>
            </div>
          )}

          {/* Rail picker */}
          {!pending && (
            <div className="mt-3">
              {!settling ? (
                <Button onClick={() => setSettling(true)} className="w-full sm:w-auto">
                  Settle up
                </Button>
              ) : (
                <AnimatePresence initial={!reduce}>
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="space-y-2"
                  >
                    <p className="text-sm font-medium">How will you send it?</p>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(RAIL_LABEL) as SettlementRail[]).map((rail) => (
                        <button
                          key={rail}
                          type="button"
                          disabled={create.isPending}
                          onClick={() =>
                            create.mutate(rail, {
                              onSuccess: () => setSettling(false),
                              onError: (e) => toast.error(getApiErrorMessage(e)),
                            })
                          }
                          className="lift rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:border-primary disabled:opacity-50"
                        >
                          {RAIL_LABEL[rail]}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettling(false)}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
