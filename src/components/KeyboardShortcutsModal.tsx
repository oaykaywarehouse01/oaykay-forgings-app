import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';

export const KeyboardShortcutsModal: React.FC = () => {
  const { isKeyboardShortcutsOpen, setKeyboardShortcutsOpen } = useInventoryStore();

  if (!isKeyboardShortcutsOpen) return null;

  const shortcuts = [
    { key: '⌘ + K / Ctrl + K', description: 'Open instant multi-token search & command palette' },
    { key: '?', description: 'Toggle this keyboard shortcuts cheat-sheet' },
    { key: 'Esc', description: 'Close any active modal, search palette, or inspector drawer' },
    { key: '↑ / ↓', description: 'Navigate search results up and down in command palette' },
    { key: 'Enter', description: 'Inspect selected SKU details and audit ledger' },
    { key: '+ / -', description: 'Inline quick stock increment / decrement on table rows' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-orange-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Keyboard Shortcuts
            </h3>
          </div>
          <button
            onClick={() => setKeyboardShortcutsOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1">
              <span className="text-slate-600 dark:text-slate-400 font-medium">{s.description}</span>
              <kbd className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400">
          Industrial high-velocity keyboard navigation enabled.
        </div>
      </div>
    </div>
  );
};
