-- Migration to add Audit Frequency Master table
CREATE TABLE IF NOT EXISTS audit_frequency_master (
    id SERIAL PRIMARY KEY,
    risk_type_id INTEGER NOT NULL UNIQUE, -- 1 = High, 2 = Medium, 3 = Low
    frequency INTEGER NOT NULL, -- Frequency in months
    is_active INTEGER DEFAULT 1,
    admin_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Seed default values if table is empty
INSERT INTO audit_frequency_master (risk_type_id, frequency)
VALUES 
    (1, 6),   -- High Risk = 6 Months
    (2, 12),  -- Medium Risk = 12 Months
    (3, 18)   -- Low Risk = 18 Months
ON CONFLICT (risk_type_id) DO NOTHING;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_audit_frequency_master_modtime ON audit_frequency_master;
CREATE TRIGGER update_audit_frequency_master_modtime
    BEFORE UPDATE ON audit_frequency_master
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
