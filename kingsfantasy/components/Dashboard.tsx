
import React, { useState, useEffect } from 'react';
import { UserTeam, Role, League } from '../types';
import { MOCK_PLAYERS } from '../constants';
import PlayerImage from './PlayerImage';
import { DataService } from '../services/api';
import jogosSabado from '../assets/images/logo/jogos-sabado.optimized.jpg';
import jogosDomingo from '../assets/images/logo/jogos-domingo.optimized.jpg';
import StandingsTable from './StandingsTable';

interface DashboardProps {
  userTeam: UserTeam;
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

const Dashboard: React.FC<DashboardProps> = ({ userTeam, onNavigate }) => {
  const [pickedFilter, setPickedFilter] = useState<Role | 'TODOS'>('TODOS');
  const [userLeagues, setUserLeagues] = useState<League[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  
  const banners = [
    { image: jogosSabado, label: 'Jogos de Sábado' },
    { image: jogosDomingo, label: 'Jogos de Domingo' }
  ];
  
  // Carrossel automático
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // Muda a cada 5 segundos
    
    return () => clearInterval(interval);
  }, [banners.length]);
  
  useEffect(() => {
    const fetchUserLeagues = async () => {
      console.log('🔍 Dashboard - fetchUserLeagues iniciado');
      console.log('🔍 Dashboard - userTeam.userId:', userTeam.userId);
      
      if (userTeam.userId) {
        setLoadingLeagues(true);
        try {
          const leagues = await DataService.getUserLeagues(userTeam.userId);
          console.log('🔍 Dashboard - Ligas retornadas:', leagues);
          setUserLeagues(leagues);
        } catch (error) {
          console.error('❌ Dashboard - Erro ao buscar ligas:', error);
        } finally {
          setLoadingLeagues(false);
        }
      } else {
        console.log('⚠️ Dashboard - userId não disponível');
      }
    };
    
    fetchUserLeagues();
  }, [userTeam.userId]);
  
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

