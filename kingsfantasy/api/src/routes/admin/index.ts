import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../../middleware/auth.middleware';
import { marketService } from '../../services/market.service';
import { autoImportService } from '../../services/auto-import.service';
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
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * ============================================================================
 * AUTO IMPORT FROM LEAGUEPEDIA
 * ============================================================================
 */

// POST /api/admin/import-round - Importar rodada automaticamente do Leaguepedia
router.post('/import-round', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { season, roundNumber } = req.body;
    
    if (!season || !roundNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: season and roundNumber'
      });
    }
    
    console.log(`📥 Admin ${req.user?.email} importing Season ${season} Round ${roundNumber} from Leaguepedia`);
    
    // Get OverviewPage for the season
    const overviewPage = autoImportService.getOverviewPage(season);
    
    // Import the round
    const result = await autoImportService.importRound(overviewPage, roundNumber);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Round imported successfully!`,
        stats: {
          roundId: result.roundId,
          matchesImported: result.matchesImported,
          performancesImported: result.performancesImported
        },
        errors: result.errors.length > 0 ? result.errors : undefined
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Import failed',
        message: 'Some or all matches failed to import',
        stats: {
          roundId: result.roundId,
          matchesImported: result.matchesImported,
          performancesImported: result.performancesImported
        },
        errors: result.errors
      });
    }
  } catch (error) {
    console.error('❌ Error importing round:', error);
    res.status(500).json({
      success: false,
      error: 'Fatal error during import',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/admin/import-status/:season/:roundNumber - Check import status
router.get('/import-status/:season/:roundNumber', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const season = parseInt(req.params.season);
    const roundNumber = parseInt(req.params.roundNumber);
    
    const status = await autoImportService.getRoundImportStatus(season, roundNumber);
    
    res.json({
      success: true,
      season,
      roundNumber,
      ...status
    });
  } catch (error) {
    console.error('❌ Error checking import status:', error);
    res.status(500).json({
      success: false,
      error: 'Error checking import status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/admin/available-rounds/:season - List available rounds from Leaguepedia
router.get('/available-rounds/:season', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const season = parseInt(req.params.season);
    const rounds = await autoImportService.getAvailableRounds(season);
    
    res.json({
      success: true,
      season,
      availableRounds: rounds,
      total: rounds.length
    });
  } catch (error) {
    console.error('❌ Error getting available rounds:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting available rounds',
      message: error instanceof Error ? error.message : 'Unknown error'
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
    message: '🎮 Kings Lendas Fantasy - Admin Panel API',
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
        'PUT  /players/:id/price': 'Atualizar preço de um jogador',
        'POST /players/prices/bulk': 'Atualizar múltiplos preços'
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
        'GET /users': 'Listar usuários',
        'PATCH /users/:id/reset': 'Resetar pontuacao e orcamento'
      },
      stats: {
        'GET /stats/dashboard': 'Estatísticas gerais do sistema',
        'GET /stats/round/:roundId': 'Estatísticas de uma rodada'
      },
      market: {
        'POST /market/force-open/:roundId': 'Forçar abertura do mercado',
        'POST /market/force-close/:roundId': 'Forçar fechamento do mercado'
      },
      import: {
        'POST /import-round': 'Importar rodada do Leaguepedia (body: {season, roundNumber})',
        'GET  /import-status/:season/:roundNumber': 'Verificar status de importação',
        'GET  /available-rounds/:season': 'Listar rodadas disponíveis no Leaguepedia'
      }
    }
  });
});

export default router;
