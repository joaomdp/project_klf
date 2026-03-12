import { Response } from 'express';
import { adminSupabase, supabase } from '../../config/supabase';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

/**
 * MATCHES CONTROLLER
 * 
 * Gerencia operações CRUD de partidas (matches)
 */

/**
 * Criar nova partida
 * POST /api/admin/matches
 */
export async function createMatch(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      round_id,
      team_a_id,
      team_b_id,
      winner_id,
      scheduled_time,
      status,
      team_a_score,
      team_b_score,
      games_count
    } = req.body;

    // Validações básicas
    if (!round_id || !team_a_id || !team_b_id) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios faltando',
        required: ['round_id', 'team_a_id', 'team_b_id']
      });
    }

    if (games_count !== undefined && (Number.isNaN(Number(games_count)) || Number(games_count) <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'games_count inválido'
      });
    }

    if (team_a_score !== undefined && team_a_score !== null && Number.isNaN(Number(team_a_score))) {
      return res.status(400).json({
        success: false,
        error: 'team_a_score inválido'
      });
    }

    if (team_b_score !== undefined && team_b_score !== null && Number.isNaN(Number(team_b_score))) {
      return res.status(400).json({
        success: false,
        error: 'team_b_score inválido'
      });
    }

    // Validar que winner_id é um dos times
    if (winner_id && winner_id !== team_a_id && winner_id !== team_b_id) {
      return res.status(400).json({
        success: false,
        error: 'winner_id deve ser team_a_id ou team_b_id'
      });
    }

    // Validar que round existe
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select('id, season, round_number')
      .eq('id', round_id)
      .single();

    if (roundError || !round) {
      return res.status(404).json({
        success: false,
        error: 'Rodada não encontrada',
        round_id
      });
    }

    // Validar que times existem
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', [team_a_id, team_b_id]);

    if (teamsError || !teams || teams.length !== 2) {
      return res.status(404).json({
        success: false,
        error: 'Um ou ambos os times não foram encontrados',
        teams_requested: [team_a_id, team_b_id]
      });
    }

    // Inserir partida
    const hasResult = winner_id || (team_a_score !== undefined && team_a_score !== null) || (team_b_score !== undefined && team_b_score !== null);
    const resolvedStatus = status || (hasResult ? 'completed' : 'scheduled');
    const resolvedScheduledTime = scheduled_time || new Date().toISOString();

    const { data: match, error: matchError } = await adminSupabase
      .from('matches')
      .insert({
        round_id,
        team_a_id,
        team_b_id,
        winner_id: winner_id || null,
        scheduled_time: resolvedScheduledTime,
        status: resolvedStatus,
        team_a_score: team_a_score ?? null,
        team_b_score: team_b_score ?? null,
        games_count: games_count ?? 1
      })
      .select(`
        *,
        round:rounds(id, season, round_number),
        team_a:teams!matches_team_a_id_fkey(id, name, logo_url),
        team_b:teams!matches_team_b_id_fkey(id, name, logo_url),
        winner:teams!matches_winner_id_fkey(id, name, logo_url)
      `)
      .single();

    if (matchError) {
      console.error('❌ Error creating match:', matchError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar partida',
        details: matchError.message
      });
    }

    console.log(`✅ Match created: ${match.id} (Round ${round.round_number} - Season ${round.season})`);

    return res.status(201).json({
      success: true,
      message: 'Partida criada com sucesso',
      match
    });

  } catch (error) {
    console.error('❌ Exception in createMatch:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar partida',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Listar partidas (com filtro opcional por round_id)
 * GET /api/admin/matches?round_id=1
 */
export async function listMatches(req: AuthenticatedRequest, res: Response) {
  try {
    const { round_id } = req.query;

    let query = supabase
      .from('matches')
      .select(`
        *,
        round:rounds(id, season, round_number),
        team_a:teams!matches_team_a_id_fkey(id, name, logo_url),
        team_b:teams!matches_team_b_id_fkey(id, name, logo_url),
        winner:teams!matches_winner_id_fkey(id, name, logo_url)
      `)
      .order('scheduled_time', { ascending: false });

    // Filtrar por round_id se fornecido
    if (round_id) {
      query = query.eq('round_id', parseInt(round_id as string));
    }

    const { data: matches, error } = await query;

    if (error) {
      console.error('❌ Error listing matches:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar partidas',
        details: error.message
      });
    }

    return res.json({
      success: true,
      total: matches?.length || 0,
      round_id: round_id ? parseInt(round_id as string) : null,
      matches: matches || []
    });

  } catch (error) {
    console.error('❌ Exception in listMatches:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar partidas',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Obter partida específica por ID
 * GET /api/admin/matches/:id
 */
export async function getMatch(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const { data: match, error } = await supabase
      .from('matches')
      .select(`
        *,
        round:rounds(id, season, round_number),
        team_a:teams!matches_team_a_id_fkey(id, name, logo_url),
        team_b:teams!matches_team_b_id_fkey(id, name, logo_url),
        winner:teams!matches_winner_id_fkey(id, name, logo_url)
      `)
      .eq('id', parseInt(id))
      .single();

    if (error || !match) {
      return res.status(404).json({
        success: false,
        error: 'Partida não encontrada',
        match_id: id
      });
    }

    return res.json({
      success: true,
      match
    });

  } catch (error) {
    console.error('❌ Exception in getMatch:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar partida',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Atualizar partida
 * PUT /api/admin/matches/:id
 */
export async function updateMatch(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { winner_id, scheduled_time, status } = req.body;

    if (!winner_id && !scheduled_time && !status) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar fornecido',
        allowed_fields: ['winner_id', 'scheduled_time', 'status']
      });
    }

    // Buscar partida existente
    const { data: existingMatch, error: fetchError } = await supabase
      .from('matches')
      .select('id, team_a_id, team_b_id')
      .eq('id', parseInt(id))
      .single();

    if (fetchError || !existingMatch) {
      return res.status(404).json({
        success: false,
        error: 'Partida não encontrada',
        match_id: id
      });
    }

    // Validar winner_id se fornecido
    if (winner_id && winner_id !== existingMatch.team_a_id && winner_id !== existingMatch.team_b_id) {
      return res.status(400).json({
        success: false,
        error: 'winner_id deve ser um dos times da partida',
        team_a_id: existingMatch.team_a_id,
        team_b_id: existingMatch.team_b_id
      });
    }

    // Montar objeto de atualização
    const updateData: any = {};
    if (winner_id) updateData.winner_id = winner_id;
    if (scheduled_time) updateData.scheduled_time = scheduled_time;
    if (status) updateData.status = status;

    // Atualizar
    const { data: match, error: updateError } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', parseInt(id))
      .select(`
        *,
        round:rounds(id, season, round_number),
        team_a:teams!matches_team_a_id_fkey(id, name, logo_url),
        team_b:teams!matches_team_b_id_fkey(id, name, logo_url),
        winner:teams!matches_winner_id_fkey(id, name, logo_url)
      `)
      .single();

    if (updateError) {
      console.error('❌ Error updating match:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar partida',
        details: updateError.message
      });
    }

    console.log(`✅ Match updated: ${id}`);

    return res.json({
      success: true,
      message: 'Partida atualizada com sucesso',
      match
    });

  } catch (error) {
    console.error('❌ Exception in updateMatch:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar partida',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Deletar partida
 * DELETE /api/admin/matches/:id
 */
export async function deleteMatch(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const { error: perfDeleteError } = await adminSupabase
      .from('player_performances')
      .delete()
      .eq('match_id', parseInt(id));

    if (perfDeleteError) {
      console.error('❌ Error deleting performances:', perfDeleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar performances associadas',
        details: perfDeleteError.message
      });
    }

    // Deletar partida
    const { error: deleteError } = await adminSupabase
      .from('matches')
      .delete()
      .eq('id', parseInt(id));

    if (deleteError) {
      console.error('❌ Error deleting match:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar partida',
        details: deleteError.message
      });
    }

    console.log(`✅ Match deleted: ${id}`);

    return res.json({
      success: true,
      message: 'Partida deletada com sucesso',
      match_id: id
    });

  } catch (error) {
    console.error('❌ Exception in deleteMatch:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao deletar partida',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
