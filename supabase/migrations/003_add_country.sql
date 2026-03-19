-- Add country column to visits table
ALTER TABLE visits ADD COLUMN IF NOT EXISTS country text;
