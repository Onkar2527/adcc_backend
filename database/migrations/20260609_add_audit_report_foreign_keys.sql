-- Add relational constraints for frequently updated audit/report tables.
--
-- Constraints are created NOT VALID so old migrated rows do not block the
-- deployment. PostgreSQL will still enforce these constraints for new rows and
-- changed key values. After legacy orphan rows are cleaned, run:
--   ALTER TABLE <table_name> VALIDATE CONSTRAINT <constraint_name>;

CREATE INDEX IF NOT EXISTS idx_audit_unit_master_section_type
    ON audit_unit_master (section_type_id);

CREATE INDEX IF NOT EXISTS idx_target_details_year_unit
    ON target_details (year_id, audit_unit_id);

CREATE INDEX IF NOT EXISTS idx_audit_assesment_master_year_unit
    ON audit_assesment_master (year_id, audit_unit_id);

CREATE INDEX IF NOT EXISTS idx_audit_assesment_timeline_assesment
    ON audit_assesment_timeline (assesment_id);

CREATE INDEX IF NOT EXISTS idx_answers_data_assesment
    ON answers_data (assesment_id);

CREATE INDEX IF NOT EXISTS idx_answers_data_annexure_answer_assesment
    ON answers_data_annexure (answer_id, assesment_id);

CREATE INDEX IF NOT EXISTS idx_evidence_master_answer_assesment
    ON evidence_master (answer_id, assesment_id);

CREATE INDEX IF NOT EXISTS idx_audit_remarks_assesment
    ON audit_remarks (assesment_id);

CREATE INDEX IF NOT EXISTS idx_audit_remark_status_noti
    ON audit_remark_status (noti_id);

CREATE INDEX IF NOT EXISTS idx_executive_summary_basic_details_year_assesment
    ON executive_summary_basic_details (year_id, assesment_id);

CREATE INDEX IF NOT EXISTS idx_executive_summary_branch_position_year_assesment
    ON executive_summary_branch_position (year_id, assesment_id);

CREATE INDEX IF NOT EXISTS idx_executive_summary_fresh_accounts_year_assesment
    ON executive_summary_fresh_accounts (year_id, assesment_id);

CREATE INDEX IF NOT EXISTS idx_executive_summary_branch_position_timeline_refs
    ON executive_summary_branch_position_timeline (esbp_id, assesment_id);

CREATE INDEX IF NOT EXISTS idx_executive_summary_fresh_accounts_timeline_refs
    ON executive_summary_fresh_accounts_timeline (esfa_id, assesment_id);

CREATE INDEX IF NOT EXISTS idx_dump_deposits_branch_scheme_assesment
    ON dump_deposits (branch_id, scheme_id, assesment_period_id);

