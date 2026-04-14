
import React, { useState, useEffect } from 'react';
import { DataService } from '../services/api';

interface ScoreBreakdownProps {
  roundId: number;
  userTeamId: number;
  onClose: () => void;
}

const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({ roundId, userTeamId, onClose }) => {
  const [score, setScore] = useState<{
    basePoints: number;
    teamDiversityBonus: number;
    championMultiplierBonus: number;
    totalPoints: number;
    numUniqueTeams: number;
    diversityPercent: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScore = async () => {
      const scoreData = await DataService.getRoundScore(roundId, userTeamId);
      setScore(scoreData);
      setLoading(false);
    };

    fetchScore();
  }, [roundId, userTeamId]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300"
      onClick={handleBackdropClick}
    >
        <div className="relative max-w-2xl w-full mx-4 bg-black border border-white/10 shadow-[0_0_80px_rgba(99,102,241,0.3)] animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 bg-white/[0.02] border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-chart-line text-[#3b82f6]"></i>
            <h2 className="text-xl font-orbitron font-black text-white uppercase tracking-tight">
              DETALHAMENTO DE PONTOS
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border border-white/10 hover:border-red-500/60 hover:bg-red-500/10 transition-all group"
          >
            <i className="fa-solid fa-times text-gray-500 group-hover:text-red-400 transition-colors"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <i className="fa-solid fa-spinner fa-spin text-4xl text-[#3b82f6]"></i>
              <span className="text-sm font-orbitron text-gray-500 uppercase tracking-widest">
                Carregando pontuação...
              </span>
            </div>
          ) : !score ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <i className="fa-solid fa-exclamation-circle text-4xl text-red-500"></i>
              <span className="text-sm font-orbitron text-gray-400 uppercase tracking-widest">
                Pontuação não disponível
              </span>
              <p className="text-xs text-gray-600 text-center max-w-md">
                Esta rodada ainda não foi calculada ou não há dados disponíveis.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Total Points - Big Display */}
              <div className="bg-gradient-to-r from-[#3b82f6]/20 to-purple-600/20 border border-[#3b82f6]/40 p-4 sm:p-6 text-center">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-2">
                  PONTUAÇÃO TOTAL
                </span>
                <span className="text-4xl sm:text-6xl font-orbitron font-black text-white block">
                  {score.totalPoints.toFixed(1)}
                </span>
              </div>

              {/* Breakdown */}
              <div className="space-y-4">
                {/* Base Points */}
                <div className="bg-black/40 border border-white/5 p-5">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                        <i className="fa-solid fa-calculator text-blue-400 text-sm"></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-orbitron font-black text-white uppercase">
                          Pontos Base
                        </h3>
                        <p className="text-[9px] text-gray-500">
                          Kills, Deaths, Assists, CS, etc.
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl font-orbitron font-black text-white">
                      {score.basePoints.toFixed(1)}
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-2 bg-black/60 border border-white/5 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-600 to-blue-500"
                      style={{ width: `${(score.basePoints / score.totalPoints) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Diversity Bonus */}
                <div className="bg-black/40 border border-emerald-500/30 p-5">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                        <i className="fa-solid fa-users text-emerald-400 text-sm"></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-orbitron font-black text-white uppercase">
                          Bônus de Diversidade
                        </h3>
                        <p className="text-[9px] text-gray-500">
                          {score.numUniqueTeams} {score.numUniqueTeams === 1 ? 'time diferente' : 'times diferentes'} (+{score.diversityPercent}%)
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl font-orbitron font-black text-emerald-400">
                      +{score.teamDiversityBonus.toFixed(1)}
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-2 bg-black/60 border border-white/5 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-600 to-green-500"
                      style={{ width: `${(score.teamDiversityBonus / score.totalPoints) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Champion Multiplier Bonus */}
                <div className="bg-black/40 border border-yellow-500/30 p-5">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center">
                        <i className="fa-solid fa-star text-yellow-400 text-sm"></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-orbitron font-black text-white uppercase">
                          Bônus de Campeões
                        </h3>
                        <p className="text-[9px] text-gray-500">
                          Multiplicadores de popularidade (Virgin/Popular/Saturated)
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl font-orbitron font-black text-yellow-400">
                      +{score.championMultiplierBonus.toFixed(1)}
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-2 bg-black/60 border border-white/5 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-yellow-600 to-amber-500"
                      style={{ width: `${(score.championMultiplierBonus / score.totalPoints) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-start gap-2 p-4 bg-white/[0.02] border border-white/5 rounded">
                  <i className="fa-solid fa-info-circle text-[#3b82f6] text-sm mt-0.5"></i>
                  <div className="text-[9px] text-gray-500 leading-relaxed">
                    <p className="mb-2">
                      <span className="font-bold text-gray-400">Cálculo:</span> Pontos Totais = Pontos Base + Bônus de Diversidade + Bônus de Campeões
                    </p>
                    <p>
                      <span className="font-bold text-gray-400">Fórmula:</span> {score.totalPoints.toFixed(1)} = {score.basePoints.toFixed(1)} + {score.teamDiversityBonus.toFixed(1)} + {score.championMultiplierBonus.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScoreBreakdown;
