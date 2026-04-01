
import React, { useState, useEffect } from 'react';
import { Player } from '../types';
import PlayerImage from './PlayerImage';
import TeamLogo from './TeamLogo';
import { DataService } from '../services/api';

interface MatchHistoryModalProps {
  player: Player;
  onClose: () => void;
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

const MatchHistoryModal: React.FC<MatchHistoryModalProps> = ({ player, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [performances, setPerformances] = useState<PerformanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const data = await DataService.getPlayerHistory(player.id);
      if (mounted) {
        setPerformances(data);
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [player.id]);

  const triggerClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  // Compute stats from real data
  const totalPoints = performances.reduce((sum, p) => sum + (p.fantasy_points || 0), 0);
  const avgPoints = performances.length > 0 ? totalPoints / performances.length : 0;
  const totalKills = performances.reduce((sum, p) => sum + p.kills, 0);
  const totalDeaths = performances.reduce((sum, p) => sum + p.deaths, 0);
  const totalAssists = performances.reduce((sum, p) => sum + p.assists, 0);
  const kdaValue = totalDeaths > 0 ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : (totalKills + totalAssists > 0 ? 'Perfect' : '0.00');

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Find the opponent team for this player
  const getOpponent = (perf: PerformanceEntry) => {
    const match = perf.match;
    if (!match) return null;
    const playerTeamId = player.teamId;
    if (!playerTeamId) return null;
    if (String(match.team_a_id) === String(playerTeamId)) {
      return match.team_b;
    }
    return match.team_a;
  };

  return (
    <div className={`fixed left-0 right-0 bottom-0 top-16 md:top-28 z-[300] flex justify-center py-6 md:py-20 transition-all duration-300 ${isClosing ? 'bg-black/0 backdrop-blur-0' : 'bg-black/85 backdrop-blur-md'}`}>
      <div className="fixed inset-0 top-16 md:top-28" onClick={triggerClose}></div>
      <div className={`relative w-full max-w-md h-fit max-h-[80vh] flex flex-col bg-[#0B0411] rounded-[40px] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] transition-all duration-500 overflow-hidden ${isClosing ? 'opacity-0 scale-95 translate-y-12' : 'opacity-100 scale-100 translate-y-0 animate-in zoom-in-95'}`}>
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-br from-[#6366F1]/10 to-transparent relative z-10 flex-shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl border-2 border-[#6366F1]/30 overflow-hidden bg-black shadow-2xl">
               <PlayerImage player={player} className="w-full h-full" />
            </div>
            <div>
              <span className="text-[10px] font-black text-[#6366F1] uppercase tracking-widest">{player.role}</span>
              <h3 className="font-orbitron font-black text-2xl text-white uppercase tracking-tighter leading-none">{player.name}</h3>
            </div>
          </div>
          <button onClick={triggerClose} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-all text-gray-500 hover:text-white">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="p-8 space-y-6 relative z-10 overflow-y-auto flex-1 min-h-0">
          <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">ÚLTIMOS JOGOS</h4>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-xs font-black text-gray-600 uppercase tracking-widest">Carregando...</p>
            </div>
          ) : performances.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs font-black text-gray-600 uppercase tracking-widest">Nenhum jogo registrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {performances.map((perf) => {
                const opponent = getOpponent(perf);
                const points = perf.fantasy_points || 0;
                const roundLabel = perf.match?.round ? `R${perf.match.round.round_number}` : '';
                const gameLabel = perf.game_number > 1 ? ` G${perf.game_number}` : '';

                return (
                  <div key={perf.id} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-3xl border border-white/5 group hover:border-[#6366F1]/30 transition-all duration-300">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="relative flex-shrink-0">
                        {perf.champion?.image_url ? (
                          <img src={perf.champion.image_url} className="w-10 h-10 rounded-xl border border-white/10" alt={perf.champion.name} />
                        ) : (
                          <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-[8px] font-black text-gray-600">?</div>
                        )}
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0B0411] flex items-center justify-center text-[7px] font-black text-white ${perf.is_winner ? 'bg-green-500' : 'bg-red-500'}`}>
                          {perf.is_winner ? 'V' : 'D'}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-black text-white uppercase tracking-tight group-hover:text-[#6366F1] transition-colors truncate">
                          {perf.champion?.name || 'Desconhecido'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">
                            {perf.kills}/{perf.deaths}/{perf.assists}
                          </span>
                          <span className="text-[8px] text-gray-700">|</span>
                          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">{perf.cs} CS</span>
                          {roundLabel && (
                            <>
                              <span className="text-[8px] text-gray-700">|</span>
                              <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">{roundLabel}{gameLabel}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {opponent && (
                            <>
                              <span className="text-[8px] font-bold text-gray-700 uppercase">vs</span>
                              {opponent.logo_url && (
                                <TeamLogo logoUrl={DataService.getStorageUrl('teams', opponent.logo_url)} teamName={opponent.name} className="w-3.5 h-3.5" />
                              )}
                              <span className="text-[8px] font-bold text-gray-600 uppercase tracking-wider">{opponent.name}</span>
                            </>
                          )}
                          {perf.match?.scheduled_time && (
                            <span className="text-[8px] text-gray-700 ml-1">{formatDate(perf.match.scheduled_time)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className={`font-orbitron font-black text-lg tracking-tighter flex-shrink-0 ml-3 ${points >= 0 ? 'text-white' : 'text-red-500'}`}>
                      {points > 0 ? '+' : ''}{points.toFixed(1)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-8 pb-10 pt-2 relative z-10 text-center flex-shrink-0">
          <div className="grid grid-cols-2 gap-4 mb-10">
             <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-1">MÉDIA PTS</p>
                <p className="text-lg font-orbitron font-black text-white">
                  {performances.length > 0 ? avgPoints.toFixed(1) : player.avgPoints.toFixed(1)}
                </p>
             </div>
             <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-1">KDA GERAL</p>
                <p className="text-lg font-orbitron font-black text-[#6366F1] shadow-[0_0_10px_rgba(94,108,255,0.2)]">
                  {performances.length > 0 ? kdaValue : player.kda}
                </p>
             </div>
          </div>
          <button onClick={triggerClose} className="inline-block text-white/20 hover:text-[#6366F1]/60 text-[9px] font-black uppercase tracking-[0.4em] transition-all">FECHAR RELATÓRIO</button>
        </div>
      </div>
    </div>
  );
};

export default MatchHistoryModal;