  const PaiCoin = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
    const dims = size === "sm" ? "w-5 h-5" : size === "md" ? "w-8 h-8" : "w-12 h-12";
    return (
      <img 
        src="https://i.imgur.com/4odZyzF.png" 
        className={`${dims} object-contain invert-[0.1] sepia-[1] saturate-[5] hue-rotate-[210deg]`}
        alt="Moeda PAI"
      />
    );
  };

  const formatValue = (val: number) => {
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(1).replace(',', '.');
  };

  const formatPoints = (val: number) => {
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(2);
  };

  const trending = [...MOCK_PLAYERS]
    .filter(p => pickedFilter === 'TODOS' || p.role === pickedFilter)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5)
    .map((p, idx) => ({ ...p, choices: Math.floor(5000 - (idx * 380)) }));

  const videoThumbnail = MEDIA_HUB_CONFIG.customThumbnail || `https://i.ytimg.com/vi/${MEDIA_HUB_CONFIG.videoId}/maxresdefault.jpg`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* COLUNA LATERAL */}
      <div className="lg:col-span-4 space-y-8">
        <section>
          <h2 className="text-[11px] sm:text-[13px] font-black text-gray-500 uppercase tracking-tight mb-4 sm:mb-5 px-1">MEU TIME</h2>
          <div className="glass-card p-4 sm:p-6 border border-white/5 relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-black border border-[#6366F1]/20 flex items-center justify-center shadow-2xl overflow-hidden rounded-full">
                  {userTeam.avatar ? (
                    <img 
                      src={userTeam.avatar}
                      alt={userTeam.userName}
                      className="w-full h-full object-cover scale-110"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<i class="fa-solid fa-crown text-[#6366F1] text-2xl"></i>';
                        }
                      }}
                    />
                  ) : (
                    <i className="fa-solid fa-crown text-[#6366F1] text-2xl"></i>
                  )}
                </div>
                <div>
                  <h3 className="font-orbitron font-black text-lg sm:text-xl text-white leading-tight uppercase tracking-tighter">{userTeam.name}</h3>
                  <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">{userTeam.userName}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-black text-gray-400 tracking-wider uppercase mb-2 px-1">
                    <span>PAITRIMÔNIO ATUAL</span>
                    <div className="flex items-center gap-2">
                       <PaiCoin size="sm" />
                        <span className="text-xl sm:text-xl font-orbitron font-black text-white">{formatValue(userTeam.budget)}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#6366F1] shadow-[0_0_10px_rgba(94,108,255,0.5)]" style={{ width: `${(userTeam.budget / 100) * 100}%` }}></div>
                  </div>
                </div>
                <div className="flex justify-between items-center py-3 sm:py-4 border-y border-white/5">
                  <span className="text-[10px] sm:text-[12px] font-black text-gray-400 uppercase tracking-widest">PONTOS TOTAIS</span>
                  <span className="text-xl sm:text-xl font-orbitron font-black text-white">{userTeam.totalPoints}</span>
                </div>
              </div>

              <div 
                onClick={() => onNavigate('squad')}
                className="mt-8 space-y-4 cursor-pointer group/lineup"
              >
                <div className="flex justify-between items-center px-1">
                  <span className="text-[9px] sm:text-[11px] font-black text-gray-400 uppercase tracking-[0.25em] sm:tracking-[0.3em]">MINHA ESCALAÇÃO</span>
                  <div className="flex items-center gap-2 text-[#6366F1] opacity-0 group-hover/lineup:opacity-100 transition-all">
                     <span className="text-[9px] font-black uppercase tracking-widest">VER TUDO</span>
                     <i className="fa-solid fa-arrow-right text-[10px] group-hover/lineup:translate-x-1 transition-all"></i>
                  </div>
                </div>
                
                {/* GRID DE JOGADORES */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 sm:gap-3">
                  {rolesList.map(role => {
                    const player = userTeam.players[role];
                    const champ = player?.selectedChampion || player?.lastChampion;
                    return (
                      <div key={role} className="flex flex-col gap-2 items-center">
                        <div className={`aspect-square w-full rounded-full border transition-all duration-500 relative scale-[0.78] sm:scale-100 ${player ? 'border-[#6366F1]/60 bg-black shadow-[0_0_25px_rgba(94,108,255,0.15)]' : 'border-white/5 bg-white/[0.02]'}`}>
                          {player ? (
                            <>
                              <div className="w-full h-full p-1 rounded-full overflow-hidden">
                                <PlayerImage player={player} priority className="w-full h-full rounded-full scale-105" />
                              </div>
                              {champ && (
                                <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full border-2 border-black bg-black overflow-hidden shadow-2xl z-20">
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
                        <span className={`text-[7px] sm:text-[10px] font-black text-center uppercase tracking-tighter truncate w-full px-1 ${player ? 'text-[#6366F1]' : 'text-gray-700'}`}>
                          {player ? player.name : roleMetadata[role].label.substring(0,3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <StandingsTable />

        <section>
          <h2 className="text-[13px] font-black text-gray-500 uppercase tracking-tight mb-5 px-1">LIGAS</h2>
          {loadingLeagues ? (
            <div className="glass-card p-6 flex items-center justify-center border border-white/5">
              <div className="flex items-center gap-3 text-gray-500">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span className="text-sm font-bold uppercase tracking-wider">Carregando ligas...</span>
              </div>
            </div>
          ) : userLeagues.length === 0 ? (
            <div className="glass-card p-6 border border-white/5">
              <div className="text-center py-4">
                <i className="fa-solid fa-trophy text-gray-700 text-3xl mb-3"></i>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Você ainda não está em nenhuma liga</p>
                <button 
                  onClick={() => onNavigate('ranking')}
                  className="mt-4 px-4 py-2 bg-[#6366F1]/20 border border-[#6366F1]/30 text-xs font-black text-[#6366F1] uppercase tracking-wider hover:bg-[#6366F1]/30 transition-all"
                >
                  Explorar Ligas
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {userLeagues.slice(0, 5).map(league => (
                <div 
                  key={league.id} 
                  onClick={() => onNavigate('ranking', league.id)} 
                  className="glass-card p-4 flex items-center justify-between cursor-pointer border border-white/5 hover:border-[#6366F1]/40 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-[#6366F1]/10 ${league.isVerified ? 'text-[#6366F1]' : 'text-blue-400'}`}>
                      {league.logoUrl ? (
                        <img src={league.logoUrl} alt={league.name} className="w-7 h-7 object-contain" />
                      ) : (
                        <i className={`fa-solid ${league.isVerified ? 'fa-trophy' : 'fa-users'} text-base`}></i>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-300 group-hover:text-white uppercase tracking-tight">{league.name}</span>
                        {league.isVerified && (
                          <i className="fa-solid fa-badge-check text-[#6366F1] text-xs"></i>
                        )}
                      </div>
                      {league.memberCount && (
                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">{league.memberCount} membros</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest">PONTOS</p>
                      <p className="font-orbitron font-black text-sm text-white">{formatPoints(userTeam.totalPoints)}</p>
                    </div>
                    <i className="fa-solid fa-chevron-right text-[10px] text-gray-700 group-hover:text-white group-hover:translate-x-1 transition-all"></i>
                  </div>
                </div>
              ))}
              {userLeagues.length > 5 && (
                <button 
                  onClick={() => onNavigate('ranking')}
                  className="w-full mt-2 py-3 text-xs font-black text-gray-500 uppercase tracking-wider hover:text-[#6366F1] transition-all"
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
          <div className="flex items-center gap-6 mb-6">
            <h2 className="text-[12px] font-black text-gray-500 uppercase tracking-[0.4em] whitespace-nowrap">PRÓXIMOS JOGOS</h2>
            <div className="h-px flex-1 bg-white/10"></div>
          </div>

          <div className="relative w-full overflow-hidden border border-white/10 bg-black shadow-2xl">
            {/* Carrossel de Banners */}
            <div className="relative">
              {banners.map((banner, index) => (
                <img 
                  key={index}
                  src={banner.image} 
                  alt={banner.label}
                  className={`w-full h-auto object-contain transition-opacity duration-1000 ${
                    index === currentBannerIndex ? 'opacity-100' : 'opacity-0 absolute inset-0'
                  }`}
                />
              ))}
            </div>
            
            {/* Indicadores */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentBannerIndex(index)}
                  className={`transition-all duration-300 ${
                    index === currentBannerIndex 
                      ? 'w-8 h-2 bg-[#6366F1]' 
                      : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                  } rounded-full`}
                  aria-label={`Ver ${banners[index].label}`}
                />
              ))}
            </div>
            
            {/* Botões de Navegação */}
            <button
              onClick={() => setCurrentBannerIndex((prev) => (prev - 1 + banners.length) % banners.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-black/70 hover:border-[#6366F1]/50 transition-all z-10"
              aria-label="Banner anterior"
            >
              <i className="fa-solid fa-chevron-left text-sm"></i>
            </button>
            <button
              onClick={() => setCurrentBannerIndex((prev) => (prev + 1) % banners.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-black/70 hover:border-[#6366F1]/50 transition-all z-10"
              aria-label="Próximo banner"
            >
              <i className="fa-solid fa-chevron-right text-sm"></i>
            </button>
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-6 mb-6">
            <h2 className="text-[12px] font-black text-gray-500 uppercase tracking-[0.4em] whitespace-nowrap">MEDIA HUB</h2>
            <div className="h-px flex-1 bg-white/10"></div>
          </div>

          <a 
            href={`https://www.youtube.com/watch?v=${MEDIA_HUB_CONFIG.videoId}`} 
            target="_blank" 
            className="block relative aspect-video overflow-hidden border border-white/10 group bg-black shadow-2xl transition-all duration-500 hover:border-[#6366F1]/40"
          >
            <img 
              src={videoThumbnail} 
              className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-all duration-700 group-hover:scale-105" 
              alt="Video Thumbnail" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
            
            <div className="absolute inset-0 p-10 flex flex-col justify-end">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 border-2 border-[#6366F1] bg-black p-0.5 shadow-[0_0_40px_rgba(94,108,255,0.4)] overflow-hidden shrink-0 flex items-center justify-center">
                  <img 
                    src={MEDIA_HUB_CONFIG.channelIcon} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain bg-black" 
                    alt="Channel Logo" 
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-black text-[#6366F1] uppercase tracking-[0.3em] mb-2 flex items-center gap-3">
                     <i className="fa-brands fa-youtube text-base"></i>
                     {MEDIA_HUB_CONFIG.channelName}
                  </p>
                  <h3 className="text-3xl md:text-4xl font-orbitron font-black text-white uppercase tracking-tight leading-tight line-clamp-2">
                    {MEDIA_HUB_CONFIG.videoTitle}
                  </h3>
                </div>
              </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="w-24 h-24 rounded-full bg-[#6366F1] flex items-center justify-center text-black text-3xl shadow-[0_0_60px_rgba(94,108,255,0.7)]">
                 <i className="fa-solid fa-play ml-2"></i>
              </div>
            </div>
          </a>
        </section>

        <section>
          <div className="flex items-center gap-6 mb-6">
            <h2 className="text-[12px] font-black text-gray-500 uppercase tracking-[0.4em]">MAIS ESCALADOS</h2>
            <div className="h-px flex-1 bg-white/10"></div>
          </div>
          <div className="bg-black/40 border border-white/5 overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="flex bg-white/5 border-b border-white/5 overflow-x-auto no-scrollbar">
              {Object.entries(roleMetadata).map(([key, data]) => (
                <button key={key} onClick={() => setPickedFilter(key as any)} className={`flex-1 min-w-[140px] py-4 flex items-center justify-center gap-3 border-b-2 transition-all ${pickedFilter === key ? 'border-[#6366F1] bg-white/10 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                  <img src={data.icon} className={`w-5 h-5 ${pickedFilter === key ? 'brightness-150' : 'brightness-50 opacity-50'}`} alt="" />
                  <span className="text-[11px] font-black uppercase tracking-widest">{data.label}</span>
                </button>
              ))}
            </div>
            <div className="divide-y divide-white/5">
              {trending.map((p, i) => (
                <div key={p.id} className="flex items-center p-6 hover:bg-white/[0.02] transition-colors group cursor-pointer">
                  <div className="w-10 text-center text-white font-orbitron font-black text-xl mr-6 opacity-30 group-hover:opacity-100 transition-opacity">{i + 1}</div>
                  <div className="w-16 h-16 bg-black rounded-full border border-white/10 mr-6 group-hover:border-[#6366F1]/50 transition-colors overflow-hidden">
                    <PlayerImage player={p} className="w-full h-full scale-110" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-orbitron font-black text-[#6366F1] text-xl uppercase leading-none mb-2">{p.name}</h4>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest opacity-60">{p.choices.toLocaleString()} CONVOCAÇÕES</p>
                  </div>
                  <div className="text-right mr-4">
                    <span className="text-[10px] font-black text-gray-700 block mb-1">MÉDIA</span>
                    <span className="text-xl font-orbitron font-black text-white">{p.avgPoints.toFixed(1)}</span>
                  </div>
                  <i className="fa-solid fa-chevron-right text-gray-800 mr-2 opacity-0 group-hover:opacity-100 transition-all"></i>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
