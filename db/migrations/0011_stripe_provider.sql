-- 0011_stripe_provider.sql
-- Enable Stripe as a payment provider (test/reference adapter, and the intended
-- rail for the Gulf expansion). Lebanon launch rails (Whish/OMT/Tap/Areeba) are
-- already allowed; this only adds 'stripe' to the provider/method enums.
--
-- Stripe money flow maps onto the existing columns:
--   payments.provider     = 'stripe'
--   payments.method       = 'card'
--   payments.provider_ref = the Stripe PaymentIntent id (pi_...)
-- Payouts to walkers via Stripe (Connect transfers) use payouts.method='stripe';
-- Lebanon still pays out via whish/omt as a back-office run.

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_provider_check
  CHECK (provider IN ('whish', 'omt', 'tap', 'areeba', 'paytabs', 'cash', 'stripe'));

ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_method_check;
ALTER TABLE payouts
  ADD CONSTRAINT payouts_method_check
  CHECK (method IN ('whish', 'omt', 'tap_destination', 'paytabs_split', 'bank', 'stripe'));

-- Webhooks and status polls look a payment up by its provider reference.
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON payments (provider_ref);
