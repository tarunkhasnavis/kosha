-- ============================================================================
-- Migration: Add opportunity scoring fields to accounts table
-- Enables deterministic account prioritization based on activity signals
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Score (1-100) mirrors discovered_accounts.ai_score pattern
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100);

-- Human-readable reasons explaining the score (e.g. "Competitor gained shelf share 3 days ago")
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS score_reasons TEXT[] NOT NULL DEFAULT '{}';

-- Timestamp of last score computation for freshness tracking
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;

-- Index for sorting accounts by score (highest priority first)
CREATE INDEX IF NOT EXISTS idx_accounts_score ON accounts(score DESC);
