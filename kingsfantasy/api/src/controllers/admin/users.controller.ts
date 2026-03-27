import { Response } from 'express';
import { adminSupabase, supabase } from '../../config/supabase';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

/**
 * USERS CONTROLLER
 *
 * Gerencia operações administrativas de usuários (user_teams)
 */

/**
 * Listar usuários (user_teams)
 * GET /api/admin/users
 */
export async function listUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const { data: users, error } = await adminSupabase
      .from('user_teams')
      .select('id, user_id, user_name, team_name, total_points, budget, favorite_team, avatar, created_at, updated_at')
      .order('total_points', { ascending: false });

    if (error) {
      console.error('❌ Error listing users:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar usuários',
        details: error.message
      });
    }

    return res.json({
      success: true,
      total: users?.length || 0,
      users: users || []
    });
  } catch (error) {
    console.error('❌ Exception in listUsers:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar usuários',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Editar campos de um usuario
 * PATCH /api/admin/users/:id
 */
export async function updateUser(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { budget, total_points, user_name, team_name } = req.body;

    const updateFields: Record<string, any> = {};
    if (budget !== undefined) updateFields.budget = Number(budget);
    if (total_points !== undefined) updateFields.total_points = Number(total_points);
    if (user_name !== undefined) updateFields.user_name = String(user_name);
    if (team_name !== undefined) updateFields.team_name = String(team_name);

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
    }

    updateFields.updated_at = new Date().toISOString();

    const { data: userTeam, error } = await adminSupabase
      .from('user_teams')
      .update(updateFields)
      .eq('id', parseInt(id))
      .select('id, user_id, user_name, team_name, total_points, budget')
      .single();

    if (error || !userTeam) {
      console.error('Error updating user:', error);
      return res.status(404).json({ success: false, error: 'Usuario nao encontrado' });
    }

    return res.json({ success: true, message: 'Usuario atualizado', user: userTeam });
  } catch (error) {
    console.error('Exception in updateUser:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar usuario',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Resetar pontuacao e orcamento de um usuario
 * PATCH /api/admin/users/:id/reset
 */
export async function resetUserTeam(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const { data: budgetConfig } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'initial_budget')
      .single();

    const budgetValue = budgetConfig?.value ? Number(budgetConfig.value) : 100;

    const { data: userTeam, error } = await adminSupabase
      .from('user_teams')
      .update({
        budget: budgetValue,
        total_points: 0
      })
      .eq('id', parseInt(id))
      .select('id, user_id, user_name, team_name, total_points, budget')
      .single();

    if (error || !userTeam) {
      console.error('❌ Error resetting user team:', error);
      return res.status(404).json({
        success: false,
        error: 'Usuario nao encontrado ou erro ao resetar',
        user_id: id
      });
    }

    return res.json({
      success: true,
      message: 'Usuario resetado com sucesso',
      user: userTeam
    });
  } catch (error) {
    console.error('❌ Exception in resetUserTeam:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao resetar usuario',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
