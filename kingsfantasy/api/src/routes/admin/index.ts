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

// POST /api/admin/setup-cup-mappings - Configurar mappings da Cup para Leaguepedia
router.post('/setup-cup-mappings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log(`🔧 Admin ${req.user?.email} setting up Cup team mappings`);

    // Buscar times do banco
    const { data: teams, error: teamsError } = await adminSupabase
      .from('teams')
      .select('id, name');

    if (teamsError || !teams) {
      return res.status(500).json({ success: false, error: `Erro ao buscar times: ${teamsError?.message}` });
    }

    // Buscar jogadores do banco
    const { data: players, error: playersError } = await adminSupabase
      .from('players')
      .select('id, name, role, team_id');

    if (playersError || !players) {
      return res.status(500).json({ success: false, error: `Erro ao buscar jogadores: ${playersError?.message}` });
    }

    // Mapeamentos de times: Leaguepedia name → DB name
    const teamMappings = [
      { leaguepedia_name: 'Gen GG', db_name: 'Gen GG' },
      { leaguepedia_name: 'Mad Mylons', db_name: 'MADMYLONS' },
      { leaguepedia_name: 'Karmine Cospe', db_name: 'Karmine Cosp' },
      { leaguepedia_name: 'SKTenis', db_name: 'SKTENIS' },
      { leaguepedia_name: 'Vôs Grandes', db_name: 'VOS GRANDES' },
      { leaguepedia_name: 'Team Sobe Muro', db_name: 'TEAM SOBE MURO' },
    ];

    // Strategy: delete existing mappings then insert fresh (avoids constraint issues)
    // Supabase requires a filter on delete — use gte on is_active to match all rows
    await adminSupabase.from('team_mappings').delete().in('is_active', [true, false]);
    await adminSupabase.from('player_mappings').delete().in('is_active', [true, false]);
    console.log('🧹 Cleared existing mappings');

    const teamResults: any[] = [];
    for (const mapping of teamMappings) {
      const dbNameNorm = mapping.db_name.toLowerCase().trim();
      const team = teams.find(t => t.name.toLowerCase().trim() === dbNameNorm);
      if (!team) {
        teamResults.push({ ...mapping, status: 'NOT_FOUND', error: `Time "${mapping.db_name}" não encontrado. Disponíveis: ${teams.map(t => t.name).join(', ')}` });
        continue;
      }

      const { error } = await adminSupabase
        .from('team_mappings')
        .insert({
          team_id: team.id,
          leaguepedia_name: mapping.leaguepedia_name,
          is_active: true
        });

      if (error) {
        teamResults.push({ ...mapping, team_id: team.id, status: 'ERROR', error: error.message });
      } else {
        teamResults.push({ ...mapping, team_id: team.id, status: 'OK' });
      }
    }

    // Player mappings: DB name → Leaguepedia name (when different)
    const playerNameOverrides: Record<string, string> = {
      'ESA': 'HamburguesA',
      'BUERO': 'Buerinho',
      'GUIGS': 'Guiggs',
      'PILOT': 'Piloto',
      'BULAS': 'Bulecha',
    };

    const playerResults: any[] = [];
    for (const player of players) {
      const leaguepediaName = playerNameOverrides[player.name] || player.name;

      const { error } = await adminSupabase
        .from('player_mappings')
        .insert({
          player_id: player.id,
          leaguepedia_name: leaguepediaName,
          is_active: true
        });

      if (error) {
        playerResults.push({
          name: player.name,
          leaguepedia_name: leaguepediaName,
          player_id: player.id,
          status: 'ERROR',
          error: error.message
        });
      } else {
        playerResults.push({ name: player.name, leaguepedia_name: leaguepediaName, player_id: player.id, status: 'OK' });
      }
    }

    res.json({
      success: true,
      message: 'Mappings da Cup configurados',
      teams: {
        total: teamResults.length,
        results: teamResults
      },
      players: {
        total: playerResults.length,
        results: playerResults
      },
      db_teams: teams.map(t => ({ id: t.id, name: t.name })),
      db_players: players.map(p => ({ id: p.id, name: p.name, role: p.role }))
    });
  } catch (error) {
    console.error('❌ Error setting up cup mappings:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao configurar mappings',
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
        error: 'Missing required fields: season and roundNumber (season can be a number or "cup")'
      });
    }

    console.log(`📥 Admin ${req.user?.email} importing Season ${season} Round ${roundNumber} from Leaguepedia`);

    // Get OverviewPage for the season (supports "cup" as season identifier)
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
    const seasonParam = req.params.season;
    const season = seasonParam.toLowerCase() === 'cup' ? 5 : parseInt(seasonParam);
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
    const seasonParam = req.params.season;
    const season = seasonParam.toLowerCase() === 'cup' ? 'cup' : parseInt(seasonParam);
    const rounds = await autoImportService.getAvailableRounds(season as any);
    
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

