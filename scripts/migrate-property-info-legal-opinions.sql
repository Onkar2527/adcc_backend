-- Migration: Add new legal opinion fields to proposal_property_info
-- [MANUAL EXECUTION REQUIRED]

-- First legal opinion: search receipt fields + details text
ALTER TABLE proposal_property_info
  ADD COLUMN IF NOT EXISTS search_receipt_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS search_receipt_date DATE,
  ADD COLUMN IF NOT EXISTS legal_opinion_details TEXT;

-- Second legal opinion (full set of fields, Immovable only)
ALTER TABLE proposal_property_info
  ADD COLUMN IF NOT EXISTS has_second_legal_opinion BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS second_panel_advocate VARCHAR(255),
  ADD COLUMN IF NOT EXISTS second_legal_opinion_date DATE,
  ADD COLUMN IF NOT EXISTS second_search_receipt_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS second_search_receipt_date DATE,
  ADD COLUMN IF NOT EXISTS second_is_suitable_for_mortgage BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS second_legal_opinion_details TEXT;

-- Drop the old nested legal opinions table (now replaced by flat fields)
-- NOTE: Run only after confirming no data needs migration
-- DROP TABLE IF EXISTS proposal_property_legal_opinions;
