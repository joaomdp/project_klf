import React from 'react';
import { formatShortcut, ShortcutAction } from '../hooks/useKeyboardShortcuts';

interface ShortcutsGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutsGuide: React.FC<ShortcutsGuideProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts: ShortcutAction[] = [
    // Navegação
    { key: 'K', ctrl: true, action: () => {}, description: 'Abrir Command Palette', category: 'navigation' },
    { key: '1', ctrl: true, action: () => {}, description: 'Ir para Dashboard', category: 'navigation' },
    { key: '2', ctrl: true, action: () => {}, description: 'Ir para Mercado', category: 'navigation' },
    { key: '3', ctrl: true, action: () => {}, description: 'Ir para Escalação', category: 'navigation' },
    { key: '4', ctrl: true, action: () => {}, description: 'Ir para Ranking', category: 'navigation' },
    { key: '5', ctrl: true, action: () => {}, description: 'Ir para IA Coach', category: 'navigation' },
    { key: '6', ctrl: true, action: () => {}, description: 'Ir para Perfil', category: 'navigation' },
    
    // Ações
    { key: 'R', ctrl: true, shift: true, action: () => {}, description: 'Atualizar jogadores', category: 'actions' },
    { key: 'N', ctrl: true, action: () => {}, description: 'Criar nova liga (no Ranking)', category: 'actions' },
    { key: '/', action: () => {}, description: 'Buscar jogadores (no Mercado)', category: 'actions' },
    
    // Geral
    { key: 'Esc', action: () => {}, description: 'Fechar modal/diálogo', category: 'general' },
    { key: '?', shift: true, action: () => {}, description: 'Mostrar atalhos', category: 'general' },
  ];

  const categories = {
    navigation: { title: 'Navegação', icon: 'fa-compass', color: 'text-blue-400' },
    actions: { title: 'Ações', icon: 'fa-bolt', color: 'text-amber-400' },
    general: { title: 'Geral', icon: 'fa-keyboard', color: 'text-purple-400' }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl bg-[#0F0F14]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.8)] overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-orbitron font-black text-white uppercase tracking-tight">Atalhos de Teclado</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">Aumente sua produtividade com atalhos rápidos</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
          >
            <i className="fa-solid fa-xmark text-gray-500"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          {Object.entries(categories).map(([catKey, catMeta]) => {
            const catShortcuts = shortcuts.filter(s => s.category === catKey);
            
            return (
              <div key={catKey}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${catMeta.color}`}>
                    <i className={`fa-solid ${catMeta.icon} text-sm`}></i>
                  </div>
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">{catMeta.title}</h3>
                </div>
                
                <div className="space-y-2">
                  {catShortcuts.map((shortcut, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/5 transition-all"
                    >
                      <span className="text-sm text-gray-300 font-medium">{shortcut.description}</span>
                      <div className="flex items-center gap-1.5">
                        {formatShortcut(shortcut).split('+').map((key, i, arr) => (
                          <React.Fragment key={i}>
                            <kbd className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-xs font-bold text-white shadow-lg min-w-[2rem] text-center">
                              {key}
                            </kbd>
                            {i < arr.length - 1 && <span className="text-gray-600 text-xs font-bold">+</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span className="font-medium">💡 Dica: Use <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded mx-1">Ctrl+K</kbd> para buscar rapidamente</span>
            <span className="font-bold uppercase tracking-widest">{shortcuts.length} atalhos disponíveis</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsGuide;
