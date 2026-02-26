-- Migration to add password_hash and last_login_at to admins table
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

