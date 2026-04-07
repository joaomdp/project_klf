
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
}

const Logo: React.FC = () => {
  return (
    <div className="flex items-center gap-3">
      <img 
        src={logoImage}
        alt="Kings Lendas Fantasy Logo" 
        className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
      />
      <div className="flex flex-col">
        <h1 className="font-orbitron font-black text-base sm:text-lg text-white uppercase tracking-[0.15em] leading-none whitespace-nowrap">
          KINGS LENDAS
        </h1>
        <span className="text-[9px] sm:text-[11px] font-bold text-[#E91E63] uppercase tracking-[0.35em] whitespace-nowrap mt-0.5">
          F A N T A S Y
        </span>
      </div>
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({ activePage, onNavigate, userName, avatar, dbConnected = true, marketIsOpen = null, isAdmin = false, showMarketTimer = false }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    { id: 'dashboard', label: 'HOME' },
    { id: 'ranking', label: 'LEAGUES' },
    { id: 'squad', label: 'TEAM' },
    { id: 'market', label: 'MARKET' },
    { id: 'ai-coach', label: 'AI-SOLUT' },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'ADMIN' });
  }

  const isMarketOpen = marketStatus?.isOpen ?? marketIsOpen ?? false;

  return (
    <header className="bg-[#0a0a12] border border-[#1a1a2e] sticky top-0 z-50 h-16">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        
        {/* Logo */}
        <div
          className="flex items-center cursor-pointer shrink-0"
          onClick={() => onNavigate('dashboard')}
        >
          <Logo />
        </div>

        {/* Navigation - Centered */}
        <nav className="hidden lg:flex items-center gap-8 absolute left-1/2 transform -translate-x-1/2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative py-5 text-[13px] font-semibold uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${
                activePage === item.id 
                  ? 'text-white' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {item.label}
              {activePage === item.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6366F1]"></span>
              )}
            </button>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden w-8 h-8 rounded border border-white/10 bg-white/5 text-gray-300 hover:text-white transition-all flex items-center justify-center"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Abrir menu"
          >
            <i className={`fa-solid ${isMenuOpen ? 'fa-xmark' : 'fa-bars'} text-sm`}></i>
          </button>

          {/* Market Status */}
          <div className="hidden md:flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'} animate-pulse`}></span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${isMarketOpen ? 'text-emerald-400' : 'text-red-400'}`}>
              {isMarketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
            </span>
          </div>

          {/* Notification Bell */}
          <button className="hidden sm:flex w-9 h-9 items-center justify-center text-gray-500 hover:text-white transition-colors">
            <i className="fa-regular fa-bell text-lg"></i>
          </button>
          
          {/* User Avatar and Name */}
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onNavigate('profile')}
          >
            <div className={`w-9 h-9 rounded-lg overflow-hidden border-2 transition-all ${activePage === 'profile' ? 'border-[#6366F1]' : 'border-gray-700 group-hover:border-gray-500'}`}>
              <img
                src={avatar}
                className="w-full h-full object-cover"
                alt="Avatar"
              />
            </div>
            <span className="hidden lg:block text-sm font-semibold text-white uppercase tracking-wide">
              {userName}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden absolute top-full inset-x-0 bg-[#0a0a12] border-b border-[#1a1a2e]">
          <div className="max-w-[1440px] mx-auto px-4 py-4 space-y-2">
            {/* Market Status - Mobile */}
            <div className="flex items-center gap-2 px-4 py-3 mb-2 bg-white/5 rounded-lg">
              <span className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></span>
              <span className={`text-xs font-semibold uppercase tracking-wider ${isMarketOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                {isMarketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
              </span>
            </div>
            
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all ${
                  activePage === item.id
                    ? 'bg-[#6366F1]/20 text-white border-l-2 border-[#6366F1]'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{item.label}</span>
                {activePage === item.id && (
                  <span className="w-2 h-2 rounded-full bg-[#6366F1] shadow-[0_0_8px_#6366F1]"></span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
