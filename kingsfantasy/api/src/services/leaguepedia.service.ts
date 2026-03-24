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
  private lastQueryTime = 0;
  private readonly QUERY_DELAY_MS = 2500; // 2.5s between queries to avoid rate limit
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 5000; // 5s wait on rate limit before retry

  // In-memory cache for tournament data (avoids repeated API calls)
  private tournamentCache: Map<string, { data: MatchData[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastQueryTime;
    if (elapsed < this.QUERY_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, this.QUERY_DELAY_MS - elapsed));
    }
    this.lastQueryTime = Date.now();
  }

  /**
   * Fazer query genérica no Cargo API com retry automático para rate limiting
   */
  private async cargoQuery(params: Record<string, any>): Promise<any[]> {
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.rateLimit();
        console.log(`🔍 Cargo Query: ${params.tables} | where: ${params.where || 'N/A'}${attempt > 0 ? ` (retry ${attempt})` : ''}`);

        const response = await axios.get<any>(this.baseUrl, {
          params: {
            action: 'cargoquery',
            format: 'json',
            ...params
          },
          headers: {
            'User-Agent': 'KingsFantasy/1.0 (contact@kingsfantasy.com)'
          },
          timeout: 30000
        });

        // Check for API-level errors (returned as HTTP 200 with error object)
        if (response.data?.error) {
          const errCode = response.data.error.code || 'unknown';
          const errInfo = response.data.error.info || '';

          // Retry on rate limit
          if (errCode === 'ratelimited' && attempt < this.MAX_RETRIES) {
            console.warn(`⏳ Rate limited, waiting ${this.RETRY_DELAY_MS}ms before retry ${attempt + 1}/${this.MAX_RETRIES}...`);
            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
            this.lastQueryTime = Date.now();
            continue;
          }

          console.error(`❌ Leaguepedia API error: [${errCode}] ${errInfo}`);
          throw new Error(`Leaguepedia API error [${errCode}]: ${errInfo}`);
        }

        const results = response.data.cargoquery?.map((item: any) => item.title) || [];
        console.log(`✅ Cargo Query retornou ${results.length} resultados`);

        return results;
      } catch (error: any) {
        // Don't retry non-rate-limit errors
        if (attempt < this.MAX_RETRIES && error.message?.includes('ratelimited')) {
          console.warn(`⏳ Rate limited (caught), waiting before retry...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
          this.lastQueryTime = Date.now();
          continue;
        }
        console.error('❌ Cargo API error:', error.message);
        throw new Error(`Erro ao buscar dados do Leaguepedia: ${error.message}`);
      }
    }

    // Should not reach here, but just in case
    return [];
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
   * Estratégia: busca TODAS as partidas do torneio em UMA query, filtra localmente.
   * Isso evita rate limiting da API do Leaguepedia.
   */
  async getMatches(overviewPage: string, week: number | string): Promise<MatchData[]> {
    console.log(`📅 Buscando partidas: ${overviewPage}, Week/Tab ${week}`);

    const weekStr = String(week).trim();

    // Build week variants for local matching (case-insensitive)
    const weekVariants: string[] = [weekStr.toLowerCase()];
    const dayMatch = weekStr.match(/^Day\s+(\d+)$/i);
    if (dayMatch) {
      weekVariants.push(dayMatch[1]);
    } else if (typeof week === 'number' || /^\d+$/.test(weekStr)) {
      const num = typeof week === 'number' ? week : parseInt(weekStr);
      weekVariants.push(`day ${num}`);
    }

    // Fetch ALL matches for this tournament (single API call, cached)
    const allMatches = await this.fetchAllTournamentMatches(overviewPage);

    if (allMatches.length === 0) {
      console.log(`❌ Nenhuma partida encontrada para o torneio ${overviewPage}`);
      return [];
    }

    // Filter locally by week/tab
    const filtered = allMatches.filter(m => {
      const matchWeek = (m.Week || '').toLowerCase().trim();
      return weekVariants.includes(matchWeek);
    });

    if (filtered.length > 0) {
      console.log(`✅ ${filtered.length} partidas encontradas para "${weekStr}" (de ${allMatches.length} total)`);
    } else {
      const availableTabs = [...new Set(allMatches.map(m => m.Week))].filter(Boolean);
      console.log(`❌ Nenhuma partida para "${weekStr}". Tabs disponíveis: [${availableTabs.join(', ')}]`);
    }

    return filtered;
  }

  /**
   * Busca todas as partidas de um torneio com cache em memória.
   * Uma única chamada API, resultado reutilizado por 5 minutos.
   */
  private async fetchAllTournamentMatches(overviewPage: string): Promise<MatchData[]> {
    // Check cache
    const cached = this.tournamentCache.get(overviewPage);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
      console.log(`📦 Cache hit para ${overviewPage} (${cached.data.length} partidas)`);
      return cached.data;
    }

    console.log(`🔍 Buscando TODAS as partidas de ${overviewPage} (query única)`);

    // Try MatchSchedule first (single query, no Tab filter)
    try {
      const msResults = await this.cargoQuery({
        tables: 'MatchSchedule',
        fields: 'MatchId,Team1,Team2,Winner,DateTime_UTC,Tab,BestOf',
        where: `OverviewPage="${overviewPage}"`,
        order_by: 'DateTime_UTC',
        limit: 500
      });

      if (msResults.length > 0) {
        console.log(`✅ ${msResults.length} partidas via MatchSchedule`);
        const matches: MatchData[] = msResults.map((ms: any, idx: number) => ({
          GameId: `${overviewPage}_${ms.Tab || 'unknown'}_${idx + 1}_1`,
          MatchId: ms.MatchId || `${overviewPage}_${ms.Tab || 'unknown'}_${idx + 1}`,
          Team1: ms.Team1,
          Team2: ms.Team2,
          Winner: ms.Winner,
          DateTime_UTC: ms['DateTime UTC'] || ms.DateTime_UTC,
          Week: ms.Tab || '',
          Game: '1',
          _bestOf: ms.BestOf || '1',
          _source: 'MatchSchedule'
        } as any));

        this.tournamentCache.set(overviewPage, { data: matches, timestamp: Date.now() });
        return matches;
      }
    } catch (err: any) {
      console.warn(`⚠️ MatchSchedule falhou: ${err.message}`);
    }

    // Fallback: ScoreboardGames
    try {
      const sgResults = await this.cargoQuery({
        tables: 'ScoreboardGames',
        fields: 'GameId,MatchId,Team1,Team2,Winner,DateTime_UTC,Week,Game',
        where: `OverviewPage="${overviewPage}"`,
        order_by: 'DateTime_UTC',
        limit: 500
      });

      if (sgResults.length > 0) {
        console.log(`✅ ${sgResults.length} partidas via ScoreboardGames`);
        this.tournamentCache.set(overviewPage, { data: sgResults, timestamp: Date.now() });
        return sgResults;
      }
    } catch (err: any) {
      console.warn(`⚠️ ScoreboardGames falhou: ${err.message}`);
    }

    return [];
  }
  
  /**
   * Buscar todas as partidas do torneio (sem filtro de week)
   */
  async getAllMatches(overviewPage: string): Promise<MatchData[]> {
    return this.fetchAllTournamentMatches(overviewPage);
  }
  
  /**
   * Buscar estatísticas dos jogadores de um game
   * Tenta GameId exato primeiro, depois busca por padrão LIKE
   */
  async getPlayerStats(gameId: string): Promise<PlayerStats[]> {
    console.log(`📊 Buscando stats dos jogadores: Game ${gameId}`);

    const statsFields = [
      'Link', 'Champion', 'Kills', 'Deaths', 'Assists',
      'Gold', 'CS', 'DamageToChampions', 'Side', 'Team', 'GameId'
    ].join(',');

    // Try exact GameId first
    let results = await this.cargoQuery({
      tables: 'ScoreboardPlayers',
      fields: statsFields,
      where: `GameId="${gameId}"`,
      limit: 10
    });
    
    if (results.length > 0) {
      console.log(`✅ Encontradas stats de ${results.length} jogadores (GameId exato)`);
      return results;
    }

    // Fallback: try LIKE pattern for MatchSchedule-sourced GameIds
    // Our generated GameId: "IDL Kings Lendas Cup_Day 1_1_1"
    // Real Leaguepedia GameId: "IDL Kings Lendas Cup_Day 1_1_1"
    // Try matching by LIKE with the base pattern (without trailing _1)
    const basePattern = gameId.replace(/_\d+$/, ''); // Remove last _N
    console.log(`🔍 Tentando LIKE: GameId LIKE "${basePattern}%"`);
    results = await this.cargoQuery({
      tables: 'ScoreboardPlayers',
      fields: statsFields,
      where: `GameId LIKE "${basePattern}%"`,
      limit: 50
    });

    if (results.length > 0) {
      console.log(`✅ Encontradas stats de ${results.length} jogadores (LIKE pattern)`);
      return results;
    }

    console.log(`❌ Nenhuma stat encontrada para ${gameId}`);
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

    // Use the same cached data from fetchAllTournamentMatches (zero extra API calls)
    const allMatches = await this.fetchAllTournamentMatches(overviewPage);

    const weekSet = new Set<string>();
    for (const m of allMatches) {
      if (m.Week) weekSet.add(m.Week);
    }

    const weeks: (number | string)[] = [];
    for (const w of weekSet) {
      const num = parseInt(w);
      if (!isNaN(num) && String(num) === w) {
        weeks.push(num);
      } else {
        weeks.push(w);
      }
    }

    console.log(`✅ Weeks disponíveis: ${weeks.join(', ')}`);
    return weeks;
  }
}

export const leaguepediaService = new LeaguepediaService();
