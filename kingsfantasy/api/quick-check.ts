import { supabase } from './src/config/supabase';
async function quickCheck() {
  console.log('🔍 VERIFICAÇÃO RÁPIDA DO BANCO\n');
  
  // 1. TIMES
  console.log('═══ TIMES ═══');
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, short_name, logo_url')
    .order('id');
  
  if (teamsError) {
    console.error('❌ Erro:', teamsError.message);
  } else {
    console.log(`Total: ${teams?.length || 0} times\n`);
    teams?.forEach((team: any) => {
      console.log(`${team.id}. ${team.name} (${team.short_name || 'N/A'})`);
      console.log(`   Logo: ${team.logo_url || 'N/A'}\n`);
    });
  }
  
  // 2. JOGADORES (amostra)
  console.log('\n═══ JOGADORES (Primeiros 5) ═══');
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name, role, team_id, price, points, kda, image')
    .limit(5);
  
  if (playersError) {
    console.error('❌ Erro:', playersError.message);
  } else {
    players?.forEach((player: any) => {
      console.log(`${player.name} (${player.role}) - Time: ${player.team_id}`);
      console.log(`   Price: ${player.price} | Points: ${player.points} | KDA: ${player.kda}`);
      console.log(`   Image: ${player.image || 'N/A'}\n`);
    });
  }
  
  // 3. CAMPEÕES
  console.log('\n═══ CAMPEÕES ═══');
  const { count: championsCount } = await supabase
    .from('champions')
    .select('*', { count: 'exact', head: true });
  console.log(`Total: ${championsCount || 0} campeões\n`);
  
  // 4. RODADAS
  console.log('═══ RODADAS ═══');
  const { count: roundsCount } = await supabase
    .from('rounds')
    .select('*', { count: 'exact', head: true });
  console.log(`Total: ${roundsCount || 0} rodadas\n`);
  
  // 5. LIGAS
  console.log('═══ LIGAS ═══');
  const { data: leagues, error: leaguesError } = await supabase
    .from('leagues')
    .select('id, name, code, is_public, is_verified')
    .order('id');
  
  if (leaguesError) {
    console.error('❌ Erro:', leaguesError.message);
  } else {
    console.log(`Total: ${leagues?.length || 0} ligas\n`);
    leagues?.forEach((league: any) => {
      console.log(`- ${league.name} (${league.code}) - ${league.is_verified ? '✓ Verificada' : 'Não verificada'}`);
    });
  }
  
  // 6. SYSTEM_CONFIG
  console.log('\n═══ CONFIGURAÇÕES ═══');
  const { data: configs } = await supabase
    .from('system_config')
    .select('key, value')
    .order('key');
  
  if (configs && configs.length > 0) {
    console.log(`Total: ${configs.length} configurações\n`);
    configs.forEach((config: any) => {
      console.log(`- ${config.key}: ${config.value}`);
    });
  } else {
    console.log('Total: 0 configurações\n');
  }
  
  console.log('\n✅ Verificação concluída!');
}
quickCheck().catch(console.error);