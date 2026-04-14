
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Player } from '../types';
import PlayerImage from './PlayerImage';
import TeamLogo from './TeamLogo';
import PaiCoin from './PaiCoin';
import { DataService } from '../services/api';

interface MatchHistoryModalProps {
  player: Player;
  onClose: () => void;
  userBudget?: number;
  onReplace?: () => void;
}

type PerformanceEntry = {
  id: number;
  match_id: number;
  game_number: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  fantasy_points: number | null;
  is_winner: boolean;
  champion?: { id: number; name: string; image_url?: string };
  match?: {
    id: number;
    scheduled_time?: string | null;
    team_a_id: string;
    team_b_id: string;
    team_a?: { id: string; name: string; logo_url?: string | null };
    team_b?: { id: string; name: string; logo_url?: string | null };
    round?: { id: number; round_number: number; season: number };
  };
};

type RoundGroup = {
  roundNumber: number;
  totalPoints: number;
  games: PerformanceEntry[];
};

const MatchHistoryModal: React.FC<MatchHistoryModalProps> = ({ player, onClose, userBudget, onReplace }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [performances, setPerformances] = useState<PerformanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'historico' | 'estatisticas'>('historico');
  const [expandedGame, setExpandedGame] = useState<number | null>(null);
  const [collapsedRounds, setCollapsedRounds] = useState<Set<number>>(new Set());
  const [prevPrice, setPrevPrice] = useState<number | null>(null);

  const toggleRound = (roundNumber: number) => {
    setCollapsedRounds(prev => {
      const next = new Set(prev);
      if (next.has(roundNumber)) next.delete(roundNumber);
      else next.add(roundNumber);
      return next;
    });
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const data = await DataService.getPlayerHistory(player.id);
      if (mounted) {
        setPerformances(data);
        setLoading(false);

        // Busca o preço da rodada anterior via snapshot
        const rounds = data
          .map((p: any) => p.match?.round?.round_number)
          .filter((r: any) => typeof r === 'number');
        if (rounds.length > 0) {
          const latestRound = Math.max(...rounds);
          const prevRound = latestRound - 1;
          if (prevRound > 0) {
            try {
              const res = await fetch(
                `${DataService.SUPABASE_URL}/rest/v1/system_config?key=eq.snapshot_round_${prevRound}_prices&select=value`,
                { headers: { apikey: DataService.getAnonKey(), Authorization: `Bearer ${DataService.getAnonKey()}` } }
              );
              if (res.ok) {
                const rows = await res.json();
                if (rows?.[0]?.value) {
                  const snapshot = JSON.parse(rows[0].value);
                  const price = snapshot[String(player.id)];
                  if (typeof price === 'number' && mounted) setPrevPrice(price);
                }
              }
            } catch { /* silencioso */ }
          }
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, [player.id]);

  // Bloqueia scroll do body enquanto o drawer está aberto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const triggerClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  // Stats base
  const totalPoints = performances.reduce((sum, p) => sum + (p.fantasy_points || 0), 0);
  const avgPoints = performances.length > 0 ? totalPoints / performances.length : player.avgPoints;
  const totalKills = performances.reduce((sum, p) => sum + p.kills, 0);
  const totalDeaths = performances.reduce((sum, p) => sum + p.deaths, 0);
  const totalAssists = performances.reduce((sum, p) => sum + p.assists, 0);
  const totalCS = performances.reduce((sum, p) => sum + p.cs, 0);
  const avgCS = performances.length > 0 ? totalCS / performances.length : 0;

  // Stats por campeão
  const championStats = useMemo(() => {
    const map = new Map<number, { name: string; image_url?: string; games: PerformanceEntry[] }>();
    for (const p of performances) {
      if (!p.champion) continue;
      if (!map.has(p.champion.id)) map.set(p.champion.id, { name: p.champion.name, image_url: p.champion.image_url, games: [] });
      map.get(p.champion.id)!.games.push(p);
    }
    return Array.from(map.values())
      .map(({ name, image_url, games }) => {
        const gWins = games.filter(g => g.is_winner).length;
        const gKills = games.reduce((s, g) => s + g.kills, 0);
        const gDeaths = games.reduce((s, g) => s + g.deaths, 0);
        const gAssists = games.reduce((s, g) => s + g.assists, 0);
        const gPts = games.reduce((s, g) => s + (g.fantasy_points || 0), 0);
        const wr = games.length > 0 ? (gWins / games.length) * 100 : 0;
        const ama = games.length > 0 ? gPts / games.length : 0;
        const pa = (gKills + gDeaths + gAssists) > 0 ? ((gKills + gAssists) / (gKills + gDeaths + gAssists)) * 100 : 0;
        return { name, image_url, games: games.length, wr, ama, pa, gKills, gDeaths, gAssists };
      })
      .sort((a, b) => b.games - a.games);
  }, [performances]);
  const kdaValue = totalDeaths > 0
    ? ((totalKills + totalAssists) / totalDeaths).toFixed(2)
    : (totalKills + totalAssists > 0 ? '∞' : '0.00');

  // Group by round
  const roundGroups = useMemo<RoundGroup[]>(() => {
    const map = new Map<number, PerformanceEntry[]>();
    for (const perf of performances) {
      const roundNum = perf.match?.round?.round_number ?? 0;
      if (!map.has(roundNum)) map.set(roundNum, []);
      map.get(roundNum)!.push(perf);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b - a)
      .map(([roundNumber, games]) => ({
        roundNumber,
        totalPoints: games.reduce((s, g) => s + (g.fantasy_points || 0), 0),
        games,
      }));
  }, [performances]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
      .replace('.', '').replace('.', '');
  };

  const getOpponent = (perf: PerformanceEntry) => {
    const match = perf.match;
    if (!match || !player.teamId) return null;
    return String(match.team_a_id) === String(player.teamId) ? match.team_b : match.team_a;
  };

  const saldoRestante = userBudget !== undefined ? userBudget : null;

  const drawer = (
    /* Overlay cobre TUDO, incluindo header */
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
      className={`flex items-center justify-center p-4 transition-all duration-300 ${isClosing ? 'bg-black/0' : 'bg-black/80 backdrop-blur-sm'}`}
      onClick={triggerClose}
    >
      {/* Panel centralizado */}
      <div
        style={{ willChange: 'transform' }}
        className={`relative w-full max-w-[420px] max-h-[90vh] flex flex-col bg-[#111318] rounded-xl shadow-[0_40px_120px_rgba(0,0,0,0.95)] transition-all duration-300 overflow-hidden ${isClosing ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header do player — imagem de fundo */}
        <div className="relative flex-shrink-0 h-52 overflow-hidden bg-[#0d1117]">
          {/* Team logo como wallpaper */}
          {player.teamLogo && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <img
                src={player.teamLogo}
                alt=""
                className="w-3/4 h-auto object-contain opacity-[0.06]"
              />
            </div>
          )}

          {/* Foto do jogador */}
          <PlayerImage
            player={player}
            className="absolute inset-0 w-full h-full"
            imgClassName="w-full h-full object-cover object-[center_15%]"
          />

          {/* Gradiente de baixo */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111318] via-[#111318]/50 to-transparent" />

          {/* Botão fechar */}
          <button
            onClick={triggerClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 border border-white/10 transition-all text-white/60 hover:text-white"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>

          {/* Info do player sobre o gradiente */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 z-10">
            <div className="flex items-center gap-2 mb-1">
              {player.teamLogo && (
                <TeamLogo logoUrl={player.teamLogo} teamName={player.team || ''} className="w-5 h-5 object-contain" />
              )}
              <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.25em]">{player.team}</span>
            </div>
            <h3 className="font-orbitron font-black text-[26px] text-white uppercase tracking-tight leading-none">
              {player.name}
            </h3>
          </div>
        </div>

        {/* Stats rápidos */}
        <div className="flex-shrink-0 flex border-b border-white/[0.06] bg-[#0d1117]/60">
          <div className="flex-1 flex flex-col items-center py-3 border-r border-white/[0.06]">
            <span className="font-orbitron font-black text-[18px] text-[#3b82f6]">{avgPoints.toFixed(1)}</span>
            <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mt-0.5">MÉDIA</span>
          </div>
          <div className="flex-1 flex flex-col items-center py-3 border-r border-white/[0.06]">
            <span className="font-orbitron font-black text-[18px] text-white">{Number(player.points || 0).toFixed(1)}</span>
            <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mt-0.5">ÚLT. JOGO</span>
          </div>
          <div className="flex-1 flex flex-col items-center py-3">
            <span className="font-orbitron font-black text-[18px] text-white">{kdaValue}</span>
            <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mt-0.5">KDA</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b border-white/[0.06]">
          <button
            onClick={() => setActiveTab('historico')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'historico' ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
          >
            <i className="fa-solid fa-clock-rotate-left text-[9px]"></i>
            HISTÓRICO
            {activeTab === 'historico' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3b82f6] rounded-full" />
            )}
          </button>
          <div className="w-px bg-white/[0.06] my-2" />
          <button
            onClick={() => setActiveTab('estatisticas')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'estatisticas' ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
          >
            <i className="fa-solid fa-chart-bar text-[9px]"></i>
            ESTATÍSTICAS
            {activeTab === 'estatisticas' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3b82f6] rounded-full" />
            )}
          </button>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-16 text-center text-[10px] font-black text-white/30 uppercase tracking-widest">
              <i className="fa-solid fa-spinner fa-spin mr-2"></i>Carregando...
            </div>
          ) : activeTab === 'historico' ? (
            <div className="py-2">
              {roundGroups.length === 0 ? (
                <div className="py-16 text-center text-[10px] font-black text-white/30 uppercase tracking-widest">
                  Nenhum jogo registrado
                </div>
              ) : (
                roundGroups.map((group) => {
                  const isRoundCollapsed = collapsedRounds.has(group.roundNumber);
                  return (
                  <div key={group.roundNumber} className="mb-1">
                    {/* Round header — dropdown */}
                    <button
                      onClick={() => toggleRound(group.roundNumber)}
                      className="w-full flex items-center justify-between px-5 py-3 bg-[#1a1d24] hover:bg-[#20232d] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <i className={`fa-solid fa-chevron-right text-[9px] text-white/30 transition-transform duration-200 ${isRoundCollapsed ? '' : 'rotate-90'}`}></i>
                        <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">
                          RODADA {group.roundNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-orbitron font-black text-white">
                          {group.totalPoints.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-[9px] text-white/30">
                          / {group.games.length} {group.games.length === 1 ? 'jogo' : 'jogos'}
                        </span>
                      </div>
                    </button>

                    {/* Games — animação de expand/collapse */}
                    <div className={`grid transition-all duration-300 ease-in-out ${isRoundCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
                    <div className="overflow-hidden">
                    <div className="divide-y divide-white/[0.04]">
                      {group.games.map((perf) => {
                        const opponent = getOpponent(perf);
                        const points = perf.fantasy_points || 0;
                        const isExpanded = expandedGame === perf.id;

                        return (
                          <div key={perf.id}>
                            <button
                              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors text-left"
                              onClick={() => setExpandedGame(isExpanded ? null : perf.id)}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {perf.champion?.image_url ? (
                                  <img
                                    src={perf.champion.image_url}
                                    alt={perf.champion.name}
                                    className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-white/10"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-[7px] font-black text-white/30">?</span>
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="text-[12px] font-bold text-white truncate leading-none mb-1">
                                    {perf.champion?.name || '—'}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {opponent && (
                                      <>
                                        <span className="text-[9px] font-bold text-white/30">vs</span>
                                        {opponent.logo_url && (
                                          <TeamLogo
                                            logoUrl={DataService.getStorageUrl('teams', opponent.logo_url)}
                                            teamName={opponent.name}
                                            className="w-3.5 h-3.5 object-contain flex-shrink-0"
                                          />
                                        )}
                                        <span className="text-[9px] font-bold text-white/40 truncate">{opponent.name}</span>
                                      </>
                                    )}
                                    {perf.match?.scheduled_time && (
                                      <span className="text-[9px] text-white/25">{formatDate(perf.match.scheduled_time)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <span className={`font-orbitron font-black text-[14px] ${points >= 20 ? 'text-[#3b82f6]' : points >= 10 ? 'text-white' : 'text-white/50'}`}>
                                  {points.toFixed(2).replace('.', ',')}
                                </span>
                                <i className={`fa-solid fa-chevron-down text-[9px] text-white/20 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}></i>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="px-5 pb-4 pt-1 bg-white/[0.02] flex items-center gap-4">
                                <div className="flex items-center gap-3 text-[11px]">
                                  <div className="flex items-center gap-1">
                                    <span className="text-green-400 font-black">{perf.kills}</span>
                                    <span className="text-white/20">/</span>
                                    <span className="text-red-400 font-black">{perf.deaths}</span>
                                    <span className="text-white/20">/</span>
                                    <span className="text-blue-400 font-black">{perf.assists}</span>
                                  </div>
                                  <span className="text-white/20">·</span>
                                  <span className="text-white/40 font-bold">{perf.cs} CS</span>
                                  <span className="text-white/20">·</span>
                                  <span className={`font-black text-[9px] px-2 py-0.5 rounded-md ${perf.is_winner ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {perf.is_winner ? 'VITÓRIA' : 'DERROTA'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Estatísticas tab */
            <div className="p-4 space-y-4">

              {/* Variação de preço */}
              <div className="bg-[#1a1d24] rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">PREÇO ATUAL</p>
                    <div className="flex items-center gap-1.5">
                      <PaiCoin size="sm" />
                      <span className="text-[18px] font-orbitron font-black text-white">{player.price.toFixed(1)}</span>
                    </div>
                  </div>
                  {prevPrice !== null ? (() => {
                    const diff = player.price - prevPrice;
                    const isUp = diff > 0;
                    const isFlat = diff === 0;
                    return (
                      <div className="text-right">
                        <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">RODADA ANTERIOR</p>
                        <div className="flex items-center justify-end gap-2">
                          {!isFlat && (
                            <span className={`text-[11px] font-black ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                              {isUp ? '+' : ''}{diff.toFixed(1)}
                            </span>
                          )}
                          <i className={`fa-solid text-[11px] ${isFlat ? 'fa-minus text-white/30' : isUp ? 'fa-arrow-trend-up text-green-400' : 'fa-arrow-trend-down text-red-400'}`}></i>
                          <div className="flex items-center gap-1">
                            <PaiCoin size="sm" />
                            <span className="text-[15px] font-orbitron font-black text-white/60">{prevPrice.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="text-right">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">RODADA ANTERIOR</p>
                      <span className="text-[11px] font-black text-white/20">—</span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">CAMPEÕES</p>
              {championStats.length === 0 ? (
                <div className="py-16 text-center text-[10px] font-black text-white/30 uppercase tracking-widest">
                  Nenhum campeão registrado
                </div>
              ) : (
                <div className="bg-[#1a1d24] rounded-lg overflow-hidden divide-y divide-white/[0.04]">
                  <div className="flex items-center px-3 py-2 gap-3">
                    <div className="w-7 h-7 flex-shrink-0" />
                    <div className="flex-1" />
                    <div className="flex gap-5 pr-1">
                      {['WR', 'AMA', 'PA%'].map(h => (
                        <span key={h} className="text-[8px] font-black text-white/25 uppercase tracking-widest w-8 text-center">{h}</span>
                      ))}
                    </div>
                  </div>
                  {championStats.map(champ => (
                    <div key={champ.name} className="flex items-center px-3 py-2.5 gap-3 hover:bg-white/[0.02] transition-colors">
                      {champ.image_url ? (
                        <img src={champ.image_url} alt={champ.name} className="w-7 h-7 rounded-md object-cover flex-shrink-0 border border-white/10" />
                      ) : (
                        <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">{champ.name}</p>
                        <p className="text-[8px] text-white/30">{champ.games} {champ.games === 1 ? 'jogo' : 'jogos'}</p>
                      </div>
                      <div className="flex gap-5 pr-1">
                        <span className={`text-[11px] font-orbitron font-black w-8 text-center ${champ.wr >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                          {champ.wr.toFixed(0)}%
                        </span>
                        <span className="text-[11px] font-orbitron font-black text-white w-8 text-center">
                          {champ.ama.toFixed(1)}
                        </span>
                        <span className="text-[11px] font-orbitron font-black text-[#3b82f6] w-8 text-center">
                          {champ.pa.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0d1117]/80 px-5 py-4">
          {onReplace ? (
            <button
              onClick={() => { triggerClose(); onReplace(); }}
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-400 active:bg-orange-600 transition-colors rounded-xl text-[11px] font-black text-white uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-arrows-rotate"></i>
              SUBSTITUIR JOGADOR
            </button>
          ) : (
            <button
              onClick={triggerClose}
              className="w-full py-2.5 text-[9px] font-black text-white/20 hover:text-white/50 uppercase tracking-[0.3em] transition-colors"
            >
              FECHAR
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
};

export default MatchHistoryModal;
