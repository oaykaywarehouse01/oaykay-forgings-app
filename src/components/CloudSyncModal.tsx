import React, { useState } from 'react';
import { 
  Cloud, 
  Database, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  HardDrive,
  KeyRound,
  ShieldCheck,
  Server
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { 
  getCloudConfig, 
  saveCloudConfig, 
  testCloudConnection, 
  exportFullDatabaseBackup 
} from '../lib/cloudSync';

export const CloudSyncModal: React.FC = () => {
  const { 
    isCloudSyncModalOpen, 
    setCloudSyncModalOpen,
    skus,
    categories,
    divisions,
    transactions,
    deductedSalesOrders,
    warehouseLocations,
    locationStockEntries,
    countSession,
    users,
    restoreFullDatabase
  } = useInventoryStore();

  const [config, setConfig] = useState(getCloudConfig());
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await testCloudConnection(config.supabaseUrl, config.supabaseAnonKey);
    setTestResult(res);
    setIsTesting(false);
    if (res.success) {
      saveCloudConfig({
        ...config,
        status: 'synced',
        lastSyncedAt: new Date().toISOString()
      });
    }
  };

  const handleSaveConfig = () => {
    saveCloudConfig(config);
    setTestResult({ success: true, message: 'Cloud configuration saved successfully.' });
  };

  // 1-Click JSON export
  const handleExportBackup = () => {
    exportFullDatabaseBackup({
      skus,
      categories,
      divisions,
      transactions,
      deductedSalesOrders,
      warehouseLocations,
      locationStockEntries,
      users,
      countSession
    });
  };

  // 1-Click JSON restore
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(String(event.target?.result));
        const res = restoreFullDatabase(json);
        if (res.success) {
          setRestoreStatus(res.message);
        } else {
          setTestResult({ success: false, message: res.message });
        }
      } catch (err) {
        setTestResult({ success: false, message: `Invalid JSON file: ${(err as Error).message}` });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isCloudSyncModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div 
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-orange-600 uppercase tracking-wider">
              <Cloud className="h-4 w-4" />
              <span>Permanent Cloud Sync & Database Backup</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
              Cloud Database & 1-Click Disaster Recovery
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Dual-mode persistence layer with real-time sync & offline auto-backup.
            </p>
          </div>

          <button
            onClick={() => setCloudSyncModalOpen(false)}
            className="rounded-xl border border-slate-200 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-600 dark:border-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Sync Status Banner */}
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                {config.supabaseUrl ? '☁️ Cloud Synced + Local High-Integrity Store' : '💾 Local + Auto-Backup Ready'}
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
                {skus.length.toLocaleString()} SKUs • {warehouseLocations.length} Locations • {transactions.length} Transactions
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase rounded-md bg-emerald-600 text-white px-2 py-0.5">
            Active
          </span>
        </div>

        {restoreStatus && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-xs font-bold text-indigo-900 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-200">
            <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>{restoreStatus}</span>
          </div>
        )}

        {testResult && (
          <div className={`mt-3 flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
            testResult.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 border border-rose-200 text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200'
          }`}>
            {testResult.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* 1-Click JSON Backup & Restore Actions */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-3">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
            1-Click Full Database Backup & Restore:
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExportBackup}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
              title="Download entire catalog, locations, entries, and dispatch history as .json"
            >
              <Download className="h-4 w-4 text-orange-400" />
              <span>Export Full Backup (.json)</span>
            </button>

            <label className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 cursor-pointer transition">
              <Upload className="h-4 w-4 text-indigo-500" />
              <span>Restore Backup (.json)</span>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        {/* Supabase Cloud Connection Settings */}
        <div className="mt-5 space-y-3">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
            <span>Supabase Cloud Integration:</span>
            <span className="text-[10px] text-slate-400 font-mono">Optional / REST</span>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Supabase Project URL:
            </label>
            <input
              type="text"
              placeholder="https://xyzcompany.supabase.co"
              value={config.supabaseUrl}
              onChange={(e) => setConfig({ ...config, supabaseUrl: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Supabase Anon Public Key:
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={config.supabaseAnonKey}
              onChange={(e) => setConfig({ ...config, supabaseAnonKey: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || !config.supabaseUrl}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>Test Cloud Connection</span>
            </button>

            <button
              onClick={handleSaveConfig}
              className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700"
            >
              Save Cloud Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
