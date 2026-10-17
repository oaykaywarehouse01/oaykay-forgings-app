import React from 'react';
import { 
  Boxes, 
  ArrowLeftRight, 
  MapPin, 
  Truck, 
  BarChart3, 
  Menu
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { ActiveNavModule } from '../types/inventory';
import { isModuleAllowedForRole } from '../lib/userPermissions';

export const MobileBottomNav: React.FC = () => {
  const { 
    activeModule, 
    setActiveModule, 
    isSidebarOpen, 
    setSidebarOpen,
    currentUser,
    stats
  } = useInventoryStore();

  const navButtons: Array<{
    id: ActiveNavModule;
    label: string;
    icon: React.ElementType;
    badge?: number | string;
  }> = [
    {
      id: 'stock-master',
      label: 'Master',
      icon: Boxes,
      badge: stats.total_skus
    },
    {
      id: 'stock-entry',
      label: 'Inward',
      icon: ArrowLeftRight
    },
    {
      id: 'location-stock',
      label: 'Locations',
      icon: MapPin
    },
    {
      id: 'sales-dispatch',
      label: 'Dispatch',
      icon: Truck
    },
    {
      id: 'reports-hub',
      label: 'Reports',
      icon: BarChart3
    }
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-2 backdrop-blur-md md:hidden dark:border-slate-800 dark:bg-slate-900/95 shadow-lg select-none">
      {navButtons
        .filter(btn => currentUser ? isModuleAllowedForRole(btn.id, currentUser.role) : true)
        .map(btn => {
          const Icon = btn.icon;
          const isActive = activeModule === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => {
                setActiveModule(btn.id);
                setSidebarOpen(false);
              }}
              className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-90 ${
                isActive
                  ? 'text-orange-600 dark:text-orange-400 font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
                {btn.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 rounded-full bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200 text-[8px] font-black px-1 leading-tight">
                    {btn.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[55px]">
                {btn.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 h-0.5 w-6 rounded-full bg-orange-600 dark:bg-orange-400" />
              )}
            </button>
          );
        })}

      {/* Menu Drawer Toggle */}
      <button
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        className={`flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-90 ${
          isSidebarOpen
            ? 'text-orange-600 dark:text-orange-400 font-bold'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium'
        }`}
        title="More Modules"
      >
        <Menu className="h-5 w-5 stroke-[1.75]" />
        <span className="text-[10px] mt-0.5 tracking-tight">More</span>
      </button>
    </nav>
  );
};
