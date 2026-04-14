import React, { useEffect, useMemo, useState } from 'react';
import TeamLogo from './TeamLogo';
import { DataService } from '../services/api';

type StandingEntry = {
  rank: number;
  name: string;
  wins: number;
  losses: number;
  accent: string;
  logo?: string;
};

const TEAM_ACCENTS: Record<string, string> = {
  LOS: 'from-[#2a1608] via-[#3b1c0b] to-[#120906]',
  'LOS GRANDES': 'from-[#2a1608] via-[#3b1c0b] to-[#120906]',
  'RED KALUNGA': 'from-[#2a0b0b] via-[#3a0d0f] to-[#120607]',
  'FURIA': 'from-[#1a1a1a] via-[#252525] to-[#101010]',
  'LOUD': 'from-[#0b1f0c] via-[#123117] to-[#08150a]',
  'VIVO KEYD STARS': 'from-[#1a0b22] via-[#220f2c] to-[#0f0615]',
  'PAIN GAMING': 'from-[#2a0b0f] via-[#3a1018] to-[#120608]',
  'FLUXO': 'from-[#1b0b1f] via-[#22112b] to-[#0d0610]',
  'LEVIATAN': 'from-[#051a1f] via-[#0a2730] to-[#050f14]'
};

const FALLBACK_ACCENT = 'from-[#0f172a] via-[#0b1220] to-[#060b14]';

const getAccentForTeam = (name: string) => {
  const normalized = name.trim().toUpperCase();
  return TEAM_ACCENTS[normalized] || FALLBACK_ACCENT;
};

const StandingsTable: React.FC = () => {
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadStandings = async () => {
      setIsLoading(true);
      const data = await DataService.getTeamStandings();
      if (!isMounted) return;
      const enriched = data.map((entry) => ({
        ...entry,
        accent: getAccentForTeam(entry.name)
      }));
      setStandings(enriched);
      setIsLoading(false);
    };

    loadStandings();
    return () => { isMounted = false; };
  }, []);

  const hasData = standings.length > 0;
  const displayStandings = useMemo(() => standings, [standings]);

  const total = displayStandings.reduce((sum, e) => sum + e.wins + e.losses, 0) / displayStandings.length || 1;

  return (
    <section>
      <div className="flex items-center gap-4 mb-5">
        <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] whitespace-nowrap">TABELA - KINGS LENDAS</h2>
        <div className="h-px flex-1 bg-white/8"></div>
      </div>

      <div className="rounded-xl overflow-hidden border border-white/8">
        {/* Header */}
        <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/8 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-[0.35em] text-gray-600">Equipe</span>
          <div className="flex items-center gap-6 pr-0">
            <span className="w-5 text-center text-[9px] font-black uppercase tracking-[0.35em] text-gray-600">V</span>
            <span className="w-5 text-center text-[9px] font-black uppercase tracking-[0.35em] text-gray-600">D</span>
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {isLoading && (
            <div className="py-8 text-center text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">
              <i className="fa-solid fa-spinner fa-spin mr-2"></i>Carregando...
            </div>
          )}
          {!isLoading && !hasData && (
            <div className="py-8 text-center text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">
              Tabela indisponível
            </div>
          )}
          {displayStandings.map((entry) => {
            const games = entry.wins + entry.losses;
            const winRate = games > 0 ? (entry.wins / games) * 100 : 0;

            return (
              <div
                key={entry.rank}
                className={`relative flex items-center justify-between px-4 py-3 overflow-hidden bg-gradient-to-r ${entry.accent} hover:brightness-110 transition-all duration-200`}
              >
                {/* Glow direita */}
                <div className="absolute right-0 inset-y-0 w-32 opacity-10 bg-gradient-to-l from-white/20 to-transparent pointer-events-none" />

                <div className="relative z-10 flex items-center gap-3 min-w-0">
                  {/* Rank */}
                  <span className={`text-xs font-black w-5 shrink-0 text-center ${entry.rank === 1 ? 'text-amber-400' : entry.rank === 2 ? 'text-gray-400' : entry.rank === 3 ? 'text-orange-600' : 'text-white/40'}`}>
                    {entry.rank}
                  </span>

                  {/* Logo */}
                  <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                    {entry.logo ? (
                      <TeamLogo logoUrl={entry.logo} teamName={entry.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-white/5 border border-white/10 rounded flex items-center justify-center">
                        <span className="text-[7px] font-black text-white/40">{entry.name.slice(0, 2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Nome */}
                  <span className="text-[15px] font-orbitron font-black text-white uppercase tracking-tight truncate block leading-none min-w-0">
                    {entry.name}
                  </span>
                </div>

                {/* V / D */}
                <div className="relative z-10 flex items-center gap-6 shrink-0">
                  <span className="w-5 text-center text-sm font-black text-white">{entry.wins}</span>
                  <span className="w-5 text-center text-sm font-black text-white/40">{entry.losses}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StandingsTable;
