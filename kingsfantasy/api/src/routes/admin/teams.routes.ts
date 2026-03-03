import { Router } from 'express';
import { listTeams, createTeam, deleteTeam, updateTeam } from '../../controllers/admin/teams.controller';

const router = Router();

/**
 * ROTAS DE TEAMS (Admin Panel)
 *
 * Todas as rotas requerem autenticação e permissão de admin
 */

// GET /api/admin/teams - Listar times
router.get('/', listTeams);

// POST /api/admin/teams - Criar time
router.post('/', createTeam);

// DELETE /api/admin/teams/:id - Deletar time
router.delete('/:id', deleteTeam);

// PATCH /api/admin/teams/:id - Atualizar time
router.patch('/:id', updateTeam);

export default router;
