-- Migration to add is_active flag to admins table
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE admins SET is_active = FALSE WHERE is_active IS NULL;
