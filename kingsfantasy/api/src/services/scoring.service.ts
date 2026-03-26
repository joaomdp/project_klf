import { adminSupabase, supabase } from '../config/supabase';

  /**
   * SCORING SERVICE
   * 
   * Sistema de pontuação atual:
   * - Kills, Deaths, Assists e CS
   */

interface SystemConfig {
  points_per_kill: number;
  points_per_death: number;
  points_per_assist: number;
  points_per_cs: number;
  diversity_5_teams: number;
  diversity_4_teams: number;
  diversity_3_teams: number;
  diversity_2_teams: number;
  diversity_1_team: number;
  champion_multiplier_virgin: number;
  champion_multiplier_popular: number;
  champion_multiplier_saturated: number;
  min_player_price?: number;
  max_player_price?: number;
  // Analyst Rating System (Hybrid Scoring)
  enable_analyst_rating?: string; // 'true' | 'false'
  analyst_rating_weight?: number; // 0.30 (30%)
  objective_stats_weight?: number; // 0.70 (70%)
  max_possible_score?: number; // 100
}

class ScoringService {
  private config: SystemConfig | null = null;
  private configLoadedAt: number = 0;
  private static CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutos
  private finalizingRounds: Set<number> = new Set();

  private async refreshPlayerAggregates(playerIds: string[], latestRoundId?: number): Promise<number> {
    if (playerIds.length === 0) return 0;

    const uniquePlayerIds = Array.from(new Set(playerIds.map((id) => String(id)).filter(Boolean)));
    if (uniquePlayerIds.length === 0) return 0;

    const { data: perfRows, error: perfRowsError } = await adminSupabase
      .from('player_performances')
      .select('player_id, fantasy_points, match_id')
      .in('player_id', uniquePlayerIds);

    if (perfRowsError) throw perfRowsError;
    if (!perfRows || perfRows.length === 0) return 0;

    const matchIds = Array.from(new Set(perfRows.map((perf: any) => Number(perf.match_id)).filter(Number.isFinite)));
    const { data: matches, error: matchesError } = await adminSupabase
      .from('matches')
      .select('id, games_count')
      .in('id', matchIds);

    if (matchesError) throw matchesError;

    const matchGamesMap = new Map(
      (matches || []).map((match: any) => [Number(match.id), Number(match.games_count || 1)])
    );

    let latestRoundMatchIds = new Set<number>();
    if (Number.isFinite(latestRoundId)) {
      const { data: latestRoundMatches, error: latestRoundMatchesError } = await adminSupabase
        .from('matches')
        .select('id')
        .eq('round_id', Number(latestRoundId));

      if (latestRoundMatchesError) throw latestRoundMatchesError;
      latestRoundMatchIds = new Set((latestRoundMatches || []).map((match: any) => Number(match.id)));
    }

    const playerMatchPoints = new Map<string, Map<number, number>>();
    const playerGameStats = new Map<string, { totalPoints: number; count: number }>();

    for (const perf of perfRows) {
      const points = Number(perf.fantasy_points || 0);
      const playerId = String(perf.player_id);
      const matchId = Number(perf.match_id);

      if (!playerMatchPoints.has(playerId)) {
        playerMatchPoints.set(playerId, new Map());
      }

      const matchMap = playerMatchPoints.get(playerId)!;
      matchMap.set(matchId, (matchMap.get(matchId) || 0) + points);

      const gameStats = playerGameStats.get(playerId) || { totalPoints: 0, count: 0 };
      gameStats.totalPoints += points;
      gameStats.count += 1;
      playerGameStats.set(playerId, gameStats);
    }

    let updated = 0;
    for (const playerId of uniquePlayerIds) {
      const matchMap = playerMatchPoints.get(playerId) || new Map<number, number>();
      let matchSum = 0;
      let matchCount = 0;

      for (const [matchId, matchPoints] of matchMap) {
        const gamesCount = Number(matchGamesMap.get(matchId) || 1);
        matchSum += Number(matchPoints) / gamesCount;
        matchCount += 1;
      }

      const gameStats = playerGameStats.get(playerId) || { totalPoints: 0, count: 0 };
      const pointsPerMatch = matchCount > 0 ? matchSum / matchCount : 0;
      const avgPointsPerGame = gameStats.count > 0 ? gameStats.totalPoints / gameStats.count : 0;

      let latestRoundPoints = pointsPerMatch;
      if (latestRoundMatchIds.size > 0) {
        let latestRoundMatchSum = 0;
        let latestRoundMatchCount = 0;

        for (const [matchId, matchPoints] of matchMap) {
          if (!latestRoundMatchIds.has(Number(matchId))) continue;
          const gamesCount = Number(matchGamesMap.get(matchId) || 1);
          latestRoundMatchSum += Number(matchPoints) / gamesCount;
          latestRoundMatchCount += 1;
        }

        if (latestRoundMatchCount > 0) {
          latestRoundPoints = latestRoundMatchSum / latestRoundMatchCount;
        }
      }

      const { error: updateError } = await adminSupabase
        .from('players')
        .update({
          points: parseFloat(latestRoundPoints.toFixed(2)),
          avg_points: parseFloat(avgPointsPerGame.toFixed(2)),
          games_played: gameStats.count
        })
        .eq('id', playerId);

      if (!updateError) updated++;
    }

    return updated;
  }

