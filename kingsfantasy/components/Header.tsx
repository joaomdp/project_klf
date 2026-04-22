
import React, { useState, useEffect } from 'react';
import { Page } from '../types';
import logoImage from '../assets/images/logo/logo.png';
import { DataService } from '../services/api';

interface HeaderProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  userName: string;
  avatar: string;
  dbConnected?: boolean;
  marketIsOpen?: boolean | null;
  isAdmin?: boolean;
  showMarketTimer?: boolean;
  isGuest?: boolean;
  onLogin?: () => void;
}

const Logo: React.FC = () => {
  return (
    <div className="flex items-center gap-0.5 group transition-transform duration-300 ease-out hover:scale-[1.04]">
      <img
        src={logoImage}
        alt="Kings Lendas Fantasy Logo"
        className="h-20 w-20 sm:h-24 sm:w-24 object-contain drop-shadow-lg transition-[drop-shadow] duration-300 group-hover:drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]"
      />
      <div className="flex flex-col">
        <span className="text-[11px] sm:text-[13px] font-semibold text-white uppercase tracking-[0.15em] whitespace-nowrap transition-colors duration-300 group-hover:text-white/80">
          KINGS LENDAS
        </span>
        <h1 className="font-bold text-[20px] sm:text-[24px] text-[#3b82f6] uppercase tracking-[0.05em] leading-none whitespace-nowrap -mt-0.5 transition-colors duration-300 group-hover:text-[#60a5fa]">
          FANTASY
        </h1>
      </div>
    </div>
  );
};

const PAGE_ICONS: Record<string, string> = {
  dashboard: 'fa-house',
  ranking:   'fa-trophy',
  squad:     'fa-users',
  market:    'fa-store',
  'ai-coach':'fa-robot',
  profile:   'fa-user',
  admin:     'fa-shield-halved',
};

const Header: React.FC<HeaderProps> = ({
  activePage, onNavigate, userName, avatar,
  marketIsOpen = null, isAdmin = false,
  isGuest = false, onLogin,
}) => {
  const [marketStatus, setMarketStatus] = useState<{ isOpen: boolean } | null>(null);

  useEffect(() => {
    const fetchMarketStatus = async () => {
      const status = await DataService.getMarketStatus();
      setMarketStatus(status);
    };
    fetchMarketStatus();
    const interval = setInterval(fetchMarketStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const navItems: { id: Page; label: string }[] = [
    { id: 'dashboard', label: 'INÍCIO' },
    { id: 'ranking',   label: 'LIGAS' },
    { id: 'squad',     label: 'TIME' },
    { id: 'market',    label: 'MERCADO' },
  ];

  if (!isGuest) navItems.push({ id: 'ai-coach', label: 'IA' });
  if (isAdmin) navItems.push({ id: 'admin', label: 'ADMIN' });

  const isMarketOpen = marketStatus?.isOpen ?? marketIsOpen ?? false;

  return (
    <>
      {/* ── HEADER (desktop + mobile top bar) ── */}
      <header className="bg-[#0d1117] border-b border-[#1e2530] sticky top-0 z-50 h-20 sm:h-24">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 h-full flex items-center justify-between w-full relative">

          {/* Espaçador esquerdo — só mobile, equilibra o avatar direito */}
          <div className="lg:hidden w-9 h-9 shrink-0" />

          {/* Logo — centralizado no mobile, alinhado à esquerda no desktop */}
          <div
            className="lg:static absolute left-[45%] -translate-x-1/2 lg:translate-x-0 flex items-center cursor-pointer shrink-0"
            onClick={() => onNavigate('dashboard')}
          >
            <Logo />
          </div>

          {/* Navigation — desktop only */}
          <nav className="hidden lg:flex items-center gap-10">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`relative py-5 text-[13px] font-medium tracking-wide transition-all duration-200 whitespace-nowrap ${
                  activePage === item.id ? 'text-white' : 'text-[#8b949e] hover:text-white'
                }`}
              >
                {item.label}
                {activePage === item.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#3b82f6] rounded-t-sm" />
                )}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-5 shrink-0">
            {/* Market status */}
            <div className="hidden md:flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${isMarketOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                {isMarketOpen ? 'MERCADO ABERTO' : 'MERCADO FECHADO'}
              </span>
            </div>

            {/* Avatar ou botão ENTRAR (visitante) */}
            {isGuest ? (
              <button
                onClick={() => onLogin?.()}
                className="px-4 sm:px-5 py-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[11px] sm:text-xs font-bold uppercase tracking-[0.15em] transition-colors shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
              >
                Entrar
              </button>
            ) : (
              <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => onNavigate('profile')}
              >
                <div className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-all ${activePage === 'profile' ? 'border-[#3b82f6]' : 'border-[#2d3748] group-hover:border-[#4a5568]'}`}>
                  <img src={avatar} className="w-full h-full object-cover" alt="Avatar" />
                </div>
                <span className="hidden lg:block text-sm font-medium text-white">{userName}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── BOTTOM NAV — mobile only ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0d1117]/95 backdrop-blur-md border-t border-white/[0.06]"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch">
          {navItems.map((item) => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-3 relative transition-all"
              >
                {/* Indicador ativo */}
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-[#3b82f6] rounded-full" />
                )}

                <i className={`fa-solid ${PAGE_ICONS[item.id] || 'fa-circle'} text-[16px] transition-all duration-200 ${
                  active ? 'text-[#3b82f6]' : 'text-white/30'
                }`} />

                <span className={`text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                  active ? 'text-[#3b82f6]' : 'text-white/30'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default Header;
