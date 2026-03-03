const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './api/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

(async () => {
  console.log('=== USER_TEAMS STRUCTURE ===');
  const { data, error } = await supabase.from('user_teams').select('*').limit(1);
  if (error) console.error('Error:', error);
  if (data && data[0]) {
    console.log('Columns:', Object.keys(data[0]).join(', '));
  }
})();
