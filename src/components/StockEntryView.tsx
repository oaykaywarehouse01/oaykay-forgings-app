import React, { useState } from 'react';
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
  Barcode
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { SkuItem, TransactionType } from '../types/inventory';

export const StockEntryView: React.FC = () => {
  const { 
    skus, 
    transactions, 
    recordTransaction, 
    searchEngine,
    setSelectedSku 
  } = useInventoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSku, setActiveSku] = useState<SkuItem | null>(skus[0] || null);
  const [txnType, setTxnType] = useState<TransactionType>('STOCK_IN');
  const [quantity, setQuantity] = useState<number>(25);
  const [reason, setReason] = useState<string>('Warehouse Receipt & Inward Inspection');
  const [operator, setOperator] = useState<string>('P. Sharma (Shift In-Charge)');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Search results for picking active SKU
  const searchResults = searchEngine.search(searchQuery, { limit: 12 });

  const handleSelect = (item: SkuItem) => {
    setActiveSku(item);
  };

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSku || quantity <= 0) return;

    recordTransaction(
      activeSku.id,
      txnType,
      quantity,
      reason,
      operator
    );

    setSuccessToast(`Successfully recorded ${txnType} of ${quantity} ${activeSku.unit} for ${activeSku.sku_code}`);
    setTimeout(() => setSuccessToast(null), 3500);

    // Refresh active SKU from updated skus
    const updated = skus.find(s => s.id === activeSku.id);
    if (updated) setActiveSku(updated);
  };

  return (
    <div className="space-y-6 p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 uppercase tracking-wider">
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span>Rapid Shop-Floor & Warehouse Operations</span>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
          Stock In / Out Movement Entry
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Fast point-of-receipt and dispatch logging. Updates catalog inventory balances in real-time with automatic audit trail.
        </p>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200 animate-in fade-in duration-150">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Two-Column Grid: Left Item Selector + Right Action Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: SKU Search & Selector (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col h-[640px]">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Select Target SKU</span>
            <span className="font-mono text-slate-400 font-normal">1,421 SKUs</span>
          </h2>

          <div className="relative mb-3">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search part name, dimension, or SKU code..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {searchResults.map(({ item }) => {
              const isSelected = activeSku?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`rounded-xl p-3 text-left transition cursor-pointer border ${
                    isSelected
                      ? 'bg-orange-50 border-orange-300 dark:bg-orange-950/40 dark:border-orange-800'
                      : 'border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {item.sku_code}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {item.current_stock} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                    </span>
                  </div>

                  <h4 className="mt-1 text-xs font-bold text-slate-900 dark:text-white truncate">
                    {item.clean_name}
                  </h4>

                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="truncate max-w-[180px]">{item.sub_category}</span>
                    <span className="font-mono text-slate-500">{item.location_bin}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active SKU Details & Movement Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {activeSku ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              {/* Selected SKU Banner */}
              <div className="flex items-start justify-between pb-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded px-2 py-0.5 text-xs font-mono font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {activeSku.division}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {activeSku.sku_code}
                    </span>
                    <span className="text-xs text-slate-400">
                      Row #{activeSku.excel_row}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                    {activeSku.clean_name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeSku.category_path}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">On Hand</span>
                  <div className="font-mono text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                    {activeSku.current_stock}
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{activeSku.unit}</span>
                </div>
              </div>

              {/* Movement Entry Form */}
              <form onSubmit={handlePost} className="mt-6 space-y-4">
                {/* Movement Type */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Transaction Movement Type
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'STOCK_IN', label: '+ Stock In (Receipt)', color: 'peer-checked:bg-emerald-600 peer-checked:text-white' },
                      { id: 'STOCK_OUT', label: '- Stock Out (Dispatch)', color: 'peer-checked:bg-rose-600 peer-checked:text-white' },
                      { id: 'AUDIT_ADJUSTMENT', label: 'Physical Reconciliation', color: 'peer-checked:bg-indigo-600 peer-checked:text-white' },
                    ].map(opt => (
                      <label key={opt.id} className="cursor-pointer">
                        <input
                          type="radio"
                          name="entryTxnType"
                          checked={txnType === opt.id}
                          onChange={() => setTxnType(opt.id as TransactionType)}
                          className="peer sr-only"
                        />
                        <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs font-bold text-slate-700 transition peer-checked:border-transparent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${opt.color}`}>
                          {opt.label}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      {txnType === 'AUDIT_ADJUSTMENT' ? 'Physical Stock Count' : 'Quantity to Move'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-base font-black text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Warehouse Location Bin
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-mono font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <MapPin className="h-4 w-4 text-orange-500" />
                      <span>{activeSku.location_bin}</span>
                    </div>
                  </div>
                </div>

                {/* Reason & Documentation */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Movement Reason / Order # / Ref
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {/* Operator Name */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Operator / Shift Supervisor
                  </label>
                  <input
                    type="text"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {/* Post Button */}
                <button
                  type="submit"
                  className="w-full rounded-xl bg-orange-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-orange-700 active:scale-98 transition flex items-center justify-center gap-2"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>Post Transaction & Update Inventory</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
              Select a part on the left to record stock movement.
            </div>
          )}

          {/* Recent Audit Ledger Strip */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              <span>Recent Transaction Logs ({transactions.length})</span>
            </h3>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {transactions.slice(0, 5).map(txn => (
                <div 
                  key={txn.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40 flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{txn.sku_code}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">{txn.reason}</span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-900 dark:text-white truncate">
                      {txn.sku_name}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`font-mono font-bold ${
                      txn.type === 'STOCK_IN' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {txn.type === 'STOCK_IN' ? '+' : '-'}{txn.quantity}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {txn.prev_stock} → {txn.new_stock}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
