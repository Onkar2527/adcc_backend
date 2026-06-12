-- Migration to add risk rating columns to audit_assesment_master table
ALTER TABLE audit_assesment_master 
ADD COLUMN IF NOT EXISTS risk_rating VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS risk_rating_id INTEGER DEFAULT NULL;
