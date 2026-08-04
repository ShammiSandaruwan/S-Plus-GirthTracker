-- Migration: Add yop (Year of Planting) column to fields table

ALTER TABLE fields ADD COLUMN IF NOT EXISTS yop INT;
