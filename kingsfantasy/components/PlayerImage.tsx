
import React, { useState, useEffect } from 'react';
import { Player } from '../types';
import { DataService } from '../services/api';

interface PlayerImageProps {
  player: Player;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
}

const PlayerImage: React.FC<PlayerImageProps> = ({ player, className, imgClassName, priority = false }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!priority); // Se priority, não mostra loading

  // Se a URL já for HTTP (como as da Wikia/Riot), usa ela diretamente
  const imageUrl = player.image && player.image.startsWith('http') 
    ? player.image 
    : player.image ? DataService.getStorageUrl('players', player.image) : '';

  const fallbackAvatar = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${player.name}&backgroundColor=0a0a0a&eyes=closed,shade&mouth=smile`;

  useEffect(() => {
    // Para imagens prioritárias, preload mais rápido
    if (priority && imageUrl) {
      const img = new Image();
      img.src = imageUrl;
      img.onload = () => setIsLoading(false);
      img.onerror = () => {
        setHasError(true);
        setIsLoading(false);
      };
    } else {
      setIsLoading(true);
      setHasError(false);
      
      // Se não há imageUrl, usa fallback imediatamente
      if (!imageUrl) {
        setHasError(true);
        setIsLoading(false);
      }
    }
  }, [imageUrl, priority]);

  return (
    <div className={`${className} relative overflow-hidden bg-[#050505] flex items-center justify-center`}>
      {isLoading && imageUrl && !priority && (
        <div className="absolute inset-0 z-10 bg-[#0a0a0a]">
          <div className="w-full h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]"></div>
        </div>
      )}
      
      <img 
        src={hasError || !imageUrl ? fallbackAvatar : imageUrl} 
        className={`${imgClassName || 'w-full h-full object-cover object-top'}
          ${isLoading && imageUrl && !priority ? 'opacity-0 scale-105' : 'opacity-100 scale-100'} 
          ${priority ? '' : 'transition-all duration-700'}
          ${hasError || !imageUrl ? 'p-4 opacity-50 grayscale' : ''}`}
        alt={player.name}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
      />
      
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
};

export default PlayerImage;
