/**
 * Smart Mapping Generator
 * 
 * This script queries the actual database to get real team/player IDs
 * and generates correct SQL for the mapping tables.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TeamMapping {
  leaguepedia_name: string;
  db_name: string;
  db_id: string;
  confidence: number;
}

interface PlayerMapping {
  leaguepedia_name: string;
  leaguepedia_team: string;
  leaguepedia_role: string;
  db_name: string;
  db_id: string;
  db_team: string;
  db_role: string;
  confidence: number;
  match_type: string;
}

async function generateSmartMappings() {
  console.log('🔍 Smart Mapping Generator\n');
  console.log('=' + '='.repeat(59));
  
  // Load approved mappings
  const teamMappingsPath = path.join(__dirname, 'approved-team-mappings.json');
  const playerMappingsPath = path.join(__dirname, 'approved-player-mappings.json');
  
  const approvedTeams: TeamMapping[] = JSON.parse(fs.readFileSync(teamMappingsPath, 'utf-8'));
  const approvedPlayers: PlayerMapping[] = JSON.parse(fs.readFileSync(playerMappingsPath, 'utf-8'));
  
  console.log(`📋 Loaded ${approvedTeams.length} approved team mappings`);
  console.log(`📋 Loaded ${approvedPlayers.length} approved player mappings\n`);
  
  // Step 1: Fetch ALL teams from database
  console.log('⏳ Fetching all teams from database...');
  const { data: dbTeams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name');
  
  if (teamsError) {
    console.error('❌ Error fetching teams:', teamsError.message);
    process.exit(1);
  }
  
  console.log(`✅ Found ${dbTeams?.length || 0} teams in database\n`);
  
  // Step 2: Fetch ALL players from database
  console.log('⏳ Fetching all players from database...');
  const { data: dbPlayers, error: playersError } = await supabase
    .from('players')
    .select('id, name, role, team_id');
  
  if (playersError) {
    console.error('❌ Error fetching players:', playersError.message);
    process.exit(1);
  }
  
  console.log(`✅ Found ${dbPlayers?.length || 0} players in database\n`);
  
  // Step 3: Create lookup maps
  const teamsByName = new Map(dbTeams?.map(t => [t.name.toLowerCase().trim(), t]) || []);
  const playersByName = new Map(dbPlayers?.map(p => [p.name.toLowerCase().trim(), p]) || []);
  
  // Step 4: Map teams with REAL IDs
  console.log('🔄 Mapping teams to real database IDs...\n');
  const validTeamMappings: Array<{leaguepedia_name: string, team_id: string, db_name: string}> = [];
  const invalidTeams: string[] = [];
  
  for (const tm of approvedTeams) {
    const dbTeam = teamsByName.get(tm.db_name.toLowerCase().trim());
    
    if (dbTeam) {
      validTeamMappings.push({
        leaguepedia_name: tm.leaguepedia_name,
        team_id: dbTeam.id,
        db_name: dbTeam.name
      });
      console.log(`✅ ${tm.leaguepedia_name} → ${dbTeam.name} (${dbTeam.id})`);
    } else {
      invalidTeams.push(tm.db_name);
      console.log(`❌ ${tm.leaguepedia_name} → ${tm.db_name} NOT FOUND`);
    }
  }
  
  // Step 5: Map players with REAL IDs
  console.log('\n🔄 Mapping players to real database IDs...\n');
  const validPlayerMappings: Array<{leaguepedia_name: string, player_id: string, db_name: string, db_role: string}> = [];
  const invalidPlayers: string[] = [];
  
  // Remove duplicates (Pijack appears twice)
  const uniquePlayers = Array.from(
    new Map(approvedPlayers.map(p => [p.leaguepedia_name, p])).values()
  );
  
  for (const pm of uniquePlayers) {
    const dbPlayer = playersByName.get(pm.db_name.toLowerCase().trim());
    
    if (dbPlayer) {
      validPlayerMappings.push({
        leaguepedia_name: pm.leaguepedia_name,
        player_id: dbPlayer.id,
        db_name: dbPlayer.name,
        db_role: dbPlayer.role
      });
      console.log(`✅ ${pm.leaguepedia_name} → ${dbPlayer.name} (${dbPlayer.id})`);
    } else {
      invalidPlayers.push(pm.db_name);
      console.log(`❌ ${pm.leaguepedia_name} → ${pm.db_name} NOT FOUND`);
    }
  }
  
  // Step 6: Generate SQL
  console.log('\n' + '=' + '='.repeat(59));
  console.log('📊 MAPPING RESULTS:');
  console.log('=' + '='.repeat(59));
  console.log(`✅ Valid team mappings: ${validTeamMappings.length}/${approvedTeams.length}`);
  console.log(`✅ Valid player mappings: ${validPlayerMappings.length}/${uniquePlayers.length}`);
  
  if (invalidTeams.length > 0) {
    console.log(`\n⚠️  Invalid teams (not in database):`);
    invalidTeams.forEach(t => console.log(`   - ${t}`));
  }
  
  if (invalidPlayers.length > 0) {
    console.log(`\n⚠️  Invalid players (not in database):`);
    invalidPlayers.forEach(p => console.log(`   - ${p}`));
  }
  
  if (validTeamMappings.length === 0 || validPlayerMappings.length === 0) {
    console.error('\n❌ Not enough valid mappings to generate SQL');
    process.exit(1);
  }
  
  // Generate SQL
  console.log('\n' + '=' + '='.repeat(59));
  console.log('📝 GENERATED SQL (copy this to Supabase SQL Editor):');
  console.log('=' + '='.repeat(59) + '\n');
  
  let sql = `-- Smart-Generated Mapping SQL
-- Generated: ${new Date().toISOString()}
-- Valid mappings: ${validTeamMappings.length} teams, ${validPlayerMappings.length} players

-- Drop and recreate tables
DROP TABLE IF EXISTS player_mappings CASCADE;
DROP TABLE IF EXISTS team_mappings CASCADE;

-- Create team_mappings table
CREATE TABLE team_mappings (
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

CREATE INDEX idx_team_mappings_leaguepedia ON team_mappings(leaguepedia_name);
CREATE INDEX idx_team_mappings_season ON team_mappings(season, is_active);
CREATE INDEX idx_team_mappings_team_id ON team_mappings(team_id);

-- Create player_mappings table
CREATE TABLE player_mappings (
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

CREATE INDEX idx_player_mappings_leaguepedia ON player_mappings(leaguepedia_name);
CREATE INDEX idx_player_mappings_season ON player_mappings(season, is_active);
CREATE INDEX idx_player_mappings_player_id ON player_mappings(player_id);

-- Insert team mappings
INSERT INTO team_mappings (team_id, leaguepedia_name, season, is_active)
VALUES\n`;
  
  sql += validTeamMappings.map((tm, idx) => {
    const comma = idx < validTeamMappings.length - 1 ? ',' : ';';
    return `  ('${tm.team_id}', '${tm.leaguepedia_name}', 1, true)${comma}  -- ${tm.db_name}`;
  }).join('\n');
  
  sql += `\n\n-- Insert player mappings
INSERT INTO player_mappings (player_id, leaguepedia_name, season, is_active)
VALUES\n`;
  
  sql += validPlayerMappings.map((pm, idx) => {
    const comma = idx < validPlayerMappings.length - 1 ? ',' : ';';
    return `  ('${pm.player_id}', '${pm.leaguepedia_name}', 1, true)${comma}  -- ${pm.db_name} (${pm.db_role})`;
  }).join('\n');
  
  sql += `\n\n-- Verification queries
SELECT 
  tm.leaguepedia_name,
  t.name AS db_name,
  tm.season
FROM team_mappings tm
JOIN teams t ON t.id = tm.team_id
WHERE tm.season = 1
ORDER BY tm.leaguepedia_name;

SELECT 
  pm.leaguepedia_name,
  p.name AS db_name,
  p.role AS db_role,
  t.name AS db_team,
  pm.season
FROM player_mappings pm
JOIN players p ON p.id = pm.player_id
JOIN teams t ON t.id = p.team_id
WHERE pm.season = 1
ORDER BY pm.leaguepedia_name;

SELECT '✅ Mappings created successfully!' AS status;
`;
  
  console.log(sql);
  
  // Save to file
  const outputPath = path.join(__dirname, 'migrations', '003-smart-mappings.sql');
  fs.writeFileSync(outputPath, sql);
  console.log('\n' + '=' + '='.repeat(59));
  console.log(`💾 SQL saved to: ${outputPath}`);
  console.log('=' + '='.repeat(59));
}

generateSmartMappings().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
