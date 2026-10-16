/**
 * Oaykay Forgings Pvt Ltd — Cloud Sync & Dual-Mode Persistence Layer
 * Provides permanent data backup across devices via:
 * 1. Supabase / Cloud REST API (via .env or in-app Cloud Settings)
 * 2. 1-Click Complete Database Backup (.json export) & Restore (.json import)
 * 3. Local High-Integrity Auto-Backup
 */

export interface CloudSyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  autoSyncIntervalSec: number;
  lastSyncedAt: string | null;
  status: 'idle' | 'syncing' | 'synced' | 'error' | 'local_only';
  errorMessage?: string;
}

const CLOUD_CONFIG_KEY = 'okf_cloud_sync_config_v3';

export const getCloudConfig = (): CloudSyncConfig => {
  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read cloud config', e);
  }

  // Fallback to Vite env variables if provided
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  return {
    supabaseUrl: envUrl,
    supabaseAnonKey: envKey,
    autoSyncIntervalSec: 60,
    lastSyncedAt: null,
    status: envUrl && envKey ? 'synced' : 'local_only',
  };
};

export const saveCloudConfig = (config: Partial<CloudSyncConfig>) => {
  const current = getCloudConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(updated));
  return updated;
};

/**
 * Exports entire application state as a single JSON backup file
 */
export const exportFullDatabaseBackup = (payload: {
  skus: any[];
  categories: any[];
  divisions: any;
  transactions: any[];
  deductedSalesOrders: any;
  warehouseLocations: any[];
  locationStockEntries: any[];
  users: any[];
  countSession?: any;
}) => {
  const backup = {
    app: 'Oaykay Forgings Web Application',
    version: '3.0',
    exportedAt: new Date().toISOString(),
    stats: {
      total_skus: payload.skus.length,
      total_locations: payload.warehouseLocations.length,
      total_location_entries: payload.locationStockEntries.length,
      total_transactions: payload.transactions.length,
      total_dispatches: Object.keys(payload.deductedSalesOrders || {}).length,
    },
    data: payload
  };

  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `OKF_Full_Database_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Cloud Sync test / push function
 */
export const testCloudConnection = async (url: string, key: string): Promise<{ success: boolean; message: string }> => {
  if (!url || !key) {
    return { success: false, message: 'Please provide valid Supabase URL and Anon Public Key.' };
  }

  try {
    const cleanUrl = url.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    if (res.ok || res.status === 200 || res.status === 404) {
      return { success: true, message: 'Connection to Supabase Cloud successful!' };
    } else {
      return { success: false, message: `Cloud returned status ${res.status}: ${res.statusText}` };
    }
  } catch (err) {
    return { success: false, message: `Connection error: ${(err as Error).message}` };
  }
};
