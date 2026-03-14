-- ============================================================================
-- Migration: Add Account Discovery + Account Detail tables
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Account Contacts
-- Store contacts associated with managed accounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE account_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contacts in their org"
  ON account_contacts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM supplier_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contacts in their org"
  ON account_contacts FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM supplier_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete contacts in their org"
  ON account_contacts FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM supplier_profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX idx_account_contacts_account ON account_contacts(account_id);

-- 2. Account Notes
-- Free-form notes on managed accounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE account_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes in their org"
  ON account_notes FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM supplier_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert notes in their org"
  ON account_notes FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM supplier_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own notes"
  ON account_notes FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX idx_account_notes_account ON account_notes(account_id);

-- 3. Account Photos
-- Photo references for managed accounts (scaffold — no storage yet)
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE account_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view photos in their org"
  ON account_photos FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM supplier_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert photos in their org"
  ON account_photos FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM supplier_profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX idx_account_photos_account ON account_photos(account_id);

-- 4. Discovered Accounts
-- Pre-seeded accounts from Google Places for Account Discovery feature
-- ============================================================================
CREATE TABLE IF NOT EXISTS discovered_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  google_place_id TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'bar', 'restaurant', 'liquor_store', 'brewery', 'hotel', 'convenience_store'
  )),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  google_rating DOUBLE PRECISION,
  google_review_count INTEGER,
  ai_score INTEGER NOT NULL DEFAULT 50 CHECK (ai_score BETWEEN 1 AND 100),
  ai_reasons TEXT[] NOT NULL DEFAULT '{}',
  hours TEXT,
  website TEXT,
  is_claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE discovered_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view discovered accounts in their org"
  ON discovered_accounts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM supplier_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update discovered accounts in their org"
  ON discovered_accounts FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM supplier_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert discovered accounts in their org"
  ON discovered_accounts FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM supplier_profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX idx_discovered_accounts_category ON discovered_accounts(organization_id, category);
CREATE INDEX idx_discovered_accounts_score ON discovered_accounts(ai_score DESC);
CREATE INDEX idx_discovered_accounts_location ON discovered_accounts(latitude, longitude);