// GET /api/admin/debug-leaguepedia/:season/:round - Test Leaguepedia queries directly
router.get('/debug-leaguepedia/:season/:round', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { season, round } = req.params;
    const overviewPage = autoImportService.getOverviewPage(season);

    const results: any = {
      overviewPage,
      season,
      round,
      timestamp: new Date().toISOString(),
      steps: []
    };

    // Step 1: Test getAvailableWeeks
    try {
      const weeks = await autoImportService.getAvailableRounds(season as any);
      results.availableWeeks = weeks;
      results.steps.push({ step: 'getAvailableWeeks', success: true, count: weeks.length });
    } catch (err: any) {
      results.steps.push({ step: 'getAvailableWeeks', success: false, error: err.message });
    }

    // Step 2: Test getMatches
    try {
      const { leaguepediaService } = await import('../../services/leaguepedia.service');
      const matches = await leaguepediaService.getMatches(overviewPage, round);
      results.matches = matches;
      results.steps.push({ step: 'getMatches', success: true, count: matches.length });
    } catch (err: any) {
      results.steps.push({ step: 'getMatches', success: false, error: err.message });
    }

    res.json({ success: true, debug: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ============================================================================
 * AUTO IMPORT FROM RIOT API
 * ============================================================================
 */

// POST /api/admin/import-riot - Importar rodada via Riot API (busca custom games dos jogadores)
router.post('/import-riot', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { season, roundNumber, startDate, endDate } = req.body;

    if (!season || !roundNumber || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: season, roundNumber, startDate, endDate'
      });
    }

    const seasonNum = parseInt(season);
    const roundNum = parseInt(roundNumber);

    if (!Number.isFinite(seasonNum) || !Number.isFinite(roundNum)) {
      return res.status(400).json({
        success: false,
        error: 'season e roundNumber devem ser números válidos'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'startDate e endDate devem ser datas válidas (YYYY-MM-DD)'
      });
    }

    // Ajustar endDate para final do dia (23:59:59)
    end.setHours(23, 59, 59, 999);

    console.log(`📥 Admin ${req.user?.email} importing Season ${seasonNum} Round ${roundNum} via Riot API`);
    console.log(`📅 Período: ${start.toLocaleDateString()} a ${end.toLocaleDateString()}`);

    const result = await idlImporterService.importRound(seasonNum, roundNum, start, end);

    res.json({
      success: result.success,
      message: result.success
        ? `Importação concluída! ${result.matchesImported} partidas e ${result.performancesImported} performances importadas.`
        : 'Importação concluída com erros',
      stats: {
        roundId: result.roundId,
        season: result.season,
        roundNumber: result.roundNumber,
        matchesImported: result.matchesImported,
        performancesImported: result.performancesImported
      },
      matches: result.matches,
      errors: result.errors.length > 0 ? result.errors : undefined
    });
  } catch (error) {
    console.error('❌ Error importing from Riot API:', error);
    res.status(500).json({
      success: false,
      error: 'Erro fatal durante importação via Riot API',
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
      reset: {
        'POST /reset-data': 'Limpar performances, matches e zerar stats (body: {confirm: "RESET"})',
        'POST /setup-cup-mappings': 'Configurar mappings Leaguepedia para a Cup'
      },
      import: {
        'POST /import-round': 'Importar rodada do Leaguepedia (body: {season, roundNumber} - season pode ser número ou "cup")',
        'POST /import-riot': 'Importar rodada via Riot API (body: {season, roundNumber, startDate, endDate})',
        'GET  /import-status/:season/:roundNumber': 'Verificar status de importação',
        'GET  /available-rounds/:season': 'Listar rodadas disponíveis no Leaguepedia (season pode ser número ou "cup")'
      }
    }
  });
});

export default router;
