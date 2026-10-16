import { UserRole, ActiveNavModule } from '../types/inventory';

export interface RoleInfo {
  role: UserRole;
  label: string;
  shortLabel: string;
  badgeBg: string;
  badgeText: string;
  description: string;
  defaultModule: ActiveNavModule;
  allowedModules: ActiveNavModule[];
}

export const ROLE_CONFIGS: Record<UserRole, RoleInfo> = {
  admin: {
    role: 'admin',
    label: 'Admin (Full Access)',
    shortLabel: 'Admin',
    badgeBg: 'bg-purple-100 dark:bg-purple-950/80',
    badgeText: 'text-purple-700 dark:text-purple-300',
    description: 'Full system access: edit stock master, manage staff users, location live sync, and all modules.',
    defaultModule: 'stock-master',
    allowedModules: [
      'stock-master',
      'sales-dispatch',
      'location-stock',
      'stock-entry',
      'write-off-audit',
      'stock-alerts',
      'tally-sync'
    ]
  },
  dispatch_manager: {
    role: 'dispatch_manager',
    label: 'Dispatch (SO & Packing Labels)',
    shortLabel: 'Dispatch',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/80',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    description: 'Access to Sales Order Dispatch, Carton Box Builder, Packing List & Labels, and Stock Master (View-only).',
    defaultModule: 'sales-dispatch',
    allowedModules: ['sales-dispatch', 'stock-master']
  },
  inward_storekeeper: {
    role: 'inward_storekeeper',
    label: 'Inward (Stock In Entry)',
    shortLabel: 'Inward',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-950/80',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    description: 'Stock In / Out Entry receipts with notes, audit logs, and Stock Master (View-only).',
    defaultModule: 'stock-entry',
    allowedModules: ['stock-entry', 'stock-master']
  },
  count_staff: {
    role: 'count_staff',
    label: 'Location Counter (Rack/Pallet Count)',
    shortLabel: 'Counter',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/80',
    badgeText: 'text-amber-700 dark:text-amber-300',
    description: 'Dedicated view for physical counting of Steel Racks (A1–G3), Pallets (H1+), and Storage Bins.',
    defaultModule: 'location-stock',
    allowedModules: ['location-stock']
  }
};

export const isModuleAllowedForRole = (moduleId: ActiveNavModule, role: UserRole): boolean => {
  const config = ROLE_CONFIGS[role];
  if (!config) return role === 'admin';
  return config.allowedModules.includes(moduleId);
};

export const getDefaultModuleForRole = (role: UserRole): ActiveNavModule => {
  const config = ROLE_CONFIGS[role];
  return config ? config.defaultModule : 'stock-master';
};
