import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  Edit3, 
  Layers,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { CategoryGroup, DivisionCode } from '../types/inventory';

export const AuditView: React.FC = () => {
  const { 
    categories, 
    skus, 
    stats, 
    divisions, 
    setUpdateWriteOffModalCategory,
    setDrillDown,
    setActiveModule,
    exportCatalogToExcel
  } = useInventoryStore();

  const [auditFilter, setAuditFilter] = useState<'ALL' | 'AUDITED' | 'PENDING'>('ALL');
  const [divFilter, setDivFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredCategories = categories.filter(c => {
    if (divFilter !== 'ALL' && c.division !== divFilter) return false;
    if (auditFilter === 'AUDITED' && !c.last_write_off_date) return false;
    if (auditFilter === 'PENDING' && c.last_write_off_date) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.group_id.toLowerCase().includes(q) ||
        c.main_category.toLowerCase().includes(q) ||
        c.sub_category.toLowerCase().includes(q) ||
        (c.last_write_off_date && c.last_write_off_date.includes(q)) ||
        (c.original_write_off_header && c.original_write_off_header.toLowerCase().includes(q))
      );
    }

    return true;
  });

  const pendingCount = stats.total_skus - stats.total_audited_skus;
  const auditCoveragePct = Math.round((stats.total_audited_skus / stats.total_skus) * 100);

  const handleInspectGroup = (cat: CategoryGroup) => {
    setActiveModule('stock-master');
    setDrillDown({
      level: 4,
      segment: 'Domestic',
      division: cat.division,
      mainCategory: cat.main_category,
      subCategory: cat.sub_category,
      productGroup: cat.product_group
    });
  };

  return (
    <div className="space-y-6 p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                Physical Verification & Audit
              </span>
              <span className="text-xs text-slate-500 font-mono">Tally Write-Off Header Inheritance</span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              Write-Off & Physical Audit Coverage
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Audit status parsed from 2-Row Tally headers (`Last W/off DD.MM.YY`). All 1,421 SKUs inherit exact verification timestamps.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportCatalogToExcel}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Export Audit Excel</span>
            </button>
          </div>
        </div>

        {/* Audit Metrics */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <span className="text-[11px] font-bold uppercase text-slate-400">Overall Coverage</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-black text-indigo-600 dark:text-indigo-400">
                {auditCoveragePct}%
              </span>
              <span className="text-xs text-slate-500 font-medium font-mono">
                {stats.total_audited_skus} / {stats.total_skus}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-600" style={{ width: `${auditCoveragePct}%` }} />
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <span className="text-[11px] font-bold uppercase text-slate-400">Audited SKUs</span>
            <div className="mt-1 font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {stats.total_audited_skus}
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Valid Write-Off Date</span>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <span className="text-[11px] font-bold uppercase text-slate-400">Pending Verification</span>
            <div className="mt-1 font-mono text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {pendingCount}
            </div>
            <span className="text-[11px] text-slate-500 font-medium">No Date in Raw Tally</span>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <span className="text-[11px] font-bold uppercase text-slate-400">Leaf Groups Audited</span>
            <div className="mt-1 font-mono text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {categories.filter(c => c.last_write_off_date).length} / {categories.length}
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Product Groups Verified</span>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={() => setAuditFilter('ALL')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                auditFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All {categories.length} Groups
            </button>
            <button
              onClick={() => setAuditFilter('AUDITED')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                auditFilter === 'AUDITED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Audited ({categories.filter(c => c.last_write_off_date).length})
            </button>
            <button
              onClick={() => setAuditFilter('PENDING')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                auditFilter === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Pending ({categories.filter(c => !c.last_write_off_date).length})
            </button>
          </div>

          {/* Division Filter */}
          <select
            value={divFilter}
            onChange={(e) => setDivFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="ALL">All Divisions</option>
            <option value="DIM">DIM (Import)</option>
            <option value="DIN">DIN (In-House)</option>
            <option value="DTR">DTR (Trading)</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search group ID, category, date..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Categories Audit Checklist Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/60">
                <th className="py-3 px-4 w-24">Group ID</th>
                <th className="py-3 px-4 w-20">Division</th>
                <th className="py-3 px-4 min-w-[220px]">Category & Sub-Group</th>
                <th className="py-3 px-4 w-24 text-center">SKU Count</th>
                <th className="py-3 px-4 w-32">Last W/Off Date</th>
                <th className="py-3 px-4 min-w-[240px]">Original Header Source</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
                <th className="py-3 px-4 w-28 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No categories match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredCategories.map(cat => {
                  const isAudited = Boolean(cat.last_write_off_date);

                  return (
                    <tr 
                      key={cat.group_id}
                      className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      {/* Group ID */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {cat.group_id}
                      </td>

                      {/* Division */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold font-mono ${
                          cat.division === 'DIM' ? 'bg-indigo-50 text-indigo-700' : cat.division === 'DIN' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                        }`}>
                          {cat.division}
                        </span>
                      </td>

                      {/* Category & Sub-Group */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {cat.main_category}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {cat.sub_category} {cat.product_group && cat.product_group !== cat.sub_category && `• ${cat.product_group}`}
                        </div>
                      </td>

                      {/* Mapped SKU Count */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 dark:text-white">
                        {cat.sku_count}
                      </td>

                      {/* Last W/Off Date */}
                      <td className="py-3 px-4 font-mono">
                        {cat.last_write_off_date ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
                            <Calendar className="h-3 w-3" />
                            <span>{cat.last_write_off_date}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not Recorded</span>
                        )}
                      </td>

                      {/* Original Header Source */}
                      <td className="py-3 px-4 text-[11px] text-slate-500 truncate max-w-xs font-mono" title={cat.original_write_off_header || ''}>
                        {cat.original_write_off_header || '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isAudited
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isAudited ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                          <span>{isAudited ? 'Audited' : 'Pending'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setUpdateWriteOffModalCategory(cat)}
                            className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            title="Update Write-Off Date"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleInspectGroup(cat)}
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            title="View SKUs in Stock Master"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
