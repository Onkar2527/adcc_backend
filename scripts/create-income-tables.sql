-- ── INCOME INFORMATION TABLES ──

-- [MANUAL EXECUTION REQUIRED]

-- 1. Job Income
CREATE TABLE IF NOT EXISTS proposal_income_job (
    id BIGINT PRIMARY KEY,
    proposal_id BIGINT NOT NULL,
    
    organization_name VARCHAR(255),
    organization_contact VARCHAR(20),
    branch VARCHAR(100),
    department VARCHAR(100),
    designation VARCHAR(100),
    token_number VARCHAR(50),
    branch_address TEXT,
    branch_contact VARCHAR(20),
    job_details TEXT,
    job_type VARCHAR(50), -- Private, Government, Semi-government
    nature_of_job VARCHAR(50), -- Permanent, Temporary
    
    service_date DATE,
    retirement_date DATE,
    last_salary_month VARCHAR(50),
    permanent_date DATE,
    has_salary_proof BOOLEAN DEFAULT FALSE,
    years_employed INT,
    
    salary_grade VARCHAR(50),
    basic_salary NUMERIC(15, 2) DEFAULT 0,
    grade_pay NUMERIC(15, 2) DEFAULT 0,
    da_amount NUMERIC(15, 2) DEFAULT 0,
    hra_amount NUMERIC(15, 2) DEFAULT 0,
    other_allowance NUMERIC(15, 2) DEFAULT 0,
    other_income_amount NUMERIC(15, 2) DEFAULT 0,
    other_income_info TEXT,
    total_gross_salary NUMERIC(15, 2) DEFAULT 0,
    
    provident_fund NUMERIC(15, 2) DEFAULT 0,
    insurance_amount NUMERIC(15, 2) DEFAULT 0,
    professional_tax NUMERIC(15, 2) DEFAULT 0,
    loan_installment NUMERIC(15, 2) DEFAULT 0,
    savings_reduction NUMERIC(15, 2) DEFAULT 0,
    society_deduction NUMERIC(15, 2) DEFAULT 0,
    other_deduction_amount NUMERIC(15, 2) DEFAULT 0,
    other_deduction_info TEXT,
    total_deduction NUMERIC(15, 2) DEFAULT 0,
    net_salary NUMERIC(15, 2) DEFAULT 0,
    
    transfer_possibility BOOLEAN DEFAULT FALSE,
    transfer_replacement_place VARCHAR(255),
    has_pension_scheme BOOLEAN DEFAULT FALSE,
    total_provident_fund NUMERIC(15, 2) DEFAULT 0,
    will_deduct_installment BOOLEAN DEFAULT FALSE,
    is_borrowed BOOLEAN DEFAULT FALSE,
    borrowed_amount_to_pay NUMERIC(15, 2) DEFAULT 0,
    has_credit_society BOOLEAN DEFAULT FALSE,
    is_credit_society_member BOOLEAN DEFAULT FALSE,
    credit_society_investment_details TEXT,
    credit_society_loan_details TEXT,
    salary_payout_mode VARCHAR(50), -- Bank, Cash
    
    org_address TEXT,
    org_landmark VARCHAR(255),
    org_state_id INT,
    org_district_id INT,
    org_taluka_id INT,
    org_village VARCHAR(100),
    org_pincode VARCHAR(10),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_job_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- 2. Business / Profession
CREATE TABLE IF NOT EXISTS proposal_income_business (
    id BIGINT PRIMARY KEY,
    proposal_id BIGINT NOT NULL,
    category VARCHAR(50), -- Business, Profession
    
    firm_name VARCHAR(255),
    nature_of_business TEXT,
    license_owner_name VARCHAR(255),
    years_in_business INT,
    turnover_amount NUMERIC(15, 2) DEFAULT 0,
    net_profit_loss NUMERIC(15, 2) DEFAULT 0,
    contact_no VARCHAR(20),
    email_id VARCHAR(100),
    space_status VARCHAR(50), -- Own, On lease
    business_constitution VARCHAR(100), -- Owner, In partnership, Company
    pan_number VARCHAR(20),
    has_required_laws BOOLEAN DEFAULT FALSE,
    ownership_type VARCHAR(100),
    
    is_msme_registered BOOLEAN DEFAULT FALSE,
    msme_registration_number VARCHAR(100),
    msme_registration_date DATE,
    has_dist_cert BOOLEAN DEFAULT FALSE,
    has_gst_cert BOOLEAN DEFAULT FALSE,
    gst_number VARCHAR(50),
    is_shop_act_licensed BOOLEAN DEFAULT FALSE,
    shop_act_number VARCHAR(100),
    is_shop_act_renewed BOOLEAN DEFAULT FALSE,
    business_remark TEXT,
    
    address TEXT,
    landmark VARCHAR(255),
    state_id INT,
    district_id INT,
    taluka_id INT,
    village VARCHAR(100),
    pincode VARCHAR(10),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_business_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- Business Branches/Units
CREATE TABLE IF NOT EXISTS proposal_income_business_branches (
    id BIGINT PRIMARY KEY,
    business_id BIGINT NOT NULL,
    branch_name VARCHAR(255),
    address TEXT,
    landmark VARCHAR(255),
    state_id INT,
    district_id INT,
    taluka_id INT,
    village VARCHAR(100),
    pincode VARCHAR(10),
    CONSTRAINT fk_branch_business FOREIGN KEY (business_id) REFERENCES proposal_income_business(id) ON DELETE CASCADE
);

-- Business Other Licenses
CREATE TABLE IF NOT EXISTS proposal_income_business_licenses (
    id BIGINT PRIMARY KEY,
    business_id BIGINT NOT NULL,
    license_name VARCHAR(255),
    license_number VARCHAR(100),
    CONSTRAINT fk_license_business FOREIGN KEY (business_id) REFERENCES proposal_income_business(id) ON DELETE CASCADE
);

-- 3. Agriculture
CREATE TABLE IF NOT EXISTS proposal_income_agriculture (
    id BIGINT PRIMARY KEY,
    proposal_id BIGINT NOT NULL,
    
    land_owner_name VARCHAR(255),
    current_crops TEXT,
    annual_income NUMERIC(15, 2) DEFAULT 0,
    
    horticulture_hector NUMERIC(10, 4) DEFAULT 0,
    horticulture_aar NUMERIC(10, 4) DEFAULT 0,
    arable_hector NUMERIC(10, 4) DEFAULT 0,
    arable_aar NUMERIC(10, 4) DEFAULT 0,
    total_agri_hector NUMERIC(10, 4) DEFAULT 0,
    total_agri_aar NUMERIC(10, 4) DEFAULT 0,
    sugarcane_hector NUMERIC(10, 4) DEFAULT 0,
    sugarcane_aar NUMERIC(10, 4) DEFAULT 0,
    other_crop_hector NUMERIC(10, 4) DEFAULT 0,
    other_crop_aar NUMERIC(10, 4) DEFAULT 0,
    
    income_sugarcane NUMERIC(15, 2) DEFAULT 0,
    income_other NUMERIC(15, 2) DEFAULT 0,
    total_agri_income NUMERIC(15, 2) DEFAULT 0,
    
    address TEXT,
    group_no VARCHAR(100),
    state_id INT,
    district_id INT,
    taluka_id INT,
    village VARCHAR(100),
    pincode VARCHAR(10),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_agri_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- Agriculture: Sugarcane Factory Bills (Tonnage Info)
CREATE TABLE IF NOT EXISTS proposal_income_agri_sugarcane_bills (
    id BIGINT PRIMARY KEY,
    agri_id BIGINT NOT NULL,
    factory_name VARCHAR(255),
    dry_season VARCHAR(50),
    sugarcane_area VARCHAR(50),
    tonnage NUMERIC(10, 2) DEFAULT 0,
    bill_amount NUMERIC(15, 2) DEFAULT 0,
    CONSTRAINT fk_bill_agri FOREIGN KEY (agri_id) REFERENCES proposal_income_agriculture(id) ON DELETE CASCADE
);

-- Agriculture: Recorded Area Next Season
CREATE TABLE IF NOT EXISTS proposal_income_agri_next_season (
    id BIGINT PRIMARY KEY,
    agri_id BIGINT NOT NULL,
    factory_name VARCHAR(255),
    dry_season VARCHAR(50),
    sugarcane_area VARCHAR(50),
    CONSTRAINT fk_next_agri FOREIGN KEY (agri_id) REFERENCES proposal_income_agriculture(id) ON DELETE CASCADE
);

-- 4. House / Shop Rent
CREATE TABLE IF NOT EXISTS proposal_income_rent (
    id BIGINT PRIMARY KEY,
    proposal_id BIGINT NOT NULL,
    
    rented_to_name VARCHAR(255),
    property_no VARCHAR(100),
    has_agreement BOOLEAN DEFAULT FALSE,
    agreement_term VARCHAR(100),
    lease_expiry_date DATE,
    monthly_rent_amount NUMERIC(15, 2) DEFAULT 0,
    gst_amount NUMERIC(15, 2) DEFAULT 0,
    tds_amount NUMERIC(15, 2) DEFAULT 0,
    net_rent_received NUMERIC(15, 2) DEFAULT 0,
    is_rent_discounting_scheme BOOLEAN DEFAULT FALSE,
    remark TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rent_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- 5. Milk Production
CREATE TABLE IF NOT EXISTS proposal_income_milk (
    id BIGINT PRIMARY KEY,
    proposal_id BIGINT NOT NULL,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_milk_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- Milk Production Rows (Average table)
CREATE TABLE IF NOT EXISTS proposal_income_milk_rows (
    id BIGINT PRIMARY KEY,
    milk_id BIGINT NOT NULL,
    duration_label VARCHAR(100),
    morning_litre NUMERIC(10, 2) DEFAULT 0,
    morning_rate NUMERIC(10, 2) DEFAULT 0,
    morning_amount NUMERIC(15, 2) DEFAULT 0,
    evening_litre NUMERIC(10, 2) DEFAULT 0,
    evening_rate NUMERIC(10, 2) DEFAULT 0,
    evening_amount NUMERIC(15, 2) DEFAULT 0,
    CONSTRAINT fk_row_milk FOREIGN KEY (milk_id) REFERENCES proposal_income_milk(id) ON DELETE CASCADE
);

-- 6. Other Income
CREATE TABLE IF NOT EXISTS proposal_income_other (
    id BIGINT PRIMARY KEY,
    proposal_id BIGINT NOT NULL,
    
    source_name VARCHAR(255),
    source_type VARCHAR(100),
    years_active INT,
    annual_income NUMERIC(15, 2) DEFAULT 0,
    contact_no VARCHAR(20),
    landmark VARCHAR(255),
    state_id INT,
    district_id INT,
    taluka_id INT,
    village VARCHAR(100),
    pincode VARCHAR(10),
    details TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_other_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- TRIGGERS for updated_at
-- (Assuming update_modified_column exists)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name IN (
            'proposal_income_job', 'proposal_income_business', 
            'proposal_income_agriculture', 'proposal_income_rent', 
            'proposal_income_milk', 'proposal_income_other'
        )
    LOOP
        EXECUTE format('CREATE TRIGGER update_%I_modtime BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_modified_column()', t, t);
    END LOOP;
END $$;
