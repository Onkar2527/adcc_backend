-- Migration: Add question_set_ids to scheme_master
-- Dialect: PostgreSQL

ALTER TABLE scheme_master 
ADD COLUMN IF NOT EXISTS question_set_ids TEXT DEFAULT '';
