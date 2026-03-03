/**
 * EXEMPLO: Como usar assets no projeto
 * 
 * Este arquivo mostra diferentes formas de importar e usar imagens/assets
 * no projeto Kings Lendas Fantasy.
 */

// ============================================
// MÉTODO 1: Import Estático (Recomendado)
// ============================================

// Importar uma imagem diretamente
import logo from '../assets/images/logo/logo-full.png';
import favicon from '../assets/images/logo/favicon.png';

function Header() {
  return (
    <div>
      <img src={logo} alt="Kings Lendas Fantasy Logo" />
    </div>
  );
}

// ============================================
// MÉTODO 2: URL Pública (Se assets em /public)
// ============================================

function HeaderPublic() {
  return (
    <img 
      src="/assets/images/logo/logo-full.png" 
      alt="Logo" 
      width={200}
      height={50}
    />
  );
}

// ============================================
// MÉTODO 3: Import Dinâmico
// ============================================

function ChampionImage({ championName }: { championName: string }) {
  const imageSrc = require(`../assets/images/champions/${championName}.jpg`);
  
  return <img src={imageSrc} alt={championName} />;
}

// ============================================
// MÉTODO 4: Lazy Loading (Performance)
// ============================================

import { lazy, Suspense } from 'react';

function OptimizedImage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <img 
        src={logo}
        alt="Logo"
        loading="lazy" // Lazy load nativo do HTML5
      />
    </Suspense>
  );
}

// ============================================
// MÉTODO 5: Background CSS
// ============================================

function HeroSection() {
  return (
    <div 
      style={{
        backgroundImage: `url('../assets/images/backgrounds/hero-bg.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        height: '100vh',
      }}
    >
      {/* Conteúdo */}
    </div>
  );
}

// ============================================
// MÉTODO 6: SVG Inline (Melhor para ícones)
// ============================================

import { ReactComponent as TrophyIcon } from '../assets/images/icons/trophy.svg';

function RankingBadge() {
  return (
    <div>
      <TrophyIcon width={32} height={32} fill="#FFD700" />
    </div>
  );
}

// ============================================
// EXEMPLO REAL: Substituir Sylas atual
// ============================================

// ANTES (usando API externa):
const SylasOld = () => (
  <img 
    src="https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Sylas_0.jpg"
    alt="Sylas"
  />
);

// DEPOIS (usando asset local):
import sylasSplash from '../assets/images/champions/sylas-splash.jpg';

const SylasNew = () => (
  <img 
    src={sylasSplash}
    alt="Sylas"
    className="w-full h-full object-cover object-[60%_35%]"
  />
);

// ============================================
// EXEMPLO REAL: Logo no Header
// ============================================

import logoIcon from '../assets/images/logo/logo-icon.png';

function AppHeader() {
  return (
    <header className="flex items-center gap-3 p-4">
      <img 
        src={logoIcon} 
        alt="KLF Icon" 
        width={48} 
        height={48}
        className="rounded-lg"
      />
      <h1 className="font-orbitron font-black text-xl text-white">
        KINGS <span className="text-indigo-500">LENDAS</span>
      </h1>
    </header>
  );
}

// ============================================
// EXEMPLO REAL: Favicon no index.html
// ============================================

/*
Adicione no arquivo kingsfantasy/index.html dentro do <head>:

<link rel="icon" type="image/png" sizes="32x32" href="/assets/images/logo/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/images/logo/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/images/logo/apple-touch-icon.png">
*/

// ============================================
// EXEMPLO REAL: Múltiplas Resoluções (Responsive)
// ============================================

function ResponsiveImage() {
  return (
    <picture>
      {/* Mobile */}
      <source 
        media="(max-width: 640px)" 
        srcSet="/assets/images/backgrounds/hero-bg-mobile.jpg" 
      />
      
      {/* Tablet */}
      <source 
        media="(max-width: 1024px)" 
        srcSet="/assets/images/backgrounds/hero-bg-tablet.jpg" 
      />
      
      {/* Desktop */}
      <img 
        src="/assets/images/backgrounds/hero-bg-desktop.jpg" 
        alt="Hero Background"
        className="w-full h-full object-cover"
      />
    </picture>
  );
}

// ============================================
// EXEMPLO REAL: WebP com Fallback
// ============================================

function ModernImageFormat() {
  return (
    <picture>
      {/* WebP (navegadores modernos) */}
      <source 
        srcSet="/assets/images/logo/logo-full.webp" 
        type="image/webp" 
      />
      
      {/* PNG fallback (navegadores antigos) */}
      <img 
        src="/assets/images/logo/logo-full.png" 
        alt="Logo"
      />
    </picture>
  );
}

// ============================================
// HELPER: Função para obter URL do asset
// ============================================

export const getAssetUrl = (path: string) => {
  return `/assets/${path}`;
};

// Uso:
// <img src={getAssetUrl('images/logo/logo-full.png')} alt="Logo" />

// ============================================
// HELPER: Preload de imagens críticas
// ============================================

export const preloadImage = (src: string) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// Uso no componente:
/*
useEffect(() => {
  preloadImage('/assets/images/champions/sylas-splash.jpg')
    .then(() => console.log('Imagem pré-carregada!'))
    .catch(err => console.error('Erro ao carregar:', err));
}, []);
*/

export {};
