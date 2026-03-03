/**
 * Update Player Stats
 * 
 * Recalculates and updates player statistics based on their performances:
 * - Total points
 * - Average points per match
 * - KDA (Kill/Death/Assist ratio)
 */

import { supabase } from '../src/config/supabase';

interface PlayerStats {
  player_id: string;
  player_name: string;
  total_points: number;
  avg_points: number;
  matches_played: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  kda: number;
}

async function updatePlayerStats() {
  console.log('🔄 Atualizando Estatísticas dos Jogadores\n');
  console.log('=' + '='.repeat(59));

  // Buscar todas as performances
  const { data: performances, error: perfError } = await supabase
    .from('player_performances')
    .select('player_id, fantasy_points, kills, deaths, assists');

  if (perfError || !performances) {
    console.error('❌ Erro ao buscar performances:', perfError?.message);
    process.exit(1);
  }

  console.log(`✅ ${performances.length} performances encontradas\n`);

  // Agrupar por jogador
  const playerStatsMap = new Map<string, PlayerStats>();

  for (const perf of performances) {
    if (!playerStatsMap.has(perf.player_id)) {
      playerStatsMap.set(perf.player_id, {
        player_id: perf.player_id,
        player_name: '',
        total_points: 0,
        avg_points: 0,
        matches_played: 0,
        total_kills: 0,
        total_deaths: 0,
        total_assists: 0,
        kda: 0
      });
    }

    const stats = playerStatsMap.get(perf.player_id)!;
    stats.total_points += perf.fantasy_points || 0;
    stats.matches_played++;
    stats.total_kills += perf.kills || 0;
    stats.total_deaths += perf.deaths || 0;
    stats.total_assists += perf.assists || 0;
  }

  // Calcular médias e KDA
  for (const stats of playerStatsMap.values()) {
    stats.avg_points = stats.total_points / stats.matches_played;
    
    // KDA = (K + A) / D (se D = 0, considerar KDA = K + A)
    if (stats.total_deaths === 0) {
      stats.kda = stats.total_kills + stats.total_assists;
    } else {
      stats.kda = (stats.total_kills + stats.total_assists) / stats.total_deaths;
    }
  }

  // Buscar nomes dos jogadores
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name');

  if (playersError || !players) {
    console.error('❌ Erro ao buscar jogadores:', playersError?.message);
    process.exit(1);
  }

  const playerNameMap = new Map(players.map(p => [p.id, p.name]));

  // Atualizar cada jogador
  let successCount = 0;
  let errorCount = 0;

  console.log('⏳ Atualizando jogadores...\n');

  for (const [playerId, stats] of playerStatsMap) {
    stats.player_name = playerNameMap.get(playerId) || 'Unknown';

    const { error: updateError } = await supabase
      .from('players')
      .update({
        points: Math.round(stats.total_points),
        avg_points: Math.round(stats.avg_points * 10) / 10, // 1 casa decimal
        kda: Math.round(stats.kda * 100) / 100 // 2 casas decimais
      })
      .eq('id', playerId);

    if (updateError) {
      console.error(`❌ ${stats.player_name}: ${updateError.message}`);
      errorCount++;
    } else {
      console.log(
        `✅ ${stats.player_name.padEnd(15)} | ` +
        `${stats.matches_played} partidas | ` +
        `${Math.round(stats.total_points)} pts (avg: ${Math.round(stats.avg_points * 10) / 10}) | ` +
        `KDA: ${Math.round(stats.kda * 100) / 100}`
      );
      successCount++;
    }
  }

  // Resetar jogadores sem performances
  const playersWithoutPerf = players.filter(p => !playerStatsMap.has(p.id));

  if (playersWithoutPerf.length > 0) {
    console.log(`\n⏳ Resetando ${playersWithoutPerf.length} jogadores sem performances...`);

    for (const player of playersWithoutPerf) {
      const { error: resetError } = await supabase
        .from('players')
        .update({
          points: 0,
          avg_points: 0,
          kda: null
        })
        .eq('id', player.id);

      if (resetError) {
        console.error(`❌ ${player.name}: ${resetError.message}`);
      } else {
        console.log(`   ✅ ${player.name} - resetado para 0 pontos`);
      }
    }
  }

  // Resumo
  console.log('\n' + '=' + '='.repeat(59));
  console.log('📊 RESUMO');
  console.log('=' + '='.repeat(59));
  console.log(`✅ Jogadores atualizados: ${successCount}`);
  console.log(`❌ Erros: ${errorCount}`);
  console.log(`📋 Jogadores sem performances: ${playersWithoutPerf.length}`);

  if (successCount > 0) {
    console.log('\n✅ Estatísticas atualizadas com sucesso!');
  }
}

updatePlayerStats().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
