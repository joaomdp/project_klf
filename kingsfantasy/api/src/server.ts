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
const allowedOrigins = (process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
    'http://localhost:3000',
    'https://kingslendas.vercel.app',
    'https://www.kingslendas.vercel.app'
  ]
).map((origin) => origin.trim());

const isAllowedOrigin = (origin?: string) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
  } catch (error) {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
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

app.get('/api/market/matchups/current', async (req: Request, res: Response) => {
  try {
    const marketStatus = await marketService.getMarketStatus();

    if (!marketStatus.currentRound?.id) {
      return res.json({
        success: true,
        round: null,
        matches: []
      });
    }

    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        id,
        round_id,
        scheduled_time,
        status,
        team_a_id,
        team_b_id,
        team_a:teams!matches_team_a_id_fkey(id, name, logo_url),
        team_b:teams!matches_team_b_id_fkey(id, name, logo_url)
      `)
      .eq('round_id', marketStatus.currentRound.id)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    return res.json({
      success: true,
      round: marketStatus.currentRound,
      matches: matches || []
    });
  } catch (error) {
    return res.status(500).json({
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
// AI COACH ENDPOINT
// ============================================================================
app.post('/api/ai/coach', async (req: Request, res: Response) => {
  try {
    const { query, userTeam, availablePlayers } = req.body || {};

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Pergunta inválida'
      });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY não configurada no backend'
      });
    }

    const safePlayers = Array.isArray(availablePlayers)
      ? availablePlayers.map((player: any) => ({
          id: String(player?.id || ''),
          name: String(player?.name || 'Jogador'),
          role: String(player?.role || '-'),
          price: Number(player?.price || 0),
          avgPoints: Number(player?.avgPoints || 0),
          points: Number(player?.points || 0)
        }))
      : [];

    const lineup = userTeam?.players || {};
    const hiredPlayers = Object.values(lineup).filter(Boolean) as any[];

    const currentTeamInfo = hiredPlayers.length > 0
      ? hiredPlayers
          .map((player) => {
            const avg = Number(player?.avgPoints || 0).toFixed(1);
            const points = Number(player?.points || 0).toFixed(1);
            const price = Number(player?.price || 0).toFixed(1);
            return `${player?.name || 'Jogador'} (${player?.role || '-'}) - C$${price} - ${points}pts - Media: ${avg}`;
          })
          .join('\n  ')
      : 'Ainda não escalou jogadores';

    const budget = Number(userTeam?.budget || 0);
    const teamValue = hiredPlayers.reduce((sum, player: any) => sum + Number(player?.price || 0), 0);
    const emptySlots = Math.max(0, 5 - hiredPlayers.length);
    const totalPoints = Number(userTeam?.totalPoints || 0);

    const topValuePlayers = safePlayers
      .map((player) => ({
        ...player,
        valueRatio: player.price > 0 ? player.avgPoints / player.price : 0
      }))
      .sort((a, b) => b.valueRatio - a.valueRatio)
      .slice(0, 10);

    const affordablePlayers = safePlayers
      .filter((player) => player.price <= budget)
      .sort((a, b) => b.avgPoints - a.avgPoints)
      .slice(0, 15);

    const marketContext = safePlayers.length > 0
      ? `\n\n📊 DADOS DO MERCADO (${safePlayers.length} jogadores disponíveis):\n\n🏆 TOP 10 CUSTO-BENEFÍCIO:\n${topValuePlayers
          .map(
            (player, index) =>
              `${index + 1}. ${player.name} (${player.role}) - C$${player.price.toFixed(1)} - Media: ${player.avgPoints.toFixed(1)} - Ratio: ${player.valueRatio.toFixed(2)}`
          )
          .join('\n')}\n\n💰 TOP 15 ACESSÍVEIS (C$${budget.toFixed(1)}):\n${affordablePlayers
          .map(
            (player, index) =>
              `${index + 1}. ${player.name} (${player.role}) - C$${player.price.toFixed(1)} - Media: ${player.avgPoints.toFixed(1)}`
          )
          .join('\n')}`
      : '';

    const prompt = `Você é o AI-SOLUT, assistente de fantasy especializado em League of Legends da Kings Lendas.\n\n📋 TIME ATUAL:\n  ${currentTeamInfo}\n\n💼 SITUAÇÃO FINANCEIRA:\n  - Orçamento disponível: C$${budget.toFixed(1)}\n  - Valor investido no time: C$${teamValue.toFixed(1)}\n  - Vagas vazias: ${emptySlots}\n  - Total de pontos: ${totalPoints.toFixed(2)}\n\n${marketContext}\n\n❓ PERGUNTA: "${query.trim()}"\n\nINSTRUÇÕES:\n1. Responda em português do Brasil\n2. Seja objetivo e estratégico\n3. Considere orçamento e custo-benefício\n4. Ao sugerir jogador, cite nome, posição, preço e média\n5. Use emojis de forma moderada\n6. Evite respostas genéricas`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.4
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return res.status(502).json({
        success: false,
        error: 'Falha ao consultar IA',
        details: errorText
      });
    }

    const geminiData: any = await geminiResponse.json();
    const text = geminiData?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text || '')
      .join('')
      .trim();

    if (!text) {
      return res.status(502).json({
        success: false,
        error: 'IA não retornou conteúdo'
      });
    }

    return res.json({
      success: true,
      response: text
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno'
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
