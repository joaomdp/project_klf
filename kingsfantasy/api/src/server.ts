import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase, adminSupabase } from './config/supabase';
import { scraperService } from './services/scraper.service';
import { scoringService } from './services/scoring.service';
import { marketService } from './services/market.service';
import { cronJobsService } from './jobs/cron';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// ============================================================================
// ADMIN PANEL ROUTES (Protected)
// ============================================================================
app.use('/api/admin', adminRoutes);

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('count')
      .limit(1);

    if (error) throw error;

    const cronStatus = cronJobsService.getJobsStatus();

    res.json({
      status: 'OK',
      message: '🎮 Kings Lendas Fantasy API is running!',
      timestamp: new Date().toISOString(),
      database: 'Connected ✅',
      environment: process.env.NODE_ENV || 'development',
      cron_jobs: `${cronStatus.totalJobs} active`
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: '❌ Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// CHAMPIONS ENDPOINTS
// ============================================================================
app.get('/api/champions', async (req: Request, res: Response) => {
  try {
    const { data, error} = await supabase
      .from('champions')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      total: data?.length || 0,
      champions: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/champions/random', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('champions')
      .select('*')
      .limit(5);

    if (error) throw error;

    res.json({
      success: true,
      total: data?.length || 0,
      champions: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// SYSTEM CONFIG ENDPOINT
// ============================================================================
app.get('/api/config', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .order('key', { ascending: true });

    if (error) throw error;

    const config: Record<string, any> = {};
    data?.forEach((item) => {
      let value = item.value;
      if (item.value_type === 'number') {
        value = parseFloat(item.value);
      } else if (item.value_type === 'boolean') {
        value = item.value === 'true';
      } else if (item.value_type === 'json') {
        value = JSON.parse(item.value);
      }
      config[item.key] = value;
    });

    res.json({
      success: true,
      total: data?.length || 0,
      config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// ROUNDS ENDPOINTS
// ============================================================================
app.get('/api/rounds', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .order('season', { ascending: false })
      .order('round_number', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      total: data?.length || 0,
      rounds: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/rounds/current', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('status', 'upcoming')
      .order('start_date', { ascending: true })
      .limit(1)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      round: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// MARKET ENDPOINTS
// ============================================================================
app.get('/api/market/status', async (req: Request, res: Response) => {
  try {
    const status = await marketService.getMarketStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/market/time-remaining', async (req: Request, res: Response) => {
  try {
    const time = await marketService.getTimeUntilMarketClose();
    res.json({
      success: true,
      timeRemaining: time
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/market/validate-trade/:userTeamId', async (req: Request, res: Response) => {
  try {
    const userTeamId = parseInt(req.params.userTeamId);
    const validation = await marketService.validateTrade(userTeamId);
    res.json({
      success: true,
      ...validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// SCORING ENDPOINTS
// ============================================================================
app.get('/api/scores/round/:roundId/user/:userTeamId', async (req: Request, res: Response) => {
  try {
    const roundId = parseInt(req.params.roundId);
    const userTeamId = parseInt(req.params.userTeamId);
    
    const score = await scoringService.calculateRoundScore(userTeamId, roundId);
    
    res.json({
      success: true,
      score
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/scores/calculate/:roundId', async (req: Request, res: Response) => {
  try {
    const roundId = parseInt(req.params.roundId);
    const result = await scoringService.calculateAllScoresForRound(roundId);
    
    res.json({
      success: true,
      message: 'Scores calculated for all teams',
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// SCRAPER ENDPOINTS
// ============================================================================
app.get('/api/scraper/teams', async (req: Request, res: Response) => {
  try {
    const teams = await scraperService.listAvailableTeams();
    res.json({
      success: true,
      teams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/scraper/players', async (req: Request, res: Response) => {
  try {
    const players = await scraperService.listAvailablePlayers();
    res.json({
      success: true,
      players
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/scraper/manual-match', async (req: Request, res: Response) => {
  try {
    const { roundId, matchData } = req.body;
    const result = await scraperService.insertManualMatchData(roundId, matchData);
    
    res.json({
      success: true,
      message: 'Match data inserted successfully',
      match: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// CRON JOBS ENDPOINTS
// ============================================================================
app.get('/api/cron/status', (req: Request, res: Response) => {
  const status = cronJobsService.getJobsStatus();
  res.json({
    success: true,
    ...status
  });
});

app.post('/api/cron/run/market-check', async (req: Request, res: Response) => {
  try {
    const result = await cronJobsService.runMarketCheckNow();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/cron/run/scoring/:roundId', async (req: Request, res: Response) => {
  try {
    const roundId = parseInt(req.params.roundId);
    const result = await cronJobsService.runScoringJobNow(roundId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/cron/run/market-reopen', async (req: Request, res: Response) => {
  try {
    const result = await cronJobsService.runMarketReopenNow();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// LEAGUES ENDPOINTS
// ============================================================================
app.get('/api/leagues/:leagueId/ranking', async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId;

    const { data: members, error: membersError } = await adminSupabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', leagueId);

    if (membersError) throw membersError;

    const userIds = (members || []).map((m: any) => m.user_id);
    if (userIds.length === 0) {
      res.json({ success: true, ranking: [] });
      return;
    }

    const { data: teams, error: teamsError } = await adminSupabase
      .from('user_teams')
      .select('id, user_name, team_name, total_points, avatar')
      .in('user_id', userIds);

    if (teamsError) throw teamsError;

    const teamIds = (teams || []).map((team: any) => team.id);
    let scoreTotals = new Map<number, number>();

    if (teamIds.length > 0) {
      const { data: scores, error: scoresError } = await adminSupabase
        .from('round_scores')
        .select('user_team_id, total_points')
        .in('user_team_id', teamIds);

      if (scoresError) throw scoresError;

      scoreTotals = (scores || []).reduce((map: Map<number, number>, row: any) => {
        const id = Number(row.user_team_id);
        const total = map.get(id) || 0;
        map.set(id, total + (row.total_points || 0));
        return map;
      }, new Map<number, number>());
    }

    const ranking = (teams || [])
      .map((team: any) => ({
        user_name: team.user_name,
        team_name: team.team_name,
        avatar: team.avatar,
        total_points: scoreTotals.get(Number(team.id)) ?? team.total_points ?? 0
      }))
      .sort((a: any, b: any) => (b.total_points || 0) - (a.total_points || 0));

    res.json({
      success: true,
      ranking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// 404 HANDLER
// ============================================================================
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: '🤔 Endpoint not found',
    availableEndpoints: [
      'GET /api/health',
      'GET /api/champions',
      'GET /api/config',
      'GET /api/rounds',
      'GET /api/rounds/current',
      'GET /api/market/status',
      'GET /api/market/time-remaining',
      'POST /api/market/validate-trade/:userTeamId',
      'GET /api/scores/round/:roundId/user/:userTeamId',
      'POST /api/scores/calculate/:roundId',
      'GET /api/scraper/teams',
      'GET /api/scraper/players',
      'POST /api/scraper/manual-match',
      'GET /api/cron/status',
      'POST /api/cron/run/market-check',
      'POST /api/cron/run/scoring/:roundId',
      'POST /api/cron/run/market-reopen',
      'GET /api/leagues/:leagueId/ranking'
    ]
  });
});

// ============================================================================
// START SERVER & CRON JOBS
// ============================================================================
app.listen(PORT, () => {
  console.log('');
  console.log('🎮 ===============================================');
  console.log('   KINGS LENDAS FANTASY API');
  console.log('================================================');
  console.log(`🚀 Server running on: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('================================================');
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log('');
  console.log('   ✅ BASIC');
  console.log('   GET  /api/health              - Health check + DB');
  console.log('   GET  /api/champions           - List all champions');
  console.log('   GET  /api/config              - System config');
  console.log('   GET  /api/rounds              - List rounds');
  console.log('');
  console.log('   🔒 MARKET');
  console.log('   GET  /api/market/status        - Market status');
  console.log('   GET  /api/market/time-remaining - Time until close');
  console.log('   POST /api/market/validate-trade/:id - Validate trade');
  console.log('');
  console.log('   📊 SCORING');
  console.log('   GET  /api/scores/round/:r/user/:u  - User score');
  console.log('   POST /api/scores/calculate/:r - Calculate all scores');
  console.log('');
  console.log('   🕷️  SCRAPER');
  console.log('   GET  /api/scraper/teams        - List teams');
  console.log('   GET  /api/scraper/players      - List players');
  console.log('   POST /api/scraper/manual-match - Insert match data');
  console.log('');
  console.log('   ⏰ CRON JOBS');
  console.log('   GET  /api/cron/status          - Jobs status');
  console.log('   POST /api/cron/run/market-check - Run market check');
  console.log('   POST /api/cron/run/scoring/:r  - Run scoring');
  console.log('   POST /api/cron/run/market-reopen - Reopen market');
  console.log('');
  console.log('================================================');
  console.log('');

  // Iniciar cron jobs
  cronJobsService.startAllJobs();
});
