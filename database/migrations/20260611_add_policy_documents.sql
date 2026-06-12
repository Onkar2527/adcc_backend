-- Define trigger function if not exists
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Migration to add Policy Document management tables
CREATE TABLE IF NOT EXISTS policy_documents (
    id SERIAL PRIMARY KEY,
    document_code VARCHAR(100) UNIQUE NOT NULL,
    document_title VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    description TEXT,
    version_no VARCHAR(50) NOT NULL,
    issue_date DATE,
    effective_date DATE,
    review_date DATE,
    expiry_date DATE,
    uploaded_file_path TEXT,
    uploaded_by BIGINT REFERENCES employee_master(id) ON DELETE SET NULL,
    uploaded_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(100),
    approved_date DATE,
    certified_authority VARCHAR(255),
    certified_date DATE,
    certification_remarks TEXT,
    user_access VARCHAR(255), -- Comma-separated user_type_ids e.g., '1,2'
    is_active INTEGER DEFAULT 1, -- 1 = active, 0 = inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_policy_documents_modtime ON policy_documents;
CREATE TRIGGER update_policy_documents_modtime
    BEFORE UPDATE ON policy_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
