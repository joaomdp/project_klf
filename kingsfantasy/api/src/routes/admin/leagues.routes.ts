import { Router } from 'express';
import { listLeagues, updateLeague } from '../../controllers/admin/leagues.controller';

const router = Router();

/**
 * ROTAS DE LEAGUES (Admin Panel)
 *
 * Todas as rotas requerem autenticação e permissão de admin
 */

// GET /api/admin/leagues - Listar ligas
router.get('/', listLeagues);

// PATCH /api/admin/leagues/:id - Atualizar liga
router.patch('/:id', updateLeague);

export default router;