CREATE INDEX IF NOT EXISTS idx_dump_advances_branch_scheme_assesment
    ON dump_advances (branch_id, scheme_id, assesment_period_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_unit_master_section_type'
    ) THEN
        ALTER TABLE audit_unit_master
            ADD CONSTRAINT fk_audit_unit_master_section_type
            FOREIGN KEY (section_type_id)
            REFERENCES audit_section_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_target_details_year'
    ) THEN
        ALTER TABLE target_details
            ADD CONSTRAINT fk_target_details_year
            FOREIGN KEY (year_id)
            REFERENCES year_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_target_details_audit_unit'
    ) THEN
        ALTER TABLE target_details
            ADD CONSTRAINT fk_target_details_audit_unit
            FOREIGN KEY (audit_unit_id)
            REFERENCES audit_unit_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_assesment_master_year'
    ) THEN
        ALTER TABLE audit_assesment_master
            ADD CONSTRAINT fk_audit_assesment_master_year
            FOREIGN KEY (year_id)
            REFERENCES year_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_assesment_master_audit_unit'
    ) THEN
        ALTER TABLE audit_assesment_master
            ADD CONSTRAINT fk_audit_assesment_master_audit_unit
            FOREIGN KEY (audit_unit_id)
            REFERENCES audit_unit_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_assesment_timeline_assesment'
    ) THEN
        ALTER TABLE audit_assesment_timeline
            ADD CONSTRAINT fk_audit_assesment_timeline_assesment
            FOREIGN KEY (assesment_id)
            REFERENCES audit_assesment_master(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_answers_data_assesment'
    ) THEN
        ALTER TABLE answers_data
            ADD CONSTRAINT fk_answers_data_assesment
            FOREIGN KEY (assesment_id)
            REFERENCES audit_assesment_master(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_answers_data_annexure_answer'
    ) THEN
        ALTER TABLE answers_data_annexure
            ADD CONSTRAINT fk_answers_data_annexure_answer
            FOREIGN KEY (answer_id)
            REFERENCES answers_data(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_answers_data_annexure_assesment'
    ) THEN
        ALTER TABLE answers_data_annexure
            ADD CONSTRAINT fk_answers_data_annexure_assesment
            FOREIGN KEY (assesment_id)
            REFERENCES audit_assesment_master(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_evidence_master_answer'
    ) THEN
        ALTER TABLE evidence_master
            ADD CONSTRAINT fk_evidence_master_answer
            FOREIGN KEY (answer_id)
            REFERENCES answers_data(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_evidence_master_assesment'
    ) THEN
        ALTER TABLE evidence_master
            ADD CONSTRAINT fk_evidence_master_assesment
            FOREIGN KEY (assesment_id)
            REFERENCES audit_assesment_master(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_remarks_assesment'
    ) THEN
        ALTER TABLE audit_remarks
            ADD CONSTRAINT fk_audit_remarks_assesment
            FOREIGN KEY (assesment_id)
            REFERENCES audit_assesment_master(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_remark_status_noti'
    ) THEN
        ALTER TABLE audit_remark_status
            ADD CONSTRAINT fk_audit_remark_status_noti
            FOREIGN KEY (noti_id)
            REFERENCES audit_remarks(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_executive_summary_basic_details_year'
    ) THEN
        ALTER TABLE executive_summary_basic_details
            ADD CONSTRAINT fk_executive_summary_basic_details_year
            FOREIGN KEY (year_id)
            REFERENCES year_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_executive_summary_basic_details_assesment'
    ) THEN
        ALTER TABLE executive_summary_basic_details
            ADD CONSTRAINT fk_executive_summary_basic_details_assesment
            FOREIGN KEY (assesment_id)
            REFERENCES audit_assesment_master(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_executive_summary_branch_position_year'
    ) THEN
        ALTER TABLE executive_summary_branch_position
            ADD CONSTRAINT fk_executive_summary_branch_position_year
            FOREIGN KEY (year_id)
            REFERENCES year_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_executive_summary_branch_position_assesment'
    ) THEN
        ALTER TABLE executive_summary_branch_position
            ADD CONSTRAINT fk_executive_summary_branch_position_assesment
            FOREIGN KEY (assesment_id)
            REFERENCES audit_assesment_master(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_executive_summary_fresh_accounts_year'
    ) THEN
        ALTER TABLE executive_summary_fresh_accounts
            ADD CONSTRAINT fk_executive_summary_fresh_accounts_year
            FOREIGN KEY (year_id)
            REFERENCES year_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_executive_summary_fresh_accounts_assesment'
    ) THEN
        ALTER TABLE executive_summary_fresh_accounts
            ADD CONSTRAINT fk_executive_summary_fresh_accounts_assesment
            FOREIGN KEY (assesment_id)
            REFERENCES audit_assesment_master(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_executive_summary_branch_position_timeline_esbp'
    ) THEN
        ALTER TABLE executive_summary_branch_position_timeline
            ADD CONSTRAINT fk_executive_summary_branch_position_timeline_esbp
            FOREIGN KEY (esbp_id)
            REFERENCES executive_summary_branch_position(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_executive_summary_branch_position_timeline_assesment'
    ) THEN
        ALTER TABLE executive_summary_branch_position_timeline
            ADD CONSTRAINT fk_executive_summary_branch_position_timeline_assesment
            FOREIGN KEY (assesment_id)
            REFERENCES audit_assesment_master(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_executive_summary_fresh_accounts_timeline_esfa'
    ) THEN
        ALTER TABLE executive_summary_fresh_accounts_timeline
            ADD CONSTRAINT fk_executive_summary_fresh_accounts_timeline_esfa
            FOREIGN KEY (esfa_id)
            REFERENCES executive_summary_fresh_accounts(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_executive_summary_fresh_accounts_timeline_assesment'
    ) THEN
        ALTER TABLE executive_summary_fresh_accounts_timeline
            ADD CONSTRAINT fk_executive_summary_fresh_accounts_timeline_assesment
            FOREIGN KEY (assesment_id)
            REFERENCES audit_assesment_master(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_dump_deposits_branch'
    ) THEN
        ALTER TABLE dump_deposits
            ADD CONSTRAINT fk_dump_deposits_branch
            FOREIGN KEY (branch_id)
            REFERENCES audit_unit_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_dump_deposits_scheme'
    ) THEN
        ALTER TABLE dump_deposits
            ADD CONSTRAINT fk_dump_deposits_scheme
            FOREIGN KEY (scheme_id)
            REFERENCES scheme_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_dump_deposits_assesment_period'
    ) THEN
        ALTER TABLE dump_deposits
            ADD CONSTRAINT fk_dump_deposits_assesment_period
            FOREIGN KEY (assesment_period_id)
            REFERENCES audit_assesment_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_dump_advances_branch'
    ) THEN
        ALTER TABLE dump_advances
            ADD CONSTRAINT fk_dump_advances_branch
            FOREIGN KEY (branch_id)
            REFERENCES audit_unit_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_dump_advances_scheme'
    ) THEN
        ALTER TABLE dump_advances
            ADD CONSTRAINT fk_dump_advances_scheme
            FOREIGN KEY (scheme_id)
            REFERENCES scheme_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_dump_advances_assesment_period'
    ) THEN
        ALTER TABLE dump_advances
            ADD CONSTRAINT fk_dump_advances_assesment_period
            FOREIGN KEY (assesment_period_id)
            REFERENCES audit_assesment_master(id)
            ON UPDATE CASCADE
            NOT VALID;
    END IF;
END $$;
