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

  async refreshPlayerAggregates(playerIds: string[], latestRoundId?: number): Promise<number> {
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
    const isAlreadyFinished = roundStatus === 'completed';
    // Re-finalização NUNCA altera preços nem patrimônio — apenas recalcula pontuações
    // Isso evita que preços fiquem "compounding" (aplicando fórmula sobre preço já modificado)
    // EXCETO quando forceRecalculate=true (admin forçou recálculo completo via reset+finalize)
    const isRecalculation = isAlreadyFinished && !options?.forceRecalculate;

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
      // Salvar snapshot dos preços ANTES da flutuação (para possível reset futuro)
      await this.savePriceSnapshot(roundId);

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

      if (!userTeams || userTeams.length === 0) {
        console.log(`   ⚠️  Nenhum user_team encontrado para atualizar patrimônio`);
      } else {
        // Salvar snapshot dos budgets ANTES do recálculo (para possível reset futuro)
        await this.saveBudgetSnapshot(roundId, userTeams);

        // Buscar preços ATUALIZADOS de todos os jogadores nos lineups
        const lineupPlayerIds = new Set<string>();
        for (const team of userTeams) {
          const lineup = team.lineup || {};
          const players = Object.values(lineup).filter(Boolean) as Array<{ id: string }>;
          players.forEach((p) => {
            if (p.id) lineupPlayerIds.add(String(p.id));
          });
        }

        console.log(`   📊 Total user_teams: ${userTeams.length}, jogadores únicos nos lineups: ${lineupPlayerIds.size}`);

        const currentPriceMap = new Map<string, number>();
        if (lineupPlayerIds.size > 0) {
          const playerIdsArray = Array.from(lineupPlayerIds);
          const { data: freshPlayers, error: freshError } = await adminSupabase
            .from('players')
            .select('id, price')
            .in('id', playerIdsArray);

          if (freshError) {
            console.error(`   ❌ Erro ao buscar preços atualizados:`, freshError);
            throw freshError;
          }
          for (const p of freshPlayers || []) {
            currentPriceMap.set(String(p.id), Number(p.price || 0));
          }
          console.log(`   📊 Preços carregados do banco: ${currentPriceMap.size}/${playerIdsArray.length} jogadores`);
        }

        for (const team of userTeams) {
          const lineup = (team.lineup || {}) as Record<string, any>;
          const lineupPlayers = Object.values(lineup).filter(Boolean) as Array<{ id: string; price?: number }>;

          if (lineupPlayers.length === 0) {
            console.log(`   ⚠️  Team ${team.id}: lineup vazio, pulando`);
            continue;
          }

          const currentBudget = Number(team.budget || 0);

          // Valor antigo e novo do lineup (apenas para log)
          const oldLineupValue = lineupPlayers.reduce((sum, p) => sum + Number(p.price || 0), 0);
          const newLineupValue = lineupPlayers.reduce((sum, p) => {
            const currentPrice = currentPriceMap.get(String(p.id));
            return sum + (currentPrice ?? Number(p.price || 0));
          }, 0);
          const delta = newLineupValue - oldLineupValue;

          console.log(`   📋 Team ${team.id}: players=${lineupPlayers.length}, budget=${currentBudget} (inalterado), lineup old=${oldLineupValue.toFixed(2)} new=${newLineupValue.toFixed(2)} delta=${delta.toFixed(2)}`);

          // Atualizar lineup com preços novos (snapshot atualizado)
          // Budget NÃO muda: a valorização/desvalorização já está refletida nos preços do lineup
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
            .update({ lineup: updatedLineup })
            .eq('id', team.id);

          if (!error) {
            updatedBudgets++;
          } else {
            console.error(`   ❌ Failed to update lineup for team ${team.id}:`, error);
            console.error(`   ❌ Dados tentados: lineup keys=${Object.keys(updatedLineup).join(',')}`);
          }
        }
        console.log(`   ✅ ${updatedBudgets}/${userTeams.length} patrimônios atualizados`);
      }
    }

    // ── FASE 4: Marcar rodada como finalizada ──────────────────
    console.log(`🔷 FASE 4: Finalizando rodada...`);

    // Status válidos no banco: 'upcoming', 'live', 'completed', 'cancelled'
    const finishedStatusCandidates = ['completed'];
    let statusUpdated = false;

    for (const statusCandidate of finishedStatusCandidates) {
      const { error: statusError } = await adminSupabase
        .from('rounds')
        .update({ status: statusCandidate })
        .eq('id', roundId);

      if (!statusError) {
        console.log(`   ✅ Status da rodada atualizado para '${statusCandidate}'`);
        statusUpdated = true;
        break;
      }

      console.warn(`   ⚠️  Falha ao setar status '${statusCandidate}': ${statusError.message}`);
    }

    if (!statusUpdated) {
      console.error(`   ❌ Não foi possível atualizar o status da rodada ${roundId} para nenhum status de finalização`);
    }

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
   * Calcula buff de diversidade de times (v2 Balanced Economy)
   *
   * 5 times diferentes = 20%
   * 4 times diferentes = 15%
   * 3 times diferentes = 10%
   * 2 times diferentes = 5%
   * 1 time (todos iguais) = 0%
   *
   * Valores lidos do system_config; fallbacks hardcoded caso ausentes.
   */
  async calculateDiversityBonus(lineup: Array<{ team_id: string }>): Promise<{
    uniqueTeams: number;
    bonusPercent: number;
  }> {
    const config = await this.loadConfig();

    // Contar times únicos
    const uniqueTeamIds = new Set(lineup.map(p => p.team_id));
    const uniqueTeams = uniqueTeamIds.size;

    // Obter percentual de bônus (com fallbacks para os novos valores v2)
    let bonusPercent = 0;
    switch (uniqueTeams) {
      case 5: bonusPercent = config.diversity_5_teams ?? 20; break;
      case 4: bonusPercent = config.diversity_4_teams ?? 15; break;
      case 3: bonusPercent = config.diversity_3_teams ?? 10; break;
      case 2: bonusPercent = config.diversity_2_teams ?? 5; break;
      case 1: bonusPercent = config.diversity_1_team ?? 0; break;
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

  // ═══════════════════════════════════════════════════════════════
  // SNAPSHOT & RESET — Suporte para "Resetar Cálculos da Rodada"
  // ═══════════════════════════════════════════════════════════════

  /**
   * Salva snapshot dos preços dos jogadores ANTES da flutuação.
   * Armazena na tabela system_config como JSON.
   */
  private async savePriceSnapshot(roundId: number): Promise<void> {
    try {
      // Buscar todos os jogadores e seus preços atuais (pré-flutuação)
      const { data: players, error } = await adminSupabase
        .from('players')
        .select('id, price');

      if (error || !players) {
        console.warn(`⚠️  Não foi possível salvar snapshot de preços para round ${roundId}`);
        return;
      }

      const snapshot: Record<string, number> = {};
      for (const p of players) {
        snapshot[String(p.id)] = Number(p.price || 0);
      }

      await adminSupabase
        .from('system_config')
        .upsert({
          key: `snapshot_round_${roundId}_prices`,
          value: JSON.stringify(snapshot),
          value_type: 'json'
        }, { onConflict: 'key' });

      console.log(`   💾 Snapshot de preços salvo (${players.length} jogadores)`);
    } catch (err) {
      console.warn(`⚠️  Erro ao salvar snapshot de preços:`, err);
    }
  }

  /**
   * Salva snapshot dos budgets e lineups dos usuários ANTES do recálculo.
   */
  private async saveBudgetSnapshot(roundId: number, userTeams: Array<{ id: number; lineup: any; budget: number }>): Promise<void> {
    try {
      const snapshot: Record<string, { budget: number; lineup: any }> = {};
      for (const team of userTeams) {
        snapshot[String(team.id)] = {
          budget: Number(team.budget || 0),
          lineup: team.lineup || {}
        };
      }

      await adminSupabase
        .from('system_config')
        .upsert({
          key: `snapshot_round_${roundId}_budgets`,
          value: JSON.stringify(snapshot),
          value_type: 'json'
        }, { onConflict: 'key' });

      console.log(`   💾 Snapshot de budgets salvo (${userTeams.length} times)`);
    } catch (err) {
      console.warn(`⚠️  Erro ao salvar snapshot de budgets:`, err);
    }
  }

  /**
   * RESETAR CÁLCULOS DA RODADA
   *
   * Reverte todos os efeitos de uma finalização:
   *   1. Restaura preços dos jogadores (snapshot)
   *   2. Restaura budgets e lineups dos usuários (snapshot)
   *   3. Remove round_scores da rodada
   *   4. Recalcula total_points dos user_teams (sem esta rodada)
   *   5. Reseta status da rodada para 'upcoming'
   *
   * Idempotente: chamar múltiplas vezes não corrompe dados.
   */
  async resetRoundCalculations(roundId: number): Promise<{
    pricesRestored: number;
    budgetsRestored: number;
    scoresRemoved: number;
    roundStatusReset: boolean;
  }> {
    if (!Number.isFinite(roundId)) {
      throw new Error('roundId inválido');
    }

    console.log(`\n🔄 RESETANDO CÁLCULOS DA RODADA ${roundId}...`);

    // ── Validação ──────────────────────────────────────────────
    const { data: round, error: roundError } = await adminSupabase
      .from('rounds')
      .select('id, status')
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      throw new Error('Rodada não encontrada');
    }

    const roundStatus = String((round as any).status || '').toLowerCase();
    if (roundStatus !== 'completed') {
      throw new Error(`Rodada não está finalizada (status atual: ${roundStatus}). Apenas rodadas finalizadas podem ser resetadas.`);
    }

    let pricesRestored = 0;
    let budgetsRestored = 0;
    let scoresRemoved = 0;

    // ── PASSO 1: Restaurar preços dos jogadores ──────────────
    console.log(`🔷 Passo 1: Restaurando preços dos jogadores...`);

    const { data: priceSnapshotRow } = await adminSupabase
      .from('system_config')
      .select('value')
      .eq('key', `snapshot_round_${roundId}_prices`)
      .single();

    if (priceSnapshotRow?.value) {
      try {
        const priceSnapshot: Record<string, number> = JSON.parse(priceSnapshotRow.value);
        const playerIds = Object.keys(priceSnapshot);

        for (const playerId of playerIds) {
          const oldPrice = priceSnapshot[playerId];
          const { error } = await adminSupabase
            .from('players')
            .update({ price: oldPrice })
            .eq('id', playerId);

          if (!error) pricesRestored++;
        }
        console.log(`   ✅ ${pricesRestored}/${playerIds.length} preços restaurados`);
      } catch (parseErr) {
        console.error(`   ❌ Erro ao parsear snapshot de preços:`, parseErr);
        throw new Error('Snapshot de preços corrompido. Reset abortado.');
      }
    } else {
      console.warn(`   ⚠️  Nenhum snapshot de preços encontrado para rodada ${roundId}.`);
      console.warn(`   ⚠️  Preços NÃO foram restaurados. Pode ser necessário ajuste manual.`);
    }

    // ── PASSO 2: Restaurar budgets e lineups dos usuários ────
    console.log(`🔷 Passo 2: Restaurando budgets e lineups dos usuários...`);

    const { data: budgetSnapshotRow } = await adminSupabase
      .from('system_config')
      .select('value')
      .eq('key', `snapshot_round_${roundId}_budgets`)
      .single();

    if (budgetSnapshotRow?.value) {
      try {
        const budgetSnapshot: Record<string, { budget: number; lineup: any }> = JSON.parse(budgetSnapshotRow.value);
        const teamIds = Object.keys(budgetSnapshot);

        for (const teamId of teamIds) {
          const { budget, lineup } = budgetSnapshot[teamId];
          const { error } = await adminSupabase
            .from('user_teams')
            .update({ budget, lineup })
            .eq('id', Number(teamId));

          if (!error) budgetsRestored++;
        }
        console.log(`   ✅ ${budgetsRestored}/${teamIds.length} budgets/lineups restaurados`);
      } catch (parseErr) {
        console.error(`   ❌ Erro ao parsear snapshot de budgets:`, parseErr);
        throw new Error('Snapshot de budgets corrompido. Reset abortado.');
      }
    } else {
      console.warn(`   ⚠️  Nenhum snapshot de budgets encontrado para rodada ${roundId}.`);
      console.warn(`   ⚠️  Budgets NÃO foram restaurados. Pode ser necessário ajuste manual.`);
    }

    // ── PASSO 3: Remover round_scores da rodada ──────────────
    console.log(`🔷 Passo 3: Removendo round_scores da rodada...`);

    const { data: deletedScores, error: scoresError } = await adminSupabase
      .from('round_scores')
      .delete()
      .eq('round_id', roundId)
      .select('id');

    if (scoresError) {
      console.error(`   ❌ Erro ao remover round_scores:`, scoresError);
    } else {
      scoresRemoved = deletedScores?.length || 0;
      console.log(`   ✅ ${scoresRemoved} round_scores removidos`);
    }

    // ── PASSO 4: Recalcular total_points dos user_teams ──────
    console.log(`🔷 Passo 4: Recalculando total_points dos user_teams...`);

    const { data: allTeams } = await adminSupabase
      .from('user_teams')
      .select('id');

    for (const team of allTeams || []) {
      const { data: remainingScores } = await adminSupabase
        .from('round_scores')
        .select('total_points')
        .eq('user_team_id', team.id);

      const newTotalPoints = (remainingScores || [])
        .reduce((sum: number, row: any) => sum + Number(row.total_points || 0), 0);

      await adminSupabase
        .from('user_teams')
        .update({
          total_points: parseFloat(newTotalPoints.toFixed(2)),
          current_round_points: 0
        })
        .eq('id', team.id);
    }
    console.log(`   ✅ total_points recalculados para ${(allTeams || []).length} times`);

    // ── PASSO 5: Resetar status da rodada ────────────────────
    console.log(`🔷 Passo 5: Resetando status da rodada para pré-finalização...`);

    // Status válidos no banco: 'upcoming', 'live', 'completed', 'cancelled'
    const resetStatusCandidates = ['upcoming'];
    let roundStatusReset = false;

    for (const statusCandidate of resetStatusCandidates) {
      const { error: statusError } = await adminSupabase
        .from('rounds')
        .update({
          status: statusCandidate,
          updated_at: new Date().toISOString()
        })
        .eq('id', roundId);

      if (!statusError) {
        console.log(`   ✅ Status da rodada alterado para '${statusCandidate}'`);
        roundStatusReset = true;
        break;
      }

      console.warn(`   ⚠️  Falha ao setar status '${statusCandidate}': ${statusError.message}`);
    }

    if (!roundStatusReset) {
      console.error(`   ❌ Não foi possível resetar o status da rodada ${roundId}`);
    }

    // ── PASSO 6: Atualizar aggregates dos jogadores ──────────
    console.log(`🔷 Passo 6: Recalculando aggregates dos jogadores...`);

    const { data: matches } = await adminSupabase
      .from('matches')
      .select('id')
      .eq('round_id', roundId);

    if (matches && matches.length > 0) {
      const matchIds = matches.map((m: any) => m.id);
      const { data: performances } = await adminSupabase
        .from('player_performances')
        .select('player_id')
        .in('match_id', matchIds);

      if (performances && performances.length > 0) {
        const playerIds = Array.from(new Set(performances.map((p: any) => String(p.player_id))));
        await this.refreshPlayerAggregates(playerIds);
        console.log(`   ✅ Aggregates recalculados para ${playerIds.length} jogadores`);
      }
    }

    // ── Limpar snapshots usados ──────────────────────────────
    await adminSupabase.from('system_config').delete().eq('key', `snapshot_round_${roundId}_prices`);
    await adminSupabase.from('system_config').delete().eq('key', `snapshot_round_${roundId}_budgets`);
    console.log(`   🗑️  Snapshots limpos`);

    console.log(`\n✅ Reset da rodada ${roundId} concluído!\n`);

    return {
      pricesRestored,
      budgetsRestored,
      scoresRemoved,
      roundStatusReset
    };
  }

  /**
   * Busca a média de pontos de um jogador nas últimas N rodadas finalizadas.
   * Usado como "performance esperada" na fórmula de flutuação de preços.
   *
   * Fallback:
   *   - Se < PRICE_HISTORY_ROUNDS rodadas, usa as disponíveis
   *   - Se nenhum histórico, usa a média global de todos os jogadores na rodada atual
   *   - Se nenhum dado, retorna null (baseline padrão será usado)
   */
  private async getPlayerHistoricalAvg(
    playerId: string,
    currentRoundId: number,
    historyRounds: number = 3
  ): Promise<number | null> {
    // Buscar rodadas finalizadas anteriores a esta
    const { data: completedRounds } = await adminSupabase
      .from('rounds')
      .select('id')
      .eq('status', 'completed')
      .neq('id', currentRoundId)
      .order('id', { ascending: false })
      .limit(historyRounds);

    if (!completedRounds || completedRounds.length === 0) return null;

    const roundIds = completedRounds.map((r: any) => r.id);

    // Buscar matches dessas rodadas
    const { data: matches } = await adminSupabase
      .from('matches')
      .select('id, round_id, games_count')
      .in('round_id', roundIds);

    if (!matches || matches.length === 0) return null;

    const matchIds = matches.map((m: any) => m.id);
    const matchGamesCount = new Map<number, number>(
      matches.map((m: any) => [Number(m.id), Math.max(Number(m.games_count || 1), 1)])
    );

    // Buscar performances do jogador nessas matches
    const { data: performances } = await adminSupabase
      .from('player_performances')
      .select('fantasy_points, match_id')
      .eq('player_id', playerId)
      .in('match_id', matchIds);

    if (!performances || performances.length === 0) return null;

    // Agrupar por match, normalizar por games_count, tirar média por rodada
    const matchPointsMap = new Map<number, number>();
    for (const perf of performances) {
      const matchId = Number(perf.match_id);
      const points = Number(perf.fantasy_points || 0);
      matchPointsMap.set(matchId, (matchPointsMap.get(matchId) || 0) + points);
    }

    let totalNormalized = 0;
    let matchCount = 0;
    for (const [matchId, totalPoints] of matchPointsMap) {
      const gamesCount = matchGamesCount.get(matchId) || 1;
      totalNormalized += totalPoints / gamesCount;
      matchCount++;
    }

    return matchCount > 0 ? totalNormalized / matchCount : null;
  }

  /**
   * Atualiza preços dos jogadores com base na performance da rodada
   *
   * Fórmula de flutuação v2 (Balanced Economy):
   *   performance_expected = média das últimas 3 rodadas (ou fallback global)
   *   delta = performance_current - performance_expected
   *   base_variation = delta * 0.2
   *
   * Anti-snowball:
   *   Se preço > 15: base_variation *= 0.7
   *   Se preço > 18: base_variation *= 0.5
   *
   * Limites:
   *   variation = clamp(-1.2, +1.2)
   *   new_price = clamp(MIN_PRICE=5, MAX_PRICE=20)
   *
   * Soft correction: jogadores no tier mais baixo são empurrados suavemente para 5-7
   */
  async updatePlayerPricesForRound(roundId: number): Promise<{
    updated: number;
    priceChanges: Map<string, { oldPrice: number; newPrice: number }>;
  }> {
    console.log(`💰 Updating player prices for round ${roundId} (v2 balanced economy)...`);

    const MIN_PRICE = 5.00;
    const MAX_PRICE = 20.00;
    const VARIATION_FACTOR = 0.2;
    const VARIATION_CLAMP = 1.2;
    const DAMPEN_THRESHOLD_1 = 15;
    const DAMPEN_THRESHOLD_2 = 18;

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

    // Calcular média real de cada jogador na rodada atual
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

    // Calcular média global da rodada (fallback para jogadores sem histórico)
    const allAvgPoints = Array.from(playerAvgPoints.values()).filter(v => Number.isFinite(v));
    const globalAvg = allAvgPoints.length > 0
      ? allAvgPoints.reduce((sum, v) => sum + v, 0) / allAvgPoints.length
      : 0;

    console.log(`   📊 Média global da rodada: ${globalAvg.toFixed(2)} (${allAvgPoints.length} jogadores)`);

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
      const currentPerformance = playerAvgPoints.get(player.id) || 0;
      const currentPrice = Number(player.price || MIN_PRICE);

      // ── Performance esperada: média das últimas 3 rodadas ──
      const historicalAvg = await this.getPlayerHistoricalAvg(player.id, roundId, 3);
      // Fallback: se sem histórico, usa média global da rodada atual
      const performanceExpected = historicalAvg ?? globalAvg;

      // ── Delta e variação base ──
      const delta = currentPerformance - performanceExpected;
      let baseVariation = delta * VARIATION_FACTOR;

      // ── Anti-snowball: dampening para preços altos ──
      if (currentPrice > DAMPEN_THRESHOLD_2) {
        baseVariation *= 0.5;
      } else if (currentPrice > DAMPEN_THRESHOLD_1) {
        baseVariation *= 0.7;
      }

      // ── Clamp variação por rodada ──
      const variation = Math.max(-VARIATION_CLAMP, Math.min(VARIATION_CLAMP, baseVariation));

      // ── Soft correction: empurrar jogadores muito baratos de volta ao piso 5-7 ──
      // Se o jogador está abaixo de 6 e a variação é negativa, reduz a queda
      let finalVariation = variation;
      if (currentPrice < 6 && finalVariation < 0) {
        finalVariation *= 0.3; // reduz 70% da queda para jogadores já muito baratos
      }

      // ── Preço final com limites absolutos ──
      const newPrice = Math.max(MIN_PRICE, Math.min(MAX_PRICE,
        parseFloat((currentPrice + finalVariation).toFixed(2))
      ));

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

      const direction = finalVariation > 0 ? '📈' : '📉';
      const expectedLabel = historicalAvg !== null ? `hist=${performanceExpected.toFixed(1)}` : `global=${performanceExpected.toFixed(1)}`;
      console.log(`   ${direction} ${player.id}: ${currentPrice} → ${newPrice} (pts=${currentPerformance.toFixed(1)}, ${expectedLabel}, delta=${delta.toFixed(2)}, var=${finalVariation.toFixed(2)})`);
      updated++;
    }

    console.log(`✅ Player prices updated: ${updated}/${players.length}`);
    return { updated, priceChanges };
  }

  /**
   * MARKET COMPRESSION — Comprime preços em direção ao preço-base original
   *
   * Fórmula: new_price = (current_price * 0.8) + (base_price * 0.2)
   *
   * Uso: chamado manualmente pelo admin ou via flag.
   * NÃO altera snapshots existentes.
   * O base_price padrão é o ponto médio da faixa (12.5).
   */
  async compressMarketPrices(basePrice: number = 12.5): Promise<{
    compressed: number;
    changes: Array<{ id: string; oldPrice: number; newPrice: number }>;
  }> {
    const MIN_PRICE = 5.00;
    const MAX_PRICE = 20.00;

    console.log(`🔧 Comprimindo preços do mercado (base=${basePrice})...`);

    const { data: players, error } = await adminSupabase
      .from('players')
      .select('id, price');

    if (error) throw error;
    if (!players || players.length === 0) {
      return { compressed: 0, changes: [] };
    }

    let compressed = 0;
    const changes: Array<{ id: string; oldPrice: number; newPrice: number }> = [];

    for (const player of players) {
      const oldPrice = Number(player.price || basePrice);
      const newPrice = Math.max(MIN_PRICE, Math.min(MAX_PRICE,
        parseFloat(((oldPrice * 0.8) + (basePrice * 0.2)).toFixed(2))
      ));

      if (newPrice === oldPrice) continue;

      const { error: updateError } = await adminSupabase
        .from('players')
        .update({ price: newPrice })
        .eq('id', player.id);

      if (!updateError) {
        compressed++;
        changes.push({ id: player.id, oldPrice, newPrice });
      }
    }

    console.log(`✅ Market compression: ${compressed}/${players.length} preços ajustados`);
    return { compressed, changes };
  }
}

export const scoringService = new ScoringService();
