import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabase } from '../config/supabase';

/**
 * LEAGUEPEDIA SCRAPER SERVICE
 * 
 * ⚠️ DEPRECATED: This service is now superseded by the Leaguepedia Cargo API implementation.
 * Please use the following services instead:
 * - leaguepedia.service.ts: For fetching data from Leaguepedia using the official Cargo API
 * - auto-import.service.ts: For automated import of matches and player performances
 * - mapper.service.ts: For mapping Leaguepedia names to database IDs
 * 
 * This service is kept for backward compatibility with manual input methods.
 * The HTML scraping methods (fetchMatchSchedule, fetchMatchStats) are NOT implemented
 * and should not be used. Use the Cargo API instead.
 * 
 * Estrutura:
 * - fetchMatchSchedule: Busca agenda de partidas de uma rodada (DEPRECATED - use leaguepedia.service.getMatches)
 * - fetchMatchStats: Busca estatísticas detalhadas de uma partida (DEPRECATED - use leaguepedia.service.getPlayerStats)
 * - insertManualMatchData: Input manual de dados (STILL SUPPORTED for backward compatibility)
 * - updatePlayerPerformances: Atualiza performances dos jogadores no banco (STILL SUPPORTED)
 */

export interface MatchData {
  team_a: string;
  team_b: string;
  winner?: string;
  scheduled_time: string;
  leaguepedia_url: string;
}

export interface PlayerPerformance {
  player_name: string;
  champion: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold_earned: number;
  damage_dealt: number;
  wards_placed: number;
  first_blood: boolean;
  triple_kill: boolean;
  quadra_kill: boolean;
  penta_kill: boolean;
  is_winner: boolean;
}

class ScraperService {
  private baseUrl = 'https://lol.fandom.com';
  private seasonUrl = '/wiki/CBLOL/2024_Season/Split_1';

  /**
   * Busca a agenda de partidas de uma rodada específica
   */
  async fetchMatchSchedule(season: number, round: number): Promise<MatchData[]> {
    try {
      console.log(`🕷️  Scraping schedule for Season ${season}, Round ${round}...`);
      
      const url = `${this.baseUrl}${this.seasonUrl}/Schedule`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const matches: MatchData[] = [];

      // TODO: Implementar parser HTML da Leaguepedia
      // Por enquanto, retorna array vazio
      // A estrutura HTML da Leaguepedia varia, precisamos analisar a página específica

      console.log(`✅ Found ${matches.length} matches`);
      return matches;

    } catch (error) {
      console.error('❌ Error fetching match schedule:', error);
      throw new Error('Failed to fetch match schedule from Leaguepedia');
    }
  }

