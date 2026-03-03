/**
 * Cleanup Script: Delete Incorrect Teams
 * 
 * This script removes 14 teams that were incorrectly added to the database.
 * These are CBLOL teams and fantasy teams that don't belong to Kings Lendas Season 1.
 * 
 * Teams to delete:
 * - LOUD, paiN Gaming, FURIA Esports, Fluxo, RED Canids, INTZ, Vivo Keyd, KaBuM
 * - ÉanDG, Vôs Grandes, paiNtriotas, 100Vices, FONatic, Karmine Cospe
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

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

// List of incorrect teams to delete
const TEAMS_TO_DELETE = [
  'LOUD',
  'paiN Gaming',
  'FURIA Esports',
  'Fluxo',
  'RED Canids',
  'INTZ',
  'Vivo Keyd',
  'KaBuM',
  'ÉanDG',
  'Vôs Grandes',
  'paiNtriotas',
  '100Vices',
  'FONatic',
  'Karmine Cospe'
];

async function cleanupIncorrectTeams() {
  console.log('🧹 Cleanup: Delete Incorrect Teams\n');
  console.log('=' + '='.repeat(59));
  console.log(`📋 Teams to delete: ${TEAMS_TO_DELETE.length}`);
  console.log('=' + '='.repeat(59) + '\n');

  // Step 1: Get all teams first
  const { data: allTeams, error: allTeamsError } = await supabase
    .from('teams')
    .select('id, name');

  if (allTeamsError) {
    console.error('❌ Error fetching all teams:', allTeamsError.message);
    process.exit(1);
  }

  const beforeCount = allTeams?.length || 0;
  console.log(`📊 Current team count: ${beforeCount}\n`);

  // Step 2: Verify which teams exist
  console.log('🔍 Verifying teams exist in database...\n');
  
  const { data: existingTeams, error: fetchError } = await supabase
    .from('teams')
    .select('id, name')
    .in('name', TEAMS_TO_DELETE);

  if (fetchError) {
    console.error('❌ Error fetching teams:', fetchError.message);
    process.exit(1);
  }

  if (!existingTeams || existingTeams.length === 0) {
    console.log('✅ No incorrect teams found in database');
    console.log('📋 Database is already clean!');
    return;
  }

  console.log(`✅ Found ${existingTeams.length} teams to delete:\n`);
  existingTeams.forEach((team, idx) => {
    console.log(`   ${idx + 1}. ${team.name} (${team.id})`);
  });

  // Step 3: Delete teams
  console.log('\n⏳ Deleting incorrect teams...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const team of existingTeams) {
    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('id', team.id);

    if (deleteError) {
      console.error(`❌ Error deleting ${team.name}:`, deleteError.message);
      errorCount++;
    } else {
      console.log(`✅ Deleted: ${team.name}`);
      successCount++;
    }
  }

  // Step 4: Verify deletion
  console.log('\n' + '=' + '='.repeat(59));
  console.log('📊 Cleanup Results:');
  console.log('=' + '='.repeat(59));
  console.log(`✅ Successfully deleted: ${successCount}`);
  console.log(`❌ Failed to delete: ${errorCount}`);

  const { data: finalTeams } = await supabase
    .from('teams')
    .select('id, name');

  const afterCount = finalTeams?.length || 0;
  
  console.log(`📊 Team count before: ${beforeCount}`);
  console.log(`📊 Team count after: ${afterCount}`);
  console.log(`📉 Teams removed: ${beforeCount - afterCount}`);
  console.log('=' + '='.repeat(59));

  if (errorCount === 0) {
    console.log('\n🎉 Cleanup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Populate team_mappings table (4 correct teams)');
    console.log('   2. Populate player_mappings table (14 matched players)');
  } else {
    console.log('\n⚠️  Cleanup completed with errors. Please review.');
  }

  // Step 5: Show remaining teams
  console.log('\n📋 Remaining teams in database:');
  const { data: remainingTeams } = await supabase
    .from('teams')
    .select('name')
    .order('name');

  if (remainingTeams && remainingTeams.length > 0) {
    remainingTeams.forEach((team, idx) => {
      console.log(`   ${idx + 1}. ${team.name}`);
    });
  }
}

// Run cleanup
cleanupIncorrectTeams().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
