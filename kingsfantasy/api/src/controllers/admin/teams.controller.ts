import { Response } from 'express';
import { adminSupabase } from '../../config/supabase';
import { TEAMS_BUCKET } from '../../scripts/utils/constants';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

/**
 * TEAMS CONTROLLER
 *
 * Gerencia operações administrativas de times
 */

/**
 * Listar times
 * GET /api/admin/teams
 */
export async function listTeams(req: AuthenticatedRequest, res: Response) {
  try {
    const { data: teams, error } = await adminSupabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Error listing teams:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar times',
        details: error.message
      });
    }

    return res.json({
      success: true,
      total: teams?.length || 0,
      teams: teams || []
    });
  } catch (error) {
    console.error('❌ Exception in listTeams:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar times',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Criar novo time
 * POST /api/admin/teams
 */
export async function createTeam(req: AuthenticatedRequest, res: Response) {
  try {
    const { name, logo_url, logo_data } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatorios faltando',
        required: ['name']
      });
    }

    let logoPath = logo_url;
    if (!logoPath && logo_data) {
      if (!logo_data.includes(',')) {
        return res.status(400).json({
          success: false,
          error: 'Formato de logo inválido'
        });
      }

      const [meta, base64Data] = logo_data.split(',', 2);
      const mimeMatch = meta.match(/data:(.*);base64/);
      const mimeType = mimeMatch?.[1] || 'image/png';
      const extension = mimeType.split('/')[1] || 'png';
      const safeName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${extension}`;

      const buffer = Buffer.from(base64Data, 'base64');
      const uploadPath = `teams/${safeName}`;

      const { error: uploadError } = await adminSupabase
        .storage
        .from(TEAMS_BUCKET)
        .upload(uploadPath, buffer, { contentType: mimeType, upsert: true });

      if (uploadError) {
        console.error('❌ Error uploading team logo:', uploadError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao enviar logo',
          details: uploadError.message
        });
      }

      logoPath = uploadPath;
    }

    if (!logoPath) {
      return res.status(400).json({
        success: false,
        error: 'Logo obrigatório',
        required: ['logo_data ou logo_url']
      });
    }

    const { data: team, error } = await adminSupabase
      .from('teams')
      .insert({
        name,
        logo_url: logoPath
      })
      .select('*')
      .single();

    if (error || !team) {
      console.error('❌ Error creating team:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar time',
        details: error?.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Time criado com sucesso',
      team
    });
  } catch (error) {
    console.error('❌ Exception in createTeam:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar time',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Deletar time
 * DELETE /api/admin/teams/:id
 */
export async function deleteTeam(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Buscar jogadores do time
    const { data: players, error: playersError } = await adminSupabase
      .from('players')
      .select('id')
      .eq('team_id', id);

    if (playersError) {
      console.error('❌ Error fetching team players:', playersError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar jogadores do time',
        details: playersError.message
      });
    }

    const playerIds = (players || []).map((player) => player.id);

    // Deletar performances dos jogadores
    if (playerIds.length > 0) {
      const { error: performancesError } = await adminSupabase
        .from('player_performances')
        .delete()
        .in('player_id', playerIds);

      if (performancesError) {
        console.error('❌ Error deleting player performances:', performancesError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao deletar performances do time',
          details: performancesError.message
        });
      }
    }

    // Deletar partidas relacionadas ao time
    // Sanitizar id para prevenir filter injection no .or()
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
    const { error: matchesError } = await adminSupabase
      .from('matches')
      .delete()
      .or(`team_a_id.eq.${safeId},team_b_id.eq.${safeId},winner_id.eq.${safeId}`);

    if (matchesError) {
      console.error('❌ Error deleting matches:', matchesError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar partidas do time',
        details: matchesError.message
      });
    }

    // Deletar jogadores do time
    if (playerIds.length > 0) {
      const { error: playersDeleteError } = await adminSupabase
        .from('players')
        .delete()
        .eq('team_id', id);

      if (playersDeleteError) {
        console.error('❌ Error deleting players:', playersDeleteError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao deletar jogadores do time',
          details: playersDeleteError.message
        });
      }
    }

    // Remover mapeamentos (se existir)
    await adminSupabase
      .from('team_mappings')
      .delete()
      .eq('team_id', id);

    // Deletar time
    const { error: teamDeleteError } = await adminSupabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (teamDeleteError) {
      console.error('❌ Error deleting team:', teamDeleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar time',
        details: teamDeleteError.message
      });
    }

    return res.json({
      success: true,
      message: 'Time deletado com sucesso (cascade)',
      team_id: id,
      deleted_players: playerIds.length
    });
  } catch (error) {
    console.error('❌ Exception in deleteTeam:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao deletar time',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Atualizar time
 * PATCH /api/admin/teams/:id
 */
export async function updateTeam(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, logo_url, logo_data } = req.body;

    if (name === undefined && logo_url === undefined && logo_data === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar fornecido',
        allowed_fields: ['name', 'logo_url', 'logo_data']
      });
    }

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (logo_url !== undefined) updateData.logo_url = logo_url;

    if (logo_data !== undefined) {
      if (!logo_data.includes(',')) {
        return res.status(400).json({
          success: false,
          error: 'Formato de logo inválido'
        });
      }

      const [meta, base64Data] = logo_data.split(',', 2);
      const mimeMatch = meta.match(/data:(.*);base64/);
      const mimeType = mimeMatch?.[1] || 'image/png';
      const extension = mimeType.split('/')[1] || 'png';
      const safeName = `${Date.now()}-${id}.${extension}`;

      const buffer = Buffer.from(base64Data, 'base64');
      const uploadPath = `teams/${safeName}`;

      const { error: uploadError } = await adminSupabase
        .storage
        .from(TEAMS_BUCKET)
        .upload(uploadPath, buffer, { contentType: mimeType, upsert: true });

      if (uploadError) {
        console.error('❌ Error uploading team logo:', uploadError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao enviar logo',
          details: uploadError.message
        });
      }

      updateData.logo_url = uploadPath;
    }

    const { data: team, error } = await adminSupabase
      .from('teams')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !team) {
      console.error('❌ Error updating team:', error);
      return res.status(404).json({
        success: false,
        error: 'Time nao encontrado ou erro ao atualizar',
        team_id: id
      });
    }

    return res.json({
      success: true,
      message: 'Time atualizado com sucesso',
      team
    });
  } catch (error) {
    console.error('❌ Exception in updateTeam:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar time',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
