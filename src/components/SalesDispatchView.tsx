import React, { useState, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Boxes, 
  Printer, 
  Download, 
  Truck, 
  Layers, 
  ArrowRight, 
  RefreshCw, 
  Undo2, 
  Tag, 
  PackageCheck, 
  Info,
  Calendar,
  MapPin,
  Building2,
  FileCheck2,
  Sliders,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
  Search,
  X,
  History,
  FileText,
  ChevronLeft,
  Eye
} from 'lucide-react';
import { useInventoryStore, DeductedSOInfo } from '../store/useInventoryStore';
import { 
  SalesOrderData, 
  SalesOrderItem, 
  PackingListSummary, 
  Carton 
} from '../types/inventory';
import { 
  parseSalesOrderExcel, 
  getSampleSalesOrder699, 
  buildShippingMark, 
  generateCartonsAndPackagingList, 
  exportPackagingListToExcel, 
  exportLabelsToExcel 
} from '../lib/salesOrderParser';

export const SalesDispatchView: React.FC = () => {
  const { skus, deductSalesOrderStock, undoDeductSalesOrderStock, deductedSalesOrders } = useInventoryStore();

  // Active Sales Order state (STARTS CLEAN / NULL — NO AUTO-LOADED SAMPLE DATA)
  const [soData, setSoData] = useState<SalesOrderData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedMark, setCopiedMark] = useState(false);

  // Active step (1: Upload, 2: Stock Check, 3: Packing Config, 4: Outputs)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);

  // Table filters inside Step 2
  const [stockFilter, setStockFilter] = useState<'ALL' | 'TOOLS' | 'PROMO' | 'SHORTAGE'>('ALL');
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // Output view tab in Step 4 ('packing-list' | 'box-labels')
  const [outputTab, setOutputTab] = useState<'packing-list' | 'box-labels'>('packing-list');
  const [labelViewMode, setLabelViewMode] = useState<'all-grid' | 'single-carousel'>('all-grid');
  const [currentCartonIndex, setCurrentCartonIndex] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle uploading user's Tally SO Excel file
  const processUploadedFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setSuccessMessage(null);

    try {
      const parsed = await parseSalesOrderExcel(file, skus);
      setSoData(parsed);
      setActiveStep(2);
      setSuccessMessage(`File "${file.name}" successfully parsed! PI #${parsed.piNumber} (${parsed.items.length} items extracted).`);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to parse Excel file.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        processUploadedFile(file);
      } else {
        setUploadError('Please drop an Excel file (.xlsx or .xls).');
      }
    }
  };

  // Clear / Start New Order
  const handleStartNewOrder = () => {
    setSoData(null);
    setActiveStep(1);
    setUploadError(null);
    setSuccessMessage(null);
    setCurrentCartonIndex(0);
  };

  // Re-open a past dispatched order from history
  const handleReopenPastOrder = (info: DeductedSOInfo) => {
    if (info.soDataSnapshot) {
      setSoData(info.soDataSnapshot);
      setActiveStep(4);
      setSuccessMessage(`Opened past dispatched order PI #${info.piNumber} (${info.partyName}).`);
    } else {
      // Reconstruct basic order if snapshot not present
      const sample = getSampleSalesOrder699(skus);
      sample.piNumber = info.piNumber;
      sample.partyName = info.partyName;
      setSoData(sample);
      setActiveStep(4);
    }
  };

  // Shipping Mark update handlers
  const handlePartyAbbrChange = (abbr: string) => {
    if (!soData) return;
    const cleanAbbr = abbr.toUpperCase();
    const newShippingMark = buildShippingMark(cleanAbbr, soData.stateName, soData.stateCode);
    setSoData({
      ...soData,
      partyAbbr: cleanAbbr,
      shippingMark: newShippingMark
    });
  };

  const handleCustomShippingMarkChange = (mark: string) => {
    if (!soData) return;
    setSoData({
      ...soData,
      shippingMark: mark
    });
  };

  const handleCopyShippingMark = () => {
    if (!soData) return;
    navigator.clipboard.writeText(soData.shippingMark);
    setCopiedMark(true);
    setTimeout(() => setCopiedMark(false), 2000);
  };

  // Item packing input changes (Step 3)
  const handleUpdateItemPacking = (
    slNo: number, 
    field: 'unitsPerBox' | 'grossWeightPerBox' | 'isMixedCarton' | 'mixedCartonNo' | 'mixedCartonGrossWeight',
    value: any
  ) => {
    if (!soData) return;
    const nextItems = soData.items.map(item => {
      if (item.slNo !== slNo) return item;
      return {
        ...item,
        [field]: value
      };
    });
    setSoData({ ...soData, items: nextItems });
  };

  // Auto-fill smart defaults for all items in SO
  const handleAutoFillPackingDefaults = () => {
    if (!soData) return;
    const nextItems = soData.items.map(item => {
      const clean = item.cleanItemName.toLowerCase();
      let units = item.orderedQty;
      let wt = 15.00;

      if (clean.includes('grinding wheel') || clean.includes('cutting wheel')) {
        units = item.orderedQty >= 150 ? 150 : (item.orderedQty >= 100 ? 100 : item.orderedQty);
        wt = 18.50;
      } else if (clean.includes('vice')) {
        units = item.orderedQty > 10 ? 2 : (item.orderedQty > 5 ? 1 : item.orderedQty);
        wt = 16.00;
      } else if (clean.includes('handle') || clean.includes('spanner')) {
        units = item.orderedQty >= 48 ? 48 : (item.orderedQty >= 24 ? 24 : item.orderedQty);
        wt = 12.00;
      } else if (item.isPromoOrNonStock) {
        units = item.orderedQty;
        wt = 2.50;
      }

      return {
        ...item,
        unitsPerBox: Math.max(1, Math.round(units)),
        grossWeightPerBox: Number(wt.toFixed(2)),
        isMixedCarton: false,
        mixedCartonNo: null
      };
    });

    setSoData({ ...soData, items: nextItems });
    setSuccessMessage('Auto-filled standard factory packing defaults for all items.');
  };

  // Group all Promo / Non-Stock items into 1 Mixed Carton
  const handlePackPromoIntoMixedCarton = () => {
    if (!soData) return;
    const promoCartonNo = 5;
    const nextItems = soData.items.map(item => {
      if (item.isPromoOrNonStock) {
        return {
          ...item,
          isMixedCarton: true,
          mixedCartonNo: promoCartonNo,
          mixedCartonGrossWeight: 6.50
        };
      }
      return item;
    });

    setSoData({ ...soData, items: nextItems });
    setSuccessMessage(`Grouped all promotional items into Shared Box #${promoCartonNo}.`);
  };

  // Deduct Stock Action (Step 2)
  const isDeducted = soData ? Boolean(deductedSalesOrders[soData.piNumber]) : false;
  const deductionRecord = soData ? deductedSalesOrders[soData.piNumber] : null;

  const handleConfirmDeductStock = () => {
    if (!soData) return;
    const res = deductSalesOrderStock(soData);
    if (res.success) {
      setSuccessMessage(res.message);
    } else {
      setUploadError(res.message);
    }
  };

  const handleUndoDeduct = (piNumber: string) => {
    const res = undoDeductSalesOrderStock(piNumber);
    if (res.success) {
      setSuccessMessage(res.message);
    } else {
      setUploadError(res.message);
    }
  };

  // Generate Cartons and Packaging List
  const packingSummary: PackingListSummary | null = useMemo(() => {
    if (!soData) return null;
    return generateCartonsAndPackagingList(soData);
  }, [soData]);

  // Stock check calculations
  const stockCheckStats = useMemo(() => {
    if (!soData) return { totalToolItems: 0, totalPromoItems: 0, shortagesCount: 0, totalUnits: 0 };
    let totalToolItems = 0;
    let totalPromoItems = 0;
    let shortagesCount = 0;
    let totalUnits = 0;

    soData.items.forEach(item => {
      totalUnits += Math.round(item.orderedQty);
      if (item.isPromoOrNonStock) {
        totalPromoItems += 1;
      } else {
        totalToolItems += 1;
        if (item.matchedSku) {
          const currentStock = Math.round(item.matchedSku.current_stock);
          if (currentStock < Math.round(item.orderedQty)) {
            shortagesCount += 1;
          }
        } else {
          shortagesCount += 1;
        }
      }
    });

    return { totalToolItems, totalPromoItems, shortagesCount, totalUnits };
  }, [soData]);

  // Filtered items in Step 2 table
  const filteredItems = useMemo(() => {
    if (!soData) return [];
    return soData.items.filter(item => {
      if (itemSearchQuery.trim()) {
        const q = itemSearchQuery.toLowerCase();
        const matchName = item.cleanItemName.toLowerCase().includes(q) || item.rawItemName.toLowerCase().includes(q);
        if (!matchName) return false;
      }

      if (stockFilter === 'TOOLS') return !item.isPromoOrNonStock;
      if (stockFilter === 'PROMO') return item.isPromoOrNonStock;
      if (stockFilter === 'SHORTAGE') {
        if (item.isPromoOrNonStock) return false;
        const current = item.matchedSku ? Math.round(item.matchedSku.current_stock) : 0;
        return current < Math.round(item.orderedQty);
      }
      return true;
    });
  }, [soData, stockFilter, itemSearchQuery]);

  // Handle browser printing
  const handlePrintPackingList = () => {
    window.print();
  };

  const handlePrintLabels = () => {
    setOutputTab('box-labels');
    setLabelViewMode('all-grid');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintSingleLabel = () => {
    window.print();
  };

  // Past orders list
  const pastOrdersList = useMemo(() => {
    return Object.values(deductedSalesOrders).sort((a, b) => b.deductedAt.localeCompare(a.deductedAt));
  }, [deductedSalesOrders]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Print-specific style overrides */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-dispatch-area, #printable-dispatch-area * {
            visibility: visible;
          }
          #printable-dispatch-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-page-break {
            page-break-after: always;
            break-inside: avoid;
          }
        }
      `}</style>

      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 uppercase tracking-wider">
            <Truck className="h-4 w-4" />
            <span>Dispatch & Packaging Logistics</span>
            <span>•</span>
            <span>Tally Sales Order Integration</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            Sales Order & Dispatch (SO ➔ Packing List & Box Labels)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Factory floor workflow: Upload Tally SO, verify physical stock, minus stock, configure cartons, and print box sticker labels.
          </p>
        </div>

        {/* Header Right Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {soData && (
            <button
              onClick={handleStartNewOrder}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs active:scale-95"
              title="Close active order and return to clean upload screen"
            >
              <X className="h-3.5 w-3.5 text-slate-500" />
              <span>Close / Start New SO</span>
            </button>
          )}

          <label className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition cursor-pointer active:scale-95">
            <Upload className="h-4 w-4" />
            <span>{soData ? 'Upload Another SO (.xlsx)' : 'Upload Tally SO (.xlsx)'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {uploadError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 no-print animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="font-bold text-sm hover:text-rose-950">×</button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 no-print animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-sm hover:text-emerald-950">×</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CLEAN EMPTY STATE: WHEN NO SO IS LOADED YET (NO AUTO-SAMPLE)               */}
      {/* ========================================================================= */}
      {!soData && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Giant Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative flex flex-col items-center justify-center rounded-3xl border-3 border-dashed p-10 sm:p-14 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 scale-[1.01]'
                : 'border-slate-300 bg-white hover:border-orange-400 hover:bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-orange-500'
            }`}
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 group-hover:scale-110 transition-transform shadow-xs dark:bg-orange-950 dark:text-orange-400">
              <Upload className="h-10 w-10" />
            </div>

            <h2 className="mt-5 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Drop Tally Sales Order Excel File (.xlsx)
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Drag & Drop any Tally Sales Order (.xlsx / .xls) here or <span className="text-orange-600 font-bold underline">Click to Browse</span> from your computer.
            </p>

            {/* Feature Checklist Pills */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Auto-reads PI#, Party, State Code</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Auto-builds Shipping Mark (RMTS/Delhi/07)</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Godown Stock Check & 1-Click Minus</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Printable Box Labels & Excel Download</span>
              </span>
            </div>
          </div>

          {/* Recent Dispatches Section (if any past orders exist) */}
          {pastOrdersList.length > 0 && (
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-orange-600" />
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Past Dispatched Orders (History & Re-Printing)
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  {pastOrdersList.length} Dispatched Orders Recorded
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                {pastOrdersList.map(order => (
                  <div key={order.piNumber} className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl transition">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                          PI #{order.piNumber}
                        </span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {order.partyName}
                        </span>
                        <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 dark:bg-emerald-950 dark:text-emerald-300">
                          Deducted
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        Dispatched: {order.deductedAt} • {order.unitsTotal.toLocaleString()} Units across {order.itemsCount} SKUs
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleReopenPastOrder(order)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs"
                      >
                        <Eye className="h-3.5 w-3.5 text-orange-600" />
                        <span>View / Re-Print Stickers</span>
                      </button>

                      <button
                        onClick={() => handleUndoDeduct(order.piNumber)}
                        className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition"
                        title="Revert stock deduction for this order"
                      >
                        <Undo2 className="h-3 w-3" />
                        <span>Undo</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACTIVE SALES ORDER WORKFLOW (STEP 1 TO STEP 4)                            */}
      {/* ========================================================================= */}
      {soData && (
        <div className="space-y-6">
          {/* Step Progress Navigation Pills */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 no-print">
            {[
              { step: 1, label: '1. SO & Shipping Mark', sub: `PI #${soData.piNumber} • ${soData.partyAbbr}` },
              { step: 2, label: '2. Stock Check & Deduct', sub: isDeducted ? 'Stock Deducted ✅' : `${stockCheckStats.totalUnits} Units Total` },
              { step: 3, label: '3. Packing Box Setup', sub: 'Units/Box & Gross Wt' },
              { step: 4, label: '4. Packing List & Labels', sub: packingSummary ? `${packingSummary.totalBoxes} Boxes (${packingSummary.totalGrossWeight} Kg)` : 'View & Print' },
            ].map(item => {
              const isActive = activeStep === item.step;
              return (
                <button
                  key={item.step}
                  onClick={() => setActiveStep(item.step as any)}
                  className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                    isActive
                      ? 'border-orange-500 bg-orange-50/70 shadow-xs dark:bg-orange-950/30 dark:border-orange-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-bold ${isActive ? 'text-orange-700 dark:text-orange-300' : 'text-slate-700 dark:text-slate-300'}`}>
                      {item.label}
                    </span>
                    {item.step === 2 && isDeducted && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-full">
                    {item.sub}
                  </span>
                </button>
              );
            })}
          </div>

          {/* STEP 1: UPLOAD TALLY SALES ORDER EXCEL & EXTRACT DETAILS */}
          {activeStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Extracted Details Card */}
              <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 font-black text-lg">
                      PI
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                          PI #{soData.piNumber}
                        </span>
                        <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-bold font-mono text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          Dated: {soData.orderDate}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Source: {soData.rawFileName || 'Tally Export'} • {soData.items.length} Items Listed
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setActiveStep(2)}
                      className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 active:scale-95 transition"
                    >
                      <span>Proceed to Stock Check (Step 2)</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Extracted Fields Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  {/* Party Information */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                      <Building2 className="h-3.5 w-3.5 text-orange-600" />
                      <span>Consignee / Buyer Name</span>
                    </div>
                    <div className="mt-2 text-base font-extrabold text-slate-900 dark:text-white">
                      {soData.partyName}
                    </div>
                    {soData.buyerAddress && (
                      <div className="mt-1 text-xs text-slate-500 line-clamp-2" title={soData.buyerAddress}>
                        {soData.buyerAddress}
                      </div>
                    )}
                  </div>

                  {/* Destination & State Code */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                      <MapPin className="h-3.5 w-3.5 text-orange-600" />
                      <span>State & Code</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">
                        {soData.stateName}
                      </span>
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-mono font-bold text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                        Code: {soData.stateCode}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Auto-extracted from Tally Sales Order header
                    </div>
                  </div>

                  {/* Auto-Generated Shipping Mark (Editable) */}
                  <div className="rounded-xl border-2 border-orange-200 bg-orange-50/50 p-4 dark:border-orange-900/60 dark:bg-orange-950/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-orange-800 dark:text-orange-300 uppercase">
                        <Tag className="h-3.5 w-3.5 text-orange-600" />
                        <span>Shipping Mark (Editable)</span>
                      </div>
                      <button
                        onClick={handleCopyShippingMark}
                        className="flex items-center gap-1 text-[11px] font-bold text-orange-700 hover:text-orange-900 dark:text-orange-300"
                        title="Copy Shipping Mark"
                      >
                        {copiedMark ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedMark ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="w-24">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                          Abbr
                        </label>
                        <input
                          type="text"
                          value={soData.partyAbbr}
                          onChange={(e) => handlePartyAbbrChange(e.target.value)}
                          className="w-full rounded-lg border border-orange-300 bg-white px-2 py-1 text-xs font-bold font-mono text-slate-900 focus:outline-hidden dark:bg-slate-900 dark:text-white"
                          placeholder="RMTS"
                        />
                      </div>

                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                          Full Shipping Mark
                        </label>
                        <input
                          type="text"
                          value={soData.shippingMark}
                          onChange={(e) => handleCustomShippingMarkChange(e.target.value)}
                          className="w-full rounded-lg border border-orange-300 bg-white px-2.5 py-1 text-xs font-bold font-mono text-orange-900 dark:bg-slate-900 dark:text-orange-200 focus:outline-hidden"
                          placeholder="RMTS/Delhi/07"
                        />
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] font-mono text-orange-800/80 dark:text-orange-300/80">
                      Sticker Format: <strong>{soData.shippingMark}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: AUTOMATIC STOCK CHECK & 1-CLICK STOCK MINUS (DEDUCTION) */}
          {activeStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Action Ribbon: Deduction Status & Confirm Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-slate-900 dark:text-white">
                      Stock Verification for PI #{soData.piNumber}
                    </span>
                    {isDeducted ? (
                      <span className="rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Stock Deducted ✅
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Pending Dispatch Deduction
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {stockCheckStats.totalToolItems} Hand Tool Items • {stockCheckStats.totalPromoItems} Promo/Non-Stock Items • Total: {stockCheckStats.totalUnits} Units
                  </p>
                </div>

                {/* 1-Click Stock Minus Button with Duplicate-PI Protection */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {isDeducted ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                        Deducted on {deductionRecord?.deductedAt} ({deductionRecord?.unitsTotal} Units)
                      </span>
                      <button
                        onClick={() => handleUndoDeduct(soData.piNumber)}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition"
                        title="Restore stock for this PI"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        <span>Undo</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleConfirmDeductStock}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition"
                    >
                      <PackageCheck className="h-4 w-4" />
                      <span>Confirm SO & Minus Stock</span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveStep(3)}
                    className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-orange-700 active:scale-95 transition"
                  >
                    <span>Next: Packing Setup (Step 3)</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Filter and Search Bar for Items */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 min-w-[240px] flex-1">
                  <Search className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    placeholder="Search item in sales order..."
                    className="w-full text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-hidden dark:text-white"
                  />
                  {itemSearchQuery && (
                    <button onClick={() => setItemSearchQuery('')} className="text-xs text-slate-400 hover:text-slate-600">×</button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setStockFilter('ALL')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      stockFilter === 'ALL'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    All ({soData.items.length})
                  </button>
                  <button
                    onClick={() => setStockFilter('TOOLS')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      stockFilter === 'TOOLS'
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    Stock Tools ({stockCheckStats.totalToolItems})
                  </button>
                  <button
                    onClick={() => setStockFilter('PROMO')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      stockFilter === 'PROMO'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    Promo Items ({stockCheckStats.totalPromoItems})
                  </button>
                  {stockCheckStats.shortagesCount > 0 && (
                    <button
                      onClick={() => setStockFilter('SHORTAGE')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        stockFilter === 'SHORTAGE'
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      Shortages ({stockCheckStats.shortagesCount})
                    </button>
                  )}
                </div>
              </div>

              {/* SO Stock Check Table (100% Width, Zero Horizontal Scroll) */}
              <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-bold text-slate-600 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/80">
                      <th className="w-[8%] py-3.5 px-3 text-center">Sl No.</th>
                      <th className="w-[42%] py-3.5 px-4">Item Name (Part Name)</th>
                      <th className="w-[15%] py-3.5 px-3 text-right">Ordered Qty</th>
                      <th className="w-[20%] py-3.5 px-4 text-right">Current Stock in Godown</th>
                      <th className="w-[15%] py-3.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
                    {filteredItems.map((item) => {
                      const orderedQty = Math.round(item.orderedQty);
                      const isPromo = item.isPromoOrNonStock;
                      const matchedSku = item.matchedSku;
                      const currentStock = matchedSku ? Math.round(matchedSku.current_stock) : null;
                      const isAvailable = currentStock !== null && currentStock >= orderedQty;

                      return (
                        <tr key={item.slNo} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          {/* 1. Sl No. */}
                          <td className="py-3.5 px-3 w-[8%] text-center font-mono font-bold text-slate-500">
                            {item.slNo}
                          </td>

                          {/* 2. Item Name */}
                          <td className="py-3.5 px-4 w-[42%]">
                            <div className="font-bold text-slate-900 dark:text-white whitespace-normal break-words leading-snug">
                              {item.cleanItemName}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-400 font-mono whitespace-normal break-words">
                              {matchedSku ? (
                                <span>
                                  {matchedSku.division} • {matchedSku.main_category} &gt; {matchedSku.sub_category} ({matchedSku.sku_code})
                                </span>
                              ) : (
                                <span className="italic text-slate-400">
                                  {item.rawItemName}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. Ordered Qty */}
                          <td className="py-3.5 px-3 w-[15%] text-right font-mono font-black text-slate-900 dark:text-white text-base tabular-nums">
                            {orderedQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">Pcs</span>
                          </td>

                          {/* 4. Current Stock in Godown */}
                          <td className="py-3.5 px-4 w-[20%] text-right font-mono tabular-nums">
                            {isPromo ? (
                              <span className="text-slate-400 text-xs italic">—</span>
                            ) : currentStock !== null ? (
                              <div className="flex flex-col items-end">
                                <span className={`text-base font-black ${
                                  currentStock < orderedQty 
                                    ? 'text-rose-600 dark:text-rose-400' 
                                    : 'text-slate-900 dark:text-white'
                                }`}>
                                  {currentStock.toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Units in Stock
                                </span>
                              </div>
                            ) : (
                              <span className="text-amber-600 font-semibold text-xs">Not Found</span>
                            )}
                          </td>

                          {/* 5. Status Badge */}
                          <td className="py-3.5 px-3 w-[15%] text-center">
                            {isPromo ? (
                              <span className="inline-flex items-center rounded-md bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                Promo / Non-Stock
                              </span>
                            ) : isAvailable ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Available ✅</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>Shortage ⚠️</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: SUPER-SIMPLE PACKING INPUT (ASK ONLY UNITS PER BOX & GROSS WEIGHT!) */}
          {activeStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Step 3: Box Packaging Configuration
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    For each item, specify ONLY: (1) Units per Box and (2) Gross Weight (Kg). Use Mixed Carton for shared boxes.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={handleAutoFillPackingDefaults}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
                    title="Fill standard factory packaging weights and quantities"
                  >
                    <Sliders className="h-3.5 w-3.5 text-orange-600" />
                    <span>Auto-Fill Defaults</span>
                  </button>

                  <button
                    onClick={handlePackPromoIntoMixedCarton}
                    className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300 transition"
                  >
                    <Boxes className="h-3.5 w-3.5 text-purple-600" />
                    <span>Group Promo in Mixed Box</span>
                  </button>

                  <button
                    onClick={() => setActiveStep(4)}
                    className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 active:scale-95 transition"
                  >
                    <span>Generate Labels & List (Step 4)</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Packing Input Table */}
              <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-bold text-slate-600 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/80">
                      <th className="w-[35%] py-3.5 px-4">Item Name</th>
                      <th className="w-[12%] py-3.5 px-3 text-right">Order Qty</th>
                      <th className="w-[18%] py-3.5 px-3 text-center">Units Per Box (Pcs)</th>
                      <th className="w-[18%] py-3.5 px-3 text-center">Gross Weight Per Box (Kg)</th>
                      <th className="w-[17%] py-3.5 px-3 text-center">Carton Output</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
                    {soData.items.map((item) => {
                      const orderedQty = Math.round(item.orderedQty);
                      const unitsPerBox = Math.max(1, Math.round(item.unitsPerBox || orderedQty));
                      const estimatedBoxes = Math.ceil(orderedQty / unitsPerBox);

                      return (
                        <tr key={item.slNo} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          {/* Item Name */}
                          <td className="py-3.5 px-4 w-[35%]">
                            <div className="font-bold text-slate-900 dark:text-white whitespace-normal break-words leading-snug">
                              {item.cleanItemName}
                            </div>
                            {item.isPromoOrNonStock && (
                              <span className="inline-block mt-0.5 rounded bg-purple-50 text-[10px] font-bold text-purple-700 border border-purple-200 px-1.5 py-0.2 dark:bg-purple-950 dark:text-purple-300">
                                Promo / Non-Stock
                              </span>
                            )}
                          </td>

                          {/* Ordered Qty */}
                          <td className="py-3.5 px-3 w-[12%] text-right font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {orderedQty.toLocaleString()} Pcs
                          </td>

                          {/* 1 Box Mein Kitne Pcs? (Whole Integer) */}
                          <td className="py-3.5 px-3 w-[18%] text-center">
                            {item.isMixedCarton ? (
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded dark:bg-purple-950 dark:text-purple-300">
                                  Mixed in Carton #{item.mixedCartonNo || '?'}
                                </span>
                                <button
                                  onClick={() => handleUpdateItemPacking(item.slNo, 'isMixedCarton', false)}
                                  className="text-[10px] text-slate-400 hover:text-slate-700 underline mt-1"
                                >
                                  Switch to Standard Box
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={unitsPerBox}
                                  onChange={(e) => handleUpdateItemPacking(item.slNo, 'unitsPerBox', Math.max(1, Math.round(Number(e.target.value))))}
                                  className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center font-mono font-bold text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                />
                                <span className="text-xs text-slate-400 font-mono">Pcs</span>
                              </div>
                            )}
                          </td>

                          {/* 1 Box Ka Gross Weight (Kg) */}
                          <td className="py-3.5 px-3 w-[18%] text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min={0.1}
                                step={0.01}
                                value={item.grossWeightPerBox}
                                onChange={(e) => handleUpdateItemPacking(item.slNo, 'grossWeightPerBox', Number(Number(e.target.value).toFixed(2)))}
                                className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center font-mono font-bold text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                              />
                              <span className="text-xs text-slate-400 font-mono">Kg</span>
                            </div>
                          </td>

                          {/* Carton Output & Mixed Option */}
                          <td className="py-3.5 px-3 w-[17%] text-center">
                            {item.isMixedCarton ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs font-bold text-purple-700">
                                  Box #{item.mixedCartonNo}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-bold font-mono text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                  {estimatedBoxes} {estimatedBoxes === 1 ? 'Box' : 'Boxes'}
                                </span>
                                <button
                                  onClick={() => {
                                    handleUpdateItemPacking(item.slNo, 'isMixedCarton', true);
                                    handleUpdateItemPacking(item.slNo, 'mixedCartonNo', 7);
                                    handleUpdateItemPacking(item.slNo, 'mixedCartonGrossWeight', 8.14);
                                  }}
                                  className="text-[10px] text-orange-600 hover:underline font-semibold"
                                >
                                  + Share Carton
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: AUTO-GENERATE PACKING LIST & BOX LABELS (VIEW, PRINT & .XLSX DOWNLOAD) */}
          {activeStep === 4 && packingSummary && (
            <div id="printable-dispatch-area" className="space-y-6 animate-in fade-in duration-150">
              {/* Top Control Bar (Tabs & Download / Print Buttons) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 gap-4 no-print">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOutputTab('packing-list')}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                      outputTab === 'packing-list'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Output 1: Packaging List (Sheet1)</span>
                  </button>

                  <button
                    onClick={() => setOutputTab('box-labels')}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                      outputTab === 'box-labels'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Tag className="h-4 w-4" />
                    <span>Output 2: Box Labels / Stickers ({packingSummary.totalBoxes} Labels)</span>
                  </button>
                </div>

                {/* Print & Download Actions */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {outputTab === 'packing-list' ? (
                    <>
                      <button
                        onClick={() => exportPackagingListToExcel(packingSummary)}
                        className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300 transition"
                      >
                        <Download className="h-4 w-4 text-emerald-600" />
                        <span>Download Packaging list.xlsx</span>
                      </button>

                      <button
                        onClick={handlePrintPackingList}
                        className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 transition"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Print Packing List</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* View mode toggle for labels */}
                      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                        <button
                          onClick={() => setLabelViewMode('all-grid')}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                            labelViewMode === 'all-grid'
                              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          All ({packingSummary.totalBoxes})
                        </button>
                        <button
                          onClick={() => setLabelViewMode('single-carousel')}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                            labelViewMode === 'single-carousel'
                              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          1-by-1
                        </button>
                      </div>

                      <button
                        onClick={() => exportLabelsToExcel(packingSummary)}
                        className="flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300 transition"
                      >
                        <Download className="h-4 w-4 text-indigo-600" />
                        <span>Download LABELS.xlsx</span>
                      </button>

                      <button
                        onClick={handlePrintLabels}
                        className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 transition"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Print All Box Stickers</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* OUTPUT 1: PACKAGING LIST (Exact layout of Packaging list.xlsx) */}
              {outputTab === 'packing-list' && (
                <div className="rounded-2xl border-2 border-slate-300 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 font-sans">
                  {/* Header: Party Name & PI Number */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b-2 border-slate-800 gap-2 font-mono">
                    <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      <span className="text-slate-500">Party Name :</span>
                      <span className="font-extrabold uppercase">{packingSummary.partyName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      <div>
                        <span className="text-slate-500">PI : </span>
                        <span className="font-extrabold">{packingSummary.piNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Mark: </span>
                        <span className="text-orange-700 dark:text-orange-400 font-extrabold">{packingSummary.shippingMark}</span>
                      </div>
                    </div>
                  </div>

                  {/* Table (Carton No. | Item Name | Qty | Gross Wt.) */}
                  <div className="mt-4 overflow-hidden">
                    <table className="w-full table-fixed border-collapse text-left border border-slate-300 dark:border-slate-700">
                      <thead>
                        <tr className="border-b-2 border-slate-300 bg-slate-100 text-xs sm:text-sm font-extrabold text-slate-800 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          <th className="w-[18%] py-3 px-3 text-center border-r border-slate-300 dark:border-slate-700">
                            Carton No.
                          </th>
                          <th className="w-[52%] py-3 px-4 border-r border-slate-300 dark:border-slate-700">
                            Item Name
                          </th>
                          <th className="w-[15%] py-3 px-3 text-right border-r border-slate-300 dark:border-slate-700">
                            Qty
                          </th>
                          <th className="w-[15%] py-3 px-4 text-right">
                            Gross Wt.
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60 font-mono text-xs sm:text-sm">
                        {packingSummary.cartons.map((carton) => {
                          if (carton.items.length === 1) {
                            const item = carton.items[0];
                            return (
                              <tr key={`c-${carton.cartonNo}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                                  {carton.cartonNo}
                                </td>
                                <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 whitespace-normal break-words">
                                  {item.cleanName}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 tabular-nums">
                                  {item.qty}
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                                  {carton.grossWeightKg.toFixed(2)}
                                </td>
                              </tr>
                            );
                          } else {
                            // Mixed carton (Cartons 7 & 8 layout: Carton No and Gross Wt on first row, blank on remaining rows)
                            return carton.items.map((item, itemIdx) => (
                              <tr key={`c-${carton.cartonNo}-i-${itemIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                                  {itemIdx === 0 ? carton.cartonNo : ''}
                                </td>
                                <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 whitespace-normal break-words">
                                  {item.cleanName}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 tabular-nums">
                                  {item.qty}
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                                  {itemIdx === 0 ? carton.grossWeightKg.toFixed(2) : ''}
                                </td>
                              </tr>
                            ));
                          }
                        })}

                        {/* Total Row */}
                        <tr className="border-t-2 border-slate-800 bg-slate-50 dark:bg-slate-800/70 font-bold">
                          <td className="py-3 px-3 text-center border-r border-slate-300 dark:border-slate-700 text-sm">
                            Total
                          </td>
                          <td className="py-3 px-4 border-r border-slate-300 dark:border-slate-700"></td>
                          <td className="py-3 px-3 text-right border-r border-slate-300 dark:border-slate-700 tabular-nums text-sm">
                            {packingSummary.totalUnits.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-sm">
                            {packingSummary.totalGrossWeight.toFixed(2)}
                          </td>
                        </tr>

                        {/* Total Boxes Row */}
                        <tr className="bg-slate-50 dark:bg-slate-800/70 font-extrabold text-sm sm:text-base">
                          <td className="py-3 px-3 text-center border-r border-slate-300 dark:border-slate-700"></td>
                          <td className="py-3 px-4 border-r border-slate-300 dark:border-slate-700"></td>
                          <td className="py-3 px-3 text-right border-r border-slate-300 dark:border-slate-700"></td>
                          <td className="py-3 px-4 text-right text-orange-700 dark:text-orange-400 font-mono">
                            {packingSummary.totalBoxes} BOX
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* OUTPUT 2: BOX LABELS / CARTON STICKERS (Exact layout of LABELS.xlsx) */}
              {outputTab === 'box-labels' && (
                <div className="space-y-6">
                  {labelViewMode === 'single-carousel' && (
                    <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl dark:bg-slate-800 no-print">
                      <button
                        onClick={() => setCurrentCartonIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentCartonIndex === 0}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border bg-white text-xs font-bold disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span>Previous Sticker</span>
                      </button>

                      <div className="text-center font-mono">
                        <span className="text-sm font-black">
                          Carton #{packingSummary.cartons[currentCartonIndex]?.cartonNo}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          ({currentCartonIndex + 1} of {packingSummary.totalBoxes})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrintSingleLabel}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Print This Sticker Only</span>
                        </button>

                        <button
                          onClick={() => setCurrentCartonIndex(prev => Math.min(packingSummary.cartons.length - 1, prev + 1))}
                          disabled={currentCartonIndex === packingSummary.cartons.length - 1}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border bg-white text-xs font-bold disabled:opacity-40"
                        >
                          <span>Next Sticker</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sticker Grid / Single View */}
                  <div className={labelViewMode === 'all-grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'max-w-xl mx-auto'}>
                    {(labelViewMode === 'all-grid' ? packingSummary.cartons : [packingSummary.cartons[currentCartonIndex]]).map((carton) => {
                      if (!carton) return null;
                      return (
                        <div
                          key={carton.cartonNo}
                          className="rounded-2xl border-4 border-slate-900 bg-white p-5 shadow-md dark:border-slate-200 dark:bg-slate-900 font-sans print-page-break"
                        >
                          {/* Header Block: Carton# | Shipping Mark | PI# */}
                          <div className="grid grid-cols-3 border-b-2 border-slate-900 pb-3 dark:border-slate-200 font-mono">
                            <div>
                              <div className="text-[11px] font-bold text-slate-500 uppercase">Carton#</div>
                              <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                                {carton.cartonNo}
                              </div>
                            </div>

                            <div className="text-center">
                              <div className="text-[11px] font-bold text-slate-500 uppercase">Shipping Mark</div>
                              <div className="text-base sm:text-lg font-black text-orange-700 dark:text-orange-400 mt-0.5">
                                {carton.shippingMark}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-[11px] font-bold text-slate-500 uppercase">PI#</div>
                              <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                                {carton.piNumber}
                              </div>
                            </div>
                          </div>

                          {/* Table Block: S# | Product/Size | Quantity (Nos) | Weight (Kg) */}
                          <div className="mt-3">
                            <table className="w-full table-fixed border-collapse text-left font-mono">
                              <thead>
                                <tr className="border-b border-slate-300 text-[11px] font-extrabold text-slate-700 uppercase dark:border-slate-700 dark:text-slate-300">
                                  <th className="w-[10%] py-2 px-1 text-center">S#</th>
                                  <th className="w-[50%] py-2 px-2">Product/Size</th>
                                  <th className="w-[20%] py-2 px-1 text-right">Quantity (Nos)</th>
                                  <th className="w-[20%] py-2 px-2 text-right">Weight (Kg)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
                                {carton.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="py-2 px-1 text-center font-bold text-slate-500">
                                      {idx + 1}
                                    </td>
                                    <td className="py-2 px-2 font-extrabold text-slate-900 dark:text-white whitespace-normal break-words leading-tight">
                                      {item.cleanName}
                                    </td>
                                    <td className="py-2 px-1 text-right font-black text-slate-900 dark:text-white tabular-nums">
                                      {item.qty}
                                    </td>
                                    <td className="py-2 px-2 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                                      {carton.items.length === 1 ? carton.grossWeightKg.toFixed(2) : item.weightKg.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}

                                {/* Total Row */}
                                <tr className="border-t-2 border-slate-900 bg-slate-50 dark:border-slate-200 dark:bg-slate-800/60 font-black text-xs sm:text-sm">
                                  <td></td>
                                  <td className="py-2.5 px-2 text-slate-900 dark:text-white uppercase">
                                    Total
                                  </td>
                                  <td className="py-2.5 px-1 text-right tabular-nums text-slate-900 dark:text-white">
                                    {carton.totalQty}
                                  </td>
                                  <td className="py-2.5 px-2 text-right tabular-nums text-slate-900 dark:text-white">
                                    {carton.grossWeightKg.toFixed(2)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
