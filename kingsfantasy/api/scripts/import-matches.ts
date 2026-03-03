/**
 * Import Matches from CSV
 * 
 * Imports match data from CSV file into the database.
 * CSV format: data,time1,time2,placar1,placar2,vencedor
 */

import { supabase } from '../src/config/supabase';
import * as fs from 'fs';
import * as path from 'path';

interface CSVMatch {
  data: string;
  time1: string;
  time2: string;
  placar1: string;
  placar2: string;
  vencedor: string;
}

interface ImportedMatch {
  id: string;
  team_a_id: string;
  team_b_id: string;
  scheduled_time: string;
  winner_id: string | null;
}

async function importMatches(csvPath: string, roundNumber: number = 1, season: number = 1) {
  console.log('📥 Importando Partidas do CSV\n');
  console.log('=' + '='.repeat(59));
  console.log(`Arquivo: ${csvPath}`);
  console.log(`Round: ${roundNumber}`);
  console.log(`Season: ${season}`);
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
    console.error('❌ Nenhuma partida encontrada no CSV');
    process.exit(1);
  }

  console.log(`✅ Encontradas ${dataLines.length} partidas no CSV\n`);

  // Buscar times do banco
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name');

  if (teamsError || !teams) {
    console.error('❌ Erro ao buscar times:', teamsError?.message);
    process.exit(1);
  }

  const teamMap = new Map(teams.map(t => [t.name.toLowerCase().trim(), t.id]));
  console.log(`✅ ${teams.length} times carregados do banco\n`);

  // Buscar ou criar round
  let { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('*')
    .eq('season', season)
    .eq('round_number', roundNumber)
    .single();

  if (!round) {
    console.log(`⏳ Criando round ${roundNumber} da season ${season}...`);
    
    // Usar a data da primeira partida como start_date
    const firstMatchDate = new Date(dataLines[0].split(',')[0].trim());
    const marketCloseTime = new Date(firstMatchDate);
    marketCloseTime.setHours(marketCloseTime.getHours() - 1); // Mercado fecha 1h antes
    
    const { data: newRound, error: createError } = await supabase
      .from('rounds')
      .insert({
        season,
        round_number: roundNumber,
        start_date: firstMatchDate.toISOString(),
        end_date: firstMatchDate.toISOString(),
        market_close_time: marketCloseTime.toISOString(),
        status: 'upcoming',
        is_market_open: false
      })
      .select()
      .single();

    if (createError || !newRound) {
      console.error('❌ Erro ao criar round:', createError?.message);
      process.exit(1);
    }

    round = newRound;
    console.log(`✅ Round criado: ${round.id}\n`);
  } else {
    console.log(`✅ Usando round existente: ${round.id}\n`);
  }

  // Processar cada partida
  const importedMatches: ImportedMatch[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;

    const parts = line.split(',').map(p => p.trim());
    
    if (parts.length < 6) {
      console.error(`❌ Linha ${i + 2}: Formato inválido (esperado 6 campos)`);
      errorCount++;
      continue;
    }

    const match: CSVMatch = {
      data: parts[0],
      time1: parts[1],
      time2: parts[2],
      placar1: parts[3],
      placar2: parts[4],
      vencedor: parts[5]
    };

    console.log(`\n📋 Partida ${i + 1}/${dataLines.length}`);
    console.log('-'.repeat(60));
    console.log(`${match.time1} ${match.placar1} x ${match.placar2} ${match.time2}`);
    console.log(`Data: ${match.data}`);
    console.log(`Vencedor: ${match.vencedor}`);

    // Validar times
    const team1Id = teamMap.get(match.time1.toLowerCase().trim());
    const team2Id = teamMap.get(match.time2.toLowerCase().trim());
    const winnerId = teamMap.get(match.vencedor.toLowerCase().trim());

    if (!team1Id) {
      console.error(`❌ Time não encontrado: ${match.time1}`);
      errorCount++;
      continue;
    }

    if (!team2Id) {
      console.error(`❌ Time não encontrado: ${match.time2}`);
      errorCount++;
      continue;
    }

    if (!winnerId) {
      console.error(`❌ Vencedor não encontrado: ${match.vencedor}`);
      errorCount++;
      continue;
    }

    // Validar placar
    const placar1 = parseInt(match.placar1);
    const placar2 = parseInt(match.placar2);

    if (isNaN(placar1) || isNaN(placar2)) {
      console.error(`❌ Placar inválido: ${match.placar1} x ${match.placar2}`);
      errorCount++;
      continue;
    }

    // Validar vencedor
    if (placar1 > placar2 && winnerId !== team1Id) {
      console.error(`❌ Vencedor incorreto: placar indica ${match.time1} mas vencedor é ${match.vencedor}`);
      errorCount++;
      continue;
    }

    if (placar2 > placar1 && winnerId !== team2Id) {
      console.error(`❌ Vencedor incorreto: placar indica ${match.time2} mas vencedor é ${match.vencedor}`);
      errorCount++;
      continue;
    }

    // Parsear data
    let matchDate: Date;
    try {
      matchDate = new Date(match.data);
      if (isNaN(matchDate.getTime())) {
        throw new Error('Data inválida');
      }
    } catch (error) {
      console.error(`❌ Data inválida: ${match.data}`);
      errorCount++;
      continue;
    }

    // Inserir partida
    const { data: insertedMatch, error: insertError } = await supabase
      .from('matches')
      .insert({
        round_id: round.id,
        team_a_id: team1Id,
        team_b_id: team2Id,
        scheduled_time: matchDate.toISOString(),
        winner_id: winnerId,
        status: 'completed'
      })
      .select()
      .single();

    if (insertError || !insertedMatch) {
      console.error(`❌ Erro ao inserir partida:`, insertError?.message);
      errorCount++;
      continue;
    }

    console.log(`✅ Partida importada com sucesso (ID: ${insertedMatch.id})`);
    importedMatches.push(insertedMatch);
    successCount++;
  }

  // Resumo
  console.log('\n' + '=' + '='.repeat(59));
  console.log('📊 RESUMO DA IMPORTAÇÃO');
  console.log('=' + '='.repeat(59));
  console.log(`✅ Partidas importadas: ${successCount}`);
  console.log(`❌ Erros: ${errorCount}`);
  console.log(`📋 Total processado: ${dataLines.length}`);

  if (importedMatches.length > 0) {
    console.log('\n✅ Partidas criadas com sucesso!');
    console.log('\n📋 Próximo passo:');
    console.log(`   Importe as estatísticas dos jogadores:`);
    console.log(`   cd api && npx tsx scripts/import-player-stats.ts ../data/season1/player_stats.csv`);
  }

  // Salvar IDs das partidas para referência
  const idsFile = path.join(path.dirname(csvPath), 'match_ids.json');
  fs.writeFileSync(idsFile, JSON.stringify(importedMatches, null, 2));
  console.log(`\n💾 IDs salvos em: ${idsFile}`);
}

// Argumentos da linha de comando
const csvPath = process.argv[2];
const roundNumber = parseInt(process.argv[3] || '1');
const season = parseInt(process.argv[4] || '1');

if (!csvPath) {
  console.error('❌ Uso: npx tsx scripts/import-matches.ts <arquivo.csv> [round] [season]');
  console.error('\nExemplo:');
  console.error('  npx tsx scripts/import-matches.ts ../data/season1/matches.csv 1 1');
  process.exit(1);
}

importMatches(csvPath, roundNumber, season).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
