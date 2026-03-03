/**
 * Find tournament matches in a date range.
 *
 * Usage:
 *   npm run find-tournament-matches
 *
 * Date range is set in this file.
 */

import dotenv from 'dotenv';
import path from 'path';
import { matchFinderService } from '../src/services/match-finder.service';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  try {
    const startDate = new Date('2025-10-11T00:00:00-03:00');
    const endDate = new Date('2025-11-23T23:59:59-03:00');

    const matches = await matchFinderService.findMatches(startDate, endDate);

    if (matches.length === 0) {
      console.log('\n⚠️  Nenhuma partida do torneio encontrada no período.');
      return;
    }

    console.log(`\n✅ ${matches.length} partida(s) encontradas:`);
    matches.forEach((match, index) => {
      console.log(`\n${index + 1}. ${match.team1.name} vs ${match.team2.name}`);
      console.log(`   Data: ${match.gameCreation.toLocaleString('pt-BR')}`);
      console.log(`   Vencedor: ${match.winner.name}`);
      console.log(`   Match ID: ${match.riotMatchId}`);
    });
  } catch (error: any) {
    console.error('\n❌ Erro ao buscar partidas:', error?.message || error);
    process.exit(1);
  }
}

main();
