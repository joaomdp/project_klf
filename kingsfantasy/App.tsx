
import React, { useState, useEffect, useCallback } from 'react';
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
  team_a?: { id: string; name: string };
  team_b?: { id: string; name: string };
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
    return false;
  }
};

const clearInvalidSession = () => {
  const sessionStr = localStorage.getItem('nexus_session');
  if (!sessionStr) return;

  try {
    const session = JSON.parse(sessionStr);
    if (!session.access_token || !session.user?.id || isTokenExpired(session.access_token)) {
      console.log('⚠️ Sessão inválida detectada, limpando...');
      localStorage.removeItem('nexus_session');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('setup_complete_')) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (e) {
    console.log('⚠️ Erro ao parsear sessão, limpando...');
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
  const isMarketOpen = true;
  const [dbConnected, setDbConnected] = useState(false);
  const [isCreateLeagueOpen, setIsCreateLeagueOpen] = useState(false);
  const [createdLeagueCode, setCreatedLeagueCode] = useState<string | null>(null);
  const [createdLeagueName, setCreatedLeagueName] = useState<string>('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsGuideOpen, setIsShortcutsGuideOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [marketMatchups, setMarketMatchups] = useState<MarketMatch[]>([]);
  const [marketRoundLabel, setMarketRoundLabel] = useState<string | null>(null);
  
  const { showToast } = useToast();

  const [userTeam, setUserTeam] = useState<UserTeam>(DEFAULT_USER_TEAM);

  const [pendingPlayer, setPendingPlayer] = useState<Player | null>(null);

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

  // Função para calcular pontos totais do time
  const calculateTotalPoints = useCallback((teamPlayers: UserTeam['players']): number => {
    return Object.values(teamPlayers)
      .filter((p): p is Player => !!p)
      .reduce((sum, p) => sum + p.points, 0);
  }, []);

  const withRecalculatedPoints = useCallback((team: UserTeam) => ({
    ...team,
    totalPoints: calculateTotalPoints(team.players)
  }), [calculateTotalPoints]);

  const persistTeam = useCallback((team: UserTeam) => {
    setUserTeam(team);
    DataService.saveUserTeam(team);
  }, []);

  const resetTeam = useCallback(() => {
    setUserTeam(prev => ({
      ...prev,
      budget: prev.budget + Object.values(prev.players)
        .filter((p): p is Player => !!p)
        .reduce((sum, p) => sum + (p.price || 0), 0),
      players: {},
      totalPoints: 0
    }));
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
    const data = await DataService.getCurrentRoundMatchups();
    setMarketMatchups(data.matches || []);
    if (data.round?.round_number) {
      setMarketRoundLabel(`rodada ${data.round.round_number}`);
    } else {
      setMarketRoundLabel(null);
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

  useEffect(() => {
    const initApp = async () => {
      clearInvalidSession();
      
      const callbackResult: any = AuthService.handleAuthCallback();
      const session = (callbackResult && !callbackResult.error) ? callbackResult : AuthService.getSession();

      const hasSession = Boolean(session && session.access_token && session.user?.id);
        if (hasSession) {
        setIsLoading(true);
        console.log('✅ Sessão válida encontrada, userId:', session.user?.id);
        // Usuário autenticado - esconde landing page
        setShowLanding(false);
        
          // Busca dados essenciais em paralelo para reduzir tempo de carregamento
          console.log('🔍 Buscando dados do usuário:', session.user.id);
          const [, , existingTeam] = await Promise.all([
            fetchPlayers(),
            checkAdminAccess(),
            DataService.getUserTeam(session.user.id)
          ]);
          await loadCurrentRoundMatchups();
        
        if (existingTeam) {
          // Usuário já tem dados no banco - carrega e não precisa fazer onboarding
          console.log('✅ Usuário existente encontrado no banco:', existingTeam.userName);
          // Recalcula os pontos totais baseado nos jogadores escalados
          const teamWithUpdatedPoints = withRecalculatedPoints(existingTeam);
          
          setUserTeam(teamWithUpdatedPoints);
          setIsAuthenticated(true);
          setNeedsOnboarding(false);
          
          // Marca como setup completo no localStorage
          localStorage.setItem(`setup_complete_${session.user.id}`, 'true');
          console.log('✅ Setup marcado como completo para:', session.user.id);
        } else {
          // Usuário novo - precisa fazer onboarding
          console.log('⚠️ Usuário novo detectado, iniciando onboarding');
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
        console.log('ℹ️ Nenhuma sessão encontrada, mostrando landing page');
        setShowLanding(true);
        setIsAuthenticated(false);
        setNeedsOnboarding(false);
      }
      
        setIsLoading(false);
      };

    initApp();
  }, [fetchPlayers, calculateTotalPoints, checkAdminAccess, loadCurrentRoundMatchups]);

  useEffect(() => {
    if (!players.length) return;
    setUserTeam((prev) => {
      const merged = mergeLineupWithLatest(prev, players);
      if (merged === prev) return prev;
      return withRecalculatedPoints(merged);
    });
  }, [players, mergeLineupWithLatest, withRecalculatedPoints]);

  useEffect(() => {
    const handlePlayersRefresh = () => {
      fetchPlayers();
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
  }, [fetchPlayers, loadCurrentRoundMatchups]);

  const handleLoginSuccess = async (userData: any) => {
    setIsLoading(true);
    setShowLanding(false);
    setIsAuthenticated(true);
    
    try {
      const session = AuthService.getSession();
      if (session?.user?.id) {
        // Busca jogadores, admin e time do usuário em paralelo
        console.log('🔍 handleLoginSuccess - Verificando usuário:', session.user.id);
        const [, , existingTeam] = await Promise.all([
          fetchPlayers(),
          checkAdminAccess(),
          DataService.getUserTeam(session.user.id)
        ]);
        await loadCurrentRoundMatchups();
        
           if (existingTeam) {
            // Usuário já existe - carrega os dados e pula onboarding
            console.log('✅ handleLoginSuccess - Usuário existente:', existingTeam.userName);
            const teamWithUpdatedPoints = withRecalculatedPoints(existingTeam);
          
          setUserTeam(teamWithUpdatedPoints);
          setNeedsOnboarding(false);
          localStorage.setItem(`setup_complete_${session.user.id}`, 'true');
          console.log('✅ handleLoginSuccess - Setup marcado como completo');
        } else {
          // Usuário novo - precisa fazer onboarding
          console.log('⚠️ handleLoginSuccess - Novo usuário, iniciando onboarding');
          // Define o userName baseado nos dados disponíveis
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
        // Fallback: assume que é novo usuário
        console.log('⚠️ handleLoginSuccess - Sem session.user.id, assumindo novo usuário');
        setNeedsOnboarding(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = async (data: { userName: string; teamName: string; avatar: string; favoriteTeam: string }) => {
    console.log('🔍 DEBUG - handleOnboardingComplete CHAMADO com data:', data);
    
    const session = AuthService.getSession();
    console.log('🔍 DEBUG - Session obtida:', session?.user?.id ? 'OK' : 'NULL');
    
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
      console.log('🔍 DEBUG - Salvando userTeam com userId:', session.user.id);
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
      
      console.log('🔍 DEBUG - Chamando joinDefaultLeagues com:', {
        userId: session.user.id,
        favoriteTeam: data.favoriteTeam
      });
      const leagueResult = await DataService.joinDefaultLeagues(session.user.id, data.favoriteTeam);
      console.log('🔍 DEBUG - Resultado joinDefaultLeagues:', leagueResult);
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

  const handleLogout = () => {
    AuthService.signOut();
  };
  
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

  const handleOpenChampionSelector = (player: Player) => {
    if (!isMarketOpen) return;
    const currentPlayerInRole = userTeam.players[player.role];
    const availableFunds = userTeam.budget + (currentPlayerInRole?.price || 0);
    if (availableFunds < player.price) return; 
    setPendingPlayer(player);
  };

  const handleHirePlayer = (champion: Champion) => {
    if (!pendingPlayer) return;
    const playerToHire = { ...pendingPlayer, selectedChampion: champion };
    const currentPlayerInRole = userTeam.players[playerToHire.role];
    let newBudget = userTeam.budget;
    if (currentPlayerInRole) newBudget += currentPlayerInRole.price;
    newBudget -= playerToHire.price;
    
    const newPlayers = { ...userTeam.players, [playerToHire.role]: playerToHire };
    const newTotalPoints = calculateTotalPoints(newPlayers);
    
    const updatedTeam = {
      ...userTeam,
      players: newPlayers,
      budget: newBudget,
      totalPoints: newTotalPoints,
    };
    persistTeam(updatedTeam);
    setPendingPlayer(null);
    
    showToast({
      type: 'success',
      title: 'Jogador contratado!',
      message: `${playerToHire.name} foi adicionado à sua escalação`,
      duration: 4000
    });
  };

  const handleFirePlayer = (role: Role) => {
    if (!isMarketOpen) return;
    const playerToFire = userTeam.players[role];
    if (!playerToFire) return;
    
    const newPlayers = { ...userTeam.players, [role]: undefined };
    const newTotalPoints = calculateTotalPoints(newPlayers);
    
    const updatedTeam = {
      ...userTeam,
      budget: userTeam.budget + playerToFire.price,
      players: newPlayers,
      totalPoints: newTotalPoints,
    };
    persistTeam(updatedTeam);
    
    showToast({
      type: 'info',
      title: 'Jogador dispensado',
      message: `${playerToFire.name} foi removido da escalação`,
      duration: 3000
    });
  };

  const handleNavigate = (page: Page, leagueId?: string) => {
    setCurrentPage(page);
    if (leagueId) {
      setSelectedLeagueId(leagueId);
    } else if (page !== 'ranking') {
      setSelectedLeagueId(undefined);
    }
  };

  const handleConfirmLineup = async () => {
    try {
      // Salva a escalação no banco de dados
      const success = await DataService.saveUserTeam(userTeam);
      
      if (success) {
        showToast({
          type: 'success',
          title: 'Escalação Confirmada!',
          message: 'Sua escalação foi salva com sucesso.',
          duration: 3000
        });
        // Permanece na página de mercado
      } else {
        showSaveError();
      }
    } catch (error) {
      console.error('❌ App - Erro ao confirmar escalação:', error);
      showSaveError();
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard userTeam={userTeam} onNavigate={handleNavigate} />;
      case 'market':
        return (
          <Market
            players={players}
            userTeam={userTeam}
            teamMatchups={marketMatchups.reduce<Record<string, { label: string; scheduledTime?: string | null }>>((acc, match) => {
              const teamAId = String(match.team_a_id);
              const teamBId = String(match.team_b_id);
              const teamAName = match.team_a?.name || teamAId;
              const teamBName = match.team_b?.name || teamBId;
              const label = `${teamAName} vs ${teamBName}`;
              acc[teamAId] = { label, scheduledTime: match.scheduled_time };
              acc[teamBId] = { label, scheduledTime: match.scheduled_time };
              return acc;
            }, {})}
            currentRoundLabel={marketRoundLabel}
            onHire={handleOpenChampionSelector}
            onFire={handleFirePlayer}
            onClear={() => isMarketOpen && resetTeam()}
            onConfirm={handleConfirmLineup}
            onRefresh={fetchPlayers}
          />
        );
      case 'squad': return <SquadBuilder userTeam={userTeam} onFire={handleFirePlayer} onNavigateToMarket={() => setCurrentPage('market')} />;
      case 'ranking': return <Ranking onOpenCreateLeague={() => setIsCreateLeagueOpen(true)} userId={userTeam.userId} userName={userTeam.userName} selectedLeagueId={selectedLeagueId} userTeam={{ name: userTeam.name, totalPoints: userTeam.totalPoints, avatar: userTeam.avatar }} />;
      case 'ai-coach': return <AICoach userTeam={userTeam} availablePlayers={players} />;
      case 'profile':
        return (
          <Profile
            userTeam={userTeam}
            onUpdate={(data) => {
              const updated = withRecalculatedPoints({ ...userTeam, ...data, players: data.players || userTeam.players });
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
      default: return <Dashboard userTeam={userTeam} onNavigate={handleNavigate} />;
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
                console.log("✅ Liga criada com sucesso! Código:", leagueCode);
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
              onNavigate={setCurrentPage}
              userName={userTeam.userName}
              avatar={userTeam.avatar}
              dbConnected={dbConnected}
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
