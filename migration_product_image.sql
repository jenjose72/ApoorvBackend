-- Migration: Add image_url to products
ALTER TABLE products ADD COLUMN image_url TEXT;

-- Update existing products with a placeholder or sample image if needed
UPDATE products SET image_url = 'https://res.cloudinary.com/dummy/image/upload/v1/apoorv/white_tee.jpg' WHERE name ILIKE '%Tee%';
UPDATE products SET image_url = 'https://res.cloudinary.com/dummy/image/upload/v1/apoorv/hoodie.jpg' WHERE name ILIKE '%Hoodie%';
