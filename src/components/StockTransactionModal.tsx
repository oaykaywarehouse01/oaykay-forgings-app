import React, { useState } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, Scale, CheckCircle2, Database, MapPin, Layers } from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { TransactionType, InwardScope } from '../types/inventory';
import { normalizeLocationCode } from '../lib/locationUtils';

export const StockTransactionModal: React.FC = () => {
  const { 
    stockTransactionModalSku, 
    setStockTransactionModalSku, 
    warehouseLocations,
    locationStockEntries,
    recordTransaction 
  } = useInventoryStore();

  const [type, setType] = useState<TransactionType>('STOCK_IN');
  const [scope, setScope] = useState<InwardScope>('TOTAL_STOCK_ONLY');
  const [location, setLocation] = useState<string>(warehouseLocations[0]?.code || 'A1');
  const [quantityInput, setQuantityInput] = useState<string>('50');
  const [reason, setReason] = useState<string>('Production Batch Receipt (Plant 1 Ludhiana)');
  const [operator, setOperator] = useState<string>('Warehouse Lead');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  if (!stockTransactionModalSku) return null;

  const parsedQty = parseInt(quantityInput, 10) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedQty <= 0) return;

    const targetLoc = (scope === 'LOCATION_ONLY' || scope === 'BOTH')
      ? normalizeLocationCode(location)
      : undefined;

    recordTransaction(
      stockTransactionModalSku.id,
      type,
      parsedQty,
      reason,
      operator,
      undefined,
      targetLoc,
      undefined,
      scope
    );

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setStockTransactionModalSku(null);
    }, 600);
  };

  const current = stockTransactionModalSku.current_stock;
  const projectedStock = scope === 'LOCATION_ONLY' 
    ? current 
    : type === 'STOCK_IN' 
    ? current + parsedQty 
    : type === 'STOCK_OUT'
    ? Math.max(0, current - parsedQty)
    : parsedQty;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/60 dark:bg-slate-800/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded px-2 py-0.5 text-xs font-mono font-bold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                {stockTransactionModalSku.division}
              </span>
              <span className="font-mono text-xs text-slate-500 font-bold">
                {stockTransactionModalSku.sku_code}
              </span>
            </div>
            <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-white truncate max-w-sm">
              {stockTransactionModalSku.clean_name}
            </h3>
          </div>

          <button
            onClick={() => setStockTransactionModalSku(null)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Movement Type Radio Chips */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              1. Movement Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'STOCK_IN', label: '+ Stock In', color: 'peer-checked:bg-emerald-600 peer-checked:text-white' },
                { id: 'STOCK_OUT', label: '- Stock Out', color: 'peer-checked:bg-rose-600 peer-checked:text-white' },
                { id: 'AUDIT_ADJUSTMENT', label: 'Physical Audit', color: 'peer-checked:bg-indigo-600 peer-checked:text-white' },
              ].map(opt => (
                <label key={opt.id} className="cursor-pointer">
                  <input
                    type="radio"
                    name="txnType"
                    checked={type === opt.id}
                    onChange={() => setType(opt.id as TransactionType)}
                    className="peer sr-only"
                  />
                  <div className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700 transition peer-checked:border-transparent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${opt.color}`}>
                    {opt.label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Operation Target / Scope */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              2. Operation Scope (Prevents Mismatch)
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: 'TOTAL_STOCK_ONLY', label: 'Total Only', desc: 'Tally Stock', icon: Database, color: 'border-indigo-500 bg-indigo-50/70 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200' },
                { id: 'LOCATION_ONLY', label: 'Location Only', desc: 'Floor Count', icon: MapPin, color: 'border-purple-500 bg-purple-50/70 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200' },
                { id: 'BOTH', label: 'Simultaneous', desc: 'Total + Rack', icon: Layers, color: 'border-emerald-500 bg-emerald-50/70 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200' },
              ].map(opt => {
                const isSel = scope === opt.id;
                const Icon = opt.icon;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setScope(opt.id as InwardScope)}
                    className={`p-2 rounded-xl border-2 cursor-pointer transition select-none text-center ${
                      isSel 
                        ? `${opt.color} font-bold shadow-2xs` 
                        : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 mx-auto mb-0.5 text-slate-600 dark:text-slate-300" />
                    <div className="font-black text-[11px]">{opt.label}</div>
                    <div className="text-[9px] text-slate-400">{opt.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quantity & Stock Impact Preview */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                {type === 'AUDIT_ADJUSTMENT' ? 'Audited Qty' : 'Quantity to Move'} ({stockTransactionModalSku.unit})
              </label>
              <input
                type="number"
                min={1}
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center dark:border-slate-800 dark:bg-slate-800/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                {scope === 'LOCATION_ONLY' ? 'Master Stock (Safe)' : 'Master Stock Impact'}
              </span>
              <div className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white">
                {scope === 'LOCATION_ONLY' ? (
                  <span className="text-purple-600 font-bold">{current} {stockTransactionModalSku.unit} (Unchanged)</span>
                ) : (
                  <>
                    <span className="text-slate-400">{current}</span>
                    <span className="mx-1 text-slate-300">→</span>
                    <span className="text-orange-600 dark:text-orange-400">{projectedStock} {stockTransactionModalSku.unit}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Location Selector (when Location or Both selected) */}
          {(scope === 'LOCATION_ONLY' || scope === 'BOTH') && (
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Target Storage Rack / Bin
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {warehouseLocations.map(l => (
                  <option key={l.code} value={l.code}>{l.code} ({l.description})</option>
                ))}
              </select>
            </div>
          )}

          {/* Reason Code */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Reason / Reference Document
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Invoice #SO-26-8812, Gate receipt, Heat batch #..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Operator Name */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Logged By
            </label>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setStockTransactionModalSku(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 active:scale-98 cursor-pointer"
            >
              {showSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-white" />
                  <span>Recorded!</span>
                </>
              ) : (
                <span>Confirm & Post to Ledger</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
