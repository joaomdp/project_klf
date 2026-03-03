import { Router } from 'express';
import {
  createMatch,
  listMatches,
  getMatch,
  updateMatch,
  deleteMatch
} from '../../controllers/admin/matches.controller';

const router = Router();

/**
 * ROTAS DE MATCHES (Admin Panel)
 * 
 * Todas as rotas aqui requerem autenticação e permissão de admin
 * (middlewares aplicados no /api/admin/index.ts)
 */

// POST /api/admin/matches - Criar nova partida
router.post('/', createMatch);

// GET /api/admin/matches - Listar partidas (opcional: ?round_id=1)
router.get('/', listMatches);

// GET /api/admin/matches/:id - Obter partida específica
router.get('/:id', getMatch);

// PUT /api/admin/matches/:id - Atualizar partida
router.put('/:id', updateMatch);

// DELETE /api/admin/matches/:id - Deletar partida
router.delete('/:id', deleteMatch);

export default router;
