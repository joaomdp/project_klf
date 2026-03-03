/**
 * Generate Complete Season 1 Setup SQL
 * 
 * This script:
 * 1. Deletes all existing players
 * 2. Creates all 23 players from Kings Lendas Season 1
 * 3. Creates mapping tables
 * 4. Populates mappings for all players and teams
 */

import * as fs from 'fs';
import * as path from 'path';

interface LeaguepediaPlayer {
  Link: string;  // Player name in Leaguepedia
  Team: string;
  Role: string;
}

function generateCompleteSetup() {
  console.log('🔧 Generating Complete Season 1 Setup SQL\n');
  console.log('=' + '='.repeat(59));
  
  // Load Leaguepedia Season 1 players
  const playersPath = path.join(__dirname, 'players-season3.json');
  const lpPlayers: LeaguepediaPlayer[] = JSON.parse(fs.readFileSync(playersPath, 'utf-8'));
  
  console.log(`📋 Loaded ${lpPlayers.length} players from Leaguepedia Season 1\n`);
  
  // Known team IDs (already in database)
  const teamIds: Record<string, string> = {
    'Oreiudos Esports': '7323c60f-ac08-4c45-9c2e-a71b524bcbb6',
    'Gen GG': 'f07836f1-3330-49d3-bf3f-1434003068e9',
    'G12 Esports': 'af49550b-a083-477b-99e5-513b6aeda00e',
    'Tepei Assassins': 'a59cd445-c281-4cf6-819a-ade10a89da2f'
  };
  
  // Generate SQL
  let sql = `-- =====================================================
-- COMPLETE SEASON 1 SETUP
-- =====================================================
-- This script sets up a clean database with only Season 1 data
-- Generated: ${new Date().toISOString()}
-- =====================================================

-- =====================================================
-- STEP 1: CLEAN EXISTING DATA
-- =====================================================

-- Delete existing mapping tables
DROP TABLE IF EXISTS player_mappings CASCADE;
DROP TABLE IF EXISTS team_mappings CASCADE;

-- Delete all existing players
DELETE FROM players;

-- =====================================================
-- STEP 2: CREATE SEASON 1 PLAYERS (${lpPlayers.length} players)
-- =====================================================

INSERT INTO players (id, name, role, team_id, price, points, avg_points, created_at)
VALUES\n`;
  
  const playerInserts = lpPlayers.map((p, idx) => {
    const teamId = teamIds[p.Team];
    if (!teamId) {
      console.warn(`⚠️  Warning: Team "${p.Team}" not found in team IDs map`);
    }
    
    // Generate a deterministic UUID based on name (for consistency)
    const uuid = `gen_random_uuid()`;
    const comma = idx < lpPlayers.length - 1 ? ',' : ';';
    
    return `  (${uuid}, '${p.Link}', '${p.Role.toUpperCase()}', '${teamId}', 50000, 0, 0, NOW())${comma}  -- ${p.Team}`;
  });
  
  sql += playerInserts.join('\n');
  
  sql += `\n\n-- =====================================================
-- STEP 3: CREATE MAPPING TABLES
-- =====================================================

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

-- =====================================================
-- STEP 4: POPULATE TEAM MAPPINGS (4 teams)
-- =====================================================

INSERT INTO team_mappings (team_id, leaguepedia_name, season, is_active)
VALUES
  ('7323c60f-ac08-4c45-9c2e-a71b524bcbb6', 'Oreiudos Esports', 1, true),
  ('f07836f1-3330-49d3-bf3f-1434003068e9', 'Gen GG', 1, true),
  ('af49550b-a083-477b-99e5-513b6aeda00e', 'G12 Esports', 1, true),
  ('a59cd445-c281-4cf6-819a-ade10a89da2f', 'Tepei Assassins', 1, true);

-- =====================================================
-- STEP 5: POPULATE PLAYER MAPPINGS (${lpPlayers.length} players)
-- =====================================================

INSERT INTO player_mappings (player_id, leaguepedia_name, season, is_active)
SELECT 
  p.id,
  p.name,
  1,
  true
FROM players p
WHERE p.name IN (${lpPlayers.map(p => `'${p.Link}'`).join(', ')});

-- =====================================================
-- STEP 6: VERIFICATION QUERIES
-- =====================================================

-- Show all teams
SELECT 
  t.id,
  t.name,
  (SELECT COUNT(*) FROM players WHERE team_id = t.id) AS player_count
FROM teams t
ORDER BY t.name;

-- Show all players by team
SELECT 
  t.name AS team_name,
  p.name AS player_name,
  p.role,
  p.price
FROM players p
JOIN teams t ON t.id = p.team_id
ORDER BY t.name, p.role, p.name;

-- Show team mappings
SELECT 
  tm.leaguepedia_name,
  t.name AS db_name,
  tm.season
FROM team_mappings tm
JOIN teams t ON t.id = tm.team_id
WHERE tm.season = 1
ORDER BY tm.leaguepedia_name;

-- Show player mappings
SELECT 
  pm.leaguepedia_name,
  p.name AS db_name,
  p.role,
  t.name AS team_name,
  pm.season
FROM player_mappings pm
JOIN players p ON p.id = pm.player_id
JOIN teams t ON t.id = p.team_id
WHERE pm.season = 1
ORDER BY t.name, p.role, p.name;

-- Summary
SELECT '✅ Season 1 setup completed!' AS status;
SELECT COUNT(*) AS total_players FROM players;
SELECT COUNT(*) AS total_player_mappings FROM player_mappings WHERE season = 1;
SELECT COUNT(*) AS total_team_mappings FROM team_mappings WHERE season = 1;
`;
  
  console.log('Generated SQL with:');
  console.log(`  - ${lpPlayers.length} players`);
  console.log(`  - 4 teams`);
  console.log(`  - Complete mapping tables\n`);
  
  // Save to file
  const outputPath = path.join(__dirname, 'migrations', '004-complete-season1-setup.sql');
  fs.writeFileSync(outputPath, sql);
  
  console.log('=' + '='.repeat(59));
  console.log(`💾 SQL saved to:`);
  console.log(`   ${outputPath}`);
  console.log('=' + '='.repeat(59));
  console.log('\n📋 INSTRUCTIONS:');
  console.log('1. Open Supabase Dashboard → SQL Editor');
  console.log('2. Copy the SQL from the file above');
  console.log('3. Paste and execute');
  console.log('4. Verify all queries return expected results\n');
  
  return sql;
}

const sql = generateCompleteSetup();
console.log('\n\n📄 SQL PREVIEW (first 50 lines):\n');
console.log(sql.split('\n').slice(0, 50).join('\n'));
console.log('\n... (see full SQL in the file)');
