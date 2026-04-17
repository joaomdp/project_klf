import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { supabase, adminSupabase } from './config/supabase';
import { scoringService } from './services/scoring.service';
import { marketService } from './services/market.service';
import { cronJobsService } from './jobs/cron';
import adminRoutes from './routes/admin';
import { authMiddleware, adminMiddleware, AuthenticatedRequest } from './middleware/auth.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

/** Parse e valida um parâmetro numérico. Retorna null se inválido. */
const parseIntParam = (value: string): number | null => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
    'http://localhost:3000',
    'https://kingslendas.vercel.app',
    'https://www.kingslendas.vercel.app',
    'https://fantasykings.com.br',
    'https://www.fantasykings.com.br'
  ]
).map((origin) => origin.trim());

const isAllowedOrigin = (origin?: string) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && (
      url.hostname.endsWith('.kingslendas.vercel.app') ||
      url.hostname === 'kingslendas.vercel.app' ||
      url.hostname === 'fantasykings.com.br' ||
      url.hostname.endsWith('.fantasykings.com.br')
    );
  } catch (error) {
    return false;
  }
};

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

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
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requests por janela
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas requisições. Tente novamente em alguns minutos.' }
});
app.use('/api/', globalLimiter);

// Rate limiting específico para AI Coach (mais restritivo)
const aiCoachLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // 5 requests por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Limite de consultas ao AI Coach atingido. Aguarde 1 minuto.' }
});

// ============================================================================
// EMAIL OTP — in-memory store (email -> { code, expiresAt, attempts })
// ============================================================================
interface OtpEntry { code: string; expiresAt: number; attempts: number; }
const otpStore = new Map<string, OtpEntry>();

// Cleanup expired entries every 10 min
setInterval(() => {
  const now = Date.now();
  otpStore.forEach((entry, key) => {
    if (entry.expiresAt < now) otpStore.delete(key);
  });
}, 10 * 60 * 1000);

const otpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { success: false, error: 'Muitas tentativas. Aguarde 1 minuto.' }
});