  /**
   * Busca estatísticas detalhadas de uma partida específica
   */
  async fetchMatchStats(matchUrl: string): Promise<PlayerPerformance[]> {
    try {
      console.log(`🕷️  Scraping match stats from: ${matchUrl}`);

      const response = await axios.get(matchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const performances: PlayerPerformance[] = [];

      // TODO: Implementar parser HTML da página de match
      // Estrutura típica: tabela com stats de cada jogador

      console.log(`✅ Scraped ${performances.length} player performances`);
      return performances;

    } catch (error) {
      console.error('❌ Error fetching match stats:', error);
      throw new Error('Failed to fetch match stats from Leaguepedia');
    }
  }

  /**
   * MÉTODO ALTERNATIVO: Input manual de dados
   * Para usar quando scraping não está disponível ou para testes
   */
  async insertManualMatchData(roundId: number, matchData: {
    team_a_id: string;
    team_b_id: string;
    winner_id: string;
    scheduled_time: string;
    performances: Array<{
      player_id: string;
      champion_name: string;
      kills: number;
      deaths: number;
      assists: number;
      cs: number;
      gold_earned?: number;
      damage_dealt?: number;
      wards_placed?: number;
      first_blood?: boolean;
      triple_kill?: boolean;
      quadra_kill?: boolean;
      penta_kill?: boolean;
    }>;
  }) {
    try {
      console.log(`📝 Inserting manual match data for round ${roundId}...`);

      // 1. Inserir a partida
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
          round_id: roundId,
          team_a_id: matchData.team_a_id,
          team_b_id: matchData.team_b_id,
          winner_id: matchData.winner_id,
          scheduled_time: matchData.scheduled_time,
          status: 'completed'
        })
        .select()
        .single();

      if (matchError) throw matchError;

      console.log(`✅ Match created: ${match.id}`);

      // 2. Inserir performances dos jogadores
      for (const perf of matchData.performances) {
        // Buscar champion_id pelo nome
        const { data: champion } = await supabase
          .from('champions')
          .select('id')
          .eq('name', perf.champion_name)
          .single();

        if (!champion) {
          console.warn(`⚠️  Champion not found: ${perf.champion_name}`);
          continue;
        }

        const { error: perfError } = await supabase
          .from('player_performances')
          .insert({
            match_id: match.id,
            player_id: perf.player_id,
            champion_id: champion.id,
            kills: perf.kills,
            deaths: perf.deaths,
            assists: perf.assists,
            cs: perf.cs,
            gold_earned: perf.gold_earned || 0,
            damage_dealt: perf.damage_dealt || 0,
            wards_placed: perf.wards_placed || 0,
            first_blood: perf.first_blood || false,
            triple_kill: perf.triple_kill || false,
            quadra_kill: perf.quadra_kill || false,
            penta_kill: perf.penta_kill || false,
            is_winner: await this.isPlayerOnWinningTeam(perf.player_id, matchData.winner_id, matchData.team_a_id, matchData.team_b_id)
          });

        if (perfError) {
          console.error(`❌ Error inserting performance:`, perfError);
        }
      }

      console.log(`✅ All performances inserted for match ${match.id}`);
      return match;

    } catch (error) {
      console.error('❌ Error inserting manual match data:', error);
      throw error;
    }
  }

  /**
   * Atualiza estatísticas acumuladas de um jogador
   */
  async updatePlayerStats(playerId: string) {
    try {
      // Buscar todas as performances do jogador
      const { data: performances, error } = await supabase
        .from('player_performances')
        .select('kills, deaths, assists')
        .eq('player_id', playerId);

      if (error) throw error;

      if (!performances || performances.length === 0) {
        console.log(`ℹ️  No performances found for player ${playerId}`);
        return;
      }

      // Calcular totais
      const totalKills = performances.reduce((sum, p) => sum + p.kills, 0);
      const totalDeaths = performances.reduce((sum, p) => sum + p.deaths, 0);
      const totalAssists = performances.reduce((sum, p) => sum + p.assists, 0);
      const gamesPlayed = performances.length;
      const currentKda = totalDeaths === 0 
        ? (totalKills + totalAssists).toFixed(2)
        : ((totalKills + totalAssists) / totalDeaths).toFixed(2);

      // Atualizar jogador
      const { error: updateError } = await supabase
        .from('players')
        .update({
          games_played: gamesPlayed,
          total_kills: totalKills,
          total_deaths: totalDeaths,
          total_assists: totalAssists,
          current_kda: parseFloat(currentKda),
          last_performance_update: new Date().toISOString()
        })
        .eq('id', playerId);

      if (updateError) throw updateError;

      console.log(`✅ Updated stats for player ${playerId}: ${gamesPlayed}G, ${currentKda} KDA`);

    } catch (error) {
      console.error(`❌ Error updating player stats:`, error);
      throw error;
    }
  }

  /**
   * Verifica se o jogador pertence ao time vencedor
   */
  private async isPlayerOnWinningTeam(
    playerId: string,
    winnerId: string,
    teamAId: string,
    teamBId: string
  ): Promise<boolean> {
    const { data: player } = await supabase
      .from('players')
      .select('team_id')
      .eq('id', playerId)
      .single();

    if (!player) return false;
    return String(player.team_id) === String(winnerId);
  }

  /**
   * Método auxiliar: Listar times disponíveis no banco
   */
  async listAvailableTeams() {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name')
      .order('name');

    if (error) throw error;
    return teams;
  }

  /**
   * Método auxiliar: Listar jogadores disponíveis no banco
   */
  async listAvailablePlayers() {
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name, role, team_id')
      .order('name');

    if (error) throw error;
    return players;
  }
}

export const scraperService = new ScraperService();
