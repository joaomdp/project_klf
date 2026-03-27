
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Page, UserTeam, Player, Role, Champion } from './types';
import { INITIAL_BUDGET, MOCK_PLAYERS } from './constants'; 
import { DataService } from './services/api';
import { AuthService } from './services/auth';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ToastProvider, useToast } from './components/Toast';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Market from './components/Market';
import SquadBuilder from './components/SquadBuilder';
import Ranking from './components/Ranking';
import AICoach from './components/AICoach';
import Profile from './components/Profile';
import ChampionSelector from './components/ChampionSelector';
import CreateLeagueModal from './components/CreateLeagueModal';
import LoadingScreen from './components/LoadingScreen';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import OnboardingFlow from './components/OnboardingFlow';
import CommandPalette from './components/CommandPalette';
import ShortcutsGuide from './components/ShortcutsGuide';
import AdminPanel from './components/AdminPanel';

type MarketMatch = {
  id: number;
  round_id: number;
  scheduled_time: string | null;
  status: string;
  team_a_id: string;
  team_b_id: string;
  team_a?: { id: string; name: string; logo_url?: string | null };
  team_b?: { id: string; name: string; logo_url?: string | null };
};

const DEFAULT_USER_TEAM: UserTeam = {
  id: 'u1',
  userId: 'current-user',
  userName: 'INVOCADOR',
  name: 'MEU TIME',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hakkai',
  level: 1,
  honor: 1,
  players: {},
  budget: INITIAL_BUDGET,
  currentRoundPoints: 0,
  totalPoints: 0,
  preferences: {
    publicProfile: true,
    marketNotifications: true,
    compactMode: false
  }
};


const getUserNameFromSession = (session: any) => {
  const meta = session?.user?.user_metadata;
  return meta?.user_name
    || meta?.full_name
    || session?.user?.email?.split('@')[0]?.toUpperCase()
    || 'INVOCADOR';
};

