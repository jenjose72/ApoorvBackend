-- Migration to add order_number column for user-friendly Order IDs
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(20) UNIQUE;
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 10001;
