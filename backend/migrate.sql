-- Migration script for adding categories table and new product fields
-- Run this SQL script directly on your PostgreSQL database

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  parent_id INTEGER,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) 
    REFERENCES categories(id) ON DELETE SET NULL ON UPDATE NO ACTION
);

-- Add new columns to products table
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS article VARCHAR(100),
  ADD COLUMN IF NOT EXISTS category_id INTEGER,
  ADD COLUMN IF NOT EXISTS type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
  ADD COLUMN IF NOT EXISTS model VARCHAR(100),
  ADD COLUMN IF NOT EXISTS color VARCHAR(50),
  ADD COLUMN IF NOT EXISTS size VARCHAR(50),
  ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255),
  ADD COLUMN IF NOT EXISTS warranty_period INTEGER,
  ADD COLUMN IF NOT EXISTS production_date TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS min_stock DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_stock DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add foreign key constraint for category_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'products_category_id_fkey'
  ) THEN
    ALTER TABLE products 
      ADD CONSTRAINT products_category_id_fkey 
      FOREIGN KEY (category_id) 
      REFERENCES categories(id) 
      ON DELETE SET NULL 
      ON UPDATE NO ACTION;
  END IF;
END $$;

-- Add payment_date to sale_invoices
ALTER TABLE sale_invoices
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP(6);

-- Add is_active to sale_invoices
ALTER TABLE sale_invoices
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add is_active to purchase_invoices
ALTER TABLE purchase_invoices
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

