-- 0008_push_subscriptions.sql
-- Web Push (closed-app notifications). One row per browser/device a user
-- subscribed from. The endpoint is the unique push target; p256dh + auth are
-- the encryption keys the Push API hands us. Pruned automatically when the
-- push service reports the subscription is gone (404/410).

CREATE TABLE push_subscriptions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    endpoint     TEXT NOT NULL UNIQUE,
    p256dh       TEXT NOT NULL,
    auth         TEXT NOT NULL,
    user_agent   TEXT,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_subs_user ON push_subscriptions (user_id);
