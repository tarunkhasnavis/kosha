-- ============================================================================
-- Migration: Add enrichment fields (phone, website, hours) to accounts table
-- Run this in Supabase SQL Editor
-- ============================================================================

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS hours TEXT;
