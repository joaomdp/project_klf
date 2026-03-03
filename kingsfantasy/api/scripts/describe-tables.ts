import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in api/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function describeTable(tableName: string) {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name,data_type,is_nullable,column_default')
    .eq('table_schema', 'public')
    .eq('table_name', tableName)
    .order('ordinal_position', { ascending: true });

  if (error) {
    console.error(`❌ Error describing ${tableName}:`, error.message);
    return;
  }

  console.log(`\n=== ${tableName} ===`);
  data?.forEach((col: any) => {
    console.log(
      `- ${col.column_name} | ${col.data_type} | nullable=${col.is_nullable} | default=${col.column_default || 'null'}`
    );
  });
}

async function main() {
  await describeTable('teams');
  await describeTable('players');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
