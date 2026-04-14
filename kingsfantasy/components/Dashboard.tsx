
import React, { useState, useEffect } from 'react';
import { UserTeam, Role, League, Player } from '../types';
import PlayerImage from './PlayerImage';
import { DataService } from '../services/api';
import StandingsTable from './StandingsTable';
import PaiCoin from './PaiCoin';
import TeamLogo from './TeamLogo';
import kingsLogo from '../assets/images/logo/logo.png';

interface DashboardProps {
  userTeam: UserTeam;
  players: Player[];
  onNavigate: (page: any, leagueId?: string) => void;
}

/**
 * CONFIGURAÇÃO DO MEDIA HUB
 */
const MEDIA_HUB_CONFIG = {
  videoId: "dcVDc8uUzK4",
  videoTitle: "DRAFT DOS CAPITÃES da COPA KINGS LENDAS 2026",
  customThumbnail: "",
  channelName: "Cortes da Ilha",
  channelIcon: "https://i.imgur.com/4ilaY1c.png"
};


const Dashboard: React.FC<DashboardProps> = ({ userTeam, players, onNavigate }) => {
  const [pickedFilter, setPickedFilter] = useState<Role | 'TODOS'>('TODOS');
  const [userLeagues, setUserLeagues] = useState<(League & { resolvedLogo?: string })[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [pickCounts, setPickCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const counts = await DataService.getPlayerPickCounts();
      if (mounted) {
        setPickCounts(counts);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const fetchUserLeagues = async () => {
      if (!userTeam.userId) return;
      setLoadingLeagues(true);
      try {
        const [leagues, allTeams] = await Promise.all([
          DataService.getUserLeagues(userTeam.userId),
          DataService.getTeams(),
        ]);
        const favoriteTeam = userTeam.favoriteTeam;
        const resolved = leagues.map(league => {
          let resolvedLogo: string | undefined;
          if (league.code === 'KINGSLENDAS' || league.name.toUpperCase().includes('KINGS')) {
            resolvedLogo = kingsLogo;
          } else if (favoriteTeam) {
            const team = allTeams.find(t =>
              t.name.toLowerCase() === favoriteTeam.toLowerCase() ||
              t.name.toLowerCase().includes(favoriteTeam.toLowerCase()) ||
              favoriteTeam.toLowerCase().includes(t.name.toLowerCase())
            );
            if (team) resolvedLogo = team.logo;
          }
          return { ...league, resolvedLogo };
        });
        setUserLeagues(resolved);
      } catch (error) {
        console.error('Erro ao buscar ligas:', error);
      } finally {
        setLoadingLeagues(false);
      }
    };
    fetchUserLeagues();
  }, [userTeam.userId, userTeam.favoriteTeam]);
  
  const rolesList = [Role.TOP, Role.JNG, Role.MID, Role.ADC, Role.SUP];

  const roleMetadata: Record<string, { label: string; icon: string }> = {
    TODOS: { 
      label: 'TODOS', 
      icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-fill.png' 
    },
    [Role.TOP]: { 
      label: 'TOPO', 
      icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png' 
    },
    [Role.JNG]: { 
      label: 'CAÇADOR', 
      icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png' 
    },
    [Role.MID]: { 
      label: 'MEIO', 
      icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png' 
    },
    [Role.ADC]: { 
      label: 'ATIRADOR', 
      icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png' 
    },
    [Role.SUP]: { 
      label: 'SUPORTE', 
      icon: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png' 
    }
  };


  const formatValue = (val: number) => {
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(1).replace(',', '.');
  };

  const formatPoints = (val: number) => {
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(2);
  };

  const trending = [...players]
    .filter(p => pickedFilter === 'TODOS' || p.role === pickedFilter)
    .map((p) => ({ ...p, pickCount: pickCounts[p.id] || 0 }))
    .sort((a, b) => b.pickCount - a.pickCount)
    .slice(0, 5);

  const videoThumbnail = MEDIA_HUB_CONFIG.customThumbnail || `https://i.ytimg.com/vi/${MEDIA_HUB_CONFIG.videoId}/maxresdefault.jpg`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 px-3 xs:px-4 sm:px-6">
      {/* COLUNA LATERAL */}
      <div className="lg:col-span-4 space-y-6 sm:space-y-8">
        <section>
          <div className="flex items-center gap-4 mb-3 sm:mb-4 md:mb-5 px-1">
            <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] whitespace-nowrap">MEU TIME</h2>
            <div className="h-px flex-1 bg-white/8"></div>
          </div>
          <div className="bg-[#0d1117] border border-white/8 rounded-xl overflow-hidden">

            {/* Header do time */}
            <div className="flex items-center gap-4 p-4 border-b border-white/5">
              <div className="w-12 h-12 bg-black border border-[#3b82f6]/20 flex items-center justify-center overflow-hidden rounded-full shrink-0">
                {userTeam.avatar ? (
                  <img
                    src={userTeam.avatar}
                    alt={userTeam.userName}
                    className="w-full h-full object-cover scale-110"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) parent.innerHTML = '<i class="fa-solid fa-crown text-[#3b82f6] text-xl"></i>';
                    }}
                  />
                ) : (
                  <i className="fa-solid fa-crown text-[#3b82f6] text-xl"></i>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-orbitron font-black text-base text-white uppercase tracking-tighter truncate leading-none">{userTeam.name}</h3>
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-1 truncate">{userTeam.userName}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 divide-x divide-white/5 border-b border-white/5">
              <div className="px-4 py-3">
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">PATRIMÔNIO</p>
                <div className="flex items-center gap-1.5">
                  <PaiCoin size="sm" />
                  <span className="text-lg font-orbitron font-black text-white">{formatValue(userTeam.budget)}</span>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">PONTOS</p>
                <span className="text-lg font-orbitron font-black text-white">{formatPoints(userTeam.currentRoundPoints ?? userTeam.totalPoints)}</span>
              </div>
            </div>

            {/* Escalação */}
            <div
              onClick={() => onNavigate('squad')}
              className="p-4 cursor-pointer group/lineup"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em]">MINHA ESCALAÇÃO</span>
                <div className="flex items-center gap-1.5 text-[#3b82f6] opacity-0 group-hover/lineup:opacity-100 transition-all">
                  <span className="text-[8px] font-black uppercase tracking-widest">VER TUDO</span>
                  <i className="fa-solid fa-arrow-right text-[9px] group-hover/lineup:translate-x-1 transition-all"></i>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {rolesList.map(role => {
                  const player = userTeam.players[role];
                  const champ = player?.selectedChampion || player?.lastChampion;
                  return (
                    <div key={role} className="flex flex-col gap-1.5 items-center">
                      <div className={`aspect-square w-full rounded-full border transition-all duration-500 relative ${player ? 'border-[#3b82f6]/60 bg-black shadow-[0_0_20px_rgba(59,130,246,0.12)]' : 'border-white/5 bg-white/[0.02]'}`}>
                        {player ? (
                          <>
                            <div className="w-full h-full p-0.5 rounded-full overflow-hidden">
                              <PlayerImage player={player} priority className="w-full h-full rounded-full scale-105" />
                            </div>
                            {champ && (
                              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-black bg-black overflow-hidden shadow-2xl z-20">
                                <img src={champ.image} className="w-full h-full object-cover" alt="" />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-10">
                            <img src={roleMetadata[role].icon} className="w-4 h-4 brightness-0 invert" alt="" />
                          </div>
                        )}
                      </div>
                      <span className={`text-[9px] font-black text-center uppercase tracking-tighter truncate w-full ${player ? 'text-[#3b82f6]' : 'text-gray-700'}`}>
                        {player ? player.name.substring(0, 8) : roleMetadata[role].label.substring(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <StandingsTable />

        <section>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] whitespace-nowrap">LIGAS</h2>
            <div className="h-px flex-1 bg-white/8"></div>
          </div>

          {loadingLeagues ? (
            <div className="bg-[#0d1117] border border-white/8 rounded-xl px-4 py-8 flex items-center justify-center gap-2 text-gray-600">
              <i className="fa-solid fa-spinner fa-spin text-sm"></i>
              <span className="text-[10px] font-black uppercase tracking-wider">Carregando...</span>
            </div>
          ) : userLeagues.length === 0 ? (
            <div className="bg-[#0d1117] border border-white/8 rounded-xl p-6 flex flex-col items-center gap-3 text-center">
              <i className="fa-solid fa-trophy text-gray-700 text-2xl"></i>
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-wider">Você ainda não está em nenhuma liga</p>
              <button
                onClick={() => onNavigate('ranking')}
                className="px-4 py-1.5 bg-[#3b82f6]/15 border border-[#3b82f6]/30 text-[10px] font-black text-[#3b82f6] uppercase tracking-wider hover:bg-[#3b82f6]/25 transition-all rounded-lg"
              >
                Explorar Ligas
              </button>
            </div>
          ) : (
            <div className="bg-[#0d1117] border border-white/8 rounded-xl overflow-hidden">
              {userLeagues.slice(0, 5).map((league, i) => (
                <div
                  key={league.id}
                  onClick={() => onNavigate('ranking', league.id)}
                  className={`group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors ${i !== Math.min(userLeagues.length, 5) - 1 ? 'border-b border-white/5' : ''}`}
                >
                  {/* Logo */}
                  <div className="w-9 h-9 shrink-0 flex items-center justify-center overflow-hidden">
                    {league.resolvedLogo ? (
                      <img src={league.resolvedLogo} alt={league.name} className="w-full h-full object-contain" />
                    ) : (
                      <i className={`fa-solid ${league.isVerified ? 'fa-trophy' : 'fa-users'} text-base text-gray-500`}></i>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 w-0">
                    <div className="flex items-center gap-1">
                      <span className="block text-[12px] font-bold text-gray-300 group-hover:text-white uppercase tracking-tight truncate">{league.name}</span>
                      {league.isVerified && <i className="fa-solid fa-certificate text-[#3b82f6] text-[8px] shrink-0"></i>}
                    </div>
                    {league.memberCount && (
                      <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider">{league.memberCount} membros</span>
                    )}
                  </div>

                  {/* Pontos — só desktop */}
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">Pts</p>
                    <p className="font-orbitron font-black text-sm text-white">{formatPoints(userTeam.currentRoundPoints ?? userTeam.totalPoints)}</p>
                  </div>
                  <i className="fa-solid fa-chevron-right text-[9px] text-gray-700 group-hover:text-[#3b82f6] group-hover:translate-x-1 transition-all shrink-0"></i>
                </div>
              ))}
              {userLeagues.length > 5 && (
                <button
                  onClick={() => onNavigate('ranking')}
                  className="w-full py-2.5 text-[10px] font-black text-gray-600 uppercase tracking-wider hover:text-[#3b82f6] transition-colors border-t border-white/5"
                >
                  Ver todas as {userLeagues.length} ligas
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* COLUNA PRINCIPAL */}
      <div className="lg:col-span-8 space-y-8">
        <section>
          <div className="flex items-center gap-4 mb-5">
            <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] whitespace-nowrap">MEDIA HUB</h2>
            <div className="h-px flex-1 bg-white/8"></div>
          </div>

          <a
            href={`https://www.youtube.com/watch?v=${MEDIA_HUB_CONFIG.videoId}`}
            target="_blank"
            className="group block bg-[#0d1117] border border-white/8 rounded-xl overflow-hidden hover:border-[#3b82f6]/40 transition-all duration-300 shadow-[0_2px_20px_rgba(0,0,0,0.4)]"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden">
              <img
                src={videoThumbnail}
                className="w-full h-full object-cover opacity-70 group-hover:opacity-50 group-hover:scale-105 transition-all duration-500"
                alt="Video Thumbnail"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent" />

              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-[#3b82f6]/90 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.5)] group-hover:scale-110 transition-transform duration-300">
                  <i className="fa-solid fa-play text-white text-lg ml-1"></i>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex items-center gap-3 px-4 py-4 border-t border-white/5">
              <div className="w-11 h-11 rounded-full overflow-hidden border border-white/10 shrink-0 bg-black">
                <img
                  src={MEDIA_HUB_CONFIG.channelIcon}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                  alt="Channel Logo"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-[#3b82f6] uppercase tracking-widest flex items-center gap-1.5 mb-1">
                  <i className="fa-brands fa-youtube text-xs"></i>
                  {MEDIA_HUB_CONFIG.channelName}
                </p>
                <h3 className="text-[15px] font-bold text-white uppercase tracking-tight truncate leading-none">
                  {MEDIA_HUB_CONFIG.videoTitle}
                </h3>
              </div>
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-gray-600 group-hover:text-white transition-colors shrink-0"></i>
            </div>
          </a>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-5">
            <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] whitespace-nowrap">MAIS ESCALADOS</h2>
            <div className="h-px flex-1 bg-white/8"></div>
          </div>

          {/* Filtro de roles */}
          <div className="grid grid-cols-3 sm:flex gap-2 mb-4">
            {Object.entries(roleMetadata).map(([key, data]) => (
              <button
                key={key}
                onClick={() => setPickedFilter(key as any)}
                className={`flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all border ${
                  pickedFilter === key
                    ? 'bg-[#3b82f6]/15 border-[#3b82f6]/50 text-white'
                    : 'bg-white/[0.03] border-white/8 text-gray-500 hover:text-gray-300 hover:border-white/20'
                }`}
              >
                <img src={data.icon} className={`w-3.5 h-3.5 shrink-0 ${pickedFilter === key ? 'brightness-150' : 'brightness-50 opacity-60'}`} alt="" />
                <span className="truncate">{data.label}</span>
              </button>
            ))}
          </div>

          {/* Tabela */}
          <div className="bg-[#0d1117] border border-white/8 rounded-xl overflow-hidden">
            {trending.map((p, i) => (
              <div
                key={p.id}
                className={`group flex items-center gap-3 px-3 sm:px-5 py-3 sm:py-3.5 hover:bg-white/[0.03] transition-colors cursor-pointer ${i !== trending.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                {/* Posição */}
                <span className={`w-5 text-center font-orbitron font-black text-sm shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-600' : 'text-gray-700'}`}>
                  {i + 1}
                </span>

                {/* Avatar */}
                <div className="w-10 h-12 sm:w-12 sm:h-14 shrink-0 overflow-hidden -mb-1 flex items-end">
                  <PlayerImage player={p} className="w-full h-full object-contain object-bottom" />
                </div>

                {/* Nome e picks */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-orbitron font-black text-[11px] sm:text-sm text-white uppercase leading-none truncate mb-0.5">{p.name}</h4>
                  <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider">{p.pickCount}× escalado</p>
                </div>

                {/* Média */}
                <div className="text-right shrink-0">
                  <span className="text-[8px] sm:text-[9px] font-bold text-gray-600 uppercase tracking-wider block mb-0.5">Média</span>
                  <span className="text-sm sm:text-base font-orbitron font-black text-[#3b82f6]">{p.avgPoints.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
