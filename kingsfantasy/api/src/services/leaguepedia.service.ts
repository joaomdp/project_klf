import axios from 'axios';

/**
 * LEAGUEPEDIA CARGO API SERVICE
 * 
 * Cliente para buscar dados de partidas e estatísticas do Leaguepedia
 * usando a Cargo API oficial (lol.fandom.com)
 * 
 * Documentação: https://lol.fandom.com/wiki/Help:Leaguepedia_API
 */

interface CargoResponse {
  cargoquery?: Array<{ title: Record<string, any> }>;
}

interface TournamentInfo {
  Name: string;
  OverviewPage: string;
  DateStart: string;
  Date: string;
  Region: string;
  Organizer: string;
}

interface MatchData {
  GameId: string;
  MatchId: string;
  Team1: string;
  Team2: string;
  Winner: string;
  DateTime_UTC: string;
  Week: string;
  Game: string;
}

interface PlayerStats {
  Link: string;          // Nome do jogador
  Champion: string;      // Campeão usado
  Kills: string;
  Deaths: string;
  Assists: string;
  Gold: string;
  CS: string;            // Creep Score
  DamageToChampions: string;
  Side: string;          // Blue ou Red
  Team: string;          // Nome do time
}

interface PicksBans {
  Team1Ban1?: string;
  Team1Ban2?: string;
  Team1Ban3?: string;
  Team1Ban4?: string;
  Team1Ban5?: string;
  Team1Pick1?: string;
  Team1Pick2?: string;
  Team1Pick3?: string;
  Team1Pick4?: string;
  Team1Pick5?: string;
  Team2Ban1?: string;
  Team2Ban2?: string;
  Team2Ban3?: string;
  Team2Ban4?: string;
  Team2Ban5?: string;
  Team2Pick1?: string;
  Team2Pick2?: string;
  Team2Pick3?: string;
  Team2Pick4?: string;
  Team2Pick5?: string;
}

class LeaguepediaService {
  private baseUrl = 'https://lol.fandom.com/api.php';
  
  /**
   * Fazer query genérica no Cargo API
   */
  private async cargoQuery(params: Record<string, any>): Promise<any[]> {
    try {
      console.log(`🔍 Cargo Query: ${params.tables}`);
      
      const response = await axios.get<CargoResponse>(this.baseUrl, {
        params: {
          action: 'cargoquery',
          format: 'json',
          ...params
        },
        headers: {
          'User-Agent': 'KingsFantasy/1.0 (contact@kingsfantasy.com)'
        },
        timeout: 30000 // 30 segundos
      });
      
      const results = response.data.cargoquery?.map(item => item.title) || [];
      console.log(`✅ Cargo Query retornou ${results.length} resultados`);
      
      return results;
    } catch (error: any) {
      console.error('❌ Cargo API error:', error.message);
      throw new Error(`Erro ao buscar dados do Leaguepedia: ${error.message}`);
    }
  }
  
  /**
   * Buscar informações do torneio
   */
  async getTournamentInfo(overviewPage: string): Promise<TournamentInfo | null> {
    console.log(`🏆 Buscando info do torneio: ${overviewPage}`);
    
    const results = await this.cargoQuery({
      tables: 'Tournaments',
      fields: 'Name,OverviewPage,DateStart,Date,Region,Organizer',
      where: `OverviewPage="${overviewPage}"`,
      limit: 1
    });
    
    return results[0] || null;
  }
  
  /**
   * Buscar partidas de uma rodada específica
   * Suporta Week numérico (1, 2, 3) ou texto ("Day 1", "Quarterfinals", etc.)
   */
  async getMatches(overviewPage: string, week: number | string): Promise<MatchData[]> {
    console.log(`📅 Buscando partidas: ${overviewPage}, Week/Tab ${week}`);

    const fields = 'GameId,MatchId,Team1,Team2,Winner,DateTime_UTC,Week,Game';
    const weekStr = String(week);

    // Build list of queries to try in order
    const attempts: Array<{ label: string; where: string }> = [
      // 1. Exact Week match
      { label: `Week="${weekStr}"`, where: `OverviewPage="${overviewPage}" AND Week="${weekStr}"` },
      // 2. Tab exact match
      { label: `Tab="${weekStr}"`, where: `OverviewPage="${overviewPage}" AND Tab="${weekStr}"` },
    ];

    // If numeric, also try "Day X" format
    if (typeof week === 'number' || /^\d+$/.test(weekStr)) {
      const num = typeof week === 'number' ? week : parseInt(weekStr);
      attempts.push(
        { label: `Week="Day ${num}"`, where: `OverviewPage="${overviewPage}" AND Week="Day ${num}"` },
        { label: `Tab="Day ${num}"`, where: `OverviewPage="${overviewPage}" AND Tab="Day ${num}"` },
      );
    }

    // If "Day X" string, also try just the number
    const dayMatch = weekStr.match(/^Day\s+(\d+)$/i);
    if (dayMatch) {
      attempts.push(
        { label: `Week="${dayMatch[1]}"`, where: `OverviewPage="${overviewPage}" AND Week="${dayMatch[1]}"` },
        { label: `Tab="${dayMatch[1]}"`, where: `OverviewPage="${overviewPage}" AND Tab="${dayMatch[1]}"` },
      );
    }

    for (const attempt of attempts) {
      console.log(`🔍 Tentando: ${attempt.label}`);
      const results = await this.cargoQuery({
        tables: 'ScoreboardGames',
        fields,
        where: attempt.where,
        order_by: 'DateTime_UTC',
        limit: 50
      });

      if (results.length > 0) {
        console.log(`✅ Encontradas ${results.length} partidas com ${attempt.label}`);
        return results;
      }
    }

    // Last resort: fetch ALL matches and log available Week/Tab values for debugging
    console.log(`⚠️  Nenhuma partida encontrada. Buscando valores de Week disponíveis...`);
    const allMatches = await this.cargoQuery({
      tables: 'ScoreboardGames',
      fields: 'Week,Tab,N_MatchInTab',
      where: `OverviewPage="${overviewPage}"`,
      group_by: 'Week',
      limit: 50
    });
    const weekValues = allMatches.map(m => `Week="${m.Week}" Tab="${m.Tab}"`).join(', ');
    console.log(`📋 Valores de Week/Tab disponíveis: ${weekValues}`);

    console.log(`❌ Nenhuma partida encontrada para ${overviewPage} ${weekStr}`);
    return [];
  }
  
