
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
    <div className="flex items-center gap-2 group">
      <img 
        src={logoImage}
        alt="Kings Lendas Fantasy Logo" 
        className="h-6 sm:h-7 md:h-8 w-auto object-contain"
      />
      <div className="flex flex-col">
        <h1 className="font-orbitron font-black text-[10px] sm:text-[11px] md:text-xs text-white uppercase tracking-tight leading-none whitespace-nowrap">
          KINGS LENDAS
        </h1>
        <span className="text-[6px] sm:text-[7px] md:text-[8px] font-bold text-[#6366F1] uppercase tracking-wider whitespace-nowrap">
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
    <header className="bg-black/40 border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl h-12 sm:h-14 md:h-16">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 h-full flex items-center justify-between gap-4">
        
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
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap rounded ${
                activePage === item.id 
                  ? 'text-white bg-[#6366F1]/20' 
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {item.id === 'ai-coach' ? 'AI-SOLUT' : item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <button
            type="button"
            className="lg:hidden w-7 h-7 sm:w-8 sm:h-8 rounded border border-white/10 bg-white/5 text-gray-300 hover:text-white transition-all flex items-center justify-center"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Abrir menu"
          >
            <i className={`fa-solid ${isMenuOpen ? 'fa-xmark' : 'fa-bars'} text-xs`}></i>
          </button>
          <div className="hidden xl:flex items-center border-r border-white/10 pr-4">
            <MarketTimer compact className="whitespace-nowrap text-[10px]" />
          </div>
          
          <div 
            className={`flex items-center gap-2 cursor-pointer group p-1 rounded-lg transition-all ${activePage === 'profile' ? 'bg-white/5' : 'hover:bg-white/5'}`}
            onClick={() => onNavigate('profile')}
          >
            <img
              src={avatar}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md object-cover border transition-all ${activePage === 'profile' ? 'border-[#6366F1]' : 'border-white/10 group-hover:border-[#6366F1]/50'}`}
              alt="Avatar"
            />
            <p className="hidden lg:block text-[10px] font-bold text-white uppercase tracking-tight truncate max-w-[80px]">{userName}</p>
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
