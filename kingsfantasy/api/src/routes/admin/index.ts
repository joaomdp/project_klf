import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../../middleware/auth.middleware';
import { marketService } from '../../services/market.service';
import { adminSupabase } from '../../config/supabase';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

// Importar rotas
import matchesRouter from './matches.routes';
import performancesRouter from './performances.routes';
import roundsRouter from './rounds.routes';
import playersRouter from './players.routes';
import statsRouter from './stats.routes';
import teamsRouter from './teams.routes';
import leaguesRouter from './leagues.routes';
import usersRouter from './users.routes';

const router = Router();

/**
 * ADMIN PANEL - Rotas Principais
 * 
 * Todas as rotas aqui requerem:
 * 1. Autenticação via JWT (authMiddleware)
 * 2. Permissão de administrador (adminMiddleware)
 */

// Aplicar middlewares de auth e admin em TODAS as rotas /api/admin/*
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * ============================================================================
 * ROTAS DE GERENCIAMENTO
 * ============================================================================
 */

// Matches - Gerenciamento de partidas
router.use('/matches', matchesRouter);

// Performances - Gerenciamento de performances de jogadores
router.use('/performances', performancesRouter);

// Rounds - Gerenciamento de rodadas
router.use('/rounds', roundsRouter);

// Players - Gerenciamento de jogadores (preços)
router.use('/players', playersRouter);

// Teams - Gerenciamento de times
router.use('/teams', teamsRouter);

// Leagues - Gerenciamento de ligas
router.use('/leagues', leaguesRouter);

// Users - Gerenciamento de usuários
router.use('/users', usersRouter);

// Stats - Estatísticas do sistema
router.use('/stats', statsRouter);

/**
 * ============================================================================
 * MARKET CONTROL (Protegidos agora!)
 * ============================================================================
 */

// POST /api/admin/market/force-open/:roundId - Forçar abertura do mercado
router.post('/market/force-open/:roundId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const roundId = parseInt(req.params.roundId);

    if (!Number.isFinite(roundId)) {
      return res.status(400).json({
        success: false,
        error: 'roundId inválido'
      });
    }
    
    console.log(`🔓 Admin ${req.user?.email} forcing market open for round ${roundId}`);
    
    await marketService.forceOpenMarket(roundId);
    
    res.json({
      success: true,
      message: `Mercado forçadamente aberto para rodada ${roundId}`
    });
  } catch (error) {
    console.error('❌ Error force-opening market:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao forçar abertura do mercado',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// POST /api/admin/market/force-close/:roundId - Forçar fechamento do mercado
router.post('/market/force-close/:roundId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const roundId = parseInt(req.params.roundId);

    if (!Number.isFinite(roundId)) {
      return res.status(400).json({
        success: false,
        error: 'roundId inválido'
      });
    }
    
    console.log(`🔒 Admin ${req.user?.email} forcing market close for round ${roundId}`);
    
    await marketService.forceCloseMarket(roundId);
    
    res.json({
      success: true,
      message: `Mercado forçadamente fechado para rodada ${roundId}`
    });
  } catch (error) {
    console.error('❌ Error force-closing market:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao forçar fechamento do mercado',
      message: error instanceof Error ? error.message : JSON.stringify(error)
    });
  }
});

/**
 * ============================================================================
 * RESET DATA
 * ============================================================================
 */

