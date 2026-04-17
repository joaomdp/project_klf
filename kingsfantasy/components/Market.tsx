
import React, { useState, useMemo, useEffect } from 'react';
import { Player, Role, UserTeam } from '../types';
import PlayerImage from './PlayerImage';
import TeamLogo from './TeamLogo';
import DiversityIndicator from './DiversityIndicator';
import PaiCoin from './PaiCoin';
import MatchHistoryModal from './MatchHistoryModal';

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
  onRefresh: (options?: { silent?: boolean }) => Promise<boolean>;
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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showConfirmCheck, setShowConfirmCheck] = useState(false);
  const [lastConfirmedTeam, setLastConfirmedTeam] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [historyPlayer, setHistoryPlayer] = useState<Player | null>(null);

  // Buscar dados frescos ao montar o componente (silencioso, sem toast)
  useEffect(() => {
    onRefresh({ silent: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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


  const handleConfirm = async () => {
    setShowConfirmCheck(true);
    try {
      await onConfirm();
      const currentTeamSnapshot = JSON.stringify({
        players: Object.keys(userTeam.players).reduce((acc, role) => {
          const player = userTeam.players[role as Role];
          if (player) acc[role] = { id: player.id, selectedChampion: player.selectedChampion?.id || null };
          return acc;
        }, {} as Record<string, any>)
      });
      setLastConfirmedTeam(currentTeamSnapshot);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Erro ao confirmar:', error);
    }
    setTimeout(() => setShowConfirmCheck(false), 800);
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 md:gap-10 animate-in fade-in duration-500 pb-16 sm:pb-20 px-3 xs:px-4 sm:px-6">
      {/* Check animado de confirmação */}
      {showConfirmCheck && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="animate-in zoom-in duration-300">
            <div className="w-24 h-24 xs:w-28 xs:h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8B5CF6] flex items-center justify-center shadow-[0_0_60px_rgba(99,102,241,0.7)]">
              <i className="fa-solid fa-check text-5xl xs:text-6xl text-white"></i>
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR ── */}
      <div className="lg:col-span-4 order-1">
        <div className="lg:sticky lg:top-28 xl:top-32 space-y-4 sm:space-y-6">

          {/* Mapa tático — oculto no mobile, visível a partir de lg */}
          <div className="hidden lg:block relative aspect-[5/4.8] w-full rounded-[2rem] overflow-hidden border border-white/10 bg-black shadow-[0_0_50px_rgba(0,0,0,0.8)] group">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
            <img src="https://i.imgur.com/myc9dfj.png" className="absolute inset-0 w-full h-full object-cover object-[50%_35%] scale-[1.28] opacity-55 contrast-[1.2] saturate-125" alt="Tactical Field" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black/55"></div>
            {rolesList.map(role => {
              const p = userTeam.players[role.id];
              return (
                <div key={role.id} className="absolute -translate-x-1/2 -translate-y-1/2 z-20" style={{ top: role.top, left: role.left }}>
                  <div className={`relative group/pin flex flex-col items-center gap-0.5 ${isMarketOpen ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`} onClick={() => isMarketOpen && p && onFire(role.id)}>
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 transition-all duration-500 flex items-center justify-center overflow-hidden ${p ? 'border-[#3b82f6] bg-black shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-110' : 'border-white/10 bg-black/80 hover:border-white/40'}`}>
                      {p ? <PlayerImage player={p} priority className="w-full h-full rounded-full" imgClassName="w-full h-full object-cover" /> : <div className="w-1.5 h-1.5 bg-white/10 rounded-full animate-pulse"></div>}
                    </div>
                    {p && <span className="text-[8px] font-black uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10 whitespace-nowrap">{p.name}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Painel de escalação + ações */}
          <div className="bg-[#0d1117] border border-white/8 rounded-xl overflow-hidden">

            {/* Escalação */}
            <div className="p-4 sm:p-5 border-b border-white/5">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.4em] block mb-3">MINHA ESCALAÇÃO</span>
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {rolesList.map(role => {
                  const p = userTeam.players[role.id];
                  const champ = p?.selectedChampion || p?.lastChampion;
                  return (
                    <div key={role.id} className="flex flex-col gap-1.5 items-center relative">
                      <div className={`aspect-square w-full rounded-full border transition-all duration-500 relative flex items-center justify-center ${p ? 'border-[#3b82f6] bg-black shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-white/5 bg-white/[0.02]'}`}>
                        {p ? (
                          <div className="w-full h-full rounded-full overflow-hidden">
                            <PlayerImage player={p} priority className="w-full h-full rounded-full" imgClassName="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <img src={role.icon} className="w-3.5 h-3.5 brightness-0 invert opacity-10" alt="" />
                        )}
                        {champ && (
                          <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-black bg-black overflow-hidden shadow-2xl z-20">
                            <img src={champ.image} className="w-full h-full object-cover" alt="" />
                          </div>
                        )}
                      </div>
                      <span className={`text-[7px] font-black uppercase truncate w-full text-center ${p ? 'text-[#3b82f6]' : 'text-gray-700'}`}>
                        {p ? p.name.substring(0, 6) : role.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bônus */}
            <div className="p-4 sm:p-5 border-b border-white/5">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.4em] block mb-3">BÔNUS ATIVO</span>
              <DiversityIndicator players={userTeam.players} />
            </div>

            {/* Aviso pendente */}
            {hasUnsavedChanges && (
              <div className="mx-3 sm:mx-4 my-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 sm:p-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 animate-pulse">
                    <i className="fa-solid fa-exclamation-triangle text-amber-300 text-sm"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-black text-amber-300 uppercase tracking-wider mb-0.5">Alterações Pendentes</h4>
                    <p className="text-[9px] text-amber-200/80 font-medium leading-snug">Confirme para salvar sua escalação.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Saldo + Valor */}
            <div className="grid grid-cols-2 divide-x divide-white/5 border-t border-white/5">
              <div className="px-4 py-3">
                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest block mb-1">PAITRIMÔNIO</span>
                <div className="flex items-center gap-1.5">
                  <PaiCoin size="sm" />
                  <span className="text-lg font-orbitron font-black text-white">{userTeam.budget.toFixed(1)}</span>
                </div>
              </div>
              <div className="px-4 py-3 text-right">
                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest block mb-1">VALOR TIME</span>
                <div className="flex items-center justify-end gap-1.5">
                  <PaiCoin size="sm" />
                  <span className="text-lg font-orbitron font-black text-[#3b82f6]">{teamValue.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="grid grid-cols-2 gap-0 border-t border-white/5">
              <button
                onClick={onClear}
                disabled={!isMarketOpen}
                className={`py-3.5 text-[9px] font-black uppercase tracking-widest transition-all border-r border-white/5 ${isMarketOpen ? 'text-gray-400 hover:text-white hover:bg-white/[0.03]' : 'text-gray-600 cursor-not-allowed opacity-60'}`}
              >LIMPAR</button>
              <button
                onClick={handleConfirm}
                disabled={!isMarketOpen}
                className={`py-3.5 text-[9px] font-black uppercase tracking-widest transition-all ${isMarketOpen ? 'bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6] hover:text-black' : 'text-gray-600 cursor-not-allowed opacity-70'}`}
              >CONFIRMAR</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── LISTA DE JOGADORES ── */}
      <div className="lg:col-span-8 order-2 space-y-4 sm:space-y-6">
        <div className="sticky top-[72px] sm:top-[80px] z-40 backdrop-blur-xl -mx-3 xs:-mx-4 sm:-mx-6 px-3 xs:px-4 sm:px-6 pt-3 pb-4">

          {/* Barra de pesquisa + filtros num bloco integrado */}
          <div className="bg-[#0d1117] border border-white/[0.07] rounded-xl overflow-hidden focus-within:border-white/20 transition-colors duration-200">

            {/* Search */}
            <div className="flex items-center gap-3 px-4 border-b border-white/[0.06]">
              <i className="fa-solid fa-magnifying-glass text-gray-500 text-xs shrink-0"></i>
              <input
                type="text"
                placeholder="Procurar jogador..."
                className="no-focus-outline flex-1 bg-transparent py-3.5 text-[11px] font-medium text-white placeholder-gray-500 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none border-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-gray-600 hover:text-white transition-colors shrink-0 p-1">
                  <i className="fa-solid fa-xmark text-[10px]"></i>
                </button>
              )}
            </div>

            {/* Filtros de role */}
            <div className="flex overflow-x-auto no-scrollbar px-1">
              {Object.entries(roleMetadata).map(([key, data]) => {
                const active = filterRole === key;
                return (
                  <button
                    key={key}
                    onClick={() => setFilterRole(key as any)}
                    className={`relative flex items-center gap-1.5 px-3.5 sm:px-5 py-3 shrink-0 transition-all duration-200 touch-manipulation ${
                      active ? 'text-white' : 'text-gray-600 hover:text-gray-300'
                    }`}
                  >
                    <img src={data.icon} className={`w-3 h-3 shrink-0 transition-all ${active ? 'brightness-200' : 'brightness-50 opacity-50'}`} alt="" />
                    <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">{data.label}</span>
                    {active && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#3b82f6] rounded-full" />}
                  </button>
                );
              })}
            </div>
          </div>

          {currentRoundLabel && (
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.25em] mt-3 px-1">
              {currentRoundLabel}
            </p>
          )}
        </div>

        <div className={`space-y-3 transition-all duration-300 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          {filteredPlayers.map((player) => {
            const hiredPlayer = userTeam.players[player.role];
            const isHired = hiredPlayer?.id === player.id;
            const canAfford = isHired || (userTeam.budget + (hiredPlayer?.price || 0) >= player.price);
            const hiredChamp = isHired ? (hiredPlayer?.selectedChampion || hiredPlayer?.lastChampion) : null;
            const matchupList = player.teamId ? (teamMatchups[player.teamId] || []) : [];

            return (
              <div key={player.id} onClick={() => setHistoryPlayer(player)} className={`relative group bg-black/40 border transition-all duration-500 overflow-hidden cursor-pointer rounded-xl ${isHired ? 'border-[#3b82f6]/50 shadow-[0_0_20px_rgba(59,130,246,0.08)]' : 'border-white/5 hover:border-white/15'}`}>

                <div className="absolute -top-12 -right-12 w-48 sm:w-64 h-48 sm:h-64 pointer-events-none z-0 transition-all duration-1000 ease-out opacity-[0.03] grayscale blur-[2px] group-hover:opacity-[0.12] group-hover:grayscale-0 group-hover:blur-0 group-hover:rotate-12 group-hover:scale-110">
                  <img src="https://i.imgur.com/4odZyzF.png" className="w-full h-full object-contain invert-[0.1] sepia-[1] saturate-[5] hue-rotate-[210deg]" alt="" />
                </div>

                <div className="flex items-stretch relative z-10">

                  {/* Imagem do jogador */}
                  <div className="relative w-24 sm:w-44 md:w-52 shrink-0 overflow-hidden bg-black/70">
                    {player.teamLogo && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                        <img src={player.teamLogo} alt="" className="w-4/5 h-auto object-contain opacity-[0.06] group-hover:opacity-15 transition-opacity duration-500" />
                      </div>
                    )}
                    <PlayerImage player={player} className="absolute inset-0 w-full h-full z-10" imgClassName="w-full h-full object-contain object-bottom" />
                    <div className="absolute top-2 left-2 z-20">
                      <TeamLogo logoUrl={player.teamLogo} teamName={player.team} className="w-5 h-5 sm:w-8 sm:h-8" />
                    </div>
                    {hiredChamp && (
                      <div className="absolute bottom-2 right-2 z-30 w-7 h-7 sm:w-12 sm:h-12 rounded-full border-2 border-[#3b82f6] bg-black shadow-xl overflow-hidden animate-in zoom-in duration-500">
                        <img src={hiredChamp.image} className="w-full h-full object-cover" alt={hiredChamp.name} />
                      </div>
                    )}
                  </div>

                  {/* Info — ocupa o resto */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between p-2.5 sm:p-5 md:p-7 gap-2">

                    {/* Topo: role + nome + confrontos */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <img src={roleMetadata[player.role].icon} className="w-3 h-3 brightness-200 opacity-40 shrink-0" alt="" />
                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] truncate">{player.team}</span>
                      </div>
                      <h3 className="text-sm sm:text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none group-hover:text-[#3b82f6] transition-colors truncate mb-1.5">
                        {player.name}
                      </h3>
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        {matchupList.length > 0 ? (
                          matchupList.map((matchup, index) => (
                            <div key={`${player.id}-matchup-${matchup.opponentName}-${index}`} className="w-5 h-5 sm:w-8 sm:h-8 shrink-0" title={`Contra: ${matchup.opponentName}`}>
                              {matchup.opponentLogoUrl
                                ? <img src={matchup.opponentLogoUrl} alt={matchup.opponentName} className="w-full h-full object-contain" />
                                : <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-gray-500 uppercase">{matchup.opponentName.slice(0, 2)}</div>
                              }
                            </div>
                          ))
                        ) : (
                          <span className="text-[8px] text-gray-700 uppercase tracking-wider font-black">A definir</span>
                        )}
                      </div>
                    </div>

                    {/* Rodapé: stats + preço/botão */}
                    <div className="flex items-end justify-between gap-1.5">

                      {/* Stats */}
                      <div className="flex items-center gap-2 sm:gap-5">
                        <div>
                          <div className="flex items-end gap-0.5 mb-0.5">
                            <span className="text-sm sm:text-xl font-black text-white font-orbitron tracking-tighter leading-none">{player.avgPoints > 0 ? Number(player.avgPoints).toFixed(1) : '—'}</span>
                            <span className="text-[7px] font-black text-[#3b82f6] mb-0.5">PTS</span>
                          </div>
                          <span className="text-[7px] font-black text-gray-600 uppercase tracking-widest">MÉDIA</span>
                        </div>
                        <div className="w-px h-5 bg-white/8"></div>
                        <div>
                          <div className="flex items-end gap-0.5 mb-0.5">
                            <span className="text-sm sm:text-xl font-black text-white font-orbitron tracking-tighter leading-none">{player.points > 0 ? Number(player.points).toFixed(1) : '—'}</span>
                          </div>
                          <span className="text-[7px] font-black text-gray-600 uppercase tracking-widest">ÚLT. JOGO</span>
                        </div>
                      </div>

                      {/* Preço + botão */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1">
                          <PaiCoin size="sm" />
                          <span className={`text-sm sm:text-base font-black font-orbitron tracking-tighter leading-none ${!canAfford && !isHired ? 'text-red-500' : 'text-white'}`}>{player.price.toFixed(1)}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); isMarketOpen && (isHired ? onFire(player.role) : onHire(player)); }}
                          disabled={!isMarketOpen || !canAfford}
                          className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider transition-all touch-manipulation whitespace-nowrap ${
                            !isMarketOpen ? 'bg-white/5 text-gray-600 cursor-not-allowed opacity-70'
                            : isHired ? 'border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500'
                            : !canAfford ? 'bg-white/5 text-gray-600 cursor-not-allowed opacity-50'
                            : 'bg-[#3b82f6] text-black shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                          }`}
                        >
                          {!isMarketOpen ? 'FECHADO' : isHired ? 'DISPENSAR' : !canAfford ? 'SEM SALDO' : 'ESCALAR'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>


    {historyPlayer && (
      <MatchHistoryModal
        player={historyPlayer}
        onClose={() => setHistoryPlayer(null)}
        userBudget={userTeam.budget}
      />
    )}
    </>
  );
};

export default Market;
