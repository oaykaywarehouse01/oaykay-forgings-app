import React, { useState } from 'react';
import { X, Calendar, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';

export const UpdateWriteOffModal: React.FC = () => {
  const { 
    updateWriteOffModalCategory, 
    setUpdateWriteOffModalCategory, 
    updateCategoryWriteOffDate 
  } = useInventoryStore();

  const [dateStr, setDateStr] = useState<string>('14-10-2026');
  const [auditNote, setAuditNote] = useState<string>('Physical count reconciliation and write-off verified');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!updateWriteOffModalCategory) return null;

  const handleQuickDate = (d: string) => {
    setDateStr(d);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateStr.trim()) return;

    updateCategoryWriteOffDate(
      updateWriteOffModalCategory.group_id,
      dateStr.trim(),
      auditNote.trim()
    );

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setUpdateWriteOffModalCategory(null);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-indigo-50/60 dark:bg-indigo-950/40">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider font-mono">
                {updateWriteOffModalCategory.group_id} • {updateWriteOffModalCategory.division}
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Update Category Write-Off Date
              </h3>
            </div>
          </div>

          <button
            onClick={() => setUpdateWriteOffModalCategory(null)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {updateWriteOffModalCategory.main_category} &gt; {updateWriteOffModalCategory.sub_category}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Cascades to: <strong className="text-slate-900 dark:text-white font-mono">{updateWriteOffModalCategory.sku_count} SKUs</strong></span>
              <span>Current W/Off: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{updateWriteOffModalCategory.last_write_off_date || 'None'}</strong></span>
            </div>
          </div>

          {/* Date Input */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              New Write-Off / Audit Date (DD-MM-YYYY)
            </label>
            <input
              type="text"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              placeholder="e.g. 14-10-2026 or 25-05-2026"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {/* Quick date pill presets */}
            <div className="mt-2 flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400">Presets:</span>
              <button
                type="button"
                onClick={() => handleQuickDate('14-10-2026')}
                className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              >
                Today (14-10-2026)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate('25-05-2026')}
                className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              >
                25-05-2026
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate('31-07-2026')}
                className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              >
                31-07-2026
              </button>
            </div>
          </div>

          {/* Audit Note */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Audit Note / Sign-off
            </label>
            <textarea
              rows={2}
              value={auditNote}
              onChange={(e) => setAuditNote(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setUpdateWriteOffModalCategory(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 active:scale-98"
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Updated!</span>
                </>
              ) : (
                <span>Cascade to {updateWriteOffModalCategory.sku_count} SKUs</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
