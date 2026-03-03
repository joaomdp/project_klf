import { Response } from 'express';
import { adminSupabase } from '../../config/supabase';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

/**
 * LEAGUES CONTROLLER
 *
 * Gerencia operações administrativas de ligas
 */

/**
 * Listar ligas
 * GET /api/admin/leagues
 */
export async function listLeagues(req: AuthenticatedRequest, res: Response) {
  try {
    const { data: leagues, error } = await adminSupabase
      .from('leagues')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Error listing leagues:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar ligas',
        details: error.message
      });
    }

    return res.json({
      success: true,
      total: leagues?.length || 0,
      leagues: leagues || []
    });
  } catch (error) {
    console.error('❌ Exception in listLeagues:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar ligas',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Atualizar visibilidade/publicacao e verificacao da liga
 * PATCH /api/admin/leagues/:id
 */
export async function updateLeague(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { is_public, is_verified } = req.body;

    if (is_public === undefined && is_verified === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar fornecido',
        allowed_fields: ['is_public', 'is_verified']
      });
    }

    const updateData: Record<string, any> = {};
    if (is_public !== undefined) updateData.is_public = is_public;
    if (is_verified !== undefined) updateData.is_verified = is_verified;

    const { data: league, error } = await adminSupabase
      .from('leagues')
      .update(updateData)
      .eq('id', parseInt(id))
      .select('id, name, code, is_public, is_verified')
      .single();

    if (error || !league) {
      console.error('❌ Error updating league:', error);
      return res.status(404).json({
        success: false,
        error: 'Liga nao encontrada ou erro ao atualizar',
        league_id: id
      });
    }

    return res.json({
      success: true,
      message: 'Liga atualizada com sucesso',
      league
    });
  } catch (error) {
    console.error('❌ Exception in updateLeague:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar liga',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