  clearConfigCache() {
    this.config = null;
  }

  async finalizeRound(roundId: number, options?: { forceRecalculate?: boolean }) {
    if (!Number.isFinite(roundId)) {
      throw new Error('roundId inválido');
    }

    // Lock para evitar execução simultânea no mesmo round
    if (this.finalizingRounds.has(roundId)) {
      throw new Error(`Rodada ${roundId} já está sendo finalizada. Aguarde a conclusão.`);
    }
    this.finalizingRounds.add(roundId);

    try {
      return await this._doFinalizeRound(roundId, options);
    } finally {
      this.finalizingRounds.delete(roundId);
    }
  }

  /**
   * FINALIZAÇÃO DE RODADA — CASCATA ESTRITA
   *
   * Ordem obrigatória (ACID-like):
   *   FASE 1: Calcular pontuações de todos os user_teams
   *   FASE 2: Calcular flutuação de preços dos jogadores
   *   FASE 3: Recalcular patrimônio (budget + lineup) de todos os usuários
   *   FASE 4: Marcar rodada como finalizada
   *
   * Se qualquer fase falhar, as fases seguintes NÃO executam.
   */
  private async _doFinalizeRound(roundId: number, options?: { forceRecalculate?: boolean }) {
    // ── Validação ──────────────────────────────────────────────
    const { data: round, error: roundError } = await adminSupabase
      .from('rounds')
      .select('id, status')
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      throw roundError || new Error('Rodada não encontrada');
    }

    const roundStatus = String((round as any).status || '').toLowerCase();
    const isAlreadyFinished = roundStatus === 'completed' || roundStatus === 'finished';
    // Re-finalização NUNCA altera preços nem patrimônio — apenas recalcula pontuações
    // Isso evita que preços fiquem "compounding" (aplicando fórmula sobre preço já modificado)
    const isRecalculation = isAlreadyFinished;

    const { data: matches, error: matchesError } = await adminSupabase
      .from('matches')
      .select('id')
      .eq('round_id', roundId);

    if (matchesError) throw matchesError;

    const matchIds = (matches || []).map((match: any) => match.id);
    if (matchIds.length === 0) {
      return { totalPerformances: 0, remainingNulls: 0, updatedTeams: 0, updatedPlayers: 0, updatedBudgets: 0, priceUpdates: 0 };
    }

    const { data: performances, error: perfError } = await adminSupabase
      .from('player_performances')
      .select('id, fantasy_points, player_id')
      .in('match_id', matchIds);

    if (perfError) throw perfError;

    const totalPerformances = performances?.length || 0;

    // ── FASE 0: Calcular fantasy_points de todas as performances ──
    console.log(`\n🔷 FASE 0: Calculando fantasy_points para ${totalPerformances} performances...`);
    let pointsCalculated = 0;
    for (const perf of performances || []) {
      try {
        await this.updatePerformancePoints(perf.id);
        pointsCalculated++;
      } catch (err) {
        console.error(`❌ Failed to calculate points for performance ${perf.id}:`, err);
      }
    }
    console.log(`   ✅ ${pointsCalculated}/${totalPerformances} performances pontuadas`);

