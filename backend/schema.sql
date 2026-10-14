-- Run this file against your CLAIMSYNC PostgreSQL database.
-- The API normalizes email addresses to lowercase before inserting.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL CHECK (char_length(trim(name)) > 0),
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'agent'
    CHECK (role IN ('admin', 'team_lead', 'agent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
