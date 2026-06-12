-- Migration to add suggestions column to question_master
ALTER TABLE question_master ADD COLUMN IF NOT EXISTS suggestions text DEFAULT NULL;
