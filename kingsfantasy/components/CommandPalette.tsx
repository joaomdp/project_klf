import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Page } from '../types';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: string;
  action: () => void;
  category: 'navigation' | 'actions' | 'shortcuts';
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: Page) => void;
  onOpenCreateLeague: () => void;
  onRefreshPlayers: () => void;
  currentPage: Page;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenCreateLeague,
  onRefreshPlayers,
  currentPage
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: Command[] = useMemo(() => [
    // Navegação
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      description: 'Visão geral e estatísticas',
      icon: 'fa-house',
      action: () => { onNavigate('dashboard'); onClose(); },
      category: 'navigation',
      keywords: ['home', 'inicio', 'painel']
    },
    {
      id: 'nav-market',
      label: 'Mercado',
      description: 'Contratar jogadores',
      icon: 'fa-store',
      action: () => { onNavigate('market'); onClose(); },
      category: 'navigation',
      keywords: ['players', 'comprar', 'hire', 'jogadores']
    },
    {
      id: 'nav-squad',
      label: 'Escalação',
      description: 'Gerenciar seu time',
      icon: 'fa-users',
      action: () => { onNavigate('squad'); onClose(); },
      category: 'navigation',
      keywords: ['team', 'lineup', 'time']
    },
    {
      id: 'nav-ranking',
      label: 'Ligas & Ranking',
      description: 'Ver classificações',
      icon: 'fa-trophy',
      action: () => { onNavigate('ranking'); onClose(); },
      category: 'navigation',
      keywords: ['leagues', 'rank', 'competições']
    },
    {
      id: 'nav-aicoach',
      label: 'AI-SOLUT',
      description: 'Assistente de fantasy',
      icon: 'fa-brain',
      action: () => { onNavigate('ai-coach'); onClose(); },
      category: 'navigation',
      keywords: ['ai', 'suggestions', 'help', 'ajuda', 'coach']
    },
    {
      id: 'nav-profile',
      label: 'Perfil',
      description: 'Configurações da conta',
      icon: 'fa-user',
      action: () => { onNavigate('profile'); onClose(); },
      category: 'navigation',
      keywords: ['settings', 'config', 'conta']
    },
    // Ações
    {
      id: 'action-create-league',
      label: 'Criar Liga',
      description: 'Inicie uma nova competição',
      icon: 'fa-plus-circle',
      action: () => { onOpenCreateLeague(); onClose(); },
      category: 'actions',
      keywords: ['new', 'nova', 'league']
    },
    {
      id: 'action-refresh',
      label: 'Atualizar Jogadores',
      description: 'Recarregar dados do mercado',
      icon: 'fa-rotate',
      action: () => { onRefreshPlayers(); onClose(); },
      category: 'actions',
      keywords: ['refresh', 'reload', 'atualizar']
    },
    // Atalhos
    {
      id: 'shortcut-search',
      label: 'Buscar',
      description: 'Abrir busca rápida',
      icon: 'fa-search',
      action: () => {},
      category: 'shortcuts',
      keywords: ['find', 'procurar']
    }
  ], [onNavigate, onClose, onOpenCreateLeague, onRefreshPlayers]);

  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    
    const searchLower = search.toLowerCase();
    return commands.filter(cmd => {
      const labelMatch = cmd.label.toLowerCase().includes(searchLower);
      const descMatch = cmd.description?.toLowerCase().includes(searchLower);
      const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(searchLower));
      
      return labelMatch || descMatch || keywordMatch;
    });
  }, [commands, search]);

  // Reset selected index quando os filtros mudarem
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Auto-focus no input quando abrir
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Navegação por teclado
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        filteredCommands[selectedIndex].action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, filteredCommands, selectedIndex]);

  // Scroll automático para item selecionado
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const categoryIcons: Record<string, { icon: string; color: string }> = {
    navigation: { icon: 'fa-compass', color: 'text-blue-400' },
    actions: { icon: 'fa-bolt', color: 'text-amber-400' },
    shortcuts: { icon: 'fa-keyboard', color: 'text-purple-400' }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-6 sm:pt-[15vh] px-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-[#0B0411]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.8)] overflow-hidden animate-in slide-in-from-top-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header com Search */}
        <div className="relative flex items-center gap-4 px-6 py-5 border-b border-white/5">
          <i className="fa-solid fa-magnifying-glass text-gray-500 text-lg"></i>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Digite para buscar comandos..."
            className="flex-1 bg-transparent text-white text-lg font-medium placeholder-gray-600 outline-none"
          />
          <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-widest">
            <span>ESC</span>
          </div>
        </div>

        {/* Lista de Comandos */}
        <div ref={listRef} className="max-h-[420px] overflow-y-auto py-3">
          {filteredCommands.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <i className="fa-solid fa-search text-4xl text-gray-700 mb-4"></i>
              <p className="text-sm text-gray-500 font-medium">Nenhum comando encontrado</p>
            </div>
          ) : (
            filteredCommands.map((cmd, index) => {
              const catMeta = categoryIcons[cmd.category];
              const isSelected = index === selectedIndex;
              const isCurrentPage = cmd.id.includes(currentPage);
              
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  className={`w-full flex items-center gap-4 px-6 py-4 transition-all duration-150 ${
                    isSelected 
                      ? 'bg-white/10 border-l-2 border-[#6366F1]' 
                      : 'border-l-2 border-transparent hover:bg-white/5'
                  }`}
                >
                  {/* Ícone */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isSelected 
                      ? 'bg-[#6366F1]/20 text-[#6366F1]' 
                      : 'bg-white/5 text-gray-500'
                  }`}>
                    <i className={`fa-solid ${cmd.icon} text-sm`}></i>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold text-sm ${
                        isSelected ? 'text-white' : 'text-gray-300'
                      }`}>
                        {cmd.label}
                      </span>
                      {isCurrentPage && (
                        <span className="text-[9px] font-black text-[#6366F1] uppercase tracking-widest px-2 py-0.5 bg-[#6366F1]/10 rounded">
                          Atual
                        </span>
                      )}
                    </div>
                    {cmd.description && (
                      <p className={`text-xs mt-0.5 ${
                        isSelected ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {cmd.description}
                      </p>
                    )}
                  </div>

                  {/* Categoria Badge */}
                  <div className={`flex items-center gap-1.5 ${catMeta.color} opacity-60`}>
                    <i className={`fa-solid ${catMeta.icon} text-[10px]`}></i>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-6 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-arrow-up"></i>
              <i className="fa-solid fa-arrow-down"></i>
              Navegar
            </span>
            <span className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white/5 rounded">↵</kbd>
              Selecionar
            </span>
          </div>
          <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">
            {filteredCommands.length} {filteredCommands.length === 1 ? 'comando' : 'comandos'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
