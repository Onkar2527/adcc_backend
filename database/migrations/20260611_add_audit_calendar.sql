-- Migration to add Audit Calendar tables
CREATE TABLE IF NOT EXISTS audit_calendar (
    id SERIAL PRIMARY KEY,
    audit_unit_id BIGINT NOT NULL REFERENCES audit_unit_master(id) ON DELETE CASCADE,
    audit_scheme_id BIGINT NOT NULL REFERENCES scheme_master(id) ON DELETE CASCADE,
    auditor_id BIGINT NOT NULL REFERENCES employee_master(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Scheduled', -- 'Scheduled', 'In Progress', 'Completed', 'Cancelled'
    remarks TEXT,
    is_active INTEGER DEFAULT 1, -- 1 = active, 0 = inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_audit_calendar_modtime ON audit_calendar;
CREATE TRIGGER update_audit_calendar_modtime
    BEFORE UPDATE ON audit_calendar
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
