
import React, { useState, useEffect } from 'react';
import { Player } from '../types';
import { DataService } from '../services/api';

interface PlayerImageProps {
  player: Player;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  smartFocus?: boolean;
}

const focusCache = new Map<string, string>();

const PlayerImage: React.FC<PlayerImageProps> = ({
  player,
  className,
  imgClassName,
  priority = false,
  smartFocus = false
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!priority); // Se priority, não mostra loading
  const [focusPosition, setFocusPosition] = useState('50% 50%');

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

  useEffect(() => {
    if (!smartFocus || !imageUrl) {
      setFocusPosition('50% 50%');
      return;
    }

    const cached = focusCache.get(imageUrl);
    if (cached) {
      setFocusPosition(cached);
      return;
    }

    let cancelled = false;

    const detectFocus = async () => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Falha ao carregar imagem'));
          img.src = imageUrl;
        });

        const sampleWidth = 220;
        const scale = sampleWidth / img.naturalWidth;
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) throw new Error('Canvas indisponivel');

        ctx.drawImage(img, 0, 0, width, height);
        const pixels = ctx.getImageData(0, 0, width, height).data;

        let minX = width;
        let maxX = 0;
        let minY = height;
        let maxY = 0;
        let found = false;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const alpha = pixels[(y * width + x) * 4 + 3];
            if (alpha > 20) {
              found = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (!found) throw new Error('Sem area opaca detectada');

        const centerX = ((minX + maxX) / 2 / width) * 100;
        const centerY = ((minY + maxY) / 2 / height) * 100;

        const x = Math.max(30, Math.min(70, centerX));
        const y = Math.max(28, Math.min(62, centerY));
        const detected = `${x.toFixed(1)}% ${y.toFixed(1)}%`;

        if (!cancelled) {
          focusCache.set(imageUrl, detected);
          setFocusPosition(detected);
        }
      } catch {
        if (!cancelled) {
          setFocusPosition('50% 50%');
        }
      }
    };

    detectFocus();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, smartFocus]);

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
        style={smartFocus && !hasError && imageUrl ? { objectPosition: focusPosition } : undefined}
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
