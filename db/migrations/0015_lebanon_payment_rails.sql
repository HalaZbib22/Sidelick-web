-- 0015_lebanon_payment_rails.sql
-- Lebanon launch payment rails: Whish, OMT, BOB Finance and cash-on-service.
--
-- These rails don't behave like a card hold. Whish/OMT/BOB are collected
-- out-of-band (the customer pays into the platform's Whish number / OMT or BOB
-- beneficiary, quoting a reference), and we reconcile receipt manually until a
-- live merchant API is wired. Cash is paid to the walker at the walk; the
-- platform never touches the money, so it bills the walker its commission via a
-- ledger that later nets against the walker's online earnings.
--
-- Money flow onto existing columns:
--   Whish  → provider='whish', method='cash_in'
--   OMT    → provider='omt',   method='transfer'
--   BOB    → provider='bob',   method='transfer'
--   Cash   → provider='cash',  method='cash_on_service'
-- provider_ref holds the reconciliation reference we show the customer.

-- 1. Allow 'bob' as a payment provider (whish/omt/cash/stripe already allowed).
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_provider_check
  CHECK (provider IN ('whish', 'omt', 'bob', 'tap', 'areeba', 'paytabs', 'cash', 'stripe'));

-- Walkers are paid out over the same Lebanese rails, so allow them as payout methods too.
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_method_check;
ALTER TABLE payouts
  ADD CONSTRAINT payouts_method_check
  CHECK (method IN ('whish', 'omt', 'bob', 'tap_destination', 'paytabs_split', 'bank', 'stripe'));

-- 2. Destination handles the customer sends money to for each manual rail.
--    Dev placeholders — set real values in production config.
ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS whish_number     TEXT NOT NULL DEFAULT '+961 00 000 000',
  ADD COLUMN IF NOT EXISTS omt_beneficiary  TEXT NOT NULL DEFAULT 'Sidelick SAL',
  ADD COLUMN IF NOT EXISTS bob_beneficiary  TEXT NOT NULL DEFAULT 'Sidelick SAL';

-- 3. Customer's self-reported "I've sent the money" marker on a manual-rail
--    payment. NULL until they tap it; set = it enters the admin confirmation
--    queue. Admin confirming receipt flips the row pending → held.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payer_marked_paid_at TIMESTAMPTZ;

-- 4. Walker commission ledger. For cash bookings the walker holds the full
--    customer amount and owes the platform its commission. A positive amount =
--    walker owes the platform; a payout batch nets outstanding entries against
--    the walker's online earnings before releasing them.
CREATE TABLE IF NOT EXISTS walker_ledger (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    walker_id   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    booking_id  UUID REFERENCES bookings (id) ON DELETE SET NULL,
    entry_type  TEXT NOT NULL CHECK (entry_type IN ('cash_commission_due', 'payout_offset', 'adjustment')),
    amount      NUMERIC(10, 2) NOT NULL,   -- positive = walker owes platform; negative = credit
    currency    TEXT NOT NULL CHECK (currency IN ('USD', 'LBP', 'AED', 'SAR')),
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_walker_ledger_walker ON walker_ledger (walker_id, created_at);

-- One commission entry per cash booking (idempotent re-runs of "collect cash").
CREATE UNIQUE INDEX IF NOT EXISTS uq_walker_ledger_cash_commission
  ON walker_ledger (booking_id) WHERE entry_type = 'cash_commission_due';
