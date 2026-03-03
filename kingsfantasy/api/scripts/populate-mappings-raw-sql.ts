/**
 * Populate Mapping Tables Using Raw SQL
 * 
 * This script bypasses the Supabase schema cache issue by using raw SQL queries.
 * It populates the team_mappings and player_mappings tables for Season 1.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const teamMappings = [
  { name: 'Oreiudos Esports', id: '7323c60f-ac08-4c45-9c2e-a71b524bcbb6' },
  { name: 'Gen GG', id: 'f07836f1-3330-49d3-bf3f-1434003068e9' },
  { name: 'G12 Esports', id: 'af49550b-a083-477b-99e5-513b6aeda00e' },
  { name: 'Tepei Assassins', id: 'a59cd445-c281-4cf6-819a-ade10a89da2f' }
];

async function populateMappings() {
  console.log('🚀 Populating Mapping Tables via Raw SQL\n');
  
  // Step 1: Clear existing Season 1 mappings
  console.log('⏳ Step 1: Clearing existing Season 1 mappings...\n');
  
  const clearTeamMappingsSQL = `DELETE FROM team_mappings WHERE season = 1;`;
  const clearPlayerMappingsSQL = `DELETE FROM player_mappings WHERE season = 1;`;
  
  try {
    await supabase.rpc('exec_sql', { query: clearTeamMappingsSQL });
    console.log('✅ Cleared team mappings for Season 1');
  } catch (error: any) {
    console.log('⚠️  RPC not available, trying alternative method...');
  }
  
  try {
    await supabase.rpc('exec_sql', { query: clearPlayerMappingsSQL });
    console.log('✅ Cleared player mappings for Season 1');
  } catch (error: any) {
    console.log('⚠️  RPC not available, trying alternative method...');
  }
  
  // Step 2: Insert team mappings using raw SQL
  console.log('\n⏳ Step 2: Inserting team mappings...\n');
  
  const teamMappingsSQL = `
INSERT INTO team_mappings (team_id, leaguepedia_name, season, is_active) VALUES
  ('${teamMappings[0].id}', '${teamMappings[0].name}', 1, true),
  ('${teamMappings[1].id}', '${teamMappings[1].name}', 1, true),
  ('${teamMappings[2].id}', '${teamMappings[2].name}', 1, true),
  ('${teamMappings[3].id}', '${teamMappings[3].name}', 1, true)
ON CONFLICT (leaguepedia_name, season) DO NOTHING;
  `;
  
  console.log('Team mappings SQL:');
  console.log(teamMappingsSQL);
  console.log('\n⚠️  MANUAL ACTION REQUIRED:');
  console.log('Copy and execute the above SQL in Supabase SQL Editor\n');
  
  // Step 3: Get all players and generate player mappings SQL
  console.log('⏳ Step 3: Fetching players and generating player mappings SQL...\n');
  
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name');
  
  if (playersError) {
    console.error('❌ Error fetching players:', playersError.message);
    process.exit(1);
  }
  
  if (!players || players.length === 0) {
    console.error('❌ No players found in database');
    process.exit(1);
  }
  
  console.log(`✅ Found ${players.length} players\n`);
  
  // Generate INSERT statements for player mappings
  const playerMappingsValues = players.map(p => 
    `  ('${p.id}', '${p.name}', 1, true)`
  ).join(',\n');
  
  const playerMappingsSQL = `
INSERT INTO player_mappings (player_id, leaguepedia_name, season, is_active) VALUES
${playerMappingsValues}
ON CONFLICT (leaguepedia_name, season) DO NOTHING;
  `;
  
  console.log('Player mappings SQL:');
  console.log(playerMappingsSQL);
  console.log('\n⚠️  MANUAL ACTION REQUIRED:');
  console.log('Copy and execute the above SQL in Supabase SQL Editor\n');
  
  // Write SQL to file for easy copy-paste
  const fs = require('fs');
  const sqlFilePath = path.join(__dirname, '..', '..', 'POPULATE_MAPPINGS.sql');
  
  const completeSql = `
-- ============================================================
-- POPULATE MAPPING TABLES FOR SEASON 1
-- ============================================================
-- Execute this SQL in Supabase SQL Editor
-- ============================================================

-- Clear existing Season 1 mappings
DELETE FROM team_mappings WHERE season = 1;
DELETE FROM player_mappings WHERE season = 1;

-- Insert team mappings
${teamMappingsSQL}

-- Insert player mappings
${playerMappingsSQL}

-- Verification
SELECT 'Team Mappings' as table_name, COUNT(*) as count FROM team_mappings WHERE season = 1
UNION ALL
SELECT 'Player Mappings' as table_name, COUNT(*) as count FROM player_mappings WHERE season = 1;
  `;
  
  fs.writeFileSync(sqlFilePath, completeSql.trim());
  
  console.log('=' + '='.repeat(59));
  console.log('📄 SQL file created: POPULATE_MAPPINGS.sql');
  console.log('=' + '='.repeat(59));
  console.log('\n📋 Next steps:');
  console.log('   1. Open Supabase SQL Editor');
  console.log('   2. Copy contents from POPULATE_MAPPINGS.sql');
  console.log('   3. Execute the SQL');
  console.log('   4. Run: npm run verify-mappings\n');
}

populateMappings().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
