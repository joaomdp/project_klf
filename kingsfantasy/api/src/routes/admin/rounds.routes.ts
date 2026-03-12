import { Router } from 'express';
import {
  createRound,
  updateRoundDates,
  updateRoundStatus,
  listRounds,
  deleteRound,
  finalizeRound,
  getRoundFinalizeCheck
} from '../../controllers/admin/rounds.controller';

const router = Router();

/**
 * ROTAS DE ROUNDS (Admin Panel)
 * 
 * Todas as rotas aqui requerem autenticação e permissão de admin
 * (middlewares aplicados no /api/admin/index.ts)
 */

// GET /api/admin/rounds - Listar todas as rodadas
router.get('/', listRounds);

// POST /api/admin/rounds - Criar nova rodada
router.post('/', createRound);

// PUT /api/admin/rounds/:id - Atualizar datas de uma rodada
router.put('/:id', updateRoundDates);

// PATCH /api/admin/rounds/:id/status - Alterar status de uma rodada
router.patch('/:id/status', updateRoundStatus);

// POST /api/admin/rounds/:id/finalize - Finalizar rodada
router.post('/:id/finalize', finalizeRound);

// GET /api/admin/rounds/:id/finalize-check - Checklist antes de finalizar
router.get('/:id/finalize-check', getRoundFinalizeCheck);

// DELETE /api/admin/rounds/:id - Deletar rodada
router.delete('/:id', deleteRound);

export default router;
