/**
 * Test Riot API Connection
 * 
 * Tests the Riot API setup and tries to find one match from a specific date.
 * 
 * Usage:
 *   npm run test-riot-api
 */

import { riotAPIService } from '../src/services/riot-api.service';
import { matchFinderService } from '../src/services/match-finder.service';

async function main() {
  console.log('\n🔍 ===== TESTE DA RIOT API =====\n');

  try {
    // Step 1: Test API connection
    console.log('📡 Testando conexão com Riot API...');
    const isConnected = await riotAPIService.testConnection();
    
    if (!isConnected) {
      console.error('\n❌ Falha na conexão com Riot API');
      console.error('   Verifique se RIOT_API_KEY está configurado corretamente no .env');
      process.exit(1);
    }

    console.log('✅ Conexão bem-sucedida!\n');

    // Step 2: Test PUUID lookup for a known player
    console.log('👤 Testando busca de PUUID...');
    console.log('   Jogador: Yang (região BR1)');
    
    const puuid = await riotAPIService.getPUUID('Yang', 'BR1');
    
    if (!puuid) {
      console.error('❌ Não foi possível encontrar PUUID para Yang');
      console.error('   Verifique se o nome do jogador está correto');
      process.exit(1);
    }

    console.log(`✅ PUUID encontrado: ${puuid.substring(0, 20)}...\n`);

    // Step 3: Ask user for date range to test match finding
    console.log('🔍 Testando busca de partidas...');
    console.log('   Use uma data de uma partida conhecida para testar\n');
    
    // Example: Test with a 7-day window (user should adjust this)
    const testDate = new Date('2024-01-15'); // Example date - USER SHOULD CHANGE THIS
    const startDate = new Date(testDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(testDate);
    endDate.setHours(23, 59, 59, 999);

    console.log(`📅 Buscando partidas em: ${startDate.toLocaleDateString('pt-BR')}`);
    console.log(`   (Para testar com outra data, edite o arquivo test-riot-api.ts)\n`);

    // Step 4: Find matches
    const matches = await matchFinderService.findMatches(startDate, endDate);

    if (matches.length === 0) {
      console.log('⚠️  Nenhuma partida encontrada nesta data');
      console.log('   Isso pode significar:');
      console.log('   1. Não houve partidas do torneio neste dia');
      console.log('   2. A data está incorreta');
      console.log('   3. Os nomes dos jogadores no banco não correspondem aos nomes in-game');
      console.log('\n💡 Tente ajustar a data no arquivo test-riot-api.ts (linha 46)');
    } else {
      console.log(`\n✅ ${matches.length} partida(s) encontrada(s)!\n`);
      
      matches.forEach((match, index) => {
        console.log(`📋 Partida ${index + 1}:`);
        console.log(`   ${match.team1.name} vs ${match.team2.name}`);
        console.log(`   Vencedor: ${match.winner.name}`);
        console.log(`   Data: ${match.gameCreation.toLocaleString('pt-BR')}`);
        console.log(`   Match ID: ${match.riotMatchId}\n`);
      });
    }

    console.log('✅ ===== TESTE CONCLUÍDO COM SUCESSO =====\n');
    console.log('Próximo passo: Use o script auto-import-idl-round.ts para importar rodadas completas\n');

  } catch (error: any) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error('\nDetalhes:', error);
    process.exit(1);
  }
}

main();
