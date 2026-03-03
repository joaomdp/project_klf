import { Router } from 'express';
import {
  getDashboardStats,
  getRoundStats
} from '../../controllers/admin/stats.controller';

const router = Router();

/**
 * ROTAS DE STATISTICS (Admin Panel)
 * 
 * Estatísticas gerais do sistema
 * Todas as rotas requerem autenticação e permissão de admin
 */

// GET /api/admin/stats/dashboard - Estatísticas gerais do sistema
router.get('/dashboard', getDashboardStats);

// GET /api/admin/stats/round/:roundId - Estatísticas de uma rodada específica
router.get('/round/:roundId', getRoundStats);

export default router;
