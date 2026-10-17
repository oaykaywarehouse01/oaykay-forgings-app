import React, { useState, useMemo } from 'react';
import { 
  ArrowLeftRight, 
  Search, 
  Plus, 
  Minus, 
  CheckCircle2, 
  History, 
  ArrowDownLeft, 
  ArrowUpRight,
  Boxes,
  MapPin, 
  FileSpreadsheet,
  Download,
  Filter,
  FileText,
  PackagePlus,
  ShieldAlert,
  Calendar,
  Trash2
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { SkuItem, TransactionType, DivisionCode, Transaction } from '../types/inventory';
import { normalizeLocationCode, isMockLocationCode } from '../lib/locationUtils';
import * as XLSX from 'xlsx';

export const StockEntryView: React.FC = () => {
  const { 
    skus, 
    transactions, 
    warehouseLocations,
    currentUser,
    recordTransaction, 
    deleteTransaction,
    clearTransactions,
    searchEngine,
    setAddNewSkuModalOpen,
    setSelectedSku 
  } = useInventoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSku, setActiveSku] = useState<SkuItem | null>(skus[0] || null);
  const [txnType, setTxnType] = useState<TransactionType>('STOCK_IN');
  const [quantityInput, setQuantityInput] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>(warehouseLocations[0]?.code || 'A1');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [operator, setOperator] = useState<string>(currentUser?.name || 'Staff');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Logs Table Filters
  const [logTypeFilter, setLogTypeFilter] = useState<'ALL' | 'INWARD' | 'OUTWARD' | 'AUDIT'>('ALL');
  const [logDivisionFilter, setLogDivisionFilter] = useState<DivisionCode | 'ALL'>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  // Search results for picking active SKU
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return skus.slice(0, 15);
    return searchEngine.search(searchQuery, { limit: 15 }).map(r => r.item);
  }, [searchQuery, skus, searchEngine]);

  const handleSelect = (item: SkuItem) => {
    setActiveSku(item);
    if (item.location_bin) {
      const firstLoc = item.location_bin.split(',')[0]?.trim().replace(/\s*\(.*\)/, '');
      if (firstLoc) setSelectedLocation(firstLoc);
    }
  };

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSku) return;

    const qty = parseInt(quantityInput, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid positive whole-integer quantity.');
      return;
    }

    recordTransaction(
      activeSku.id,
      txnType,
      qty,
      txnType === 'STOCK_IN' 
        ? `Inward Receipt: ${referenceNo || 'General'}` 
        : `Dispatch Outward: ${referenceNo || 'General'}`,
      operator || currentUser?.name || 'Staff',
      notes,
      selectedLocation ? normalizeLocationCode(selectedLocation) : undefined,
      referenceNo
    );

    setSuccessToast(`Recorded ${txnType === 'STOCK_IN' ? '+' : '-'}${qty} ${activeSku.unit} for "${activeSku.clean_name}" (${activeSku.sku_code})`);
    setTimeout(() => setSuccessToast(null), 4000);

    // Refresh active SKU from updated skus
    const updated = skus.find(s => s.id === activeSku.id);
    if (updated) setActiveSku(updated);
  };

  // Filtered transaction logs
  const filteredLogs = useMemo(() => {
    return transactions.filter(txn => {
      // Type filter
      if (logTypeFilter === 'INWARD' && txn.type !== 'STOCK_IN') return false;
      if (logTypeFilter === 'OUTWARD' && txn.type !== 'STOCK_OUT') return false;
      if (logTypeFilter === 'AUDIT' && txn.type !== 'AUDIT_ADJUSTMENT' && txn.type !== 'LOCATION_RECONCILIATION' && txn.type !== 'WRITE_OFF_SYNC') return false;

      // Division filter
      if (logDivisionFilter !== 'ALL' && txn.division && txn.division !== logDivisionFilter) return false;

      // Search query
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        const matchesSku = txn.sku_name.toLowerCase().includes(q) || txn.sku_code.toLowerCase().includes(q);
        const matchesNote = (txn.notes || '').toLowerCase().includes(q) || txn.reason.toLowerCase().includes(q);
        const matchesRef = (txn.referenceNo || '').toLowerCase().includes(q);
        const matchesOp = txn.performed_by.toLowerCase().includes(q);
        if (!matchesSku && !matchesNote && !matchesRef && !matchesOp) return false;
      }

      return true;
    });
  }, [transactions, logTypeFilter, logDivisionFilter, logSearchQuery]);

  // Export filtered logs to Excel
  const handleExportLogsExcel = () => {
    const rows = filteredLogs.map(l => ({
      'Date & Time': new Date(l.timestamp).toLocaleString('en-GB'),
      'Transaction Type': l.type,
      'SKU Code': l.sku_code,
      'Item Name': l.sku_name,
      'Division': l.division || 'N/A',
      'Category': l.main_category || 'N/A',
      'Quantity': l.quantity,
      'Previous Stock': l.prev_stock,
      'New Stock': l.new_stock,
      'Storage Location': l.location && !isMockLocationCode(l.location) ? l.location : 'N/A',
      'Reference / Bill No': l.referenceNo || 'N/A',
      'Inward Notes': l.notes || l.reason,
      'Operator': l.performed_by
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inward Outward Logs');
    XLSX.writeFile(wb, `OKF_Inward_Outward_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-orange-600 uppercase tracking-wider">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Smooth Point-of-Receipt & Dispatch Logging</span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
            Smooth Inward (Stock IN) & Material Movement
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Log inward deliveries with heat-treatment batch notes, storage locations, and reference bills.
          </p>
        </div>

        <button
          onClick={() => setAddNewSkuModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition self-start sm:self-auto"
        >
          <PackagePlus className="h-4 w-4" />
          <span>+ Add Brand-New SKU</span>
        </button>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-300 p-4 text-xs font-bold text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Two-Column Grid: Left Item Selector + Right Inward Action Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Instant Multi-Token SKU Search & Selector (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col h-[650px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              1. Select Target SKU
            </span>
            <button
              onClick={() => setAddNewSkuModalOpen(true)}
              className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              <span>+ New SKU</span>
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search part name, dimension, or SKU code..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {searchResults.map((item) => {
              const isSelected = activeSku?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`rounded-xl p-3 text-left transition cursor-pointer border ${
                    isSelected
                      ? 'bg-orange-50 border-orange-400 shadow-2xs dark:bg-orange-950/40 dark:border-orange-800'
                      : 'border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {item.sku_code}
                    </span>
                    <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                      {item.current_stock.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                    </span>
                  </div>

                  <h4 className="mt-1 text-xs font-bold text-slate-900 dark:text-white truncate">
                    {item.clean_name}
                  </h4>

                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="truncate max-w-[170px]">{item.sub_category}</span>
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      {item.location_bin || <span className="font-normal text-slate-400 italic">—</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active SKU Details & Inward Movement Form (7 cols) */}
        <div className="lg:col-span-7">
          {activeSku ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              {/* Selected SKU Division & Category Banner */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-mono font-black ${
                      activeSku.division === 'DIM'
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200'
                        : activeSku.division === 'DIN'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                    }`}>
                      {activeSku.division}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {activeSku.sku_code}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Row #{activeSku.excel_row}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {activeSku.clean_name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeSku.category_path}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Stock</span>
                  <div className="font-mono text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                    {activeSku.current_stock.toLocaleString()}
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{activeSku.unit}</span>
                </div>
              </div>

              {/* Movement Entry Form */}
              <form onSubmit={handlePost} className="mt-5 space-y-4">
                {/* Movement Type Radio Pills */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Movement Type:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'STOCK_IN', label: '+ Stock IN (Receipt / Delivery)', color: 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200' },
                      { id: 'STOCK_OUT', label: '- Stock OUT (Manual Issue / Sample)', color: 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200' },
                    ].map(opt => (
                      <div
                        key={opt.id}
                        onClick={() => setTxnType(opt.id as any)}
                        className={`p-3 rounded-xl border-2 cursor-pointer text-center text-xs font-bold transition select-none ${
                          txnType === opt.id 
                            ? `${opt.color} shadow-2xs` 
                            : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900'
                        }`}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quantity & Location Picker */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Direct Typeable Quantity ({activeSku.unit}):
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-lg font-black text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Storage Location (Rack / Pallet / Bin):
                    </label>
                    <select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-xs font-bold text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    >
                      {warehouseLocations.map(l => (
                        <option key={l.code} value={l.code}>{l.code} ({l.description})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Reference No & Operator */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Reference / Bill / Batch No.:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Purchase Bill #402 or Heat Batch #18"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Operator / Received By:
                    </label>
                    <input
                      type="text"
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-medium"
                    />
                  </div>
                </div>

                {/* Dedicated Multi-Line Notes Textarea */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Dedicated Inward Notes / Remarks:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Received 500 pcs from heat-treatment unit, checked by Ramesh, packed in 10 gunny bags"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full rounded-xl bg-orange-600 py-3 text-xs font-black text-white shadow-xs hover:bg-orange-700 active:scale-98 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Post {txnType === 'STOCK_IN' ? '+ Stock IN Receipt' : '- Stock OUT'} & Update Master</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
              Select a part on the left to record material inward.
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* FULL INWARD & OUTWARD AUDIT LOG TABLE (WITH FILTERS & EXCEL EXPORT)   */}
      {/* ===================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <History className="h-4 w-4 text-orange-600" />
              <span>Complete Inward & Outward Transaction Audit Log ({filteredLogs.length} Records)</span>
            </h3>
            <p className="text-xs text-slate-500">Real-time ledger with inward remarks, bill references, and location traces.</p>
          </div>

          <div className="flex items-center gap-2">
            {transactions.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to clear all transaction audit logs? This cannot be undone.')) {
                    clearTransactions();
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-300 transition"
                title="Wipe transaction logs"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                <span>Clear All Logs</span>
              </button>
            )}

            <button
              onClick={handleExportLogsExcel}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 transition"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export Inward Logs (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Movement Type Pills */}
          <div className="flex items-center gap-1">
            {[
              { id: 'ALL', label: 'All Logs' },
              { id: 'INWARD', label: '+ Stock IN' },
              { id: 'OUTWARD', label: '- Stock OUT' },
              { id: 'AUDIT', label: 'Audit / Sync' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setLogTypeFilter(f.id as any)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  logTypeFilter === f.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Division Filter */}
          <select
            value={logDivisionFilter}
            onChange={(e) => setLogDivisionFilter(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold dark:bg-slate-800 dark:border-slate-700"
          >
            <option value="ALL">All Divisions (DIM • DIN • DTR)</option>
            <option value="DIM">DIM (Domestic Import)</option>
            <option value="DIN">DIN (In-House Forged)</option>
            <option value="DTR">DTR (Domestic Trading)</option>
          </select>

          {/* Search Field */}
          <div className="sm:col-span-2 relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Item / SKU / Notes / Operator / Reference..."
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-800 sticky top-0">
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-2 text-center">Type</th>
                <th className="py-2.5 px-3">SKU & Item Name</th>
                <th className="py-2.5 px-2 text-center">Division</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3 text-right">Prev ➔ New Stock</th>
                <th className="py-2.5 px-3 text-center">Location</th>
                <th className="py-2.5 px-4">Inward Notes / Reference</th>
                <th className="py-2.5 px-3">Operator</th>
                <th className="py-2.5 px-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {filteredLogs.map(txn => {
                const isPositive = txn.type === 'STOCK_IN';
                return (
                  <tr key={txn.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(txn.timestamp).toLocaleString('en-GB')}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-block rounded px-1.5 py-0.2 text-[10px] font-black uppercase ${
                        isPositive 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {txn.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <div className="font-bold text-slate-900 dark:text-white truncate max-w-[220px]">
                        {txn.sku_name}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{txn.sku_code}</span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className="rounded px-1 text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {txn.division || '—'}
                      </span>
                    </td>
                    <td className={`py-2 px-3 text-right font-black text-xs ${
                      isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {isPositive ? '+' : '-'}{txn.quantity.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500 text-[11px]">
                      {txn.prev_stock} → <strong>{txn.new_stock}</strong>
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-orange-600 dark:text-orange-400">
                      {txn.location || '—'}
                    </td>
                    <td className="py-2 px-4 font-sans text-slate-700 dark:text-slate-300 text-xs">
                      {txn.notes ? (
                        <div>
                          <span className="font-bold">{txn.notes}</span>
                          {txn.referenceNo && <span className="text-slate-400 block text-[10px]">Ref: {txn.referenceNo}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-500">{txn.reason}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-500 font-sans text-[11px] truncate max-w-[120px]">
                      {txn.performed_by}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => {
                          if (confirm(`Delete this log entry for ${txn.sku_name} (${txn.sku_code})?`)) {
                            deleteTransaction(txn.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 transition"
                        title="Delete this record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
