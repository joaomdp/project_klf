
import React, { useState, useEffect } from 'react';
import { Player } from '../types';
import PlayerImage from './PlayerImage';

interface MatchHistoryModalProps {
  player: Player;
  onClose: () => void;
}

const MatchHistoryModal: React.FC<MatchHistoryModalProps> = ({ player, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  const mockHistory = [
    { champion: 'Lee Sin', icon: 'https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/LeeSin.png', points: 18.5, result: 'win', date: '15/03' },
    { champion: 'Jarvan IV', icon: 'https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/JarvanIV.png', points: -2.1, result: 'loss', date: '12/03' },
  ];

  const triggerClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  return (
    <div className={`fixed left-0 right-0 bottom-0 top-16 md:top-28 z-[300] flex justify-center py-6 md:py-20 transition-all duration-300 ${isClosing ? 'bg-black/0 backdrop-blur-0' : 'bg-black/85 backdrop-blur-md'}`}>
      <div className="fixed inset-0 top-16 md:top-28" onClick={triggerClose}></div>
      <div className={`relative w-full max-w-md h-fit bg-[#0B0411] rounded-[40px] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] transition-all duration-500 overflow-hidden ${isClosing ? 'opacity-0 scale-95 translate-y-12' : 'opacity-100 scale-100 translate-y-0 animate-in zoom-in-95'}`}>
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-br from-[#6366F1]/10 to-transparent relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl border-2 border-[#6366F1]/30 overflow-hidden bg-black shadow-2xl">
               <PlayerImage player={player} className="w-full h-full" />
            </div>
            <div>
              <span className="text-[10px] font-black text-[#6366F1] uppercase tracking-widest">{player.role}</span>
              <h3 className="font-orbitron font-black text-2xl text-white uppercase tracking-tighter leading-none">{player.name}</h3>
            </div>
          </div>
          <button onClick={triggerClose} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-all text-gray-500 hover:text-white">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
        
        <div className="p-8 space-y-6 relative z-10">
          <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">ÚLTIMOS JOGOS</h4>
          <div className="space-y-4">
            {mockHistory.map((match, idx) => (
              <div key={idx} className="flex items-center justify-between p-5 bg-white/[0.02] rounded-3xl border border-white/5 group hover:border-[#6366F1]/30 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={match.icon} className="w-11 h-11 rounded-xl border border-white/10" alt="" />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-black flex items-center justify-center text-[7px] font-black text-white ${match.result === 'win' ? 'bg-green-500' : 'bg-red-500'}`}>{match.result === 'win' ? 'V' : 'D'}</div>
                  </div>
                  <div>
                    <p className="text-[13px] font-black text-white uppercase tracking-tight group-hover:text-[#6366F1] transition-colors">{match.champion}</p>
                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{match.date}</span>
                  </div>
                </div>
                <p className={`font-orbitron font-black text-xl tracking-tighter ${match.points >= 0 ? 'text-white' : 'text-red-500'}`}>{match.points > 0 ? '+' : ''}{match.points.toFixed(1)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-8 pb-10 pt-2 relative z-10 text-center">
          <div className="grid grid-cols-2 gap-4 mb-10">
             <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-1">MÉDIA SEASON</p>
                <p className="text-lg font-orbitron font-black text-white">{player.avgPoints.toFixed(1)}</p>
             </div>
             <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-1">KDA GERAL</p>
                <p className="text-lg font-orbitron font-black text-[#6366F1] shadow-[0_0_10px_rgba(94,108,255,0.2)]">{player.kda}</p>
             </div>
          </div>
          <button onClick={triggerClose} className="inline-block text-white/20 hover:text-[#6366F1]/60 text-[9px] font-black uppercase tracking-[0.4em] transition-all">FECHAR RELATÓRIO</button>
        </div>
      </div>
    </div>
  );
};

export default MatchHistoryModal;
