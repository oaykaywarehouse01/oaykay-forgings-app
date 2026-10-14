import React, { useState } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, Scale, CheckCircle2 } from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { TransactionType } from '../types/inventory';

export const StockTransactionModal: React.FC = () => {
  const { 
    stockTransactionModalSku, 
    setStockTransactionModalSku, 
    recordTransaction 
  } = useInventoryStore();

  const [type, setType] = useState<TransactionType>('STOCK_IN');
  const [quantity, setQuantity] = useState<number>(50);
  const [reason, setReason] = useState<string>('Production Batch Receipt (Plant 1 Ludhiana)');
  const [operator, setOperator] = useState<string>('Warehouse Lead');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  if (!stockTransactionModalSku) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) return;

    recordTransaction(
      stockTransactionModalSku.id,
      type,
      quantity,
      reason,
      operator
    );

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setStockTransactionModalSku(null);
    }, 600);
  };

  const current = stockTransactionModalSku.current_stock;
  const projectedStock = type === 'STOCK_IN' 
    ? current + quantity 
    : type === 'STOCK_OUT' || type === 'SCRAP'
    ? Math.max(0, current - quantity)
    : quantity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
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
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Movement Type Radio Chips */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
              Movement Type
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

          {/* Quantity & Stock Impact Preview */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                {type === 'AUDIT_ADJUSTMENT' ? 'Audited Physical Qty' : 'Quantity to Move'}
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center dark:border-slate-800 dark:bg-slate-800/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Stock Impact</span>
              <div className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white">
                <span className="text-slate-400">{current}</span>
                <span className="mx-1 text-slate-300">→</span>
                <span className="text-orange-600 dark:text-orange-400">{projectedStock} {stockTransactionModalSku.unit}</span>
              </div>
            </div>
          </div>

          {/* Reason Code */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Reason / Reference Document
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Invoice #SO-26-8812, Container arrival, Audit Q3..."
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
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 active:scale-98"
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
