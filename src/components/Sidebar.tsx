import React from 'react';
import { 
  ArrowLeftRight, 
  ClipboardCheck, 
  AlertTriangle, 
  FileSpreadsheet, 
  Boxes, 
  CheckCircle2, 
  TrendingDown, 
  Layers, 
  Truck, 
  MapPin, 
  ShieldCheck, 
  LogOut,
  BarChart3,
  X
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { ActiveNavModule, DivisionCode } from '../types/inventory';
import { isModuleAllowedForRole } from '../lib/userPermissions';

export const Sidebar: React.FC = () => {
  const { 
    isSidebarOpen, 
    setSidebarOpen, 
    activeModule, 
    setActiveModule, 
    stats, 
    divisions, 
    drillDown, 
    setDrillDown, 
    navigateToLevel, 
    locationStockEntries, 
    currentUser, 
    logout, 
    setUserManagementModalOpen 
  } = useInventoryStore();

  const navItems: Array<{
    id: ActiveNavModule;
    label: string;
    icon: React.ElementType;
    badge?: string | number;
    badgeColor?: string;
  }> = [
    {
      id: 'stock-master',
      label: 'Stock Master',
      icon: Boxes,
      badge: stats.total_skus,
      badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
    },
    {
      id: 'sales-dispatch',
      label: 'SO & Dispatch (Packing/Labels)',
      icon: Truck,
      badge: 'SO ➔ Labels',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold',
    },
    {
      id: 'location-stock',
      label: 'Location Stock (Racks/Bins)',
      icon: MapPin,
      badge: locationStockEntries.length > 0 ? `${locationStockEntries.length} logged` : 'A1-G3/Bins',
      badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold',
    },
    {
      id: 'stock-entry',
      label: 'Stock In / Out Entry',
      icon: ArrowLeftRight,
    },
    {
      id: 'reports-hub',
      label: 'Reports & Analytics Hub',
      icon: BarChart3,
      badge: '7 Reports',
      badgeColor: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200 font-bold',
    },
    {
      id: 'write-off-audit',
      label: 'Write-Off & Audit',
      icon: ClipboardCheck,
      badge: `${Math.round((stats.total_audited_skus / stats.total_skus) * 100)}%`,
      badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
    },
    {
      id: 'stock-alerts',
      label: 'Zero & Negative Stock',
      icon: AlertTriangle,
      badge: stats.total_zero_stock + stats.total_negative_stock,
      badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    },
    {
      id: 'tally-sync',
      label: 'Tally Excel Sync',
      icon: FileSpreadsheet,
    },
  ];

  const handleNavClick = (id: ActiveNavModule) => {
    setActiveModule(id);
    if (id === 'stock-master' && drillDown.level === 1) {
      navigateToLevel(1);
    }
    // Auto-close on mobile screens
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleDivisionClick = (div: DivisionCode) => {
    setActiveModule('stock-master');
    setDrillDown({
      level: 3,
      segment: 'Domestic',
      division: div,
      mainCategory: null,
      subCategory: null,
      productGroup: null
    });
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay (Click outside to close drawer on phones) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden animate-in fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Sidebar: Off-canvas drawer on mobile (< md), standard collapsible on desktop (>= md) */}
      <aside 
        className={`fixed md:relative inset-y-0 left-0 z-50 md:z-auto flex h-full flex-col bg-white select-none transition-all duration-300 ease-in-out dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl md:shadow-none ${
          // Mobile classes
          isSidebarOpen ? 'translate-x-0 w-72 max-w-[85vw]' : '-translate-x-full md:translate-x-0'
        } ${
          // Desktop classes
          isSidebarOpen ? 'md:w-64 md:opacity-100 md:shrink-0' : 'md:w-0 md:border-none md:opacity-0 md:pointer-events-none md:overflow-hidden md:shrink-0'
        }`}
      >
        {/* Brand Header with Close/Collapse Button */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-white shadow-sm font-black text-lg tracking-wider shrink-0">
              OK
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
                OAYKAY FORGINGS
              </span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider dark:text-slate-400 truncate">
                Warehouse WMS v3.0
              </span>
            </div>
          </div>

          {/* Close button (X on mobile, — on desktop) */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition font-bold shrink-0 ml-1 cursor-pointer"
            title="Close menu"
          >
            <span className="md:hidden"><X className="h-4 w-4" /></span>
            <span className="hidden md:inline text-lg leading-none">—</span>
          </button>
        </div>

        {/* Main Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {currentUser?.role === 'count_staff' ? 'Assigned Module' : 'Navigation Modules'}
            </div>
            <nav className="space-y-1">
              {navItems
                .filter((item) => currentUser ? isModuleAllowedForRole(item.id, currentUser.role) : true)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-orange-50 text-orange-950 font-bold dark:bg-orange-950/50 dark:text-orange-200 shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums shrink-0 ${item.badgeColor || 'bg-slate-100 text-slate-600'}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </nav>
          </div>

          {/* Divisions Quick Drill-Down (Only for Admin, Dispatch, Inward) */}
          {currentUser?.role !== 'count_staff' && (
            <div>
              <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                <span>Domestic Divisions</span>
                <span className="font-mono text-[9px] text-slate-400">3 DVS</span>
              </div>
              <div className="space-y-1">
                {(['DIM', 'DIN', 'DTR'] as const).map((divCode) => {
                  const div = divisions[divCode] || { total_skus: 0, total_stock: 0 };
                  const isSelected = activeModule === 'stock-master' && drillDown.division === divCode;

                  return (
                    <button
                      key={divCode}
                      onClick={() => handleDivisionClick(divCode)}
                      className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition cursor-pointer ${
                        isSelected
                          ? 'bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold font-mono ${
                          divCode === 'DIM'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                            : divCode === 'DIN'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {divCode}
                        </span>
                        <span className="truncate text-left text-xs font-medium">
                          {divCode === 'DIM' ? 'Import (DIM)' : divCode === 'DIN' ? 'In-House (DIN)' : 'Trading (DTR)'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300 font-bold tabular-nums">
                          {div.total_skus}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audit Coverage Progress Card */}
          {currentUser?.role !== 'count_staff' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                <span>Audit Coverage</span>
                <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {stats.total_audited_skus} / {stats.total_skus}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div 
                  className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${(stats.total_audited_skus / stats.total_skus) * 100}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span>{stats.total_positive_stock} Positive</span>
                </span>
                <span className="flex items-center gap-1 font-mono text-rose-600 dark:text-rose-400">
                  <TrendingDown className="h-3 w-3" />
                  <span>{stats.total_zero_stock} Zero</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Active User with 1-Click Logout */}
        <div className="border-t border-slate-200 p-3 dark:border-slate-800 space-y-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setUserManagementModalOpen(true);
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setSidebarOpen(false);
                }
              }}
              className="flex-1 min-w-0 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-left hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/80 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Click to Switch User / Role"
            >
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs ${currentUser?.avatarColor || 'bg-slate-700'}`}>
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {currentUser?.name || 'Admin'}
                </span>
                <span className="text-[10px] text-slate-400 capitalize truncate">
                  {currentUser?.role === 'admin' ? 'Admin' : currentUser?.role?.replace('_', ' ')}
                </span>
              </div>
            </button>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 text-xs font-bold transition shadow-xs shrink-0 cursor-pointer"
              title="Log Out (Locks screen to Login)"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-subtle-pulse" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Catalog Engine</span>
            </div>
            <span className="font-mono text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 px-1.5 py-0.2 rounded border border-orange-200 dark:border-orange-900">
              v3.0 QTY
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
