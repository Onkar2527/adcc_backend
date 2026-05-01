-- Table for detailed Loan Information linked to a Proposals
CREATE TABLE IF NOT EXISTS proposal_loan_info (
    proposal_id BIGINT PRIMARY KEY,
    loan_type VARCHAR(50),
    reason_of_loan TEXT,
    requested_amount NUMERIC(15, 2),
    requested_amount_words TEXT,
    installment_type VARCHAR(50), -- Type of installment
    duration_months INTEGER,      -- Duration
    interest_rate NUMERIC(5, 2),  -- Interest rate (%)
    monthly_installment NUMERIC(15, 2),
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_proposal_loan FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- Attach the existing trigger function to auto-update 'updated_at'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_proposal_loan_info_modtime') THEN
        CREATE TRIGGER update_proposal_loan_info_modtime 
            BEFORE UPDATE ON proposal_loan_info 
            FOR EACH ROW 
            EXECUTE PROCEDURE update_modified_column();
    END IF;
END $$;
