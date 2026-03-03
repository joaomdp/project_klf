
import React, { useState, useEffect } from 'react';

interface TeamLogoProps {
  logoUrl: string;
  teamName: string;
  className?: string;
}

const TeamLogo: React.FC<TeamLogoProps> = ({ logoUrl, teamName, className = "w-5 h-5" }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [logoUrl]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Fallback padrão se o logo falhar
  const defaultLogo = "https://raw.githubusercontent.com/joaomdp/kingsfantasy/main/times/logo.png";

  return (
    <div className={`${className} flex items-center justify-center relative overflow-hidden bg-black/10 rounded-lg`}>
      <img 
        src={hasError ? defaultLogo : logoUrl} 
        alt={teamName}
        className={`relative z-10 max-w-[95%] max-h-[95%] object-contain transition-all duration-500 brightness-110 contrast-110 ${hasError ? 'opacity-30 grayscale' : 'drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]'}`}
        onError={() => setHasError(true)}
        referrerPolicy="no-referrer"
      />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] font-black text-[#6366F1]/30">{getInitials(teamName)}</span>
        </div>
      )}
    </div>
  );
};

export default TeamLogo;
