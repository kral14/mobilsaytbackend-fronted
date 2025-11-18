-- Complete database schema creation script
-- This script creates all tables defined in the Prisma schema
-- Run this in Neon Dashboard SQL Editor or via psql

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  balance DECIMAL(10, 2) DEFAULT 0,
  folder_id INTEGER
);

-- Create customer_folders table
CREATE TABLE IF NOT EXISTS customer_folders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  parent_id INTEGER,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for customer_folders parent_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customer_folders_parent_id_fkey'
  ) THEN
    ALTER TABLE customer_folders 
      ADD CONSTRAINT customer_folders_parent_id_fkey 
      FOREIGN KEY (parent_id) 
      REFERENCES customer_folders(id) 
      ON DELETE SET NULL 
      ON UPDATE NO ACTION;
  END IF;
END $$;

-- Add foreign key constraint for customers folder_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customers_folder_id_fkey'
  ) THEN
    ALTER TABLE customers 
      ADD CONSTRAINT customers_folder_id_fkey 
      FOREIGN KEY (folder_id) 
      REFERENCES customer_folders(id) 
      ON DELETE SET NULL 
      ON UPDATE NO ACTION;
  END IF;
END $$;

-- Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table if not exists
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  parent_id INTEGER,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) 
    REFERENCES categories(id) ON DELETE SET NULL ON UPDATE NO ACTION
);

-- Create products table if not exists
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  barcode VARCHAR(100),
  description TEXT,
  unit VARCHAR(50) DEFAULT 'ədəd',
  purchase_price DECIMAL(10, 2) DEFAULT 0,
  sale_price DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  code VARCHAR(20),
  article VARCHAR(100),
  category_id INTEGER,
  type VARCHAR(100),
  brand VARCHAR(100),
  model VARCHAR(100),
  color VARCHAR(50),
  size VARCHAR(50),
  weight DECIMAL(10, 2),
  country VARCHAR(100),
  manufacturer VARCHAR(255),
  warranty_period INTEGER,
  production_date TIMESTAMP(6),
  expiry_date TIMESTAMP(6),
  min_stock DECIMAL(10, 2) DEFAULT 0,
  max_stock DECIMAL(10, 2),
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Add foreign key constraint for products category_id
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

-- Create suppliers table if not exists
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  balance DECIMAL(10, 2) DEFAULT 0
);

-- Create sale_invoices table if not exists
CREATE TABLE IF NOT EXISTS sale_invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  customer_id INTEGER,
  total_amount DECIMAL(10, 2) DEFAULT 0,
  invoice_date TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  payment_date TIMESTAMP(6),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for sale_invoices customer_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sale_invoices_customer_id_fkey'
  ) THEN
    ALTER TABLE sale_invoices 
      ADD CONSTRAINT sale_invoices_customer_id_fkey 
      FOREIGN KEY (customer_id) 
      REFERENCES customers(id) 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION;
  END IF;
END $$;

-- Create sale_invoice_items table if not exists
CREATE TABLE IF NOT EXISTS sale_invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER,
  product_id INTEGER,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL
);

-- Add foreign key constraints for sale_invoice_items
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sale_invoice_items_invoice_id_fkey'
  ) THEN
    ALTER TABLE sale_invoice_items 
      ADD CONSTRAINT sale_invoice_items_invoice_id_fkey 
      FOREIGN KEY (invoice_id) 
      REFERENCES sale_invoices(id) 
      ON DELETE CASCADE 
      ON UPDATE NO ACTION;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sale_invoice_items_product_id_fkey'
  ) THEN
    ALTER TABLE sale_invoice_items 
      ADD CONSTRAINT sale_invoice_items_product_id_fkey 
      FOREIGN KEY (product_id) 
      REFERENCES products(id) 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION;
  END IF;
END $$;

-- Create purchase_invoices table if not exists
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  supplier_id INTEGER,
  total_amount DECIMAL(10, 2) DEFAULT 0,
  invoice_date TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for purchase_invoices supplier_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_invoices_supplier_id_fkey'
  ) THEN
    ALTER TABLE purchase_invoices 
      ADD CONSTRAINT purchase_invoices_supplier_id_fkey 
      FOREIGN KEY (supplier_id) 
      REFERENCES suppliers(id) 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION;
  END IF;
END $$;

-- Create purchase_invoice_items table if not exists
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER,
  product_id INTEGER,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL
);

-- Add foreign key constraints for purchase_invoice_items
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_invoice_items_invoice_id_fkey'
  ) THEN
    ALTER TABLE purchase_invoice_items 
      ADD CONSTRAINT purchase_invoice_items_invoice_id_fkey 
      FOREIGN KEY (invoice_id) 
      REFERENCES purchase_invoices(id) 
      ON DELETE CASCADE 
      ON UPDATE NO ACTION;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_invoice_items_product_id_fkey'
  ) THEN
    ALTER TABLE purchase_invoice_items 
      ADD CONSTRAINT purchase_invoice_items_product_id_fkey 
      FOREIGN KEY (product_id) 
      REFERENCES products(id) 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION;
  END IF;
END $$;

-- Create warehouse table if not exists
CREATE TABLE IF NOT EXISTS warehouse (
  id SERIAL PRIMARY KEY,
  product_id INTEGER,
  quantity DECIMAL(10, 2) DEFAULT 0,
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for warehouse product_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'warehouse_product_id_fkey'
  ) THEN
    ALTER TABLE warehouse 
      ADD CONSTRAINT warehouse_product_id_fkey 
      FOREIGN KEY (product_id) 
      REFERENCES products(id) 
      ON DELETE CASCADE 
      ON UPDATE NO ACTION;
  END IF;
END $$;

-- Create password_reset_tokens table if not exists
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for password_reset_tokens user_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'password_reset_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE password_reset_tokens 
      ADD CONSTRAINT password_reset_tokens_user_id_fkey 
      FOREIGN KEY (user_id) 
      REFERENCES users(id) 
      ON DELETE CASCADE 
      ON UPDATE NO ACTION;
  END IF;
END $$;

-- Success message
SELECT 'All tables created successfully!' AS message;

