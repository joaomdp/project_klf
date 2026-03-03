/**
 * Verify Database Tables
 * 
 * Quick script to verify which tables exist in the database
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
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTables() {
  console.log('🔍 Verifying Database Tables\n');
  
  const tables = [
    'teams',
    'players',
    'champions',
    'rounds',
    'matches',
    'player_performances',
    'player_mappings',
    'team_mappings'
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    const exists = !error || !error.message.includes('does not exist');
    const status = exists ? '✅ EXISTS' : '❌ MISSING';
    console.log(`${status}  ${table}`);
  }
}

verifyTables().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
