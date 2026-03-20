/**
 * IDL Importer Service
 * 
 * Orchestrates the complete automated import flow for IDL Kings Lendas matches.
 * 
 * Flow:
 * 1. Create/find round in database
 * 2. Find tournament matches using Match Finder
 * 3. Insert matches into database
 * 4. Insert player performances
 * 5. Calculate fantasy points for each performance
 * 6. Update player statistics
 */

import { supabase } from '../config/supabase';
import { matchFinderService, TournamentMatch } from './match-finder.service';
import { scoringService } from './scoring.service';

export interface ImportResult {
  success: boolean;
  roundId: number;
  roundNumber: number;
  season: number;
  matchesImported: number;
  performancesImported: number;
  errors: string[];
  matches: Array<{
    matchId: number;
    team1: string;
    team2: string;
    winner: string;
  }>;
}

class IDLImporterService {
  /**
   * Import a complete round of IDL Kings Lendas
   * 
   * @param season - Season number (e.g., 1)
   * @param round - Round number (e.g., 1, 2, 3)
   * @param startDate - Start date for match search
   * @param endDate - End date for match search
   */
  async importRound(
    season: number,
    round: number,
    startDate: Date,
    endDate: Date
  ): Promise<ImportResult> {
    console.log(`\n📥 ===== IMPORTANDO RODADA ${round} - SEASON ${season} =====\n`);
    
    const errors: string[] = [];
    const importedMatches: Array<{
      matchId: number;
      team1: string;
      team2: string;
      winner: string;
    }> = [];

    try {
      // Step 1: Find or create round
      console.log('📋 Criando/buscando rodada...');
      const roundId = await this.findOrCreateRound(season, round);
      console.log(`✅ Round ID: ${roundId}\n`);

      // Step 2: Find tournament matches
      console.log('🔍 Buscando partidas do torneio via Riot API...');
      const tournamentMatches = await matchFinderService.findMatches(startDate, endDate);
      
      if (tournamentMatches.length === 0) {
        console.warn('⚠️  Nenhuma partida encontrada no período especificado');
        return {
          success: false,
          roundId,
          roundNumber: round,
          season,
          matchesImported: 0,
          performancesImported: 0,
          errors: ['Nenhuma partida encontrada no período especificado'],
          matches: []
        };
      }

      console.log(`✅ ${tournamentMatches.length} partidas encontradas\n`);

      // Step 3: Import each match
      let totalPerformances = 0;

      for (const match of tournamentMatches) {
        try {
          console.log(`\n⏳ Importando: ${match.team1.name} vs ${match.team2.name}...`);
          
          const matchId = await this.importMatch(roundId, match);
          
          importedMatches.push({
            matchId,
            team1: match.team1.name,
            team2: match.team2.name,
            winner: match.winner.name
          });

          totalPerformances += 10; // 5 players per team × 2 teams

          console.log(`✅ Match ID ${matchId} importada com sucesso`);
          
        } catch (error: any) {
          const errorMsg = `Erro ao importar partida ${match.team1.name} vs ${match.team2.name}: ${error.message}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Step 4: Update player statistics for this round
      console.log(`\n📊 Atualizando estatísticas dos jogadores...`);
      await this.updatePlayerStats(roundId);
      console.log(`✅ Estatísticas atualizadas\n`);

      // Final summary
      console.log(`\n✅ ===== IMPORTAÇÃO CONCLUÍDA =====`);
      console.log(`📊 Rodada: ${round} | Season: ${season}`);
      console.log(`🎮 Partidas importadas: ${importedMatches.length}/${tournamentMatches.length}`);
      console.log(`👤 Performances importadas: ${totalPerformances}`);
      if (errors.length > 0) {
        console.log(`⚠️  Erros: ${errors.length}`);
      }
      console.log(`====================================\n`);

      return {
        success: errors.length < tournamentMatches.length, // Success if at least 1 match imported
        roundId,
        roundNumber: round,
        season,
        matchesImported: importedMatches.length,
        performancesImported: totalPerformances,
        errors,
        matches: importedMatches
      };

    } catch (error: any) {
      console.error(`\n❌ ERRO CRÍTICO NA IMPORTAÇÃO: ${error.message}\n`);
      throw error;
    }
  }

  /**
   * Find or create a round in the database
   */
  private async findOrCreateRound(season: number, roundNumber: number): Promise<number> {
    // Check if round exists
    const { data: existingRound } = await supabase
      .from('rounds')
      .select('id')
      .eq('season', season)
      .eq('round_number', roundNumber)
      .single();

    if (existingRound) {
      console.log(`   ✅ Rodada já existe (ID: ${existingRound.id})`);
      return existingRound.id;
    }

    // Create new round
    const { data: newRound, error } = await supabase
      .from('rounds')
      .insert({
        season,
        round_number: roundNumber,
        status: 'completed', // Auto-mark as completed since we're importing historical data
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Erro ao criar rodada: ${error.message}`);
    }

    console.log(`   ✅ Rodada criada (ID: ${newRound.id})`);
    return newRound.id;
  }

  /**
   * Import a single match and all player performances
   */
  private async importMatch(roundId: number, match: TournamentMatch): Promise<number> {
    // Check if match already exists (by riot_match_id)
    const { data: existingMatch } = await supabase
      .from('matches')
      .select('id')
      .eq('riot_match_id', match.riotMatchId)
      .single();

    if (existingMatch) {
      console.log(`   ⚠️  Match já existe (ID: ${existingMatch.id}), pulando...`);
      return existingMatch.id;
    }

    // Insert match
    const { data: newMatch, error: matchError } = await supabase
      .from('matches')
      .insert({
        round_id: roundId,
        team_a_id: match.team1.id,
        team_b_id: match.team2.id,
        winner_id: match.winner.id,
        scheduled_time: match.gameCreation.toISOString(),
        status: 'completed',
        riot_match_id: match.riotMatchId,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (matchError) {
      throw new Error(`Erro ao inserir match: ${matchError.message}`);
    }

    const matchId = newMatch.id;
    console.log(`   ✅ Match inserida (ID: ${matchId})`);

    // Insert all player performances (10 total)
    const allPlayers = [...match.team1.players, ...match.team2.players];

    for (const player of allPlayers) {
      await this.importPlayerPerformance(matchId, player);
    }

    console.log(`   ✅ 10 performances inseridas`);

    return matchId;
  }

  /**
   * Import a single player performance
   */
  private async importPlayerPerformance(
    matchId: number,
    player: any
  ): Promise<void> {
    // Get or create champion
    const championId = await this.getOrCreateChampion(player.championId, player.championName);

    // Calculate fantasy points
    const scoreResult = await scoringService.calculatePerformanceScore({
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      cs: player.cs
    });

    // Insert performance
    const { error } = await supabase
      .from('player_performances')
      .insert({
        match_id: matchId,
        player_id: player.id,
        champion_id: championId,
        kills: player.kills,
        deaths: player.deaths,
        assists: player.assists,
        cs: player.cs,
        first_blood: player.firstBlood,
        triple_kill: player.tripleKill,
        quadra_kill: player.quadraKill,
        penta_kill: player.pentaKill,
        fantasy_points: scoreResult.finalScore,
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Erro ao inserir performance de ${player.name}: ${error.message}`);
    }
  }

  /**
   * Get or create champion in database
   */
  private async getOrCreateChampion(riotChampionId: number, championName: string): Promise<number> {
    // Check if champion exists
    const { data: existingChampion } = await supabase
      .from('champions')
      .select('id')
      .eq('riot_id', riotChampionId)
      .single();

    if (existingChampion) {
      return existingChampion.id;
    }

    // Create champion
    const { data: newChampion, error } = await supabase
      .from('champions')
      .insert({
        name: championName,
        riot_id: riotChampionId,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Erro ao criar campeão ${championName}: ${error.message}`);
    }

    console.log(`   ✅ Campeão criado: ${championName} (ID: ${newChampion.id})`);
    return newChampion.id;
  }

  /**
   * Update player statistics after importing a round
   */
  private async updatePlayerStats(roundId: number): Promise<void> {
    // Get players that participated in this round's matches
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id')
      .eq('round_id', roundId);

    if (matchesError || !matches) {
      throw new Error(`Erro ao buscar matches: ${matchesError?.message}`);
    }

    const matchIds = matches.map(m => m.id);

    if (matchIds.length === 0) {
      console.log('   ⚠️  Nenhuma match encontrada para atualizar estatísticas');
      return;
    }

    // Get player IDs from this round
    const { data: roundPerfs, error: roundPerfError } = await supabase
      .from('player_performances')
      .select('player_id')
      .in('match_id', matchIds);

    if (roundPerfError || !roundPerfs) {
      throw new Error(`Erro ao buscar performances: ${roundPerfError?.message}`);
    }

    const playerIds = Array.from(new Set(roundPerfs.map(p => p.player_id)));

    if (playerIds.length === 0) {
      console.log('   ⚠️  Nenhum jogador encontrado para atualizar');
      return;
    }

    // Get ALL performances of these players (across all rounds)
    const { data: allPerformances, error: allPerfError } = await supabase
      .from('player_performances')
      .select('player_id, fantasy_points')
      .in('player_id', playerIds);

    if (allPerfError || !allPerformances) {
      throw new Error(`Erro ao buscar todas as performances: ${allPerfError?.message}`);
    }

    // Group by player and calculate cumulative stats
    const playerStats = new Map<string, { totalPoints: number; count: number }>();

    for (const perf of allPerformances) {
      const existing = playerStats.get(perf.player_id) || { totalPoints: 0, count: 0 };
      existing.totalPoints += perf.fantasy_points || 0;
      existing.count += 1;
      playerStats.set(perf.player_id, existing);
    }

    // Update each player's statistics with cumulative data
    for (const [playerId, stats] of playerStats) {
      const avgPoints = stats.count > 0 ? stats.totalPoints / stats.count : 0;

      const { error: updateError } = await supabase
        .from('players')
        .update({
          total_points: stats.totalPoints,
          avg_points: avgPoints,
          games_played: stats.count
        })
        .eq('id', playerId);

      if (updateError) {
        console.error(`   ⚠️  Erro ao atualizar stats do jogador ${playerId}: ${updateError.message}`);
      }
    }

    console.log(`   ✅ ${playerStats.size} jogadores atualizados (dados cumulativos)`);
  }

  /**
   * Import multiple rounds in sequence
   */
  async importMultipleRounds(
    roundsConfig: Array<{
      season: number;
      round: number;
      startDate: Date;
      endDate: Date;
    }>
  ): Promise<ImportResult[]> {
    console.log(`\n📥 ===== IMPORTAÇÃO EM LOTE: ${roundsConfig.length} RODADAS =====\n`);

    const results: ImportResult[] = [];

    for (const config of roundsConfig) {
      try {
        const result = await this.importRound(
          config.season,
          config.round,
          config.startDate,
          config.endDate
        );
        results.push(result);

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error: any) {
        console.error(`❌ Erro ao importar rodada ${config.round}: ${error.message}`);
        results.push({
          success: false,
          roundId: 0,
          roundNumber: config.round,
          season: config.season,
          matchesImported: 0,
          performancesImported: 0,
          errors: [error.message],
          matches: []
        });
      }
    }

    // Final summary
    const totalSuccess = results.filter(r => r.success).length;
    const totalMatches = results.reduce((sum, r) => sum + r.matchesImported, 0);
    const totalPerformances = results.reduce((sum, r) => sum + r.performancesImported, 0);

    console.log(`\n✅ ===== IMPORTAÇÃO EM LOTE CONCLUÍDA =====`);
    console.log(`✅ Rodadas com sucesso: ${totalSuccess}/${roundsConfig.length}`);
    console.log(`🎮 Total de partidas: ${totalMatches}`);
    console.log(`👤 Total de performances: ${totalPerformances}`);
    console.log(`==========================================\n`);

    return results;
  }
}

export const idlImporterService = new IDLImporterService();
