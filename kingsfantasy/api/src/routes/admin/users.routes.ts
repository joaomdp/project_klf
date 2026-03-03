import { Router } from 'express';
import { listUsers, resetUserTeam } from '../../controllers/admin/users.controller';

const router = Router();

/**
 * ROTAS DE USERS (Admin Panel)
 *
 * Todas as rotas requerem autenticação e permissão de admin
 */

// GET /api/admin/users - Listar usuários
router.get('/', listUsers);

// PATCH /api/admin/users/:id/reset - Resetar usuario
router.patch('/:id/reset', resetUserTeam);

export default router;
