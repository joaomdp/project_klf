/**
 * Generate SQL for Team Mappings Population
 * 
 * This script generates SQL INSERT statements that can be executed
 * in the Supabase SQL Editor to populate team_mappings.
 */

import * as fs from 'fs';
import * as path from 'path';

interface TeamMapping {
  leaguepedia_name: string;
  db_name: string;
  db_id: string;
  confidence: number;
}

function generateSQL() {
  console.log('📊 Generate Team Mappings SQL\n');
  console.log('=' + '='.repeat(59));

  // Load approved team mappings
  const mappingsPath = path.join(__dirname, 'approved-team-mappings.json');
  const teamMappings: TeamMapping[] = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));

  console.log(`📋 Generating SQL for ${teamMappings.length} team mappings\n`);
  console.log('=' + '='.repeat(59));
  console.log('COPY THIS SQL TO SUPABASE SQL EDITOR:');
  console.log('=' + '='.repeat(59) + '\n');

  // Generate SQL
  let sql = `-- Populate team_mappings for Kings Lendas Season 1
-- Generated on: ${new Date().toISOString()}

-- Delete existing Season 1 mappings if any
DELETE FROM team_mappings WHERE season = 1;

-- Insert new mappings
INSERT INTO team_mappings (team_id, leaguepedia_name, season, is_active)
VALUES\n`;

  const values = teamMappings.map((m, idx) => {
    const comma = idx < teamMappings.length - 1 ? ',' : ';';
    return `  ('${m.db_id}', '${m.leaguepedia_name}', 1, true)${comma}`;
  });

  sql += values.join('\n');

  sql += `\n\n-- Verify insertion
SELECT 
  tm.leaguepedia_name,
  t.name AS db_name,
  tm.season,
  tm.is_active
FROM team_mappings tm
JOIN teams t ON t.id = tm.team_id
WHERE tm.season = 1
ORDER BY tm.leaguepedia_name;
`;

  console.log(sql);
  console.log('\n' + '=' + '='.repeat(59));
  console.log('📝 INSTRUCTIONS:');
  console.log('   1. Copy the SQL above');
  console.log('   2. Go to Supabase Dashboard > SQL Editor');
  console.log('   3. Paste and execute the SQL');
  console.log('   4. Verify the SELECT query returns 4 rows');
  console.log('=' + '='.repeat(59));
}

generateSQL();
