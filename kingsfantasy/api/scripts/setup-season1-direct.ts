/**
 * Complete Season 1 Database Setup (Direct)
 * 
 * This script directly manipulates the database via Supabase client:
 * 1. Deletes all existing players
 * 2. Creates 23 Season 1 players
 * 3. Creates mapping tables (via raw SQL function if available)
 * 4. Populates mappings
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface LeaguepediaPlayer {
  Link: string;
  Team: string;
  Role: string;
}

const teamIds: Record<string, string> = {
  'Oreiudos Esports': '7323c60f-ac08-4c45-9c2e-a71b524bcbb6',
  'Gen GG': 'f07836f1-3330-49d3-bf3f-1434003068e9',
  'G12 Esports': 'af49550b-a083-477b-99e5-513b6aeda00e',
  'Tepei Assassins': 'a59cd445-c281-4cf6-819a-ade10a89da2f'
};

async function setupSeason1() {
  console.log('🚀 Complete Season 1 Database Setup\n');
  console.log('=' + '='.repeat(59));
  console.log('⚠️  WARNING: This will delete all existing players!');
  console.log('=' + '='.repeat(59));
  
  // Load Leaguepedia players
  const playersPath = path.join(__dirname, 'players-season3.json');
  const lpPlayers: LeaguepediaPlayer[] = JSON.parse(fs.readFileSync(playersPath, 'utf-8'));
  
  console.log(`\n📋 Loaded ${lpPlayers.length} players from Leaguepedia\n`);
  
  // STEP 1: Delete all existing players
  console.log('⏳ Step 1: Deleting all existing players...');
  const { error: deleteError } = await supabase
    .from('players')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (deleteError) {
    console.error('❌ Error deleting players:', deleteError.message);
    process.exit(1);
  }
  console.log('✅ All existing players deleted\n');
  
  // STEP 2: Create Season 1 players
  console.log('⏳ Step 2: Creating 23 Season 1 players...\n');
  
  const playersToInsert = lpPlayers.map(p => ({
    name: p.Link,
    role: p.Role.toUpperCase(),
    team_id: teamIds[p.Team],
    price: 50,  // Starting price
    points: 0,
    avg_points: 0,
    kda: null,
    image: 'https://via.placeholder.com/150',  // Placeholder image
    is_captain: false
  }));
  
  let successCount = 0;
  let errorCount = 0;
  const createdPlayers: any[] = [];
  
  // Insert players one by one to see progress
  for (let i = 0; i < playersToInsert.length; i++) {
    const player = playersToInsert[i];
    
    const { data, error } = await supabase
      .from('players')
      .insert(player)
      .select()
      .single();
    
    if (error) {
      console.error(`❌ Error creating ${player.name}:`, error.message);
      errorCount++;
    } else {
      console.log(`✅ Created: ${player.name} (${player.role}) - ${Object.keys(teamIds).find(k => teamIds[k] === player.team_id)}`);
      successCount++;
      createdPlayers.push(data);
    }
  }
  
  console.log(`\n📊 Players created: ${successCount}/${lpPlayers.length}`);
  if (errorCount > 0) {
    console.log(`⚠️  Errors: ${errorCount}`);
  }
  
  // STEP 3: Try to check if mapping tables exist
  console.log('\n⏳ Step 3: Checking mapping tables...\n');
  
  const { data: existingTeamMappings, error: tmError } = await supabase
    .from('team_mappings')
    .select('id')
    .limit(1);
  
  const teamMappingsExist = !tmError || !tmError.message.includes('does not exist');
  
  const { data: existingPlayerMappings, error: pmError } = await supabase
    .from('player_mappings')
    .select('id')
    .limit(1);
  
  const playerMappingsExist = !pmError || !pmError.message.includes('does not exist');
  
  console.log(`team_mappings table: ${teamMappingsExist ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`player_mappings table: ${playerMappingsExist ? '✅ EXISTS' : '❌ MISSING'}`);
  
  if (!teamMappingsExist || !playerMappingsExist) {
    console.log('\n⚠️  Mapping tables do not exist!');
    console.log('📋 You need to create them manually in Supabase SQL Editor:');
    console.log('\nRun this SQL:\n');
    
    const createTablesSQL = `
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
`;
    
    console.log(createTablesSQL);
    console.log('\n⏸️  After creating tables, run this script again to populate mappings.');
    process.exit(0);
  }
  
  // STEP 4: Populate team mappings
  console.log('\n⏳ Step 4: Populating team mappings...\n');
  
  // Clear existing Season 1 team mappings
  await supabase.from('team_mappings').delete().eq('season', 1);
  
  const teamMappingsToInsert = [
    { team_id: teamIds['Oreiudos Esports'], leaguepedia_name: 'Oreiudos Esports', season: 1, is_active: true },
    { team_id: teamIds['Gen GG'], leaguepedia_name: 'Gen GG', season: 1, is_active: true },
    { team_id: teamIds['G12 Esports'], leaguepedia_name: 'G12 Esports', season: 1, is_active: true },
    { team_id: teamIds['Tepei Assassins'], leaguepedia_name: 'Tepei Assassins', season: 1, is_active: true }
  ];
  
  for (const tm of teamMappingsToInsert) {
    const { error } = await supabase.from('team_mappings').insert(tm);
    if (error) {
      console.error(`❌ Error mapping ${tm.leaguepedia_name}:`, error.message);
    } else {
      console.log(`✅ Mapped: ${tm.leaguepedia_name}`);
    }
  }
  
  // STEP 5: Populate player mappings
  console.log('\n⏳ Step 5: Populating player mappings...\n');
  
  // Clear existing Season 1 player mappings
  await supabase.from('player_mappings').delete().eq('season', 1);
  
  // Create mappings for all created players
  let mappedCount = 0;
  for (const player of createdPlayers) {
    const { error } = await supabase
      .from('player_mappings')
      .insert({
        player_id: player.id,
        leaguepedia_name: player.name,
        season: 1,
        is_active: true
      });
    
    if (error) {
      console.error(`❌ Error mapping ${player.name}:`, error.message);
    } else {
      console.log(`✅ Mapped: ${player.name}`);
      mappedCount++;
    }
  }
  
  // STEP 6: Verification
  console.log('\n' + '=' + '='.repeat(59));
  console.log('📊 FINAL VERIFICATION:');
  console.log('=' + '='.repeat(59));
  
  const { data: allPlayers } = await supabase.from('players').select('id, name, role');
  const { data: allTeamMappings } = await supabase.from('team_mappings').select('*').eq('season', 1);
  const { data: allPlayerMappings } = await supabase.from('player_mappings').select('*').eq('season', 1);
  
  console.log(`✅ Total players in database: ${allPlayers?.length || 0}`);
  console.log(`✅ Total team mappings (Season 1): ${allTeamMappings?.length || 0}`);
  console.log(`✅ Total player mappings (Season 1): ${allPlayerMappings?.length || 0}`);
  
  console.log('\n🎉 Season 1 database setup completed!');
  console.log('\n📋 Next steps:');
  console.log('   1. Test the import system');
  console.log('   2. Import Season 1 match data');
  console.log('   3. Validate imported data');
}

setupSeason1().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
