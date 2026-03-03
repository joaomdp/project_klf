/**
 * Auto Import IDL Round
 * 
 * Automatically imports a complete round of IDL Kings Lendas from Riot API.
 * 
 * Usage:
 *   npm run import-round -- --season 1 --round 1 --start 2024-01-15 --end 2024-01-15
 * 
 * Arguments:
 *   --season <number>  : Season number (e.g., 1, 4)
 *   --round <number>   : Round number (e.g., 1, 2, 3)
 *   --start <date>     : Start date (YYYY-MM-DD)
 *   --end <date>       : End date (YYYY-MM-DD)
 * 
 * Examples:
 *   # Import round 1 of season 1 (single day)
 *   npm run import-round -- --season 1 --round 1 --start 2024-01-15 --end 2024-01-15
 * 
 *   # Import round 2 of season 1 (date range)
 *   npm run import-round -- --season 1 --round 2 --start 2024-01-20 --end 2024-01-22
 */

import { idlImporterService } from '../src/services/idl-importer.service';

// Parse command line arguments
function parseArgs(): {
  season: number;
  round: number;
  startDate: Date;
  endDate: Date;
} {
  const args = process.argv.slice(2);
  
  let season: number | undefined;
  let round: number | undefined;
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--season' && i + 1 < args.length) {
      season = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--round' && i + 1 < args.length) {
      round = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--start' && i + 1 < args.length) {
      startDate = new Date(args[i + 1]);
      startDate.setHours(0, 0, 0, 0);
      i++;
    } else if (arg === '--end' && i + 1 < args.length) {
      endDate = new Date(args[i + 1]);
      endDate.setHours(23, 59, 59, 999);
      i++;
    }
  }

  // Validate required arguments
  if (!season || !round || !startDate || !endDate) {
    console.error('\n❌ Argumentos inválidos!\n');
    console.error('Uso:');
    console.error('  npm run import-round -- --season <num> --round <num> --start <YYYY-MM-DD> --end <YYYY-MM-DD>\n');
    console.error('Exemplo:');
    console.error('  npm run import-round -- --season 1 --round 1 --start 2024-01-15 --end 2024-01-15\n');
    process.exit(1);
  }

  // Validate dates
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error('\n❌ Datas inválidas! Use o formato YYYY-MM-DD\n');
    process.exit(1);
  }

  if (endDate < startDate) {
    console.error('\n❌ Data final não pode ser anterior à data inicial\n');
    process.exit(1);
  }

  return { season, round, startDate, endDate };
}

async function main() {
  console.log('\n🚀 ===== IDL KINGS LENDAS - AUTO IMPORT =====\n');

  try {
    const { season, round, startDate, endDate } = parseArgs();

    console.log('📋 Configuração:');
    console.log(`   Season: ${season}`);
    console.log(`   Rodada: ${round}`);
    console.log(`   Período: ${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`);
    console.log();

    // Confirm before proceeding
    console.log('⚠️  ATENÇÃO: Este script irá:');
    console.log('   1. Buscar partidas na Riot API');
    console.log('   2. Criar/atualizar a rodada no banco');
    console.log('   3. Importar todas as partidas encontradas');
    console.log('   4. Calcular fantasy points automaticamente');
    console.log('   5. Atualizar estatísticas dos jogadores');
    console.log();
    console.log('   Aguarde 5 segundos para cancelar (Ctrl+C)...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Execute import
    const result = await idlImporterService.importRound(
      season,
      round,
      startDate,
      endDate
    );

    // Display results
    console.log('\n📊 ===== RESULTADO DA IMPORTAÇÃO =====\n');
    
    if (result.success) {
      console.log('✅ Importação concluída com sucesso!\n');
      console.log(`🎮 Partidas importadas: ${result.matchesImported}`);
      console.log(`👤 Performances importadas: ${result.performancesImported}`);
      console.log(`📋 Round ID: ${result.roundId}\n`);

      if (result.matches.length > 0) {
        console.log('📋 Partidas:\n');
        result.matches.forEach((match, index) => {
          console.log(`   ${index + 1}. ${match.team1} vs ${match.team2}`);
          console.log(`      Vencedor: ${match.winner}\n`);
        });
      }

      if (result.errors.length > 0) {
        console.log(`⚠️  ${result.errors.length} aviso(s):\n`);
        result.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
        console.log();
      }

    } else {
      console.log('❌ Importação falhou!\n');
      console.log(`Erros: ${result.errors.length}`);
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      console.log();
      process.exit(1);
    }

    console.log('====================================\n');
    console.log('✅ Processo concluído!\n');

  } catch (error: any) {
    console.error('\n❌ ERRO CRÍTICO:', error.message);
    console.error('\nStack trace:', error.stack);
    console.error('\n💡 Possíveis causas:');
    console.error('   1. Riot API Key inválida ou expirada');
    console.error('   2. Conexão com banco de dados falhou');
    console.error('   3. Nomes de jogadores no banco não correspondem aos nomes in-game');
    console.error('   4. Nenhuma partida encontrada no período especificado\n');
    process.exit(1);
  }
}

main();
