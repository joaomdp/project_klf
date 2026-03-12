import { Response } from 'express';
import { adminSupabase, supabase } from '../../config/supabase';
import { scoringService } from '../../services/scoring.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const ROUND_STATUS_INPUT_TO_DB: Record<string, 'pending' | 'open' | 'closed' | 'finished'> = {
  pending: 'pending',
  upcoming: 'pending',
  open: 'open',
  active: 'open',
  live: 'open',
  closed: 'closed',
  finished: 'finished',
  completed: 'finished'
};

const ROUND_STATUS_DB_TO_API: Record<string, 'upcoming' | 'active' | 'completed'> = {
  pending: 'upcoming',
  open: 'active',
  closed: 'completed',
  finished: 'completed'
};

function normalizeRoundStatusToDb(status?: string): 'pending' | 'open' | 'closed' | 'finished' | null {
  if (!status) return null;
  return ROUND_STATUS_INPUT_TO_DB[status] || null;
}

function mapRoundStatusToApi(status: string): string {
  return ROUND_STATUS_DB_TO_API[status] || status;
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

    const { data: round, error } = await adminSupabase
      .from('rounds')
      .insert({
        season,
        round_number,
        start_date: resolvedStartDate,
        end_date: end_date || null,
        market_close_time: resolvedMarketCloseTime,
        status: normalizedStatus,
        is_market_open
      })
      .select('*')
      .single();

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
    const { data: round, error: updateError } = await supabase
      .from('rounds')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (updateError || !round) {
      console.error('❌ Error updating round:', updateError);
      return res.status(404).json({
        success: false,
        error: 'Rodada não encontrada ou erro ao atualizar',
        round_id: id
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
        allowed_values: ['upcoming', 'active', 'completed']
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
      pending: ['open', 'closed', 'finished'],
      open: ['closed', 'finished'],
      closed: ['finished'],
      finished: []
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

    const { data: matches, error: matchesError } = await supabase
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
      const { error: performancesError } = await supabase
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

      const { error: deleteMatchesError } = await supabase
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

    const { error: deleteRoundError } = await supabase
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

    const { data: round, error: roundError } = await adminSupabase
      .from('rounds')
      .select('id, status')
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      return res.status(404).json({
        success: false,
        error: 'Rodada não encontrada',
        round_id: roundId
      });
    }

    const result = await scoringService.finalizeRound(roundId);

    if (result.remainingNulls > 0) {
      return res.status(409).json({
        success: false,
        error: 'Ainda existem performances sem pontuação',
        remainingNulls: result.remainingNulls,
        totalPerformances: result.totalPerformances
      });
    }

    return res.json({
      success: true,
      message: 'Rodada finalizada com sucesso',
      result
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
