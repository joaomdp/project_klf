import { Router } from 'express';
import {
  bulkInsertPerformances,
  getMatchPerformances,
  updatePerformance,
  updateRating,
  deletePerformance,
  recalculatePlayerPoints
} from '../../controllers/admin/performances.controller';

const router = Router();

/**
 * ROTAS DE PLAYER PERFORMANCES (Admin Panel)
 * 
 * Todas as rotas aqui requerem autenticação e permissão de admin
 * (middlewares aplicados no /api/admin/index.ts)
 */

// POST /api/admin/performances/bulk - Inserir 10 performances de uma vez
router.post('/bulk', bulkInsertPerformances);

// GET /api/admin/performances/match/:matchId - Listar performances de uma partida
router.get('/match/:matchId', getMatchPerformances);

// PUT /api/admin/performances/:id - Atualizar performance completa
router.put('/:id', updatePerformance);

// PATCH /api/admin/performances/:id/rating - Atualizar apenas analyst_rating
router.patch('/:id/rating', updateRating);

// DELETE /api/admin/performances/:id - Deletar performance
router.delete('/:id', deletePerformance);

// POST /api/admin/performances/recalculate-players - Recalcular pontos agregados dos jogadores
router.post('/recalculate-players', recalculatePlayerPoints);

export default router;
