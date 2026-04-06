
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
  <div className={`relative flex items-center justify-center ${size} drop-shadow-[0_0_8px_rgba(94,108,255,0.6)]`}>
    <i className="fa-solid fa-certificate text-[#6366F1]"></i>
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
                <div className="w-4 flex items-center justify-center shrink-0">{selected === opt && <i className="fa-solid fa-check text-[#6366F1] text-[8px] xs:text-[9px]"></i>}</div>
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
    <div className={`flex items-center p-3 xs:p-4 sm:p-5 md:px-6 lg:px-8 gap-2 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-8 hover:bg-white/[0.02] transition-all group cursor-pointer touch-manipulation min-h-[60px] xs:min-h-[68px] ${isUser ? 'bg-[#6366F1]/[0.05]' : ''}`}>
      <div className="w-6 xs:w-7 sm:w-8 text-center shrink-0">
        <span className={`font-orbitron font-black text-xs xs:text-sm ${entry.rank <= 3 ? 'text-[#6366F1]' : 'text-gray-700'}`}>
          {entry.rank}
        </span>
      </div>
      <div className="relative w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 shrink-0">
        <img 
          src={entry.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.userName}`} 
          className="relative z-10 w-full h-full object-cover rounded-full border border-white/10 bg-black" 
          alt={entry.userName}
          loading="lazy"
        />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-black text-white text-[11px] xs:text-[12px] sm:text-[13px] md:text-[14px] uppercase tracking-tighter group-hover:text-[#6366F1] transition-colors leading-none mb-1 xs:mb-1.5 truncate">
          {entry.teamName}
        </h4>
        <p className="text-[8px] xs:text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase tracking-wide xs:tracking-wider sm:tracking-widest truncate">
          {entry.userName}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-orbitron font-black text-white text-sm xs:text-base sm:text-lg tracking-tight leading-none whitespace-nowrap">
          {entry.points.toFixed(2)}
        </p>
      </div>
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
      'fa-trophy': 'bg-[#6366F1]/10 text-[#6366F1]',
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
      <div className="max-w-[1200px] mx-auto space-y-6 xs:space-y-8 animate-in fade-in duration-500 pb-20 px-3 xs:px-4 sm:px-6">
        <div className="relative h-[180px] xs:h-[200px] sm:h-[220px] md:h-[260px] lg:h-[280px] overflow-hidden group shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/5 rounded-lg xs:rounded-xl">
          {/* Background Image */}
          <div className="absolute inset-0">
            <img 
              src={leagueBackgroundImage} 
              alt="League Background" 
              className="w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10"></div>
            <div className="absolute inset-0 opacity-20 pointer-events-none z-20" style={{ backgroundImage: 'radial-gradient(circle at center, #6366F1 0%, transparent 70%)' }}></div>
          </div>
          
          {/* Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 space-y-3 xs:space-y-4 sm:space-y-5 px-3">
            <div className="w-32 h-32 xs:w-40 xs:h-40 sm:w-48 sm:h-48 md:w-52 md:h-52 lg:w-56 lg:h-56 flex items-center justify-center transition-transform duration-1000 ease-out group-hover:scale-110">
              {selectedLeague.logoUrl ? (
                <img src={selectedLeague.logoUrl} alt={selectedLeague.name} className="w-full h-full object-contain drop-shadow-2xl" />
              ) : (
                <i className={`fa-solid ${selectedLeague.icon} text-4xl xs:text-5xl md:text-6xl text-[#6366F1]`}></i>
              )}
            </div>
            <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
              <h1 className="font-orbitron font-black text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl text-white uppercase tracking-tighter drop-shadow-2xl text-center">{selectedLeague.name}</h1>
              {selectedLeague.isVerified && <VerifiedSeal size="text-[14px] xs:text-[16px] sm:text-[18px] md:text-[20px] lg:text-[24px]" />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xs:gap-8">
          <div className="lg:col-span-4 space-y-4 xs:space-y-6">
            <div className="glass-card p-4 xs:p-5 sm:p-6 border border-white/5 rounded-lg xs:rounded-xl">
              <div className="flex flex-col xs:flex-row justify-between items-start gap-3 xs:gap-4 mb-5 xs:mb-6">
                <div className="space-y-1 flex-1 min-w-0">
                   <div className="flex items-center gap-2">
                     <h3 className="font-orbitron font-black text-base xs:text-lg text-white uppercase tracking-tight truncate">{selectedLeague.name}</h3>
                   </div>
                   <p className="text-[9px] xs:text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">{selectedLeague.members} MEMBROS</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={handleCopyInvite} className="w-10 h-10 xs:w-11 xs:h-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg xs:rounded-xl text-gray-400 hover:text-[#6366F1] hover:border-[#6366F1]/30 transition-all shadow-xl touch-manipulation">
                    <i className={`fa-solid ${copiedInvite ? 'fa-check text-green-500' : 'fa-share-nodes'} text-xs xs:text-sm`}></i>
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
                    className="px-3 xs:px-4 py-2 xs:py-2.5 bg-red-600/10 text-red-500 border border-red-500/10 rounded-lg xs:rounded-xl text-[8px] xs:text-[9px] font-black uppercase tracking-wider xs:tracking-widest hover:bg-red-500 hover:text-white transition-all touch-manipulation min-h-[40px] xs:min-h-[44px]"
                  >SAIR</button>
                </div>
              </div>
              <div className="mt-5 xs:mt-6 pt-5 xs:pt-6 border-t border-white/5 space-y-4 xs:space-y-5">
                 <h4 className="text-[9px] font-black text-gray-600 uppercase tracking-widest">MEU TIME</h4>
                 {userTeam ? (
                   <div className="flex items-center justify-between p-3 xs:p-4 bg-white/[0.02] border border-white/5 rounded-lg xs:rounded-xl group hover:border-[#6366F1]/30 transition-all cursor-pointer touch-manipulation min-h-[64px]">
                      <div className="flex items-center gap-2 xs:gap-3 flex-1 min-w-0">
                         <span className="font-orbitron font-black text-sm xs:text-base text-[#6366F1] w-7 xs:w-8 shrink-0">
                           {userRankInLeague ? `#${userRankInLeague}` : '-'}
                         </span>
                         <div className="w-9 h-9 xs:w-10 xs:h-10 bg-black border border-white/10 overflow-hidden rounded-full flex items-center justify-center shrink-0">
                           <img src={userTeam.avatar} alt={userName} className="w-full h-full object-cover" />
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-[11px] xs:text-[12px] font-black text-white uppercase tracking-tight leading-none mb-1 group-hover:text-[#6366F1] transition-colors truncate">{userTeam.name}</p>
                            <p className="text-[8px] xs:text-[9px] font-bold text-gray-600 uppercase tracking-widest truncate">{userName}</p>
                         </div>
                      </div>
                      <p className="font-orbitron font-black text-white text-xs xs:text-sm shrink-0 ml-2">{userTeam.totalPoints.toFixed(2)}</p>
                   </div>
                 ) : (
                   <div className="flex items-center justify-center p-5 xs:p-6 bg-white/[0.02] border border-white/5 rounded-lg xs:rounded-xl">
                     <p className="text-[9px] xs:text-[10px] font-bold text-gray-600 uppercase tracking-widest">Carregando...</p>
                   </div>
                 )}
              </div>
              <button onClick={() => setSelectedLeague(null)} className="w-full mt-5 xs:mt-6 py-2.5 xs:py-3 bg-white/[0.01] border border-white/5 rounded-lg xs:rounded-xl text-[8px] xs:text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] hover:text-white hover:bg-white/5 transition-all touch-manipulation min-h-[44px]">VOLTAR PARA LIGAS</button>
            </div>
          </div>
          <div className="lg:col-span-8">
            <div className="glass-card overflow-hidden border border-white/5 shadow-2xl rounded-lg xs:rounded-xl">
              <div className="p-4 xs:p-5 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 xs:gap-6">
                 <h2 className="font-orbitron font-black text-base xs:text-lg text-white uppercase tracking-tight">RANKING</h2>
                 <div className="flex items-center gap-4 xs:gap-6 sm:gap-8 w-full sm:w-auto justify-end">
                    <CustomDropdown label="TIPO" icon="fa-list-ul" options={['Temporada']} selected={tipoFiltro} onSelect={setTipoFiltro} />
                 </div>
               </div>
               <div className="divide-y divide-white/[0.03]">
                  {isLoadingRanking ? (
                    <div className="flex items-center justify-center p-10 xs:p-12">
                      <i className="fa-solid fa-spinner fa-spin text-xl xs:text-2xl text-[#6366F1]"></i>
                    </div>
                  ) : leagueRanking.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-10 xs:p-12 gap-3 xs:gap-4">
                      <i className="fa-solid fa-users-slash text-3xl xs:text-4xl text-gray-700"></i>
                      <p className="text-[10px] xs:text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Nenhum membro nesta liga ainda</p>
                    </div>
                   ) : (
                     leagueRanking.map((entry) => (
                       <RankingItem
                         key={entry.userName}
                         entry={entry}
                         isUser={entry.userName === userName}
                       />
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 xs:gap-5 sm:gap-6">
        <div className="w-full sm:w-auto">
          <h2 className="text-[9px] xs:text-[10px] font-black text-[#6366F1] uppercase tracking-wider mb-1.5 xs:mb-2">MODO COMPETITIVO</h2>
          <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-orbitron font-black text-white uppercase tracking-tighter leading-none">MINHAS <span className="text-[#6366F1]">LIGAS</span></h1>
        </div>
        <button onClick={onOpenCreateLeague} className="group flex items-center gap-2 xs:gap-3 px-4 xs:px-5 sm:px-6 py-2.5 xs:py-3 bg-[#6366F1] border border-[#6366F1]/50 rounded-lg xs:rounded-xl text-[9px] xs:text-[10px] font-black text-black uppercase tracking-[0.1em] hover:scale-105 transition-all shadow-[0_0_30px_rgba(94,108,255,0.4)] touch-manipulation min-h-[44px] w-full sm:w-auto justify-center">
          <i className="fa-solid fa-plus text-[10px] xs:text-[11px]"></i>
          <span className="whitespace-nowrap">CRIAR LIGA</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 xs:gap-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-10 xs:p-12">
            <i className="fa-solid fa-spinner fa-spin text-2xl xs:text-3xl text-[#6366F1]"></i>
          </div>
        ) : myLeagues.length === 0 ? (
          <div className="glass-card p-8 xs:p-10 flex flex-col items-center gap-4 xs:gap-5 border border-white/5 rounded-lg xs:rounded-xl">
            <div className="w-14 h-14 xs:w-16 xs:h-16 bg-white/5 rounded-lg xs:rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-trophy text-xl xs:text-2xl text-gray-700"></i>
            </div>
            <div className="text-center space-y-1.5 xs:space-y-2">
              <h3 className="font-orbitron font-black text-base xs:text-lg text-white uppercase">Nenhuma Liga Ainda</h3>
              <p className="text-[10px] xs:text-xs font-medium text-gray-500 uppercase tracking-wide max-w-md px-4">Crie sua primeira liga ou peça um código de convite para entrar em uma liga existente</p>
            </div>
            <button onClick={onOpenCreateLeague} className="group flex items-center gap-2 xs:gap-3 px-5 xs:px-6 py-2.5 xs:py-3 bg-[#6366F1] border border-[#6366F1]/50 rounded-lg xs:rounded-xl text-[9px] xs:text-[10px] font-black text-black uppercase tracking-[0.1em] hover:scale-105 transition-all shadow-[0_0_30px_rgba(94,108,255,0.4)] touch-manipulation min-h-[44px]">
              <i className="fa-solid fa-plus text-[10px] xs:text-[11px]"></i>
              <span className="whitespace-nowrap">CRIAR PRIMEIRA LIGA</span>
            </button>
          </div>
        ) : (
          myLeagues.map((league) => (
            <div key={league.id} onClick={() => setSelectedLeague(league)} className="group glass-card p-4 xs:p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 xs:gap-5 border border-white/5 hover:border-[#6366F1]/50 hover:bg-white/[0.04] transition-all duration-500 cursor-pointer rounded-lg xs:rounded-xl touch-manipulation">
              <div className="flex items-center gap-4 xs:gap-5 relative z-20 w-full sm:w-auto">
                <div className="w-20 h-20 xs:w-24 xs:h-24 sm:w-28 sm:h-28 flex items-center justify-center transition-all duration-700 shrink-0">
                  {league.logoUrl ? (
                    <img src={league.logoUrl} alt={league.name} className="w-full h-full object-contain drop-shadow-xl" />
                  ) : (
                    <i className={`fa-solid ${league.icon} text-2xl xs:text-3xl text-[#6366F1]`}></i>
                  )}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="flex items-center gap-2 xs:gap-2.5 mb-1 flex-wrap">
                    <h3 className="font-orbitron font-black text-base xs:text-lg text-white group-hover:text-[#6366F1] transition-colors uppercase tracking-tighter truncate">{league.name}</h3>
                    {league.isVerified && <VerifiedSeal />}
                  </div>
                  <div className="flex items-center gap-1.5 xs:gap-2 text-[10px] xs:text-[11px] font-bold uppercase text-gray-500 group-hover:text-gray-300"><i className="fa-solid fa-users text-[8px] xs:text-[9px]"></i> <span className="whitespace-nowrap">{league.members} MEMBROS</span></div>
                </div>
              </div>
              <div className="w-10 h-10 xs:w-11 xs:h-11 bg-white/5 border border-white/10 rounded-lg xs:rounded-xl flex items-center justify-center transition-all group-hover:border-[#6366F1]/60 group-hover:shadow-[0_0_20px_rgba(94,108,255,0.2)] shrink-0">
                <i className="fa-solid fa-arrow-right-long text-xs xs:text-sm text-gray-500 group-hover:text-white transition-all"></i>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Ranking;
