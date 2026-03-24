
import React, { useState, useEffect } from 'react';
import { DataService } from '../services/api';

interface MarketTimerProps {
  className?: string;
  onMarketClose?: () => void;
  compact?: boolean;
}

const MarketTimer: React.FC<MarketTimerProps> = ({ className = '', onMarketClose, compact = false }) => {
  const [marketStatus, setMarketStatus] = useState<{
    isOpen: boolean;
    message: string;
    nextCloseTime?: string;
  } | null>(null);

  const [timeRemaining, setTimeRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarketStatus = async () => {
      const status = await DataService.getMarketStatus();
      setMarketStatus(status);
      setLoading(false);
    };

    fetchMarketStatus();
    const statusInterval = setInterval(fetchMarketStatus, 60000); // Update every minute

    return () => clearInterval(statusInterval);
  }, []);

  // Local countdown based on nextCloseTime — no API calls needed
  useEffect(() => {
    if (!marketStatus?.isOpen || !marketStatus?.nextCloseTime) return;

    const closeTime = new Date(marketStatus.nextCloseTime).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((closeTime - now) / 1000));

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      setTimeRemaining({ hours, minutes, seconds, totalSeconds: diff });

      if (diff <= 0) {
        setMarketStatus((prev) => prev ? { ...prev, isOpen: false } : null);
        onMarketClose?.();
      }
    };

    tick();
    const timeInterval = setInterval(tick, 1000);

    return () => clearInterval(timeInterval);
  }, [marketStatus?.isOpen, marketStatus?.nextCloseTime, onMarketClose]);

  if (loading) {
    return (
      <div className={`bg-black/60 border border-white/5 backdrop-blur-xl p-6 ${className}`}>
        <div className="flex items-center justify-center gap-3">
          <i className="fa-solid fa-spinner fa-spin text-gray-500"></i>
          <span className="text-[10px] font-orbitron text-gray-500 uppercase tracking-widest">
            Carregando status...
          </span>
        </div>
      </div>
    );
  }

  if (!marketStatus) {
    return (
      <div className={`bg-black/60 border border-red-500/40 backdrop-blur-xl p-6 ${className}`}>
        <div className="flex items-center justify-center gap-3">
          <i className="fa-solid fa-exclamation-triangle text-red-500"></i>
          <span className="text-[10px] font-orbitron text-red-400 uppercase tracking-widest">
            Erro ao carregar status do mercado
          </span>
        </div>
      </div>
    );
  }

  const getUrgencyColor = () => {
    if (!timeRemaining) return 'emerald';
    if (timeRemaining.totalSeconds < 3600) return 'red'; // < 1 hour
    if (timeRemaining.totalSeconds < 7200) return 'orange'; // < 2 hours
    return 'emerald';
  };

  const urgencyColor = getUrgencyColor();

  const colorClasses = {
    red: {
      border: 'border-red-500/60',
      bg: 'bg-red-500/20',
      indicator: 'bg-red-500',
      text: 'text-red-400',
      gradient: 'from-red-600 to-orange-600',
      shadow: 'shadow-[0_0_30px_rgba(239,68,68,0.3)]'
    },
    orange: {
      border: 'border-orange-500/60',
      bg: 'bg-orange-500/20',
      indicator: 'bg-orange-500',
      text: 'text-orange-400',
      gradient: 'from-orange-600 to-yellow-600',
      shadow: 'shadow-[0_0_30px_rgba(249,115,22,0.3)]'
    },
    emerald: {
      border: 'border-emerald-500/40',
      bg: 'bg-emerald-500/20',
      indicator: 'bg-emerald-500',
      text: 'text-emerald-400',
      gradient: 'from-emerald-600 to-green-600',
      shadow: 'shadow-[0_0_30px_rgba(16,185,129,0.3)]'
    }
  };

  const colors = colorClasses[urgencyColor];

  if (compact) {
    const renderCompact = (title: string, subtitle: string, open: boolean, showSpinner = false) => (
      <div className={`flex flex-col text-right ${className}`}>
        <span className={`text-[10px] font-black tracking-wider uppercase ${open ? 'text-[#6366F1]' : 'text-red-500'}`}>
          {title}
        </span>
        <div className="flex items-center justify-end gap-1.5 mt-1.5">
          {showSpinner ? (
            <i className="fa-solid fa-spinner fa-spin text-[10px] text-gray-500"></i>
          ) : (
            <span className={`w-2 h-2 rounded-full animate-pulse shadow-lg ${open ? 'bg-[#6366F1] shadow-[#6366F1]/50' : 'bg-red-500 shadow-red-500/50'}`}></span>
          )}
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">
            {subtitle}
          </span>
        </div>
      </div>
    );

    if (loading) {
      return renderCompact('MERCADO', 'Carregando status', false, true);
    }

    if (!marketStatus) {
      return renderCompact('MERCADO FECHADO', 'Erro ao carregar', false);
    }

    if (!marketStatus.isOpen) {
      return renderCompact('MERCADO FECHADO', 'Rodada em andamento', false);
    }

    const countdown = timeRemaining
      ? `${String(timeRemaining.hours).padStart(2, '0')}:${String(timeRemaining.minutes).padStart(2, '0')}:${String(timeRemaining.seconds).padStart(2, '0')}`
      : null;

    return renderCompact('MERCADO ABERTO', countdown ? `Fecha em ${countdown}` : 'Faça sua escalação', true);
  }

  if (!marketStatus.isOpen) {
    return (
      <div className={`bg-black/60 border ${colors.border} backdrop-blur-xl overflow-hidden ${colors.shadow} ${className}`}>
        <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-lg"></div>
            <span className="text-[8px] font-orbitron font-black text-gray-500 tracking-[0.3em] uppercase">
              STATUS DO MERCADO
            </span>
          </div>
          <span className="text-sm font-orbitron font-black text-red-400">
            FECHADO
          </span>
        </div>
        <div className="px-6 py-5">
          <p className="text-center text-[10px] text-gray-400 leading-relaxed">
            {marketStatus.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black/60 border ${colors.border} backdrop-blur-xl overflow-hidden ${colors.shadow} transition-all duration-500 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${colors.indicator} animate-pulse shadow-lg`}></div>
          <span className="text-[8px] font-orbitron font-black text-gray-500 tracking-[0.3em] uppercase">
            MERCADO ABERTO
          </span>
        </div>
        <span className={`text-sm font-orbitron font-black ${colors.text}`}>
          ATIVO
        </span>
      </div>

      {/* Timer */}
      {timeRemaining && (
        <div className="px-6 py-6 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="flex flex-col items-center">
              <div className={`text-4xl font-orbitron font-black ${colors.text} transition-all duration-300`}>
                {String(timeRemaining.hours).padStart(2, '0')}
              </div>
              <span className="text-[7px] font-black text-gray-600 uppercase tracking-wider mt-1">
                HORAS
              </span>
            </div>
            
            <span className={`text-3xl font-orbitron font-black ${colors.text} animate-pulse`}>:</span>
            
            <div className="flex flex-col items-center">
              <div className={`text-4xl font-orbitron font-black ${colors.text} transition-all duration-300`}>
                {String(timeRemaining.minutes).padStart(2, '0')}
              </div>
              <span className="text-[7px] font-black text-gray-600 uppercase tracking-wider mt-1">
                MINUTOS
              </span>
            </div>
            
            <span className={`text-3xl font-orbitron font-black ${colors.text} animate-pulse`}>:</span>
            
            <div className="flex flex-col items-center">
              <div className={`text-4xl font-orbitron font-black ${colors.text} transition-all duration-300`}>
                {String(timeRemaining.seconds).padStart(2, '0')}
              </div>
              <span className="text-[7px] font-black text-gray-600 uppercase tracking-wider mt-1">
                SEGUNDOS
              </span>
            </div>
          </div>

          {/* Warning Message */}
          {timeRemaining.totalSeconds < 3600 && (
            <div className={`flex items-start gap-2 p-3 ${colors.bg} border ${colors.border} rounded animate-pulse`}>
              <i className="fa-solid fa-exclamation-triangle text-red-400 text-xs mt-0.5"></i>
              <p className="text-[9px] text-gray-300 leading-relaxed">
                <span className="font-bold text-red-400">ATENÇÃO:</span> Mercado fechará em breve! Complete suas trocas agora.
              </p>
            </div>
          )}

          {/* Info */}
          <div className="pt-3 border-t border-white/5">
            <p className="text-center text-[9px] text-gray-500 leading-relaxed">
              {marketStatus.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketTimer;
