-- Migration: Add collection verification fields to orders table
-- Run this once before deploying the collection verification feature

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collected_by INTEGER REFERENCES admins(id) DEFAULT NULL;

-- Index for fast lookup by collection_code during distribution
CREATE INDEX IF NOT EXISTS idx_orders_collection_code ON orders(collection_code) WHERE collection_code IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('collected_at', 'collected_by', 'collection_code');
