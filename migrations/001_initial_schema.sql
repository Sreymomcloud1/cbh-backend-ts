-- =============================================================================
-- Cambodia Business Hub — PostgreSQL Schema
-- Migration: 001_initial_schema.sql
-- Run with: psql $DATABASE_URL -f migrations/001_initial_schema.sql
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fuzzy search on startups

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role         AS ENUM ('startup', 'customer', 'admin');
CREATE TYPE verification_status AS ENUM ('Pending', 'Approved', 'Rejected');
CREATE TYPE funding_stage     AS ENUM (
  'Pre-Seed', 'Seed', 'Series A', 'Series B', 'Growth', 'Bootstrapped'
);
CREATE TYPE industry_type     AS ENUM (
  'Technology', 'Food & Beverage', 'Education', 'Finance',
  'Retail', 'Healthcare', 'Agriculture', 'Real Estate'
);
CREATE TYPE connection_purpose AS ENUM ('Collaborate', 'Invest', 'Become Customer');
CREATE TYPE request_status    AS ENUM ('New', 'Reviewed', 'Responded', 'Declined');
CREATE TYPE plan_type         AS ENUM ('free', 'pro');
CREATE TYPE document_type     AS ENUM (
  'business_registration', 'id_document', 'food_license',
  'health_license', 'construction_license', 'energy_cert',
  'tourism_license', 'nbc_license', 'other'
);

-- =============================================================================
-- TABLE: users
-- Stores all user accounts regardless of role.
-- Startup-specific and customer-specific fields live in separate profile tables.
-- =============================================================================

