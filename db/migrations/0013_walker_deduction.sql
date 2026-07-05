-- 0013_walker_deduction.sql
-- Fault-based refund liability. When a dispute is resolved with a refund AND the
-- walker is at fault, the refund is docked from the walker's still-held payout
-- (proportional to their share of the booking total). Because payout is held
-- through the review window, this is never a clawback — it just reduces what a
-- payout batch releases. If the refund is platform goodwill (walker not at
-- fault), walker_liable is false and no deduction is taken.

-- How much of this payment's walker payout is withheld due to dispute fault.
-- The payout batch releases (walker_payout - walker_deduction).
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS walker_deduction NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- Whether the resolution held the walker financially responsible for the refund.
-- true  = walker at fault, refund docked from their payout (default)
-- false = platform goodwill, walker still paid in full
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS walker_liable BOOLEAN NOT NULL DEFAULT true;
