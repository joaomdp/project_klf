import { supabase } from '../config/supabase';

async function checkSchema() {
  console.log('=== TEAMS TABLE ===');
  const { data: teams } = await supabase.from('teams').select('*').limit(1);
  if (teams && teams[0]) console.log('Columns:', Object.keys(teams[0]));
  
  console.log('\n=== PLAYERS TABLE ===');
  const { data: players } = await supabase.from('players').select('*').limit(1);
  if (players && players[0]) console.log('Columns:', Object.keys(players[0]));
  
  console.log('\n=== CHAMPIONS TABLE ===');
  const { data: champions } = await supabase.from('champions').select('*').limit(1);
  if (champions && champions[0]) console.log('Columns:', Object.keys(champions[0]));
  
  console.log('\n=== ROUNDS TABLE ===');
  const { data: rounds } = await supabase.from('rounds').select('*').limit(1);
  if (rounds && rounds[0]) console.log('Columns:', Object.keys(rounds[0]));
}

checkSchema();
