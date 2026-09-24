CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE flags (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                TEXT UNIQUE NOT NULL CHECK (key ~ '^[a-z0-9_]{3,64}$'),
  name               TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  enabled            BOOLEAN NOT NULL DEFAULT false,
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','rolling_out','paused','completed','rolled_back')),
  control_variant    TEXT NOT NULL DEFAULT 'old',
  treatment_variant  TEXT NOT NULL DEFAULT 'new',
  bucket_by          TEXT NOT NULL DEFAULT 'userId',
  salt               TEXT NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  rollout_percentage NUMERIC(5,2) NOT NULL DEFAULT 0
                     CHECK (rollout_percentage BETWEEN 0 AND 100),
  rollout_steps      NUMERIC(5,2)[] NOT NULL DEFAULT '{5,10,25,50,100}',
  version            INT NOT NULL DEFAULT 1,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE targeting_conditions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id       UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
  sort_order    INT NOT NULL DEFAULT 0,
  attribute     TEXT NOT NULL,
  operator      TEXT NOT NULL CHECK (operator IN ('eq','neq','in','not_in','gt','lt','exists')),
  match_values  JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE flag_overrides (
  flag_id  UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL,
  kind     TEXT NOT NULL CHECK (kind IN ('include','exclude')),
  PRIMARY KEY (flag_id, user_id)
);

CREATE TABLE guardrails (
  flag_id               UUID PRIMARY KEY REFERENCES flags(id) ON DELETE CASCADE,
  enabled               BOOLEAN NOT NULL DEFAULT true,
  error_rate_threshold  NUMERIC(6,4) NOT NULL DEFAULT 0.03,
  min_samples           INT NOT NULL DEFAULT 20,
  consecutive_breaches  INT NOT NULL DEFAULT 2,
  canary_error_query    TEXT NOT NULL,
  baseline_error_query  TEXT NOT NULL,
  canary_samples_query  TEXT NOT NULL
);

CREATE TABLE rollout_events (
  id               BIGSERIAL PRIMARY KEY,
  flag_id          UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  from_percentage  NUMERIC(5,2),
  to_percentage    NUMERIC(5,2),
  actor            TEXT NOT NULL,
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rollout_events_flag_time ON rollout_events (flag_id, created_at DESC);

CREATE TABLE incidents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id              UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  observed_error_rate  NUMERIC(6,4) NOT NULL,
  baseline_error_rate  NUMERIC(6,4),
  threshold            NUMERIC(6,4) NOT NULL,
  exposed_percentage   NUMERIC(5,2) NOT NULL,
  exposed_users        INT,
  sample_size          INT NOT NULL,
  reason               TEXT NOT NULL,
  first_breach_at      TIMESTAMPTZ NOT NULL,
  rolled_back_at       TIMESTAMPTZ NOT NULL,
  resolved_at          TIMESTAMPTZ
);
CREATE INDEX idx_incidents_flag_time ON incidents (flag_id, rolled_back_at DESC);

CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  actor         TEXT NOT NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  before_state  JSONB,
  after_state   JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
