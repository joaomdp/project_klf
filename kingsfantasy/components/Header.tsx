
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
    <div className="flex items-center gap-3 group">
      <img 
        src={logoImage}
        alt="Kings Lendas Fantasy Logo" 
        className="h-10 sm:h-12 md:h-14 lg:h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(94,108,255,0.25)] group-hover:drop-shadow-[0_0_25px_rgba(94,108,255,0.45)] transition-all duration-300"
      />
      <div className="flex flex-col">
        <h1 className="font-orbitron font-black text-xs sm:text-sm md:text-base text-white uppercase tracking-tight leading-none whitespace-nowrap">
          KINGS LENDAS
        </h1>
        <span className="text-[8px] sm:text-[9px] md:text-[10px] font-bold text-[#6366F1] uppercase tracking-wider whitespace-nowrap">
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
    <header className="bg-black/40 border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl py-2 sm:py-3 md:py-4">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 flex items-center justify-between gap-4">
        
        <div
          className="flex items-center cursor-pointer shrink-0"
          onClick={() => onNavigate('dashboard')}
        >
          <Logo />
        </div>

        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative px-3 xl:px-4 py-2 flex items-center justify-center text-[10px] xl:text-[11px] font-black uppercase tracking-wider transition-all duration-300 whitespace-nowrap rounded-lg ${
                activePage === item.id 
                  ? 'text-white bg-[#6366F1]/20 border border-[#6366F1]/30' 
                  : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {item.id === 'ai-coach' ? 'AI-SOLUT' : item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 md:gap-5 lg:gap-6 shrink-0">
          <button
            type="button"
            className="lg:hidden w-8 h-8 xs:w-9 xs:h-9 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:border-white/30 transition-all flex items-center justify-center"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Abrir menu"
          >
            <i className={`fa-solid ${isMenuOpen ? 'fa-xmark' : 'fa-bars'} text-sm xs:text-base`}></i>
          </button>
          <div className="hidden 2xl:flex items-center border-r border-white/10 pr-3 lg:pr-4">
            <MarketTimer compact className="whitespace-nowrap" />
          </div>
          
          <div 
            className={`flex items-center gap-1.5 xs:gap-2 sm:gap-2.5 cursor-pointer group p-1 xs:p-1.5 sm:p-2 rounded-lg xs:rounded-xl transition-all border ${activePage === 'profile' ? 'bg-white/5 border-white/10' : 'border-transparent hover:bg-white/5'}`}
            onClick={() => onNavigate('profile')}
          >
             <div className="relative shrink-0">
                <img
                  src={avatar}
                  className={`w-7 h-7 xs:w-8 xs:h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg object-cover border-2 transition-all ${activePage === 'profile' ? 'border-[#6366F1] shadow-[0_0_15px_rgba(94,108,255,0.3)]' : 'border-white/10 group-hover:border-[#6366F1]/50'}`}
                  alt="Avatar"
                />
               <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 xs:w-3 xs:h-3 bg-[#6366F1] border border-black rounded-full shadow-lg"></div>
             </div>
              <div className="hidden lg:block text-left max-w-[80px] xl:max-w-[100px] 2xl:max-w-[120px] min-w-0">
                 <p className="text-[9px] xs:text-[10px] xl:text-[11px] font-black text-white uppercase tracking-tight leading-none group-hover:text-[#6366F1] transition-colors truncate">{userName}</p>
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
