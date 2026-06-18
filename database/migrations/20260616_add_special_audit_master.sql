CREATE TABLE IF NOT EXISTS special_audit_master (
    id BIGSERIAL PRIMARY KEY,
    assessment_id BIGINT NOT NULL REFERENCES audit_assesment_master(id),
    title VARCHAR(255) NOT NULL,
    control_master_id BIGINT NULL,
    created_by BIGINT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_special_audit_master_assessment_active
    ON special_audit_master (assessment_id)
    WHERE deleted_at IS NULL;

