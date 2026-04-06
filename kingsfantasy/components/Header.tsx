
import React, { useState } from 'react';
import { Page } from '../types';
import logoImage from '../assets/images/logo/logo.png';
import MarketTimer from './MarketTimer';

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
    <div className="flex items-center gap-2 sm:gap-3 group">
      <div className="relative h-5 md:h-6 xl:h-7 flex items-center transition-all duration-500 group-hover:scale-105 shrink-0">
        <div className="relative h-full flex items-center">
          <div className="absolute inset-0 bg-[#6366F1]/10 blur-[40px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          <img 
            src={logoImage}
            alt="Kings Lendas Fantasy Logo" 
            className="relative z-10 h-full w-auto object-contain transition-all duration-500 drop-shadow-[0_0_15px_rgba(94,108,255,0.25)] group-hover:drop-shadow-[0_0_25px_rgba(94,108,255,0.45)]"
          />
        </div>
      </div>
      <div className="flex flex-col">
        <h1 className="font-orbitron font-black text-[12px] sm:text-[13px] md:text-[14px] text-white uppercase tracking-tight leading-none whitespace-nowrap">
          KINGS LENDAS
        </h1>
        <span className="text-[7px] sm:text-[8px] font-bold text-[#6366F1] uppercase tracking-wider whitespace-nowrap">
          FANTASY
        </span>
      </div>
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({ activePage, onNavigate, userName, avatar, dbConnected = true, marketIsOpen = null, isAdmin = false, showMarketTimer = false }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navItems: { id: Page; label: string }[] = [
    { id: 'dashboard', label: 'Início' },
    { id: 'ranking', label: 'Ligas' },
    { id: 'squad', label: 'Time' },
    { id: 'market', label: 'Mercado' },
    { id: 'ai-coach', label: 'AI-SOLUT' },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin' });
  }

  return (
    <header className="bg-black/40 border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl h-16 xs:h-18 sm:h-20 md:h-24 lg:h-28">
      <div className="max-w-[1440px] mx-auto px-2 xs:px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 h-full flex items-center justify-between gap-2 xs:gap-3 sm:gap-4">
        
        <div
          className="flex items-center cursor-pointer shrink-0 h-full"
          onClick={() => onNavigate('dashboard')}
        >
          <Logo />
        </div>

        <nav className="hidden lg:flex items-center justify-center h-full flex-1 min-w-0">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative h-full px-2 lg:px-3 xl:px-5 2xl:px-6 flex items-center justify-center text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-[12px] font-black uppercase tracking-[0.04em] lg:tracking-[0.06em] xl:tracking-[0.08em] 2xl:tracking-[0.1em] transition-all duration-300 ${
                activePage === item.id 
                  ? 'text-white drop-shadow-[0_0_8px_rgba(94,108,255,0.3)]' 
                  : 'text-gray-500 hover:text-gray-200'
              }`}
            >
              <span className="relative z-10 truncate">
                {item.id === 'ai-coach' ? (
                  <>
                    <span className="hidden 2xl:inline">AI-SOLUT</span>
                    <span className="2xl:hidden hidden xl:inline">AI-COACH</span>
                    <span className="xl:hidden">AI</span>
                  </>
                ) : item.label}
              </span>
              {activePage === item.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 sm:h-1 bg-[#6366F1] shadow-[0_0_12px_#6366F1] sm:shadow-[0_0_15px_#6366F1]"></div>
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-8 shrink-0">
          <button
            type="button"
            className="lg:hidden w-9 h-9 xs:w-10 xs:h-10 rounded-lg xs:rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:border-white/30 transition-all flex items-center justify-center"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Abrir menu"
          >
            <i className={`fa-solid ${isMenuOpen ? 'fa-xmark' : 'fa-bars'} text-base xs:text-lg`}></i>
          </button>
          <div className="hidden xl:flex items-center border-r border-white/10 pr-4 lg:pr-5 xl:pr-6">
            <MarketTimer compact className="whitespace-nowrap" />
          </div>
          
          <div 
            className={`flex items-center gap-2 xs:gap-3 sm:gap-4 md:gap-5 cursor-pointer group p-1.5 xs:p-2 sm:p-2.5 rounded-xl xs:rounded-2xl transition-all border ${activePage === 'profile' ? 'bg-white/5 border-white/10' : 'border-transparent hover:bg-white/5'}`}
            onClick={() => onNavigate('profile')}
          >
             <div className="relative shrink-0">
                <img
                  src={avatar}
                  className={`w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-lg xs:rounded-xl object-cover border-2 transition-all ${activePage === 'profile' ? 'border-[#6366F1] shadow-[0_0_15px_rgba(94,108,255,0.3)] sm:shadow-[0_0_20px_rgba(94,108,255,0.4)]' : 'border-white/10 group-hover:border-[#6366F1]/50'}`}
                  alt="Avatar"
                />
               <div className="absolute -bottom-0.5 -right-0.5 xs:-bottom-1 xs:-right-1 w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 bg-[#6366F1] border border-black xs:border-2 rounded-full shadow-lg"></div>
             </div>
              <div className="hidden sm:block text-left max-w-[100px] xs:max-w-[120px] sm:max-w-[140px] min-w-0">
                 <p className="text-[10px] xs:text-[11px] sm:text-[12px] font-black text-white uppercase tracking-tight leading-none group-hover:text-[#6366F1] transition-colors truncate">{userName}</p>
              </div>
            </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="lg:hidden absolute top-full inset-x-0 bg-black/90 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-[1440px] mx-auto px-3 xs:px-4 py-3 xs:py-4 space-y-1.5 xs:space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 xs:px-4 py-2.5 xs:py-3 rounded-lg xs:rounded-xl text-[10px] xs:text-[11px] font-black uppercase tracking-[0.10em] xs:tracking-[0.12em] transition-all ${
                  activePage === item.id
                    ? 'bg-[#6366F1]/20 text-white border border-[#6366F1]/40'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span>
                  {item.id === 'ai-coach' ? 'AI' : item.label}
                </span>
                {activePage === item.id && (
                  <span className="w-1.5 h-1.5 xs:w-2 xs:h-2 rounded-full bg-[#6366F1] shadow-[0_0_8px_#6366F1] xs:shadow-[0_0_10px_#6366F1]"></span>
                )}
              </button>
            ))}
            {isAdmin && (
              <button
                onClick={() => {
                  onNavigate('admin');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 xs:px-4 py-2.5 xs:py-3 rounded-lg xs:rounded-xl text-[10px] xs:text-[11px] font-black uppercase tracking-[0.10em] xs:tracking-[0.12em] transition-all ${
                  activePage === 'admin'
                    ? 'bg-[#6366F1]/20 text-white border border-[#6366F1]/40'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span>Admin</span>
                {activePage === 'admin' && (
                  <span className="w-1.5 h-1.5 xs:w-2 xs:h-2 rounded-full bg-[#6366F1] shadow-[0_0_8px_#6366F1] xs:shadow-[0_0_10px_#6366F1]"></span>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