  /**
   * Buscar todas as partidas do torneio (sem filtro de week)
   */
  async getAllMatches(overviewPage: string): Promise<MatchData[]> {
    console.log(`📅 Buscando TODAS as partidas: ${overviewPage}`);
    
    const results = await this.cargoQuery({
      tables: 'ScoreboardGames',
      fields: 'GameId,MatchId,Team1,Team2,Winner,DateTime_UTC,Week,Game',
      where: `OverviewPage="${overviewPage}"`,
      order_by: 'DateTime_UTC',
      limit: 500
    });
    
    console.log(`✅ Encontradas ${results.length} partidas no total`);
    return results;
  }
  
  /**
   * Buscar estatísticas dos jogadores de um game
   */
  async getPlayerStats(gameId: string): Promise<PlayerStats[]> {
    console.log(`📊 Buscando stats dos jogadores: Game ${gameId}`);
    
    const results = await this.cargoQuery({
      tables: 'ScoreboardPlayers',
      fields: [
        'Link',          // Nome do jogador
        'Champion',      // Campeão usado
        'Kills',
        'Deaths',
        'Assists',
        'Gold',
        'CS',            // Creep Score
        'DamageToChampions',
        'Side',          // Blue ou Red
        'Team'           // Nome do time
      ].join(','),
      where: `GameId="${gameId}"`,
      limit: 10
    });
    
    console.log(`✅ Encontradas stats de ${results.length} jogadores`);
    return results;
  }
  
  /**
   * Buscar picks & bans de um game
   */
  async getPicksBans(gameId: string): Promise<PicksBans | null> {
    console.log(`🎯 Buscando picks/bans: Game ${gameId}`);
    
    const results = await this.cargoQuery({
      tables: 'PicksAndBansS7',
      fields: [
        'Team1Ban1', 'Team1Ban2', 'Team1Ban3', 'Team1Ban4', 'Team1Ban5',
        'Team1Pick1', 'Team1Pick2', 'Team1Pick3', 'Team1Pick4', 'Team1Pick5',
        'Team2Ban1', 'Team2Ban2', 'Team2Ban3', 'Team2Ban4', 'Team2Ban5',
        'Team2Pick1', 'Team2Pick2', 'Team2Pick3', 'Team2Pick4', 'Team2Pick5'
      ].join(','),
      where: `GameId="${gameId}"`,
      limit: 1
    });
    
    return results[0] || null;
  }
  
  /**
   * Buscar times do torneio (roster completo)
   */
  async getTeamRosters(overviewPage: string): Promise<Record<string, any[]>> {
    console.log(`👥 Buscando rosters: ${overviewPage}`);
    
    const results = await this.cargoQuery({
      tables: 'TournamentRosters',
      fields: 'Team,Link,Role',
      where: `OverviewPage="${overviewPage}"`,
      order_by: 'Team,Role',
      limit: 500
    });
    
    // Agrupar por time
    const teams: Record<string, any[]> = {};
    results.forEach(player => {
      if (!teams[player.Team]) {
        teams[player.Team] = [];
      }
      teams[player.Team].push(player);
    });
    
    console.log(`✅ Encontrados ${Object.keys(teams).length} times`);
    return teams;
  }
  
  /**
   * Buscar weeks/tabs disponíveis para um torneio
   * Retorna valores como números quando possível, ou strings como "Day 1", "Quarterfinals"
   */
  async getAvailableWeeks(overviewPage: string): Promise<(number | string)[]> {
    console.log(`📋 Buscando weeks disponíveis: ${overviewPage}`);

    const results = await this.cargoQuery({
      tables: 'ScoreboardGames',
      fields: 'Week',
      where: `OverviewPage="${overviewPage}"`,
      group_by: 'Week',
      order_by: 'Week',
      limit: 50
    });

    const weeks: (number | string)[] = [];
    for (const r of results) {
      const weekVal = r.Week;
      const num = parseInt(weekVal);
      if (!isNaN(num) && String(num) === weekVal) {
        weeks.push(num);
      } else if (weekVal) {
        weeks.push(weekVal);
      }
    }

    console.log(`✅ Weeks disponíveis: ${weeks.join(', ')}`);
    return weeks;
  }
}

export const leaguepediaService = new LeaguepediaService();
