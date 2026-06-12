-- Create region_master table
CREATE TABLE IF NOT EXISTS region_master (
    id SERIAL PRIMARY KEY,
    region_name VARCHAR(255) UNIQUE NOT NULL,
    audit_unit_ids TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    admin_id INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Add region_name column to employee_master
ALTER TABLE employee_master ADD COLUMN IF NOT EXISTS region_name VARCHAR(255) DEFAULT NULL;
