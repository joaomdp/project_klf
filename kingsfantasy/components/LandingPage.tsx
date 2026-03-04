import React from 'react';
import backgroundImage from '../assets/images/backgrounds/skt-back.optimized.jpg';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="fixed inset-0 z-[5000] overflow-y-auto">
      
      {/* Full Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${backgroundImage})`,
        }}
      >
        {/* Gradient Overlay para escurecer */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"></div>
      </div>

      <div className="relative z-10 w-full min-h-full max-w-[1800px] mx-auto flex items-center px-6 sm:px-8 md:px-12 lg:px-16 py-16 sm:py-20">
        
        {/* Left Side - Content */}
        <div className="w-full lg:w-[55%] xl:w-1/2 relative z-20">
          <div className="space-y-6 md:space-y-8 max-w-2xl">
            
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full animate-in fade-in slide-in-from-left duration-700">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Temporada 2026 • ON</span>
            </div>

            {/* Title */}
            <div className="space-y-4 md:space-y-5 animate-in fade-in slide-in-from-left duration-700 delay-100">
              <h1 className="font-orbitron font-black text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-white uppercase tracking-tighter leading-[0.9]">
                FANTASY<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#6366F1] animate-gradient">
                  KINGS<br />LENDAS
                </span>
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-gray-400 font-medium max-w-xl leading-relaxed">
                Monte, ou pelo menos teste montar um time com esses bagres. Dispute ligas, pontue e domine o cenário da Kings.
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 md:gap-8 animate-in fade-in slide-in-from-left duration-700 delay-200">
              <div className="space-y-1">
                <div className="font-orbitron font-black text-3xl md:text-4xl text-white">500+</div>
                <div className="text-xs text-gray-600 uppercase tracking-wider font-bold">Jogadores</div>
              </div>
              <div className="h-10 md:h-12 w-px bg-white/10"></div>
              <div className="space-y-1">
                <div className="font-orbitron font-black text-3xl md:text-4xl text-white">100+</div>
                <div className="text-xs text-gray-600 uppercase tracking-wider font-bold">Ligas Ativas</div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 animate-in fade-in slide-in-from-left duration-700 delay-300">
              <div className="flex items-start gap-3 md:gap-4 p-4 md:p-5 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-xl md:rounded-2xl hover:bg-white/[0.05] hover:border-[#6366F1]/30 transition-all group">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-[#6366F1]/10 flex items-center justify-center shrink-0 group-hover:bg-[#6366F1]/20 transition-all">
                  <i className="fa-solid fa-users text-[#6366F1] text-lg md:text-xl"></i>
                </div>
                <div>
                  <h3 className="font-bold text-sm md:text-base text-white mb-1 uppercase tracking-wide">Escale seu Time</h3>
                  <p className="text-xs md:text-sm text-gray-500 leading-relaxed">Escolha os melhores jogadores da Kings</p>
                </div>
              </div>

              <div className="flex items-start gap-3 md:gap-4 p-4 md:p-5 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-xl md:rounded-2xl hover:bg-white/[0.05] hover:border-purple-600/30 transition-all group">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-purple-600/10 flex items-center justify-center shrink-0 group-hover:bg-purple-600/20 transition-all">
                  <i className="fa-solid fa-trophy text-purple-600 text-lg md:text-xl"></i>
                </div>
                <div>
                  <h3 className="font-bold text-sm md:text-base text-white mb-1 uppercase tracking-wide">Dispute Ligas</h3>
                  <p className="text-xs md:text-sm text-gray-500 leading-relaxed">Crie ligas com seus amigos</p>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-2 animate-in fade-in slide-in-from-left duration-700 delay-400">
              <button
                onClick={onGetStarted}
                className="group relative inline-flex items-center gap-3 px-8 md:px-10 py-4 md:py-5 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-xl md:rounded-2xl font-orbitron font-black text-base md:text-lg uppercase tracking-wider text-white shadow-[0_15px_50px_rgba(99,102,241,0.4)] hover:shadow-[0_20px_70px_rgba(99,102,241,0.6)] hover:scale-105 active:scale-95 transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative z-10">COMEÇAR AGORA</span>
                <i className="fa-solid fa-arrow-right text-base md:text-xl group-hover:translate-x-1 transition-transform relative z-10"></i>
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
