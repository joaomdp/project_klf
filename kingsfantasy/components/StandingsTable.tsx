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
    return () => {
      isMounted = false;
    };
  }, []);

  const hasData = standings.length > 0;
  const displayStandings = useMemo(() => standings, [standings]);

  return (
    <section>
      <div className="flex items-center gap-6 mb-6">
        <h2 className="text-[12px] font-black text-gray-500 uppercase tracking-[0.4em]">TABELA - COPA CBLOL</h2>
        <div className="h-px flex-1 bg-white/10"></div>
      </div>

      <div className="border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">
          <span>Equipe</span>
          <div className="flex items-center gap-8">
            <span>V</span>
            <span>D</span>
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {displayStandings.map((entry) => (
            <div
              key={entry.rank}
              className={`relative flex items-center justify-between px-6 py-4 overflow-hidden bg-gradient-to-r ${entry.accent}`}
            >
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_80%_50%,rgba(255,255,255,0.12),transparent_55%)]" />
              <div className="absolute right-6 inset-y-0 w-40 opacity-10">
                <div className="w-full h-full bg-white/10 blur-2xl rounded-full" />
              </div>

              <div className="relative z-10 flex items-center gap-4">
                <span className="text-sm font-black text-white/80 w-6">{entry.rank}</span>
                <div className="w-10 h-10 border border-white/10 bg-black/40 flex items-center justify-center">
                  {entry.logo ? (
                    <TeamLogo logoUrl={entry.logo} teamName={entry.name} className="w-8 h-8" />
                  ) : (
                    <span className="text-xs font-black text-white/70">LOGO</span>
                  )}
                </div>
                <span className="text-sm font-orbitron font-black text-white uppercase tracking-tight">
                  {entry.name}
                </span>
              </div>

              <div className="relative z-10 flex items-center gap-12 text-sm font-black text-white">
                <span>{entry.wins}</span>
                <span className="text-white/60">{entry.losses}</span>
              </div>
            </div>
          ))}
          {!isLoading && !hasData && (
            <div className="px-6 py-6 text-center text-xs font-black uppercase tracking-[0.3em] text-gray-500">
              Tabela indisponível
            </div>
          )}
          {isLoading && (
            <div className="px-6 py-6 text-center text-xs font-black uppercase tracking-[0.3em] text-gray-500">
              Carregando tabela...
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default StandingsTable;
