
import React, { useState, useMemo } from 'react';
import { UserTeam, Role, Player } from '../types';
import PlayerImage from './PlayerImage';
import TeamLogo from './TeamLogo';
import PaiCoin from './PaiCoin';
import MatchHistoryModal from './MatchHistoryModal';

interface SquadBuilderProps {
  userTeam: UserTeam;
  players: Player[];
  onFire: (role: Role) => void;
  onNavigateToMarket: () => void;
}

const SquadBuilder: React.FC<SquadBuilderProps> = ({ userTeam, players, onFire, onNavigateToMarket }) => {
  const [historyPlayer, setHistoryPlayer] = useState<Player | null>(null);
  const livePlayerMap = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach(p => map.set(String(p.id), p));
    return map;
  }, [players]);
  const roles = [
    { id: Role.TOP, label: 'TOP', top: '22%', left: '18%' },
    { id: Role.JNG, label: 'JUN', top: '38%', left: '35%' },
    { id: Role.MID, label: 'MID', top: '54%', left: '52%' },
    { id: Role.ADC, label: 'ADC', top: '86%', left: '78%' },
    { id: Role.SUP, label: 'SUP', top: '76%', left: '90%' },
  ];

  const formatValue = (val: number) => {
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(1).replace(',', '.');
  };

  const roundPoints = useMemo(() => {
    return Number(userTeam.currentRoundPoints ?? 0);
  }, [userTeam.currentRoundPoints]);

  const roleIcons: Record<string, string> = {
    [Role.TOP]: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png',
    [Role.JNG]: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png',
    [Role.MID]: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png',
    [Role.ADC]: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png',
    [Role.SUP]: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png',
  };

  const PowerModule = ({ label, value, icon, isCoin = false }: { label: string, value: string | number, icon?: React.ReactNode, isCoin?: boolean }) => (
    <div className="flex-1 group relative flex flex-col items-center justify-center py-4 sm:py-6 md:py-8 border-r border-white/5 last:border-r-0 overflow-hidden cursor-pointer transition-all duration-500 hover:bg-white/[0.02]">
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

      <div className="flex flex-col items-center gap-1 sm:gap-1.5 md:gap-2 relative z-10">
        {icon && (
          <div className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isCoin
              ? 'grayscale opacity-20 scale-75 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-[1.6] sm:group-hover:scale-[1.7] md:group-hover:scale-[1.8] group-hover:-translate-y-2'
              : 'opacity-10 group-hover:opacity-100 group-hover:scale-110'
          }`}>
            <div className={`${isCoin ? 'drop-shadow-[0_0_20px_rgba(59,130,246,0)] group-hover:drop-shadow-[0_0_25px_rgba(59,130,246,0.9)]' : ''}`}>
              {icon}
            </div>
          </div>
        )}
        <div className="text-center transform transition-transform duration-500 group-hover:translate-y-1">
          <span className={`text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl font-orbitron font-black tracking-tighter transition-all duration-500 ${isCoin ? 'text-gray-600 group-hover:text-white' : 'text-white'}`}>
            {value}
          </span>
          <div className="flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 mt-0.5 sm:mt-1">
            <div className="w-0.5 h-0.5 rounded-full bg-gray-800 group-hover:bg-[#3b82f6] group-hover:animate-pulse transition-all"></div>
            <span className="text-[6px] xs:text-[7px] font-black text-gray-500 uppercase tracking-[0.2em] xs:tracking-[0.25em] group-hover:text-[#3b82f6] transition-colors leading-none">
              {label}
            </span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-[#3b82f6] group-hover:w-1/2 transition-all duration-700 shadow-[0_0_10px_#3b82f6]"></div>
    </div>
  );

  return (
    <>
    <div className="max-w-[1280px] mx-auto space-y-8 sm:space-y-10 md:space-y-12 lg:space-y-16 animate-in fade-in duration-1000 pb-20 sm:pb-24 md:pb-28 lg:pb-32 px-3 xs:px-4 sm:px-5 md:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 md:gap-10 lg:gap-12 items-start pt-4 sm:pt-6 md:pt-10">
        <div className="lg:col-span-7 flex flex-col gap-6 sm:gap-8 md:gap-10">
          <div className="relative">
            <div className="absolute -left-6 sm:-left-8 md:-left-10 top-1/2 -translate-y-1/2 w-0.5 sm:w-1 h-16 sm:h-20 md:h-24 bg-gradient-to-b from-transparent via-[#3b82f6] to-transparent opacity-50 hidden lg:block"></div>
            
            <div className="space-y-4 sm:space-y-5 md:space-y-6">
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                <div className="px-2 xs:px-2.5 sm:px-3 py-0.5 sm:py-1 bg-white/5 border border-white/10 flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[7px] xs:text-[8px] font-black text-gray-500 tracking-[0.15em] xs:tracking-[0.2em] uppercase">SISTEMA ONLINE</span>
                  <div className="w-0.5 h-0.5 sm:w-1 sm:h-1 bg-[#3b82f6] rounded-full animate-ping"></div>
                </div>
                <div className="h-px w-12 sm:w-16 md:w-20 bg-white/10"></div>
              </div>

              <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-orbitron font-black text-white uppercase tracking-tighter leading-[0.85] break-words overflow-hidden max-w-full">
                {userTeam.name}
              </h1>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 lg:gap-8">
                <button 
                  onClick={onNavigateToMarket}
                  className="group relative px-6 xs:px-8 sm:px-9 md:px-10 py-3 xs:py-3.5 md:py-4 min-h-[44px] overflow-hidden bg-black/40 border border-[#3b82f6]/30 hover:border-[#3b82f6] transition-all shadow-[0_0_30px_rgba(0,0,0,0.5)] hover:shadow-[0_0_40px_rgba(99,102,241,0.3)] rounded-sm touch-manipulation"
                >
                  <div className="absolute inset-0 bg-[#3b82f6] translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                  <span className="relative z-10 text-[9px] xs:text-[10px] font-black text-[#3b82f6] group-hover:text-black uppercase tracking-[0.25em] xs:tracking-[0.3em] font-orbitron transition-colors">ABRIR MERCADO</span>
                </button>
              </div>
            </div>
          </div>
        </div>

          <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-5 md:gap-6">
          <div className="relative w-full aspect-[5/3.8] sm:aspect-[5/4.4] lg:aspect-[5/4.8] rounded-2xl sm:rounded-3xl md:rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden border border-white/10 bg-black shadow-[0_0_40px_rgba(0,0,0,0.6)] sm:shadow-[0_0_60px_rgba(0,0,0,0.8)] lg:shadow-[0_0_80px_rgba(0,0,0,1)] group">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
            <img
              src="https://i.imgur.com/myc9dfj.png"
              className="absolute inset-0 w-full h-full object-cover object-[50%_35%] scale-[1.28] opacity-45 contrast-[1.35] transition-all duration-[20s] group-hover:scale-[1.35] group-hover:rotate-1"
              alt="Tactical Map"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-black/55"></div>
            
            {roles.map(role => {
              const stored = userTeam.players[role.id];
              const live = stored ? livePlayerMap.get(String(stored.id)) : undefined;
              const p = stored ? { ...stored, points: live?.points ?? stored.points, avgPoints: live?.avgPoints ?? stored.avgPoints } : undefined;
              return (
                <div key={role.id} className="absolute -translate-x-1/2 -translate-y-1/2 z-20" style={{ top: role.top, left: role.left }}>
                  <div className="relative group/marker flex flex-col items-center gap-0.5" onClick={() => !p && onNavigateToMarket()} style={!p ? { cursor: 'pointer' } : undefined}>
                    <div className={`w-10 h-10 xs:w-12 xs:h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-full border-2 transition-all duration-500 relative flex items-center justify-center overflow-hidden ${
                      p ? 'border-[#3b82f6] bg-black shadow-[0_0_25px_rgba(59,130,246,0.6)] scale-110' : 'border-white/10 bg-black/80 hover:border-white/40'
                    }`}>
                      {p ? (
                        <PlayerImage player={p} priority className="w-full h-full rounded-full" imgClassName="w-full h-full object-cover contrast-125 brightness-110" />
                      ) : (
                        <div className="w-0.5 h-0.5 bg-white/20 rounded-full group-hover/marker:scale-[4] group-hover/marker:bg-[#3b82f6] transition-all"></div>
                      )}
                    </div>
                    {p && (
                      <span className="text-[7px] xs:text-[8px] font-black uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] bg-black/60 backdrop-blur-sm px-1.5 xs:px-2 py-0.5 rounded-full border border-white/10 whitespace-nowrap">
                        {p.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
          <h2 className="text-[9px] xs:text-[10px] font-black text-gray-700 uppercase tracking-[0.4em] xs:tracking-[0.5em] sm:tracking-[0.6em]">DADOS DA CONTA</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
        </div>
        
          <div className="flex flex-row items-stretch bg-black/40 border border-white/5 overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.4)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl rounded-xl sm:rounded-none">
          <PowerModule 
            label="PAITRIMÔNIO" 
            value={formatValue(userTeam.budget)} 
            isCoin={true}
            icon={<PaiCoin size="md" />}
          />
          <PowerModule 
            label="PONTOS NA RODADA" 
            value={formatValue(roundPoints)} 
            icon={<i className="fa-solid fa-bolt text-xl text-white/5 group-hover:text-[#3b82f6] group-hover:drop-shadow-[0_0_10px_#3b82f6] transition-all"></i>}
          />
          <PowerModule 
            label="PONTOS TOTAIS" 
            value={formatValue(userTeam.totalPoints)} 
            icon={<i className="fa-solid fa-trophy text-xl text-white/5 group-hover:text-[#3b82f6] group-hover:drop-shadow-[0_0_10px_#3b82f6] transition-all"></i>}
          />
        </div>
        
      </div>

      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] whitespace-nowrap">LINEUP OFICIAL</h2>
          <div className="h-px flex-1 bg-white/8"></div>
        </div>

        <div className="flex overflow-x-auto gap-2 sm:gap-3 pb-3 snap-x snap-mandatory no-scrollbar md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
          {roles.map((role) => {
            const stored = userTeam.players[role.id];
            const live = stored ? livePlayerMap.get(String(stored.id)) : undefined;
            const p = stored ? { ...stored, points: live?.points ?? stored.points, avgPoints: live?.avgPoints ?? stored.avgPoints } : undefined;
            const displayChampion = p?.selectedChampion || p?.lastChampion;
            return (
              <div
                key={role.id}
                onClick={() => p ? setHistoryPlayer(p as unknown as Player) : onNavigateToMarket()}
                className={`group relative flex flex-col bg-[#0d1117] border rounded-xl overflow-hidden transition-all duration-300 cursor-pointer touch-manipulation shrink-0 w-[44vw] xs:w-[40vw] sm:w-[26vw] snap-start md:w-auto md:shrink ${
                  p
                    ? 'border-white/8 hover:border-[#3b82f6]/40 shadow-[0_2px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_4px_30px_rgba(59,130,246,0.1)]'
                    : 'border-dashed border-white/5 opacity-40 hover:opacity-80'
                }`}
              >
                {/* Header role */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.02]">
                  <img src={roleIcons[role.id]} className="w-3 h-3 brightness-200 opacity-40 group-hover:opacity-100 transition-all" alt="" />
                  <span className="text-[9px] font-black text-gray-600 group-hover:text-[#3b82f6] transition-colors uppercase tracking-widest">{role.label}</span>
                  {p && <TeamLogo logoUrl={p.teamLogo} teamName={p.team} className="w-4 h-4 ml-auto opacity-70" />}
                </div>

                {/* Imagem + footer sobrepostos */}
                <div className="relative aspect-[3/5] overflow-hidden">
                  {p ? (
                    <>
                      {/* Logo do time como background */}
                      {p.teamLogo && (
                        <div className="absolute top-0 left-0 right-0 flex items-start justify-center pointer-events-none z-0 pt-3">
                          <img src={p.teamLogo} alt="" className="w-3/4 h-auto object-contain opacity-[0.07] group-hover:opacity-25 transition-opacity duration-500" />
                        </div>
                      )}

                      <PlayerImage player={p} priority className="relative z-10 w-full h-full" imgClassName="w-full h-full object-cover object-top brightness-105 transition-transform duration-700 group-hover:scale-105" />

                      {/* Gradiente forte na base */}
                      <div className="absolute inset-0 z-20 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/60 to-transparent" />

                      {/* Campeão */}
                      {displayChampion && (
                        <div className="absolute top-2 right-2 z-30">
                          <div className="relative w-8 h-8">
                            <img src={displayChampion.image} className="w-full h-full rounded-full border-2 border-black bg-black object-cover shadow-lg" alt="" />
                            <div className="absolute inset-0 rounded-full border border-[#3b82f6]/50"></div>
                          </div>
                        </div>
                      )}

                      {/* Nome e stats sobre o gradiente */}
                      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 z-30">
                        <h3 className="font-orbitron font-black text-[12px] truncate uppercase tracking-tighter text-white leading-none mb-2">
                          {p.name}
                        </h3>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest block leading-none mb-0.5">Valor</span>
                            <span className="text-[10px] font-orbitron font-black text-[#3b82f6]">C$ {p.price}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest block leading-none mb-0.5">Pts</span>
                            <span className="text-[10px] font-orbitron font-black text-white">{formatValue(Number(p.points || p.avgPoints || 0))}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-white/[0.01]">
                      <div className="w-10 h-10 rounded-full border border-dashed border-white/10 flex items-center justify-center group-hover:border-[#3b82f6]/30 transition-all">
                        <i className="fa-solid fa-plus text-white/10 text-xs group-hover:text-[#3b82f6]/40 transition-all"></i>
                      </div>
                      <span className="text-[8px] font-black text-gray-700 uppercase tracking-widest">VAGA LIVRE</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {historyPlayer && (
      <MatchHistoryModal
        player={historyPlayer}
        onClose={() => setHistoryPlayer(null)}
        userBudget={userTeam.budget}
        onReplace={() => { setHistoryPlayer(null); onNavigateToMarket(); }}
      />
    )}
    </>
  );
};

export default SquadBuilder;
