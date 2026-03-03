
import React from 'react';
import { Page } from '../types';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const menuItems: { id: Page; icon: string; label: string }[] = [
    { id: 'dashboard', icon: 'fa-chart-line', label: 'Painel' },
    { id: 'squad', icon: 'fa-shield-halved', label: 'Meu Time' },
    { id: 'market', icon: 'fa-users', label: 'Mercado' },
    { id: 'ranking', icon: 'fa-trophy', label: 'Ranking' },
    { id: 'ai-coach', icon: 'fa-robot', label: 'Coach AI' },
  ];

  return (
    <aside className="w-full md:w-64 bg-[#0a141e] border-r border-[#c89b3c]/20 flex flex-col sticky top-0 md:h-screen z-50">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-gold rounded-full flex items-center justify-center text-[#010a13]">
          <i className="fa-solid fa-crown text-xl"></i>
        </div>
        <h1 className="font-orbitron text-lg font-bold text-gold tracking-tighter">KINGS LENDAS</h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2 flex md:flex-col overflow-x-auto md:overflow-x-visible no-scrollbar">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap md:whitespace-normal w-full
              ${activePage === item.id 
                ? 'bg-gold/10 text-gold border-r-4 border-gold' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
          >
            <i className={`fa-solid ${item.icon} w-6 text-center`}></i>
            <span className="font-semibold">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-6 border-t border-[#c89b3c]/10 hidden md:block">
        <div className="p-3 bg-[#010a13] rounded-lg border border-[#c89b3c]/20">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Rodada Atual</p>
          <div className="flex items-center justify-between">
            <span className="text-white font-bold">Rodada 14</span>
            <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded">Aberto</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Fecha em: 2d 04h
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
