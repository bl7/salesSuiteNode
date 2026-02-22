-- Migration to add discount fields to orders table
ALTER TABLE orders ADD COLUMN discount_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount_type VARCHAR(20) DEFAULT 'fixed'; -- 'fixed' or 'percentage'
