import { Response } from 'express';
import { adminSupabase, supabase } from '../../config/supabase';
import { scoringService } from '../../services/scoring.service';
import { marketService } from '../../services/market.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

// Status válidos no banco: 'upcoming', 'live', 'completed', 'cancelled'
const ROUND_STATUS_INPUT_TO_DB: Record<string, 'upcoming' | 'live' | 'completed' | 'cancelled'> = {
  pending: 'upcoming',
  upcoming: 'upcoming',
  open: 'live',
  active: 'live',
  live: 'live',
  closed: 'completed',
  finished: 'completed',
  completed: 'completed',
  cancelled: 'cancelled'
};

// DB → API: mantém os mesmos valores do banco (já são user-friendly)
const ROUND_STATUS_DB_TO_API: Record<string, string> = {
  upcoming: 'upcoming',
  live: 'live',
  completed: 'completed',
  cancelled: 'cancelled'
};

function normalizeRoundStatusToDb(status?: string): 'upcoming' | 'live' | 'completed' | 'cancelled' | null {
  if (!status) return null;
  return ROUND_STATUS_INPUT_TO_DB[status] || null;
}

function mapRoundStatusToApi(status: string): string {
  return ROUND_STATUS_DB_TO_API[status] || status;
}

type FinalizeRoundCheckResult = {
  roundId: number;
  season: number;
  roundNumber: number;
  status: string;
  isMarketOpen: boolean;
  marketCloseTime: string | null;
  totalMatches: number;
  matchesMissingResults: number;
  expectedPerformances: number;
  totalPerformances: number;
  missingPerformances: number;
  performancesWithoutFantasyPoints: number;
  canFinalize: boolean;
  pendingItems: string[];
};

async function buildFinalizeRoundCheck(roundId: number): Promise<FinalizeRoundCheckResult> {
  const { data: round, error: roundError } = await adminSupabase
    .from('rounds')
    .select('id, season, round_number, status, is_market_open, market_close_time')
    .eq('id', roundId)
    .single();

  if (roundError || !round) {
    throw new Error('Rodada não encontrada');
  }

  const { data: matches, error: matchesError } = await adminSupabase
    .from('matches')
    .select('id, team_a_id, team_b_id, winner_id, team_a_score, team_b_score, games_count')
    .eq('round_id', roundId);

  if (matchesError) throw matchesError;

  const roundMatches = matches || [];
  const totalMatches = roundMatches.length;
  const matchesMissingResults = roundMatches.filter((match: any) => {
    const missingWinner = !match.winner_id;
    const missingTeamAScore = match.team_a_score === null || match.team_a_score === undefined;
    const missingTeamBScore = match.team_b_score === null || match.team_b_score === undefined;
    return missingWinner || missingTeamAScore || missingTeamBScore;
  }).length;

  const teamIds = Array.from(
    new Set(
      roundMatches.flatMap((match: any) => [String(match.team_a_id), String(match.team_b_id)])
    )
  );

  let expectedPerformances = 0;
  const matchIds = roundMatches.map((match: any) => Number(match.id));

  if (teamIds.length > 0 && roundMatches.length > 0) {
    const { data: teamPlayers, error: playersError } = await adminSupabase
      .from('players')
      .select('id, team_id')
      .in('team_id', teamIds);

    if (playersError) throw playersError;

    const playersCountByTeam = (teamPlayers || []).reduce((map: Map<string, number>, player: any) => {
      const teamId = String(player.team_id);
      const current = map.get(teamId) || 0;
      map.set(teamId, current + 1);
      return map;
    }, new Map<string, number>());

    expectedPerformances = roundMatches.reduce((sum: number, match: any) => {
      const gamesCount = Number(match.games_count || 1);
      const teamACount = playersCountByTeam.get(String(match.team_a_id)) || 0;
      const teamBCount = playersCountByTeam.get(String(match.team_b_id)) || 0;
      return sum + gamesCount * (teamACount + teamBCount);
    }, 0);
  }

  let totalPerformances = 0;
  let performancesWithoutFantasyPoints = 0;

  if (matchIds.length > 0) {
    const { data: performances, error: performancesError } = await adminSupabase
      .from('player_performances')
      .select('id, fantasy_points')
      .in('match_id', matchIds);

    if (performancesError) throw performancesError;

    totalPerformances = performances?.length || 0;
    performancesWithoutFantasyPoints = (performances || []).filter((perf: any) => perf.fantasy_points === null).length;
  }

  const missingPerformances = Math.max(expectedPerformances - totalPerformances, 0);

  const pendingItems: string[] = [];
  if (totalMatches === 0) pendingItems.push('Nenhuma partida cadastrada na rodada');
  if (matchesMissingResults > 0) pendingItems.push(`${matchesMissingResults} partida(s) sem vencedor/placar`);
  if (missingPerformances > 0) pendingItems.push(`${missingPerformances} performance(s) ainda não lançada(s)`);
  // fantasy_points serao calculados automaticamente ao finalizar a rodada

  return {
    roundId: Number(round.id),
    season: Number(round.season),
    roundNumber: Number(round.round_number),
    status: mapRoundStatusToApi(String(round.status)),
    isMarketOpen: Boolean(round.is_market_open),
    marketCloseTime: round.market_close_time || null,
    totalMatches,
    matchesMissingResults,
    expectedPerformances,
    totalPerformances,
    missingPerformances,
    performancesWithoutFantasyPoints,
    canFinalize: pendingItems.length === 0,
    pendingItems
  };
}

