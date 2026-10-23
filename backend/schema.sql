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

 
-- Claims workspace with urgency/SLA-based queue ordering.
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policyholder VARCHAR(120) NOT NULL CHECK (char_length(trim(policyholder)) > 0),
  policy_number VARCHAR(80) NOT NULL UNIQUE CHECK (char_length(trim(policy_number)) > 0),
  claim_type VARCHAR(80) NOT NULL CHECK (char_length(trim(claim_type)) > 0),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 5000),
  claim_value NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (claim_value >= 0),
  urgency VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  status VARCHAR(24) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_review', 'awaiting_information', 'approved', 'rejected', 'closed')),
  sla_due_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_claims_priority ON claims (urgency, sla_due_at, created_at);
CREATE INDEX IF NOT EXISTS idx_claims_created_by ON claims (created_by);
CREATE INDEX IF NOT EXISTS idx_claims_assigned_to ON claims (assigned_to);
