
import React, { useState, useMemo } from 'react';
import { Champion, Role } from '../types';
import { CHAMPIONS_LIST, CHAMPION_ROLES_MAP } from '../constants';

interface ChampionSelectorProps {
  playerName: string;
  playerId?: string;
  onSelect: (champ: Champion) => void;
  onClose: () => void;
}

const ChampionSelector: React.FC<ChampionSelectorProps> = ({ playerName, playerId, onSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | 'ALL'>('ALL');
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmingChamp, setConfirmingChamp] = useState<Champion | null>(null);

  const roleFilters = [
    { id: 'ALL', label: 'TODOS', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-fill.png' },
    { id: Role.TOP, label: 'TOPO', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png' },
    { id: Role.JNG, label: 'CAÇADOR', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png' },
    { id: Role.MID, label: 'MEIO', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png' },
    { id: Role.ADC, label: 'ATIRADOR', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png' },
    { id: Role.SUP, label: 'SUPORTE', icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png' },
  ];

  const CUSTOM_CHAMPION_IMAGES: Record<string, string> = {
    Zaahen: 'https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/Zaahen.png'
  };

  const getChampionImage = (id: string) => {
    return CUSTOM_CHAMPION_IMAGES[id] || `https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/${id}.png`;
  };

  const filteredChampions = useMemo(() => {
    return CHAMPIONS_LIST
      .filter(id => {
        const displayName = id === 'MonkeyKing' ? 'Wukong' : id;
        const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase()) || id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = selectedRole === 'ALL' || (CHAMPION_ROLES_MAP[id] && CHAMPION_ROLES_MAP[id].includes(selectedRole as Role));
        return matchesSearch && matchesRole;
      })
      .map(id => ({
        id,
        name: id === 'MonkeyKing' ? 'Wukong' : id,
        image: getChampionImage(id)
      }));
  }, [searchTerm, selectedRole]);

  const handleSelect = (champ: Champion) => {
    setIsConfirming(true);
    setConfirmingChamp(champ);
    setTimeout(() => onSelect(champ), 150);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop com blur */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={() => !isConfirming && onClose()}></div>
      
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl bg-black border border-white/10 overflow-hidden shadow-[0_0_80px_rgba(99,102,241,0.25)] flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
        
        {/* Overlay de Confirmação */}
        {isConfirming && (
          <div className="absolute inset-0 z-[300] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center animate-in fade-in duration-300">
             {confirmingChamp && (
               <div className="relative animate-in zoom-in duration-500">
                 <div className="absolute inset-0 rounded-full bg-[#6366F1] blur-3xl opacity-50 animate-pulse"></div>
                 <div className="relative w-48 h-48 rounded-full border-4 border-[#6366F1] overflow-hidden shadow-[0_0_60px_rgba(99,102,241,0.8)]">
                    <img src={confirmingChamp.image} className="w-full h-full object-cover scale-110" alt="" />
                 </div>
               </div>
             )}
             <div className="mt-10 flex flex-col items-center gap-3">
               <h3 className="font-orbitron font-black text-white text-3xl uppercase tracking-[0.4em] animate-pulse">SINCRONIZANDO</h3>
               <div className="flex gap-2">
                 <div className="w-2 h-2 bg-[#6366F1] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                 <div className="w-2 h-2 bg-[#6366F1] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                 <div className="w-2 h-2 bg-[#6366F1] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
               </div>
             </div>
          </div>
        )}
        
        {/* Header */}
        <div className="relative p-6 border-b border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent shrink-0">
          {/* Botão fechar */}
            <button
            onClick={onClose}
              className="absolute top-4 right-4 sm:top-8 sm:right-8 w-10 h-10 flex items-center justify-center border border-white/10 bg-white/5 hover:bg-red-500/10 hover:border-red-500/30 text-gray-500 hover:text-red-500 transition-all group"
          >
            <i className="fa-solid fa-xmark text-sm group-hover:rotate-90 transition-transform duration-300"></i>
          </button>

            <div className="max-w-4xl mx-auto space-y-6">
            {/* Título */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-1 h-7 bg-[#6366F1]"></div>
                <h2 className="font-orbitron font-black text-2xl sm:text-3xl text-white uppercase tracking-tighter">SELEÇÃO DE CAMPEÃO</h2>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em]">JOGADOR:</span>
                <span className="text-[10px] font-black text-[#6366F1] uppercase tracking-wider">{playerName}</span>
              </div>
            </div>

            {/* Busca + Filtros na mesma linha */}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search Bar */}
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 text-xs"></i>
                <input 
                  type="text" 
                  placeholder="BUSCAR CAMPEÃO..." 
                  className="w-full bg-black/40 border border-white/10 py-4 pl-12 pr-6 text-[10px] font-black text-white uppercase placeholder:text-gray-700 focus:outline-none focus:border-[#6366F1]/50 focus:bg-black/60 transition-all" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>

              {/* Role Filters - Compactos */}
              <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto sm:no-scrollbar">
                {roleFilters.map((filter) => (
                  <button 
                    key={filter.id} 
                    onClick={() => setSelectedRole(filter.id as any)} 
                    className={`flex items-center justify-center gap-2 px-4 py-4 border transition-all group ${
                      selectedRole === filter.id 
                        ? 'bg-[#6366F1] border-[#6366F1] shadow-[0_0_20px_rgba(99,102,241,0.4)]' 
                        : 'bg-black/40 border-white/10 hover:border-white/30 hover:bg-white/5'
                    }`}
                  >
                    <img 
                      src={filter.icon} 
                      className={`w-4 h-4 transition-all ${
                        selectedRole === filter.id 
                          ? 'brightness-0 invert' 
                          : 'brightness-75 opacity-40 group-hover:opacity-100'
                      }`} 
                      alt="" 
                    />
                    <span className={`text-[8px] font-black uppercase tracking-widest hidden xl:block ${
                      selectedRole === filter.id 
                        ? 'text-black' 
                        : 'text-gray-600 group-hover:text-gray-400'
                    }`}>
                      {filter.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Champions Grid */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-black/20">
          <div className="max-w-4xl mx-auto">
            {filteredChampions.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {filteredChampions.map((champ) => (
                  <button 
                    key={champ.id} 
                    onClick={() => !isConfirming && handleSelect(champ)} 
                    className="group flex flex-col items-center gap-2 transition-all hover:scale-105 active:scale-95"
                  >
                    <div className="relative w-full aspect-square overflow-hidden border-2 border-white/10 bg-black group-hover:border-[#6366F1] transition-all duration-300 shadow-lg group-hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                      <img 
                        src={champ.image} 
                        className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500 group-hover:scale-110" 
                        alt={champ.name} 
                      />
                      {/* Overlay gradient no hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#6366F1]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    <span className="text-[9px] font-black text-gray-700 group-hover:text-[#6366F1] uppercase tracking-tight transition-colors text-center leading-tight">
                      {champ.name}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <i className="fa-solid fa-search text-5xl text-gray-800"></i>
                <span className="text-sm font-black text-gray-700 uppercase tracking-widest">Nenhum campeão encontrado</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChampionSelector;
