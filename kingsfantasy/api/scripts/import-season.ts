/**
 * Import Complete Season
 * 
 * Imports all rounds of a season automatically using the config file.
 * 
 * Usage:
 *   npm run import-season -- --season <number>
 * 
 * Example:
 *   npm run import-season -- --season 1
 * 
 * This script reads dates from api/config/idl-config.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { idlImporterService } from '../src/services/idl-importer.service';

interface RoundConfig {
  round: number;
  startDate: string;
  endDate: string;
  description: string;
}

interface SeasonConfig {
  name: string;
  rounds: RoundConfig[];
}

interface Config {
  seasons: {
    [key: string]: SeasonConfig;
  };
}

function loadConfig(): Config {
  const configPath = path.join(__dirname, '../config/idl-config.json');
  
  if (!fs.existsSync(configPath)) {
    console.error('\n❌ Arquivo de configuração não encontrado!');
    console.error(`   Esperado em: ${configPath}\n`);
    process.exit(1);
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error: any) {
    console.error('\n❌ Erro ao ler arquivo de configuração:', error.message);
    process.exit(1);
  }
}

function parseArgs(): { season: number } {
  const args = process.argv.slice(2);
  
  let season: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--season' && i + 1 < args.length) {
      season = parseInt(args[i + 1]);
      i++;
    }
  }

  if (!season) {
    console.error('\n❌ Argumento inválido!\n');
    console.error('Uso:');
    console.error('  npm run import-season -- --season <número>\n');
    console.error('Exemplo:');
    console.error('  npm run import-season -- --season 1\n');
    process.exit(1);
  }

  return { season };
}

async function main() {
  console.log('\n🚀 ===== IMPORTAÇÃO COMPLETA DE TEMPORADA =====\n');

  try {
    const { season } = parseArgs();
    const config = loadConfig();

    // Check if season exists in config
    const seasonKey = season.toString();
    if (!config.seasons[seasonKey]) {
      console.error(`\n❌ Season ${season} não encontrada no arquivo de configuração!`);
      console.error('\nSeasons disponíveis:');
      Object.keys(config.seasons).forEach(key => {
        console.error(`   - Season ${key}: ${config.seasons[key].name}`);
      });
      console.error();
      process.exit(1);
    }

    const seasonConfig = config.seasons[seasonKey];
    
    console.log(`📋 Temporada: ${seasonConfig.name}`);
    console.log(`📅 Total de rodadas: ${seasonConfig.rounds.length}`);
    console.log();

    // Display rounds to be imported
    console.log('📋 Rodadas a serem importadas:\n');
    seasonConfig.rounds.forEach((round, index) => {
      console.log(`   ${index + 1}. Rodada ${round.round}`);
      console.log(`      Data: ${round.startDate} a ${round.endDate}`);
      console.log(`      Descrição: ${round.description}`);
      console.log();
    });

    // Confirm before proceeding
    console.log('⚠️  ATENÇÃO: Este processo irá:');
    console.log(`   1. Importar ${seasonConfig.rounds.length} rodadas completas`);
    console.log('   2. Buscar partidas na Riot API para cada rodada');
    console.log('   3. Calcular fantasy points automaticamente');
    console.log('   4. Atualizar estatísticas dos jogadores');
    console.log();
    console.log('   Este processo pode levar vários minutos!');
    console.log('   Aguarde 5 segundos para cancelar (Ctrl+C)...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Prepare rounds for import
    const roundsToImport = seasonConfig.rounds.map(round => ({
      season,
      round: round.round,
      startDate: new Date(round.startDate + 'T00:00:00'),
      endDate: new Date(round.endDate + 'T23:59:59')
    }));

    // Execute batch import
    const results = await idlImporterService.importMultipleRounds(roundsToImport);

    // Display final summary
    console.log('\n📊 ===== RESUMO FINAL =====\n');

    const successCount = results.filter(r => r.success).length;
    const totalMatches = results.reduce((sum, r) => sum + r.matchesImported, 0);
    const totalPerformances = results.reduce((sum, r) => sum + r.performancesImported, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    console.log(`✅ Rodadas com sucesso: ${successCount}/${seasonConfig.rounds.length}`);
    console.log(`🎮 Total de partidas: ${totalMatches}`);
    console.log(`👤 Total de performances: ${totalPerformances}`);
    
    if (totalErrors > 0) {
      console.log(`⚠️  Total de erros: ${totalErrors}`);
    }

    console.log('\n📋 Detalhes por rodada:\n');

    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} Rodada ${result.roundNumber}:`);
      console.log(`   Partidas: ${result.matchesImported}`);
      console.log(`   Performances: ${result.performancesImported}`);
      
      if (result.errors.length > 0) {
        console.log(`   Erros: ${result.errors.length}`);
      }
      
      console.log();
    });

    console.log('====================================\n');

    if (successCount === seasonConfig.rounds.length) {
      console.log('✅ Importação completa concluída com sucesso!\n');
    } else {
      console.log('⚠️  Importação concluída com avisos. Verifique os erros acima.\n');
    }

  } catch (error: any) {
    console.error('\n❌ ERRO CRÍTICO:', error.message);
    console.error('\nStack trace:', error.stack);
    console.error('\n💡 Possíveis causas:');
    console.error('   1. Riot API Key inválida ou expirada');
    console.error('   2. Conexão com banco de dados falhou');
    console.error('   3. Arquivo de configuração inválido');
    console.error('   4. Datas incorretas no arquivo de configuração\n');
    process.exit(1);
  }
}

main();
