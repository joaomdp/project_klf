
import React from 'react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-[#0B0411] backdrop-blur-sm">
      <div className="bg-pattern-halftone absolute inset-0 opacity-10"></div>
      <div className="bg-pattern-grid absolute inset-0 opacity-5"></div>
      
      <div className="flex flex-col items-center gap-8 relative z-10">
        <div className="relative">
          {/* Logo com animação suave */}
          <img 
            src="/logo.png" 
            alt="Kings Logo" 
            className="w-32 h-32 object-contain animate-pulse" 
            style={{ 
              filter: 'drop-shadow(0 0 30px rgba(99, 102, 241, 0.5))',
              animationDuration: '2s'
            }}
          />
          
          {/* Círculo de loading ao redor do logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="w-40 h-40 rounded-full border-4 border-transparent border-t-[#6366F1] border-r-[#8B5CF6] animate-spin"
              style={{ animationDuration: '1.5s' }}
            ></div>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#6366F1] animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-[#6366F1] animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-sm font-bold text-white uppercase tracking-widest">Carregando...</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
