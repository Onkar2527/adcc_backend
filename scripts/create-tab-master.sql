-- Table for storing all possible tabs in the system
-- [MANUAL EXECUTION REQUIRED]
CREATE TABLE IF NOT EXISTS tab_master (
    id BIGINT PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for mapping specific tabs to proposals (optional overrides)
CREATE TABLE IF NOT EXISTS proposal_tab_mapping (
    id BIGINT PRIMARY KEY, -- Own primary key as requested
    proposal_id BIGINT NOT NULL,
    tab_id BIGINT NOT NULL,
    is_mandatory BOOLEAN DEFAULT TRUE,
    sort_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE,
    FOREIGN KEY (tab_id) REFERENCES tab_master(id) ON DELETE CASCADE,
    CONSTRAINT uq_proposal_tab UNIQUE (proposal_id, tab_id) -- Ensure uniqueness
);

-- Seeding initial tabs
INSERT INTO tab_master (id, key, label, icon, sort_order) VALUES
(1, 'personal',        'Personal',            'pi pi-user',           2),
(2, 'loan',            'Loan Info',           'pi pi-money-bill',     3),
(3, 'income',          'Income Info',         'pi pi-briefcase',      4),
(4, 'financial',       'Financial Info',      'pi pi-dollar',         5),
(5, 'credit',          'Credit Info',         'pi pi-percentage',     6),
(6, 'property',        'Property Info',       'pi pi-home',           7),
(7, 'guarantor',       'Guarantor Info',      'pi pi-users',          8),
(8, 'coborrower',      'Coborrower Info',     'pi pi-user-plus',      9),
(9, 'bank_scheme',     'Bank Scheme MIS',     'pi pi-book',           10),
(10, 'loan_specific',   'Loan Specific Info',  'pi pi-info-circle',    11)
ON CONFLICT (key) DO UPDATE SET 
    label = EXCLUDED.label,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order;

-- Attach updated_at triggers
DO $$
BEGIN
    -- Trigger for tab_master
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tab_master_modtime') THEN
        CREATE TRIGGER update_tab_master_modtime 
            BEFORE UPDATE ON tab_master 
            FOR EACH ROW 
            EXECUTE PROCEDURE update_modified_column();
    END IF;

    -- Trigger for proposal_tab_mapping
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_proposal_tab_mapping_modtime') THEN
        CREATE TRIGGER update_proposal_tab_mapping_modtime 
            BEFORE UPDATE ON proposal_tab_mapping 
            FOR EACH ROW 
            EXECUTE PROCEDURE update_modified_column();
    END IF;
END $$;
