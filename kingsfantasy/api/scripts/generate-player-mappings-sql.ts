/**
 * Generate SQL for Player Mappings Population
 * 
 * This script generates SQL INSERT statements that can be executed
 * in the Supabase SQL Editor to populate player_mappings.
 */

import * as fs from 'fs';
import * as path from 'path';

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

function generateSQL() {
  console.log('📊 Generate Player Mappings SQL\n');
  console.log('=' + '='.repeat(59));

  // Load approved player mappings
  const mappingsPath = path.join(__dirname, 'approved-player-mappings.json');
  const playerMappings: PlayerMapping[] = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));

  console.log(`📋 Generating SQL for ${playerMappings.length} player mappings\n`);
  console.log('=' + '='.repeat(59));
  console.log('COPY THIS SQL TO SUPABASE SQL EDITOR:');
  console.log('=' + '='.repeat(59) + '\n');

  // Generate SQL
  let sql = `-- Populate player_mappings for Kings Lendas Season 1
-- Generated on: ${new Date().toISOString()}

-- Delete existing Season 1 mappings if any
DELETE FROM player_mappings WHERE season = 1;

-- Insert new mappings
INSERT INTO player_mappings (player_id, leaguepedia_name, season, is_active)
VALUES\n`;

  const values = playerMappings.map((m, idx) => {
    const comma = idx < playerMappings.length - 1 ? ',' : ';';
    return `  ('${m.db_id}', '${m.leaguepedia_name}', 1, true)${comma}  -- ${m.db_name} (${m.leaguepedia_team} ${m.leaguepedia_role})`;
  });

  sql += values.join('\n');

  sql += `\n\n-- Verify insertion
SELECT 
  pm.leaguepedia_name,
  p.name AS db_name,
  p.role AS db_role,
  t.name AS db_team,
  pm.season,
  pm.is_active
FROM player_mappings pm
JOIN players p ON p.id = pm.player_id
JOIN teams t ON t.id = p.team_id
WHERE pm.season = 1
ORDER BY pm.leaguepedia_name;
`;

  console.log(sql);
  console.log('\n' + '=' + '='.repeat(59));
  console.log('📝 INSTRUCTIONS:');
  console.log('   1. Copy the SQL above');
  console.log('   2. Go to Supabase Dashboard > SQL Editor');
  console.log('   3. Paste and execute the SQL');
  console.log('   4. Verify the SELECT query returns 14 rows');
  console.log('=' + '='.repeat(59));
}

generateSQL();