/**
 * ROUNDS CONTROLLER
 * 
 * Gerencia operações de administração de rodadas
 */

/**
 * Criar nova rodada
 * POST /api/admin/rounds
 */
export async function createRound(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      season,
      round_number,
      start_date,
      end_date,
      market_close_time,
      status = 'upcoming',
      is_market_open = true
    } = req.body;

    const normalizedStatus = normalizeRoundStatusToDb(status);

    if (!season || !round_number) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios faltando',
        required: ['season', 'round_number']
      });
    }

    if (start_date && end_date && new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({
        success: false,
        error: 'start_date deve ser anterior a end_date'
      });
    }

    const validStatuses = Object.keys(ROUND_STATUS_INPUT_TO_DB);
    if (!normalizedStatus) {
      return res.status(400).json({
        success: false,
        error: 'Status inválido',
        allowed_values: validStatuses,
        received: status
      });
    }

    const { data: existingRound, error: existingError } = await adminSupabase
      .from('rounds')
      .select('id')
      .eq('season', season)
      .eq('round_number', round_number)
      .maybeSingle();

    if (existingError) {
      console.error('❌ Error checking existing round:', existingError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar rodada existente',
        details: existingError.message
      });
    }

    if (existingRound) {
      return res.status(409).json({
        success: false,
        error: 'Rodada já existe para esta temporada',
        season,
        round_number
      });
    }

    const resolvedStartDate = start_date || market_close_time || new Date().toISOString();
    const resolvedMarketCloseTime = market_close_time || start_date || new Date().toISOString();

    const baseInsertPayload = {
      season,
      round_number,
      start_date: resolvedStartDate,
      end_date: end_date || null,
      market_close_time: resolvedMarketCloseTime,
      is_market_open
    };

    const statusCandidates = Array.from(new Set([
      normalizedStatus,
      'upcoming',
      'live',
      'completed',
      'cancelled'
    ].filter(Boolean))) as string[];

    let round: any = null;
    let error: any = null;

    for (const statusCandidate of statusCandidates) {
      const attempt = await adminSupabase
        .from('rounds')
        .insert({
          ...baseInsertPayload,
          status: statusCandidate
        })
        .select('*')
        .single();

      if (!attempt.error && attempt.data) {
        round = attempt.data;
        error = null;
        break;
      }

      error = attempt.error;
      if (!attempt.error?.message?.includes('rounds_status_check')) {
        break;
      }
    }

    if (error?.message?.includes('rounds_status_check') && !round) {
      const fallbackAttempt = await adminSupabase
        .from('rounds')
        .insert(baseInsertPayload)
        .select('*')
        .single();

      round = fallbackAttempt.data;
      error = fallbackAttempt.error;
    }

    if (error || !round) {
      console.error('❌ Error creating round:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar rodada',
        details: error?.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Rodada criada com sucesso',
      round: {
        ...round,
        status: mapRoundStatusToApi(round.status)
      }
    });
  } catch (error) {
    console.error('❌ Exception in createRound:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar rodada',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Atualizar datas e horários de uma rodada
 * PUT /api/admin/rounds/:id
 */
export async function updateRoundDates(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const {
      start_date,
      end_date,
      market_close_time
    } = req.body;

    if (!start_date && !end_date && !market_close_time) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar fornecido',
        allowed_fields: ['start_date', 'end_date', 'market_close_time']
      });
    }

    // Validações de lógica temporal
    if (start_date && end_date && new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({
        success: false,
        error: 'start_date deve ser anterior a end_date'
      });
    }

    // Montar objeto de atualização
    const updateData: any = {};
    if (start_date) updateData.start_date = start_date;
    if (end_date) updateData.end_date = end_date;
    if (market_close_time) updateData.market_close_time = market_close_time;

    // Atualizar rodada
    const { data: round, error: updateError } = await adminSupabase
      .from('rounds')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(id))
      .select()
      .single();

    if (updateError || !round) {
      console.error('❌ Error updating round:', updateError);
      return res.status(404).json({
        success: false,
        error: 'Rodada não encontrada ou erro ao atualizar',
        round_id: id,
        details: updateError?.message || null
      });
    }

    console.log(`✅ Round ${id} dates updated`);

    return res.json({
      success: true,
      message: 'Rodada atualizada com sucesso',
      round
    });

  } catch (error) {
    console.error('❌ Exception in updateRoundDates:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar rodada',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Alterar status de uma rodada
 * PATCH /api/admin/rounds/:id/status
 */
export async function updateRoundStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const normalizedStatus = normalizeRoundStatusToDb(status);

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status é obrigatório',
        allowed_values: ['upcoming', 'live', 'completed', 'cancelled']
      });
    }

    // Validar status
    const validStatuses = Object.keys(ROUND_STATUS_INPUT_TO_DB);
    if (!normalizedStatus) {
      return res.status(400).json({
        success: false,
        error: 'Status inválido',
        allowed_values: validStatuses,
        received: status
      });
    }

    // Buscar status atual
    const { data: currentRound, error: fetchError } = await supabase
      .from('rounds')
      .select('id, status')
      .eq('id', parseInt(id))
      .single();

    if (fetchError || !currentRound) {
      return res.status(404).json({
        success: false,
        error: 'Rodada não encontrada',
        round_id: id
      });
    }

    // Validar transição de status (opcional - pode remover se quiser permitir qualquer transição)
    const validTransitions: Record<string, string[]> = {
      upcoming: ['live', 'completed', 'cancelled'],
      live: ['completed', 'cancelled'],
      completed: ['upcoming', 'live'],
      cancelled: ['upcoming']
    };

    const allowedNextStatuses = validTransitions[currentRound.status] || [];
    if (currentRound.status !== normalizedStatus && !allowedNextStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Transição de status inválida',
        current_status: mapRoundStatusToApi(currentRound.status),
        attempted_status: status,
        allowed_transitions: allowedNextStatuses.map(mapRoundStatusToApi)
      });
    }

    // Atualizar status
    const { data: round, error: updateError } = await supabase
      .from('rounds')
      .update({ status: normalizedStatus })
      .eq('id', parseInt(id))
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating round status:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar status',
        details: updateError.message
      });
    }

    console.log(`✅ Round ${id} status changed: ${currentRound.status} → ${normalizedStatus}`);

    return res.json({
      success: true,
      message: `Status alterado de ${mapRoundStatusToApi(currentRound.status)} para ${mapRoundStatusToApi(normalizedStatus)}`,
      round: round
        ? {
            ...round,
            status: mapRoundStatusToApi(round.status)
          }
        : round
    });

  } catch (error) {
    console.error('❌ Exception in updateRoundStatus:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar status',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Listar todas as rodadas (para admin)
 * GET /api/admin/rounds
 */
export async function listRounds(req: AuthenticatedRequest, res: Response) {
  try {
    const { data: rounds, error } = await supabase
      .from('rounds')
      .select('*')
      .order('season', { ascending: false })
      .order('round_number', { ascending: false });

    if (error) {
      console.error('❌ Error listing rounds:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar rodadas',
        details: error.message
      });
    }

    const mappedRounds = (rounds || []).map((round: any) => ({
      ...round,
      status: mapRoundStatusToApi(round.status)
    }));

    return res.json({
      success: true,
      total: mappedRounds.length,
      rounds: mappedRounds
    });

  } catch (error) {
    console.error('❌ Exception in listRounds:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar rodadas',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Deletar rodada
 * DELETE /api/admin/rounds/:id
 */
export async function deleteRound(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const roundId = parseInt(id);

    const { data: matches, error: matchesError } = await adminSupabase
      .from('matches')
      .select('id')
      .eq('round_id', roundId);

    if (matchesError) {
      console.error('❌ Error fetching round matches:', matchesError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar partidas da rodada',
        details: matchesError.message
      });
    }

    const matchIds = (matches || []).map((match) => match.id);

    if (matchIds.length > 0) {
      const { error: performancesError } = await adminSupabase
        .from('player_performances')
        .delete()
        .in('match_id', matchIds);

      if (performancesError) {
        console.error('❌ Error deleting performances:', performancesError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao deletar performances da rodada',
          details: performancesError.message
        });
      }

      const { error: deleteMatchesError } = await adminSupabase
        .from('matches')
        .delete()
        .eq('round_id', roundId);

      if (deleteMatchesError) {
        console.error('❌ Error deleting matches:', deleteMatchesError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao deletar partidas da rodada',
          details: deleteMatchesError.message
        });
      }
    }

    const { error: deleteRoundError } = await adminSupabase
      .from('rounds')
      .delete()
      .eq('id', roundId);

    if (deleteRoundError) {
      console.error('❌ Error deleting round:', deleteRoundError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar rodada',
        details: deleteRoundError.message
      });
    }

    return res.json({
      success: true,
      message: 'Rodada deletada com sucesso',
      round_id: roundId,
      deleted_matches: matchIds.length
    });
  } catch (error) {
    console.error('❌ Exception in deleteRound:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao deletar rodada',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Finalizar rodada (calcula pontuacoes, valoriza jogadores e atualiza patrimonio)
 * POST /api/admin/rounds/:id/finalize
 */
export async function finalizeRound(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const roundId = Number(id);

    if (!Number.isFinite(roundId)) {
      return res.status(400).json({
        success: false,
        error: 'round_id inválido'
      });
    }

    const check = await buildFinalizeRoundCheck(roundId);

    if (!check.canFinalize) {
      return res.status(409).json({
        success: false,
        error: 'Rodada com pendências para finalização',
        check
      });
    }

    const forceRecalculate = req.body?.forceRecalculate === true;
    const result = await scoringService.finalizeRound(roundId, { forceRecalculate });

    if (result.remainingNulls > 0) {
      console.warn(`⚠️ ${result.remainingNulls} performances sem pontuação após cálculo (round ${roundId})`);
    }

    await adminSupabase
      .from('rounds')
      .update({
        is_market_open: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', roundId);

    let marketReopened = false;
    let marketRoundId: number | null = null;
    let marketWarning: string | null = null;

    try {
      const reopenResult = await marketService.openMarket();
      marketReopened = Boolean(reopenResult?.opened);
      marketRoundId = reopenResult?.roundId ? Number(reopenResult.roundId) : null;

      if (!marketReopened && reopenResult?.reason) {
        marketWarning = `Rodada finalizada, mas o mercado nao foi reaberto: ${reopenResult.reason}.`;
      }
    } catch (marketError) {
      console.error('⚠️ Error reopening market after round finalization:', marketError);
      marketWarning = 'Rodada finalizada, mas nao foi possivel reabrir o mercado automaticamente.';
    }

    return res.json({
      success: true,
      message: marketReopened
        ? 'Rodada finalizada com sucesso e mercado reaberto'
        : 'Rodada finalizada com sucesso',
      result,
      marketReopened,
      marketRoundId,
      marketWarning
    });
  } catch (error) {
    console.error('❌ Exception in finalizeRound:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao finalizar rodada',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Resetar cálculos de uma rodada finalizada
 * POST /api/admin/rounds/:id/reset-calculations
 */
export async function resetRoundCalculations(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const roundId = Number(id);

    if (!Number.isFinite(roundId)) {
      return res.status(400).json({
        success: false,
        error: 'round_id inválido'
      });
    }

    console.log(`🔄 Admin solicitou reset de cálculos para rodada ${roundId}`);

    const result = await scoringService.resetRoundCalculations(roundId);

    return res.json({
      success: true,
      message: 'Cálculos da rodada resetados com sucesso. A rodada pode ser finalizada novamente.',
      result
    });
  } catch (error) {
    console.error('❌ Exception in resetRoundCalculations:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    const statusCode = message.includes('não encontrada') ? 404
      : message.includes('não está finalizada') ? 409
      : 500;

    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
}

/**
 * Verificar checklist de finalização de rodada
 * GET /api/admin/rounds/:id/finalize-check
 */
export async function getRoundFinalizeCheck(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const roundId = Number(id);

    if (!Number.isFinite(roundId)) {
      return res.status(400).json({
        success: false,
        error: 'round_id inválido'
      });
    }

    const check = await buildFinalizeRoundCheck(roundId);
    return res.json({
      success: true,
      check
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    const statusCode = message === 'Rodada não encontrada' ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
}

/**
 * POST /admin/market/compress
 * Comprime preços do mercado em direção ao preço-base (anti-inflação).
 * Uso manual pelo admin quando o mercado está inflacionado.
 */
export async function compressMarketPrices(req: AuthenticatedRequest, res: Response) {
  try {
    const basePrice = Number(req.body?.basePrice) || 12.5;
    const result = await scoringService.compressMarketPrices(basePrice);

    return res.json({
      success: true,
      message: `${result.compressed} preços comprimidos`,
      data: {
        compressed: result.compressed,
        changes: result.changes.slice(0, 20) // Limitar resposta
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return res.status(500).json({
      success: false,
      error: message
    });
  }
}
