import { useEffect } from 'react';

export interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
  category?: 'navigation' | 'actions' | 'general';
}

/**
 * Hook para gerenciar atalhos de teclado globais
 * Suporta Ctrl/Cmd (Mac), Shift, Alt
 */
export const useKeyboardShortcuts = (shortcuts: ShortcutAction[]) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const ctrlPressed = e.ctrlKey || e.metaKey; // metaKey = Cmd no Mac
        const shiftPressed = e.shiftKey;
        const altPressed = e.altKey;

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrl === ctrlPressed;
        const shiftMatch = !!shortcut.shift === shiftPressed;
        const altMatch = !!shortcut.alt === altPressed;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

/**
 * Formata a key para exibição visual
 * Ex: "Ctrl+K" ou "⌘K" (Mac)
 */
export const formatShortcut = (shortcut: ShortcutAction): string => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts: string[] = [];

  if (shortcut.ctrl) parts.push(isMac ? '⌘' : 'Ctrl');
  if (shortcut.shift) parts.push('⇧');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  parts.push(shortcut.key.toUpperCase());

  return parts.join('+');
};
