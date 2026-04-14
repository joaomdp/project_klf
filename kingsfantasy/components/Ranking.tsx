
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { DataService } from '../services/api';
import { League as LeagueType, RankingEntry } from '../types';
import kingsLogo from '../assets/images/logo/logo.png';
import leagueBackgroundImage from '../assets/images/backgrounds/fundo-capa-liga.optimized.jpg';

interface League {
  id: string;
  name: string;
  members: string;
  icon: string;
  color: string;
  isVerified: boolean;
  logoUrl?: string; // URL da logo (Kings ou time)
}

interface RankingProps {
  onOpenCreateLeague?: () => void;
  userId: string;
  userName: string;
  selectedLeagueId?: string;
  userTeam?: {
    name: string;
    totalPoints: number;
    avatar: string;
  };
}

const VerifiedSeal: React.FC<{ size?: string }> = ({ size = "text-[12px]" }) => (
  <div className={`relative flex items-center justify-center ${size} drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]`}>
    <i className="fa-solid fa-certificate text-[#3b82f6]"></i>
    <i className="fa-solid fa-check absolute text-[0.55em] text-black font-black"></i>
  </div>
);

const CustomDropdown: React.FC<{
  label: string;
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  icon: string;
}> = ({ label, options, selected, onSelect, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 xs:gap-3 group px-1.5 xs:px-2 py-1 transition-all touch-manipulation min-h-[44px]">
        <i className={`fa-solid ${icon} text-[9px] xs:text-[10px] text-gray-600 group-hover:text-white transition-colors`}></i>
        <span className="text-[9px] xs:text-[10px] font-black text-white uppercase tracking-wider xs:tracking-widest whitespace-nowrap">{label}</span>
        <div className="flex items-center gap-1.5 xs:gap-2">
          <span className="text-[9px] xs:text-[10px] font-medium text-gray-500 group-hover:text-gray-300 whitespace-nowrap">{selected}</span>
          <i className={`fa-solid fa-chevron-down text-[7px] xs:text-[8px] text-gray-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
        </div>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-40 xs:w-48 bg-[#0B0411] border border-white/10 rounded-lg xs:rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100] py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((opt) => (
              <button key={opt} onClick={() => { onSelect(opt); setIsOpen(false); }} className={`w-full flex items-center gap-2 xs:gap-3 px-3 xs:px-4 py-2.5 xs:py-3 text-[10px] xs:text-[11px] font-medium transition-all hover:bg-white/[0.03] text-left touch-manipulation min-h-[44px] ${selected === opt ? 'text-white bg-white/[0.02]' : 'text-gray-400 hover:text-white'}`}>
                <div className="w-4 flex items-center justify-center shrink-0">{selected === opt && <i className="fa-solid fa-check text-[#3b82f6] text-[8px] xs:text-[9px]"></i>}</div>
                <span className="truncate">{opt}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Componente memoizado para cada entrada do ranking - evita re-renderizações desnecessárias
const RankingItem: React.FC<{
  entry: RankingEntry;
  isUser: boolean;
}> = React.memo(({ entry, isUser }) => {
  return (
    <div className={`flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2.5 sm:py-3 hover:bg-white/[0.02] transition-colors group cursor-pointer touch-manipulation ${isUser ? 'bg-[#3b82f6]/[0.04]' : ''}`}>
      {/* Rank */}
      <span className={`font-orbitron font-black text-xs w-8 text-center shrink-0 ${entry.rank === 1 ? 'text-amber-400' : entry.rank === 2 ? 'text-gray-400' : entry.rank === 3 ? 'text-orange-600' : 'text-gray-700'}`}>
        {entry.rank}
      </span>

      {/* Avatar */}
      <img
        src={entry.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.userName}`}
        className="w-9 h-9 rounded-full object-cover border border-white/10 bg-black shrink-0"
        alt={entry.userName}
        loading="lazy"
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-black text-[13px] text-white uppercase tracking-tight group-hover:text-[#3b82f6] transition-colors leading-none mb-0.5 truncate">
          {entry.teamName}
        </h4>
        <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider truncate">{entry.userName}</p>
      </div>

      {/* Pontos */}
      <p className="font-orbitron font-black text-sm text-white shrink-0">{entry.points.toFixed(2)}</p>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: só re-renderiza se os dados realmente mudaram
  return (
    prevProps.entry.rank === nextProps.entry.rank &&
    prevProps.entry.points === nextProps.entry.points &&
    prevProps.entry.userName === nextProps.entry.userName &&
    prevProps.entry.teamName === nextProps.entry.teamName &&
    prevProps.entry.avatar === nextProps.entry.avatar &&
    prevProps.isUser === nextProps.isUser
  );
});

RankingItem.displayName = 'RankingItem';

const Ranking: React.FC<RankingProps> = ({ onOpenCreateLeague, userId, userName, selectedLeagueId, userTeam }) => {
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [tipoFiltro, setTipoFiltro] = useState('Temporada');
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leagueRanking, setLeagueRanking] = useState<RankingEntry[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [userRankInLeague, setUserRankInLeague] = useState<number | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(true);
  const isInitialLoadRef = useRef(true);

  // Cleanup quando desmontar
  useEffect(() => {
    isMountedRef.current = true;
    isInitialLoadRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Carrega as ligas do usuário ao montar o componente
  useEffect(() => {
    loadUserLeagues();
  }, [userId]); // Removido loadUserLeagues das dependências para evitar loops

  // Quando selectedLeagueId é passado, seleciona a liga automaticamente
  useEffect(() => {
    if (selectedLeagueId && myLeagues.length > 0) {
      const league = myLeagues.find(l => l.id === selectedLeagueId);
      if (league) {
        setSelectedLeague(league);
      }
    }
  }, [selectedLeagueId, myLeagues]);

  const loadMemberCount = async (leagueId: string) => {
    try {
      const count = await DataService.getLeagueMemberCount(leagueId);
      setMyLeagues(prev => prev.map(league => 
        league.id === leagueId ? { ...league, members: count.toString() } : league
      ));
      
      // Atualiza também a liga selecionada
      if (selectedLeague && selectedLeague.id === leagueId) {
        setSelectedLeague(prev => prev ? { ...prev, members: count.toString() } : null);
      }
    } catch (error) {
      console.error('Erro ao carregar contagem de membros:', error);
    }
  };

  const loadUserLeagues = async () => {
    setIsLoading(true);
    try {
      const leagues = await DataService.getUserLeagues(userId);

      const userTeam = await DataService.getUserTeam(userId);
      const favoriteTeam = userTeam?.favoriteTeam;

      const allTeams = await DataService.getTeams();

      const mappedLeagues: League[] = await Promise.all(leagues.map(async league => {
        let logoUrl: string | undefined;

        if (league.code === 'KINGSLENDAS' || league.name.toUpperCase().includes('KINGS')) {
          logoUrl = kingsLogo;
        } else if (favoriteTeam) {
          const team = allTeams.find(t =>
            t.name.toLowerCase() === favoriteTeam.toLowerCase() ||
            t.name.toLowerCase().includes(favoriteTeam.toLowerCase()) ||
            favoriteTeam.toLowerCase().includes(t.name.toLowerCase())
          );

          if (team) {
            logoUrl = team.logo;
          }
        }

        const memberCount = await DataService.getLeagueMemberCount(league.id);

        return {
          id: league.id,
          name: league.name,
          icon: league.icon || 'fa-trophy',
          color: getLeagueColor(league.icon),
          isVerified: league.isVerified,
          members: memberCount.toString(),
          logoUrl
        };
      }));

      setMyLeagues(mappedLeagues);
    } catch (error) {
      console.error('❌ Erro ao carregar ligas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeagueRanking = useCallback(async (leagueId: string, showLoading: boolean = true) => {
    // Só mostra loading se for solicitado (primeira carga)
    if (showLoading) {
      setIsLoadingRanking(true);
    } else {
      // Para atualizações em background, mostra indicador sutil
      setIsRefreshing(true);
    }
    
    try {
      const ranking = await DataService.getLeagueRanking(leagueId);
      
      // Só atualiza o estado se o componente ainda estiver montado
      if (!isMountedRef.current) return;
      
      // Atualiza o estado apenas se os dados realmente mudaram
      setLeagueRanking(prevRanking => {
        // Compara se houve mudanças reais nos dados
        if (JSON.stringify(prevRanking) === JSON.stringify(ranking)) {
          return prevRanking; // Retorna o estado anterior sem modificar
        }
        return ranking; // Atualiza com novos dados
      });
      
      // Encontra a posição do usuário atual no ranking
      const userEntry = ranking.find(entry => entry.userName === userName);
      setUserRankInLeague(userEntry ? userEntry.rank : null);
      
      // Marca que a carga inicial foi concluída
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        setIsInitialLoad(false);
      }
    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
      if (isMountedRef.current) {
        setLeagueRanking([]);
        setUserRankInLeague(null);
      }
    } finally {
      // Só esconde loading se estava mostrando e componente montado
      if (isMountedRef.current) {
        if (showLoading) {
          setIsLoadingRanking(false);
        } else {
          // Aguarda um pouco antes de esconder o indicador de refresh
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsRefreshing(false);
            }
          }, 500);
        }
      }
    }
  }, [userName]);

  // Carrega o ranking quando uma liga é selecionada
  useEffect(() => {
    if (selectedLeague) {
      // Marca como carga inicial e carrega com loading visível
      setIsInitialLoad(true);
      isInitialLoadRef.current = true;
      loadLeagueRanking(selectedLeague.id, true);
      loadMemberCount(selectedLeague.id);
    }
  }, [selectedLeague?.id, loadLeagueRanking]); // Mudou para selectedLeague?.id para evitar re-renders do objeto inteiro

  useEffect(() => {
    const handleLeagueRefresh = () => {
      if (selectedLeague) {
        loadLeagueRanking(selectedLeague.id, false);
      }
    };

    window.addEventListener('leagues:refresh', handleLeagueRefresh as EventListener);
    return () => window.removeEventListener('leagues:refresh', handleLeagueRefresh as EventListener);
  }, [selectedLeague, loadLeagueRanking]);

  // Função auxiliar para definir cores baseadas no ícone
  const getLeagueColor = (icon: string): string => {
    const colorMap: {[key: string]: string} = {
      'fa-earth-americas': 'bg-blue-500/10 text-blue-400',
      'fa-earth-europe': 'bg-green-500/10 text-green-400',
      'fa-earth-asia': 'bg-red-500/10 text-red-400',
      'fa-trophy': 'bg-[#3b82f6]/10 text-[#3b82f6]',
      'fa-shield': 'bg-purple-600/10 text-purple-400',
      'fa-crown': 'bg-yellow-500/10 text-yellow-400',
      'fa-star': 'bg-orange-500/10 text-orange-400',
    };
    return colorMap[icon] || 'bg-gray-500/10 text-gray-400';
  };

  const handleCopyInvite = () => {
    if (!selectedLeague) return;
    const inviteLink = `${window.location.origin}/invite/${selectedLeague.id}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  if (selectedLeague) {
    return (
      <div className="max-w-[1200px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">

        {/* Banner */}
        <div className="relative h-[200px] sm:h-[240px] overflow-hidden rounded-xl border border-white/8 shadow-[0_4px_30px_rgba(0,0,0,0.5)] group">
          <img src={leagueBackgroundImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:scale-105 transition-transform duration-700" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-black/50 to-transparent" />

          <div className="absolute inset-0 flex items-end px-3 sm:px-6 pb-4 sm:pb-6 gap-2 sm:gap-5 z-10">
            <div className="w-14 h-14 sm:w-20 sm:h-20 shrink-0">
              {selectedLeague.logoUrl
                ? <img src={selectedLeague.logoUrl} alt={selectedLeague.name} className="w-full h-full object-contain drop-shadow-2xl" />
                : <i className={`fa-solid ${selectedLeague.icon} text-4xl text-[#3b82f6]`}></i>
              }
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-orbitron font-black text-base sm:text-2xl lg:text-3xl text-white uppercase tracking-tighter truncate">{selectedLeague.name}</h1>
                {selectedLeague.isVerified && <VerifiedSeal size="text-[16px]" />}
              </div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{selectedLeague.members} membros</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-4 order-2 lg:order-1">

            {/* Ações */}
            <div className="bg-[#0d1117] border border-white/8 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">AÇÕES</span>
                <div className="flex items-center gap-2">
                  <button onClick={handleCopyInvite} className="flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] bg-white/5 border border-white/8 rounded-lg text-[9px] font-black text-gray-400 hover:text-[#3b82f6] hover:border-[#3b82f6]/30 transition-all uppercase tracking-wider touch-manipulation">
                    <i className={`fa-solid ${copiedInvite ? 'fa-check text-green-500' : 'fa-share-nodes'} text-[10px]`}></i>
                    {copiedInvite ? 'Copiado' : 'Convidar'}
                  </button>
                  <button
                    onClick={async () => {
                      if (!selectedLeague || !userId) return;
                      if (!confirm(`Tem certeza que deseja sair da liga "${selectedLeague.name}"?`)) return;
                      const success = await DataService.leaveLeague(selectedLeague.id, userId);
                      if (success) {
                        setMyLeagues(prev => prev.filter(l => l.id !== selectedLeague.id));
                        setSelectedLeague(null);
                      }
                    }}
                    className="px-3 py-1.5 min-h-[36px] bg-red-500/10 border border-red-500/20 rounded-lg text-[9px] font-black text-red-500 uppercase tracking-wider hover:bg-red-500 hover:text-white transition-all touch-manipulation"
                  >SAIR</button>
                </div>
              </div>

              {/* Meu time */}
              <div className="px-4 py-3">
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-3">MEU TIME</p>
                {userTeam ? (
                  <div className="flex items-center gap-3">
                    <span className="font-orbitron font-black text-sm text-[#3b82f6] w-8 shrink-0 text-center">
                      {userRankInLeague ? `#${userRankInLeague}` : '-'}
                    </span>
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 bg-black shrink-0">
                      <img src={userTeam.avatar} alt={userName} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-white uppercase tracking-tight truncate leading-none mb-0.5">{userTeam.name}</p>
                      <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider truncate">{userName}</p>
                    </div>
                    <p className="font-orbitron font-black text-white text-sm shrink-0">{userTeam.totalPoints.toFixed(2)}</p>
                  </div>
                ) : (
                  <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest py-2">Carregando...</p>
                )}
              </div>
            </div>

            {/* Voltar */}
            <button onClick={() => setSelectedLeague(null)} className="w-full py-3 sm:py-2.5 min-h-[44px] bg-[#0d1117] border border-white/8 rounded-xl text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] hover:text-white hover:border-white/20 transition-all touch-manipulation">
              ← VOLTAR PARA LIGAS
            </button>
          </div>

          {/* Ranking */}
          <div className="lg:col-span-8 order-1 lg:order-2">
            <div className="bg-[#0d1117] border border-white/8 rounded-xl overflow-hidden">
              <div className="px-3 sm:px-5 py-3 sm:py-3.5 border-b border-white/5 flex items-center justify-between">
                <h2 className="font-orbitron font-black text-sm text-white uppercase tracking-tight">RANKING</h2>
                <CustomDropdown label="TIPO" icon="fa-list-ul" options={['Temporada']} selected={tipoFiltro} onSelect={setTipoFiltro} />
              </div>

              {/* Header colunas */}
              <div className="px-3 sm:px-5 py-2 bg-white/[0.02] border-b border-white/5 grid grid-cols-[auto_1fr_auto] gap-2 sm:gap-4 items-center">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest w-8 text-center">#</span>
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Time</span>
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Pts</span>
              </div>

              <div className="divide-y divide-white/[0.04]">
                {isLoadingRanking ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-gray-600">
                    <i className="fa-solid fa-spinner fa-spin text-lg text-[#3b82f6]"></i>
                  </div>
                ) : leagueRanking.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <i className="fa-solid fa-users-slash text-3xl text-gray-700"></i>
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Nenhum membro ainda</p>
                  </div>
                ) : (
                  leagueRanking.map((entry) => (
                    <RankingItem key={entry.userName} entry={entry} isUser={entry.userName === userName} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto animate-in fade-in duration-700 space-y-6 xs:space-y-8 px-3 xs:px-4 sm:px-6">
      <div>
        <h2 className="text-[9px] xs:text-[10px] font-black text-[#3b82f6] uppercase tracking-wider mb-1.5 xs:mb-2">MODO COMPETITIVO</h2>
        <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-orbitron font-black text-white uppercase tracking-tighter leading-none">MINHAS <span className="text-[#3b82f6]">LIGAS</span></h1>
      </div>

      <div className="grid grid-cols-1 gap-3 xs:gap-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-10 xs:p-12">
            <i className="fa-solid fa-spinner fa-spin text-2xl xs:text-3xl text-[#3b82f6]"></i>
          </div>
        ) : myLeagues.length === 0 ? (
          <div className="glass-card p-10 xs:p-12 flex flex-col items-center gap-4 border border-white/5 rounded-xl">
            <div className="w-16 h-16 bg-white/5 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-trophy text-2xl text-gray-700"></i>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-orbitron font-black text-lg text-white uppercase">Nenhuma Liga Ainda</h3>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide max-w-sm">Peça um código de convite para entrar em uma liga existente</p>
            </div>
          </div>
        ) : (
          myLeagues.map((league) => (
            <div key={league.id} onClick={() => setSelectedLeague(league)} className="group relative flex items-center gap-4 px-5 py-4 sm:px-6 sm:py-5 bg-[#0d1117] border border-white/8 hover:border-[#3b82f6]/60 rounded-2xl cursor-pointer overflow-hidden transition-all duration-300 shadow-[0_2px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_4px_30px_rgba(99,102,241,0.15)] touch-manipulation">
              {/* Glow de fundo no hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#3b82f6]/0 to-[#3b82f6]/0 group-hover:from-[#3b82f6]/5 group-hover:to-transparent transition-all duration-500 pointer-events-none" />

              {/* Logo — marca d'água posicionada absolutamente, não afeta o layout */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-20 h-20 sm:w-28 sm:h-28 flex items-center justify-center opacity-[0.12] group-hover:opacity-25 transition-opacity duration-500 pointer-events-none">
                {league.logoUrl ? (
                  <img src={league.logoUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <i className={`fa-solid ${league.icon} text-5xl text-[#3b82f6]`}></i>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 w-0 relative z-10 pl-16 sm:pl-20">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-orbitron font-black text-sm sm:text-base text-white group-hover:text-[#3b82f6] transition-colors uppercase tracking-tight truncate">{league.name}</h3>
                  {league.isVerified && <VerifiedSeal />}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">
                  <i className="fa-solid fa-users text-[9px]"></i>
                  <span>{league.members} membros</span>
                </div>
              </div>

              {/* Seta */}
              <div className="relative z-10 w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#3b82f6]/20 group-hover:border-[#3b82f6]/40 transition-all duration-300 shrink-0">
                <i className="fa-solid fa-chevron-right text-[10px] text-gray-500 group-hover:text-white transition-colors"></i>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Ranking;
