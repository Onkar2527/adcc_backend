-- Table for detailed Personal Information linked to a Proposal
CREATE TABLE IF NOT EXISTS proposal_personal_info (
    proposal_id BIGINT PRIMARY KEY,
    religion VARCHAR(50),
    cast_name VARCHAR(100),
    education VARCHAR(100),
    marital_status VARCHAR(50),
    
    -- Bank Membership
    is_bank_member BOOLEAN DEFAULT FALSE,
    member_type VARCHAR(50),
    membership_date DATE,
    member_no VARCHAR(50),
    bank_shares_amount NUMERIC(15, 2),
    
    -- Family & Stats
    family_members_count INTEGER,
    earners_out_of_them INTEGER,
    net_worth_amount NUMERIC(15, 2),
    net_worth_date DATE,
    
    -- Career & Contact
    profession VARCHAR(150),
    relation_with_director VARCHAR(150),
    mobile_no_2 VARCHAR(20),
    full_address TEXT,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- Attach the existing trigger function to auto-update 'updated_at'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_proposal_personal_info_modtime') THEN
        CREATE TRIGGER update_proposal_personal_info_modtime 
            BEFORE UPDATE ON proposal_personal_info 
            FOR EACH ROW 
            EXECUTE PROCEDURE update_modified_column();
    END IF;
END $$;
