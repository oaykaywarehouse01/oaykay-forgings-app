import React, { useState } from 'react';
import { 
  AlertTriangle, 
  TrendingDown, 
  Search, 
  Filter, 
  Boxes, 
  FileSpreadsheet,
  CheckCircle2,
  PackageX,
  PlusCircle
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { SkuItem } from '../types/inventory';

export const LowStockView: React.FC = () => {
  const { 
    skus, 
    stats, 
    setStockTransactionModalSku, 
    setSelectedSku,
    exportCatalogToExcel 
  } = useInventoryStore();

  const [filterType, setFilterType] = useState<'ALL_ALERTS' | 'ZERO_STOCK' | 'NEGATIVE_STOCK'>('ALL_ALERTS');
  const [divFilter, setDivFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const alertSkus = skus.filter(s => {
    if (s.current_stock > 0) return false;
    if (filterType === 'ZERO_STOCK' && s.current_stock !== 0) return false;
    if (filterType === 'NEGATIVE_STOCK' && s.current_stock >= 0) return false;
    if (divFilter !== 'ALL' && s.division !== divFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.clean_name.toLowerCase().includes(q) ||
        s.sku_code.toLowerCase().includes(q) ||
        s.main_category.toLowerCase().includes(q) ||
        s.size_spec.toLowerCase().includes(q)
      );
    }

    return true;
  });

  return (
    <div className="space-y-6 p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Banner */}
      <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6 shadow-xs dark:border-rose-900/60 dark:bg-rose-950/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-rose-100 dark:border-rose-900/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                Physical Inventory Monitor
              </span>
              <span className="text-xs text-rose-600 font-mono font-medium">Tally Zero & Negative Balances</span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              Zero & Negative Stock Monitoring
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Items with 0 physical quantity on hand (blank in Tally) or negative balances requiring physical stock receipt or reconciliation.
            </p>
          </div>

          <button
            onClick={exportCatalogToExcel}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-white dark:text-slate-900"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Stock Sheet</span>
          </button>
        </div>

        {/* Metrics (Clean Grounded Numbers Only) */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white p-4 shadow-2xs dark:bg-slate-900">
            <span className="text-[11px] font-bold uppercase text-slate-400">Zero Stock Items (Blank in Tally)</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                {stats.total_zero_stock}
              </span>
              <span className="text-xs text-slate-400">SKUs</span>
            </div>
            <span className="text-[10px] text-amber-600 font-medium">Quantity = 0 Units</span>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-2xs dark:bg-slate-900">
            <span className="text-[11px] font-bold uppercase text-slate-400">Negative Stock Items</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                {stats.total_negative_stock}
              </span>
              <span className="text-xs text-slate-400">SKUs</span>
            </div>
            <span className="text-[10px] text-rose-600 font-medium">Over-Dispatched / Pending Receipt</span>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-2xs dark:bg-slate-900">
            <span className="text-[11px] font-bold uppercase text-slate-400">Positive Stock Items</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {stats.total_positive_stock}
              </span>
              <span className="text-xs text-slate-400">SKUs</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-medium">Active Physical Stock On Hand</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={() => setFilterType('ALL_ALERTS')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                filterType === 'ALL_ALERTS'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Alerts ({stats.total_zero_stock + stats.total_negative_stock})
            </button>
            <button
              onClick={() => setFilterType('ZERO_STOCK')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                filterType === 'ZERO_STOCK'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Zero Stock ({stats.total_zero_stock})
            </button>
            <button
              onClick={() => setFilterType('NEGATIVE_STOCK')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                filterType === 'NEGATIVE_STOCK'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Negative Stock ({stats.total_negative_stock})
            </button>
          </div>

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

        <div className="relative min-w-[260px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search zero or negative stock SKU..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Clean Grounded Alerts Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/60">
                <th className="py-3 px-4 w-28">SKU Code</th>
                <th className="py-3 px-4 min-w-[260px]">Part / Item Name</th>
                <th className="py-3 px-4 w-20">Division</th>
                <th className="py-3 px-4 w-32">Main Category</th>
                <th className="py-3 px-4 w-28">Size / Spec</th>
                <th className="py-3 px-4 w-28 text-center">Stock Quantity</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
                <th className="py-3 px-4 w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {alertSkus.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No zero or negative stock items match the selected filter.
                  </td>
                </tr>
              ) : (
                alertSkus.map(item => {
                  return (
                    <tr 
                      key={item.id}
                      className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        <span className="hover:text-orange-600 cursor-pointer" onClick={() => setSelectedSku(item)}>
                          {item.sku_code}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white truncate max-w-sm" title={item.clean_name}>
                          {item.clean_name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Row #{item.excel_row} • {item.original_tally_name}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold font-mono ${
                          item.division === 'DIM' ? 'bg-indigo-50 text-indigo-700' : item.division === 'DIN' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                        }`}>
                          {item.division}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {item.main_category}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {item.size_spec}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`font-mono font-black text-sm px-2.5 py-0.5 rounded ${
                          item.current_stock < 0 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {item.current_stock.toLocaleString()} {item.unit}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.current_stock === 0
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          <span>{item.current_stock === 0 ? 'Zero Stock' : 'Negative Stock'}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setStockTransactionModalSku(item)}
                          className="rounded-lg bg-orange-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-orange-700 active:scale-95"
                        >
                          + Stock In
                        </button>
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