    // Verificar se restam performances sem pontos calculados (null = nunca calculado)
    const { data: recheck, error: recheckError } = await adminSupabase
      .from('player_performances')
      .select('id')
      .in('match_id', matchIds)
      .is('fantasy_points', null);

    const remainingNulls = recheckError ? 0 : (recheck?.length || 0);
    if (remainingNulls > 0) {
      console.warn(`⚠️  ${remainingNulls} performances still without points after calculation`);
    }

    // ── FASE 1: Calcular pontuações dos user_teams ─────────────
    console.log(`\n🔷 FASE 1: Calculando pontuações dos user_teams...`);

    const { data: userTeamsAll, error: teamsError } = await adminSupabase
      .from('user_teams')
      .select('id');

    if (teamsError) throw teamsError;

    let updatedTeams = 0;
    for (const team of userTeamsAll || []) {
      try {
        await this.saveRoundScore(team.id, roundId);
        updatedTeams++;
      } catch (err) {
        console.error(`❌ Failed score for team ${team.id}:`, err);
      }
    }
    console.log(`   ✅ ${updatedTeams}/${(userTeamsAll || []).length} user_teams pontuados`);

    // ── FASE 2: Flutuação de preços dos jogadores ──────────────
    console.log(`🔷 FASE 2: Calculando flutuação de preços...`);

    let priceUpdates = 0;
    let priceChanges = new Map<string, { oldPrice: number; newPrice: number }>();

    if (!isRecalculation) {
      const priceResult = await this.updatePlayerPricesForRound(roundId);
      priceUpdates = priceResult.updated;
      priceChanges = priceResult.priceChanges;
    } else {
      console.log(`   ℹ️  Recálculo — preços NÃO alterados`);
    }

    // Atualizar aggregates dos jogadores (points, avg_points)
    const updatedPlayers = await this.refreshPlayerAggregates(
      (performances || []).map((perf: any) => String(perf.player_id)),
      roundId
    );

    // ── FASE 3: Recalcular patrimônio dos usuários ─────────────
    console.log(`🔷 FASE 3: Recalculando patrimônio dos usuários...`);

    let updatedBudgets = 0;

    if (isRecalculation) {
      // Re-finalização: preços não mudaram, então patrimônio permanece igual
      console.log(`   ℹ️  Recálculo — patrimônio NÃO alterado (preços não mudaram)`);
    } else {
      // Primeira finalização: ajustar budget com base na valorização/desvalorização do elenco
      const { data: userTeams, error: budgetTeamsError } = await adminSupabase
        .from('user_teams')
        .select('id, lineup, budget');

      if (budgetTeamsError) throw budgetTeamsError;

      // Buscar preços ATUALIZADOS de todos os jogadores nos lineups
      const lineupPlayerIds = new Set<string>();
      for (const team of userTeams || []) {
        const lineup = team.lineup || {};
        const players = Object.values(lineup).filter(Boolean) as Array<{ id: string }>;
        players.forEach((p) => lineupPlayerIds.add(String(p.id)));
      }

      const currentPriceMap = new Map<string, number>();
      if (lineupPlayerIds.size > 0) {
        const { data: freshPlayers, error: freshError } = await adminSupabase
          .from('players')
          .select('id, price')
          .in('id', Array.from(lineupPlayerIds));

        if (freshError) throw freshError;
        for (const p of freshPlayers || []) {
          currentPriceMap.set(String(p.id), Number(p.price || 0));
        }
      }

      for (const team of userTeams || []) {
        const lineup = (team.lineup || {}) as Record<string, any>;
        const lineupPlayers = Object.values(lineup).filter(Boolean) as Array<{ id: string; price?: number }>;

        // Valor antigo = soma dos preços no snapshot do lineup
        const oldLineupValue = lineupPlayers.reduce((sum, p) => sum + Number(p.price || 0), 0);

        // Valor novo = soma dos preços ATUAIS do banco (pós-flutuação)
        const newLineupValue = lineupPlayers.reduce((sum, p) => {
          return sum + (currentPriceMap.get(String(p.id)) ?? Number(p.price || 0));
        }, 0);

        // Budget ajustado: se elenco valorizou, budget sobe; se desvalorizou, budget cai
        const currentBudget = Number(team.budget || 0);
        const nextBudget = parseFloat((currentBudget + (newLineupValue - oldLineupValue)).toFixed(2));

        console.log(`   📋 Team ${team.id}: players=${lineupPlayers.length}, budget=${currentBudget} → ${nextBudget}, lineup old=${oldLineupValue.toFixed(2)} new=${newLineupValue.toFixed(2)} delta=${(newLineupValue - oldLineupValue).toFixed(2)}`);

        // Atualizar lineup com preços novos (snapshot atualizado)
        const updatedLineup = Object.entries(lineup).reduce<Record<string, any>>((acc, [role, player]) => {
          if (!player) return acc;
          acc[role] = {
            ...player,
            price: currentPriceMap.get(String(player.id)) ?? Number(player.price || 0)
          };
          return acc;
        }, {});

        const { error } = await adminSupabase
          .from('user_teams')
          .update({ budget: nextBudget, lineup: updatedLineup })
          .eq('id', team.id);

        if (!error) updatedBudgets++;
        else console.error(`   ❌ Failed to update budget for team ${team.id}:`, error);
      }
      console.log(`   ✅ ${updatedBudgets} patrimônios atualizados`);
    }

