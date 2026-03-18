-- Add distributor_name to accounts for wholesaler recap grouping
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS distributor_name text;
