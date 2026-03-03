/**
 * Get Database Schema
 * 
 * Queries Supabase to get the actual schema of key tables
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

async function getSchema() {
  console.log('📊 Fetching Database Schema\n');
  
  const tables = ['matches', 'rounds', 'player_performances'];
  
  for (const table of tables) {
    console.log(`\n=== ${table.toUpperCase()} ===`);
    
    // Try to get a sample record to see columns
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(`❌ Error: ${error.message}`);
      continue;
    }
    
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).join(', '));
      console.log('Sample:', JSON.stringify(data[0], null, 2));
    } else {
      // Try inserting and deleting to see columns
      console.log('No data in table. Trying to inspect...');
    }
  }
}

getSchema().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
