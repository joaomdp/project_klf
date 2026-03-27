
import React, { useMemo } from 'react';
import { Player, Role } from '../types';
import { DataService } from '../services/api';

interface DiversityIndicatorProps {
  players: { [key in Role]?: Player };
  className?: string;
}

// Componente de animação de partículas para nível máximo
const ParticleEffect: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {[...Array(20)].map((_, i) => (
      <div
        key={i}
        className="absolute w-1 h-1 bg-[#6366F1] rounded-full animate-ping"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 2}s`,
          animationDuration: `${1 + Math.random() * 2}s`,
          opacity: 0.6
        }}
      />
    ))}
  </div>
);

const DiversityIndicator: React.FC<DiversityIndicatorProps> = ({ players, className = '' }) => {
  const diversity = useMemo(() => {
    return DataService.calculateDiversityBonus(players);
  }, [players]);

  const levels = [
    { num: 1, percent: 0, label: 'Lvl. 1' },
    { num: 2, percent: 5, label: 'Lvl. 2' },
    { num: 3, percent: 10, label: 'Lvl. 3' },
    { num: 4, percent: 15, label: 'Lvl. 4' },
    { num: 5, percent: 20, label: 'Lvl. 5' }
  ];

  const isMaxLevel = diversity.uniqueTeams === 5;

  return (
    <div className={`glass-card p-6 relative overflow-hidden ${className}`}>
      {/* Efeito de glow de fundo */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#6366F1]/10 to-[#8B5CF6]/10 opacity-50"></div>
      
      {/* Animação de partículas quando nível = 5 */}
      {isMaxLevel && <ParticleEffect />}

      {/* Header com indicador numérico */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <h3 className="text-[11px] font-orbitron font-black text-white uppercase tracking-widest">
          BUFF DE VARIEDADE
        </h3>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full backdrop-blur-sm">
          <i className="fa-solid fa-users text-[#6366F1] text-xs"></i>
          <span className="text-[10px] font-bold text-white">
            {diversity.uniqueTeams}/5
          </span>
        </div>
      </div>

      {/* Progress Line with Dots */}
      <div className="relative mb-6 z-10">
        {/* Background Line */}
        <div className="absolute top-1/2 left-0 right-0 h-[3px] bg-white/10 -translate-y-1/2 rounded-full"></div>
        
        {/* Active Line com gradiente e glow */}
        <div 
          className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 transition-all duration-500 ease-out rounded-full"
          style={{ 
            width: `${(diversity.uniqueTeams - 1) * 25}%`,
            background: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.8), 0 0 40px rgba(139, 92, 246, 0.4)'
          }}
        ></div>

        {/* Dots */}
        <div className="relative flex justify-between">
          {levels.map((level) => {
            const isActive = level.num <= diversity.uniqueTeams;
            const isCurrent = level.num === diversity.uniqueTeams;
            
            return (
              <div key={level.num} className="flex flex-col items-center">
                <div 
                  className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] border-[#6366F1]' 
                      : 'bg-[#1a1a1a] border-white/20'
                  } ${isCurrent ? 'scale-110' : ''}`}
                  style={isActive ? { 
                    boxShadow: '0 0 15px rgba(99, 102, 241, 0.8), 0 0 30px rgba(139, 92, 246, 0.4)',
                    animation: isCurrent ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
                  } : {}}
                >
                  {/* Dot interno brilhante */}
                  {isActive && (
                    <div className="w-full h-full rounded-full bg-white/30 animate-ping" style={{ animationDuration: '2s' }}></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between mb-2 relative z-10">
        {levels.map((level) => (
          <div key={level.num} className="flex flex-col items-center" style={{ width: '20%' }}>
            <span className={`text-[9px] font-orbitron font-bold uppercase tracking-wide transition-colors ${
              level.num <= diversity.uniqueTeams ? 'text-white' : 'text-gray-600'
            }`}>
              {level.label}
            </span>
          </div>
        ))}
      </div>

      {/* Percentages */}
      <div className="flex justify-between relative z-10">
        {levels.map((level) => {
          const isActive = level.num <= diversity.uniqueTeams;
          
          return (
            <div key={level.num} className="flex flex-col items-center" style={{ width: '20%' }}>
              <span 
                className={`text-[10px] font-black transition-all duration-300 ${
                  isActive
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]' 
                    : 'text-gray-700'
                }`}
                style={isActive ? {
                  textShadow: '0 0 10px rgba(99, 102, 241, 0.5)'
                } : {}}
              >
                {level.percent}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Mensagem de diversidade máxima */}
      {isMaxLevel && (
        <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
          <div className="flex items-center justify-center gap-2 text-center">
            <i className="fa-solid fa-trophy text-[#6366F1] text-sm animate-bounce"></i>
            <span className="text-[9px] font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] uppercase tracking-widest">
              Diversidade Máxima!
            </span>
            <i className="fa-solid fa-trophy text-[#8B5CF6] text-sm animate-bounce" style={{ animationDelay: '0.2s' }}></i>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiversityIndicator;