    // ── FASE 4: Marcar rodada como finalizada ──────────────────
    console.log(`🔷 FASE 4: Finalizando rodada...`);

    await adminSupabase
      .from('rounds')
      .update({ status: 'finished' })
      .eq('id', roundId);

    console.log(`\n✅ Rodada ${roundId} finalizada com sucesso!\n`);

    return {
      recalculated: isRecalculation,
      totalPerformances,
      remainingNulls,
      updatedTeams,
      updatedPlayers,
      updatedBudgets,
      priceUpdates
    };
  }

  /**
   * Carrega configurações do sistema do banco
   */
  async loadConfig(): Promise<SystemConfig> {
    const now = Date.now();
    if (this.config && (now - this.configLoadedAt) < ScoringService.CONFIG_TTL_MS) {
      return this.config;
    }

    const { data, error } = await supabase
      .from('system_config')
      .select('*');

    if (error) throw error;

    const config: any = {};
    data?.forEach((item: any) => {
      let value = item.value;
      if (item.value_type === 'number') {
        value = parseFloat(item.value);
      }
      config[item.key] = value;
    });

    this.config = config as SystemConfig;
    this.configLoadedAt = now;
    return this.config;
  }

  /**
   * Calcula pontos base de uma performance individual
   */
  async calculateBasePoints(performance: {
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
  }): Promise<number> {
    const config = await this.loadConfig();

    const pointsPerKill = Number(config.points_per_kill ?? 0);
    const pointsPerDeath = Number(config.points_per_death ?? 0);
    const pointsPerAssist = Number(config.points_per_assist ?? 0);
    const pointsPerCs = Number(config.points_per_cs ?? 0);

    let points = 0;

    // Kills, Deaths, Assists
    points += performance.kills * pointsPerKill;
    points += performance.deaths * pointsPerDeath; // Negativo
    points += performance.assists * pointsPerAssist;

    // CS (por CS)
    points += performance.cs * pointsPerCs;

    if (!Number.isFinite(points)) {
      return 0;
    }

    return parseFloat(points.toFixed(2));
  }

  /**
   * Pontuação final = pontos objetivos (KDA + CS)
   */
  async calculateHybridScore(objectiveScore: number): Promise<number> {
    return objectiveScore;
  }

  /**
   * Calcula pontuação completa de uma performance
   * 
   * @param performance - Dados da performance do jogador
   * @returns Pontuação final
   */
  async calculatePerformanceScore(performance: {
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
  }): Promise<{
    objectiveScore: number;
    finalScore: number;
    usedRating: boolean;
    analystRating: number | null;
  }> {
    // 1. Calcular pontos objetivos
    const objectiveScore = await this.calculateBasePoints(performance);

    // 2. Calcular score final (com ou sem rating)
    const finalScore = await this.calculateHybridScore(objectiveScore);

    return {
      objectiveScore,
      finalScore,
      usedRating: false,
      analystRating: null,
    };
  }

  /**
   * Atualiza fantasy_points de uma performance no banco
   */
  async updatePerformancePoints(performanceId: number) {
    try {
      // Buscar performance
      const { data: performance, error } = await adminSupabase
        .from('player_performances')
        .select('*')
        .eq('id', performanceId)
        .single();

      if (error) throw error;

      // Calcular pontos (com sistema híbrido se disponível)
      const scoreResult = await this.calculatePerformanceScore(performance);

      // Atualizar no banco com score final
      const { error: updateError } = await adminSupabase
        .from('player_performances')
        .update({ fantasy_points: scoreResult.finalScore })
        .eq('id', performanceId);

      if (updateError) throw updateError;

      const ratingInfo = scoreResult.usedRating 
        ? ` (hybrid: ${scoreResult.objectiveScore.toFixed(2)} stats + ${scoreResult.analystRating} rating)`
        : ' (objective stats only)';

      console.log(`✅ Updated fantasy points for performance ${performanceId}: ${scoreResult.finalScore}${ratingInfo}`);
      return scoreResult.finalScore;

    } catch (error) {
      console.error('❌ Error updating performance points:', error);
      throw error;
    }
  }

  /**
   * Calcula buff de diversidade de times
   * Formula: 25% - (repetições × 5%)
   * 
   * 5 times diferentes = 25%
   * 4 times diferentes = 20%
   * 3 times diferentes = 15%
   * 2 times diferentes = 10%
   * 1 time (todos iguais) = 5%
   */
  async calculateDiversityBonus(lineup: Array<{ team_id: string }>): Promise<{
    uniqueTeams: number;
    bonusPercent: number;
  }> {
    const config = await this.loadConfig();

    // Contar times únicos
    const uniqueTeamIds = new Set(lineup.map(p => p.team_id));
    const uniqueTeams = uniqueTeamIds.size;

    // Obter percentual de bônus
    let bonusPercent = 0;
    switch (uniqueTeams) {
      case 5: bonusPercent = config.diversity_5_teams; break;
      case 4: bonusPercent = config.diversity_4_teams; break;
      case 3: bonusPercent = config.diversity_3_teams; break;
      case 2: bonusPercent = config.diversity_2_teams; break;
      case 1: bonusPercent = config.diversity_1_team; break;
      default: bonusPercent = 0;
    }

    return { uniqueTeams, bonusPercent };
  }

  /**
   * Calcula multiplicador de popularidade de campeão
   * 
   * VIRGIN (1.7x): Campeão nunca foi usado pelo jogador
   * POPULAR (1.5x): Campeão já foi usado por outros, mas não por este jogador
   * SATURATED (1.3x): Campeão já foi usado por este jogador
   */
  async getChampionMultiplier(playerId: string, championId: number, roundId: number): Promise<{
    multiplier: number;
    status: 'virgin' | 'popular' | 'saturated';
  }> {
    const config = await this.loadConfig();

    // Verificar se este jogador já usou este campeão antes
    const { data: playerUsage } = await supabase
      .from('champion_usage')
      .select('id')
      .eq('player_id', playerId)
      .eq('champion_id', championId)
      .lt('round_id', roundId) // Rodadas anteriores
      .limit(1);

    if (playerUsage && playerUsage.length > 0) {
      // SATURATED: Jogador já usou este campeão
      return {
        multiplier: config.champion_multiplier_saturated,
        status: 'saturated'
      };
    }

    // Verificar se QUALQUER jogador já usou este campeão
    const { data: anyUsage } = await supabase
      .from('champion_usage')
      .select('id')
      .eq('champion_id', championId)
      .lt('round_id', roundId)
      .limit(1);

    if (anyUsage && anyUsage.length > 0) {
      // POPULAR: Outros já usaram, mas este jogador não
      return {
        multiplier: config.champion_multiplier_popular,
        status: 'popular'
      };
    }

    // VIRGIN: Ninguém usou ainda
    return {
      multiplier: config.champion_multiplier_virgin,
      status: 'virgin'
    };
  }

  /**
   * Calcula pontuação total de um user_team em uma rodada
   */
  async calculateRoundScore(userTeamId: number, roundId: number): Promise<{
    basePoints: number;
    teamDiversityBonus: number;
    championMultiplierBonus: number;
    totalPoints: number;
    numUniqueTeams: number;
    diversityPercent: number;
  }> {
    try {
      console.log(`📊 Calculating score for user_team ${userTeamId}, round ${roundId}...`);

      // 1. Buscar lineup do user_team
      const { data: userTeam, error: teamError } = await adminSupabase
        .from('user_teams')
        .select('lineup')
        .eq('id', userTeamId)
        .single();

      if (teamError) throw teamError;

      const lineup = userTeam.lineup as any;
      const playerIds = Object.values(lineup).map((p: any) => p?.id).filter(Boolean);

      if (playerIds.length === 0) {
        throw new Error('Lineup is empty');
      }

      // 2. Buscar performances desses jogadores nesta rodada
      const { data: matches } = await adminSupabase
        .from('matches')
        .select('id, games_count')
        .eq('round_id', roundId);

      if (!matches || matches.length === 0) {
        console.log('⚠️  No matches found for this round');
        return {
          basePoints: 0,
          teamDiversityBonus: 0,
          championMultiplierBonus: 0,
          totalPoints: 0,
          numUniqueTeams: 0,
          diversityPercent: 0
        };
      }

      const matchIds = matches.map((m: any) => m.id);
      const matchGamesCount = new Map<number, number>(
        matches.map((match: any) => [
          Number(match.id),
          match.games_count && Number(match.games_count) > 0 ? Number(match.games_count) : 1
        ])
      );

      const { data: performances, error: perfError } = await adminSupabase
        .from('player_performances')
        .select('*, players!inner(id, team_id)')
        .in('match_id', matchIds)
        .in('player_id', playerIds);

      if (perfError) throw perfError;

      if (!performances || performances.length === 0) {
        console.log('⚠️  No performances found for these players');
        return {
          basePoints: 0,
          teamDiversityBonus: 0,
          championMultiplierBonus: 0,
          totalPoints: 0,
          numUniqueTeams: 0,
          diversityPercent: 0
        };
      }

      // 3. Calcular pontos base de forma robusta
      // - Remove duplicatas por match/player/game (quando houver reenvios)
      // - Para cada jogador, usa média por série (média dos jogos da partida)
      // - Soma os 5 jogadores escalados
      const uniquePerformanceMap = new Map<string, any>();

      for (const perf of performances) {
        const gameNumber = Number(perf.game_number || 1);
        const key = `${String(perf.match_id)}:${String(perf.player_id)}:${gameNumber}`;
        if (!uniquePerformanceMap.has(key)) {
          uniquePerformanceMap.set(key, perf);
        }
      }

      const uniquePerformances = Array.from(uniquePerformanceMap.values());

      const playerSeriesMap = new Map<string, Map<number, { total: number; games: number }>>();
      const playersData: Array<{ team_id: string }> = [];
      const seenPlayers = new Set<string>();

      for (const perf of uniquePerformances) {
        const playerId = String(perf.player_id);
        const matchId = Number(perf.match_id);
        const points = Number(perf.fantasy_points || 0);

        if (!Number.isFinite(matchId)) continue;

        const byMatch = playerSeriesMap.get(playerId) || new Map<number, { total: number; games: number }>();
        const current = byMatch.get(matchId) || { total: 0, games: 0 };

        current.total += points;
        current.games += 1;

        byMatch.set(matchId, current);
        playerSeriesMap.set(playerId, byMatch);

        if (!seenPlayers.has(playerId)) {
          playersData.push({ team_id: (perf.players as any).team_id });
          seenPlayers.add(playerId);
        }
      }

      let basePoints = 0;

      for (const playerId of playerIds) {
        const playerMatches = playerSeriesMap.get(String(playerId));
        if (!playerMatches || playerMatches.size === 0) continue;

        let playerRoundTotal = 0;
        let seriesCount = 0;

        for (const [matchId, stats] of playerMatches.entries()) {
          const configuredGamesCount = Number(matchGamesCount.get(matchId) || 0);
          const divisor = configuredGamesCount > 0
            ? configuredGamesCount
            : Math.max(stats.games, 1);

          playerRoundTotal += stats.total / divisor;
          seriesCount += 1;
        }

        const playerAverageForRound = playerRoundTotal / Math.max(seriesCount, 1);
        basePoints += playerAverageForRound;
      }

      // 4. Calcular buff de diversidade
      const diversity = await this.calculateDiversityBonus(playersData);
      const teamDiversityBonus = basePoints * (Number(diversity.bonusPercent || 0) / 100);
      const championMultiplierBonus = 0;

      const totalPoints = basePoints + teamDiversityBonus + championMultiplierBonus;

      console.log(`✅ Score calculated: Base=${basePoints.toFixed(2)}, Total=${totalPoints.toFixed(2)}`);

      return {
        basePoints: parseFloat(basePoints.toFixed(2)),
        teamDiversityBonus: parseFloat(teamDiversityBonus.toFixed(2)),
        championMultiplierBonus: parseFloat(championMultiplierBonus.toFixed(2)),
        totalPoints: parseFloat(totalPoints.toFixed(2)),
        numUniqueTeams: diversity.uniqueTeams,
        diversityPercent: Number(diversity.bonusPercent || 0)
      };

    } catch (error) {
      console.error('❌ Error calculating round score:', error);
      throw error;
    }
  }

  /**
   * Salva pontuação calculada na tabela round_scores
   */
  async saveRoundScore(userTeamId: number, roundId: number) {
    try {
      const score = await this.calculateRoundScore(userTeamId, roundId);

      const { error } = await adminSupabase
        .from('round_scores')
        .upsert({
          user_team_id: userTeamId,
          round_id: roundId,
          base_points: score.basePoints,
          team_diversity_bonus: score.teamDiversityBonus,
          champion_multiplier_bonus: score.championMultiplierBonus,
          total_points: score.totalPoints,
          num_unique_teams: score.numUniqueTeams,
          team_diversity_percent: score.diversityPercent,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_team_id,round_id'
        });

      if (error) throw error;

      const { data: totals, error: totalsError } = await adminSupabase
        .from('round_scores')
        .select('round_id, total_points, updated_at')
        .eq('user_team_id', userTeamId);

      if (totalsError) throw totalsError;

      const latestScoreByRound = new Map<number, { totalPoints: number; updatedAt: number }>();

      for (const row of totals || []) {
        const roundId = Number(row.round_id);
        if (!Number.isFinite(roundId)) continue;

        const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
        const current = latestScoreByRound.get(roundId);

        if (!current || updatedAt >= current.updatedAt) {
          latestScoreByRound.set(roundId, {
            totalPoints: Number(row.total_points || 0),
            updatedAt
          });
        }
      }

      const totalPoints = Array.from(latestScoreByRound.values())
        .reduce((sum, row) => sum + row.totalPoints, 0);

      const { error: updateError } = await adminSupabase
        .from('user_teams')
        .update({
          current_round_points: score.totalPoints,
          total_points: parseFloat(totalPoints.toFixed(2))
        })
        .eq('id', userTeamId);

      if (updateError) console.error('⚠️  Error updating user_team points:', updateError);

      console.log(`✅ Saved round score for user_team ${userTeamId}`);
      return score;

    } catch (error) {
      console.error('❌ Error saving round score:', error);
      throw error;
    }
  }

  /**
   * Calcula pontuações de TODOS os user_teams em uma rodada
   */
  async calculateAllScoresForRound(roundId: number, options?: { updatePlayerPrices?: boolean }) {
    try {
      console.log(`📊 Calculating all scores for round ${roundId}...`);
      const shouldUpdatePlayerPrices = options?.updatePlayerPrices !== false;

      // Buscar todos os user_teams
      const { data: userTeams, error } = await adminSupabase
        .from('user_teams')
        .select('id');

      if (error) throw error;

      if (!userTeams || userTeams.length === 0) {
        console.log('⚠️  No user teams found');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const team of userTeams) {
        try {
          await this.saveRoundScore(team.id, roundId);
          successCount++;
        } catch (err) {
          console.error(`❌ Failed to calculate score for team ${team.id}:`, err);
          errorCount++;
        }
      }

      console.log(`✅ Finished calculating scores: ${successCount} success, ${errorCount} errors`);

      if (shouldUpdatePlayerPrices) {
        try {
          await this.updatePlayerPricesForRound(roundId);
        } catch (error) {
          console.error('⚠️  Error updating player prices:', error);
        }
      } else {
        console.log(`ℹ️  Skipping player price update for round ${roundId} (recalculation mode)`);
      }

      return { successCount, errorCount, total: userTeams.length };

    } catch (error) {
      console.error('❌ Error calculating all scores:', error);
      throw error;
    }
  }

  /**
   * Atualiza preços dos jogadores com base na performance da rodada
   *
   * Fórmula de flutuação:
   *   Meta = Preco_Atual × 0.45
   *   Variacao = (Pontuacao_Real - Meta) / 2.5
   *   Novo_Preco = max(1.00, round(Preco_Atual + Variacao, 2))
   *
   * Retorna map de player_id → { oldPrice, newPrice } para cálculo de patrimônio
   */
  async updatePlayerPricesForRound(roundId: number): Promise<{
    updated: number;
    priceChanges: Map<string, { oldPrice: number; newPrice: number }>;
  }> {
    console.log(`💰 Updating player prices for round ${roundId}...`);

    const MIN_PRICE = 1.00;

    const { data: matches } = await adminSupabase
      .from('matches')
      .select('id, games_count')
      .eq('round_id', roundId);

    if (!matches || matches.length === 0) {
      console.log('ℹ️  No matches found for price update');
      return { updated: 0, priceChanges: new Map() };
    }

    const matchIds = matches.map((match: any) => match.id);
    const matchGamesCount = new Map<number, number>(
      matches.map((match: any) => [
        Number(match.id),
        match.games_count && Number(match.games_count) > 0 ? Number(match.games_count) : 1
      ])
    );

    const { data: performances, error: perfError } = await adminSupabase
      .from('player_performances')
      .select('player_id, fantasy_points, match_id')
      .in('match_id', matchIds);

    if (perfError) throw perfError;

    if (!performances || performances.length === 0) {
      console.log('ℹ️  No performances found for price update');
      return { updated: 0, priceChanges: new Map() };
    }

    // Agrupar pontos por jogador (média por match, normalizada por games_count)
    const playerMatchPoints = new Map<string, Map<number, number>>();

    for (const perf of performances) {
      const playerId = String(perf.player_id);
      const matchId = Number(perf.match_id);
      const points = Number(perf.fantasy_points || 0);

      if (!playerMatchPoints.has(playerId)) {
        playerMatchPoints.set(playerId, new Map());
      }
      const matchMap = playerMatchPoints.get(playerId)!;
      matchMap.set(matchId, (matchMap.get(matchId) || 0) + points);
    }

    // Calcular média real de cada jogador na rodada
    const playerAvgPoints = new Map<string, number>();
    for (const [playerId, matchMap] of playerMatchPoints) {
      let totalNormalized = 0;
      let matchCount = 0;

      for (const [matchId, totalPoints] of matchMap) {
        const gamesCount = Number(matchGamesCount.get(matchId) || 1);
        totalNormalized += totalPoints / Math.max(gamesCount, 1);
        matchCount++;
      }

      playerAvgPoints.set(playerId, matchCount > 0 ? totalNormalized / matchCount : 0);
    }

    const playerIds = Array.from(playerAvgPoints.keys());
    const { data: players, error: playersError } = await adminSupabase
      .from('players')
      .select('id, price')
      .in('id', playerIds);

    if (playersError) throw playersError;
    if (!players || players.length === 0) {
      return { updated: 0, priceChanges: new Map() };
    }

    let updated = 0;
    const priceChanges = new Map<string, { oldPrice: number; newPrice: number }>();

    for (const player of players) {
      const avgPoints = playerAvgPoints.get(player.id) || 0;
      const currentPrice = Number(player.price || 0);

      // Fórmula: Variacao = (Pontuacao_Real - (Preco_Atual * 0.45)) / 2.5
      const meta = currentPrice * 0.45;
      const variacao = (avgPoints - meta) / 2.5;
      const newPrice = Math.max(MIN_PRICE, parseFloat((currentPrice + variacao).toFixed(2)));

      priceChanges.set(player.id, { oldPrice: currentPrice, newPrice });

      if (newPrice === currentPrice) continue;

      const { error: updateError } = await adminSupabase
        .from('players')
        .update({ price: newPrice })
        .eq('id', player.id);

      if (updateError) {
        console.error(`⚠️  Failed to update price for player ${player.id}:`, updateError);
        continue;
      }

      const direction = variacao > 0 ? '📈' : '📉';
      console.log(`   ${direction} ${player.id}: ${currentPrice} → ${newPrice} (pts=${avgPoints.toFixed(1)}, meta=${meta.toFixed(1)}, var=${variacao.toFixed(2)})`);
      updated++;
    }

    console.log(`✅ Player prices updated: ${updated}/${players.length}`);
    return { updated, priceChanges };
  }
}

export const scoringService = new ScoringService();
