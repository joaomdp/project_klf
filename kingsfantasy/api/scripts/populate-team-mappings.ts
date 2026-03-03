/**
 * Populate Team Mappings Script
 * 
 * This script populates the team_mappings table with the 4 correct teams
 * from Kings Lendas Season 1.
 * 
 * Teams to map:
 * - Oreiudos Esports
 * - Gen GG
 * - G12 Esports
 * - Tepei Assassins
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
  console.error('❌ Missing Supabase credentials in .env file');
  console.error(`   Looking for .env at: ${envPath}`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TeamMapping {
  leaguepedia_name: string;
  db_name: string;
  db_id: string;
  confidence: number;
}

async function populateTeamMappings() {
  console.log('📊 Populate Team Mappings\n');
  console.log('=' + '='.repeat(59));

  // Load approved team mappings
  const mappingsPath = path.join(__dirname, 'approved-team-mappings.json');
  const teamMappings: TeamMapping[] = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));

  console.log(`📋 Loading ${teamMappings.length} team mappings from approved-team-mappings.json\n`);

  // Insert mappings directly
  console.log('⏳ Inserting team mappings...\n');

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const mapping of teamMappings) {
    const record = {
      team_id: mapping.db_id,
      leaguepedia_name: mapping.leaguepedia_name,
      season: 1, // Kings Lendas Season 1
      is_active: true
    };

    const { error: insertError } = await supabase
      .from('team_mappings')
      .insert(record);

    if (insertError) {
      console.error(`❌ Error inserting ${mapping.leaguepedia_name}:`, insertError.message);
      errors.push(`${mapping.leaguepedia_name}: ${insertError.message}`);
      errorCount++;
    } else {
      console.log(`✅ Inserted: ${mapping.leaguepedia_name} -> ${mapping.db_name}`);
      successCount++;
    }
  }

  // Results
  console.log('\n' + '=' + '='.repeat(59));
  console.log('📊 Population Results:');
  console.log('=' + '='.repeat(59));
  console.log(`✅ Successfully inserted: ${successCount}`);
  console.log(`❌ Failed to insert: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    errors.forEach((err, idx) => {
      console.log(`   ${idx + 1}. ${err}`);
    });
  }

  // Verify final state
  const { data: finalMappings } = await supabase
    .from('team_mappings')
    .select('*')
    .eq('season', 1)
    .eq('is_active', true);

  console.log(`\n📊 Total active Season 1 mappings: ${finalMappings?.length || 0}`);
  console.log('=' + '='.repeat(59));

  if (errorCount === 0) {
    console.log('\n🎉 Team mappings populated successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Populate player_mappings table (14 matched players)');
    console.log('   2. Fix mapper.service.ts schema issues');
    console.log('   3. Fix auto-import.service.ts column names');
  } else {
    console.log('\n⚠️  Population completed with errors. Please review.');
  }

  // Show final mappings
  if (finalMappings && finalMappings.length > 0) {
    console.log('\n📋 Active Season 1 Team Mappings:');
    finalMappings.forEach((m, idx) => {
      console.log(`   ${idx + 1}. ${m.leaguepedia_name} -> Team ID ${m.team_id}`);
    });
  }
}

// Run population
populateTeamMappings().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