app.post('/api/auth/send-otp', otpRateLimiter, async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== 'string') {
    res.status(400).json({ success: false, error: 'Email inválido.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 2 * 60 * 1000; // 2 min
  otpStore.set(normalizedEmail, { code, expiresAt, attempts: 0 });

  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@kingslendas.gg';
  const fromName = process.env.BREVO_FROM_NAME || 'Kings Lendas';

  if (!brevoApiKey) {
    console.warn(`[OTP] Código para ${normalizedEmail}: ${code} (BREVO_API_KEY não configurado)`);
    res.json({ success: true, dev: true });
    return;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: normalizedEmail }],
        subject: `${code} é o seu código Kings Lendas`,
        htmlContent: `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0F0F14;border-radius:20px;overflow:hidden;border:1px solid #1e2030;max-width:480px;margin:0 auto;font-family:Arial,sans-serif">
            <tr><td style="background:linear-gradient(90deg,#3b82f6,#8B5CF6);height:4px;font-size:0;line-height:0">&nbsp;</td></tr>
            <tr>
              <td style="padding:36px 40px 0;text-align:center">
                <img src="${process.env.APP_URL || 'https://kingsfantasy-api.onrender.com'}/logo.png" height="48" alt="Kings Lendas" style="display:inline-block;border-radius:10px" />
              </td>
            </tr>
            <tr><td style="padding:20px 40px 0"><div style="height:1px;background:linear-gradient(90deg,transparent,#1e2030,transparent)"></div></td></tr>
            <tr>
              <td style="padding:36px 40px 0;text-align:center">
                <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px">Verificação de Conta</p>
                <h1 style="font-size:26px;font-weight:900;color:#fff;margin:0 0 12px;letter-spacing:1px">Confirme seu email</h1>
                <p style="font-size:14px;color:#9ca3af;margin:0 0 28px;line-height:1.6">
                  Use o código abaixo para ativar sua conta.<br>
                  <span style="color:#6b7280;font-size:12px">Válido por 2 minutos.</span>
                </p>
                <div style="background:#1a1b2e;border:1px solid #2a2b3d;border-radius:16px;padding:28px 24px;margin-bottom:28px;position:relative">
                  <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:80px;height:2px;background:linear-gradient(90deg,#3b82f6,#8B5CF6);border-radius:0 0 4px 4px"></div>
                  <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px">Seu código</p>
                  <div style="font-family:'Courier New',monospace;font-size:46px;font-weight:900;letter-spacing:14px;color:#3b82f6">${code.split('').join(' ')}</div>
                </div>
                <div style="background:#1a1a1a;border:1px solid #2a2020;border-radius:10px;padding:12px 18px;margin-bottom:28px;text-align:left">
                  <p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.6">
                    ⚠️ <strong style="color:#f59e0b">Não solicitou isso?</strong> Ignore este email. Sua conta permanece segura.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 36px">
                <div style="height:1px;background:linear-gradient(90deg,transparent,#1e2030,transparent);margin-bottom:20px"></div>
                <p style="font-size:11px;color:#4b5563;text-align:center;margin:0;line-height:1.8">
                  Kings Lendas Fantasy<br>
                  <span style="color:#374151">Não compartilhe este código com ninguém.</span>
                </p>
              </td>
            </tr>
          </table>
        `
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[OTP] Brevo error:', err);
      res.status(500).json({ success: false, error: 'Erro ao enviar email.' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[OTP] Exception sending email:', error);
    res.status(500).json({ success: false, error: 'Erro ao enviar email.' });
  }
});

app.post('/api/auth/verify-otp', otpRateLimiter, async (req: Request, res: Response) => {
  const { email, code } = req.body as { email?: string; code?: string };
  if (!email || !code) {
    res.status(400).json({ success: false, error: 'Email e código são obrigatórios.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const entry = otpStore.get(normalizedEmail);

  if (!entry) {
    res.status(400).json({ success: false, error: 'Código expirado. Solicite um novo.' });
    return;
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalizedEmail);
    res.status(400).json({ success: false, error: 'Código expirado. Solicite um novo.' });
    return;
  }

  entry.attempts += 1;
  if (entry.attempts > 5) {
    otpStore.delete(normalizedEmail);
    res.status(400).json({ success: false, error: 'Muitas tentativas. Solicite um novo código.' });
    return;
  }

  if (entry.code !== code.trim()) {
    res.status(400).json({ success: false, error: 'Código inválido.' });
    return;
  }

  otpStore.delete(normalizedEmail);
  res.json({ success: true });
});

// ============================================================================
// PROFILE — team name update (30-day cooldown)
// ============================================================================
const RESERVED_TEAM_NAMES = ['T1', 'LOUD', 'PAIN', 'FURIA', 'FLUXO', 'RED CANIDS', 'KABUM', 'INTZ', 'LOS GRANDES', 'ITAFANTASY', 'LIBERTY', 'VIVO KEYD', 'KEYD'];
const TEAM_NAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

app.patch('/api/profile/team-name', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Não autenticado.' });
  }

  const { team_name } = req.body as { team_name?: string };
  if (!team_name || typeof team_name !== 'string') {
    return res.status(400).json({ success: false, error: 'Nome inválido.' });
  }

  const normalizedName = team_name.trim().toUpperCase();

  if (normalizedName.length < 3 || normalizedName.length > 10) {
    return res.status(400).json({ success: false, error: 'O nome deve ter entre 3 e 10 caracteres.' });
  }

  if (RESERVED_TEAM_NAMES.includes(normalizedName)) {
    return res.status(400).json({ success: false, error: 'Este nome é reservado para times oficiais.' });
  }

  const { data: current, error: fetchError } = await adminSupabase
    .from('user_teams')
    .select('id, team_name, team_name_changed_at')
    .eq('user_id', userId)
    .single();

  if (fetchError || !current) {
    return res.status(404).json({ success: false, error: 'Time não encontrado.' });
  }

  // No change
  if (current.team_name === normalizedName) {
    return res.json({ success: true, team_name: normalizedName });
  }

  // 30-day cooldown check
  if (current.team_name_changed_at) {
    const changedAt = new Date(current.team_name_changed_at).getTime();
    const elapsed = Date.now() - changedAt;
    if (elapsed < TEAM_NAME_COOLDOWN_MS) {
      const daysRemaining = Math.ceil((TEAM_NAME_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
      const nextChangeAt = new Date(changedAt + TEAM_NAME_COOLDOWN_MS).toISOString();
      return res.status(429).json({
        success: false,
        error: `Você já trocou o nome recentemente. Aguarde ${daysRemaining} dia(s).`,
        days_remaining: daysRemaining,
        next_change_at: nextChangeAt
      });
    }
  }

  // Uniqueness check (case-insensitive, excluding current user)
  const { data: taken } = await adminSupabase
    .from('user_teams')
    .select('id')
    .ilike('team_name', normalizedName)
    .neq('user_id', userId)
    .maybeSingle();

  if (taken) {
    return res.status(409).json({ success: false, error: 'Este nome já está em uso por outro time.' });
  }

  const { error: updateError } = await adminSupabase
    .from('user_teams')
    .update({
      team_name: normalizedName,
      team_name_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('[profile/team-name] update error:', updateError);
    return res.status(500).json({ success: false, error: 'Erro ao salvar nome. Tente novamente.' });
  }

  console.log(`✅ Team name updated for user ${userId}: "${current.team_name}" → "${normalizedName}"`);
  return res.json({ success: true, team_name: normalizedName });
});

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
      .in('status', ['upcoming', 'live'])
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

    if (!marketStatus.isOpen || !marketStatus.currentRound?.id) {
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

app.get('/api/players/:playerId/history', async (req: Request, res: Response) => {
  try {
    const playerId = parseIntParam(req.params.playerId);
    if (playerId === null) return res.status(400).json({ success: false, error: 'playerId inválido' });

    const { data: performances, error } = await supabase
      .from('player_performances')
      .select(`
        id,
        match_id,
        game_number,
        champion_id,
        kills,
        deaths,
        assists,
        cs,
        fantasy_points,
        is_winner,
        champion:champions!player_performances_champion_id_fkey(id, name, image_url),
        match:matches!player_performances_match_id_fkey(
          id,
          scheduled_time,
          team_a_id,
          team_b_id,
          winner_id,
          team_a:teams!matches_team_a_id_fkey(id, name, logo_url),
          team_b:teams!matches_team_b_id_fkey(id, name, logo_url),
          round:rounds!matches_round_id_fkey(id, round_number, season)
        )
      `)
      .eq('player_id', playerId)
      .not('fantasy_points', 'is', null)
      .order('match_id', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      performances: performances || []
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/schedule/upcoming', async (req: Request, res: Response) => {
  try {
    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        id,
        round_id,
        scheduled_time,
        status,
        games_count,
        team_a_id,
        team_b_id,
        team_a:teams!matches_team_a_id_fkey(id, name, logo_url),
        team_b:teams!matches_team_b_id_fkey(id, name, logo_url),
        round:rounds!matches_round_id_fkey(id, season, round_number)
      `)
      .in('status', ['scheduled', 'upcoming'])
      .not('scheduled_time', 'is', null)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    return res.json({
      success: true,
      matches: matches || []
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/players/pick-counts', async (req: Request, res: Response) => {
  try {
    const { data: teams, error } = await adminSupabase
      .from('user_teams')
      .select('lineup');

    if (error) return res.status(500).json({ error: error.message });

    const counts: Record<string, number> = {};
    for (const team of teams || []) {
      const lineup = team.lineup as Record<string, { id: string }> | null;
      if (!lineup) continue;
      for (const player of Object.values(lineup)) {
        if (player?.id) counts[String(player.id)] = (counts[String(player.id)] || 0) + 1;
      }
    }

    return res.json(counts);
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao calcular pick counts' });
  }
});

app.post('/api/market/validate-trade/:userTeamId', async (req: Request, res: Response) => {
  try {
    const userTeamId = parseIntParam(req.params.userTeamId);
    if (userTeamId === null) return res.status(400).json({ success: false, error: 'userTeamId inválido' });
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
// DEBUG: Team lookup diagnostic (TEMPORARY - remove after fixing)
// ============================================================================
app.get('/api/debug/team-lookup', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  // Test 1: minimal columns (known to work)
  const { data: t1, error: e1 } = await adminSupabase
    .from('user_teams')
    .select('id, user_id')
    .eq('user_id', userId || '')
    .single();

  // Test 2: exact same query as lineup/save
  const { data: t2, error: e2 } = await adminSupabase
    .from('user_teams')
    .select('id, budget, lineup')
    .eq('user_id', userId || '')
    .maybeSingle();

  // Test 3: select all columns
  const { data: t3, error: e3 } = await adminSupabase
    .from('user_teams')
    .select('*')
    .eq('user_id', userId || '')
    .maybeSingle();

  return res.json({
    auth_user_id: userId,
    test1_minimal: { found: !!t1, error: e1?.message, code: e1?.code },
    test2_save_query: { found: !!t2, error: e2?.message, code: e2?.code, data: t2 ? { id: t2.id, budget: t2.budget, has_lineup: !!t2.lineup } : null },
    test3_select_all: { found: !!t3, error: e3?.message, code: e3?.code, columns: t3 ? Object.keys(t3) : null }
  });
});

// ============================================================================
// LINEUP SAVE ENDPOINT (with server-side budget validation)
// ============================================================================
app.post('/api/lineup/save', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
  }

  const { lineup } = req.body;
  if (lineup === undefined || lineup === null || typeof lineup !== 'object') {
    return res.status(400).json({ success: false, error: 'Lineup inválido' });
  }

  // 1. Verificar se mercado está aberto
  let marketStatus;
  try {
    marketStatus = await marketService.getMarketStatus();
  } catch (e: any) {
    console.error('[lineup/save] Market status error:', e);
    return res.status(500).json({ success: false, error: 'Erro ao verificar mercado', debug_step: 'market_status', debug_error: e?.message });
  }
  if (!marketStatus.isOpen) {
    return res.status(403).json({ success: false, error: 'Mercado fechado. Não é possível alterar a escalação.' });
  }

  // 2. Buscar time atual do usuário
  const { data: currentTeam, error: teamError } = await adminSupabase
    .from('user_teams')
    .select('id, budget, lineup')
    .eq('user_id', userId)
    .maybeSingle();

  if (teamError) {
    return res.status(500).json({ success: false, error: 'Erro ao buscar time', debug_step: 'team_lookup', debug_error: teamError.message });
  }
  if (!currentTeam) {
    return res.status(404).json({ success: false, error: 'Time não encontrado. Faça o cadastro primeiro.' });
  }

  // 3. Normalizar roles
  const roleNormalize: Record<string, string> = {
    'top': 'TOP', 'TOP': 'TOP',
    'jungler': 'JUNGLE', 'jungle': 'JUNGLE', 'jng': 'JUNGLE', 'JUNGLE': 'JUNGLE', 'JNG': 'JUNGLE',
    'mid': 'MID', 'middle': 'MID', 'MID': 'MID',
    'adc': 'ADC', 'ADC': 'ADC',
    'support': 'SUPPORT', 'sup': 'SUPPORT', 'SUPPORT': 'SUPPORT', 'SUP': 'SUPPORT',
  };
  const normalizedLineup: Record<string, any> = {};
  for (const role of Object.keys(lineup)) {
    const normalized = roleNormalize[role];
    if (!normalized) {
      return res.status(400).json({ success: false, error: `Role inválida: ${role}` });
    }
    normalizedLineup[normalized] = lineup[role];
  }

  // 4. Coletar IDs dos jogadores
  const newPlayerIds: string[] = [];
  for (const role of Object.keys(normalizedLineup)) {
    const player = normalizedLineup[role];
    if (player && player.id) {
      if (newPlayerIds.includes(String(player.id))) {
        return res.status(400).json({ success: false, error: 'Jogador duplicado na escalação' });
      }
      newPlayerIds.push(String(player.id));
    }
  }

  // 5. Buscar preços reais dos jogadores
  let newLineupCost = 0;
  if (newPlayerIds.length > 0) {
    const { data: dbPlayers, error: playersError } = await adminSupabase
      .from('players')
      .select('id, price, role')
      .in('id', newPlayerIds);

    if (playersError) {
      return res.status(500).json({ success: false, error: 'Erro ao buscar jogadores', debug_step: 'players_lookup', debug_error: playersError.message });
    }

    const dbPlayerMap = new Map((dbPlayers || []).map((p: any) => [String(p.id), p]));

    for (const role of Object.keys(normalizedLineup)) {
      const player = normalizedLineup[role];
      if (!player || !player.id) continue;
      const dbPlayer = dbPlayerMap.get(String(player.id));
      if (!dbPlayer) {
        return res.status(400).json({ success: false, error: `Jogador ${player.id} não encontrado no banco` });
      }
      newLineupCost += Number(dbPlayer.price) || 0;
    }
  }

  // 6. Calcular custo do lineup anterior
  const currentLineup = currentTeam.lineup || {};
  let currentLineupCost = 0;
  const currentPlayerIds = Object.values(currentLineup)
    .filter((p: any) => p && p.id)
    .map((p: any) => String(p.id));

  if (currentPlayerIds.length > 0) {
    const { data: currentDbPlayers, error: oldPlayersError } = await adminSupabase
      .from('players')
      .select('id, price')
      .in('id', currentPlayerIds);

    if (oldPlayersError) {
      return res.status(500).json({ success: false, error: 'Erro ao buscar jogadores antigos', debug_step: 'old_players_lookup', debug_error: oldPlayersError.message });
    }
    currentLineupCost = (currentDbPlayers || []).reduce((sum: number, p: any) => sum + (Number(p.price) || 0), 0);
  }

  // 7. Calcular budget
  const totalBudget = Number(currentTeam.budget) + currentLineupCost;
  const newBudget = Math.round(totalBudget - newLineupCost);

  console.log(`📋 Lineup save: budget=${currentTeam.budget}, oldCost=${currentLineupCost}, newCost=${newLineupCost}, newBudget=${newBudget}`);

  if (newBudget < 0) {
    return res.status(400).json({
      success: false,
      error: `Orçamento insuficiente. Custo: C$${newLineupCost.toFixed(2)}, Disponível: C$${totalBudget.toFixed(2)}`
    });
  }

  // 8. Salvar
  const { error: updateError } = await adminSupabase
    .from('user_teams')
    .update({
      lineup: normalizedLineup,
      budget: newBudget,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error(`❌ DB update error:`, updateError);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar time', debug_step: 'db_update', debug_error: updateError.message, debug_code: updateError.code });
  }

  console.log(`✅ Lineup saved for user ${userId}: newBudget=${newBudget}`);
  return res.json({ success: true, budget: newBudget, message: 'Escalação salva com sucesso' });
});

// ============================================================================
// CLEAR LINEUP ENDPOINT (independente do mercado)
// ============================================================================
app.post('/api/lineup/clear', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
  }

  // Buscar time atual
  const { data: currentTeam, error: teamError } = await adminSupabase
    .from('user_teams')
    .select('id, budget, lineup')
    .eq('user_id', userId)
    .maybeSingle();

  if (teamError) {
    return res.status(500).json({ success: false, error: 'Erro ao buscar time', debug_step: 'team_lookup', debug_error: teamError.message });
  }
  if (!currentTeam) {
    return res.status(404).json({ success: false, error: 'Time não encontrado' });
  }

  // Calcular reembolso
  const currentLineup = currentTeam.lineup || {};
  const currentPlayerIds = Object.values(currentLineup)
    .filter((p: any) => p && p.id)
    .map((p: any) => String(p.id));

  let refund = 0;
  if (currentPlayerIds.length > 0) {
    const { data: dbPlayers, error: playersError } = await adminSupabase
      .from('players')
      .select('id, price')
      .in('id', currentPlayerIds);

    if (playersError) {
      return res.status(500).json({ success: false, error: 'Erro ao buscar jogadores', debug_step: 'players_lookup', debug_error: playersError.message });
    }
    refund = (dbPlayers || []).reduce((sum: number, p: any) => sum + (Number(p.price) || 0), 0);
  }

  const newBudget = Math.round(Number(currentTeam.budget) + refund);

  // Salvar lineup vazio
  const { error: updateError } = await adminSupabase
    .from('user_teams')
    .update({
      lineup: {},
      budget: newBudget,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (updateError) {
    return res.status(500).json({ success: false, error: 'Erro ao atualizar time', debug_step: 'db_update', debug_error: updateError.message, debug_code: updateError.code });
  }

  console.log(`✅ Lineup cleared for user ${userId}: refund=${refund.toFixed(2)}, newBudget=${newBudget}`);
  return res.json({ success: true, budget: newBudget, message: 'Escalação limpa com sucesso' });
});

// ============================================================================
// SCORING ENDPOINTS
// ============================================================================
app.get('/api/scores/round/:roundId/user/:userTeamId', async (req: Request, res: Response) => {
  try {
    const roundId = parseIntParam(req.params.roundId);
    const userTeamId = parseIntParam(req.params.userTeamId);
    if (roundId === null || userTeamId === null) return res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
    
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

app.post('/api/scores/calculate/:roundId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const roundId = parseIntParam(req.params.roundId);
    if (roundId === null) return res.status(400).json({ success: false, error: 'roundId inválido' });
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
// REFRESH PLAYER STATS ENDPOINT
// ============================================================================
app.post('/api/admin/refresh-player-stats', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    // Buscar todos os jogadores que têm performances
    const { data: performances } = await adminSupabase
      .from('player_performances')
      .select('player_id');

    if (!performances || performances.length === 0) {
      return res.json({ success: true, message: 'Nenhuma performance encontrada', updated: 0 });
    }

    const playerIds = Array.from(new Set(performances.map((p: any) => String(p.player_id))));
    const updated = await scoringService.refreshPlayerAggregates(playerIds);

    res.json({ success: true, message: `Stats atualizados para ${updated} jogadores`, updated, totalPerformances: performances.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Erro ao atualizar stats' });
  }
});

// ============================================================================
// CRON JOBS ENDPOINTS
// ============================================================================
app.get('/api/cron/status', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const status = cronJobsService.getJobsStatus();
  res.json({
    success: true,
    ...status
  });
});

app.post('/api/cron/run/market-check', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
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

app.post('/api/cron/run/scoring/:roundId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const roundId = parseIntParam(req.params.roundId);
    if (roundId === null) return res.status(400).json({ success: false, error: 'roundId inválido' });
    const result = await cronJobsService.runScoringJobNow(roundId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/cron/run/market-reopen', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
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
app.post('/api/ai/coach', aiCoachLimiter, async (req: Request, res: Response) => {
  try {
    const { query, userTeam, availablePlayers } = req.body || {};

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Pergunta inválida'
      });
    }

    // Limitar tamanho do input para evitar abuso
    if (query.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Pergunta muito longa. Máximo de 500 caracteres.'
      });
    }

    // Limitar quantidade de jogadores enviados
    if (Array.isArray(availablePlayers) && availablePlayers.length > 200) {
      return res.status(400).json({
        success: false,
        error: 'Lista de jogadores muito grande.'
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
      console.error('❌ Gemini API error:', errorText);
      return res.status(502).json({
        success: false,
        error: 'Falha ao consultar IA. Tente novamente em alguns instantes.'
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
    message: 'Endpoint not found',
    path: req.path
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
