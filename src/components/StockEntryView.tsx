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
  Trash2,
  Database,
  Layers,
  Zap,
  Info,
  Check,
  PackageCheck
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { SkuItem, TransactionType, DivisionCode, Transaction, InwardScope } from '../types/inventory';
import { normalizeLocationCode, isMockLocationCode, getLocationDescription } from '../lib/locationUtils';
import * as XLSX from 'xlsx';

export const StockEntryView: React.FC = () => {
  const { 
    skus, 
    transactions, 
    warehouseLocations,
    locationStockEntries,
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
  const [inwardScope, setInwardScope] = useState<InwardScope>('TOTAL_STOCK_ONLY');
  const [quantityInput, setQuantityInput] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>(warehouseLocations[0]?.code || 'A1');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [useCustomLocation, setUseCustomLocation] = useState<boolean>(false);
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [operator, setOperator] = useState<string>(currentUser?.name || 'Staff');
  const [successToast, setSuccessToast] = useState<{ title: string; subtitle: string } | null>(null);

  // Logs Table Filters
  const [logTypeFilter, setLogTypeFilter] = useState<'ALL' | 'INWARD' | 'OUTWARD' | 'AUDIT'>('ALL');
  const [logScopeFilter, setLogScopeFilter] = useState<'ALL' | 'TOTAL_STOCK_ONLY' | 'LOCATION_ONLY' | 'BOTH'>('ALL');
  const [logDivisionFilter, setLogDivisionFilter] = useState<DivisionCode | 'ALL'>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  // Search results for picking active SKU
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return skus.slice(0, 15);
    return searchEngine.search(searchQuery, { limit: 15 }).map(r => r.item);
  }, [searchQuery, skus, searchEngine]);

  // Current active SKU's location counts & stock calculations
  const activeSkuLocations = useMemo(() => {
    if (!activeSku) return [];
    return locationStockEntries.filter(e => e.skuId === activeSku.id && e.countedQty > 0);
  }, [activeSku, locationStockEntries]);

  const activeSkuLocationTotal = useMemo(() => {
    return activeSkuLocations.reduce((sum, e) => sum + e.countedQty, 0);
  }, [activeSkuLocations]);

  const activeSkuMasterStock = activeSku ? Math.round(activeSku.current_stock) : 0;
  const unlocatedBalance = activeSkuMasterStock - activeSkuLocationTotal;

  // Effective location selected
  const effectiveLocationCode = useCustomLocation 
    ? normalizeLocationCode(customLocation.trim()) 
    : normalizeLocationCode(selectedLocation);

  const existingQtyAtSelectedLoc = useMemo(() => {
    if (!activeSku || !effectiveLocationCode) return 0;
    const entry = locationStockEntries.find(
      e => e.skuId === activeSku.id && e.locationCode === effectiveLocationCode
    );
    return entry ? entry.countedQty : 0;
  }, [activeSku, effectiveLocationCode, locationStockEntries]);

  // Parsed quantity for projection
  const parsedQty = parseInt(quantityInput, 10) || 0;

  // Projections
  const projectedMasterStock = useMemo(() => {
    if (inwardScope === 'LOCATION_ONLY') return activeSkuMasterStock;
    if (txnType === 'STOCK_IN') return activeSkuMasterStock + parsedQty;
    return Math.max(0, activeSkuMasterStock - parsedQty);
  }, [activeSkuMasterStock, parsedQty, txnType, inwardScope]);

  const projectedLocationStock = useMemo(() => {
    if (inwardScope === 'TOTAL_STOCK_ONLY') return activeSkuLocationTotal;
    if (txnType === 'STOCK_IN') return activeSkuLocationTotal + parsedQty;
    return Math.max(0, activeSkuLocationTotal - parsedQty);
  }, [activeSkuLocationTotal, parsedQty, txnType, inwardScope]);

  const projectedSelectedLocQty = useMemo(() => {
    if (inwardScope === 'TOTAL_STOCK_ONLY') return existingQtyAtSelectedLoc;
    if (txnType === 'STOCK_IN') return existingQtyAtSelectedLoc + parsedQty;
    return Math.max(0, existingQtyAtSelectedLoc - parsedQty);
  }, [existingQtyAtSelectedLoc, parsedQty, txnType, inwardScope]);

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

    if (parsedQty <= 0) {
      alert('Please enter a valid positive whole-integer quantity.');
      return;
    }

    if ((inwardScope === 'LOCATION_ONLY' || inwardScope === 'BOTH') && !effectiveLocationCode) {
      alert('Please select or specify a valid warehouse location (Rack / Pallet / Bin).');
      return;
    }

    const targetLoc = (inwardScope === 'LOCATION_ONLY' || inwardScope === 'BOTH')
      ? effectiveLocationCode
      : (effectiveLocationCode ? effectiveLocationCode : undefined);

    recordTransaction(
      activeSku.id,
      txnType,
      parsedQty,
      undefined, // auto-generated descriptive reason
      operator || currentUser?.name || 'Staff',
      notes,
      targetLoc,
      referenceNo,
      inwardScope
    );

    // Toast message based on selected scope
    if (inwardScope === 'TOTAL_STOCK_ONLY') {
      setSuccessToast({
        title: `+${parsedQty} ${activeSku.unit} Added to Total Tally Stock Only`,
        subtitle: `Master Stock is now ${projectedMasterStock.toLocaleString()} ${activeSku.unit}. Physical location count remains ${activeSkuLocationTotal.toLocaleString()} ${activeSku.unit} (No rack mismatch).`
      });
    } else if (inwardScope === 'LOCATION_ONLY') {
      setSuccessToast({
        title: `+${parsedQty} ${activeSku.unit} Counted on Location ${targetLoc} Only`,
        subtitle: `Location ${targetLoc} now has ${projectedSelectedLocQty.toLocaleString()} ${activeSku.unit}. Master Tally Stock remains ${activeSkuMasterStock.toLocaleString()} ${activeSku.unit} (No duplicate count!).`
      });
    } else {
      setSuccessToast({
        title: `+${parsedQty} ${activeSku.unit} Recorded Simultaneously`,
        subtitle: `Master Stock: ${projectedMasterStock.toLocaleString()} ${activeSku.unit} & Location ${targetLoc}: ${projectedSelectedLocQty.toLocaleString()} ${activeSku.unit}.`
      });
    }

    setQuantityInput('');
    setNotes('');
    setReferenceNo('');
    setTimeout(() => setSuccessToast(null), 5500);

    // Refresh active SKU from store
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

      // Scope filter
      if (logScopeFilter !== 'ALL') {
        if (txn.scope !== logScopeFilter) return false;
      }

      // Division filter
      if (logDivisionFilter !== 'ALL' && txn.division && txn.division !== logDivisionFilter) return false;

      // Search query
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        const matchesSku = txn.sku_name.toLowerCase().includes(q) || txn.sku_code.toLowerCase().includes(q);
        const matchesNote = (txn.notes || '').toLowerCase().includes(q) || txn.reason.toLowerCase().includes(q);
        const matchesRef = (txn.referenceNo || '').toLowerCase().includes(q);
        const matchesOp = txn.performed_by.toLowerCase().includes(q);
        const matchesLoc = (txn.location || '').toLowerCase().includes(q);
        if (!matchesSku && !matchesNote && !matchesRef && !matchesOp && !matchesLoc) return false;
      }

      return true;
    });
  }, [transactions, logTypeFilter, logScopeFilter, logDivisionFilter, logSearchQuery]);

  // Export filtered logs to Excel
  const handleExportLogsExcel = () => {
    const rows = filteredLogs.map(l => ({
      'Date & Time': new Date(l.timestamp).toLocaleString('en-GB'),
      'Transaction Type': l.type,
      'Entry Scope': l.scope === 'TOTAL_STOCK_ONLY' 
        ? 'Total Stock Only (Tally Balance)' 
        : l.scope === 'LOCATION_ONLY' 
        ? 'Location Count Only (Rack Mapping)' 
        : 'Simultaneous (Both Total & Location)',
      'SKU Code': l.sku_code,
      'Item Name': l.sku_name,
      'Division': l.division || 'N/A',
      'Category': l.main_category || 'N/A',
      'Quantity': l.quantity,
      'Previous Master Stock': l.prev_stock,
      'New Master Stock': l.new_stock,
      'Storage Location': l.location && !isMockLocationCode(l.location) ? l.location : 'N/A',
      'Reference / Bill No': l.referenceNo || 'N/A',
      'Inward Notes / Reason': l.notes || l.reason,
      'Operator': l.performed_by
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inward Outward Logs');
    XLSX.writeFile(wb, `OKF_Stock_Movement_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-orange-600 uppercase tracking-wider">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Dual-Mode Inward & Stock Operations</span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
            Smooth Inward (Stock IN) & Location Mapping
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Log inward material into <strong>Total Stock (Tally)</strong> without forcing locations, or map <strong>Location Only</strong> without double-counting.
          </p>
        </div>

        <button
          onClick={() => setAddNewSkuModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition self-start sm:self-auto cursor-pointer"
        >
          <PackagePlus className="h-4 w-4" />
          <span>+ Add Brand-New SKU</span>
        </button>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4 text-emerald-950 dark:bg-emerald-950/70 dark:border-emerald-800 dark:text-emerald-200 animate-in fade-in shadow-xs flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-black text-emerald-900 dark:text-emerald-200 text-sm">
              {successToast.title}
            </div>
            <div className="text-emerald-700 dark:text-emerald-300 mt-0.5 font-medium">
              {successToast.subtitle}
            </div>
          </div>
        </div>
      )}

      {/* Main Two-Column Grid: Left Item Selector + Right Dual-Mode Inward Action Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Instant Multi-Token SKU Search & Selector (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col h-[360px] lg:h-[740px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              1. Select Target SKU
            </span>
            <button
              onClick={() => setAddNewSkuModalOpen(true)}
              className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
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
                    <span className="font-bold text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                      {item.location_bin || <span className="font-normal text-slate-400 italic">No rack assigned</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active SKU Details & Dual-Mode Movement Form (7 cols) */}
        <div className="lg:col-span-7">
          {activeSku ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              {/* Selected SKU Division & Category Banner */}
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between">
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
                </div>

                {/* Live Parallel Stock Balance Breakdown Banner */}
                <div className="mt-3 grid grid-cols-3 gap-2.5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {/* Total Master / Tally Stock */}
                  <div className="text-center sm:text-left">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1">
                      <Database className="h-3 w-3" />
                      <span>1. Total Stock (Tally)</span>
                    </span>
                    <div className="mt-0.5 font-mono text-lg sm:text-xl font-black text-slate-900 dark:text-white tabular-nums">
                      {activeSkuMasterStock.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Live Master Balance</span>
                  </div>

                  {/* Physical Location Counted */}
                  <div className="text-center sm:text-left border-x border-slate-200 dark:border-slate-700 px-2 sm:px-3">
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>2. Rack Counted</span>
                    </span>
                    <div className="mt-0.5 font-mono text-lg sm:text-xl font-black text-slate-900 dark:text-white tabular-nums">
                      {activeSkuLocationTotal.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {activeSkuLocations.length > 0 ? `${activeSkuLocations.length} Locations` : 'Not counted yet'}
                    </span>
                  </div>

                  {/* Unlocated / In-Transit Balance */}
                  <div className="text-center sm:text-left">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1">
                      <Boxes className="h-3 w-3" />
                      <span>3. Unassigned / Diff</span>
                    </span>
                    <div className={`mt-0.5 font-mono text-lg sm:text-xl font-black tabular-nums ${
                      unlocatedBalance === 0 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : unlocatedBalance > 0 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {unlocatedBalance.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {unlocatedBalance === 0 ? '✓ 100% Located' : unlocatedBalance > 0 ? 'Pending rack count' : 'Excess on racks'}
                    </span>
                  </div>
                </div>

                {/* Active locations tags */}
                {activeSkuLocations.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400 font-medium text-[10px]">Current Rack Breakdown:</span>
                    {activeSkuLocations.map(loc => (
                      <span key={loc.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-800 dark:bg-purple-950/60 dark:border-purple-800 dark:text-purple-300 font-mono text-[10px] font-bold">
                        <MapPin className="h-2.5 w-2.5 text-purple-600" />
                        <span>{loc.locationCode}: {loc.countedQty.toLocaleString()} {activeSku.unit}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Movement Entry Form */}
              <form onSubmit={handlePost} className="mt-4 space-y-4">
                {/* Step A: Movement Direction (Stock In vs Stock Out) */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Step A: Select Direction:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'STOCK_IN', label: '+ Stock IN (Receipt / Gate Arrival)', color: 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200' },
                      { id: 'STOCK_OUT', label: '- Stock OUT (Manual Issue / Sample / Dispatch)', color: 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200' },
                    ].map(opt => (
                      <div
                        key={opt.id}
                        onClick={() => setTxnType(opt.id as any)}
                        className={`p-2.5 rounded-xl border-2 cursor-pointer text-center text-xs font-bold transition select-none ${
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

                {/* Step B: Inward Target Scope (The Dual-Mode Operation Selector) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-orange-600" />
                      <span>Step B: Choose Operation Target / Scope:</span>
                    </label>
                    <span className="text-[10px] text-slate-400 italic">Prevents stock mismatch</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Option 1: Total Stock Only (Tally Inward) */}
                    <div
                      onClick={() => setInwardScope('TOTAL_STOCK_ONLY')}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition select-none text-left relative flex flex-col justify-between ${
                        inwardScope === 'TOTAL_STOCK_ONLY'
                          ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 dark:bg-indigo-950/60 dark:border-indigo-400 dark:text-indigo-100 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            <span>Tally Inward</span>
                          </span>
                          {inwardScope === 'TOTAL_STOCK_ONLY' && (
                            <span className="rounded-full bg-indigo-600 text-white p-0.5">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <h5 className="mt-1 text-xs font-black">
                          Total Stock Only
                        </h5>
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Updates Master Stock balance. Floor location count is not done yet.
                        </p>
                      </div>
                      <div className="mt-2 text-[9px] font-mono font-bold bg-white dark:bg-slate-800 rounded px-1.5 py-0.5 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                        Ex: 900 + 200 = 1,100 Total
                      </div>
                    </div>

                    {/* Option 2: Location Add Only (Rack Mapping) */}
                    <div
                      onClick={() => setInwardScope('LOCATION_ONLY')}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition select-none text-left relative flex flex-col justify-between ${
                        inwardScope === 'LOCATION_ONLY'
                          ? 'border-purple-600 bg-purple-50/80 text-purple-950 dark:bg-purple-950/60 dark:border-purple-400 dark:text-purple-100 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>Floor Count</span>
                          </span>
                          {inwardScope === 'LOCATION_ONLY' && (
                            <span className="rounded-full bg-purple-600 text-white p-0.5">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <h5 className="mt-1 text-xs font-black">
                          Location Add Only
                        </h5>
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Maps physical count on Rack/Bin. Total Stock remains untouched.
                        </p>
                      </div>
                      <div className="mt-2 text-[9px] font-mono font-bold bg-white dark:bg-slate-800 rounded px-1.5 py-0.5 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
                        Total stays 1,100 (No duplicate!)
                      </div>
                    </div>

                    {/* Option 3: Simultaneous Both */}
                    <div
                      onClick={() => setInwardScope('BOTH')}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition select-none text-left relative flex flex-col justify-between ${
                        inwardScope === 'BOTH'
                          ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 dark:bg-emerald-950/60 dark:border-emerald-400 dark:text-emerald-100 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            <span>Direct Putaway</span>
                          </span>
                          {inwardScope === 'BOTH' && (
                            <span className="rounded-full bg-emerald-600 text-white p-0.5">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <h5 className="mt-1 text-xs font-black">
                          Both Simultaneously
                        </h5>
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Increases Total Stock AND registers count on Rack in one single step.
                        </p>
                      </div>
                      <div className="mt-2 text-[9px] font-mono font-bold bg-white dark:bg-slate-800 rounded px-1.5 py-0.5 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                        +200 Total & +200 on Rack
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step C: Quantity & Storage Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Quantity to {txnType === 'STOCK_IN' ? 'Inward / Add' : 'Issue / Deduct'} ({activeSku.unit}):
                    </label>
                    <input
                      type="number"
                      min={1}
                      placeholder="e.g. 200"
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-lg font-black text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {inwardScope === 'TOTAL_STOCK_ONLY' 
                          ? 'Storage Location (Optional Reference):' 
                          : 'Target Rack / Pallet / Bin (Required):'}
                      </label>
                      <button
                        type="button"
                        onClick={() => setUseCustomLocation(!useCustomLocation)}
                        className="text-[10px] font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
                      >
                        {useCustomLocation ? '← Pick from list' : '+ Type custom code'}
                      </button>
                    </div>

                    {useCustomLocation ? (
                      <input
                        type="text"
                        placeholder="e.g. A3, H2, BIN-12, PALLET-4"
                        value={customLocation}
                        onChange={(e) => setCustomLocation(e.target.value.toUpperCase())}
                        className="w-full rounded-xl border border-orange-400 bg-orange-50/30 px-3 py-2 font-mono text-xs font-black text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-orange-500 dark:text-white"
                      />
                    ) : (
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className={`w-full rounded-xl border px-3 py-2.5 font-mono text-xs font-bold focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white ${
                          inwardScope === 'TOTAL_STOCK_ONLY'
                            ? 'border-slate-200 bg-slate-50 text-slate-600'
                            : 'border-slate-300 bg-white text-slate-900'
                        }`}
                      >
                        {warehouseLocations.map(l => {
                          const existingQtyInLoc = locationStockEntries.find(
                            e => e.skuId === activeSku.id && e.locationCode === l.code
                          )?.countedQty || 0;
                          return (
                            <option key={l.code} value={l.code}>
                              {l.code} ({l.description}){existingQtyInLoc > 0 ? ` • Has ${existingQtyInLoc} ${activeSku.unit}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    )}

                    {inwardScope === 'TOTAL_STOCK_ONLY' && (
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        ℹ️ Physical rack count is skipped. Stock will go directly into Tally total balance.
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Real-Time Stock Impact Preview Card */}
                {parsedQty > 0 && (
                  <div className="rounded-xl border p-3.5 bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 animate-in fade-in">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Info className="h-3 w-3 text-orange-600" />
                        <span>Instant Stock Impact Verification:</span>
                      </span>
                      <span className="text-orange-600 font-bold">
                        {inwardScope === 'TOTAL_STOCK_ONLY' 
                          ? 'Total Stock Only' 
                          : inwardScope === 'LOCATION_ONLY' 
                          ? 'Location Count Only' 
                          : 'Simultaneous Both'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Master Stock Impact */}
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">1. Total Stock (Tally)</span>
                        <div className="font-mono text-sm font-black mt-0.5 text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{activeSkuMasterStock.toLocaleString()}</span>
                          <span className="text-slate-300">→</span>
                          <span className={inwardScope === 'LOCATION_ONLY' ? 'text-slate-500' : 'text-indigo-600 dark:text-indigo-400'}>
                            {projectedMasterStock.toLocaleString()} {activeSku.unit}
                          </span>
                        </div>
                        <span className="text-[9px] font-semibold text-slate-400 block mt-0.5">
                          {inwardScope === 'LOCATION_ONLY' 
                            ? '✓ Unchanged (Safe from duplicate count)' 
                            : `${txnType === 'STOCK_IN' ? '+' : '-'}${parsedQty} ${activeSku.unit} to Master Balance`}
                        </span>
                      </div>

                      {/* Location Stock Impact */}
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          2. Location [{effectiveLocationCode || 'A1'}]
                        </span>
                        <div className="font-mono text-sm font-black mt-0.5 text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{existingQtyAtSelectedLoc.toLocaleString()}</span>
                          <span className="text-slate-300">→</span>
                          <span className={inwardScope === 'TOTAL_STOCK_ONLY' ? 'text-slate-500' : 'text-purple-600 dark:text-purple-400'}>
                            {projectedSelectedLocQty.toLocaleString()} {activeSku.unit}
                          </span>
                        </div>
                        <span className="text-[9px] font-semibold text-slate-400 block mt-0.5">
                          {inwardScope === 'TOTAL_STOCK_ONLY' 
                            ? '✓ Unchanged (Physical count deferred)' 
                            : `${txnType === 'STOCK_IN' ? '+' : '-'}${parsedQty} ${activeSku.unit} stored in ${effectiveLocationCode}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reference No & Operator */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Reference / Bill / Batch No.:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Purchase Bill #402, Tally Voucher #991, Heat #18"
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
                    placeholder="e.g. Received from forge plant, checked by Ramesh, packed in 10 bags..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
                </div>

                {/* Dynamic Submit Button */}
                <button
                  type="submit"
                  className={`w-full rounded-xl py-3 text-xs font-black text-white shadow-xs active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer ${
                    inwardScope === 'TOTAL_STOCK_ONLY'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : inwardScope === 'LOCATION_ONLY'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {inwardScope === 'TOTAL_STOCK_ONLY' && (
                      `Post ${parsedQty ? `+${parsedQty}` : ''} ${activeSku.unit} to Total Tally Stock Only (Stock becomes ${parsedQty ? projectedMasterStock.toLocaleString() : activeSkuMasterStock})`
                    )}
                    {inwardScope === 'LOCATION_ONLY' && (
                      `Post ${parsedQty ? `+${parsedQty}` : ''} ${activeSku.unit} to Location ${effectiveLocationCode} Only (Total Stock stays ${activeSkuMasterStock.toLocaleString()})`
                    )}
                    {inwardScope === 'BOTH' && (
                      `Post ${parsedQty ? `+${parsedQty}` : ''} ${activeSku.unit} to Both Total Stock & Location ${effectiveLocationCode}`
                    )}
                  </span>
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
            <p className="text-xs text-slate-500">Real-time ledger tracking Total Stock Tally movements vs Location Floor counts.</p>
          </div>

          <div className="flex items-center gap-2">
            {transactions.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to clear all transaction audit logs? This cannot be undone.')) {
                    clearTransactions();
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-300 transition cursor-pointer"
                title="Wipe transaction logs"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                <span>Clear All Logs</span>
              </button>
            )}

            <button
              onClick={handleExportLogsExcel}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export Movement Logs (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Movement Type Pills */}
          <div className="sm:col-span-4 flex items-center gap-1 flex-wrap">
            {[
              { id: 'ALL', label: 'All Types' },
              { id: 'INWARD', label: '+ Inward' },
              { id: 'OUTWARD', label: '- Outward' },
              { id: 'AUDIT', label: 'Audit / Sync' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setLogTypeFilter(f.id as any)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                  logTypeFilter === f.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Scope Filter */}
          <div className="sm:col-span-3">
            <select
              value={logScopeFilter}
              onChange={(e) => setLogScopeFilter(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold dark:bg-slate-800 dark:border-slate-700"
            >
              <option value="ALL">All Scopes (Total • Location • Both)</option>
              <option value="TOTAL_STOCK_ONLY">📦 Total Stock Only (Tally)</option>
              <option value="LOCATION_ONLY">📍 Location Only (Floor Count)</option>
              <option value="BOTH">⚡ Simultaneous (Total + Location)</option>
            </select>
          </div>

          {/* Division Filter */}
          <div className="sm:col-span-2">
            <select
              value={logDivisionFilter}
              onChange={(e) => setLogDivisionFilter(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold dark:bg-slate-800 dark:border-slate-700"
            >
              <option value="ALL">All Divisions</option>
              <option value="DIM">DIM</option>
              <option value="DIN">DIN</option>
              <option value="DTR">DTR</option>
            </select>
          </div>

          {/* Search Field */}
          <div className="sm:col-span-3 relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search SKU / Notes / Ref / Operator..."
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
                <th className="py-2.5 px-2 text-center">Scope</th>
                <th className="py-2.5 px-3">SKU & Item Name</th>
                <th className="py-2.5 px-2 text-center">Division</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3 text-right">Prev ➔ New Stock</th>
                <th className="py-2.5 px-3 text-center">Location</th>
                <th className="py-2.5 px-4">Inward Notes / Reason</th>
                <th className="py-2.5 px-3">Operator</th>
                <th className="py-2.5 px-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {filteredLogs.map(txn => {
                const isPositive = txn.type === 'STOCK_IN';
                const isLocOnly = txn.scope === 'LOCATION_ONLY';
                const isTotalOnly = txn.scope === 'TOTAL_STOCK_ONLY';

                return (
                  <tr key={txn.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(txn.timestamp).toLocaleString('en-GB')}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-block rounded px-1.5 py-0.2 text-[10px] font-black uppercase ${
                        isLocOnly
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : isPositive 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {txn.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      {isLocOnly ? (
                        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 font-sans">
                          <MapPin className="h-2.5 w-2.5 text-purple-600" />
                          <span>Location Only</span>
                        </span>
                      ) : isTotalOnly ? (
                        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 font-sans">
                          <Database className="h-2.5 w-2.5 text-indigo-600" />
                          <span>Total Only</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-sans">
                          <Layers className="h-2.5 w-2.5 text-emerald-600" />
                          <span>Both</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <div className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
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
                      isLocOnly
                        ? 'text-purple-600 dark:text-purple-400'
                        : isPositive 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {isLocOnly ? `+${txn.quantity.toLocaleString()}` : (isPositive ? '+' : '-') + txn.quantity.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500 text-[11px]">
                      {isLocOnly ? (
                        <span className="text-slate-400 italic">Total Unchanged ({txn.new_stock})</span>
                      ) : (
                        <span>{txn.prev_stock} → <strong>{txn.new_stock}</strong></span>
                      )}
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
                    <td className="py-2 px-3 text-slate-500 font-sans text-[11px] truncate max-w-[110px]">
                      {txn.performed_by}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => {
                          if (confirm(`Delete this log entry for ${txn.sku_name} (${txn.sku_code})?`)) {
                            deleteTransaction(txn.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
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
