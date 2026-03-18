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

  async finalizeRound(roundId: number) {
    if (!Number.isFinite(roundId)) {
      throw new Error('roundId inválido');
    }

    const { data: matches, error: matchesError } = await adminSupabase
      .from('matches')
      .select('id')
      .eq('round_id', roundId);

    if (matchesError) throw matchesError;

    const matchIds = (matches || []).map((match: any) => match.id);
    if (matchIds.length === 0) {
      return {
        totalPerformances: 0,
        remainingNulls: 0,
        updatedTeams: 0,
        updatedPlayers: 0,
        updatedBudgets: 0
      };
    }

    const { data: performances, error: perfError } = await adminSupabase
      .from('player_performances')
      .select('id, fantasy_points, player_id')
      .in('match_id', matchIds);

    if (perfError) throw perfError;

    const totalPerformances = performances?.length || 0;
    const remainingNulls = (performances || []).filter((perf: any) => perf.fantasy_points === null).length;
    if (remainingNulls > 0) {
      return {
        totalPerformances,
        remainingNulls,
        updatedTeams: 0,
        updatedPlayers: 0,
        updatedBudgets: 0
      };
    }

    await this.calculateAllScoresForRound(roundId);

    const { data: scores, error: scoresError } = await adminSupabase
      .from('round_scores')
      .select('user_team_id, round_id, total_points')
      .in('round_id', [roundId]);

    if (scoresError) throw scoresError;

    const roundTotalsByTeam = (scores || []).reduce((map: Map<number, number>, row: any) => {
      const id = Number(row.user_team_id);
      const total = map.get(id) || 0;
      map.set(id, total + (row.total_points || 0));
      return map;
    }, new Map<number, number>());

    const userTeamIds = Array.from(roundTotalsByTeam.keys());
    let updatedTeams = 0;

    if (userTeamIds.length > 0) {
      const { data: allScores, error: allScoresError } = await adminSupabase
        .from('round_scores')
        .select('user_team_id, total_points')
        .in('user_team_id', userTeamIds);

      if (allScoresError) throw allScoresError;

      const totalsByTeam = (allScores || []).reduce((map: Map<number, number>, row: any) => {
        const id = Number(row.user_team_id);
        const total = map.get(id) || 0;
        map.set(id, total + (row.total_points || 0));
        return map;
      }, new Map<number, number>());

      for (const teamId of userTeamIds) {
        const { error } = await adminSupabase
          .from('user_teams')
          .update({
            current_round_points: roundTotalsByTeam.get(teamId) || 0,
            total_points: parseFloat(((totalsByTeam.get(teamId) || 0)).toFixed(2))
          })
          .eq('id', teamId);

        if (!error) updatedTeams++;
      }
    }

    const updatedPlayers = await this.refreshPlayerAggregates(
      (performances || []).map((perf: any) => String(perf.player_id)),
      roundId
    );

    const playerPriceMap = new Map<string, number>();

    const { data: userTeams, error: teamsError } = await adminSupabase
      .from('user_teams')
      .select('id, lineup, budget');

    if (teamsError) throw teamsError;

    const lineupPlayerIds = new Set<string>();
    for (const team of userTeams || []) {
      const lineup = team.lineup || {};
      const lineupPlayers = Object.values(lineup).filter(Boolean) as Array<{ id: string }>;
      lineupPlayers.forEach((player) => lineupPlayerIds.add(String(player.id)));
    }

    if (lineupPlayerIds.size > 0) {
      const { data: lineupPlayers, error: lineupPlayersError } = await adminSupabase
        .from('players')
        .select('id, price')
        .in('id', Array.from(lineupPlayerIds));

      if (lineupPlayersError) throw lineupPlayersError;

      for (const player of lineupPlayers || []) {
        playerPriceMap.set(String(player.id), Number(player.price || 0));
      }
    }

    let updatedBudgets = 0;
    for (const team of userTeams || []) {
      const lineup = team.lineup || {};
      const lineupPlayers = Object.values(lineup).filter(Boolean) as Array<{ id: string; price?: number }>;
      const oldLineupValue = lineupPlayers.reduce((sum, player) => sum + Number(player.price || 0), 0);
      const newLineupValue = lineupPlayers.reduce((sum, player) => {
        const mapped = playerPriceMap.get(String(player.id));
        const fallbackPrice = Number(player.price || 0);
        return sum + (mapped ?? fallbackPrice);
      }, 0);

      const nextBudget = parseFloat((Number(team.budget || 0) + (newLineupValue - oldLineupValue)).toFixed(2));

      const { error } = await adminSupabase
        .from('user_teams')
        .update({ budget: nextBudget })
        .eq('id', team.id);

      if (!error) updatedBudgets++;
    }

    await adminSupabase
      .from('rounds')
      .update({ status: 'completed' })
      .eq('id', roundId);

    return {
      totalPerformances,
      remainingNulls,
      updatedTeams,
      updatedPlayers,
      updatedBudgets
    };
  }

  /**
   * Carrega configurações do sistema do banco
   */
  async loadConfig(): Promise<SystemConfig> {
    if (this.config) return this.config;

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

      // 3. Calcular pontos base (soma de todos os fantasy_points)
      let basePoints = 0;
      const playersData: Array<{ team_id: string }> = [];

      for (const perf of performances) {
        const gamesCount = Number(matchGamesCount.get(Number(perf.match_id)) || 1);
        basePoints += Number(perf.fantasy_points || 0) / gamesCount;
        playersData.push({ team_id: (perf.players as any).team_id });
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
  async calculateAllScoresForRound(roundId: number) {
    try {
      console.log(`📊 Calculating all scores for round ${roundId}...`);

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

      try {
        await this.updatePlayerPricesForRound(roundId);
      } catch (error) {
        console.error('⚠️  Error updating player prices:', error);
      }

      return { successCount, errorCount, total: userTeams.length };

    } catch (error) {
      console.error('❌ Error calculating all scores:', error);
      throw error;
    }
  }

  /**
   * Atualiza preços dos jogadores com base na performance da rodada
   */
  async updatePlayerPricesForRound(roundId: number) {
    console.log(`💰 Updating player prices for round ${roundId}...`);

    const config = await this.loadConfig();
    const minPrice = typeof config.min_player_price === 'number' ? config.min_player_price : 8;
    const maxPrice = typeof config.max_player_price === 'number' ? config.max_player_price : 15;

    const { data: matches } = await adminSupabase
      .from('matches')
      .select('id, games_count')
      .eq('round_id', roundId);

    if (!matches || matches.length === 0) {
      console.log('ℹ️  No matches found for price update');
      return { updated: 0 };
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
      return { updated: 0 };
    }

    const playerStats = new Map<string, { totalPoints: number; count: number }>();

    for (const perf of performances) {
      const gamesCount = Number(matchGamesCount.get(Number(perf.match_id)) || 1);
      const normalizedPoints = Number(perf.fantasy_points || 0) / Math.max(gamesCount, 1);
      const playerId = String(perf.player_id);
      const existing = playerStats.get(playerId) || { totalPoints: 0, count: 0 };
      existing.totalPoints += normalizedPoints;
      existing.count += 1;
      playerStats.set(playerId, existing);
    }

    const playerIds = Array.from(playerStats.keys());
    const { data: players, error: playersError } = await adminSupabase
      .from('players')
      .select('id, price')
      .in('id', playerIds);

    if (playersError) throw playersError;

    if (!players || players.length === 0) {
      console.log('ℹ️  No players found for price update');
      return { updated: 0 };
    }

    let updated = 0;

    for (const player of players) {
      const stats = playerStats.get(player.id);
      if (!stats || stats.count === 0) continue;

      const avgPoints = stats.totalPoints / stats.count;
      let delta = 0;

      if (avgPoints >= 22) {
        delta = 0.6;
      } else if (avgPoints >= 16) {
        delta = 0.3;
      } else if (avgPoints <= 6) {
        delta = -0.6;
      } else if (avgPoints <= 10) {
        delta = -0.3;
      }

      if (delta === 0) continue;

      const currentPrice = typeof player.price === 'number' ? player.price : 0;
      const nextPrice = Math.max(minPrice, Math.min(maxPrice, currentPrice + delta));
      const roundedPrice = parseFloat(nextPrice.toFixed(2));

      if (roundedPrice === currentPrice) continue;

      const { error: updateError } = await adminSupabase
        .from('players')
        .update({ price: roundedPrice })
        .eq('id', player.id);

      if (updateError) {
        console.error(`⚠️  Failed to update price for player ${player.id}:`, updateError);
        continue;
      }

      updated++;
    }

    console.log(`✅ Player prices updated: ${updated}`);
    return { updated };
  }
}

export const scoringService = new ScoringService();
