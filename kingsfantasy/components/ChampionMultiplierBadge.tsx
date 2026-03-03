
import React from 'react';

export type ChampionMultiplierType = 'virgin' | 'popular' | 'saturated';

interface ChampionMultiplierBadgeProps {
  type: ChampionMultiplierType;
  className?: string;
  showLabel?: boolean;
}

const ChampionMultiplierBadge: React.FC<ChampionMultiplierBadgeProps> = ({ 
  type, 
  className = '', 
  showLabel = false 
}) => {
  const config = {
    virgin: {
      multiplier: '1.7x',
      label: 'VIRGIN',
      icon: '🆕',
      color: 'from-yellow-500 to-amber-600',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/60',
      textColor: 'text-yellow-400',
      shadowColor: 'shadow-[0_0_20px_rgba(234,179,8,0.4)]',
      description: 'Campeão nunca usado por este jogador',
      emoji: '✨'
    },
    popular: {
      multiplier: '1.5x',
      label: 'POPULAR',
      icon: '🔥',
      color: 'from-orange-500 to-red-600',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/60',
      textColor: 'text-orange-400',
      shadowColor: 'shadow-[0_0_20px_rgba(249,115,22,0.4)]',
      description: 'Campeão usado por outros, mas não por este jogador',
      emoji: '🔥'
    },
    saturated: {
      multiplier: '1.3x',
      label: 'SATURATED',
      icon: '⚡',
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/60',
      textColor: 'text-blue-400',
      shadowColor: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
      description: 'Campeão já usado por este jogador',
      emoji: '⚡'
    }
  };

  const settings = config[type];

  return (
    <div className={`group/badge relative ${className}`}>
      {/* Compact Badge */}
      <div className={`
        relative flex items-center gap-1.5 px-2 py-1 
        ${settings.bgColor} ${settings.borderColor} 
        border backdrop-blur-sm 
        ${settings.shadowColor}
        transition-all duration-300 
        hover:scale-110 cursor-pointer
      `}>
        <span className="text-xs">{settings.emoji}</span>
        <span className={`text-[8px] font-orbitron font-black ${settings.textColor} tracking-wider`}>
          {settings.multiplier}
        </span>
        {showLabel && (
          <span className={`text-[7px] font-black ${settings.textColor} opacity-60 uppercase tracking-wider`}>
            {settings.label}
          </span>
        )}
      </div>

      {/* Tooltip on Hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/badge:opacity-100 pointer-events-none transition-all duration-300 z-50">
        <div className="bg-black border border-white/20 px-3 py-2 rounded shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-xl whitespace-nowrap">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs">{settings.emoji}</span>
            <span className={`text-[9px] font-orbitron font-black ${settings.textColor} uppercase tracking-wider`}>
              {settings.label}
            </span>
            <span className={`text-sm font-orbitron font-black ${settings.textColor}`}>
              {settings.multiplier}
            </span>
          </div>
          <p className="text-[8px] text-gray-400 leading-relaxed max-w-[200px]">
            {settings.description}
          </p>
          {/* Arrow */}
          <div className={`absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white/20`}></div>
        </div>
      </div>
    </div>
  );
};

export default ChampionMultiplierBadge;