// POST /api/admin/reset-data - Limpar performances, matches e zerar stats
router.post('/reset-data', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { confirm } = req.body;

    if (confirm !== 'RESET') {
      return res.status(400).json({
        success: false,
        error: 'Para confirmar o reset, envie { "confirm": "RESET" } no body'
      });
    }

    console.log(`🧹 Admin ${req.user?.email} resetting all performances and matches`);

    // 1. Deletar todas as performances
    const { error: perfError } = await adminSupabase
      .from('player_performances')
      .delete()
      .neq('id', 0);

    if (perfError) {
      return res.status(500).json({ success: false, error: `Erro ao deletar performances: ${perfError.message}` });
    }

    // 2. Deletar todas as matches
    const { error: matchError } = await adminSupabase
      .from('matches')
      .delete()
      .neq('id', 0);

    if (matchError) {
      return res.status(500).json({ success: false, error: `Erro ao deletar matches: ${matchError.message}` });
    }

    // 3. Zerar stats dos jogadores e resetar preço para 20
    const { error: playersError } = await adminSupabase
      .from('players')
      .update({ points: 0, avg_points: 0, kda: '0/0/0', price: 20 })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (playersError) {
      return res.status(500).json({ success: false, error: `Erro ao zerar stats: ${playersError.message}` });
    }

    // 4. Resetar rounds para upcoming
    const { error: roundsError } = await adminSupabase
      .from('rounds')
      .update({ status: 'upcoming' })
      .neq('status', 'upcoming');

    if (roundsError) {
      return res.status(500).json({ success: false, error: `Erro ao resetar rounds: ${roundsError.message}` });
    }

    // Verificação
    const { count: perfCount } = await adminSupabase
      .from('player_performances')
      .select('id', { count: 'exact', head: true });

    const { count: matchCount } = await adminSupabase
      .from('matches')
      .select('id', { count: 'exact', head: true });

    console.log(`✅ Reset completo: ${perfCount} performances, ${matchCount} matches restantes`);

    res.json({
      success: true,
      message: 'Reset concluído! Performances, matches e stats zerados.',
      verification: {
        performances_remaining: perfCount || 0,
        matches_remaining: matchCount || 0
      }
    });
  } catch (error) {
    console.error('❌ Error resetting data:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao resetar dados',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * ============================================================================
 * INFO ENDPOINT
 * ============================================================================
 */

// GET /api/admin - Info sobre rotas disponíveis
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    message: 'Kings Lendas Fantasy - Admin Panel API',
    authenticated_as: req.user?.email,
    available_routes: {
      matches: {
        'POST   /matches': 'Criar partida',
        'GET    /matches': 'Listar partidas (opcional: ?round_id=1)',
        'GET    /matches/:id': 'Obter partida específica',
        'PUT    /matches/:id': 'Atualizar partida',
        'DELETE /matches/:id': 'Deletar partida'
      },
      performances: {
        'POST   /performances/bulk': 'Inserir 10 performances (partida completa)',
        'GET    /performances/round/:roundId': 'Listar todas performances de uma rodada',
        'GET    /performances/match/:matchId': 'Listar performances de uma partida',
        'PUT    /performances/:id': 'Atualizar performance',
        'PATCH  /performances/:id/rating': 'Atualizar analyst_rating',
        'DELETE /performances/:id': 'Deletar performance',
        'POST   /performances/recalculate-players': 'Recalcular pontos agregados dos jogadores'
      },
      rounds: {
        'GET    /rounds': 'Listar todas as rodadas',
        'PUT    /rounds/:id': 'Atualizar datas de uma rodada',
        'PATCH  /rounds/:id/status': 'Alterar status (upcoming/active/completed)'
      },
      players: {
        'GET  /players': 'Listar jogadores',
        'POST /players': 'Criar jogador',
        'DELETE /players/:id': 'Deletar jogador',
        'PATCH /players/:id': 'Atualizar jogador',
        'PUT  /players/:id/price': 'Atualizar preco de um jogador',
        'POST /players/prices/bulk': 'Atualizar multiplos precos'
      },
      teams: {
        'GET /teams': 'Listar times',
        'POST /teams': 'Criar time',
        'DELETE /teams/:id': 'Deletar time',
        'PATCH /teams/:id': 'Atualizar time'
      },
      leagues: {
        'GET /leagues': 'Listar ligas',
        'PATCH /leagues/:id': 'Atualizar is_public/is_verified'
      },
      users: {
        'GET /users': 'Listar usuarios',
        'PATCH /users/:id/reset': 'Resetar pontuacao e orcamento'
      },
      stats: {
        'GET /stats/dashboard': 'Estatisticas gerais do sistema',
        'GET /stats/round/:roundId': 'Estatisticas de uma rodada'
      },
      market: {
        'POST /market/force-open/:roundId': 'Forcar abertura do mercado',
        'POST /market/force-close/:roundId': 'Forcar fechamento do mercado'
      },
      reset: {
        'POST /reset-data': 'Limpar performances, matches e zerar stats (body: {confirm: "RESET"})'
      }
    }
  });
});

export default router;
