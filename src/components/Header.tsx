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
  Truck,
  Plus,
  MapPin,
  Cloud,
  UserCheck,
  LogOut,
  User
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
    toggleDarkMode,
    currentUser,
    logout,
    setAddNewSkuModalOpen,
    setUserManagementModalOpen,
    setCloudSyncModalOpen
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
            <span className="hidden md:inline">Stock Master</span>
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
      <div className="flex-1 max-w-xl min-w-[180px]">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="group flex h-10 w-full items-center justify-between rounded-xl border-2 border-slate-200 bg-slate-50/80 px-3.5 text-slate-600 shadow-xs transition hover:border-orange-500 hover:bg-white dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:border-orange-500"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="h-4 w-4 text-orange-500 group-hover:scale-110 transition-transform shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
              Search any item (e.g. 19mm ring spanner, allen key)...
            </span>
          </div>
          <kbd className="hidden lg:inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 shadow-2xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 shrink-0">
            <span>⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Right: Quick Actions + Modals + User Profile */}
      <div className="flex items-center gap-2 shrink-0">
        {/* + Add New SKU Modal Button */}
        <button
          onClick={() => setAddNewSkuModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-98 transition shrink-0"
          title="Add New SKU / Item with Smart Division & Category Detection"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">+ New SKU</span>
        </button>

        {/* Location Stock Quick Button */}
        <button
          onClick={() => setActiveModule('location-stock')}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition shrink-0 ${
            activeModule === 'location-stock'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
          }`}
          title="Warehouse Location Stock (Steel Racks A1-G3, Pallet Lines H1-P6, Storage Bins)"
        >
          <MapPin className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Locations</span>
        </button>

        {/* SO & Dispatch Quick Access Button */}
        <button
          onClick={() => setActiveModule('sales-dispatch')}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition shrink-0 ${
            activeModule === 'sales-dispatch'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800'
          }`}
          title="Sales Order & Dispatch (SO ➔ Packing List & Box Labels)"
        >
          <Truck className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">SO & Dispatch</span>
        </button>

        {/* Cloud Sync Status Indicator */}
        <button
          onClick={() => setCloudSyncModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shrink-0"
          title="Cloud Database Sync & 1-Click Backup Export/Restore"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Cloud className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden 2xl:inline text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Cloud</span>
        </button>

        {/* User Role & Quick PIN Switch */}
        <button
          onClick={() => setUserManagementModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1 lg:px-2 lg:py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shrink-0"
          title={`Active User: ${currentUser?.name || 'Admin'} (${currentUser?.role}) — Click to Manage Staff Users`}
        >
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-white font-black text-[11px] shadow-xs ${currentUser?.avatarColor || 'bg-slate-700'}`}>
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="hidden lg:flex flex-col text-left leading-tight">
            <span className="font-bold text-[11px] text-slate-900 dark:text-white truncate max-w-[95px]">
              {currentUser?.name || 'User'}
            </span>
            <span className="text-[9px] text-slate-400 uppercase font-semibold">
              {currentUser?.role === 'admin' ? 'Admin' : currentUser?.role?.replace('_', ' ')}
            </span>
          </div>
        </button>

        {/* 1-Click Red Logout Button */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-300 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 transition shrink-0 shadow-2xs"
          title="Sign Out / Lock Workstation"
        >
          <LogOut className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
          <span className="hidden sm:inline font-black">Logout</span>
        </button>

        {/* Keyboard Shortcuts Trigger */}
        <button
          onClick={() => setKeyboardShortcutsOpen(true)}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Dark / Light Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 shrink-0"
          title="Toggle light/dark mode"
        >
          {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
        </button>
      </div>
    </header>
  );
};
