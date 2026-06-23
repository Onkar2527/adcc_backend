-- Migration to add Incident reporting tables
CREATE TABLE IF NOT EXISTS incident_management (
    id SERIAL PRIMARY KEY,
    audit_unit_id BIGINT NOT NULL REFERENCES audit_unit_master(id) ON DELETE CASCADE,
    incident_type VARCHAR(100) NOT NULL, -- 'light issue', 'network issue', 'fighting with staff', 'other'
    description TEXT NOT NULL,
    reported_by BIGINT REFERENCES employee_master(id) ON DELETE SET NULL,
    reported_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_incident_management_modtime ON incident_management;
CREATE TRIGGER update_incident_management_modtime
    BEFORE UPDATE ON incident_management
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
