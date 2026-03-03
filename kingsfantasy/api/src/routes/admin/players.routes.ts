import { Router } from 'express';
import {
  createPlayer,
  listPlayers,
  updatePlayerPrice,
  bulkUpdatePrices,
  deletePlayer,
  updatePlayer
} from '../../controllers/admin/players.controller';

const router = Router();

/**
 * ROTAS DE PLAYERS (Admin Panel)
 * 
 * Gerenciamento de jogadores (preços, etc)
 * Todas as rotas requerem autenticação e permissão de admin
 */

// PUT /api/admin/players/:id/price - Atualizar preço de um jogador
router.put('/:id/price', updatePlayerPrice);

// GET /api/admin/players - Listar jogadores
router.get('/', listPlayers);

// POST /api/admin/players - Criar jogador
router.post('/', createPlayer);

// DELETE /api/admin/players/:id - Deletar jogador
router.delete('/:id', deletePlayer);

// PATCH /api/admin/players/:id - Atualizar jogador
router.patch('/:id', updatePlayer);

// POST /api/admin/players/prices/bulk - Atualizar múltiplos preços
router.post('/prices/bulk', bulkUpdatePrices);

export default router;
