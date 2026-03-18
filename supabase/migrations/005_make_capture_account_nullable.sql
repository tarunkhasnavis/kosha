-- Allow captures without an account (prep briefings, discovery conversations)
ALTER TABLE captures ALTER COLUMN account_id DROP NOT NULL;