const getAvatarFromSession = (session: any, userName: string, fallback: string) => {
  const meta = session?.user?.user_metadata;
  if (meta?.avatar_url) return meta.avatar_url;
  if (userName) return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`;
  return fallback;
};

const isTokenExpired = (token?: string | null) => {
  if (!token) return true;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return true;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (!payload?.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (error) {
    console.warn('⚠️ Falha ao validar expiração do token', error);
    return true;
  }
};

/** Retorna true se o token expira nos próximos N segundos */
const isTokenExpiringSoon = (token?: string | null, thresholdSeconds = 300) => {
  if (!token) return true;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return true;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (!payload?.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp - now < thresholdSeconds;
  } catch {
    return true;
  }
};

const clearInvalidSession = async () => {
  const sessionStr = localStorage.getItem('nexus_session');
  if (!sessionStr) return;

  try {
    const session = JSON.parse(sessionStr);
    if (!session.access_token || !session.user?.id) {
      localStorage.removeItem('nexus_session');
      return;
    }

    if (isTokenExpired(session.access_token)) {
      // Tentar refresh antes de limpar
      if (session.refresh_token) {
        const refreshed = await AuthService.refreshSession();
        if (refreshed) return; // Refresh bem-sucedido
      }
      localStorage.removeItem('nexus_session');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('setup_complete_')) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (e) {
    localStorage.removeItem('nexus_session');
  }
};

const AppContent: React.FC = () => {
  const [showLanding, setShowLanding] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | undefined>(undefined);
  const [players, setPlayers] = useState<Player[]>(MOCK_PLAYERS);
  const [isLoading, setIsLoading] = useState(() => {
    try {
      const sessionStr = localStorage.getItem('nexus_session');
      const hasSession = Boolean(sessionStr);
      const hasAuthHash = window.location.hash.includes('access_token');
      return hasSession || hasAuthHash;
    } catch (error) {
      console.warn('⚠️ Falha ao ler sessão inicial', error);
      return true;
    }
  });
  const [dbConnected, setDbConnected] = useState(false);
  const [marketIsOpen, setMarketIsOpen] = useState<boolean | null>(null);
  const [isCreateLeagueOpen, setIsCreateLeagueOpen] = useState(false);
  const [createdLeagueCode, setCreatedLeagueCode] = useState<string | null>(null);
  const [createdLeagueName, setCreatedLeagueName] = useState<string>('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsGuideOpen, setIsShortcutsGuideOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [marketMatchups, setMarketMatchups] = useState<MarketMatch[]>([]);
  const [marketRoundLabel, setMarketRoundLabel] = useState<string | null>(null);
  const lastKnownMarketState = useRef<boolean | null>(null);
  const serverBudgetRef = useRef<number | null>(null);
  
  const { showToast } = useToast();

  const [userTeam, setUserTeam] = useState<UserTeam>(DEFAULT_USER_TEAM);

  const [pendingPlayer, setPendingPlayer] = useState<Player | null>(null);
  const canEditMarket = marketIsOpen === true;

  const mergeLineupWithLatest = useCallback((team: UserTeam, roster: Player[]) => {
    if (!roster.length) return team;

    const rosterById = new Map(roster.map((player) => [player.id, player]));
    let changed = false;
    const updatedPlayers: UserTeam['players'] = { ...team.players };

    Object.entries(team.players).forEach(([role, player]) => {
      if (!player) return;
      const latest = rosterById.get(player.id);
      if (!latest) return;

      const needsUpdate =
        player.points !== latest.points ||
        player.avgPoints !== latest.avgPoints ||
        player.price !== latest.price ||
        player.team !== latest.team ||
        player.teamLogo !== latest.teamLogo ||
        player.image !== latest.image ||
        player.kda !== latest.kda ||
        player.name !== latest.name ||
        player.role !== latest.role;

      if (!needsUpdate) return;

      changed = true;
      updatedPlayers[role as Role] = {
        ...player,
        ...latest,
        selectedChampion: player.selectedChampion,
        lastChampion: player.lastChampion
      };
    });

    if (!changed) return team;
    return {
      ...team,
      players: updatedPlayers
    };
  }, []);

  const persistTeam = useCallback((team: UserTeam) => {
    setUserTeam(team);
    DataService.saveUserTeam(team).catch((err) => {
      console.error('❌ Erro ao persistir time:', err);
    });
  }, []);

  const resetTeam = useCallback(async () => {
    // Salvar lineup vazio no backend (devolve budget dos jogadores dispensados)
    try {
      const result = await DataService.saveLineupSecure({});
      if (result.success && result.budget !== undefined) {
        setUserTeam(prev => ({
          ...prev,
          budget: result.budget!,
          players: {},
        }));
      } else {
        // Fallback local se backend falhar
        console.error('❌ Backend rejeitou lineup vazio:', result.error);
        setUserTeam(prev => {
          const refund = Object.values(prev.players)
            .filter((p): p is Player => !!p)
            .reduce((sum, p) => sum + (p.price || 0), 0);
          return { ...prev, budget: prev.budget + refund, players: {} };
        });
      }
    } catch (err) {
      console.error('❌ Erro ao persistir reset de time:', err);
      setUserTeam(prev => {
        const refund = Object.values(prev.players)
          .filter((p): p is Player => !!p)
          .reduce((sum, p) => sum + (p.price || 0), 0);
        return { ...prev, budget: prev.budget + refund, players: {} };
      });
    }
  }, []);

  const showSaveError = useCallback(() => {
    showToast({
      type: 'error',
      title: 'Erro ao Salvar',
      message: 'Não foi possível confirmar sua escalação. Tente novamente.',
      duration: 5000
    });
  }, [showToast]);

  const checkAdminAccess = useCallback(async () => {
    const result = await DataService.getAdminInfo();
    setIsAdmin(result.ok);
  }, []);

  const loadCurrentRoundMatchups = useCallback(async () => {
    try {
      const data = await DataService.getCurrentRoundMatchups();
      setMarketMatchups(data.matches || []);
      if (data.round?.round_number) {
        setMarketRoundLabel(`rodada ${data.round.round_number}`);
      } else {
        setMarketRoundLabel(null);
      }
    } catch (error) {
      console.error('Falha ao carregar confrontos da rodada:', error);
    }
  }, []);

  const fetchPlayers = useCallback(async () => {
    try {
      const conn = await DataService.checkConnection();
      setDbConnected(conn.ok);
      if (conn.ok) {
        const data = await DataService.getPlayers();
        if (data && data.length > 0) {
          setPlayers(data);
          showToast({
            type: 'success',
            title: 'Jogadores atualizados',
            message: `${data.length} jogadores carregados com sucesso`,
            duration: 3000
          });
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("Falha ao buscar jogadores:", error);
      showToast({
        type: 'error',
        title: 'Erro ao carregar jogadores',
        message: 'Não foi possível conectar ao servidor',
        duration: 5000
      });
      return false;
    }
  }, [showToast]);

  const syncUserTeamFromServer = useCallback(async () => {
    const session = AuthService.getSession();
    const userId = session?.user?.id;

    if (!userId) return;

    try {
      const latestTeam = await DataService.getUserTeam(userId);
      if (!latestTeam) return;

      // Store authoritative server budget so merge effects can't overwrite it
      serverBudgetRef.current = latestTeam.budget;

      setUserTeam((prev) => ({
        ...latestTeam,
        // Mantem preferencia local caso venha ausente do backend
        preferences: latestTeam.preferences || prev.preferences
      }));
    } catch (error) {
      console.warn('⚠️ Falha ao sincronizar time com backend', error);
    }
  }, []);

  const refreshMarketStatus = useCallback(async () => {
    try {
      const status = await DataService.getMarketStatus();
      if (status) {
        const nextState = Boolean(status.isOpen);
        const previousState = lastKnownMarketState.current;

        setMarketIsOpen(nextState);
        lastKnownMarketState.current = nextState;

        // Recarrega saldo/pontuacao ao detectar virada de estado do mercado
        if (previousState !== null && previousState !== nextState) {
          await syncUserTeamFromServer();
        }
      }
    } catch (error) {
      console.error('Falha ao atualizar status do mercado:', error);
    }
  }, [syncUserTeamFromServer]);

  useEffect(() => {
    const initApp = async () => {
      await clearInvalidSession();
      
      const callbackResult: any = AuthService.handleAuthCallback();
      const session = (callbackResult && !callbackResult.error) ? callbackResult : AuthService.getSession();

      const hasSession = Boolean(session && session.access_token && session.user?.id);
        if (hasSession) {
        setIsLoading(true);
        setShowLanding(false);

          const [, , existingTeam] = await Promise.all([
            fetchPlayers(),
            checkAdminAccess(),
            DataService.getUserTeam(session.user.id)
          ]);
          await Promise.all([loadCurrentRoundMatchups(), refreshMarketStatus()]);
        
        if (existingTeam) {
          setUserTeam(existingTeam);
          setIsAuthenticated(true);
          setNeedsOnboarding(false);
          
          localStorage.setItem(`setup_complete_${session.user.id}`, 'true');
        } else {
          setIsAuthenticated(true);
          setNeedsOnboarding(true);
          
          // Define userName dos metadados do usuário
          const userName = getUserNameFromSession(session);
          const avatar = getAvatarFromSession(session, userName, DEFAULT_USER_TEAM.avatar);
          
          setUserTeam(prev => ({
            ...prev,
            userId: session.user?.id || prev.userId,
            userName,
            avatar
          }));
        }
       } else {
        setShowLanding(true);
        setIsAuthenticated(false);
        setNeedsOnboarding(false);
      }
      
        setIsLoading(false);
      };

    initApp();
  }, [fetchPlayers, checkAdminAccess, loadCurrentRoundMatchups, refreshMarketStatus]);

  useEffect(() => {
    if (!players.length) return;
    setUserTeam((prev) => {
      const merged = mergeLineupWithLatest(prev, players);
      if (merged === prev) return prev;
      // Preserve authoritative server budget if available (prevents race condition)
      const budget = serverBudgetRef.current ?? merged.budget;
      return { ...merged, budget };
    });
  }, [players, mergeLineupWithLatest]);

  useEffect(() => {
    const handlePlayersRefresh = () => {
      fetchPlayers();
      syncUserTeamFromServer();
    };

    const handleMatchesRefresh = () => {
      loadCurrentRoundMatchups();
    };

    window.addEventListener('players:refresh', handlePlayersRefresh as EventListener);
    window.addEventListener('matches:refresh', handleMatchesRefresh as EventListener);
    return () => {
      window.removeEventListener('players:refresh', handlePlayersRefresh as EventListener);
      window.removeEventListener('matches:refresh', handleMatchesRefresh as EventListener);
    };
  }, [fetchPlayers, loadCurrentRoundMatchups, syncUserTeamFromServer]);

  useEffect(() => {
    // initApp already calls refreshMarketStatus, so only set up the interval here
    const interval = setInterval(refreshMarketStatus, 60000);
    return () => clearInterval(interval);
  }, [refreshMarketStatus]);

  // Token refresh automático — verifica a cada 2 minutos se o token vai expirar em breve
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkAndRefreshToken = async () => {
      const session = AuthService.getSession();
      if (session?.access_token && isTokenExpiringSoon(session.access_token, 300)) {
        await AuthService.refreshSession();
      }
    };

    const interval = setInterval(checkAndRefreshToken, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    const handleMarketRefresh = () => {
      refreshMarketStatus();
      loadCurrentRoundMatchups();
      // Sincronizar dados do time (budget, pontos) após finalização de rodada
      syncUserTeamFromServer();
    };

    window.addEventListener('market:refresh', handleMarketRefresh as EventListener);
    return () => window.removeEventListener('market:refresh', handleMarketRefresh as EventListener);
  }, [refreshMarketStatus, loadCurrentRoundMatchups, syncUserTeamFromServer]);

  const handleLoginSuccess = async (userData: any) => {
    setIsLoading(true);
    setShowLanding(false);
    setIsAuthenticated(true);
    
    try {
      const session = AuthService.getSession();
      if (session?.user?.id) {
        const [, , existingTeam] = await Promise.all([
          fetchPlayers(),
          checkAdminAccess(),
          DataService.getUserTeam(session.user.id)
        ]);
        await Promise.all([loadCurrentRoundMatchups(), refreshMarketStatus()]);
        
           if (existingTeam) {
            setUserTeam(existingTeam);
          setNeedsOnboarding(false);
          localStorage.setItem(`setup_complete_${session.user.id}`, 'true');
        } else {
          const userName = getUserNameFromSession(session);
          const avatar = userData.avatar || getAvatarFromSession(session, userName, userTeam.avatar);
          
          setUserTeam(prev => ({
            ...prev,
            userId: session.user?.id || prev.userId,
            userName,
            avatar
          }));
          setNeedsOnboarding(true);
        }
      } else {
        setNeedsOnboarding(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = async (data: { userName: string; teamName: string; avatar: string; favoriteTeam: string }) => {
    const session = AuthService.getSession();

    if (session?.user?.id) {
      localStorage.setItem(`setup_complete_${session.user.id}`, 'true');
    }
    
    // Atualiza o estado local usando o userName do onboarding E o userId real da sessão
    const updatedTeam = {
      ...userTeam,
      userId: session?.user?.id || userTeam.userId,
      userName: data.userName,
      name: data.teamName,
      avatar: data.avatar,
      favoriteTeam: data.favoriteTeam 
    };

    setUserTeam(updatedTeam as any);

    // Salva imediatamente no banco de dados para garantir persistência
    if (session?.user?.id) {
      const createResult = await DataService.createUserTeam(updatedTeam as any);
      if (!createResult.ok) {
        showToast({
          type: 'error',
          title: 'Erro no cadastro',
          message: createResult.error || 'Não foi possível concluir seu cadastro.',
          duration: 6000
        });
        return;
      }
      
      await DataService.joinDefaultLeagues(session.user.id, data.favoriteTeam);
    } else {
      console.error('❌ session.user.id é NULL - não foi possível adicionar às ligas!');
      showToast({
        type: 'error',
        title: 'Erro no cadastro',
        message: 'Sessão inválida. Faça login novamente.',
        duration: 6000
      });
      return;
    }

    setNeedsOnboarding(false);
    setCurrentPage('dashboard');
  };

  const handleLogout = useCallback(() => {
    AuthService.signOut();
  }, []);
  
  // Atalhos de teclado
  useKeyboardShortcuts([
    {
      key: 'k',
      ctrl: true,
      action: () => setIsCommandPaletteOpen(true),
      description: 'Abrir Command Palette',
      category: 'general'
    },
    {
      key: '?',
      shift: true,
      action: () => setIsShortcutsGuideOpen(true),
      description: 'Mostrar atalhos',
      category: 'general'
    },
    {
      key: '1',
      ctrl: true,
      action: () => isAuthenticated && !needsOnboarding && setCurrentPage('dashboard'),
      description: 'Ir para Dashboard',
      category: 'navigation'
    },
    {
      key: '2',
      ctrl: true,
      action: () => isAuthenticated && !needsOnboarding && setCurrentPage('market'),
      description: 'Ir para Mercado',
      category: 'navigation'
    },
    {
      key: '3',
      ctrl: true,
      action: () => isAuthenticated && !needsOnboarding && setCurrentPage('squad'),
      description: 'Ir para Escalação',
      category: 'navigation'
    },
    {
      key: '4',
      ctrl: true,
      action: () => isAuthenticated && !needsOnboarding && setCurrentPage('ranking'),
      description: 'Ir para Ranking',
      category: 'navigation'
    },
    {
      key: '5',
      ctrl: true,
      action: () => {
        if (isAuthenticated && !needsOnboarding && isAdmin) {
          setCurrentPage('admin');
        }
      },
      description: 'Ir para Admin',
      category: 'navigation'
    },
    {
      key: 'r',
      ctrl: true,
      shift: true,
      action: () => {
        if (isAuthenticated && !needsOnboarding) {
          fetchPlayers();
        }
      },
      description: 'Atualizar jogadores',
      category: 'actions'
    },
    {
      key: 'n',
      ctrl: true,
      action: () => {
        if (isAuthenticated && !needsOnboarding && currentPage === 'ranking') {
          setIsCreateLeagueOpen(true);
        }
      },
      description: 'Criar nova liga',
      category: 'actions'
    }
  ]);

  const teamMatchups = useMemo(() => {
    return marketMatchups.reduce<Record<string, Array<{ opponentName: string; opponentLogoUrl?: string; scheduledTime?: string | null }>>>((acc, match) => {
      const teamAId = String(match.team_a_id);
      const teamBId = String(match.team_b_id);
      const teamAName = match.team_a?.name || teamAId;
      const teamBName = match.team_b?.name || teamBId;
      const teamALogo = match.team_a?.logo_url ? DataService.getStorageUrl('teams', match.team_a.logo_url) : undefined;
      const teamBLogo = match.team_b?.logo_url ? DataService.getStorageUrl('teams', match.team_b.logo_url) : undefined;

      if (!acc[teamAId]) acc[teamAId] = [];
      if (!acc[teamBId]) acc[teamBId] = [];

      acc[teamAId].push({
        opponentName: teamBName,
        opponentLogoUrl: teamBLogo,
        scheduledTime: match.scheduled_time
      });

      acc[teamBId].push({
        opponentName: teamAName,
        opponentLogoUrl: teamALogo,
        scheduledTime: match.scheduled_time
      });

      return acc;
    }, {} as Record<string, Array<{ opponentName: string; opponentLogoUrl?: string; scheduledTime?: string | null }>>);
  }, [marketMatchups]);

  const handleOpenChampionSelector = useCallback((player: Player) => {
    if (!canEditMarket) {
      showToast({
        type: 'warning',
        title: 'Mercado Fechado',
        message: 'Nao e possivel escalar jogadores enquanto o mercado estiver fechado.',
        duration: 4000
      });
      return;
    }
    const currentPlayerInRole = userTeam.players[player.role];
    const availableFunds = userTeam.budget + (currentPlayerInRole?.price || 0);
    if (availableFunds < player.price) return;
    setPendingPlayer(player);
  }, [canEditMarket, userTeam.players, userTeam.budget, showToast]);

  const handleHirePlayer = useCallback((champion: Champion) => {
    if (!pendingPlayer) return;
    const playerToHire = { ...pendingPlayer, selectedChampion: champion };
    const currentPlayerInRole = userTeam.players[playerToHire.role];
    let newBudget = userTeam.budget;
    if (currentPlayerInRole) newBudget += currentPlayerInRole.price;
    newBudget -= playerToHire.price;

    const newPlayers = { ...userTeam.players, [playerToHire.role]: playerToHire };

    const updatedTeam = {
      ...userTeam,
      players: newPlayers,
      budget: newBudget,
    };
    persistTeam(updatedTeam);
    setPendingPlayer(null);

    showToast({
      type: 'success',
      title: 'Jogador contratado!',
      message: `${playerToHire.name} foi adicionado à sua escalação`,
      duration: 4000
    });
  }, [pendingPlayer, userTeam, persistTeam, showToast]);

  const handleFirePlayer = useCallback((role: Role) => {
    if (!canEditMarket) {
      showToast({
        type: 'warning',
        title: 'Mercado Fechado',
        message: 'Nao e possivel remover jogadores enquanto o mercado estiver fechado.',
        duration: 4000
      });
      return;
    }
    const playerToFire = userTeam.players[role];
    if (!playerToFire) return;

    const newPlayers = { ...userTeam.players, [role]: undefined };

    const updatedTeam = {
      ...userTeam,
      budget: userTeam.budget + playerToFire.price,
      players: newPlayers,
    };
    persistTeam(updatedTeam);

    showToast({
      type: 'info',
      title: 'Jogador dispensado',
      message: `${playerToFire.name} foi removido da escalação`,
      duration: 3000
    });
  }, [canEditMarket, userTeam, persistTeam, showToast]);

  const handleNavigate = useCallback((page: Page, leagueId?: string) => {
    if (page === 'market' || page === 'dashboard' || page === 'squad') {
      syncUserTeamFromServer();
    }

    setCurrentPage(page);
    if (leagueId) {
      setSelectedLeagueId(leagueId);
    } else if (page !== 'ranking') {
      setSelectedLeagueId(undefined);
    }
  }, [syncUserTeamFromServer]);

  const handleConfirmLineup = useCallback(async () => {
    if (!canEditMarket) {
      showToast({
        type: 'warning',
        title: 'Mercado Fechado',
        message: 'A escalacao nao pode ser confirmada com o mercado fechado.',
        duration: 4000
      });
      return;
    }

    try {
      // Salva via endpoint seguro com validação de budget server-side
      const result = await DataService.saveLineupSecure(userTeam.players);

      if (result.success) {
        // Atualiza budget local com o valor validado pelo servidor
        if (result.budget !== undefined) {
          setUserTeam(prev => ({ ...prev, budget: result.budget! }));
        }
        showToast({
          type: 'success',
          title: 'Escalação Confirmada!',
          message: 'Sua escalação foi salva com sucesso.',
          duration: 3000
        });
      } else {
        showToast({
          type: 'error',
          title: 'Erro ao Salvar',
          message: result.error || 'Não foi possível confirmar sua escalação.',
          duration: 5000
        });
      }
    } catch (error) {
      console.error('❌ App - Erro ao confirmar escalação:', error);
      showSaveError();
    }
  }, [canEditMarket, userTeam.players, showToast, showSaveError]);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard userTeam={userTeam} players={players} onNavigate={handleNavigate} />;
      case 'market':
        return (
          <Market
            players={players}
            userTeam={userTeam}
            teamMatchups={teamMatchups}
            currentRoundLabel={marketRoundLabel}
            isMarketOpen={canEditMarket}
            onHire={handleOpenChampionSelector}
            onFire={handleFirePlayer}
            onClear={() => {
              if (!canEditMarket) {
                showToast({
                  type: 'warning',
                  title: 'Mercado Fechado',
                  message: 'Nao e possivel limpar a escalacao com o mercado fechado.',
                  duration: 4000
                });
                return;
              }
              resetTeam();
            }}
            onConfirm={handleConfirmLineup}
            onRefresh={fetchPlayers}
          />
        );
      case 'squad': return <SquadBuilder userTeam={userTeam} onFire={handleFirePlayer} onNavigateToMarket={() => setCurrentPage('market')} />;
      case 'ranking': return <Ranking onOpenCreateLeague={() => setIsCreateLeagueOpen(true)} userId={userTeam.userId} userName={userTeam.userName} selectedLeagueId={selectedLeagueId} userTeam={{ name: userTeam.name, totalPoints: userTeam.currentRoundPoints ?? userTeam.totalPoints, avatar: userTeam.avatar }} />;
      case 'ai-coach': return <AICoach userTeam={userTeam} availablePlayers={players} />;
      case 'profile':
        return (
            <Profile
              userTeam={userTeam}
              onUpdate={(data) => {
                const updated = { ...userTeam, ...data, players: data.players || userTeam.players };
                persistTeam(updated);
              }}
              onLogout={handleLogout}
            />
        );
      case 'admin':
        return (
          <AdminPanel
            isAdmin={isAdmin}
            onAdminCheck={checkAdminAccess}
          />
        );
      default: return <Dashboard userTeam={userTeam} players={players} onNavigate={handleNavigate} />;
    }
  };

  if (isLoading) return <LoadingScreen />;
  
  return (
    <div className="flex flex-col min-h-screen bg-transparent text-[#f0f0f0]">
      {showLanding ? (
        <LandingPage onGetStarted={() => setShowLanding(false)} />
      ) : !isAuthenticated ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : needsOnboarding ? (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      ) : (
        <>
          {/* Command Palette */}
          <CommandPalette 
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            onNavigate={setCurrentPage}
            onOpenCreateLeague={() => setIsCreateLeagueOpen(true)}
            onRefreshPlayers={fetchPlayers}
            currentPage={currentPage}
          />
          
          {/* Shortcuts Guide */}
          <ShortcutsGuide 
            isOpen={isShortcutsGuideOpen}
            onClose={() => setIsShortcutsGuideOpen(false)}
          />
        
          {pendingPlayer && (
            <ChampionSelector 
              playerName={pendingPlayer.name}
              onSelect={handleHirePlayer}
              onClose={() => setPendingPlayer(null)}
            />
          )}

          {isCreateLeagueOpen && (
            <CreateLeagueModal 
              onClose={() => setIsCreateLeagueOpen(false)}
              userId={userTeam.userId}
              onSuccess={(leagueCode: string, leagueName: string) => {
                setCreatedLeagueCode(leagueCode);
                setCreatedLeagueName(leagueName);
                setIsCreateLeagueOpen(false);
                
                showToast({
                  type: 'success',
                  title: 'Liga criada com sucesso!',
                  message: `Código de convite: ${leagueCode}`,
                  duration: 8000,
                  action: {
                    label: 'Copiar código',
                    onClick: () => {
                      navigator.clipboard.writeText(leagueCode);
                      showToast({
                        type: 'info',
                        title: 'Código copiado!',
                        duration: 2000
                      });
                    }
                  }
                });
                
                // Auto-limpa a notificação após 10 segundos
                setTimeout(() => {
                  setCreatedLeagueCode(null);
                  setCreatedLeagueName('');
                }, 10000);
              }}
            />
          )}

          {/* Notificação de Liga Criada */}
          {createdLeagueCode && (
            <div className="fixed top-24 right-8 z-[2000] animate-in slide-in-from-top-5 fade-in duration-500">
              <div className="glass-card rounded-3xl p-6 border border-[#6366F1]/50 shadow-[0_20px_60px_rgba(94,108,255,0.4)] max-w-md">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#6366F1]/20 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-trophy text-[#6366F1] text-xl"></i>
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="font-orbitron font-black text-sm text-white uppercase tracking-tight">Liga Criada!</h3>
                    <p className="text-xs font-medium text-gray-400">{createdLeagueName}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Código de Convite</p>
                        <p className="font-orbitron font-black text-[#6366F1] text-lg tracking-wider">{createdLeagueCode}</p>
                      </div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(createdLeagueCode);
                          // Opcional: mostrar feedback de copiado
                        }}
                        className="w-10 h-10 bg-[#6366F1]/20 border border-[#6366F1]/30 rounded-xl flex items-center justify-center hover:bg-[#6366F1]/30 transition-all"
                      >
                        <i className="fa-solid fa-copy text-[#6366F1] text-xs"></i>
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setCreatedLeagueCode(null);
                      setCreatedLeagueName('');
                    }}
                    className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
                  >
                    <i className="fa-solid fa-xmark text-gray-500 text-sm"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

            <Header
              activePage={currentPage}
              onNavigate={(page) => handleNavigate(page)}
              userName={userTeam.userName}
              avatar={userTeam.avatar}
              dbConnected={dbConnected}
              marketIsOpen={marketIsOpen}
              isAdmin={isAdmin}
              showMarketTimer={currentPage === 'market'}
            />
          
          <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 md:px-12 py-12">
            <div key={currentPage} className="page-transition-container">
              {renderPage()}
            </div>
          </main>

          <footer className="py-20 border-t border-white/5 text-center bg-black/60 backdrop-blur-md">
            <div className="max-w-[1440px] mx-auto px-8">
              <p className="text-[11px] text-gray-700 max-w-3xl mx-auto leading-loose font-medium uppercase tracking-widest">© 2026 KINGS LENDAS FANTASY • AMÉRICA LATINA COMPETITIVA</p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
