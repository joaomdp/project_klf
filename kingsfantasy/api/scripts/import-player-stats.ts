/**
 * Import Player Stats from CSV
 * 
 * Imports player performance data from CSV file into the database.
 * CSV format: partida_id,data,time1,time2,jogador,campeao,kills,deaths,assists,cs,first_blood,triple_kill,quadra_kill,penta_kill
 */

import { supabase } from '../src/config/supabase';
import { scoringService } from '../src/services/scoring.service';
import * as fs from 'fs';
import * as path from 'path';

interface CSVPlayerStat {
  partida_id: string;
  data: string;
  time1: string;
  time2: string;
  jogador: string;
  campeao: string;
  kills: string;
  deaths: string;
  assists: string;
  cs: string;
  first_blood: string;
  triple_kill: string;
  quadra_kill: string;
  penta_kill: string;
}

async function importPlayerStats(csvPath: string) {
  console.log('📥 Importando Estatísticas dos Jogadores\n');
  console.log('=' + '='.repeat(59));
  console.log(`Arquivo: ${csvPath}`);
  console.log('=' + '='.repeat(59));
  console.log('');

  // Verificar se arquivo existe
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Arquivo não encontrado: ${csvPath}`);
    process.exit(1);
  }

  // Ler arquivo CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => 
    line.trim() && !line.trim().startsWith('#')
  );

  // Pular cabeçalho
  const dataLines = lines.slice(1);

  if (dataLines.length === 0) {
    console.error('❌ Nenhuma estatística encontrada no CSV');
    process.exit(1);
  }

  console.log(`✅ Encontradas ${dataLines.length} performances no CSV\n`);

  // Buscar jogadores do banco
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name, team_id');

  if (playersError || !players) {
    console.error('❌ Erro ao buscar jogadores:', playersError?.message);
    process.exit(1);
  }

  const playerMap = new Map(players.map(p => [p.name.toLowerCase().trim(), p]));
  console.log(`✅ ${players.length} jogadores carregados do banco\n`);

  // Buscar times do banco
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name');

  if (teamsError || !teams) {
    console.error('❌ Erro ao buscar times:', teamsError?.message);
    process.exit(1);
  }

  const teamMap = new Map(teams.map(t => [t.name.toLowerCase().trim(), t.id]));

  // Buscar campeões do banco
  const { data: champions, error: championsError } = await supabase
    .from('champions')
    .select('id, key_name, name');

  if (championsError) {
    console.warn('⚠️  Erro ao buscar campeões:', championsError.message);
    console.log('   Continuando sem validação de campeões...\n');
  }

  const championMap = new Map(
    champions?.map(c => [c.key_name.toLowerCase().replace(/[^a-z0-9]/g, ''), c.id]) || []
  );

  // Processar cada performance
  let successCount = 0;
  let errorCount = 0;
  const matchStatsMap = new Map<string, CSVPlayerStat[]>();

  // Agrupar stats por partida
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;

    const parts = line.split(',').map(p => p.trim());
    
    if (parts.length < 14) {
      console.error(`❌ Linha ${i + 2}: Formato inválido (esperado 14 campos, encontrado ${parts.length})`);
      errorCount++;
      continue;
    }

    const stat: CSVPlayerStat = {
      partida_id: parts[0],
      data: parts[1],
      time1: parts[2],
      time2: parts[3],
      jogador: parts[4],
      campeao: parts[5],
      kills: parts[6],
      deaths: parts[7],
      assists: parts[8],
      cs: parts[9],
      first_blood: parts[10],
      triple_kill: parts[11],
      quadra_kill: parts[12],
      penta_kill: parts[13]
    };

    const matchKey = `${stat.data}|${stat.time1}|${stat.time2}`;
    if (!matchStatsMap.has(matchKey)) {
      matchStatsMap.set(matchKey, []);
    }
    matchStatsMap.get(matchKey)!.push(stat);
  }

  console.log(`✅ ${matchStatsMap.size} partidas com estatísticas\n`);

  // Processar cada partida
  for (const [matchKey, stats] of matchStatsMap) {
    const [matchDate, team1Name, team2Name] = matchKey.split('|');
    
    console.log(`\n📋 Processando: ${team1Name} vs ${team2Name}`);
    console.log(`   Data: ${matchDate}`);
    console.log(`   ${stats.length} performances`);
    console.log('-'.repeat(60));

    // Buscar partida no banco
    const team1Id = teamMap.get(team1Name.toLowerCase().trim());
    const team2Id = teamMap.get(team2Name.toLowerCase().trim());

    if (!team1Id || !team2Id) {
      console.error(`❌ Times não encontrados: ${team1Name} ou ${team2Name}`);
      errorCount += stats.length;
      continue;
    }

    // Buscar partida por times e data aproximada
    const matchDateObj = new Date(matchDate);
    const startDate = new Date(matchDateObj);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(matchDateObj);
    endDate.setHours(23, 59, 59, 999);

    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .or(`and(team_a_id.eq.${team1Id},team_b_id.eq.${team2Id}),and(team_a_id.eq.${team2Id},team_b_id.eq.${team1Id})`)
      .gte('scheduled_time', startDate.toISOString())
      .lte('scheduled_time', endDate.toISOString())
      .limit(1);

    if (matchError || !matches || matches.length === 0) {
      console.error(`❌ Partida não encontrada no banco`);
      console.error(`   Dica: Importe as partidas primeiro usando import-matches.ts`);
      errorCount += stats.length;
      continue;
    }

    const match = matches[0];
    console.log(`✅ Partida encontrada (ID: ${match.id})`);

    // Inserir cada performance
    for (const stat of stats) {
      const player = playerMap.get(stat.jogador.toLowerCase().trim());

      if (!player) {
        console.error(`   ❌ Jogador não encontrado: ${stat.jogador}`);
        errorCount++;
        continue;
      }

      // Determinar se é vencedor
      const playerTeamId = player.team_id;
      const isWinner = playerTeamId === match.winner_id;

      // Buscar campeão
      const championKeyNormalized = stat.campeao.toLowerCase().replace(/[^a-z0-9]/g, '');
      let championId = championMap.get(championKeyNormalized);

      // Se não encontrou, criar campeão temporário
      if (!championId && stat.campeao) {
        const { data: newChampion, error: champError } = await supabase
          .from('champions')
          .insert({
            key_name: stat.campeao,
            name: stat.campeao,
            image_url: `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${stat.campeao}.png`
          })
          .select()
          .single();

        if (!champError && newChampion) {
          championId = newChampion.id;
          championMap.set(championKeyNormalized, championId);
          console.log(`   ℹ️  Campeão criado: ${stat.campeao}`);
        }
      }

      // Parsear estatísticas
      const kills = parseInt(stat.kills);
      const deaths = parseInt(stat.deaths);
      const assists = parseInt(stat.assists);
      const cs = parseInt(stat.cs);
      const firstBlood = parseInt(stat.first_blood) === 1;
      const tripleKill = parseInt(stat.triple_kill) === 1;
      const quadraKill = parseInt(stat.quadra_kill) === 1;
      const pentaKill = parseInt(stat.penta_kill) === 1;

      // Calcular pontos
      const points = await scoringService.calculateBasePoints({
        kills,
        deaths,
        assists,
        cs
      });

      // Inserir performance
      const { error: perfError } = await supabase
        .from('player_performances')
        .insert({
          player_id: player.id,
          match_id: match.id,
          round_id: match.round_id,
          champion_id: championId,
          kills,
          deaths,
          assists,
          cs,
          first_blood: firstBlood,
          triple_kill: tripleKill,
          quadra_kill: quadraKill,
          penta_kill: pentaKill,
          is_winner: isWinner,
          fantasy_points: points
        });

      if (perfError) {
        console.error(`   ❌ ${stat.jogador}: ${perfError.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ ${stat.jogador} (${stat.campeao}): ${kills}/${deaths}/${assists} - ${points.toFixed(1)} pts`);
        successCount++;
      }
    }
  }

  // Resumo
  console.log('\n' + '=' + '='.repeat(59));
  console.log('📊 RESUMO DA IMPORTAÇÃO');
  console.log('=' + '='.repeat(59));
  console.log(`✅ Performances importadas: ${successCount}`);
  console.log(`❌ Erros: ${errorCount}`);
  console.log(`📋 Total processado: ${dataLines.length}`);

  if (successCount > 0) {
    console.log('\n✅ Estatísticas importadas com sucesso!');
    console.log('\n📋 Próximo passo:');
    console.log(`   Atualizar pontuações médias dos jogadores:`);
    console.log(`   cd api && npx tsx scripts/update-player-stats.ts`);
  }
}

// Argumentos da linha de comando
const csvPath = process.argv[2];

if (!csvPath) {
  console.error('❌ Uso: npx tsx scripts/import-player-stats.ts <arquivo.csv>');
  console.error('\nExemplo:');
  console.error('  npx tsx scripts/import-player-stats.ts ../data/season1/player_stats.csv');
  process.exit(1);
}

importPlayerStats(csvPath).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
