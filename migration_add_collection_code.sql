-- Migration: Add collection_code to orders table
-- This code is used for merchandise collection at the festival

ALTER TABLE orders ADD COLUMN collection_code VARCHAR(6) UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_orders_collection_code ON orders(collection_code);
