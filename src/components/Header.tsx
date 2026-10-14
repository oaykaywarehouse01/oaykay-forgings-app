import React from 'react';
import { 
  Search, 
  Moon, 
  Sun, 
  HelpCircle, 
  PlusCircle, 
  ChevronRight, 
  Layers, 
  ArrowLeft,
  Boxes,
  Database,
  Truck
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { DivisionCode } from '../types/inventory';

export const Header: React.FC = () => {
  const { 
    isSidebarOpen,
    toggleSidebar,
    drillDown, 
    navigateToLevel, 
    activeModule, 
    setActiveModule,
    activeDivisionFilter, 
    setActiveDivisionFilter, 
    setCommandPaletteOpen,
    setKeyboardShortcutsOpen,
    setStockTransactionModalSku,
    skus,
    isDarkMode,
    toggleDarkMode
  } = useInventoryStore();

  const handleOpenStockIn = () => {
    // Open modal with first SKU or let user pick in modal
    setStockTransactionModalSku(skus[0]);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 lg:px-6 backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-slate-900/95 gap-3">
      {/* Left: 3-Lines/1-Line Toggle + Breadcrumbs/Back */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* 3-Lines (☰) & 1-Line (—) Sidebar Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-800 hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-orange-600 font-black text-xl shrink-0"
          title={isSidebarOpen ? "Collapse Modules (—)" : "Show Modules Menu (☰)"}
          aria-label="Toggle Navigation Modules"
        >
          {isSidebarOpen ? '—' : '☰'}
        </button>

        {activeModule === 'stock-master' && drillDown.level > 1 && (
          <button
            onClick={() => navigateToLevel((drillDown.level - 1) as 1 | 2 | 3)}
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shrink-0"
            title="Go up one level (Backspace)"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-orange-600" />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        {/* Interactive Breadcrumbs */}
        <nav className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
          <button
            onClick={() => {
              setActiveModule('stock-master');
              navigateToLevel(1);
            }}
            className="flex items-center gap-1 rounded px-1.5 py-1 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 font-semibold"
          >
            <Boxes className="h-3.5 w-3.5 text-orange-600" />
            <span>Stock Master</span>
          </button>

          {activeModule === 'stock-master' ? (
            <>
              {drillDown.level >= 2 && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  <button
                    onClick={() => navigateToLevel(2)}
                    className="rounded px-1.5 py-1 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    Domestic
                  </button>
                </>
              )}

              {drillDown.level >= 3 && drillDown.division && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  <button
                    onClick={() => navigateToLevel(3)}
                    className={`rounded px-1.5 py-1 font-semibold ${
                      drillDown.division === 'DIM'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : drillDown.division === 'DIN'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {drillDown.division}
                  </button>
                </>
              )}

              {drillDown.level >= 4 && drillDown.mainCategory && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate max-w-[130px] font-semibold text-slate-900 dark:text-slate-100" title={drillDown.mainCategory}>
                    {drillDown.mainCategory}
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="capitalize font-semibold text-slate-900 dark:text-slate-100">
                {activeModule.replace(/-/g, ' ')}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Center: ONE GIANT SEARCH BAR */}
      <div className="flex-1 max-w-2xl min-w-[220px]">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="group flex h-11 w-full items-center justify-between rounded-xl border-2 border-slate-200 bg-slate-50/80 px-4 text-slate-600 shadow-xs transition hover:border-orange-500 hover:bg-white dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:border-orange-500"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Search className="h-4 w-4 text-orange-500 group-hover:scale-110 transition-transform shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
              Search any item (e.g. 19mm ring spanner, allen key, 4 inch blade)...
            </span>
          </div>
          <kbd className="hidden md:inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 shadow-2xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 shrink-0">
            <span>⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Right: Division Filter + Stock Movement + Dark Mode */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Division Filter Badges (Quick Filter) */}
        <div className="hidden lg:flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
          {(['ALL', 'DIM', 'DIN', 'DTR'] as const).map(div => {
            const isSelected = activeDivisionFilter === div;
            let activeClass = 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white';
            if (isSelected) {
              if (div === 'DIM') activeClass = 'bg-indigo-600 text-white shadow-xs';
              else if (div === 'DIN') activeClass = 'bg-emerald-600 text-white shadow-xs';
              else if (div === 'DTR') activeClass = 'bg-amber-600 text-white shadow-xs';
            }

            return (
              <button
                key={div}
                onClick={() => setActiveDivisionFilter(div)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  isSelected 
                    ? activeClass 
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {div}
              </button>
            );
          })}
        </div>

        {/* SO & Dispatch Quick Access Button */}
        <button
          onClick={() => setActiveModule('sales-dispatch')}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
            activeModule === 'sales-dispatch'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
          }`}
          title="Open Sales Order & Dispatch (SO ➔ Packing List & Box Labels)"
        >
          <Truck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">SO & Dispatch</span>
        </button>

        {/* Quick Stock Movement Button */}
        <button
          onClick={handleOpenStockIn}
          className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700 active:scale-98"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Stock In / Out</span>
        </button>

        {/* Keyboard Shortcuts Trigger */}
        <button
          onClick={() => setKeyboardShortcutsOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Dark / Light Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Toggle light/dark mode"
        >
          {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
        </button>
      </div>
    </header>
  );
};
