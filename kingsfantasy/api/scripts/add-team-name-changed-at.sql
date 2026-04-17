-- Migration: add team_name_changed_at to user_teams
-- Run this once in the Supabase SQL Editor

ALTER TABLE user_teams
  ADD COLUMN IF NOT EXISTS team_name_changed_at TIMESTAMPTZ DEFAULT NULL;
