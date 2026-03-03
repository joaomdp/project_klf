/**
 * Discover Real Table Schema
 * 
 * Finds the actual columns in the players table by attempting an insert
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

async function discoverSchema() {
  console.log('🔍 Discovering Real Table Schemas\n');
  console.log('=' + '='.repeat(59));
  
  // Get a sample player to see what columns exist
  console.log('\n📊 PLAYERS TABLE:');
  const { data: samplePlayer, error: playerError } = await supabase
    .from('players')
    .select('*')
    .limit(1);
  
  if (playerError) {
    console.error('❌ Error:', playerError.message);
  } else if (samplePlayer && samplePlayer.length > 0) {
    console.log('Columns found:', Object.keys(samplePlayer[0]).join(', '));
    console.log('\nSample record:');
    console.log(JSON.stringify(samplePlayer[0], null, 2));
  } else {
    console.log('⚠️  No data in table, trying to get schema via insert test...');
    
    // Try inserting with minimal data to see what's required
    const { data, error } = await supabase
      .from('players')
      .insert({ name: 'TEST_PLAYER', role: 'TOP' })
      .select();
    
    if (error) {
      console.log('\n📋 Error message (shows required fields):');
      console.log(error.message);
      console.log('\n💡 This tells us what fields are required/missing');
    } else if (data && data.length > 0) {
      console.log('Columns found:', Object.keys(data[0]).join(', '));
      console.log('\nSample record:');
      console.log(JSON.stringify(data[0], null, 2));
      
      // Delete test record
      await supabase.from('players').delete().eq('name', 'TEST_PLAYER');
      console.log('\n✅ Test record deleted');
    }
  }
  
  // Get a sample team
  console.log('\n\n📊 TEAMS TABLE:');
  const { data: sampleTeam } = await supabase
    .from('teams')
    .select('*')
    .limit(1);
  
  if (sampleTeam && sampleTeam.length > 0) {
    console.log('Columns found:', Object.keys(sampleTeam[0]).join(', '));
  }
  
  // Get a sample match
  console.log('\n\n📊 MATCHES TABLE:');
  const { data: sampleMatch } = await supabase
    .from('matches')
    .select('*')
    .limit(1);
  
  if (sampleMatch && sampleMatch.length > 0) {
    console.log('Columns found:', Object.keys(sampleMatch[0]).join(', '));
  } else {
    console.log('⚠️  No data in matches table');
  }
  
  // Get a sample round
  console.log('\n\n📊 ROUNDS TABLE:');
  const { data: sampleRound } = await supabase
    .from('rounds')
    .select('*')
    .limit(1);
  
  if (sampleRound && sampleRound.length > 0) {
    console.log('Columns found:', Object.keys(sampleRound[0]).join(', '));
  }
}

discoverSchema().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
