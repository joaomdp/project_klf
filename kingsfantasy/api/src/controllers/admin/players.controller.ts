import { Response } from 'express';
import { adminSupabase } from '../../config/supabase';
import { PLAYERS_BUCKET } from '../../scripts/utils/constants';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

/**
 * PLAYERS CONTROLLER
 * 
 * Gerencia operações de administração de jogadores (preços, etc)
 */

/**
 * Atualizar preço de um jogador
 * PUT /api/admin/players/:id/price
 */
export async function updatePlayerPrice(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { price } = req.body;

    if (price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        error: 'price é obrigatório',
        expected: 'number (entre 8 e 15)'
      });
    }

    // Validar range de preço
    if (price < 8 || price > 15) {
      return res.status(400).json({
        success: false,
        error: 'Preço deve estar entre 8 e 15 moedas',
        received: price,
        allowed_range: { min: 8, max: 15 }
      });
    }

    // Atualizar preço
    const { data: player, error: updateError } = await adminSupabase
      .from('players')
      .update({ price })
      .eq('id', id)
      .select('id, name, role, price, team_id')
      .single();

    if (updateError || !player) {
      console.error('❌ Error updating player price:', updateError);
      return res.status(404).json({
        success: false,
        error: 'Jogador não encontrado ou erro ao atualizar',
        player_id: id
      });
    }

    console.log(`✅ Player ${player.name} price updated: ${price} moedas`);

    return res.json({
      success: true,
      message: `Preço de ${player.name} atualizado para ${price} moedas`,
      player
    });

  } catch (error) {
    console.error('❌ Exception in updatePlayerPrice:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar preço',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Listar jogadores
 * GET /api/admin/players
 */
export async function listPlayers(req: AuthenticatedRequest, res: Response) {
  try {
    const { data: players, error } = await adminSupabase
      .from('players')
      .select('id, name, role, price, points, avg_points, kda, image, team_id, teams(name, logo_url)')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Error listing players:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar jogadores',
        details: error.message
      });
    }

    return res.json({
      success: true,
      total: players?.length || 0,
      players: players || []
    });
  } catch (error) {
    console.error('❌ Exception in listPlayers:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar jogadores',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Criar novo jogador
 * POST /api/admin/players
 */
export async function createPlayer(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      name,
      role,
      team_id,
      price,
      points,
      avg_points,
      kda,
      image,
      image_name,
      is_captain
    } = req.body;

    if (!name || !role) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatorios faltando',
        required: ['name', 'role']
      });
    }

    let imagePath = image;
    if (!imagePath && image_name) {
      if (!image_name.includes(',')) {
        return res.status(400).json({
          success: false,
          error: 'Formato de imagem inválido'
        });
      }

      const [meta, base64Data] = image_name.split(',', 2);
      const mimeMatch = meta.match(/data:(.*);base64/);
      const mimeType = mimeMatch?.[1] || 'image/jpeg';
      const extension = mimeType.split('/')[1] || 'jpg';
      const safeName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${extension}`;

      const buffer = Buffer.from(base64Data, 'base64');
      const uploadPath = `players/${safeName}`;

      const { error: uploadError } = await adminSupabase
        .storage
        .from(PLAYERS_BUCKET)
        .upload(uploadPath, buffer, { contentType: mimeType, upsert: true });

      if (uploadError) {
        console.error('❌ Error uploading player image:', uploadError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao enviar imagem',
          details: uploadError.message
        });
      }

      imagePath = uploadPath;
    }

    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Imagem obrigatória',
        required: ['image_name ou image']
      });
    }

    const { data: player, error } = await adminSupabase
      .from('players')
      .insert({
        name,
        role,
        team_id: team_id || null,
        price: price ?? 20,
        points: points ?? 0,
        avg_points: avg_points ?? 0,
        kda: kda ?? '0.0',
        image: imagePath,
        is_captain: is_captain ?? false
      })
      .select('id, name, role, price, points, avg_points, kda, image, team_id, teams(name, logo_url)')
      .single();

    if (error || !player) {
      console.error('❌ Error creating player:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar jogador',
        details: error?.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Jogador criado com sucesso',
      player
    });
  } catch (error) {
    console.error('❌ Exception in createPlayer:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar jogador',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Deletar jogador
 * DELETE /api/admin/players/:id
 */
export async function deletePlayer(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const { error } = await adminSupabase
      .from('players')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting player:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar jogador',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Jogador deletado com sucesso',
      player_id: id
    });
  } catch (error) {
    console.error('❌ Exception in deletePlayer:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao deletar jogador',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Atualizar jogador
 * PATCH /api/admin/players/:id
 */
export async function updatePlayer(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const {
      name,
      role,
      team_id,
      price,
      points,
      avg_points,
      kda,
      image,
      image_name,
      is_captain
    } = req.body;

    if (
      name === undefined &&
      role === undefined &&
      team_id === undefined &&
      price === undefined &&
      points === undefined &&
      avg_points === undefined &&
      kda === undefined &&
      image === undefined &&
      image_name === undefined &&
      is_captain === undefined
    ) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar fornecido'
      });
    }

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (team_id !== undefined) updateData.team_id = team_id || null;
    if (price !== undefined) updateData.price = price;
    if (points !== undefined) updateData.points = points;
    if (avg_points !== undefined) updateData.avg_points = avg_points;
    if (kda !== undefined) updateData.kda = kda;
    if (image !== undefined) updateData.image = image;

    if (image_name !== undefined) {
      if (!image_name.includes(',')) {
        return res.status(400).json({
          success: false,
          error: 'Formato de imagem inválido'
        });
      }

      const [meta, base64Data] = image_name.split(',', 2);
      const mimeMatch = meta.match(/data:(.*);base64/);
      const mimeType = mimeMatch?.[1] || 'image/jpeg';
      const extension = mimeType.split('/')[1] || 'jpg';
      const safeName = `${Date.now()}-${id}.${extension}`;

      const buffer = Buffer.from(base64Data, 'base64');
      const uploadPath = `players/${safeName}`;

      const { error: uploadError } = await adminSupabase
        .storage
        .from(PLAYERS_BUCKET)
        .upload(uploadPath, buffer, { contentType: mimeType, upsert: true });

      if (uploadError) {
        console.error('❌ Error uploading player image:', uploadError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao enviar imagem',
          details: uploadError.message
        });
      }

      updateData.image = uploadPath;
    }
    if (is_captain !== undefined) updateData.is_captain = is_captain;

    const { data: player, error } = await adminSupabase
      .from('players')
      .update(updateData)
      .eq('id', id)
      .select('id, name, role, price, points, avg_points, kda, image, team_id, teams(name, logo_url)')
      .single();

    if (error || !player) {
      console.error('❌ Error updating player:', error);
      return res.status(404).json({
        success: false,
        error: 'Jogador nao encontrado ou erro ao atualizar',
        player_id: id
      });
    }

    return res.json({
      success: true,
      message: 'Jogador atualizado com sucesso',
      player
    });
  } catch (error) {
    console.error('❌ Exception in updatePlayer:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar jogador',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Atualizar preços de múltiplos jogadores de uma vez
 * POST /api/admin/players/prices/bulk
 */
export async function bulkUpdatePrices(req: AuthenticatedRequest, res: Response) {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'updates é obrigatório e deve ser um array',
        expected: 'array de { player_id, price }'
      });
    }

    // Validar cada atualização
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      
      if (!update.player_id || update.price === undefined) {
        return res.status(400).json({
          success: false,
          error: `Update ${i + 1} inválido`,
          required_fields: ['player_id', 'price']
        });
      }

      if (update.price < 8 || update.price > 15) {
        return res.status(400).json({
          success: false,
          error: `Update ${i + 1}: preço fora do range`,
          player_id: update.player_id,
          price: update.price,
          allowed_range: { min: 8, max: 15 }
        });
      }
    }

    console.log(`💰 Updating prices for ${updates.length} players...`);

    // Atualizar cada jogador
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      try {
        const { data: player, error } = await adminSupabase
          .from('players')
          .update({ price: update.price })
          .eq('id', update.player_id)
          .select('id, name, price')
          .single();

        if (error) {
          errorCount++;
          results.push({
            player_id: update.player_id,
            success: false,
            error: error.message
          });
        } else {
          successCount++;
          results.push({
            player_id: update.player_id,
            name: player.name,
            new_price: player.price,
            success: true
          });
        }
      } catch (err) {
        errorCount++;
        results.push({
          player_id: update.player_id,
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido'
        });
      }
    }

    console.log(`✅ Bulk update complete: ${successCount} success, ${errorCount} errors`);

    return res.json({
      success: true,
      message: `Preços atualizados: ${successCount} sucesso, ${errorCount} erros`,
      summary: {
        total: updates.length,
        success: successCount,
        errors: errorCount
      },
      results
    });

  } catch (error) {
    console.error('❌ Exception in bulkUpdatePrices:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar preços',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
