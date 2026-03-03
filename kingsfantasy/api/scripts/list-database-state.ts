/**
 * List All Database Entities
 * 
 * Shows all teams and players currently in the database
 * to help understand what data we have
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

async function listAll() {
  console.log('📊 CURRENT DATABASE STATE\n');
  console.log('=' + '='.repeat(59));
  
  // Fetch teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .order('name');
  
  console.log(`\n🏆 TEAMS (${teams?.length || 0} total):`);
  console.log('=' + '='.repeat(59));
  teams?.forEach((t, idx) => {
    console.log(`${idx + 1}. ${t.name}`);
    console.log(`   ID: ${t.id}`);
  });
  
  // Fetch players grouped by team
  const { data: players } = await supabase
    .from('players')
    .select('id, name, role, team_id')
    .order('name');
  
  console.log(`\n\n👥 PLAYERS (${players?.length || 0} total):`);
  console.log('=' + '='.repeat(59));
  
  // Group by team
  const teamMap = new Map(teams?.map(t => [t.id, t.name]) || []);
  
  teams?.forEach(team => {
    const teamPlayers = players?.filter(p => p.team_id === team.id) || [];
    
    if (teamPlayers.length > 0) {
      console.log(`\n${team.name} (${teamPlayers.length} players):`);
      teamPlayers.forEach((p, idx) => {
        console.log(`  ${idx + 1}. ${p.name} - ${p.role}`);
        console.log(`     ID: ${p.id}`);
      });
    }
  });
  
  // Players without team
  const orphanPlayers = players?.filter(p => !p.team_id) || [];
  if (orphanPlayers.length > 0) {
    console.log(`\n❓ Players without team (${orphanPlayers.length}):`);
    orphanPlayers.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.name} - ${p.role}`);
      console.log(`     ID: ${p.id}`);
    });
  }
  
  console.log('\n' + '=' + '='.repeat(59));
  console.log('📋 Summary:');
  console.log(`   Teams: ${teams?.length || 0}`);
  console.log(`   Players: ${players?.length || 0}`);
  console.log(`   Players with team: ${players?.filter(p => p.team_id).length || 0}`);
  console.log(`   Players without team: ${orphanPlayers.length}`);
  console.log('=' + '='.repeat(59));
}

listAll().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
