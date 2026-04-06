import React from 'react';
import backgroundImage from '../assets/images/backgrounds/skt-back.optimized.jpg';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="fixed inset-0 z-[5000] overflow-y-auto overflow-x-hidden">
      
      {/* Full Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${backgroundImage})`,
        }}
      >
        {/* Gradient Overlay para escurecer */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40 md:from-black/80 md:via-black/50 md:to-transparent"></div>
      </div>

      <div className="relative z-10 w-full min-h-full max-w-[1800px] mx-auto flex items-center px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-12 sm:py-16 md:py-20">
        
        {/* Left Side - Content */}
        <div className="w-full lg:w-[55%] xl:w-1/2 relative z-20">
          <div className="space-y-4 sm:space-y-6 md:space-y-8 max-w-2xl">
            
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full animate-in fade-in slide-in-from-left duration-700">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Temporada 2026 • ON</span>
            </div>

            {/* Title */}
            <div className="space-y-3 sm:space-y-4 md:space-y-5 animate-in fade-in slide-in-from-left duration-700 delay-100">
              <h1 className="font-orbitron font-black text-4xl xs:text-5xl sm:text-6xl md:text-7xl lg:text-7xl xl:text-8xl text-white uppercase tracking-tighter leading-[0.9] break-words">
                FANTASY<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#6366F1] animate-gradient">
                  KINGS<br />LENDAS
                </span>
              </h1>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-300 md:text-gray-400 font-medium max-w-xl leading-relaxed">
                Monte, ou pelo menos teste montar um time com esses bagres. Dispute ligas, pontue e domine o cenário da Kings.
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 sm:gap-6 md:gap-8 animate-in fade-in slide-in-from-left duration-700 delay-200">
              <div className="space-y-0.5 sm:space-y-1">
                <div className="font-orbitron font-black text-2xl sm:text-3xl md:text-4xl text-white">500+</div>
                <div className="text-[10px] sm:text-xs text-gray-500 sm:text-gray-600 uppercase tracking-wider font-bold">Jogadores</div>
              </div>
              <div className="h-8 sm:h-10 md:h-12 w-px bg-white/10"></div>
              <div className="space-y-0.5 sm:space-y-1">
                <div className="font-orbitron font-black text-2xl sm:text-3xl md:text-4xl text-white">100+</div>
                <div className="text-[10px] sm:text-xs text-gray-500 sm:text-gray-600 uppercase tracking-wider font-bold">Ligas Ativas</div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5 sm:gap-3 md:gap-4 animate-in fade-in slide-in-from-left duration-700 delay-300">
              <div className="flex items-start gap-2.5 sm:gap-3 md:gap-4 p-3 sm:p-4 md:p-5 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-lg sm:rounded-xl md:rounded-2xl hover:bg-white/[0.05] hover:border-[#6366F1]/30 transition-all group">
                <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-[#6366F1]/10 flex items-center justify-center shrink-0 group-hover:bg-[#6366F1]/20 transition-all">
                  <i className="fa-solid fa-users text-[#6366F1] text-base sm:text-lg md:text-xl"></i>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm md:text-base text-white mb-0.5 sm:mb-1 uppercase tracking-wide truncate">Escale seu Time</h3>
                  <p className="text-[11px] sm:text-xs md:text-sm text-gray-500 leading-relaxed">Escolha os melhores jogadores da Kings</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 sm:gap-3 md:gap-4 p-3 sm:p-4 md:p-5 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-lg sm:rounded-xl md:rounded-2xl hover:bg-white/[0.05] hover:border-purple-600/30 transition-all group">
                <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-purple-600/10 flex items-center justify-center shrink-0 group-hover:bg-purple-600/20 transition-all">
                  <i className="fa-solid fa-trophy text-purple-600 text-base sm:text-lg md:text-xl"></i>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm md:text-base text-white mb-0.5 sm:mb-1 uppercase tracking-wide truncate">Dispute Ligas</h3>
                  <p className="text-[11px] sm:text-xs md:text-sm text-gray-500 leading-relaxed">Crie ligas com seus amigos</p>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-1 sm:pt-2 animate-in fade-in slide-in-from-left duration-700 delay-400">
              <button
                onClick={onGetStarted}
                className="group relative inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 md:px-10 py-3.5 sm:py-4 md:py-5 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-lg sm:rounded-xl md:rounded-2xl font-orbitron font-black text-sm sm:text-base md:text-lg uppercase tracking-wider text-white shadow-[0_10px_40px_rgba(99,102,241,0.3)] sm:shadow-[0_15px_50px_rgba(99,102,241,0.4)] hover:shadow-[0_15px_60px_rgba(99,102,241,0.5)] sm:hover:shadow-[0_20px_70px_rgba(99,102,241,0.6)] hover:scale-105 active:scale-95 transition-all overflow-hidden w-full xs:w-auto justify-center"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative z-10">COMEÇAR AGORA</span>
                <i className="fa-solid fa-arrow-right text-sm sm:text-base md:text-xl group-hover:translate-x-1 transition-transform relative z-10"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
