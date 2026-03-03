
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { MOCK_RANKING } from '../constants';
import { DataService } from '../services/api';
import { League as LeagueType, RankingEntry } from '../types';
import kingsLogo from '../assets/images/logo/logo.png';
import leagueBackgroundImage from '../assets/images/backgrounds/fundo-capa-liga.jpg';

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
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-3 group px-2 py-1 transition-all">
        <i className={`fa-solid ${icon} text-[10px] text-gray-600 group-hover:text-white transition-colors`}></i>
        <span className="text-[10px] font-black text-white uppercase tracking-widest">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-gray-500 group-hover:text-gray-300">{selected}</span>
          <i className={`fa-solid fa-chevron-down text-[8px] text-gray-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
        </div>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-[#0B0411] border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100] py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((opt) => (
              <button key={opt} onClick={() => { onSelect(opt); setIsOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-medium transition-all hover:bg-white/[0.03] text-left ${selected === opt ? 'text-white bg-white/[0.02]' : 'text-gray-400 hover:text-white'}`}>
                <div className="w-4 flex items-center justify-center">{selected === opt && <i className="fa-solid fa-check text-[#6366F1] text-[9px]"></i>}</div>
                {opt}
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
    <div className={`flex items-center p-5 px-8 gap-8 hover:bg-white/[0.02] transition-all group cursor-pointer ${isUser ? 'bg-[#6366F1]/[0.05]' : ''}`}>
      <div className="w-8 text-center shrink-0">
        <span className={`font-orbitron font-black text-sm ${entry.rank <= 3 ? 'text-[#6366F1]' : 'text-gray-700'}`}>
          {entry.rank}
        </span>
      </div>
      <div className="relative w-10 h-10 shrink-0">
        <img 
          src={entry.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.userName}`} 
          className="relative z-10 w-full h-full object-cover rounded-full border border-white/10 bg-black" 
          alt={entry.userName}
          loading="lazy"
        />
      </div>
      <div className="flex-1">
        <h4 className="font-black text-white text-[14px] uppercase tracking-tighter group-hover:text-[#6366F1] transition-colors leading-none mb-1.5">
          {entry.teamName}
        </h4>
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
          {entry.userName}
        </p>
      </div>
      <div className="text-right">
        <p className="font-orbitron font-black text-white text-lg tracking-tight leading-none">
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
  const [rodadaFiltro, setRodadaFiltro] = useState('Rodada 10');
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
    console.log('🔍 DEBUG Ranking - userId recebido:', userId);
    try {
      const leagues = await DataService.getUserLeagues(userId);
      console.log('🔍 DEBUG Ranking - Ligas retornadas:', leagues);
      
      // Busca o time favorito do usuário para determinar logo
      const userTeam = await DataService.getUserTeam(userId);
      const favoriteTeam = userTeam?.favoriteTeam;
      console.log('🔍 DEBUG Ranking - favoriteTeam:', favoriteTeam);
      
      // Busca todos os times do banco para mapear nome -> logo
      const allTeams = await DataService.getTeams();
      console.log('🔍 DEBUG Ranking - Times disponíveis:', allTeams);
      
      // Mapeia os dados para o formato esperado pela UI
      const mappedLeagues: League[] = await Promise.all(leagues.map(async league => {
        let logoUrl: string | undefined;
        
        // Se for a liga global KINGSLENDAS, usa o logo do Kings
        if (league.code === 'KINGSLENDAS' || league.name.toUpperCase().includes('KINGS')) {
          logoUrl = kingsLogo;
        } 
        // Se for uma liga de time e temos o time favorito
        else if (favoriteTeam) {
          // Encontra o time no array de times pelo nome
          const team = allTeams.find(t => 
            t.name.toLowerCase() === favoriteTeam.toLowerCase() ||
            t.name.toLowerCase().includes(favoriteTeam.toLowerCase()) ||
            favoriteTeam.toLowerCase().includes(t.name.toLowerCase())
          );
          
          if (team) {
            logoUrl = team.logo;
            console.log('🔍 DEBUG Ranking - Logo encontrado para', favoriteTeam, ':', logoUrl);
          } else {
            console.warn('⚠️ Time não encontrado:', favoriteTeam);
          }
        }
        
        // Busca a contagem real de membros
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
      
      console.log('🔍 DEBUG Ranking - Ligas mapeadas:', mappedLeagues);
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
      <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="relative h-[200px] md:h-[280px] overflow-hidden group shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/5">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 space-y-5">
            <div className="w-48 h-48 md:w-56 md:h-56 flex items-center justify-center transition-transform duration-1000 ease-out group-hover:scale-110">
              {selectedLeague.logoUrl ? (
                <img src={selectedLeague.logoUrl} alt={selectedLeague.name} className="w-full h-full object-contain" />
              ) : (
                <i className={`fa-solid ${selectedLeague.icon} text-5xl md:text-6xl text-[#6366F1]`}></i>
              )}
            </div>
            <div className="flex items-center gap-4">
              <h1 className="font-orbitron font-black text-2xl md:text-4xl text-white uppercase tracking-tighter drop-shadow-2xl">{selectedLeague.name}</h1>
              {selectedLeague.isVerified && <VerifiedSeal size="text-[18px] md:text-[24px]" />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-card p-6 border border-white/5">
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                   <div className="flex items-center gap-2">
                     <h3 className="font-orbitron font-black text-lg text-white uppercase tracking-tight">{selectedLeague.name}</h3>
                   </div>
                   <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">{selectedLeague.members} MEMBROS</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleCopyInvite} className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 text-gray-400 hover:text-[#6366F1] hover:border-[#6366F1]/30 transition-all shadow-xl">
                    <i className={`fa-solid ${copiedInvite ? 'fa-check text-green-500' : 'fa-share-nodes'} text-xs`}></i>
                  </button>
                  <button className="px-3 py-2 bg-red-600/10 text-red-500 border border-red-500/10 text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">SAIR</button>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-white/5 space-y-5">
                 <h4 className="text-[9px] font-black text-gray-600 uppercase tracking-widest">MEU TIME</h4>
                 {userTeam ? (
                   <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 group hover:border-[#6366F1]/30 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                         <span className="font-orbitron font-black text-base text-[#6366F1] w-8">
                           {userRankInLeague ? `#${userRankInLeague}` : '-'}
                         </span>
                         <div className="w-10 h-10 bg-black border border-white/10 overflow-hidden rounded-full flex items-center justify-center">
                           <img src={userTeam.avatar} alt={userName} className="w-full h-full object-cover" />
                         </div>
                         <div>
                            <p className="text-[12px] font-black text-white uppercase tracking-tight leading-none mb-1 group-hover:text-[#6366F1] transition-colors">{userTeam.name}</p>
                            <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{userName}</p>
                         </div>
                      </div>
                      <p className="font-orbitron font-black text-white text-sm">{userTeam.totalPoints.toFixed(2)}</p>
                   </div>
                 ) : (
                   <div className="flex items-center justify-center p-6 bg-white/[0.02] border border-white/5">
                     <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Carregando...</p>
                   </div>
                 )}
              </div>
              <button onClick={() => setSelectedLeague(null)} className="w-full mt-6 py-3 bg-white/[0.01] border border-white/5 text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] hover:text-white hover:bg-white/5 transition-all">VOLTAR PARA LIGAS</button>
            </div>
          </div>
          <div className="lg:col-span-8">
            <div className="glass-card overflow-hidden border border-white/5 shadow-2xl">
              <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                 <h2 className="font-orbitron font-black text-lg text-white uppercase tracking-tight">RANKING</h2>
                 <div className="flex items-center gap-8">
                    <CustomDropdown label="TIPO" icon="fa-list-ul" options={['Temporada', 'Rodada']} selected={tipoFiltro} onSelect={setTipoFiltro} />
                    <CustomDropdown label="RODADA" icon="fa-sliders" options={['Rodada 10', 'Rodada 09']} selected={rodadaFiltro} onSelect={setRodadaFiltro} />
                 </div>
               </div>
               <div className="divide-y divide-white/[0.03]">
                  {isLoadingRanking ? (
                    <div className="flex items-center justify-center p-12">
                      <i className="fa-solid fa-spinner fa-spin text-2xl text-[#6366F1]"></i>
                    </div>
                  ) : leagueRanking.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 gap-4">
                      <i className="fa-solid fa-users-slash text-4xl text-gray-700"></i>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nenhum membro nesta liga ainda</p>
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
    <div className="max-w-[1000px] mx-auto animate-in fade-in duration-700 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-[10px] font-black text-[#6366F1] uppercase tracking-wider mb-2">MODO COMPETITIVO</h2>
          <h1 className="text-4xl md:text-5xl font-orbitron font-black text-white uppercase tracking-tighter leading-none">MINHAS <span className="text-[#6366F1]">LIGAS</span></h1>
        </div>
        <button onClick={onOpenCreateLeague} className="group flex items-center gap-3 px-6 py-3 bg-[#6366F1] border border-[#6366F1]/50 text-[10px] font-black text-black uppercase tracking-[0.1em] hover:scale-105 transition-all shadow-[0_0_30px_rgba(94,108,255,0.4)]">
          <i className="fa-solid fa-plus text-[11px]"></i>
          CRIAR LIGA
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <i className="fa-solid fa-spinner fa-spin text-3xl text-[#6366F1]"></i>
          </div>
        ) : myLeagues.length === 0 ? (
          <div className="glass-card p-10 flex flex-col items-center gap-5 border border-white/5">
            <div className="w-16 h-16 bg-white/5 flex items-center justify-center">
              <i className="fa-solid fa-trophy text-2xl text-gray-700"></i>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-orbitron font-black text-lg text-white uppercase">Nenhuma Liga Ainda</h3>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide max-w-md">Crie sua primeira liga ou peça um código de convite para entrar em uma liga existente</p>
            </div>
            <button onClick={onOpenCreateLeague} className="group flex items-center gap-3 px-6 py-3 bg-[#6366F1] border border-[#6366F1]/50 text-[10px] font-black text-black uppercase tracking-[0.1em] hover:scale-105 transition-all shadow-[0_0_30px_rgba(94,108,255,0.4)]">
              <i className="fa-solid fa-plus text-[11px]"></i>
              CRIAR PRIMEIRA LIGA
            </button>
          </div>
        ) : (
          myLeagues.map((league) => (
            <div key={league.id} onClick={() => setSelectedLeague(league)} className="group glass-card p-4 flex flex-col sm:flex-row items-center justify-between border border-white/5 hover:border-[#6366F1]/50 hover:bg-white/[0.04] transition-all duration-500 cursor-pointer">
              <div className="flex items-center gap-5 relative z-20">
                <div className="w-24 h-24 flex items-center justify-center transition-all duration-700">
                  {league.logoUrl ? (
                    <img src={league.logoUrl} alt={league.name} className="w-full h-full object-contain" />
                  ) : (
                    <i className={`fa-solid ${league.icon} text-3xl text-[#6366F1]`}></i>
                  )}
                </div>
                <div className="text-center sm:text-left">
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="font-orbitron font-black text-lg text-white group-hover:text-[#6366F1] transition-colors uppercase tracking-tighter">{league.name}</h3>
                    {league.isVerified && <VerifiedSeal />}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-gray-500 group-hover:text-gray-300"><i className="fa-solid fa-users text-[9px]"></i> {league.members} MEMBROS</div>
                </div>
              </div>
              <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center transition-all group-hover:border-[#6366F1]/60 group-hover:shadow-[0_0_20px_rgba(94,108,255,0.2)]">
                <i className="fa-solid fa-arrow-right-long text-sm text-gray-500 group-hover:text-white transition-all"></i>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Ranking;
