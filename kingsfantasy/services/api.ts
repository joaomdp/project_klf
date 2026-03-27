
import { Player, UserTeam, Role, League, RankingEntry } from '../types';
import { INITIAL_BUDGET } from '../constants';

/**
 * CONFIGURAÇÃO DO BACKEND KINGS LENDAS 2026
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const AUTH_DEBUG_ENABLED = import.meta.env.DEV && import.meta.env.VITE_AUTH_DEBUG === 'true';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  if (import.meta.env.DEV) {
    console.warn('Supabase env vars are not configured. API calls will fail until you set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  } else {
    throw new Error('Supabase env vars are not configured.');
  }
}

const buildAuthHeaders = (
  anonKey: string,
  userToken?: string | null,
  options?: {
    allowAnonFallback?: boolean;
    includeContentType?: boolean;
    prefer?: string;
  }
) => {
  const token = options?.allowAnonFallback === false ? userToken : (userToken || anonKey);
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${token}`
  };

  if (options?.includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  if (options?.prefer) {
    headers['Prefer'] = options.prefer;
  }

  return headers;
};

const logAuthDebug = (label: string, anonKey: string, userToken?: string | null) => {
  if (!AUTH_DEBUG_ENABLED) return;
  console.log(`🔍 DEBUG ${label} - anonKey: ${anonKey.substring(0, 20)}...`);
  console.log(`🔍 DEBUG ${label} - userToken: ${userToken ? userToken.substring(0, 20) + '...' : 'NULL'}`);
};

const mapDbRoleToEnum = (rawRole?: string | null): Role => {
  const dbRole = (rawRole || 'TOP').toUpperCase().trim();

  if (dbRole === 'TOP' || dbRole.includes('TOPO')) {
    return Role.TOP;
  }

  if (dbRole === 'JNG' || dbRole === 'JUNGLE' || dbRole === 'JUNGLER' || dbRole.includes('CAÇA')) {
    return Role.JNG;
  }

  if (dbRole === 'MID' || dbRole === 'MIDDLE' || dbRole.includes('MEIO')) {
    return Role.MID;
  }

  if (dbRole === 'ADC' || dbRole === 'AD' || dbRole.includes('ATIRADOR')) {
    return Role.ADC;
  }

  if (dbRole === 'SUP' || dbRole === 'SUPPORT' || dbRole === 'SUPORTE') {
    return Role.SUP;
  }

  return Role.TOP;
};

const buildSimplifiedLineup = (players: UserTeam['players']) => {
  return Object.keys(players).reduce<Record<string, Player>>((lineup, role) => {
    const player = players[role as Role];
    if (!player) return lineup;

    lineup[role] = {
      id: player.id,
      name: player.name,
      role: player.role,
      team: player.team,
      teamLogo: player.teamLogo,
      price: player.price,
      points: player.points,
      avgPoints: player.avgPoints,
      kda: player.kda,
      image: player.image,
      lastChampion: player.lastChampion,
      selectedChampion: player.selectedChampion
    };

    return lineup;
  }, {});
};

const mapLeagueResponse = (league: any): League => ({
  id: league.id.toString(),
  name: league.name,
  code: league.code,
  icon: league.icon || 'fa-trophy',
  isPublic: league.is_public || false,
  isVerified: league.is_verified || false,
  createdBy: league.created_by,
  createdAt: league.created_at,
  logoUrl: league.logo_url
});

const mapTeamToRankingEntry = (team: any, index: number): RankingEntry => ({
  rank: index + 1,
  userName: team.user_name || 'INVOCADOR',
  teamName: team.team_name || 'TIME',
  points: team.total_points || 0,
  trend: 'stable' as const,
  avatar: team.avatar
});

const TEAM_CODE_MAP: {[key: string]: string} = {
  'Gen GG': 'GENGG',
  'GenGG': 'GENGG',
  'GEN.G': 'GENGG',
  'Karmine Cospe': 'KARMINE',
  'Karmine': 'KARMINE',
  'FONatic': 'FONATIC',
  'Fonatic': 'FONATIC',
  'FNC': 'FONATIC',
  'ÉanDG': 'EANDG',
  'EanDG': 'EANDG',
  'EDG': 'EANDG',
  'paiNtriotas': 'PAINTRIOTAS',
  'Paintriotas': 'PAINTRIOTAS',
  'paiN': 'PAINTRIOTAS',
  'G12 Esports': 'G12',
  'G12': 'G12',
  'G2 Esports': 'G12',
  'Vôs Grandes': 'VOSGRANDES',
  'Vos Grandes': 'VOSGRANDES',
  'Los Grandes': 'VOSGRANDES',
  'Oreiudos Esports': 'OREIUDOS',
  'Oreiudos': 'OREIUDOS',
  'Orioles': 'OREIUDOS',
  'Tepei Assassins': 'TEPEI',
  'Tepei': 'TEPEI',
  'T1': 'TEPEI',
  '100Vices': 'VICES100',
  '100 Vices': 'VICES100',
  '100 Thieves': 'VICES100'
};

export const DataService = {
  SUPABASE_URL,
  
  /**
   * Gets the anon key for API requests
   * @returns Supabase anon key
   */
  getAnonKey() {
    return SUPABASE_ANON_KEY;
  },

  /**
   * Gets the user's access token if authenticated
   * @returns User's JWT token or null
   */
  getUserToken() {
    const sessionStr = localStorage.getItem('nexus_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        return session?.access_token || null;
      } catch (error) {
        console.warn('Failed to parse session:', error);
        return null;
      }
    }
    return null;
  },

  /**
   * Gets the active authentication key/token
   * Returns user's JWT token if authenticated, otherwise returns anon key
   * @deprecated Use getAnonKey() and getUserToken() instead for better control
   */
  getActiveKey() {
    return this.getUserToken() || SUPABASE_ANON_KEY;
  },

  getStorageUrl(bucket: 'players' | 'teams' | 'avatars', path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
  },

  async uploadAdminImage(bucket: 'players' | 'teams', file: File, folder: string): Promise<{ ok: boolean; path?: string; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${folder}/${Date.now()}-${safeName}`;

    try {
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${userToken}`,
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'true'
        },
        body: file
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao enviar imagem' };
      }

      return { ok: true, path: filePath };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async createAdminPlayerWithImage(payload: {
    name: string;
    role: string;
    team_id?: string | null;
    price?: number;
    points?: number;
    avg_points?: number;
    kda?: string;
    image_name: string;
    is_captain?: boolean;
  }): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/players`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao criar jogador' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async checkConnection(): Promise<{ok: boolean, error?: string}> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    logAuthDebug('checkConnection', anonKey, userToken);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/players?select=id&limit=1`, {
        headers: buildAuthHeaders(anonKey, userToken)
      });
      return { ok: res.ok };
    } catch (e) {
      return { ok: false, error: 'Erro de rede' };
    }
  },

  async checkTeamNameExists(name: string): Promise<boolean> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    try {
      const normalizedName = name.trim().toUpperCase();
      // Verifica na tabela user_teams se existe algum time com este nome (case insensitive)
      const response = await fetch(`${SUPABASE_URL}/rest/v1/user_teams?team_name=ilike.${encodeURIComponent(normalizedName)}&select=id&limit=1`, {
        headers: buildAuthHeaders(anonKey, userToken)
      });
      
      if (!response.ok) return false;
      const data = await response.json();
      return data.length > 0;
    } catch (error) {
      console.error("Erro ao verificar nome do time:", error);
      return false;
    }
  },

  async checkUserNameExists(userName: string): Promise<boolean> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    try {
      const normalizedUserName = userName.trim().toUpperCase();
      const response = await fetch(`${SUPABASE_URL}/rest/v1/user_teams?user_name=ilike.${encodeURIComponent(normalizedUserName)}&select=id&limit=1`, {
        headers: buildAuthHeaders(anonKey, userToken)
      });
      
      if (!response.ok) return false;
      const data = await response.json();
      return data.length > 0;
    } catch (error) {
      console.error("Erro ao verificar username:", error);
      return false;
    }
  },

  async createUserTeam(team: UserTeam): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado.' };
    }

    const normalizedUserName = team.userName.trim().toUpperCase();
    const normalizedTeamName = team.name.trim().toUpperCase();

    const userNameExists = await this.checkUserNameExists(normalizedUserName);
    if (userNameExists) {
      return { ok: false, error: 'Username já cadastrado.' };
    }

    const teamNameExists = await this.checkTeamNameExists(normalizedTeamName);
    if (teamNameExists) {
      return { ok: false, error: 'Nome do time já cadastrado.' };
    }

    const simplifiedLineup = buildSimplifiedLineup(team.players);
    const payload = {
      user_id: team.userId,
      user_name: team.userName,
      team_name: team.name,
      budget: Number((Number(team.budget) || 0).toFixed(2)),
      total_points: Number((Number(team.totalPoints) || 0).toFixed(2)),
      lineup: simplifiedLineup,
      favorite_team: team.favoriteTeam,
      avatar: team.avatar,
      updated_at: new Date().toISOString()
    };

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/user_teams`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, { includeContentType: true, prefer: 'return=minimal', allowAnonFallback: false }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro ao criar usuário:', response.status, errorText);
        return { ok: false, error: errorText || 'Erro ao criar usuário.' };
      }

      return { ok: true };
    } catch (error) {
      console.error('❌ Erro ao salvar dados do usuário:', error);
      return { ok: false, error: 'Erro ao salvar dados do usuário.' };
    }
  },

  async getTeams(): Promise<{id: string, name: string, logo: string}[]> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    logAuthDebug('getTeams', anonKey, userToken);
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=*`, {
        headers: buildAuthHeaders(anonKey, userToken)
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((t: any) => ({
        id: t.id.toString(),
        name: t.name,
        logo: this.getStorageUrl('teams', t.logo_url)
      }));
    } catch (e) {
      console.error("Erro ao buscar times:", e);
      return [];
    }
  },

  async getTeamStandings(): Promise<{ rank: number; name: string; wins: number; losses: number; logo: string }[]> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    logAuthDebug('getTeamStandings', anonKey, userToken);
    try {
      const [teamsResponse, matchesResponse] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/teams?select=id,name,logo_url`, {
          headers: buildAuthHeaders(anonKey, userToken)
        }),
        fetch(`${SUPABASE_URL}/rest/v1/matches?select=team_a_id,team_b_id,winner_id,status`, {
          headers: buildAuthHeaders(anonKey, userToken)
        })
      ]);

      if (!teamsResponse.ok) return [];

      const teams = await teamsResponse.json();
      const teamMap = new Map<string, { id: string; name: string; logo: string; wins: number; losses: number }>();

      teams.forEach((team: any) => {
        const id = team.id?.toString();
        if (!id) return;
        teamMap.set(id, {
          id,
          name: team.name || 'TIME',
          logo: this.getStorageUrl('teams', team.logo_url),
          wins: 0,
          losses: 0
        });
      });

      if (matchesResponse.ok) {
        const matches = await matchesResponse.json();
        matches.forEach((match: any) => {
          if (!match?.winner_id) return;
          const status = (match.status || '').toString().toLowerCase();
          if (status && !['completed', 'finished', 'done'].includes(status)) {
            return;
          }

          const teamA = match.team_a_id?.toString();
          const teamB = match.team_b_id?.toString();
          const winner = match.winner_id?.toString();

          if (!teamA || !teamB || !winner) return;

          const winnerEntry = teamMap.get(winner);
          if (winnerEntry) {
            winnerEntry.wins += 1;
          }

          const loserId = winner === teamA ? teamB : teamA;
          const loserEntry = teamMap.get(loserId);
          if (loserEntry) {
            loserEntry.losses += 1;
          }
        });
      }

      const standings = Array.from(teamMap.values())
        .sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (a.losses !== b.losses) return a.losses - b.losses;
          return a.name.localeCompare(b.name);
        })
        .map((team, index) => ({
          rank: index + 1,
          name: team.name,
          wins: team.wins,
          losses: team.losses,
          logo: team.logo
        }));

      return standings;
    } catch (e) {
      console.error('Erro ao buscar standings:', e);
      return [];
    }
  },

  async getPlayers(): Promise<Player[]> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    logAuthDebug('getPlayers', anonKey, userToken);
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/players?select=*,teams(*)`, {
        headers: buildAuthHeaders(anonKey, userToken, { includeContentType: true })
      });

      if (!response.ok) return [];
      
      const rawData = await response.json();
      
      return rawData.map((item: any) => {
        const teamData = item.teams || item.team || {};
        
        const mappedRole = mapDbRoleToEnum(item.role);
        if (item.role && mappedRole === Role.TOP && !item.role.toUpperCase().includes('TOP')) {
          console.warn('⚠️ Role não reconhecida:', item.role, 'para jogador:', item.name);
        }

        const totalPoints = Number(item.points ?? 0);
        const avgPoints = Number(item.avg_points ?? 0);

        const player = {
          id: item.id.toString(),
          name: item.name,
          role: mappedRole,
          teamId: item.team_id ? String(item.team_id) : undefined,
          price: Number(item.price),
          points: totalPoints !== 0 ? totalPoints : avgPoints,
          avgPoints,
          kda: item.kda,
          image: this.getStorageUrl('players', item.image),
          team: teamData.name || 'Sem Time',
          teamLogo: this.getStorageUrl('teams', teamData.logo_url)
        };
        
        if (item.role !== mappedRole) {
        }
        
        return player;
      });
    } catch (error) {
      console.error('❌ Erro ao buscar jogadores:', error);
      return [];
    }
  },

  async saveUserTeam(team: UserTeam): Promise<boolean> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    
    if (!userToken) {
      console.error('❌ Usuário não autenticado - não é possível salvar dados');
      return false;
    }
    
    try {
      // Primeiro, verifica se o usuário já existe
      const existingTeam = await this.getUserTeam(team.userId);
      const simplifiedLineup = buildSimplifiedLineup(team.players);
      
      const payload = {
        user_id: team.userId,
        user_name: team.userName,
        team_name: team.name,
        budget: Number((Number(team.budget) || 0).toFixed(2)),
        total_points: Number((Number(team.totalPoints) || 0).toFixed(2)),
        lineup: simplifiedLineup,
        favorite_team: team.favoriteTeam,
        avatar: team.avatar,
        updated_at: new Date().toISOString()
      };

      if (existingTeam) {
        // UPDATE - usuário já existe, atualiza os dados
        const response = await fetch(`${SUPABASE_URL}/rest/v1/user_teams?user_id=eq.${team.userId}`, {
          method: 'PATCH',
          headers: buildAuthHeaders(anonKey, userToken, { includeContentType: true, prefer: 'return=minimal', allowAnonFallback: false }),
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Erro ao atualizar usuário:', response.status, errorText);
          return false;
        }
        
        return true;
      } else {
        // INSERT - novo usuário, cria registro
        const response = await fetch(`${SUPABASE_URL}/rest/v1/user_teams`, {
          method: 'POST',
          headers: buildAuthHeaders(anonKey, userToken, { includeContentType: true, prefer: 'return=minimal', allowAnonFallback: false }),
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Erro ao criar usuário:', response.status, errorText);
          return false;
        }
        
        return true;
      }
    } catch (error) {
      console.error('❌ Erro ao salvar dados do usuário:', error);
      return false;
    }
  },

  async getUserTeam(userId: string): Promise<UserTeam | null> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    logAuthDebug('getUserTeam', anonKey, userToken);
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/user_teams?user_id=eq.${userId}&select=*`, {
        headers: buildAuthHeaders(anonKey, userToken, { includeContentType: true })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro getUserTeam:', errorText);
        return null;
      }
      
      const data = await response.json();
      if (data.length === 0) return null;

      const dbTeam = data[0];

      let derivedTotalPoints: number | null = null;
      let derivedCurrentRoundPoints: number | null = null;

      try {
        const scoresResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/round_scores?user_team_id=eq.${dbTeam.id}&select=round_id,total_points,updated_at`,
          {
            headers: buildAuthHeaders(anonKey, userToken, { includeContentType: true })
          }
        );

        if (scoresResponse.ok) {
          const scores = await scoresResponse.json();
          const latestByRound = new Map<number, { totalPoints: number; updatedAt: number }>();

          (scores || []).forEach((row: any) => {
            const roundId = Number(row.round_id);
            if (!Number.isFinite(roundId)) return;

            const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
            const current = latestByRound.get(roundId);

            if (!current || updatedAt >= current.updatedAt) {
              latestByRound.set(roundId, {
                totalPoints: Number(row.total_points || 0),
                updatedAt
              });
            }
          });

          if (latestByRound.size > 0) {
            derivedTotalPoints = Array.from(latestByRound.values())
              .reduce((sum, row) => sum + row.totalPoints, 0);

            const latestRoundId = Math.max(...Array.from(latestByRound.keys()));
            derivedCurrentRoundPoints = latestByRound.get(latestRoundId)?.totalPoints ?? 0;
          }
        }
      } catch (scoreError) {
        console.warn('⚠️ Não foi possível derivar pontuação via round_scores:', scoreError);
      }

      return {
        id: dbTeam.id?.toString() || 'u1',
        userId: dbTeam.user_id,
        userName: dbTeam.user_name || 'INVOCADOR',
        name: dbTeam.team_name || 'MEU TIME',
        avatar: dbTeam.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
        level: 1,
        honor: 1,
        players: dbTeam.lineup || {},
        budget: dbTeam.budget ?? INITIAL_BUDGET,
        currentRoundPoints: derivedCurrentRoundPoints ?? Number(dbTeam.current_round_points || 0),
        totalPoints: derivedTotalPoints ?? Number(dbTeam.total_points || 0),
        favoriteTeam: dbTeam.favorite_team,
        preferences: {
          publicProfile: true,
          marketNotifications: true,
          compactMode: false
        }
      };
    } catch (error) {
      console.error("Erro ao buscar time do usuário:", error);
      return null;
    }
  },

  // =====================================================
  // LEAGUE SYSTEM
  // =====================================================

  /**
   * Gera um código único de 6 caracteres para a liga
   */
  generateLeagueCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  /**
   * Cria uma nova liga
   */
  async createLeague(leagueData: {
    name: string;
    icon: string;
    isPublic: boolean;
    createdBy: string;
  }): Promise<{ok: boolean, leagueId?: string, code?: string, error?: string}> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    const code = this.generateLeagueCode();
    
    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }
    
    try {
      // Cria a liga
      const response = await fetch(`${SUPABASE_URL}/rest/v1/leagues`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, { includeContentType: true, prefer: 'return=representation', allowAnonFallback: false }),
        body: JSON.stringify({
          name: leagueData.name,
          code: code,
          icon: leagueData.icon,
          is_public: leagueData.isPublic,
          is_verified: false,
          created_by: leagueData.createdBy
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro ao criar liga:', errorText);
        return { ok: false, error: errorText };
      }

      const [createdLeague] = await response.json();
      const leagueId = createdLeague.id.toString();

      // Adiciona o criador como membro da liga
      await this.joinLeague(code, leagueData.createdBy);

      return { ok: true, leagueId, code };
    } catch (error) {
      console.error('❌ Erro ao criar liga:', error);
      return { ok: false, error: String(error) };
    }
  },

  /**
   * Entra em uma liga usando o código de convite
   */
  async joinLeague(code: string, userId: string): Promise<{ok: boolean, error?: string}> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    
    
    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }
    
    try {
      // Primeiro, busca a liga pelo código
      const leagueResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/leagues?code=eq.${encodeURIComponent(code)}&select=id`,
        {
          headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
        }
      );


      if (!leagueResponse.ok) {
        return { ok: false, error: 'Liga não encontrada' };
      }

      const leagues = await leagueResponse.json();
      
      if (leagues.length === 0) {
        console.warn('⚠️ Nenhuma liga encontrada com código:', code);
        return { ok: false, error: 'Código inválido' };
      }

      const leagueId = leagues[0].id;

      // Adiciona o usuário como membro
      const payload = {
        league_id: leagueId,
        user_id: userId
      };
      
      const memberResponse = await fetch(`${SUPABASE_URL}/rest/v1/league_members`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, { includeContentType: true, prefer: 'return=minimal', allowAnonFallback: false }),
        body: JSON.stringify(payload)
      });


      if (!memberResponse.ok) {
        const errorText = await memberResponse.text();
        console.error('❌ Erro ao inserir membro:', errorText);
        
        // Verifica se é erro de duplicação (usuário já está na liga)
        if (errorText.includes('duplicate') || errorText.includes('unique')) {
          return { ok: false, error: 'Você já está nesta liga' };
        }
        return { ok: false, error: errorText };
      }

      return { ok: true };
    } catch (error) {
      console.error('❌ Exception em joinLeague:', error);
      return { ok: false, error: String(error) };
    }
  },

  /**
   * Busca todas as ligas do usuário
   */
  async getUserLeagues(userId: string): Promise<League[]> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    
    
    try {
      // Primeiro busca os IDs das ligas que o usuário é membro
      const membersResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/league_members?user_id=eq.${userId}&select=league_id`,
        {
          headers: buildAuthHeaders(anonKey, userToken)
        }
      );


      if (!membersResponse.ok) {
        const errorText = await membersResponse.text();
        console.error('❌ Erro ao buscar memberships:', membersResponse.status, errorText);
        
        // Fallback: Buscar todas as ligas públicas se der erro
        const fallbackResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/leagues?is_public=eq.true&order=name.asc`,
          {
            headers: buildAuthHeaders(anonKey, userToken)
          }
        );
        
        if (fallbackResponse.ok) {
          const publicLeagues = await fallbackResponse.json();
          return publicLeagues.map(mapLeagueResponse);
        }
        
        return [];
      }

      const members = await membersResponse.json();
      
      const leagueIds = members.map((m: any) => m.league_id);

      if (leagueIds.length === 0) {
        return [];
      }

      // Busca os dados completos das ligas
      const leaguesResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/leagues?id=in.(${leagueIds.join(',')})&select=id,name,code,icon,is_public,is_verified,created_by,created_at`,
        {
          headers: buildAuthHeaders(anonKey, userToken)
        }
      );

      if (!leaguesResponse.ok) {
        console.error('❌ Erro ao buscar dados das ligas');
        return [];
      }

      const data = await leaguesResponse.json();
      
      // Mapeia os dados para o formato League
      return data.map(mapLeagueResponse);
    } catch (error) {
      console.error('❌ Erro ao buscar ligas:', error);
      return [];
    }
  },

  /**
   * Busca a contagem de membros de uma liga
   */
  async getLeagueMemberCount(leagueId: string): Promise<number> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/league_members?league_id=eq.${leagueId}&select=user_id`,
        {
          headers: buildAuthHeaders(anonKey, userToken)
        }
      );

      if (!response.ok) {
        return 0;
      }

      const members = await response.json();
      return members.length;
    } catch (error) {
      console.error('❌ Erro ao buscar contagem de membros:', error);
      return 0;
    }
  },

  /**
   * Busca o ranking de uma liga específica
   */
  async getLeagueRanking(leagueId: string): Promise<RankingEntry[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/leagues/${leagueId}/ranking`);

      if (!response.ok) {
        console.error('❌ Erro ao buscar ranking da liga');
        return [];
      }

      const data = await response.json();
      const teams = data?.ranking || [];

      return teams.map(mapTeamToRankingEntry);
    } catch (error) {
      console.error('❌ Erro ao buscar ranking da liga:', error);
      return [];
    }
  },

  /**
   * Sai de uma liga
   */
  async leaveLeague(leagueId: string, userId: string): Promise<boolean> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    
    if (!userToken) {
      console.error('❌ Usuário não autenticado');
      return false;
    }
    
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/league_members?league_id=eq.${leagueId}&user_id=eq.${userId}`,
        {
          method: 'DELETE',
          headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
        }
      );

      if (response.ok) {
      }
      return response.ok;
    } catch (error) {
      console.error('❌ Erro ao sair da liga:', error);
      return false;
    }
  },

  /**
   * Adiciona usuário nas ligas padrão (CBLOL Global + Liga do Time Favorito)
   * Chamado durante o onboarding
   */
  async joinDefaultLeagues(userId: string, favoriteTeam?: string): Promise<{ok: boolean, error?: string}> {
    // Esta função não precisa de token pois usa joinLeague que já valida
    try {
      
      // Sempre adiciona na liga Kings Lendas Global
      const globalResult = await this.joinLeague('KINGSLENDAS', userId);

      // Se tiver time favorito, adiciona na liga do time
      if (favoriteTeam) {
        const teamCode = TEAM_CODE_MAP[favoriteTeam];
        
        if (teamCode) {
          const teamResult = await this.joinLeague(teamCode, userId);
        } else {
          console.warn('⚠️ Time não encontrado no mapeamento:', favoriteTeam);
        }
      }

      return { ok: true };
    } catch (error) {
      console.error('❌ Erro ao adicionar usuário nas ligas padrão:', error);
      return { ok: false, error: String(error) };
    }
  },

  // =====================================================
  // FANTASY API - MARKET, SCORING, BUFFS
  // =====================================================

  /**
   * Base URL da API do backend
   */
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://projectklf-production.up.railway.app/api',

  // =====================================================
  // ADMIN API
  // =====================================================

  async getAdminInfo(): Promise<{ ok: boolean; data?: any; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin`, {
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (response.status === 401) {
        return { ok: false, error: 'Usuário não autenticado' };
      }

      if (response.status === 403) {
        return { ok: false, error: 'Acesso negado' };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao consultar admin' };
      }

      const data = await response.json();
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async getAdminPlayers(): Promise<{ ok: boolean; players?: any[]; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/players`, {
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao buscar jogadores' };
      }

      const data = await response.json();
      return { ok: true, players: data.players || [] };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async createAdminPlayer(payload: {
    name: string;
    role: string;
    team_id?: string | null;
    price?: number;
    points?: number;
    avg_points?: number;
    kda?: string;
    image: string;
    is_captain?: boolean;
  }): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/players`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao criar jogador' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async deleteAdminPlayer(playerId: string): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/players/${playerId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao deletar jogador' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async updateAdminPlayer(playerId: string, payload: {
    name?: string;
    role?: string;
    team_id?: string | null;
    price?: number;
    points?: number;
    avg_points?: number;
    kda?: string;
    image?: string;
    image_name?: string;
    is_captain?: boolean;
  }): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/players/${playerId}`, {
        method: 'PATCH',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao atualizar jogador' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async updateAdminPlayerPrice(playerId: string, price: number): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/players/${playerId}/price`, {
        method: 'PUT',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify({ price })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao atualizar preço' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async getAdminTeams(): Promise<{ ok: boolean; teams?: any[]; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/teams`, {
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao buscar times' };
      }

      const data = await response.json();
      return { ok: true, teams: data.teams || [] };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async createAdminTeam(payload: { name: string; logo_url: string }): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/teams`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao criar time' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async createAdminTeamWithLogo(payload: {
    name: string;
    logo_data: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/teams`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao criar time' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async deleteAdminTeam(teamId: string): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/teams/${teamId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao deletar time' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async updateAdminTeam(teamId: string, payload: { name?: string; logo_url?: string; logo_data?: string }): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/teams/${teamId}`, {
        method: 'PATCH',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao atualizar time' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async getAdminRounds(): Promise<{ ok: boolean; rounds?: any[]; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/rounds`, {
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao buscar rodadas' };
      }

      const data = await response.json();
      return { ok: true, rounds: data.rounds || [] };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async createAdminRound(payload: {
    season: number;
    round_number: number;
    start_date?: string | null;
    end_date?: string | null;
    market_close_time?: string | null;
    status?: string;
    is_market_open?: boolean;
  }): Promise<{ ok: boolean; round?: any; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/rounds`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao criar rodada' };
      }

      const data = await response.json();
      return { ok: true, round: data.round };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async updateAdminRoundStatus(roundId: number, status: string): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/rounds/${roundId}/status`, {
        method: 'PATCH',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao atualizar status da rodada' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async finalizeAdminRound(roundId: number, options?: { forceRecalculate?: boolean }): Promise<{ ok: boolean; data?: any; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/rounds/${roundId}/finalize`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, { includeContentType: true, allowAnonFallback: false }),
        body: JSON.stringify({ forceRecalculate: options?.forceRecalculate || false })
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      if (!response.ok) {
        const pendingItems = Array.isArray(data?.check?.pendingItems)
          ? data.check.pendingItems.filter(Boolean).join(', ')
          : '';
        const errorMessage = pendingItems
          ? `${data?.error || 'Rodada com pendencias para finalizacao'}: ${pendingItems}`
          : (data?.error || 'Erro ao finalizar rodada');
        return { ok: false, error: errorMessage, data };
      }

      if (data?.success === false) {
        return { ok: false, error: data?.error || 'Erro ao finalizar rodada', data };
      }

      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async resetAdminRoundCalculations(roundId: number): Promise<{ ok: boolean; data?: any; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/rounds/${roundId}/reset-calculations`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, { includeContentType: true, allowAnonFallback: false })
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      if (!response.ok) {
        return { ok: false, error: data?.error || 'Erro ao resetar cálculos da rodada', data };
      }

      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async updateAdminRoundDates(roundId: number, payload: { start_date?: string; end_date?: string; market_close_time?: string; }): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/rounds/${roundId}`, {
        method: 'PUT',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao atualizar datas da rodada' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async deleteAdminRound(roundId: number): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/rounds/${roundId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao deletar rodada' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async getAdminMatches(roundId?: number): Promise<{ ok: boolean; matches?: any[]; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    const query = roundId ? `?round_id=${roundId}` : '';

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/matches${query}`, {
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao buscar partidas' };
      }

      const data = await response.json();
      return { ok: true, matches: data.matches || [] };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async createAdminMatch(payload: {
    round_id: string;
    team_a_id: string;
    team_b_id: string;
    winner_id?: string | null;
    scheduled_time: string;
    status?: string;
    team_a_score?: number | null;
    team_b_score?: number | null;
    games_count?: number;
  }): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/matches`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao criar partida' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async updateAdminMatch(matchId: number, payload: {
    winner_id?: number;
    scheduled_time?: string;
    status?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/matches/${matchId}`, {
        method: 'PUT',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao atualizar partida' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async deleteAdminMatch(matchId: number): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/matches/${matchId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao deletar partida' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async getAdminLeagues(): Promise<{ ok: boolean; leagues?: any[]; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/leagues`, {
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao buscar ligas' };
      }

      const data = await response.json();
      return { ok: true, leagues: data.leagues || [] };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async getAdminUsers(): Promise<{ ok: boolean; users?: any[]; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/users`, {
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao buscar usuários' };
      }

      const data = await response.json();
      return { ok: true, users: data.users || [] };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async resetAdminUser(userId: number): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/users/${userId}/reset`, {
        method: 'PATCH',
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao resetar usuario' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async updateAdminUser(userId: number, payload: { budget?: number; total_points?: number; user_name?: string; team_name?: string }): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/users/${userId}`, {
        method: 'PATCH',
        headers: buildAuthHeaders(anonKey, userToken, { includeContentType: true, allowAnonFallback: false }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao atualizar usuario' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async updateAdminLeague(leagueId: number, payload: { is_public?: boolean; is_verified?: boolean }): Promise<{ ok: boolean; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/leagues/${leagueId}`, {
        method: 'PATCH',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao atualizar liga' };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  /**
   * Salva lineup via backend com validação server-side de budget
   */
  async saveLineupSecure(lineup: UserTeam['players']): Promise<{ success: boolean; budget?: number; error?: string }> {
    const userToken = this.getUserToken();
    if (!userToken) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    try {
      const simplifiedLineup = buildSimplifiedLineup(lineup);
      const response = await fetch(`${this.API_BASE_URL}/lineup/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ lineup: simplifiedLineup })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('❌ saveLineupSecure failed:', data);
        if (data.debug_user_id) {
          console.error(`[DEBUG] Server looked for user_id=${data.debug_user_id}`);
        }
        return { success: false, error: data.error || 'Erro ao salvar escalação' };
      }

      return { success: true, budget: data.budget };
    } catch (error) {
      console.error('❌ Erro ao salvar lineup seguro:', error);
      return { success: false, error: 'Erro de conexão ao salvar escalação' };
    }
  },

  /**
   * Limpa o lineup inteiro, devolvendo o budget dos jogadores.
   * Funciona independente do status do mercado.
   */
  async clearLineup(): Promise<{ success: boolean; budget?: number; error?: string }> {
    const userToken = this.getUserToken();
    if (!userToken) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/lineup/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Erro ao limpar escalação' };
      }

      return { success: true, budget: data.budget };
    } catch (error) {
      console.error('❌ Erro ao limpar lineup:', error);
      return { success: false, error: 'Erro de conexão ao limpar escalação' };
    }
  },

  /** TEMPORARY: Debug team lookup */
  async debugTeamLookup(): Promise<any> {
    const userToken = this.getUserToken();
    if (!userToken) return { error: 'Not authenticated' };
    try {
      const response = await fetch(`${this.API_BASE_URL}/debug/team-lookup`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      return await response.json();
    } catch (e) {
      return { error: String(e) };
    }
  },

  /**
   * Busca status do mercado (aberto/fechado)
   */
  async getMarketStatus(): Promise<{
    isOpen: boolean;
    currentRound?: any;
    nextCloseTime?: string;
    message: string;
  } | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/market/status`);
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Erro ao buscar status do mercado:', error);
      return null;
    }
  },

  async getAdminRoundFinalizeCheck(roundId: number): Promise<{ ok: boolean; check?: any; error?: string }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/rounds/${roundId}/finalize-check`, {
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao verificar checklist da rodada' };
      }

      const data = await response.json().catch(() => null);
      return { ok: true, check: data?.check };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async extractAdminPerformancesFromImage(payload: {
    match_id: number;
    image_data: string;
  }): Promise<{
    ok: boolean;
    error?: string;
    score?: { team_a: number; team_b: number } | null;
    rows?: Array<{
      index: number;
      player_name: string;
      champion_name: string;
      game_number: number;
      team: 'A' | 'B' | '';
      mapped_player_id: number | string | null;
      mapped_player_name: string | null;
      mapped_champion_id: number | string | null;
      mapped_champion_name: string | null;
      kills: number;
      deaths: number;
      assists: number;
      cs: number;
      status: 'ok' | 'review';
      message: string;
    }>;
    reviewCount?: number;
  }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/performances/extract-from-image`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText || 'Erro ao extrair dados da imagem' };
      }

      const data = await response.json().catch(() => null);
      if (!data?.success) {
        return { ok: false, error: data?.error || 'Erro ao extrair dados da imagem' };
      }

      return {
        ok: true,
        score: data.score || null,
        rows: Array.isArray(data.rows) ? data.rows : [],
        reviewCount: Number(data.reviewCount || 0)
      };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async resetData(): Promise<{ ok: boolean; error?: string; verification?: any }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();

    if (!userToken) {
      return { ok: false, error: 'Usuário não autenticado' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/reset-data`, {
        method: 'POST',
        headers: buildAuthHeaders(anonKey, userToken, {
          allowAnonFallback: false,
          includeContentType: true
        }),
        body: JSON.stringify({ confirm: 'RESET' })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        return { ok: false, error: data?.error || 'Erro ao resetar dados' };
      }

      return { ok: true, verification: data.verification };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  async getRoundPerformances(roundId: number): Promise<{
    ok: boolean;
    error?: string;
    data?: {
      round_id: string;
      totalMatches: number;
      totalPerformances: number;
      matches: any[];
    };
  }> {
    const anonKey = this.getAnonKey();
    const userToken = this.getUserToken();
    if (!userToken) return { ok: false, error: 'Usuário não autenticado' };

    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/performances/round/${roundId}`, {
        headers: buildAuthHeaders(anonKey, userToken, { allowAnonFallback: false })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        return { ok: false, error: data?.error || 'Erro ao buscar performances da rodada' };
      }
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },


  async getCurrentRoundMatchups(): Promise<{
    round: {
      id: number;
      round_number: number;
      start_date: string;
      market_close_time: string;
    } | null;
    matches: Array<{
      id: number;
      round_id: number;
      scheduled_time: string | null;
      status: string;
      team_a_id: string;
      team_b_id: string;
      team_a?: { id: string; name: string; logo_url?: string | null };
      team_b?: { id: string; name: string; logo_url?: string | null };
    }>;
  }> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/market/matchups/current`);
      if (!response.ok) {
        return { round: null, matches: [] };
      }
      const data = await response.json();
      return {
        round: data.round || null,
        matches: data.matches || []
      };
    } catch (error) {
      console.error('❌ Erro ao buscar confrontos da rodada:', error);
      return { round: null, matches: [] };
    }
  },

  /**
   * Busca tempo restante até fechar o mercado
   */
  async getMarketTimeRemaining(): Promise<{
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  } | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/market/time-remaining`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.timeRemaining;
    } catch (error) {
      console.error('❌ Erro ao buscar tempo restante:', error);
      return null;
    }
  },

  /**
   * Valida se um usuário pode fazer trocas
   */
  async validateTrade(userTeamId: number): Promise<{valid: boolean, message: string}> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/market/validate-trade/${userTeamId}`, {
        method: 'POST'
      });
      if (!response.ok) return {valid: false, message: 'Erro ao validar'};
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Erro ao validar troca:', error);
      return {valid: false, message: 'Erro de conexão'};
    }
  },

  /**
   * Busca pontuação de um usuário em uma rodada
   */
  async getRoundScore(roundId: number, userTeamId: number): Promise<{
    basePoints: number;
    teamDiversityBonus: number;
    championMultiplierBonus: number;
    totalPoints: number;
    numUniqueTeams: number;
    diversityPercent: number;
  } | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/scores/round/${roundId}/user/${userTeamId}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.score;
    } catch (error) {
      console.error('❌ Erro ao buscar pontuação:', error);
      return null;
    }
  },

  /**
   * Calcula buff de diversidade baseado no lineup atual
   */
  calculateDiversityBonus(lineup: {[key in Role]?: Player}): {
    uniqueTeams: number;
    bonusPercent: number;
    message: string;
  } {
    const teams = new Set<string>();
    const debugTeams: string[] = [];
    Object.entries(lineup).forEach(([role, player]) => {
      if (player) {
        // Usar team name como identificador principal (mais confiável que teamId numérico)
        const teamKey = player.team || (player.teamId ? String(player.teamId) : '');
        if (teamKey) {
          const normalized = teamKey.toLowerCase().trim();
          teams.add(normalized);
          debugTeams.push(`${role}:${player.name}→"${normalized}"`);
        }
      }
    });
    console.log(`[Diversity] ${teams.size} unique teams from ${debugTeams.length} players:`, debugTeams.join(', '), '| unique:', Array.from(teams).join(', '));

    const uniqueTeams = teams.size;
    let bonusPercent = 0;
    let message = '';

    // v2 Balanced Economy — valores atualizados
    switch (uniqueTeams) {
      case 5:
        bonusPercent = 20;
        message = 'Diversidade máxima! +20%';
        break;
      case 4:
        bonusPercent = 15;
        message = 'Ótima diversidade! +15%';
        break;
      case 3:
        bonusPercent = 10;
        message = 'Boa diversidade! +10%';
        break;
      case 2:
        bonusPercent = 5;
        message = 'Diversidade moderada. +5%';
        break;
      case 1:
        bonusPercent = 0;
        message = 'Todos do mesmo time. +0%';
        break;
      default:
        bonusPercent = 0;
        message = 'Monte seu time para ver o bônus';
    }

    return { uniqueTeams, bonusPercent, message };
  },

  /**
   * Consulta o AI-SOLUT via backend
   */
  async askAICoach(payload: {
    query: string;
    userTeam: UserTeam;
    availablePlayers: Player[];
  }): Promise<{ ok: boolean; response?: string; error?: string }> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/ai/coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        return {
          ok: false,
          error: data?.error || 'Erro ao consultar AI-SOLUT'
        };
      }

      return {
        ok: true,
        response: data.response || ''
      };
    } catch (error) {
      console.error('❌ Erro ao consultar AI-SOLUT:', error);
      return {
        ok: false,
        error: 'Erro de conexão com o AI-SOLUT'
      };
    }
  },

  /**
   * Busca configurações do sistema (pontos, buffs, multiplicadores)
   */
  async getSystemConfig(): Promise<Record<string, any> | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/config`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.config;
    } catch (error) {
      console.error('❌ Erro ao buscar configurações:', error);
      return null;
    }
  },

  /**
   * Busca todos os campeões disponíveis
   */
  async getChampions(): Promise<Array<{
    id: number;
    name: string;
    key_name: string;
    image_url: string;
    roles: string[];
  }> | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/champions`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.champions;
    } catch (error) {
      console.error('❌ Erro ao buscar campeões:', error);
      return null;
    }
  }
};
