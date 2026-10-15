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
  Eye,
  PlusCircle,
  PackagePlus,
  Edit3,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Save
} from 'lucide-react';
import { useInventoryStore, DeductedSOInfo } from '../store/useInventoryStore';
import { 
  SalesOrderData, 
  SalesOrderItem, 
  PackingListSummary, 
  Carton,
  CartonItem
} from '../types/inventory';
import { 
  parseSalesOrderExcel, 
  getSampleSalesOrder699, 
  buildShippingMark, 
  generateCartonsAndPackagingList, 
  exportPackagingListToExcel, 
  exportLabelsToExcel 
} from '../lib/salesOrderParser';

interface QuickInModalState {
  item: SalesOrderItem;
  inQty: number;
  reason: string;
}

export const SalesDispatchView: React.FC = () => {
  const { 
    skus, 
    deductSalesOrderStock, 
    undoDeductSalesOrderStock, 
    deductedSalesOrders,
    recordTransaction 
  } = useInventoryStore();

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
  const [stockFilter, setStockFilter] = useState<'ALL' | 'TOOLS' | 'PROMO' | 'SHORTAGE' | 'PARTIAL'>('ALL');
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // Quick Stock IN Modal state
  const [quickInModal, setQuickInModal] = useState<QuickInModalState | null>(null);

  // Editable Cartons state in Step 4 (Packaging list & Labels editing)
  const [customCartons, setCustomCartons] = useState<Carton[] | null>(null);
  const [isEditingPackagingList, setIsEditingPackagingList] = useState<boolean>(true);

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
    setCustomCartons(null);

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
    setCustomCartons(null);
    setQuickInModal(null);
  };

  // Re-open a past dispatched order from history
  const handleReopenPastOrder = (info: DeductedSOInfo) => {
    setCustomCartons(null);
    if (info.soDataSnapshot) {
      setSoData(info.soDataSnapshot);
      setActiveStep(4);
      setSuccessMessage(`Opened past dispatched order PI #${info.piNumber} (${info.partyName}).`);
    } else {
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

  // =========================================================================
  // STEP 2: DISPATCH QTY (PARTIAL FULFILLMENT) & QUICK IN HANDLERS
  // =========================================================================

  // Update Dispatch Quantity for Partial Shipment
  const handleUpdateDispatchQty = (slNo: number, qty: number) => {
    if (!soData) return;
    const nextItems = soData.items.map(it => {
      if (it.slNo !== slNo) return it;
      const ordered = Math.round(it.orderedQty);
      const clamped = Math.max(0, Math.min(Math.round(qty), ordered));
      return {
        ...it,
        dispatchQty: clamped
      };
    });
    setSoData({ ...soData, items: nextItems });
    setCustomCartons(null); // Invalidate custom cartons to refresh with new quantities
  };

  const handleShipAvailable = (item: SalesOrderItem) => {
    if (!item.matchedSku) return;
    const available = Math.max(0, Math.round(item.matchedSku.current_stock));
    handleUpdateDispatchQty(item.slNo, available);
  };

  const handleShipFull = (item: SalesOrderItem) => {
    handleUpdateDispatchQty(item.slNo, Math.round(item.orderedQty));
  };

  // Open Quick Stock IN Modal for Shortage Item
  const handleOpenQuickIn = (item: SalesOrderItem) => {
    const currentStock = item.matchedSku ? Math.round(item.matchedSku.current_stock) : 0;
    const ordered = Math.round(item.orderedQty);
    const shortage = Math.max(1, ordered - currentStock);
    setQuickInModal({
      item,
      inQty: shortage,
      reason: `Quick Stock IN for SO PI #${soData?.piNumber || ''} (${item.cleanItemName})`
    });
  };

  // Confirm Quick Stock IN
  const handleConfirmQuickIn = () => {
    if (!quickInModal || !quickInModal.item.matchedSku) return;
    const sku = quickInModal.item.matchedSku;
    const inQty = Math.max(1, Math.round(quickInModal.inQty));

    // 1. Record transaction in global inventory store
    recordTransaction(
      sku.id,
      'STOCK_IN',
      inQty,
      quickInModal.reason || `Quick Stock IN for SO PI #${soData?.piNumber}`,
      'Warehouse Dispatch Staff'
    );

    // 2. Update active Sales Order soData item with the newly increased stock
    if (soData) {
      const nextItems = soData.items.map(it => {
        if (it.slNo === quickInModal.item.slNo && it.matchedSku) {
          const newStock = Math.round(it.matchedSku.current_stock) + inQty;
          return {
            ...it,
            matchedSku: {
              ...it.matchedSku,
              current_stock: newStock,
              quantity: newStock,
              status: newStock === 0 ? 'Zero Stock' : (newStock < 0 ? 'Negative' : 'In Stock')
            }
          };
        }
        return it;
      });
      setSoData({ ...soData, items: nextItems });
    }

    setSuccessMessage(`✅ Stock IN successful! Added ${inQty} units to "${quickInModal.item.cleanItemName}".`);
    setQuickInModal(null);
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

  // =========================================================================
  // STEP 3: BOX PACKAGING CONFIGURATION & PROMO ALLOCATION
  // =========================================================================

  // Item packing input changes (Step 3)
  const handleUpdateItemPacking = (
    slNo: number, 
    field: 'unitsPerBox' | 'grossWeightPerBox' | 'isMixedCarton' | 'mixedCartonNo' | 'mixedCartonGrossWeight' | 'assignedBoxNo',
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
    setCustomCartons(null);
  };

  // Direct Box Assignment ("konsi item konse box mein dalni")
  const handleAssignItemToBox = (slNo: number, boxNoStr: string) => {
    if (!soData) return;
    const boxNo = boxNoStr.trim() === '' ? null : Math.max(1, parseInt(boxNoStr, 10) || 1);
    handleUpdateItemPacking(slNo, 'assignedBoxNo', boxNo);
  };

  // Toggle promo item selection for the Last Box
  const handleTogglePromoForLastBox = (slNo: number) => {
    if (!soData) return;
    const nextItems = soData.items.map(it => {
      if (it.slNo !== slNo) return it;
      const current = it.selectedForLastBox !== false;
      return {
        ...it,
        selectedForLastBox: !current
      };
    });
    setSoData({ ...soData, items: nextItems });
    setCustomCartons(null);
  };

  // Select all or deselect all promo items for last box
  const handleSelectAllPromoForLastBox = (select: boolean) => {
    if (!soData) return;
    const nextItems = soData.items.map(it => {
      if (it.isPromoOrNonStock) {
        return {
          ...it,
          selectedForLastBox: select
        };
      }
      return it;
    });
    setSoData({ ...soData, items: nextItems });
    setCustomCartons(null);
  };

  // Update promo combined box weight
  const handleUpdatePromoBoxWeight = (weight: number) => {
    if (!soData) return;
    const nextItems = soData.items.map(it => {
      if (it.isPromoOrNonStock) {
        return {
          ...it,
          mixedCartonGrossWeight: Number(weight.toFixed(2))
        };
      }
      return it;
    });
    setSoData({ ...soData, items: nextItems });
    setCustomCartons(null);
  };

  // Auto-fill smart defaults for all items in SO
  const handleAutoFillPackingDefaults = () => {
    if (!soData) return;
    const nextItems = soData.items.map(item => {
      const clean = item.cleanItemName.toLowerCase();
      const qty = typeof item.dispatchQty === 'number' ? item.dispatchQty : item.orderedQty;
      let units = qty;
      let wt = 15.00;

      if (clean.includes('grinding wheel') || clean.includes('cutting wheel')) {
        units = qty >= 150 ? 150 : (qty >= 100 ? 100 : qty);
        wt = 18.50;
      } else if (clean.includes('vice')) {
        units = qty > 10 ? 2 : (qty > 5 ? 1 : qty);
        wt = 16.00;
      } else if (clean.includes('handle') || clean.includes('spanner')) {
        units = qty >= 48 ? 48 : (qty >= 24 ? 24 : qty);
        wt = 12.00;
      } else if (item.isPromoOrNonStock) {
        units = qty;
        wt = 2.50;
      }

      return {
        ...item,
        unitsPerBox: Math.max(1, Math.round(units)),
        grossWeightPerBox: Number(wt.toFixed(2)),
        isMixedCarton: item.isPromoOrNonStock,
        mixedCartonNo: null,
        assignedBoxNo: null,
        selectedForLastBox: item.isPromoOrNonStock
      };
    });

    setSoData({ ...soData, items: nextItems });
    setCustomCartons(null);
    setSuccessMessage('Auto-filled standard factory packing defaults for all items.');
  };

  // Group all Promo / Non-Stock items into the Final Mixed Carton
  const handlePackPromoIntoLastCarton = () => {
    if (!soData) return;
    const nextItems = soData.items.map(item => {
      if (item.isPromoOrNonStock) {
        return {
          ...item,
          isMixedCarton: true,
          selectedForLastBox: true,
          mixedCartonGrossWeight: 6.50
        };
      }
      return item;
    });

    setSoData({ ...soData, items: nextItems });
    setCustomCartons(null);
    setSuccessMessage('All promotional items grouped into the Final / Last Carton at the bottom of the packing list.');
  };

  // =========================================================================
  // STEP 4: EDITABLE CARTONS & LABELS LOGIC
  // =========================================================================

  // Generate Cartons and Packaging List from current SO Data
  const packingSummary: PackingListSummary | null = useMemo(() => {
    if (!soData) return null;
    return generateCartonsAndPackagingList(soData);
  }, [soData]);

  // Active Summary uses user's custom edited cartons if present, otherwise auto-generated summary
  const activeSummary: PackingListSummary | null = useMemo(() => {
    if (!soData || !packingSummary) return null;
    const cartons = customCartons || packingSummary.cartons;
    const totalBoxes = cartons.length;
    const totalGrossWeight = Number(cartons.reduce((acc, c) => acc + (Number(c.grossWeightKg) || 0), 0).toFixed(2));
    const totalUnits = cartons.reduce((acc, c) => acc + (Number(c.totalQty) || 0), 0);
    return {
      ...packingSummary,
      cartons,
      totalBoxes,
      totalGrossWeight,
      totalUnits
    };
  }, [soData, packingSummary, customCartons]);

  // Ensure customCartons is cloned from packingSummary when user starts editing
  const getEditableCartonsClone = (): Carton[] => {
    if (customCartons) return JSON.parse(JSON.stringify(customCartons));
    if (packingSummary) return JSON.parse(JSON.stringify(packingSummary.cartons));
    return [];
  };

  // Update carton-level field (Carton No, Gross Weight, Shipping Mark, PI Number)
  const handleUpdateCartonField = (cartonIdx: number, field: keyof Carton, value: any) => {
    const list = getEditableCartonsClone();
    if (!list[cartonIdx]) return;
    const targetCarton = list[cartonIdx];

    if (field === 'grossWeightKg') {
      const newWeight = Number(Number(value || 0).toFixed(2));
      // If this carton is a single standard item box, sync all other identical boxes of the same item & qty!
      if (targetCarton.items.length === 1) {
        const targetItemName = targetCarton.items[0].cleanName;
        const targetItemQty = targetCarton.items[0].qty;
        list.forEach((c) => {
          if (c.items.length === 1 && c.items[0].cleanName === targetItemName && c.items[0].qty === targetItemQty) {
            c.grossWeightKg = newWeight;
            c.items[0].weightKg = newWeight;
          }
        });
      } else {
        targetCarton.grossWeightKg = newWeight;
      }
    } else if (field === 'cartonNo') {
      targetCarton.cartonNo = Math.max(1, parseInt(value, 10) || 1);
    } else {
      (targetCarton as any)[field] = value;
    }

    setCustomCartons(list);
  };

  // Update item-level field inside a carton (Item Name, Qty, Weight)
  const handleUpdateCartonItemField = (cartonIdx: number, itemIdx: number, field: keyof CartonItem, value: any) => {
    const list = getEditableCartonsClone();
    if (!list[cartonIdx] || !list[cartonIdx].items[itemIdx]) return;

    const item = list[cartonIdx].items[itemIdx];
    const isSingleItemCarton = list[cartonIdx].items.length === 1;

    if (field === 'weightKg') {
      const newWeight = Number(Number(value || 0).toFixed(2));
      item.weightKg = newWeight;
      if (isSingleItemCarton) {
        list[cartonIdx].grossWeightKg = newWeight;
        const targetItemName = item.cleanName;
        const targetItemQty = item.qty;
        list.forEach((c) => {
          if (c.items.length === 1 && c.items[0].cleanName === targetItemName && c.items[0].qty === targetItemQty) {
            c.grossWeightKg = newWeight;
            c.items[0].weightKg = newWeight;
          }
        });
      }
    } else if (field === 'qty') {
      item.qty = Math.max(0, parseInt(value, 10) || 0);
      list[cartonIdx].totalQty = list[cartonIdx].items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    } else {
      (item as any)[field] = value;
    }

    setCustomCartons(list);
  };

  // Add a new item inside an existing carton
  const handleAddCartonItem = (cartonIdx: number) => {
    const list = getEditableCartonsClone();
    if (!list[cartonIdx]) return;
    const newItem: CartonItem = {
      id: `custom-item-${Date.now()}`,
      slNo: list[cartonIdx].items.length + 1,
      rawName: 'NEW ITEM',
      cleanName: 'CUSTOM PRODUCT / PROMO',
      qty: 1,
      weightKg: 1.00,
      isPromoOrNonStock: false
    };
    list[cartonIdx].items.push(newItem);
    list[cartonIdx].totalQty += newItem.qty;
    list[cartonIdx].isMixed = list[cartonIdx].items.length > 1;
    setCustomCartons(list);
  };

  // Delete an item from a carton
  const handleDeleteCartonItem = (cartonIdx: number, itemIdx: number) => {
    const list = getEditableCartonsClone();
    if (!list[cartonIdx] || !list[cartonIdx].items[itemIdx]) return;

    if (list[cartonIdx].items.length === 1) {
      // If only 1 item in carton, delete the whole carton
      list.splice(cartonIdx, 1);
    } else {
      list[cartonIdx].items.splice(itemIdx, 1);
      list[cartonIdx].totalQty = list[cartonIdx].items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
      list[cartonIdx].isMixed = list[cartonIdx].items.length > 1;
    }
    setCustomCartons(list);
  };

  // Add a new Custom Carton / Box
  const handleAddCustomCarton = () => {
    const list = getEditableCartonsClone();
    const nextCartonNo = list.length > 0 ? Math.max(...list.map(c => c.cartonNo)) + 1 : 1;
    const newCarton: Carton = {
      id: `custom-carton-${Date.now()}`,
      cartonNo: nextCartonNo,
      shippingMark: soData?.shippingMark || 'OKF/DELHI/07',
      piNumber: soData?.piNumber || '699',
      partyName: soData?.partyName || 'Customer',
      items: [{
        id: `custom-item-${Date.now()}`,
        slNo: 1,
        rawName: 'CUSTOM ITEM',
        cleanName: 'NEW BOX PRODUCT / PROMO',
        qty: 10,
        weightKg: 10.00,
        isPromoOrNonStock: false
      }],
      totalQty: 10,
      grossWeightKg: 10.00,
      isMixed: false
    };
    list.push(newCarton);
    setCustomCartons(list);
    setSuccessMessage(`Added new Carton #${nextCartonNo}. You can now edit its name, quantity and gross weight.`);
  };

  // Delete an entire carton
  const handleDeleteCarton = (cartonIdx: number) => {
    const list = getEditableCartonsClone();
    if (!list[cartonIdx]) return;
    const cNo = list[cartonIdx].cartonNo;
    list.splice(cartonIdx, 1);
    setCustomCartons(list);
    setSuccessMessage(`Deleted Carton #${cNo}.`);
  };

  // Reset all custom edits back to Auto-Packing calculations
  const handleResetCartonsToAuto = () => {
    setCustomCartons(null);
    setSuccessMessage('Reset all cartons and labels to factory auto-calculated setup.');
  };

  // =========================================================================
  // CALCULATIONS & FILTERS
  // =========================================================================

  // Stock check calculations
  const stockCheckStats = useMemo(() => {
    if (!soData) return { totalToolItems: 0, totalPromoItems: 0, shortagesCount: 0, totalUnits: 0, totalDispatchUnits: 0, partialItemsCount: 0 };
    let totalToolItems = 0;
    let totalPromoItems = 0;
    let shortagesCount = 0;
    let totalUnits = 0;
    let totalDispatchUnits = 0;
    let partialItemsCount = 0;

    soData.items.forEach(item => {
      const ordered = Math.round(item.orderedQty);
      const dispatch = typeof item.dispatchQty === 'number' ? Math.round(item.dispatchQty) : ordered;
      totalUnits += ordered;
      totalDispatchUnits += dispatch;
      if (dispatch < ordered) {
        partialItemsCount += 1;
      }

      if (item.isPromoOrNonStock) {
        totalPromoItems += 1;
      } else {
        totalToolItems += 1;
        if (item.matchedSku) {
          const currentStock = Math.round(item.matchedSku.current_stock);
          if (currentStock < dispatch) {
            shortagesCount += 1;
          }
        } else {
          shortagesCount += 1;
        }
      }
    });

    return { totalToolItems, totalPromoItems, shortagesCount, totalUnits, totalDispatchUnits, partialItemsCount };
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

      const ordered = Math.round(item.orderedQty);
      const dispatch = typeof item.dispatchQty === 'number' ? Math.round(item.dispatchQty) : ordered;

      if (stockFilter === 'TOOLS') return !item.isPromoOrNonStock;
      if (stockFilter === 'PROMO') return item.isPromoOrNonStock;
      if (stockFilter === 'PARTIAL') return dispatch < ordered;
      if (stockFilter === 'SHORTAGE') {
        if (item.isPromoOrNonStock) return false;
        const current = item.matchedSku ? Math.round(item.matchedSku.current_stock) : 0;
        return current < dispatch;
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

  // Promo items in current order
  const promoItemsList = useMemo(() => {
    if (!soData) return [];
    return soData.items.filter(it => it.isPromoOrNonStock);
  }, [soData]);

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
          input {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
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
            Factory floor workflow: Upload Tally SO, verify physical stock, in-line Stock IN, partial dispatches, carton assignment, and editable box labels.
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
      {/* CLEAN EMPTY STATE: WHEN NO SO IS LOADED YET                               */}
      {/* ========================================================================= */}
      {!soData && (
        <div className="space-y-8 animate-in fade-in duration-200">
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

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Auto-reads PI#, Party, State Code</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Quick Stock IN & Partial Shipment</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Promo Items Packed in Final Bottom Box</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Editable Carton Fields & Box Stickers</span>
              </span>
            </div>
          </div>

          {/* Past Dispatches Section */}
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
                        title="Restore stock for this PI"
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
              { step: 2, label: '2. Stock Check & Partial IN', sub: isDeducted ? 'Stock Deducted ✅' : `${stockCheckStats.totalDispatchUnits} Units To Dispatch` },
              { step: 3, label: '3. Packing Box Setup', sub: 'Units/Box & Last Box Promo' },
              { step: 4, label: '4. Editable List & Labels', sub: activeSummary ? `${activeSummary.totalBoxes} Boxes (${activeSummary.totalGrossWeight} Kg)` : 'View & Print' },
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

          {/* STEP 2: STOCK CHECK, PARTIAL DISPATCH & QUICK STOCK IN */}
          {activeStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-slate-900 dark:text-white">
                      Stock Verification & Dispatch for PI #{soData.piNumber}
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
                    Ordered: {stockCheckStats.totalUnits} Units • <strong className="text-orange-600 dark:text-orange-400">Dispatching: {stockCheckStats.totalDispatchUnits} Units</strong>
                    {stockCheckStats.partialItemsCount > 0 && ` (${stockCheckStats.partialItemsCount} partial fulfillment lines)`}
                  </p>
                </div>

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
                      <span>Confirm SO & Minus Stock ({stockCheckStats.totalDispatchUnits} Units)</span>
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
                  {stockCheckStats.partialItemsCount > 0 && (
                    <button
                      onClick={() => setStockFilter('PARTIAL')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        stockFilter === 'PARTIAL'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      Partial ({stockCheckStats.partialItemsCount})
                    </button>
                  )}
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

              {/* SO Stock Check Table with Partial Dispatch & Quick IN Options */}
              <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-bold text-slate-600 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/80">
                      <th className="w-[5%] py-3.5 px-2 text-center">#</th>
                      <th className="w-[33%] py-3.5 px-3">Item Name</th>
                      <th className="w-[10%] py-3.5 px-2 text-right">Order Qty</th>
                      <th className="w-[14%] py-3.5 px-3 text-right">Godown Stock</th>
                      <th className="w-[24%] py-3.5 px-3 text-center">Dispatch Qty (Partial Option)</th>
                      <th className="w-[14%] py-3.5 px-2 text-center">Status & Stock IN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
                    {filteredItems.map((item) => {
                      const orderedQty = Math.round(item.orderedQty);
                      const dispatchQty = typeof item.dispatchQty === 'number' ? Math.round(item.dispatchQty) : orderedQty;
                      const isPromo = item.isPromoOrNonStock;
                      const matchedSku = item.matchedSku;
                      const currentStock = matchedSku ? Math.round(matchedSku.current_stock) : null;
                      const isStockAvailable = currentStock !== null && currentStock >= dispatchQty;
                      const isPartial = dispatchQty < orderedQty;
                      const hasShortage = !isPromo && currentStock !== null && currentStock < dispatchQty;

                      return (
                        <tr key={item.slNo} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          {/* 1. Sl No. */}
                          <td className="py-3 px-2 w-[5%] text-center font-mono font-bold text-slate-500">
                            {item.slNo}
                          </td>

                          {/* 2. Item Name */}
                          <td className="py-3 px-3 w-[33%]">
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
                          <td className="py-3 px-2 w-[10%] text-right font-mono font-black text-slate-900 dark:text-white text-base tabular-nums">
                            {orderedQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">Pcs</span>
                          </td>

                          {/* 4. Current Stock in Godown */}
                          <td className="py-3 px-3 w-[14%] text-right font-mono tabular-nums">
                            {isPromo ? (
                              <span className="text-slate-400 text-xs italic">—</span>
                            ) : currentStock !== null ? (
                              <div className="flex flex-col items-end">
                                <span className={`text-base font-black ${
                                  currentStock < dispatchQty 
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
                              <span className="text-amber-600 font-semibold text-xs">Not in Master</span>
                            )}
                          </td>

                          {/* 5. Dispatch Qty (Partial Option & Buttons) */}
                          <td className="py-3 px-3 w-[24%] text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Send:</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={orderedQty}
                                  step={1}
                                  value={dispatchQty}
                                  onChange={(e) => handleUpdateDispatchQty(item.slNo, Number(e.target.value))}
                                  className={`w-20 rounded-lg border px-2 py-1 text-center font-mono font-bold text-xs focus:outline-hidden dark:bg-slate-800 ${
                                    isPartial
                                      ? 'border-amber-400 bg-amber-50/70 text-amber-900 dark:text-amber-200'
                                      : 'border-slate-300 bg-white text-slate-900 dark:text-white'
                                  }`}
                                />
                                <span className="text-xs text-slate-400 font-mono">Pcs</span>
                              </div>

                              {/* Quick Action Buttons: Ship Available or Ship Full */}
                              <div className="flex items-center gap-1">
                                {!isPromo && currentStock !== null && currentStock < orderedQty && currentStock > 0 && (
                                  <button
                                    onClick={() => handleShipAvailable(item)}
                                    className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 transition"
                                    title={`Send only available ${currentStock} units now`}
                                  >
                                    Ship Available ({currentStock})
                                  </button>
                                )}
                                {dispatchQty < orderedQty && (
                                  <button
                                    onClick={() => handleShipFull(item)}
                                    className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition"
                                    title="Send full ordered quantity"
                                  >
                                    Ship Full ({orderedQty})
                                  </button>
                                )}
                              </div>

                              {/* Partial Dispatch Badge */}
                              {isPartial && (
                                <div className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300">
                                  Partial ({dispatchQty}/{orderedQty}) • Pending: {orderedQty - dispatchQty}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 6. Status & Quick IN Button */}
                          <td className="py-3 px-2 w-[14%] text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              {isPromo ? (
                                <span className="inline-flex items-center rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                  Promo / Non-Stock
                                </span>
                              ) : isStockAvailable ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Available ✅</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>Shortage ⚠️</span>
                                </span>
                              )}

                              {/* Quick Stock IN Action Button */}
                              {!isPromo && matchedSku && (
                                <button
                                  onClick={() => handleOpenQuickIn(item)}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition shadow-2xs active:scale-95 ${
                                    hasShortage
                                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 animate-pulse'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
                                  }`}
                                  title="Add physical stock to Godown for this item right here"
                                >
                                  <PackagePlus className="h-3 w-3" />
                                  <span>+ Stock IN</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: BOX PACKAGING CONFIGURATION & PROMO LAST BOX ALLOCATION */}
          {activeStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Step 3: Box Packaging Configuration & Allocation
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Assign items to boxes (Box #), configure Units/Box and Gross Weights. Promo items are packed together in the Last Box.
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
                    onClick={handlePackPromoIntoLastCarton}
                    className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300 transition"
                  >
                    <Boxes className="h-3.5 w-3.5 text-purple-600" />
                    <span>Group Promo in Last Box</span>
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

              {/* NON-STOCK & PROMOTIONAL ITEMS CARD: ALWAYS PACKED IN LAST BOX */}
              {promoItemsList.length > 0 && (
                <div className="rounded-2xl border-2 border-purple-200 bg-purple-50/50 p-5 shadow-xs dark:border-purple-900/60 dark:bg-purple-950/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-purple-200 dark:border-purple-900/50 gap-2">
                    <div className="flex items-center gap-2">
                      <Boxes className="h-4 w-4 text-purple-600" />
                      <h3 className="text-sm font-extrabold text-purple-900 dark:text-purple-200">
                        📦 Non-Stock & Promotional Items Allocation (Always Packed in Final / Last Box)
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSelectAllPromoForLastBox(true)}
                        className="text-[11px] font-bold text-purple-700 hover:text-purple-900 dark:text-purple-300 underline"
                      >
                        Select All
                      </button>
                      <span className="text-purple-300">•</span>
                      <button
                        onClick={() => handleSelectAllPromoForLastBox(false)}
                        className="text-[11px] font-bold text-purple-700 hover:text-purple-900 dark:text-purple-300 underline"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-purple-800/80 dark:text-purple-300/80 mt-2">
                    Factory Rule: Non-inventory items (Notepads, Pens, Pop Sockets, Catalogues, etc.) are bundled together in the <strong>very last box</strong> and appear at the bottom of the packing list and final box sticker.
                  </p>

                  {/* Promo items selector pills */}
                  <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {promoItemsList.map(item => {
                      const isSelected = item.selectedForLastBox !== false;
                      const dispatchQty = typeof item.dispatchQty === 'number' ? Math.round(item.dispatchQty) : Math.round(item.orderedQty);
                      return (
                        <div
                          key={item.slNo}
                          onClick={() => handleTogglePromoForLastBox(item.slNo)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border-2 cursor-pointer transition select-none ${
                            isSelected
                              ? 'border-purple-500 bg-white text-purple-950 shadow-2xs dark:bg-purple-900/40 dark:text-white'
                              : 'border-slate-200 bg-slate-50 text-slate-400 opacity-60 dark:border-slate-800 dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by div
                              className="rounded border-purple-400 text-purple-600 focus:ring-0"
                            />
                            <span className="text-xs font-bold truncate max-w-[170px]" title={item.cleanItemName}>
                              {item.cleanItemName}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300 shrink-0">
                            {dispatchQty} Pcs
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Combined Box Gross Weight for Last Box */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-purple-200/80 dark:border-purple-900/40">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                        Final Box Gross Weight:
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step={0.05}
                          min={0.5}
                          value={promoItemsList[0]?.mixedCartonGrossWeight || 6.50}
                          onChange={(e) => handleUpdatePromoBoxWeight(Number(e.target.value))}
                          className="w-20 rounded-lg border border-purple-300 bg-white px-2 py-1 text-center font-mono font-bold text-xs text-purple-900 focus:outline-hidden dark:bg-slate-900 dark:text-purple-200"
                        />
                        <span className="text-xs font-mono text-purple-700">Kg</span>
                      </div>
                    </div>

                    <div className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
                      Placement: <strong>Last Box (Bottom of Packaging List)</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Packing Configuration Table */}
              <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-bold text-slate-600 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/80">
                      <th className="w-[30%] py-3.5 px-4">Item Name</th>
                      <th className="w-[12%] py-3.5 px-3 text-right">Dispatch Qty</th>
                      <th className="w-[18%] py-3.5 px-3 text-center">Units Per Box (Pcs)</th>
                      <th className="w-[18%] py-3.5 px-3 text-center">Gross Wt / Box (Kg)</th>
                      <th className="w-[22%] py-3.5 px-3 text-center">Box Assignment / Output</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
                    {soData.items.map((item) => {
                      const dispatchQty = typeof item.dispatchQty === 'number' ? Math.round(item.dispatchQty) : Math.round(item.orderedQty);
                      const unitsPerBox = Math.max(1, Math.round(item.unitsPerBox || dispatchQty));
                      const estimatedBoxes = Math.ceil(dispatchQty / unitsPerBox);

                      return (
                        <tr key={item.slNo} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          {/* Item Name */}
                          <td className="py-3.5 px-4 w-[30%]">
                            <div className="font-bold text-slate-900 dark:text-white whitespace-normal break-words leading-snug">
                              {item.cleanItemName}
                            </div>
                            {item.isPromoOrNonStock && (
                              <span className="inline-block mt-0.5 rounded bg-purple-50 text-[10px] font-bold text-purple-700 border border-purple-200 px-1.5 py-0.2 dark:bg-purple-950 dark:text-purple-300">
                                Promo / Non-Stock (Last Box)
                              </span>
                            )}
                          </td>

                          {/* Dispatch Qty */}
                          <td className="py-3.5 px-3 w-[12%] text-right font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {dispatchQty.toLocaleString()} Pcs
                            {item.dispatchQty !== undefined && item.dispatchQty < item.orderedQty && (
                              <div className="text-[10px] font-normal text-amber-600">
                                of {item.orderedQty}
                              </div>
                            )}
                          </td>

                          {/* Units Per Box (Pcs) */}
                          <td className="py-3.5 px-3 w-[18%] text-center">
                            {item.isMixedCarton || item.isPromoOrNonStock ? (
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded dark:bg-purple-950 dark:text-purple-300">
                                  {item.isPromoOrNonStock ? 'Shared Final Box' : `Mixed in Carton #${item.mixedCartonNo || '?'}`}
                                </span>
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

                          {/* Gross Weight Per Box (Kg) */}
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

                          {/* Box Assignment Selection ("konsi item konse box mein dalni") */}
                          <td className="py-3.5 px-3 w-[22%] text-center">
                            {item.isPromoOrNonStock ? (
                              <div className="flex flex-col items-center">
                                <span className="rounded-md bg-purple-100 border border-purple-300 px-2.5 py-1 text-xs font-extrabold text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-mono">
                                  Final Box (Bottom)
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">Box #:</span>
                                  <input
                                    type="text"
                                    placeholder="Auto"
                                    value={item.assignedBoxNo || ''}
                                    onChange={(e) => handleAssignItemToBox(item.slNo, e.target.value)}
                                    className="w-16 rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center font-mono font-bold text-xs text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    title="Assign this item to a specific carton number (e.g. 1, 2, 7...)"
                                  />
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {item.assignedBoxNo 
                                    ? (estimatedBoxes > 1
                                        ? `Boxes #${item.assignedBoxNo}–#${Number(item.assignedBoxNo) + estimatedBoxes - 1} (${estimatedBoxes} boxes × ${item.grossWeightPerBox} kg)`
                                        : `Carton #${item.assignedBoxNo} (${item.grossWeightPerBox} kg)`)
                                    : `${estimatedBoxes} ${estimatedBoxes === 1 ? 'Box' : 'Boxes'} (${item.grossWeightPerBox} kg each)`}
                                </span>
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

          {/* STEP 4: EDITABLE PACKING LIST & LABELS (VIEW, PRINT & .XLSX DOWNLOAD) */}
          {activeStep === 4 && activeSummary && (
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
                    <span>Output 1: Packaging List (Editable Sheet1)</span>
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
                    <span>Output 2: Box Labels / Stickers ({activeSummary.totalBoxes} Labels)</span>
                  </button>
                </div>

                {/* Edit & Print & Download Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {customCartons && (
                    <button
                      onClick={handleResetCartonsToAuto}
                      className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
                      title="Reset manual box edits to auto packing calculations"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                      <span>Reset to Auto</span>
                    </button>
                  )}

                  <button
                    onClick={handleAddCustomCarton}
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Add Box</span>
                  </button>

                  {outputTab === 'packing-list' ? (
                    <>
                      <button
                        onClick={() => exportPackagingListToExcel(activeSummary)}
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
                      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                        <button
                          onClick={() => setLabelViewMode('all-grid')}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                            labelViewMode === 'all-grid'
                              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          All ({activeSummary.totalBoxes})
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
                        onClick={() => exportLabelsToExcel(activeSummary)}
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

              {/* OUTPUT 1: EDITABLE PACKAGING LIST TABLE */}
              {outputTab === 'packing-list' && (
                <div className="rounded-2xl border-2 border-slate-300 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 font-sans">
                  {/* Header: Party Name & PI Number */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b-2 border-slate-800 gap-2 font-mono">
                    <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      <span className="text-slate-500">Party Name :</span>
                      <span className="font-extrabold uppercase">{activeSummary.partyName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      <div>
                        <span className="text-slate-500">PI : </span>
                        <span className="font-extrabold">{activeSummary.piNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Mark: </span>
                        <span className="text-orange-700 dark:text-orange-400 font-extrabold">{activeSummary.shippingMark}</span>
                      </div>
                    </div>
                  </div>

                  {/* Informational Hint about Editing */}
                  <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 font-mono no-print">
                    <span className="flex items-center gap-1">
                      <Edit3 className="h-3.5 w-3.5 text-orange-600" />
                      <span>All cells below are editable in real-time. Changes are automatically included in Excel download and printing.</span>
                    </span>
                    {customCartons && (
                      <span className="text-orange-600 font-bold">Custom Edits Active</span>
                    )}
                  </div>

                  {/* Table (Carton No. | Item Name | Qty | Gross Wt. | Actions) */}
                  <div className="mt-3 overflow-hidden">
                    <table className="w-full table-fixed border-collapse text-left border border-slate-300 dark:border-slate-700">
                      <thead>
                        <tr className="border-b-2 border-slate-300 bg-slate-100 text-xs sm:text-sm font-extrabold text-slate-800 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          <th className="w-[14%] py-3 px-3 text-center border-r border-slate-300 dark:border-slate-700">
                            Carton No.
                          </th>
                          <th className="w-[50%] py-3 px-4 border-r border-slate-300 dark:border-slate-700">
                            Item Name
                          </th>
                          <th className="w-[14%] py-3 px-3 text-right border-r border-slate-300 dark:border-slate-700">
                            Qty
                          </th>
                          <th className="w-[14%] py-3 px-4 text-right border-r border-slate-300 dark:border-slate-700">
                            Gross Wt. (Kg)
                          </th>
                          <th className="w-[8%] py-3 px-2 text-center no-print">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60 font-mono text-xs sm:text-sm">
                        {activeSummary.cartons.map((carton, cartonIdx) => {
                          const isPromoBox = carton.items.some(it => it.isPromoOrNonStock);

                          return carton.items.map((item, itemIdx) => {
                            const isFirstItemOfCarton = itemIdx === 0;

                            return (
                              <tr 
                                key={item.id || `c-${cartonIdx}-i-${itemIdx}`} 
                                className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                                  isPromoBox ? 'bg-purple-50/30 dark:bg-purple-950/10' : ''
                                }`}
                              >
                                {/* Carton No (Editable on first row of carton) */}
                                <td className="py-2 px-2 text-center font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                                  {isFirstItemOfCarton ? (
                                    <input
                                      type="number"
                                      min={1}
                                      value={carton.cartonNo}
                                      onChange={(e) => handleUpdateCartonField(cartonIdx, 'cartonNo', e.target.value)}
                                      className="w-16 rounded border border-transparent hover:border-slate-300 focus:border-orange-500 bg-transparent px-1 py-0.5 text-center font-bold text-slate-900 dark:text-white focus:outline-hidden"
                                    />
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-600">↳</span>
                                  )}
                                </td>

                                {/* Item Name (Editable) */}
                                <td className="py-2 px-3 font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 whitespace-normal break-words">
                                  <input
                                    type="text"
                                    value={item.cleanName}
                                    onChange={(e) => handleUpdateCartonItemField(cartonIdx, itemIdx, 'cleanName', e.target.value)}
                                    className="w-full rounded border border-transparent hover:border-slate-300 focus:border-orange-500 bg-transparent px-1.5 py-0.5 font-bold text-slate-900 dark:text-white focus:outline-hidden uppercase"
                                  />
                                </td>

                                {/* Qty (Editable) */}
                                <td className="py-2 px-2 text-right font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 tabular-nums">
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.qty}
                                    onChange={(e) => handleUpdateCartonItemField(cartonIdx, itemIdx, 'qty', e.target.value)}
                                    className="w-16 rounded border border-transparent hover:border-slate-300 focus:border-orange-500 bg-transparent px-1 py-0.5 text-right font-bold text-slate-900 dark:text-white focus:outline-hidden tabular-nums"
                                  />
                                </td>

                                {/* Gross Wt (Editable on first row of carton) */}
                                <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 tabular-nums">
                                  {isFirstItemOfCarton ? (
                                    <input
                                      type="number"
                                      step={0.01}
                                      min={0}
                                      value={carton.grossWeightKg}
                                      onChange={(e) => handleUpdateCartonField(cartonIdx, 'grossWeightKg', e.target.value)}
                                      className="w-20 rounded border border-transparent hover:border-slate-300 focus:border-orange-500 bg-transparent px-1 py-0.5 text-right font-bold text-slate-900 dark:text-white focus:outline-hidden tabular-nums"
                                    />
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-600">—</span>
                                  )}
                                </td>

                                {/* Row Actions (Delete item / carton) */}
                                <td className="py-2 px-2 text-center no-print">
                                  <div className="flex items-center justify-center gap-1">
                                    {isFirstItemOfCarton && (
                                      <button
                                        onClick={() => handleAddCartonItem(cartonIdx)}
                                        className="text-slate-400 hover:text-indigo-600 p-1"
                                        title="Add another item to this carton"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteCartonItem(cartonIdx, itemIdx)}
                                      className="text-slate-400 hover:text-rose-600 p-1"
                                      title="Delete this row"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        })}

                        {/* Total Row */}
                        <tr className="border-t-2 border-slate-800 bg-slate-50 dark:bg-slate-800/70 font-bold">
                          <td className="py-3 px-3 text-center border-r border-slate-300 dark:border-slate-700 text-sm">
                            Total
                          </td>
                          <td className="py-3 px-4 border-r border-slate-300 dark:border-slate-700"></td>
                          <td className="py-3 px-3 text-right border-r border-slate-300 dark:border-slate-700 tabular-nums text-sm font-black">
                            {activeSummary.totalUnits.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-sm font-black border-r border-slate-300 dark:border-slate-700">
                            {activeSummary.totalGrossWeight.toFixed(2)}
                          </td>
                          <td className="no-print"></td>
                        </tr>

                        {/* Total Boxes Row */}
                        <tr className="bg-slate-50 dark:bg-slate-800/70 font-extrabold text-sm sm:text-base">
                          <td className="py-3 px-3 text-center border-r border-slate-300 dark:border-slate-700"></td>
                          <td className="py-3 px-4 border-r border-slate-300 dark:border-slate-700"></td>
                          <td className="py-3 px-3 text-right border-r border-slate-300 dark:border-slate-700"></td>
                          <td className="py-3 px-4 text-right text-orange-700 dark:text-orange-400 font-mono border-r border-slate-300 dark:border-slate-700">
                            {activeSummary.totalBoxes} BOX
                          </td>
                          <td className="no-print"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* OUTPUT 2: EDITABLE BOX LABELS / CARTON STICKERS */}
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
                          Carton #{activeSummary.cartons[currentCartonIndex]?.cartonNo}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          ({currentCartonIndex + 1} of {activeSummary.totalBoxes})
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
                          onClick={() => setCurrentCartonIndex(prev => Math.min(activeSummary.cartons.length - 1, prev + 1))}
                          disabled={currentCartonIndex === activeSummary.cartons.length - 1}
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
                    {(labelViewMode === 'all-grid' ? activeSummary.cartons : [activeSummary.cartons[currentCartonIndex]]).map((carton, cartonIdx) => {
                      if (!carton) return null;
                      const realCartonIdx = labelViewMode === 'all-grid' ? cartonIdx : currentCartonIndex;
                      const isPromoBox = carton.items.some(it => it.isPromoOrNonStock);

                      return (
                        <div
                          key={carton.id || `carton-label-${carton.cartonNo}`}
                          className={`rounded-2xl border-4 bg-white p-5 shadow-md dark:bg-slate-900 font-sans print-page-break relative ${
                            isPromoBox ? 'border-purple-600 dark:border-purple-400' : 'border-slate-900 dark:border-slate-200'
                          }`}
                        >
                          {/* Promo Last Box Badge */}
                          {isPromoBox && (
                            <div className="absolute top-2 right-2 rounded bg-purple-100 text-purple-800 text-[10px] font-black uppercase px-2 py-0.5 no-print">
                              Final Promo Box (Bottom)
                            </div>
                          )}

                          {/* Header Block: Carton# | Shipping Mark | PI# (Editable) */}
                          <div className="grid grid-cols-3 border-b-2 border-slate-900 pb-3 dark:border-slate-200 font-mono">
                            <div>
                              <div className="text-[11px] font-bold text-slate-500 uppercase">Carton#</div>
                              <input
                                type="number"
                                min={1}
                                value={carton.cartonNo}
                                onChange={(e) => handleUpdateCartonField(realCartonIdx, 'cartonNo', e.target.value)}
                                className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 w-20 bg-transparent border-b border-dashed border-slate-300 focus:outline-hidden"
                              />
                            </div>

                            <div className="text-center">
                              <div className="text-[11px] font-bold text-slate-500 uppercase">Shipping Mark</div>
                              <input
                                type="text"
                                value={carton.shippingMark}
                                onChange={(e) => handleUpdateCartonField(realCartonIdx, 'shippingMark', e.target.value)}
                                className="text-base sm:text-lg font-black text-orange-700 dark:text-orange-400 mt-0.5 text-center w-full bg-transparent border-b border-dashed border-orange-300 focus:outline-hidden uppercase"
                              />
                            </div>

                            <div className="text-right">
                              <div className="text-[11px] font-bold text-slate-500 uppercase">PI#</div>
                              <input
                                type="text"
                                value={carton.piNumber}
                                onChange={(e) => handleUpdateCartonField(realCartonIdx, 'piNumber', e.target.value)}
                                className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 text-right w-20 bg-transparent border-b border-dashed border-slate-300 focus:outline-hidden ml-auto block"
                              />
                            </div>
                          </div>

                          {/* Table Block: S# | Product/Size | Quantity (Nos) | Weight (Kg) (Editable) */}
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
                                      <input
                                        type="text"
                                        value={item.cleanName}
                                        onChange={(e) => handleUpdateCartonItemField(realCartonIdx, idx, 'cleanName', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-500 focus:outline-hidden uppercase font-extrabold"
                                      />
                                    </td>
                                    <td className="py-2 px-1 text-right font-black text-slate-900 dark:text-white tabular-nums">
                                      <input
                                        type="number"
                                        min={0}
                                        value={item.qty}
                                        onChange={(e) => handleUpdateCartonItemField(realCartonIdx, idx, 'qty', e.target.value)}
                                        className="w-16 text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-500 focus:outline-hidden font-black tabular-nums"
                                      />
                                    </td>
                                    <td className="py-2 px-2 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                                      <input
                                        type="number"
                                        step={0.01}
                                        min={0}
                                        value={carton.items.length === 1 ? carton.grossWeightKg : item.weightKg}
                                        onChange={(e) => {
                                          if (carton.items.length === 1) {
                                            handleUpdateCartonField(realCartonIdx, 'grossWeightKg', e.target.value);
                                          } else {
                                            handleUpdateCartonItemField(realCartonIdx, idx, 'weightKg', e.target.value);
                                          }
                                        }}
                                        className="w-16 text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-500 focus:outline-hidden font-bold tabular-nums"
                                      />
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
                                    <input
                                      type="number"
                                      step={0.01}
                                      value={carton.grossWeightKg}
                                      onChange={(e) => handleUpdateCartonField(realCartonIdx, 'grossWeightKg', e.target.value)}
                                      className="w-20 text-right bg-transparent border-b border-slate-300 font-black tabular-nums focus:outline-hidden"
                                    />
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Footer Card Controls */}
                          <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 no-print">
                            <button
                              onClick={() => handleAddCartonItem(realCartonIdx)}
                              className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              <span>+ Add Item to Label</span>
                            </button>

                            <button
                              onClick={() => handleDeleteCarton(realCartonIdx)}
                              className="text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete Label</span>
                            </button>
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

      {/* ========================================================================= */}
      {/* QUICK STOCK IN MODAL (RECEIVE STOCK RIGHT INSIDE SALES ORDER)             */}
      {/* ========================================================================= */}
      {quickInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <PackagePlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Quick Stock IN (Receive Inventory)
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Instantly add Godown stock for SO PI #{soData?.piNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickInModal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Item Details */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Item Name</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {quickInModal.item.cleanItemName}
                </div>
                {quickInModal.item.matchedSku && (
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    SKU: {quickInModal.item.matchedSku.sku_code} • {quickInModal.item.matchedSku.division}
                  </div>
                )}
              </div>

              {/* Current Stock vs Ordered vs Shortage */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Current Stock</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                    {quickInModal.item.matchedSku ? Math.round(quickInModal.item.matchedSku.current_stock).toLocaleString() : 0}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Order Qty</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                    {Math.round(quickInModal.item.orderedQty).toLocaleString()}
                  </div>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-950 dark:bg-rose-950/40">
                  <div className="text-[11px] font-bold text-rose-600 uppercase">Shortage</div>
                  <div className="text-lg font-black text-rose-700 dark:text-rose-300 mt-0.5 font-mono">
                    {Math.max(0, Math.round(quickInModal.item.orderedQty) - (quickInModal.item.matchedSku ? Math.round(quickInModal.item.matchedSku.current_stock) : 0)).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Input: Qty to Stock IN */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Quantity to IN (Units to Add to Godown Stock) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={quickInModal.inQty}
                    onChange={(e) => setQuickInModal({ ...quickInModal, inQty: Math.max(1, Math.round(Number(e.target.value))) })}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="e.g. 400"
                    autoFocus
                  />
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    Pcs
                  </span>
                </div>
              </div>

              {/* Input: Reason */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Transaction Remark / Source
                </label>
                <input
                  type="text"
                  value={quickInModal.reason}
                  onChange={(e) => setQuickInModal({ ...quickInModal, reason: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  placeholder="e.g. Received from Production Line / Supplier"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setQuickInModal(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmQuickIn}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 active:scale-95 transition shadow-sm"
              >
                <PackagePlus className="h-4 w-4" />
                <span>Confirm Stock IN (+{quickInModal.inQty} Pcs)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
