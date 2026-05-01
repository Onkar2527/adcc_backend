-- Table for Financial Information module
-- [MANUAL EXECUTION REQUIRED]

CREATE TABLE IF NOT EXISTS proposal_financial_info (
    proposal_id BIGINT PRIMARY KEY,
    
    -- Section 1: Bank Details
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    
    -- Section 2: Income Tax Section
    is_itr_filed BOOLEAN DEFAULT FALSE,
    itr_financial_year VARCHAR(20), -- e.g. "2023-24"
    itr_income_amount NUMERIC(15, 2) DEFAULT 0,
    itr_tax_amount NUMERIC(15, 2) DEFAULT 0,
    
    -- Section 3: Property Tax Section
    pays_property_tax BOOLEAN DEFAULT FALSE,
    wealth_amount NUMERIC(15, 2) DEFAULT 0,
    property_tax_amount NUMERIC(15, 2) DEFAULT 0,
    last_assessment_year VARCHAR(10),
    
    -- Section 4: Investments Section
    has_investments BOOLEAN DEFAULT FALSE,
    investment_details TEXT,
    
    -- Section 5: CIBIL Section
    has_cibil BOOLEAN DEFAULT FALSE,
    cibil_type VARCHAR(100),
    cibil_date DATE,
    cibil_cmr VARCHAR(100),
    cibil_details TEXT,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_financial_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- Attach updated_at trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_proposal_financial_info_modtime') THEN
        CREATE TRIGGER update_proposal_financial_info_modtime 
            BEFORE UPDATE ON proposal_financial_info 
            FOR EACH ROW 
            EXECUTE PROCEDURE update_modified_column();
    END IF;
END $$;
