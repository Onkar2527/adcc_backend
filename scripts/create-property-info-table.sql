-- Tables for Property Information module
-- [MANUAL EXECUTION REQUIRED]
-- Updated: includes legal opinion receipt fields and second legal opinion block

CREATE TABLE IF NOT EXISTS proposal_property_info (
    id BIGINT PRIMARY KEY,
    proposal_id BIGINT NOT NULL,
    
    -- Section 1: Basic Property Information
    owner_name VARCHAR(255) NOT NULL,
    relationship_with_borrower VARCHAR(150),
    nature_of_property VARCHAR(20),       -- 'Movable', 'Immovable'
    property_type VARCHAR(100),
    total_area NUMERIC(15, 2),
    area_unit_total VARCHAR(50),
    part NUMERIC(15, 2) DEFAULT 0,
    area_unit_part VARCHAR(50),
    group_survey_number VARCHAR(100),
    sara VARCHAR(100),
    monthly_rent NUMERIC(15, 2),
    construction_area NUMERIC(15, 2),

    -- Directions (Immovable only)
    direction_east VARCHAR(255),
    direction_west VARCHAR(255),
    direction_south VARCHAR(255),
    direction_north VARCHAR(255),
    details TEXT,

    -- Section 2: Mortgage & Security
    is_prime_security BOOLEAN DEFAULT TRUE,    -- TRUE: Prime, FALSE: Collateral
    is_tax_paid BOOLEAN DEFAULT FALSE,
    is_mortgaged_other BOOLEAN DEFAULT FALSE,
    other_bank_name VARCHAR(255),
    other_loan_total_amount NUMERIC(15, 2) DEFAULT 0,
    other_loan_due_amount NUMERIC(15, 2) DEFAULT 0,

    -- First Legal Opinion (Immovable only)
    has_legal_opinion BOOLEAN DEFAULT FALSE,
    panel_advocate VARCHAR(255),
    legal_opinion_date DATE,
    search_receipt_number VARCHAR(100),
    search_receipt_date DATE,
    is_suitable_for_mortgage BOOLEAN DEFAULT FALSE,
    legal_opinion_details TEXT,

    -- Second Legal Opinion (Immovable only)
    has_second_legal_opinion BOOLEAN DEFAULT FALSE,
    second_panel_advocate VARCHAR(255),
    second_legal_opinion_date DATE,
    second_search_receipt_number VARCHAR(100),
    second_search_receipt_date DATE,
    second_is_suitable_for_mortgage BOOLEAN DEFAULT FALSE,
    second_legal_opinion_details TEXT,

    -- Section 3: Visit Report
    visit_report_done BOOLEAN DEFAULT FALSE,
    visitor_name VARCHAR(255),
    visit_date DATE,
    visit_details TEXT,

    -- Section 4: Primary Valuation
    valuation_done BOOLEAN DEFAULT FALSE,
    valuator_name VARCHAR(255),
    market_value NUMERIC(15, 2) DEFAULT 0,
    realizable_value NUMERIC(15, 2) DEFAULT 0,
    distress_value NUMERIC(15, 2) DEFAULT 0,
    government_value NUMERIC(15, 2) DEFAULT 0,
    valuation_date DATE,
    paiki_plot_value NUMERIC(15, 2),
    building_value NUMERIC(15, 2),
    building_age INTEGER,
    future_life INTEGER,

    -- Section 5: Second Valuation
    second_valuation_done BOOLEAN DEFAULT FALSE,
    second_valuator_name VARCHAR(255),
    second_market_value NUMERIC(15, 2) DEFAULT 0,
    second_realizable_value NUMERIC(15, 2) DEFAULT 0,
    second_distress_value NUMERIC(15, 2) DEFAULT 0,
    second_government_value NUMERIC(15, 2) DEFAULT 0,
    second_valuation_date DATE,
    second_paiki_plot_value NUMERIC(15, 2),
    second_building_value NUMERIC(15, 2),
    second_building_age INTEGER,
    second_future_life INTEGER,

    -- Purchase Details
    purchase_date DATE,
    purchase_order_number VARCHAR(100),
    purchase_amount NUMERIC(15, 2),
    seller_name VARCHAR(255),

    -- Section 6: House / Location Details (Immovable only)
    income_description VARCHAR(255),
    landmark VARCHAR(255),
    state_id VARCHAR(50),
    district_id VARCHAR(50),
    taluka_id VARCHAR(50),
    village VARCHAR(150),
    pincode VARCHAR(10),

    remark TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_property_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- Attach updated_at trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_proposal_property_info_modtime') THEN
        CREATE TRIGGER update_proposal_property_info_modtime 
            BEFORE UPDATE ON proposal_property_info 
            FOR EACH ROW 
            EXECUTE PROCEDURE update_modified_column();
    END IF;
END $$;
