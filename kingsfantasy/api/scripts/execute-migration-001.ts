/**
 * Execute Migration 001: Create Mapping Tables
 * 
 * This script creates the player_mappings and team_mappings tables
 * in Supabase using direct table checks and the Supabase client.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error(`   Looking for .env at: ${envPath}`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableExists(tableName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(0);
  
  return !error || !error.message.includes('does not exist');
}

async function executeMigration() {
  console.log('🚀 Executing Migration 001: Create Mapping Tables\n');
  console.log('=' + '='.repeat(59));

  // Check if tables already exist
  console.log('⏳ Checking existing tables...\n');
  
  const playerMappingsExists = await checkTableExists('player_mappings');
  const teamMappingsExists = await checkTableExists('team_mappings');

  if (playerMappingsExists && teamMappingsExists) {
    console.log('✅ Both tables already exist!');
    console.log('   - player_mappings: EXISTS');
    console.log('   - team_mappings: EXISTS');
    console.log('\n📋 Skipping migration - tables already created');
    return;
  }

  console.log('📄 Tables status:');
  console.log(`   - player_mappings: ${playerMappingsExists ? 'EXISTS' : 'MISSING'}`);
  console.log(`   - team_mappings: ${teamMappingsExists ? 'EXISTS' : 'MISSING'}\n`);

  // Since we can't execute raw SQL, provide instructions
  console.log('⚠️  Cannot execute raw SQL via Supabase JS client');
  console.log('📋 Please execute the following SQL in Supabase SQL Editor:\n');
  console.log('=' + '='.repeat(59));
  console.log('COPY THIS SQL TO SUPABASE SQL EDITOR:');
  console.log('=' + '='.repeat(59) + '\n');

  const sql = `
-- Create player_mappings table
CREATE TABLE IF NOT EXISTS player_mappings (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  leaguepedia_name TEXT NOT NULL,
  season INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(leaguepedia_name, season),
  UNIQUE(player_id, season)
);

CREATE INDEX IF NOT EXISTS idx_player_mappings_leaguepedia ON player_mappings(leaguepedia_name);
CREATE INDEX IF NOT EXISTS idx_player_mappings_season ON player_mappings(season, is_active);
CREATE INDEX IF NOT EXISTS idx_player_mappings_player_id ON player_mappings(player_id);

-- Create team_mappings table
CREATE TABLE IF NOT EXISTS team_mappings (
  id SERIAL PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  leaguepedia_name TEXT NOT NULL,
  season INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(leaguepedia_name, season),
  UNIQUE(team_id, season)
);

CREATE INDEX IF NOT EXISTS idx_team_mappings_leaguepedia ON team_mappings(leaguepedia_name);
CREATE INDEX IF NOT EXISTS idx_team_mappings_season ON team_mappings(season, is_active);
CREATE INDEX IF NOT EXISTS idx_team_mappings_team_id ON team_mappings(team_id);
`;

  console.log(sql);
  console.log('=' + '='.repeat(59));
  console.log('\n📝 INSTRUCTIONS:');
  console.log('   1. Go to https://supabase.com/dashboard');
  console.log('   2. Select your project');
  console.log('   3. Click "SQL Editor" in the left sidebar');
  console.log('   4. Click "New query"');
  console.log('   5. Paste the SQL above');
  console.log('   6. Click "Run" or press Ctrl+Enter');
  console.log('   7. Verify success message appears');
  console.log('\n💡 After executing, run this script again to verify.');
}

executeMigration().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