CREATE TABLE users (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             VARCHAR(255)  NOT NULL UNIQUE,
  password_hash     TEXT          NOT NULL,
  role              user_role     NOT NULL DEFAULT 'customer',
  name              VARCHAR(255)  NOT NULL,
  phone             VARCHAR(50),
  avatar_initials   CHAR(2)       GENERATED ALWAYS AS (
                      UPPER(SUBSTRING(name, 1, 1)) ||
                      COALESCE(UPPER(SUBSTRING(SPLIT_PART(name, ' ', 2), 1, 1)), '')
                    ) STORED,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email  ON users (email);
CREATE INDEX idx_users_role   ON users (role);

-- =============================================================================
-- TABLE: startup_profiles
-- One-to-one with users WHERE role = 'startup'.
-- Mirrors the Startup interface in frontend/types/index.ts exactly.
-- =============================================================================

CREATE TABLE startup_profiles (
  id                    UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID              NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Core identity (maps to Startup interface)
  slug                  VARCHAR(100)      NOT NULL UNIQUE,   -- URL-safe id e.g. "khmer-tech"
  business_name         VARCHAR(255)      NOT NULL,
  tagline               VARCHAR(300)      NOT NULL DEFAULT '',
  description           TEXT              NOT NULL DEFAULT '',
  logo_initials         CHAR(2)           NOT NULL DEFAULT '',  -- e.g. "KT"

  -- Classification
  industry              industry_type     NOT NULL,
  funding_stage         funding_stage     NOT NULL,
  plan                  plan_type         NOT NULL DEFAULT 'free',

  -- Metadata
  location              VARCHAR(255)      NOT NULL DEFAULT '',
  website               VARCHAR(500)      NOT NULL DEFAULT '',
  founded_year          CHAR(4),
  employee_range        VARCHAR(30),                          -- e.g. "45-60"

  -- Verification (eKYC)
  verification_status   verification_status NOT NULL DEFAULT 'Pending',
  verified_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  verified_by           UUID              REFERENCES users(id) ON DELETE SET NULL,

  -- Contact routing (three-role contact model from register.tsx)
  founder_name          VARCHAR(255),
  founder_email         VARCHAR(255),
  marketing_name        VARCHAR(255),
  marketing_email       VARCHAR(255),
  sales_name            VARCHAR(255),
  sales_email           VARCHAR(255),

  -- Timestamps
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_startup_slug         ON startup_profiles (slug);
CREATE INDEX idx_startup_industry     ON startup_profiles (industry);
CREATE INDEX idx_startup_funding      ON startup_profiles (funding_stage);
CREATE INDEX idx_startup_verified     ON startup_profiles (verification_status);
CREATE INDEX idx_startup_user         ON startup_profiles (user_id);
-- Full-text search index
CREATE INDEX idx_startup_fts ON startup_profiles
  USING GIN (to_tsvector('english', business_name || ' ' || tagline || ' ' || description));

-- =============================================================================
-- TABLE: startup_services
-- Services offered by a startup (e.g. "Mobile App Development").
-- Normalised out of startup_profiles to allow clean add/remove from dashboard.
-- =============================================================================

CREATE TABLE startup_services (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id  UUID        NOT NULL REFERENCES startup_profiles(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  sort_order  SMALLINT    NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_startup ON startup_services (startup_id);

-- =============================================================================
-- TABLE: startup_team_members
-- Team members displayed on the startup profile page.
-- Maps to TeamMember interface in frontend/types/index.ts.
-- =============================================================================

CREATE TABLE startup_team_members (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id    UUID        NOT NULL REFERENCES startup_profiles(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  role          VARCHAR(255) NOT NULL,
  avatar_initials CHAR(2)   NOT NULL DEFAULT '',
  sort_order    SMALLINT    NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_team_startup ON startup_team_members (startup_id);

-- =============================================================================
-- TABLE: customer_profiles
-- One-to-one with users WHERE role = 'customer'.
-- Captures fields from /customer/register.tsx form.
-- =============================================================================

CREATE TABLE customer_profiles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company     VARCHAR(255),
  title       VARCHAR(255),       -- Role/Title field from register form
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: verification_documents
-- eKYC files uploaded to Supabase Storage.
-- Stores the Supabase public URL + metadata.
-- Maps to BusinessSubmission.documents[] in frontend.
-- =============================================================================

CREATE TABLE verification_documents (
  id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id      UUID            NOT NULL REFERENCES startup_profiles(id) ON DELETE CASCADE,
  document_type   document_type   NOT NULL DEFAULT 'other',
  original_name   VARCHAR(500)    NOT NULL,          -- original filename
  storage_path    TEXT            NOT NULL,           -- Supabase Storage object path
  public_url      TEXT            NOT NULL,           -- Supabase public URL
  mime_type       VARCHAR(100),
  file_size_bytes BIGINT,
  uploaded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_docs_startup ON verification_documents (startup_id);

-- =============================================================================
-- TABLE: connection_requests
-- The core messaging / inbox system.
-- Maps to InboxItem interface and ConnectionFormData in frontend.
-- Covers all 3 purposes: Collaborate, Invest, Become Customer.
-- =============================================================================

CREATE TABLE connection_requests (
  id                UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Who is sending (always a customer/investor)
  sender_id         UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Which startup profile is targeted
  startup_id        UUID               NOT NULL REFERENCES startup_profiles(id) ON DELETE CASCADE,

  -- Maps to ConnectionFormData in ConnectionModal.tsx
  sender_full_name  VARCHAR(255)       NOT NULL,
  sender_company    VARCHAR(255)       NOT NULL DEFAULT '',
  sender_role       VARCHAR(255)       NOT NULL DEFAULT '',
  sender_email      VARCHAR(255)       NOT NULL,
  sender_phone      VARCHAR(50),
  budget_range      VARCHAR(100),                      -- only set when purpose = 'Invest'

  purpose           connection_purpose  NOT NULL,
  message           TEXT               NOT NULL,
  subject           VARCHAR(300)       NOT NULL DEFAULT '',

  status            request_status     NOT NULL DEFAULT 'New',
  startup_reply     TEXT,                              -- startup's reply message
  replied_at        TIMESTAMPTZ,

  created_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conn_sender   ON connection_requests (sender_id);
CREATE INDEX idx_conn_startup  ON connection_requests (startup_id);
CREATE INDEX idx_conn_status   ON connection_requests (status);
CREATE INDEX idx_conn_purpose  ON connection_requests (purpose);

-- =============================================================================
-- TABLE: platform_messages
-- System/admin broadcast messages that appear as "Platform Update" items
-- in every user's inbox (the "both" role items in InboxItem).
-- =============================================================================

CREATE TABLE platform_messages (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(300) NOT NULL,
  body        TEXT         NOT NULL,
  sent_by     UUID         REFERENCES users(id) ON DELETE SET NULL,  -- admin user
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: notification_preferences
-- Mirrors the toggles in the Settings panel of both dashboards.
-- =============================================================================

CREATE TABLE notification_preferences (
  user_id               UUID    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  new_requests          BOOLEAN NOT NULL DEFAULT TRUE,
  messages              BOOLEAN NOT NULL DEFAULT TRUE,
  platform_updates      BOOLEAN NOT NULL DEFAULT FALSE,
  newsletter            BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: refresh_tokens
-- Stores hashed refresh tokens for the JWT rotation flow.
-- =============================================================================

CREATE TABLE refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_user ON refresh_tokens (user_id);

-- =============================================================================
-- TRIGGERS: auto-update updated_at columns
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_startup_profiles
  BEFORE UPDATE ON startup_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_customer_profiles
  BEFORE UPDATE ON customer_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_connection_requests
  BEFORE UPDATE ON connection_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- SEED DATA: Admin user
-- Password: admin123 (bcrypt hash — regenerate in production!)
-- =============================================================================

INSERT INTO users (email, password_hash, role, name)
VALUES (
  'admin@cbh.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',  -- 'password' placeholder
  'admin',
  'CBH Admin'
) ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- VIEWS (convenience for API layer)
-- =============================================================================

-- Startup directory listing view — matches the Startup interface exactly
CREATE OR REPLACE VIEW v_startup_directory AS
SELECT
  sp.id,
  sp.slug,
  sp.business_name                                           AS name,
  sp.tagline,
  sp.description,
  sp.industry::TEXT,
  sp.funding_stage::TEXT                                     AS "fundingStage",
  sp.location,
  CASE WHEN sp.verification_status = 'Approved' THEN TRUE ELSE FALSE END AS verified,
  sp.logo_initials                                           AS logo,
  sp.founded_year                                            AS founded,
  sp.employee_range                                          AS employees,
  sp.website,
  sp.verification_status::TEXT                               AS "verificationStatus",
  sp.verified_at                                             AS "verifiedAt",
  sp.plan,
  u.email                                                    AS owner_email,
  u.id                                                       AS owner_id,
  sp.created_at
FROM startup_profiles sp
JOIN users u ON u.id = sp.user_id
WHERE u.is_active = TRUE;

-- Admin submissions view — matches BusinessSubmission interface exactly
CREATE OR REPLACE VIEW v_admin_submissions AS
SELECT
  sp.id,
  sp.slug,
  sp.business_name                        AS "businessName",
  u.name                                  AS "ownerName",
  u.email                                 AS "ownerEmail",
  u.phone,
  sp.industry::TEXT,
  sp.funding_stage::TEXT                  AS "fundingStage",
  sp.location,
  sp.tagline,
  sp.description,
  sp.website,
  sp.logo_initials                        AS logo,
  sp.verification_status::TEXT            AS "verificationStatus",
  sp.verified_at                          AS "verifiedAt",
  sp.rejection_reason                     AS "rejectionReason",
  sp.created_at                           AS "registeredAt",
  COALESCE(
    (SELECT JSON_AGG(vd.original_name ORDER BY vd.uploaded_at)
     FROM verification_documents vd WHERE vd.startup_id = sp.id),
    '[]'::JSON
  )                                       AS documents
FROM startup_profiles sp
JOIN users u ON u.id = sp.user_id;
