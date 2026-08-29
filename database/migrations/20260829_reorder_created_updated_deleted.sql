-- Reorder created_at, updated_at, deleted_at to the end of answers_data, answers_data_annexure, and answers_data_timeline

-- Disable triggers first to prevent recursive execution
ALTER TABLE answers_data DISABLE TRIGGER ALL;
ALTER TABLE answers_data_annexure DISABLE TRIGGER ALL;

-- 1. Re-order answers_data
ALTER TABLE answers_data RENAME COLUMN created_at TO old_created_at;
ALTER TABLE answers_data RENAME COLUMN updated_at TO old_updated_at;
ALTER TABLE answers_data RENAME COLUMN deleted_at TO old_deleted_at;

ALTER TABLE answers_data ADD COLUMN created_at TIMESTAMP;
ALTER TABLE answers_data ADD COLUMN updated_at TIMESTAMP;
ALTER TABLE answers_data ADD COLUMN deleted_at TIMESTAMP;

UPDATE answers_data SET 
  created_at = old_created_at,
  updated_at = old_updated_at,
  deleted_at = old_deleted_at;

ALTER TABLE answers_data DROP COLUMN old_created_at;
ALTER TABLE answers_data DROP COLUMN old_updated_at;
ALTER TABLE answers_data DROP COLUMN old_deleted_at;


-- 2. Re-order answers_data_annexure
ALTER TABLE answers_data_annexure RENAME COLUMN created_at TO old_created_at;
ALTER TABLE answers_data_annexure RENAME COLUMN updated_at TO old_updated_at;
ALTER TABLE answers_data_annexure RENAME COLUMN deleted_at TO old_deleted_at;

ALTER TABLE answers_data_annexure ADD COLUMN created_at TIMESTAMP;
ALTER TABLE answers_data_annexure ADD COLUMN updated_at TIMESTAMP;
ALTER TABLE answers_data_annexure ADD COLUMN deleted_at TIMESTAMP;

UPDATE answers_data_annexure SET 
  created_at = old_created_at,
  updated_at = old_updated_at,
  deleted_at = old_deleted_at;

ALTER TABLE answers_data_annexure DROP COLUMN old_created_at;
ALTER TABLE answers_data_annexure DROP COLUMN old_updated_at;
ALTER TABLE answers_data_annexure DROP COLUMN old_deleted_at;


-- 3. Re-order answers_data_timeline
ALTER TABLE answers_data_timeline RENAME COLUMN created_at TO old_created_at;
ALTER TABLE answers_data_timeline RENAME COLUMN updated_at TO old_updated_at;
ALTER TABLE answers_data_timeline RENAME COLUMN deleted_at TO old_deleted_at;

ALTER TABLE answers_data_timeline ADD COLUMN created_at TIMESTAMP;
ALTER TABLE answers_data_timeline ADD COLUMN updated_at TIMESTAMP;
ALTER TABLE answers_data_timeline ADD COLUMN deleted_at TIMESTAMP;

UPDATE answers_data_timeline SET 
  created_at = old_created_at,
  updated_at = old_updated_at,
  deleted_at = old_deleted_at;

ALTER TABLE answers_data_timeline DROP COLUMN old_created_at;
ALTER TABLE answers_data_timeline DROP COLUMN old_updated_at;
ALTER TABLE answers_data_timeline DROP COLUMN old_deleted_at;

-- Enable triggers
ALTER TABLE answers_data ENABLE TRIGGER ALL;
ALTER TABLE answers_data_annexure ENABLE TRIGGER ALL;
