-- 0022_cash_settlements.sql
-- Cash-commission settlement (the "pin" from the payments work).
-- Cash bookings accrue positive cash_commission_due entries in walker_ledger;
-- nothing consumed them. Now:
--   * walkers see their balance and settle it over a manual rail (Whish/OMT/BOB)
--     using a minted reference; an admin confirms receipt, which posts a
--     negative 'adjustment' ledger entry closing the debt.
--   * walkers whose debt reaches platform_config.cash_debt_block_threshold
--     can't accept NEW bookings until they settle (Careem/Uber cash model).
-- Netting from online payouts plugs in later when the payout run is built.

CREATE TABLE IF NOT EXISTS commission_settlements (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    walker_id     UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

    amount        NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency      TEXT NOT NULL CHECK (currency IN ('USD', 'LBP', 'AED', 'SAR')),
    method        TEXT NOT NULL CHECK (method IN ('whish', 'omt', 'bob')),
    reference     TEXT NOT NULL,          -- e.g. SETTLE-WHISH-8F3K2Q; quoted when paying
    destination   TEXT,                   -- platform account the walker pays into (snapshot)

    status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'rejected')),
    admin_note    TEXT CHECK (char_length(admin_note) <= 1000),

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMPTZ
);

-- One in-flight settlement per walker.
CREATE UNIQUE INDEX IF NOT EXISTS uq_settlements_pending
    ON commission_settlements (walker_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_settlements_status ON commission_settlements (status, created_at DESC);

-- Debt level at which a walker stops being able to accept new bookings.
ALTER TABLE platform_config
    ADD COLUMN IF NOT EXISTS cash_debt_block_threshold NUMERIC(10, 2) NOT NULL DEFAULT 50.00;
