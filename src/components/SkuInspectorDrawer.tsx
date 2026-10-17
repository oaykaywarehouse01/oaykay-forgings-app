import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Tag, 
  Layers, 
  Box, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  MapPin, 
  History,
  Edit2
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { TransactionType } from '../types/inventory';
import { getLocationDescription } from '../lib/locationUtils';

export const SkuInspectorDrawer: React.FC = () => {
  const { 
    selectedSku, 
    setSelectedSku, 
    transactions, 
    recordTransaction, 
    updateSkuWriteOffDate 
  } = useInventoryStore();

  const [adjustQty, setAdjustQty] = useState(10);
  const [adjustReason, setAdjustReason] = useState('Stock Receipt Verification');
  const [isEditingWoff, setIsEditingWoff] = useState(false);
  const [newWoffDate, setNewWoffDate] = useState('');

  if (!selectedSku) return null;

  // Filter transactions for this SKU
  const skuTransactions = transactions.filter(t => t.sku_code === selectedSku.sku_code);

  const handleAdjust = (type: TransactionType) => {
    if (adjustQty <= 0) return;
    recordTransaction(
      selectedSku.id,
      type,
      adjustQty,
      adjustReason,
      'Drawer Inspector'
    );
  };

  const handleSaveWoff = () => {
    if (newWoffDate.trim()) {
      updateSkuWriteOffDate(selectedSku.id, newWoffDate.trim());
      setIsEditingWoff(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="fixed inset-y-0 right-0 max-w-full flex pl-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/40">
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono font-bold ${
                  selectedSku.division === 'DIM'
                    ? 'bg-blue-100 text-blue-700'
                    : selectedSku.division === 'DIN'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {selectedSku.division}
                </span>
                <span className="font-mono text-xs font-bold text-slate-500">
                  {selectedSku.sku_code}
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  Row #{selectedSku.excel_row}
                </span>
              </div>

              <h2 className="mt-2 text-base font-bold text-slate-900 dark:text-white leading-snug">
                {selectedSku.clean_name}
              </h2>
            </div>

            <button
              onClick={() => setSelectedSku(null)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Body (NO VALUATION, NO RATE, NO MIN STOCK) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Inventory Status Card */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Physical Stock Quantity
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`font-mono text-3xl font-black tabular-nums ${
                    selectedSku.current_stock < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'
                  }`}>
                    {selectedSku.current_stock.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">{selectedSku.unit}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${
                    selectedSku.current_stock > 0 ? 'bg-emerald-500' : selectedSku.current_stock === 0 ? 'bg-amber-400' : 'bg-rose-500'
                  }`} />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {selectedSku.status}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Warehouse Location Bin
                </span>
                <div className="mt-1 flex items-center gap-1.5 font-mono text-base font-bold text-slate-800 dark:text-slate-200">
                  <MapPin className="h-4 w-4 text-orange-500 shrink-0" />
                  {selectedSku.location_bin ? (
                    <span className="truncate">{selectedSku.location_bin}</span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400 font-sans italic">Not Assigned (—)</span>
                  )}
                </div>
                {selectedSku.location_bin && (
                  <div className="mt-1 text-xs text-orange-700 dark:text-orange-300 font-sans font-medium">
                    {getLocationDescription(selectedSku.location_bin.split(',')[0]?.trim().replace(/\s*\(.*\)/, ''))}
                  </div>
                )}
                <span className="mt-1.5 block text-[10px] text-slate-400 font-mono">
                  Division: {selectedSku.division}
                </span>
              </div>
            </div>

            {/* Quick Movement & Physical Count Form */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-800/60 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
                <span>Fast Stock Movement</span>
                <span className="text-[10px] font-normal text-slate-400 font-mono">Real-Time Adjustment</span>
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Adjustment Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Movement Reason</label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="Stock Receipt Verification">Stock Receipt (+)</option>
                    <option value="Customer Dispatch">Dispatch (-)</option>
                    <option value="Sample Issue">Sample (-)</option>
                    <option value="Physical Audit Adjustment">Physical Reconciliation</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleAdjust('STOCK_IN')}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-98"
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  <span>+ Add {adjustQty} (Stock In)</span>
                </button>
                <button
                  onClick={() => handleAdjust('STOCK_OUT')}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 active:scale-98"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>- Deduct {adjustQty} (Stock Out)</span>
                </button>
              </div>
            </div>

            {/* Specifications & Categorization Details */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-800/60 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Catalog Specifications & Specs
              </h3>

              <dl className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                <div>
                  <dt className="text-slate-400 text-[11px]">Size / Dimension</dt>
                  <dd className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {selectedSku.size_spec}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 text-[11px]">Material / Tier</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedSku.material_and_tier}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 text-[11px]">Packaging Type</dt>
                  <dd className="text-slate-800 dark:text-slate-200">
                    {selectedSku.pack_type}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 text-[11px]">Unit of Measure</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedSku.unit}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-400 text-[11px]">Category Path</dt>
                  <dd className="font-medium text-slate-700 dark:text-slate-300">
                    {selectedSku.category_path}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-400 text-[11px]">Original Tally Particulars</dt>
                  <dd className="font-mono text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">
                    {selectedSku.original_tally_name}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Write-Off & Physical Audit Metadata */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Write-Off Audit Metadata</span>
                </h3>
                <button
                  onClick={() => {
                    setIsEditingWoff(!isEditingWoff);
                    setNewWoffDate(selectedSku.last_write_off_date || '25-05-2026');
                  }}
                  className="text-[11px] font-semibold text-indigo-700 hover:underline dark:text-indigo-300 flex items-center gap-1"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>{isEditingWoff ? 'Cancel' : 'Edit Date'}</span>
                </button>
              </div>

              {isEditingWoff ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWoffDate}
                    onChange={(e) => setNewWoffDate(e.target.value)}
                    placeholder="DD-MM-YYYY (e.g. 25-05-2026)"
                    className="flex-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-mono dark:bg-slate-900 dark:border-indigo-800"
                  />
                  <button
                    onClick={handleSaveWoff}
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Last Write-Off Date:</span>
                    <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                      {selectedSku.last_write_off_date || 'Pending Audit'}
                    </span>
                  </div>
                  {selectedSku.write_off_source_header && (
                    <div className="text-[11px] text-slate-500">
                      <span className="text-slate-400">Header Source: </span>
                      <span className="italic">{selectedSku.write_off_source_header}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Transaction History Ledger */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-slate-400" />
                <span>Stock Audit Ledger</span>
              </h3>

              {skuTransactions.length === 0 ? (
                <div className="rounded-xl border border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-slate-800">
                  No stock movements recorded yet for this SKU. Use the Fast Stock Movement buttons above to test.
                </div>
              ) : (
                <div className="space-y-2">
                  {skuTransactions.map(txn => (
                    <div 
                      key={txn.id}
                      className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-2xs dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          txn.type === 'STOCK_IN' 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : txn.type === 'STOCK_OUT'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {txn.type}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(txn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <span>{txn.reason}</span>
                        <span className="font-mono">
                          {txn.type === 'STOCK_IN' ? '+' : '-'}{txn.quantity}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>By: {txn.performed_by}</span>
                        <span>{txn.prev_stock} → {txn.new_stock}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
