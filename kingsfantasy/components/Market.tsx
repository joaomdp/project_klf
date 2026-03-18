
import React, { useState, useMemo, useEffect } from 'react';
import { Player, Role, UserTeam } from '../types';
import PlayerImage from './PlayerImage';
import TeamLogo from './TeamLogo';
import MatchHistoryModal from './MatchHistoryModal';
import DiversityIndicator from './DiversityIndicator';

interface MarketProps {
  players: Player[];
  userTeam: UserTeam;
  isMarketOpen: boolean;
  teamMatchups?: Record<string, Array<{ opponentName: string; opponentLogoUrl?: string; scheduledTime?: string | null }>>;
  currentRoundLabel?: string | null;
  onHire: (player: Player) => void;
  onFire: (role: Role) => void;
  onClear: () => void;
  onConfirm: () => Promise<void> | void;
  onRefresh: () => Promise<boolean>;
}

const Market: React.FC<MarketProps> = ({
  players,
  userTeam,
  isMarketOpen,
  teamMatchups = {},
  currentRoundLabel,
  onHire,
  onFire,
  onClear,
  onConfirm,
  onRefresh
}) => {
  const [filterRole, setFilterRole] = useState<Role | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [historyPlayer, setHistoryPlayer] = useState<Player | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showConfirmCheck, setShowConfirmCheck] = useState(false);
  const [lastConfirmedTeam, setLastConfirmedTeam] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Preload das imagens dos jogadores escalados
  useEffect(() => {
    const hiredPlayers = Object.values(userTeam.players).filter((p): p is Player => !!p);
    hiredPlayers.forEach(player => {
      if (player.image) {
        const img = new Image();
        img.src = player.image.startsWith('http') ? player.image : player.image;
        
        // Preload do campeão também
        const champ = player.selectedChampion || player.lastChampion;
        if (champ?.image) {
          const champImg = new Image();
          champImg.src = champ.image;
        }
      }
    });
  }, [userTeam.players]);

  // Detecta mudanças no time
  useEffect(() => {
    const currentTeamSnapshot = JSON.stringify({
      players: Object.keys(userTeam.players).reduce((acc, role) => {
        const player = userTeam.players[role as Role];
        if (player) {
          acc[role] = {
            id: player.id,
            selectedChampion: player.selectedChampion?.id || null
          };
        }
        return acc;
      }, {} as Record<string, any>)
    });

    if (lastConfirmedTeam && currentTeamSnapshot !== lastConfirmedTeam) {
      setHasUnsavedChanges(true);
    } else if (!lastConfirmedTeam) {
      // Primeiro carregamento, não marcar como alterado
      setHasUnsavedChanges(false);
    }
  }, [userTeam.players, lastConfirmedTeam]);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 200);
    return () => clearTimeout(timer);
  }, [filterRole]);

  const rolesList = [
    { id: Role.TOP, label: 'TOP', top: '22%', left: '20%', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png' },
    { id: Role.JNG, label: 'JNG', top: '38%', left: '36%', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png' },
    { id: Role.MID, label: 'MID', top: '52%', left: '52%', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png' },
    { id: Role.ADC, label: 'ADC', top: '82%', left: '76%', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png' },
    { id: Role.SUP, label: 'SUP', top: '75%', left: '90%', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png' }
  ];

  const roleMetadata: Record<string, { label: string; icon: string }> = {
    ALL: { label: 'TODOS', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-fill.png' },
    [Role.TOP]: { label: 'TOP', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png' },
    [Role.JNG]: { label: 'SELVA', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png' },
    [Role.MID]: { label: 'MEIO', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png' },
    [Role.ADC]: { label: 'ADC', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png' },
    [Role.SUP]: { label: 'SUP', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png' }
  };

  const filteredPlayers = useMemo(() => {
    return players
      .filter(p => {
        const matchesRole = filterRole === 'ALL' || p.role === filterRole;
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesRole && matchesSearch;
      })
      .sort((a, b) => b.price - a.price);
  }, [players, filterRole, searchTerm]);

  const teamValue = useMemo(() => {
    return Object.values(userTeam.players)
      .filter((p): p is Player => !!p)
      .reduce((sum, p) => sum + p.price, 0);
  }, [userTeam.players]);

  const PaiCoin = ({ size = "sm" }: { size?: "xs" | "sm" | "md" }) => (
    <img src="https://i.imgur.com/4odZyzF.png" className={`${size === "xs" ? "w-3.5 h-3.5" : size === "sm" ? "w-4 h-4" : "w-6 h-6"} object-contain invert-[0.1] sepia-[1] saturate-[5] hue-rotate-[210deg]`} alt="P" />
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500 pb-20">
      {historyPlayer && <MatchHistoryModal player={historyPlayer} onClose={() => setHistoryPlayer(null)} />}
      
      {/* Check animado de confirmação */}
      {showConfirmCheck && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="animate-in zoom-in duration-300">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-[0_0_80px_rgba(99,102,241,0.8)]">
              <i className="fa-solid fa-check text-6xl text-white"></i>
            </div>
          </div>
        </div>
      )}

        <div className="lg:col-span-4 space-y-8">
        <div className="lg:sticky lg:top-32 space-y-8">
           <div className="relative aspect-[5/4.8] w-full rounded-[2.5rem] overflow-hidden border border-white/10 bg-black shadow-[0_0_50px_rgba(0,0,0,0.8)] group">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
              <img
                src="https://i.imgur.com/myc9dfj.png"
                className="absolute inset-0 w-full h-full object-cover object-[50%_35%] scale-[1.28] opacity-55 contrast-[1.2] saturate-125"
                alt="Tactical Field"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black/55"></div>
             
             {rolesList.map(role => {
               const p = userTeam.players[role.id];
               return (
                   <div key={role.id} className="absolute -translate-x-1/2 -translate-y-1/2 z-20" style={{ top: role.top, left: role.left }}>
                      <div
                        className={`relative group/pin flex flex-col items-center gap-0.5 ${isMarketOpen ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
                        onClick={() => isMarketOpen && p && onFire(role.id)}
                      >
                       <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 transition-all duration-500 flex items-center justify-center overflow-hidden ${
                          p ? 'border-[#6366F1] bg-black shadow-[0_0_20px_rgba(94,108,255,0.5)] scale-110' : 'border-white/10 bg-black/80 hover:border-white/40'
                        }`}>
                          {p ? (
                            <PlayerImage player={p} priority className="w-full h-full rounded-full" imgClassName="w-full h-full object-cover" />
                          ) : (
                           <div className="w-1.5 h-1.5 bg-white/10 rounded-full animate-pulse"></div>
                         )}
                       </div>
                       {p && (
                         <span className="text-[8px] font-black uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10 whitespace-nowrap">
                           {p.name}
                         </span>
                       )}
                    </div>
                 </div>
               );
             })}
          </div>

          <div className="glass-card p-7 border border-white/5 space-y-8">
            <div className="space-y-4">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.4em] block px-1">MINHA ESCALAÇÃO</span>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {rolesList.map(role => {
                  const p = userTeam.players[role.id];
                  const champ = p?.selectedChampion || p?.lastChampion;
                  return (
                     <div key={role.id} className="flex flex-col gap-2 items-center relative">
                       <div className={`aspect-square w-full rounded-full border transition-all duration-500 relative flex items-center justify-center ${p ? 'border-[#6366F1] bg-black shadow-[0_0_15px_rgba(94,108,255,0.1)]' : 'border-white/5 bg-white/[0.02]'}`}>
                         {p ? (
                           <div className="w-full h-full rounded-full overflow-hidden">
                             <PlayerImage player={p} priority className="w-full h-full rounded-full" imgClassName="w-full h-full object-cover" />
                           </div>
                         ) : (
                           <img src={role.icon} className="w-3.5 h-3.5 brightness-0 invert opacity-10" alt="" />
                         )}
                         {champ && (
                           <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-2 border-black bg-black overflow-hidden shadow-2xl z-20">
                             <img src={champ.image} className="w-full h-full object-cover" alt="" />
                           </div>
                         )}
                       </div>
                       <span className={`text-[7px] font-black uppercase truncate w-full text-center ${p ? 'text-[#6366F1]' : 'text-gray-700'}`}>
                         {p ? p.name : role.label}
                       </span>
                     </div>
                  );
                 })}
                </div>
             </div>

             {/* Buff de Diversidade */}
             <div className="space-y-3">
               <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.4em] block px-1">BÔNUS ATIVO</span>
               <DiversityIndicator players={userTeam.players} />
             </div>

             {/* Aviso de alterações não salvas */}
            {hasUnsavedChanges && (
              <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-5 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/30 border-2 border-amber-500/50 flex items-center justify-center shrink-0 animate-pulse">
                    <i className="fa-solid fa-exclamation-triangle text-amber-300 text-lg"></i>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[11px] font-black text-amber-300 uppercase tracking-wider mb-2">Alterações Pendentes</h4>
                    <p className="text-[10px] text-amber-200/90 leading-relaxed font-medium">
                      Você modificou sua escalação. Clique em <span className="font-black text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded">CONFIRMAR</span> para salvar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/5">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block">PAITRIMÔNIO</span>
                <div className="flex items-center gap-2">
                  <PaiCoin size="sm" />
                  <span className="text-2xl font-orbitron font-black text-white">{userTeam.budget.toFixed(1)}</span>
                </div>
              </div>
              <div className="space-y-1 text-right">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block">VALOR TIME</span>
                <div className="flex items-center justify-end gap-2">
                  <PaiCoin size="sm" />
                  <span className="text-2xl font-orbitron font-black text-[#6366F1]">{teamValue.toFixed(1)}</span>
                </div>
              </div>
            </div>
            
             <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={onClear}
                disabled={!isMarketOpen}
                className={`py-3.5 border text-[9px] font-black uppercase tracking-widest transition-all ${isMarketOpen ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white' : 'bg-white/5 border-white/10 text-gray-600 cursor-not-allowed opacity-60'}`}
              >
                LIMPAR
              </button>
              <button 
                onClick={async () => {
                  // Mostra check animado
                  setShowConfirmCheck(true);
                  
                  // Chama a função de confirmação
                  try {
                    await onConfirm();
                    
                    // Salva snapshot do time confirmado
                    const currentTeamSnapshot = JSON.stringify({
                      players: Object.keys(userTeam.players).reduce((acc, role) => {
                        const player = userTeam.players[role as Role];
                        if (player) {
                          acc[role] = {
                            id: player.id,
                            selectedChampion: player.selectedChampion?.id || null
                          };
                        }
                        return acc;
                      }, {} as Record<string, any>)
                    });
                    setLastConfirmedTeam(currentTeamSnapshot);
                    setHasUnsavedChanges(false);
                  } catch (error) {
                    console.error('Erro ao confirmar:', error);
                  }
                  
                  // Remove o check após 800ms
                  setTimeout(() => {
                    setShowConfirmCheck(false);
                  }, 800);
                }}
                disabled={!isMarketOpen}
                className={`py-3.5 text-[9px] font-black uppercase tracking-widest transition-all ${isMarketOpen ? 'bg-[#6366F1] text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(94,108,255,0.4)]' : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-70'}`}
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-6">
        <div className="sticky top-28 z-40 pb-4 space-y-4">
          {/* Barra de Pesquisa */}
          <div className="relative bg-black/60 backdrop-blur-xl border border-white/5 p-1">
            <i className="fa-solid fa-magnifying-glass absolute left-6 top-1/2 -translate-y-1/2 text-gray-700 text-xs z-10"></i>
            <input 
              type="text" 
              placeholder="PROCURAR LENDAS NA ILHA..." 
              className="w-full bg-white/[0.03] border border-white/5 py-4 pl-14 pr-6 text-[11px] font-black text-white uppercase focus:outline-none focus:bg-white/[0.05] focus:border-[#6366F1]/30 transition-all"
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filtro de Lanes */}
          <div className="relative bg-black/60 backdrop-blur-xl border border-white/5 p-1">
            <div className="flex items-center gap-2 p-1 overflow-x-auto no-scrollbar">
              {Object.entries(roleMetadata).map(([key, data]) => (
                <button 
                  key={key} 
                  onClick={() => setFilterRole(key as any)} 
                  className={`flex-1 min-w-fit flex items-center justify-center gap-2.5 px-4 py-3 transition-all duration-300 ${
                    filterRole === key 
                      ? 'bg-[#6366F1]/10 text-white border border-[#6366F1]/40 shadow-[0_0_20px_rgba(94,108,255,0.2)]' 
                      : 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.02]'
                  }`}
                >
                  <img 
                    src={data.icon} 
                    className={`w-3.5 h-3.5 transition-all ${filterRole === key ? 'brightness-150' : 'brightness-50 opacity-30'}`} 
                    alt="" 
                  />
                  <span className="text-[10px] font-black uppercase tracking-[0.15em]">{data.label}</span>
                </button>
              ))}
            </div>
          </div>

          {currentRoundLabel && (
            <div className="bg-black/60 backdrop-blur-xl border border-white/5 px-4 py-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                Confrontos da {currentRoundLabel}
              </p>
            </div>
          )}
        </div>

        <div className={`space-y-4 transition-all duration-300 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          {filteredPlayers.map((player) => {
            const hiredPlayer = userTeam.players[player.role];
            const isHired = hiredPlayer?.id === player.id;
            const canAfford = isHired || (userTeam.budget + (hiredPlayer?.price || 0) >= player.price);
            const hiredChamp = isHired ? (hiredPlayer?.selectedChampion || hiredPlayer?.lastChampion) : null;
            const matchupList = player.teamId ? (teamMatchups[player.teamId] || []) : [];

            return (
              <div key={player.id} className={`relative group bg-black/40 border transition-all duration-500 overflow-hidden ${isHired ? 'border-[#6366F1]/60 shadow-[0_0_30px_rgba(94,108,255,0.1)]' : 'border-white/5 hover:border-white/20'}`}>
                
                <div className="absolute -top-12 -right-12 w-64 h-64 pointer-events-none z-0 transition-all duration-1000 ease-out opacity-[0.03] grayscale blur-[2px] group-hover:opacity-[0.15] group-hover:grayscale-0 group-hover:blur-0 group-hover:rotate-12 group-hover:scale-110">
                  <img 
                    src="https://i.imgur.com/4odZyzF.png" 
                    className="w-full h-full object-contain invert-[0.1] sepia-[1] saturate-[5] hue-rotate-[210deg]" 
                    alt="" 
                  />
                </div>

                 <div className="flex flex-col md:flex-row items-stretch relative z-10">
                   <div className="relative w-full md:w-52 h-60 md:h-auto shrink-0 overflow-hidden bg-black/70 border-r border-white/5">
                     <PlayerImage
                       player={player}
                       className="absolute inset-0 w-full h-full"
                       imgClassName="w-full h-full object-contain object-center"
                       smartFocus
                     />
                    <div className="absolute top-3 left-3 z-20"><TeamLogo logoUrl={player.teamLogo} teamName={player.team} className="w-8 h-8" /></div>
                    
                    {hiredChamp && (
                      <div className="absolute bottom-2 right-6 z-30 w-14 h-14 rounded-full border-2 border-[#6366F1] bg-black shadow-2xl overflow-hidden animate-in zoom-in duration-500">
                         <img src={hiredChamp.image} className="w-full h-full object-cover" alt={hiredChamp.name} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-6 md:p-10 flex flex-col justify-center gap-6">
                    <div>
                   <div className="flex items-center gap-3 mb-1">
                     <img src={roleMetadata[player.role].icon} className="w-3.5 h-3.5 brightness-200 opacity-40" alt="" />
                     <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">{player.team}</span>
                   </div>
                    <h3 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none group-hover:text-[#6366F1] transition-colors">{player.name}</h3>
                    <p className="mt-2 mb-1 text-[10px] uppercase tracking-[0.15em] text-gray-500">Confrontos da rodada</p>
                    <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar pr-1">
                      {matchupList.length > 0 ? (
                        matchupList.map((matchup, index) => (
                          <div
                            key={`${player.id}-matchup-${matchup.opponentName}-${index}`}
                            className="w-10 h-10 overflow-hidden shrink-0"
                            title={`Contra: ${matchup.opponentName}`}
                          >
                            {matchup.opponentLogoUrl ? (
                              <img
                                src={matchup.opponentLogoUrl}
                                alt={matchup.opponentName}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-gray-400 uppercase">
                                {matchup.opponentName.slice(0, 2)}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Confrontos: a definir</p>
                      )}
                    </div>
                     </div>
                    <div className="flex items-center gap-10">
                      <div>
                        <div className="flex items-end gap-1.5 mb-1"><span className="text-2xl font-black text-white font-orbitron tracking-tighter leading-none">{player.avgPoints.toFixed(1)}</span><span className="text-[10px] font-black text-[#6366F1] mb-0.5">PTS</span></div>
                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">MÉDIA</span>
                      </div>
                      <div className="w-px h-8 bg-white/5"></div>
                      <div>
                        <div className="flex items-end gap-1.5 mb-1"><span className="text-2xl font-black text-white font-orbitron tracking-tighter leading-none">{player.points.toFixed(1)}</span></div>
                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">ÚLT. JOGO</span>
                      </div>
                    </div>
                  </div>

                  <div className={`w-full md:w-60 shrink-0 flex flex-col justify-between p-8 md:p-10 md:border-l border-white/5 ${isHired ? 'bg-[#6366F1]/5' : 'bg-white/[0.01]'}`}>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block mb-1">VALOR</span>
                      <div className="flex items-center justify-end gap-2">
                        <PaiCoin size="sm" />
                        <span className={`text-2xl font-black font-orbitron tracking-tighter leading-none ${!canAfford && !isHired ? 'text-red-500' : 'text-white'}`}>{player.price.toFixed(1)}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => isMarketOpen && (isHired ? onFire(player.role) : onHire(player))}
                      disabled={!isMarketOpen || !canAfford}
                      className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${!isMarketOpen ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-70' : isHired ? 'border border-red-500/40 text-red-500 hover:bg-red-500 hover:text-white' : !canAfford ? 'bg-gray-800 text-gray-600 cursor-not-allowed opacity-50' : 'bg-[#6366F1] text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(94,108,255,0.3)]'}`}>
                      {!isMarketOpen ? 'MERCADO FECHADO' : isHired ? 'DISPENSAR' : !canAfford ? 'SEM SALDO' : 'ESCALAR'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Market;
