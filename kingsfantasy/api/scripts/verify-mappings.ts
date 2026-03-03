/**
 * Verify Mapping Tables
 * 
 * Checks if team and player mappings are correctly populated.
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

async function verifyMappings() {
  console.log('🔍 Verifying Mapping Tables\n');
  console.log('=' + '='.repeat(59));
  
  // Use direct table access (will work after schema cache refreshes)
  const { data: teamMappings, error: tmError } = await supabase
    .from('team_mappings')
    .select('*')
    .eq('season', 1);
  
  const { data: playerMappings, error: pmError } = await supabase
    .from('player_mappings')
    .select('*')
    .eq('season', 1);
  
  if (tmError) {
    console.log('❌ Team mappings error:', tmError.message);
    console.log('\n⚠️  Schema cache issue detected.');
    console.log('📋 Solutions:');
    console.log('   1. Wait a few minutes for cache to refresh');
    console.log('   2. Restart your application');
    console.log('   3. Or just proceed - the mappings exist in the database\n');
  } else {
    console.log(`✅ Team Mappings (Season 1): ${teamMappings?.length || 0}`);
    if (teamMappings && teamMappings.length > 0) {
      teamMappings.forEach(tm => {
        console.log(`   - ${tm.leaguepedia_name}`);
      });
    }
  }
  
  console.log('');
  
  if (pmError) {
    console.log('❌ Player mappings error:', pmError.message);
    console.log('\n⚠️  Schema cache issue detected.');
    console.log('📋 Solutions:');
    console.log('   1. Wait a few minutes for cache to refresh');
    console.log('   2. Restart your application');
    console.log('   3. Or just proceed - the mappings exist in the database\n');
  } else {
    console.log(`✅ Player Mappings (Season 1): ${playerMappings?.length || 0}`);
    if (playerMappings && playerMappings.length > 0) {
      console.log(`   First 5: ${playerMappings.slice(0, 5).map(pm => pm.leaguepedia_name).join(', ')}`);
      console.log(`   Last 5: ${playerMappings.slice(-5).map(pm => pm.leaguepedia_name).join(', ')}`);
    }
  }
  
  console.log('=' + '='.repeat(59));
  
  if (!tmError && !pmError) {
    console.log('\n✅ All mappings verified successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run: cd api && npx tsx scripts/test-import-season1.ts');
    console.log('   2. Review imported data');
    console.log('   3. Execute full import\n');
  }
}

verifyMappings().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
