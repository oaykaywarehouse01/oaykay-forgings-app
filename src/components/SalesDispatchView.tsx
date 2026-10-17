import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Boxes, 
  Printer, 
  Download, 
  Truck, 
  ArrowRight, 
  Undo2, 
  Tag, 
  PackageCheck, 
  Copy, 
  Check, 
  X, 
  History, 
  Eye, 
  Plus, 
  Trash2, 
  RotateCcw,
  Link2,
  SlidersHorizontal,
  Scale,
  Layers,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { useInventoryStore, DeductedSOInfo } from '../store/useInventoryStore';
import { 
  SalesOrderData, 
  SalesOrderItem, 
  PackingListSummary, 
  Carton,
  CartonItem,
  SkuItem
} from '../types/inventory';
import { 
  parseSalesOrderExcel, 
  generateCartonsAndPackagingList, 
  exportPackagingListToExcel, 
  exportLabelsToExcel 
} from '../lib/salesOrderParser';

interface QuickInModalState {
  item: SalesOrderItem;
  inQty: number;
  reason: string;
}

interface SkuMappingModalState {
  item: SalesOrderItem;
}

interface NegativeStockModalState {
  isOpen: boolean;
  negativeItems: Array<{
    item: SalesOrderItem;
    currentStock: number;
    dispatchQty: number;
    newStock: number;
  }>;
}

export const SalesDispatchView: React.FC = () => {
  const { 
    skus, 
    deductSalesOrderStock, 
    undoDeductSalesOrderStock, 
    deductedSalesOrders,
    recordTransaction 
  } = useInventoryStore();

  // Active Sales Order state
  const [soData, setSoData] = useState<SalesOrderData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedMark, setCopiedMark] = useState(false);

  // Quick Stock IN Modal state
  const [quickInModal, setQuickInModal] = useState<QuickInModalState | null>(null);

  // Negative Stock Confirmation Modal state
  const [negativeStockModal, setNegativeStockModal] = useState<NegativeStockModalState | null>(null);

  // SKU Manual Mapping Modal state
  const [skuMappingModal, setSkuMappingModal] = useState<SkuMappingModalState | null>(null);
  const [skuSearchQuery, setSkuSearchQuery] = useState('');

  // Direct typing map to allow backspace/clearing numeric inputs without forcing 0/1
  const [rawInputMap, setRawInputMap] = useState<Record<string, string>>({});

  // Editable Cartons state in Section C (Packing list & Labels manual overrides)
  const [customCartons, setCustomCartons] = useState<Carton[] | null>(null);

  // Output view switcher in Section C ('packing-list' | 'box-labels')
  const [outputTab, setOutputTab] = useState<'packing-list' | 'box-labels'>('packing-list');
  const [labelViewMode, setLabelViewMode] = useState<'all-grid' | 'single-carousel'>('all-grid');
  const [currentCartonIndex, setCurrentCartonIndex] = useState<number>(0);

  // =========================================================================
  // INTERACTIVE MANUAL BOX BUILDER STATE (Dedicated Top Panel)
  // =========================================================================
  const [builderItemSlNo, setBuilderItemSlNo] = useState<number | ''>('');
  const [builderUnitsPerBox, setBuilderUnitsPerBox] = useState<string>('10');
  const [builderGrossWeight, setBuilderGrossWeight] = useState<string>('10.00');
  const [builderStartBox, setBuilderStartBox] = useState<string>('');
  const [builderDispatchQty, setBuilderDispatchQty] = useState<string>('');
  const [isBuilderExpanded, setIsBuilderExpanded] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const boxBuilderRef = useRef<HTMLDivElement>(null);

  // Handle uploading user's Tally SO Excel file
  const processUploadedFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setSuccessMessage(null);
    setCustomCartons(null);
    setRawInputMap({});

    try {
      const parsed = await parseSalesOrderExcel(file, skus);
      setSoData(parsed);
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
    setUploadError(null);
    setSuccessMessage(null);
    setCurrentCartonIndex(0);
    setCustomCartons(null);
    setQuickInModal(null);
    setNegativeStockModal(null);
    setSkuMappingModal(null);
    setRawInputMap({});
    setBuilderItemSlNo('');
  };

  // Re-open a past dispatched order from history
  const handleReopenPastOrder = (info: DeductedSOInfo) => {
    setCustomCartons(null);
    setRawInputMap({});
    if (info.soDataSnapshot) {
      setSoData(info.soDataSnapshot);
      setSuccessMessage(`Opened past dispatched order PI #${info.piNumber} (${info.partyName}).`);
    } else {
      const reconstructedItems: SalesOrderItem[] = (info.deductions || []).map((d, idx) => ({
        slNo: idx + 1,
        rawItemName: d.cleanName,
        cleanItemName: d.cleanName,
        orderedQty: d.qtyDeducted,
        dispatchQty: d.qtyDeducted,
        matchedSku: skus.find(s => s.id === d.skuId || s.sku_code === d.skuCode) || null,
        isPromoOrNonStock: false,
        unitsPerBox: d.qtyDeducted,
        grossWeightPerBox: 10
      }));
      setSoData({
        piNumber: info.piNumber,
        orderDate: info.deductedAt ? info.deductedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        partyName: info.partyName,
        partyAbbr: info.partyName ? info.partyName.slice(0, 4).toUpperCase() : 'ORD',
        stateName: 'General',
        stateCode: '00',
        shippingMark: `${info.partyName ? info.partyName.slice(0, 4).toUpperCase() : 'ORD'}/DISPATCH`,
        items: reconstructedItems
      });
      setSuccessMessage(`Opened past dispatched order PI #${info.piNumber} (${info.partyName}).`);
    }
  };

  // Shipping Mark update handlers
  const handleCustomShippingMarkChange = (mark: string) => {
    if (!soData) return;
    setSoData({
      ...soData,
      shippingMark: mark
    });
    setCustomCartons(null);
  };

  const handleCopyShippingMark = () => {
    if (!soData) return;
    navigator.clipboard.writeText(soData.shippingMark);
    setCopiedMark(true);
    setTimeout(() => setCopiedMark(false), 2000);
  };

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
    setCustomCartons(null);

    // If builder currently has this item, sync builder dispatch qty
    if (builderItemSlNo === slNo) {
      const target = nextItems.find(i => i.slNo === slNo);
      if (target) {
        setBuilderDispatchQty(String(target.dispatchQty ?? target.orderedQty));
      }
    }
  };

  // Open Quick Stock IN Modal for Shortage Item
  const handleOpenQuickIn = (item: SalesOrderItem) => {
    const currentStock = item.matchedSku ? Math.round(item.matchedSku.current_stock) : 0;
    const dispatchQty = typeof item.dispatchQty === 'number' ? Math.round(item.dispatchQty) : Math.round(item.orderedQty);
    const shortage = Math.max(1, dispatchQty - currentStock);
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
              status: (newStock === 0 ? 'Zero Stock' : (newStock < 0 ? 'Negative' : 'In Stock')) as 'In Stock' | 'Zero Stock' | 'Negative'
            }
          };
        }
        return it;
      });
      setSoData({ ...soData, items: nextItems });
    }

    setSuccessMessage(`Stock IN successful! Added ${inQty} units to "${quickInModal.item.cleanItemName}".`);
    setQuickInModal(null);
  };

  // Manual SKU Linking Handler
  const handleMapSkuToItem = (sku: SkuItem) => {
    if (!skuMappingModal || !soData) return;
    const nextItems = soData.items.map(it => {
      if (it.slNo !== skuMappingModal.item.slNo) return it;
      return {
        ...it,
        matchedSku: sku,
        cleanItemName: sku.clean_name,
        isPromoOrNonStock: false
      };
    });
    setSoData({ ...soData, items: nextItems });
    setCustomCartons(null);
    setSuccessMessage(`Mapped Item #${skuMappingModal.item.slNo} to SKU: ${sku.clean_name} (Current Stock: ${Math.round(sku.current_stock)}).`);
    setSkuMappingModal(null);
  };

  // =========================================================================
  // STOCK DEDUCTION & NEGATIVE STOCK HANDLING
  // =========================================================================
  const isDeducted = soData ? Boolean(deductedSalesOrders[soData.piNumber]) : false;

  // Initiate stock deduction: Check if any item will result in negative warehouse stock
  const handleInitiateDeductStock = () => {
    if (!soData) return;

    const negativeItems: Array<{
      item: SalesOrderItem;
      currentStock: number;
      dispatchQty: number;
      newStock: number;
    }> = [];

    soData.items.forEach(item => {
      if (!item.matchedSku || item.isPromoOrNonStock) return;
      const currentStock = Math.round(item.matchedSku.current_stock);
      const dispatchQty = typeof item.dispatchQty === 'number' ? Math.round(item.dispatchQty) : Math.round(item.orderedQty);
      if (dispatchQty <= 0) return;
      const newStock = currentStock - dispatchQty;
      if (newStock < 0) {
        negativeItems.push({
          item,
          currentStock,
          dispatchQty,
          newStock
        });
      }
    });

    if (negativeItems.length > 0) {
      // Prompt user with authorization modal for negative stock
      setNegativeStockModal({
        isOpen: true,
        negativeItems
      });
    } else {
      // Stock is sufficient across all items, proceed directly
      handleConfirmDeductStock();
    }
  };

  const handleConfirmDeductStock = () => {
    if (!soData) return;
    const res = deductSalesOrderStock(soData);
    if (res.success) {
      setSuccessMessage(res.message);
      setNegativeStockModal(null);
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
  // INTERACTIVE QUICK BOX BUILDER LOGIC
  // =========================================================================
  // Initialize Quick Box Builder with first non-promo item
  useEffect(() => {
    if (soData && soData.items.length > 0 && builderItemSlNo === '') {
      const firstNonPromo = soData.items.find(i => !i.isPromoOrNonStock) || soData.items[0];
      if (firstNonPromo) {
        selectBuilderItem(firstNonPromo.slNo);
      }
    }
  }, [soData, builderItemSlNo]);

  const selectBuilderItem = (slNo: number) => {
    setBuilderItemSlNo(slNo);
    const it = soData?.items.find(i => i.slNo === slNo);
    if (it) {
      const qty = typeof it.dispatchQty === 'number' ? it.dispatchQty : it.orderedQty;
      setBuilderDispatchQty(String(qty));
      setBuilderUnitsPerBox(String(it.unitsPerBox || (qty > 10 ? 10 : qty) || 10));
      setBuilderGrossWeight(String(it.grossWeightPerBox || 10.00));
      setBuilderStartBox(it.assignedBoxNo !== null && it.assignedBoxNo !== undefined ? String(it.assignedBoxNo) : '');
    }
  };

  const handleSelectBuilderItemAndScroll = (slNo: number) => {
    selectBuilderItem(slNo);
    setIsBuilderExpanded(true);
    if (boxBuilderRef.current) {
      boxBuilderRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Live preview calculation for the selected item in Box Builder
  const builderPreview = useMemo(() => {
    if (!soData || builderItemSlNo === '') return null;
    const item = soData.items.find(i => i.slNo === builderItemSlNo);
    if (!item) return null;

    const totalQty = parseInt(builderDispatchQty, 10) || (typeof item.dispatchQty === 'number' ? Math.round(item.dispatchQty) : Math.round(item.orderedQty));
    const unitsPerBox = Math.max(1, parseInt(builderUnitsPerBox, 10) || totalQty);
    const grossWeight = parseFloat(builderGrossWeight) || 10.00;
    const startBoxNum = builderStartBox.trim() === '' ? null : Math.max(1, parseInt(builderStartBox, 10) || 1);

    if (totalQty <= 0) return null;

    const totalBoxes = Math.ceil(totalQty / unitsPerBox);
    const fullBoxes = Math.floor(totalQty / unitsPerBox);
    const remainderQty = totalQty % unitsPerBox;

    const boxesList: Array<{
      boxIndex: number;
      boxNumberDisplay: string;
      qty: number;
      grossWeight: number;
      isRemainder: boolean;
    }> = [];

    for (let b = 0; b < totalBoxes; b++) {
      const isRemainder = remainderQty > 0 && b === totalBoxes - 1;
      const boxQty = isRemainder ? remainderQty : unitsPerBox;
      const boxWeight = isRemainder 
        ? Number(((boxQty / unitsPerBox) * grossWeight).toFixed(2))
        : Number(grossWeight.toFixed(2));

      const boxNoDisplay = startBoxNum !== null ? `#${startBoxNum + b}` : `Auto (#${b + 1})`;

      boxesList.push({
        boxIndex: b + 1,
        boxNumberDisplay: boxNoDisplay,
        qty: boxQty,
        grossWeight: boxWeight,
        isRemainder
      });
    }

    return {
      item,
      totalQty,
      unitsPerBox,
      grossWeight,
      startBoxNum,
      totalBoxes,
      fullBoxes,
      remainderQty,
      boxesList
    };
  }, [soData, builderItemSlNo, builderUnitsPerBox, builderGrossWeight, builderStartBox, builderDispatchQty]);

  // Apply Builder configuration to active soData
  const handleApplyQuickBoxBuilder = () => {
    if (!soData || !builderPreview) return;
    const item = builderPreview.item;
    const newDispatchQty = parseInt(builderDispatchQty, 10) || (typeof item.dispatchQty === 'number' ? item.dispatchQty : item.orderedQty);

    const nextItems = soData.items.map(it => {
      if (it.slNo !== item.slNo) return it;
      return {
        ...it,
        dispatchQty: newDispatchQty,
        unitsPerBox: builderPreview.unitsPerBox,
        grossWeightPerBox: builderPreview.grossWeight,
        assignedBoxNo: builderPreview.startBoxNum
      };
    });

    setSoData({ ...soData, items: nextItems });
    setCustomCartons(null);
    setSuccessMessage(
      `Applied Box Setup for "${item.cleanItemName}": ${builderPreview.totalBoxes} Boxes (${builderPreview.unitsPerBox} Pcs/Box @ ${builderPreview.grossWeight} Kg) starting at Box ${builderPreview.startBoxNum !== null ? '#' + builderPreview.startBoxNum : 'Auto'}!`
    );
  };

  // Item packing input changes directly from table
  const handleUpdateItemPacking = (
    slNo: number, 
    field: 'unitsPerBox' | 'grossWeightPerBox' | 'assignedBoxNo',
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

  // Direct Box Assignment
  const handleAssignItemToBox = (slNo: number, boxNoStr: string) => {
    if (!soData) return;
    const boxNo = boxNoStr.trim() === '' ? null : Math.max(1, parseInt(boxNoStr, 10) || 1);
    handleUpdateItemPacking(slNo, 'assignedBoxNo', boxNo);
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
        units = qty >= 150 ? 150 : (qty >= 100 ? 100 : (qty >= 50 ? 50 : 10));
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
    setRawInputMap({});
    setSuccessMessage('Applied factory packaging defaults across all items.');
  };

  // Auto-generate summary from active soData
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

  // Clone customCartons for editing in Section C
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
  const handleAddItemToCarton = (cartonIdx: number) => {
    const list = getEditableCartonsClone();
    if (!list[cartonIdx]) return;
    list[cartonIdx].items.push({
      id: `custom-item-${Date.now()}`,
      slNo: list[cartonIdx].items.length + 1,
      rawName: 'CUSTOM PRODUCT / SIZE',
      cleanName: 'CUSTOM PRODUCT / SIZE',
      qty: 1,
      weightKg: 1.00,
      isPromoOrNonStock: false
    });
    list[cartonIdx].totalQty = list[cartonIdx].items.reduce((acc, it) => acc + it.qty, 0);
    list[cartonIdx].isMixed = list[cartonIdx].items.length > 1;
    setCustomCartons(list);
  };

  // Delete an item row from a carton
  const handleDeleteItemFromCarton = (cartonIdx: number, itemIdx: number) => {
    const list = getEditableCartonsClone();
    if (!list[cartonIdx]) return;
    if (list[cartonIdx].items.length <= 1) {
      list.splice(cartonIdx, 1);
    } else {
      list[cartonIdx].items.splice(itemIdx, 1);
      list[cartonIdx].items.forEach((it, idx) => {
        it.slNo = idx + 1;
      });
      list[cartonIdx].totalQty = list[cartonIdx].items.reduce((acc, it) => acc + it.qty, 0);
      list[cartonIdx].isMixed = list[cartonIdx].items.length > 1;
    }
    setCustomCartons(list);
  };

  // Print handlers
  const handlePrint = () => {
    window.print();
  };

  // 1-Click Excel Downloads
  const handleDownloadPackagingExcel = () => {
    if (!activeSummary) return;
    try {
      exportPackagingListToExcel(activeSummary);
      setSuccessMessage(`Downloaded Packaging List for PI #${activeSummary.piNumber}.`);
    } catch (err: any) {
      setUploadError('Failed to generate Excel download: ' + err.message);
    }
  };

  const handleDownloadLabelsExcel = () => {
    if (!activeSummary) return;
    try {
      exportLabelsToExcel(activeSummary);
      setSuccessMessage(`Downloaded Box Labels for PI #${activeSummary.piNumber}.`);
    } catch (err: any) {
      setUploadError('Failed to generate Labels Excel download: ' + err.message);
    }
  };

  // Past Orders List
  const pastOrdersList = useMemo(() => {
    return Object.values(deductedSalesOrders).sort((a, b) => 
      new Date(b.deductedAt).getTime() - new Date(a.deductedAt).getTime()
    );
  }, [deductedSalesOrders]);

  // Compute live box badge for an item from generated cartons
  const getItemBoxBadge = (item: SalesOrderItem): { text: string; count: number; isShared: boolean } => {
    if (item.isPromoOrNonStock) {
      const promoCarton = activeSummary?.cartons.find(c => c.items.some(it => it.isPromoOrNonStock));
      return { 
        text: promoCarton ? `Box #${promoCarton.cartonNo} (Promo)` : 'Last Box', 
        count: 1,
        isShared: true 
      };
    }

    if (!activeSummary) return { text: '—', count: 0, isShared: false };

    const matchingCartons = activeSummary.cartons.filter(c => 
      c.items.some(it => it.cleanName === item.cleanItemName || it.id?.includes(`-${item.slNo}`) || it.id?.endsWith(`-${item.slNo}`))
    );

    if (matchingCartons.length === 0) {
      return { text: '0 Boxes', count: 0, isShared: false };
    }

    const boxNums = matchingCartons.map(c => c.cartonNo).sort((a, b) => a - b);
    const minBox = boxNums[0];
    const maxBox = boxNums[boxNums.length - 1];
    const count = boxNums.length;

    const isShared = matchingCartons.some(c => c.items.length > 1 && !c.items.every(it => it.cleanName === item.cleanItemName));

    if (count === 1) {
      return { 
        text: isShared ? `Box #${minBox} (Shared)` : `Box #${minBox} (1 Box)`, 
        count,
        isShared 
      };
    } else {
      return { 
        text: `Box #${minBox}–#${maxBox} (${count} Boxes)`, 
        count,
        isShared: false 
      };
    }
  };

  // Filtered SKUs for manual SKU mapping modal
  const filteredSkusForMapping = useMemo(() => {
    if (!skuSearchQuery.trim()) return skus.slice(0, 30);
    const q = skuSearchQuery.toLowerCase();
    return skus.filter(s => 
      s.clean_name.toLowerCase().includes(q) || 
      s.sku_code.toLowerCase().includes(q) ||
      (s.original_tally_name && s.original_tally_name.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [skus, skuSearchQuery]);

  return (
    <div className="space-y-5 p-3 sm:p-5 lg:p-6 w-full max-w-[1560px] mx-auto animate-in fade-in duration-150">
      
      {/* Notifications / Alerts */}
      {uploadError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 no-print animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="font-bold text-sm hover:text-rose-950">×</button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 no-print animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-sm hover:text-emerald-950">×</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EMPTY STATE: WHEN NO SALES ORDER IS LOADED YET                            */}
      {/* ========================================================================= */}
      {!soData && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs font-extrabold text-orange-600 uppercase tracking-wider">
                <Truck className="h-4 w-4" />
                <span>Sales Order & Dispatch Workspace</span>
              </div>
              <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                Sales Order Packing & Box Dispatch
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload any Tally Sales Order spreadsheet (.xlsx) to manage item packing, carton assignments, and live stickers on a single screen.
              </p>
            </div>
          </div>

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
            <div className="flex h-18 w-18 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 group-hover:scale-110 transition-transform shadow-xs dark:bg-orange-950 dark:text-orange-400">
              <Upload className="h-9 w-9" />
            </div>

            <h2 className="mt-4 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Drop Tally Sales Order (.xlsx) Here
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Drag and drop your Sales Order file here or <span className="text-orange-600 font-bold underline">Click to Browse</span> from your device.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Interactive Box Builder</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Partial Dispatch Supported</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Negative Stock Allowed</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Live Packing List & Printable Stickers</span>
              </span>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 text-xs font-black shadow-md transition active:scale-95 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Select Sales Order Excel (.xlsx, .xls)</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Past Dispatches Section */}
          {pastOrdersList.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-orange-600" />
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Past Dispatched Orders History ({pastOrdersList.length})
                  </h3>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                {pastOrdersList.map(order => (
                  <div key={order.piNumber} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl transition">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                          PI #{order.piNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {order.partyName}
                        </span>
                        <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 dark:bg-emerald-950 dark:text-emerald-300">
                          Deducted
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Dispatched: {order.deductedAt} • {order.unitsTotal.toLocaleString()} Units across {order.itemsCount} SKUs
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleReopenPastOrder(order)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs"
                      >
                        <Eye className="h-3.5 w-3.5 text-orange-600" />
                        <span>View Order Workspace</span>
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
      {/* ACTIVE SALES ORDER WORKSPACE                                              */}
      {/* ========================================================================= */}
      {soData && (
        <div className="space-y-5">
          
          {/* --------------------------------------------------------------------- */}
          {/* SECTION A: ORDER HEADER BAR                                           */}
          {/* --------------------------------------------------------------------- */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Left Details: PI #, Date, Party, State, Shipping Mark */}
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-lg bg-orange-600 px-2.5 py-1 text-xs sm:text-sm font-black text-white font-mono shadow-2xs">
                    PI #{soData.piNumber}
                  </span>
                  <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {soData.orderDate}
                  </span>
                </div>

                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate max-w-[200px] xl:max-w-[280px]" title={soData.partyName}>
                    {soData.partyName}
                  </span>
                  <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
                    {soData.stateName} • {soData.stateCode}
                  </span>
                </div>

                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

                {/* Editable Shipping Mark Input */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold text-slate-500 uppercase">Mark:</span>
                  <input
                    type="text"
                    value={soData.shippingMark}
                    onChange={(e) => handleCustomShippingMarkChange(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-mono font-black text-orange-700 dark:border-slate-700 dark:bg-slate-800 dark:text-orange-400 focus:border-orange-500 focus:bg-white focus:outline-none uppercase w-36 sm:w-44"
                    title="Editable Shipping Mark (propagates to all carton labels)"
                  />
                  <button
                    type="button"
                    onClick={handleCopyShippingMark}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Copy Shipping Mark to Clipboard"
                  >
                    {copiedMark ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {isDeducted ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-3 py-1.5 text-xs font-black flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Stock Deducted</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUndoDeduct(soData.piNumber)}
                      className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-300 transition"
                      title="Restore stock for this Sales Order"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      <span>Undo</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleInitiateDeductStock}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-black shadow-md transition active:scale-95"
                    title="Confirm dispatch and deduct stock from inventory (Negative stock allowed)"
                  >
                    <PackageCheck className="h-4 w-4" />
                    <span>Confirm & Minus Stock</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStartNewOrder}
                  className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs active:scale-95"
                  title="Close active order and return to upload screen"
                >
                  <X className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Close</span>
                </button>

                <label className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs cursor-pointer active:scale-95">
                  <Upload className="h-3.5 w-3.5 text-slate-500" />
                  <span>Upload New SO</span>
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
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* SECTION B: DEDICATED INTERACTIVE BOX BUILDER & PACKER                 */}
          {/* --------------------------------------------------------------------- */}
          <div 
            ref={boxBuilderRef}
            className="rounded-2xl border-2 border-orange-400/90 bg-gradient-to-br from-orange-50/90 via-white to-amber-50/60 p-4 sm:p-5 shadow-sm dark:border-orange-700 dark:from-slate-900 dark:via-slate-900 dark:to-orange-950/30"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-orange-200 dark:border-orange-800/60 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-600 text-white shadow-2xs">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Interactive Manual Box Builder (डिब्बे और वज़न सेट करें)</span>
                    <span className="text-[10px] font-mono font-bold text-orange-700 bg-orange-100 dark:bg-orange-950 dark:text-orange-300 px-2 py-0.5 rounded-md">
                      Live Box Calculator
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Define pieces per box, gross weight, and starting box number (e.g. 20 Pcs order → 2 Boxes of 10 Pcs @ 10 Kg gross weight).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsBuilderExpanded(!isBuilderExpanded)}
                  className="flex items-center gap-1 text-xs font-bold text-orange-700 hover:text-orange-800 dark:text-orange-400 px-2 py-1 rounded-lg hover:bg-orange-100/60 transition"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>{isBuilderExpanded ? 'Hide Builder' : 'Open Box Builder'}</span>
                </button>
              </div>
            </div>

            {isBuilderExpanded && (
              <div className="mt-4 space-y-4">
                {/* 5 Input Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Field 1: Item Dropdown */}
                  <div className="lg:col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      1. Select Item to Pack:
                    </label>
                    <select
                      value={builderItemSlNo}
                      onChange={(e) => selectBuilderItem(parseInt(e.target.value, 10))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:outline-none focus:border-orange-500 shadow-2xs"
                    >
                      {soData.items.map(it => (
                        <option key={it.slNo} value={it.slNo}>
                          #{it.slNo} {it.cleanItemName} (Ordered: {Math.round(it.orderedQty)} Pcs)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Field 2: Dispatch Quantity (Supports Partial Dispatch) */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      2. Dispatch Qty (Pcs):
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={builderDispatchQty}
                      onChange={(e) => setBuilderDispatchQty(e.target.value)}
                      placeholder="e.g. 20"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-black text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:outline-none focus:border-orange-500 text-center shadow-2xs"
                    />
                    {builderPreview && builderPreview.item && (
                      <div className="text-[10px] text-slate-500 font-mono mt-1 text-center">
                        Ordered: {Math.round(builderPreview.item.orderedQty)} • 
                        {parseInt(builderDispatchQty, 10) < Math.round(builderPreview.item.orderedQty) ? (
                          <span className="text-amber-600 font-bold ml-1">Partial Dispatch</span>
                        ) : (
                          <span className="text-emerald-600 font-bold ml-1">Full Dispatch</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Field 3: Pieces per Box */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      3. Pieces in 1 Box:
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={builderUnitsPerBox}
                      onChange={(e) => setBuilderUnitsPerBox(e.target.value)}
                      placeholder="e.g. 10"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-black text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:outline-none focus:border-orange-500 text-center shadow-2xs"
                    />
                    <div className="text-[10px] text-slate-500 font-mono mt-1 text-center">
                      Units per carton
                    </div>
                  </div>

                  {/* Field 4: Gross Weight Per Box */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      4. Gross Weight / Box (Kg):
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      value={builderGrossWeight}
                      onChange={(e) => setBuilderGrossWeight(e.target.value)}
                      placeholder="e.g. 10.00"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-black text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:outline-none focus:border-orange-500 text-center shadow-2xs"
                    />
                    <div className="text-[10px] text-slate-500 font-mono mt-1 text-center">
                      Full carton weight in Kg
                    </div>
                  </div>
                </div>

                {/* Additional Optional Field: Starting Box Number & Action Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 max-w-xs">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      Start Box # (Optional):
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={builderStartBox}
                      onChange={(e) => setBuilderStartBox(e.target.value)}
                      placeholder="Auto"
                      className="w-24 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-bold text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-center focus:outline-none focus:border-orange-500"
                    />
                    <span className="text-[11px] text-slate-400">Leave empty for Auto sequential numbering</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyQuickBoxBuilder}
                    className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 text-xs font-black shadow-md transition active:scale-95"
                  >
                    <Check className="h-4 w-4" />
                    <span>Apply Box Setup to Order</span>
                  </button>
                </div>

                {/* LIVE VISUAL PREVIEW OF BOXES */}
                {builderPreview && (
                  <div className="rounded-xl border border-orange-200 bg-white/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-orange-600" />
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          Live Carton Breakdown for "{builderPreview.item.cleanItemName}":
                        </span>
                      </div>
                      <span className="rounded-md bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 px-2.5 py-0.5 text-xs font-mono font-black">
                        {builderPreview.totalBoxes} Cartons ({builderPreview.totalQty} Units • {(builderPreview.totalBoxes * builderPreview.grossWeight).toFixed(2)} Kg Gross Wt)
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {builderPreview.boxesList.map((box, bIdx) => (
                        <div 
                          key={bIdx}
                          className={`rounded-xl border p-2.5 flex flex-col justify-between ${
                            box.isRemainder
                              ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20'
                              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Boxes className="h-3.5 w-3.5 text-orange-600" />
                              <span>Box {box.boxNumberDisplay}</span>
                            </span>
                            {box.isRemainder && (
                              <span className="rounded bg-amber-200 text-amber-900 text-[10px] font-bold px-1.5 py-0.2">
                                Remainder
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex items-center justify-between font-mono text-xs font-bold pt-2 border-t border-slate-100 dark:border-slate-700">
                            <span className="text-slate-600 dark:text-slate-300">
                              Qty: <strong className="text-slate-900 dark:text-white">{box.qty} Pcs</strong>
                            </span>
                            <span className="text-orange-700 dark:text-orange-400">
                              {box.grossWeight.toFixed(2)} Kg
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* SECTION C: ITEM PACKING & DISPATCH TABLE (WITH LIVE NEGATIVE STOCK)    */}
          {/* --------------------------------------------------------------------- */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-600" />
                <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Item Packing & Live Warehouse Stock Table ({soData.items.length} Items)
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Partial Dispatch Supported</span>
                </span>
                <span className="flex items-center gap-1 text-rose-600 font-bold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Negative Stock Allowed</span>
                </span>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left border-b border-slate-200 dark:border-slate-800">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/90 text-xs font-black text-slate-700 uppercase dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 select-none">
                    <th className="w-[4%] py-3 px-2 text-center border-r border-slate-200 dark:border-slate-800">#</th>
                    <th className="w-[26%] py-3 px-3 border-r border-slate-200 dark:border-slate-800">Item Description</th>
                    <th className="w-[8%] py-3 px-2 text-right border-r border-slate-200 dark:border-slate-800">Ordered</th>
                    <th className="w-[10%] py-3 px-2 text-center border-r border-slate-200 dark:border-slate-800">Warehouse Stock</th>
                    <th className="w-[11%] py-3 px-2 text-center border-r border-slate-200 dark:border-slate-800">Dispatch Qty</th>
                    <th className="w-[11%] py-3 px-2 text-center border-r border-slate-200 dark:border-slate-800">Stock After Dispatch</th>
                    <th className="w-[9%] py-3 px-2 text-center border-r border-slate-200 dark:border-slate-800">Qty / Box</th>
                    <th className="w-[9%] py-3 px-2 text-center border-r border-slate-200 dark:border-slate-800">Box Wt (Kg)</th>
                    <th className="w-[12%] py-3 px-2 text-center">Cartons Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans text-xs sm:text-sm">
                  {soData.items.map((item, idx) => {
                    const boxBadge = getItemBoxBadge(item);
                    const isPromo = item.isPromoOrNonStock;

                    const curDispatchQty = typeof item.dispatchQty === 'number' ? Math.round(item.dispatchQty) : Math.round(item.orderedQty);
                    const isPartial = curDispatchQty < Math.round(item.orderedQty);

                    // Warehouse stock calculation
                    const currentStock = item.matchedSku ? Math.round(item.matchedSku.current_stock) : 0;
                    const projectedStock = currentStock - curDispatchQty;
                    const willGoNegative = !isPromo && item.matchedSku && projectedStock < 0;

                    // Direct typed string values or current item values
                    const curDispatchQtyStr = rawInputMap[`${item.slNo}_dispatchQty`] !== undefined
                      ? rawInputMap[`${item.slNo}_dispatchQty`]
                      : String(curDispatchQty);

                    const curUnitsPerBoxStr = rawInputMap[`${item.slNo}_unitsPerBox`] !== undefined
                      ? rawInputMap[`${item.slNo}_unitsPerBox`]
                      : String(item.unitsPerBox || (curDispatchQty > 10 ? 10 : curDispatchQty) || 10);

                    const curGrossWeightStr = rawInputMap[`${item.slNo}_grossWeight`] !== undefined
                      ? rawInputMap[`${item.slNo}_grossWeight`]
                      : String(item.grossWeightPerBox || 10.00);

                    return (
                      <tr 
                        key={item.slNo} 
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          isPromo ? 'bg-purple-50/20 dark:bg-purple-950/10' : ''
                        }`}
                      >
                        {/* Col 1: Serial # */}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-500 font-mono border-r border-slate-200 dark:border-slate-800 text-xs">
                          {idx + 1}
                        </td>

                        {/* Col 2: Item Description */}
                        <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 min-w-0">
                          <div className="font-extrabold text-slate-900 dark:text-white whitespace-normal break-words leading-snug">
                            {item.cleanItemName}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 font-mono text-[10px]">
                            {item.matchedSku?.division ? (
                              <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                                item.matchedSku.division === 'DIM'
                                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                  : item.matchedSku.division === 'DIN'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                {item.matchedSku.division}
                              </span>
                            ) : null}

                            {isPromo ? (
                              <span className="rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold px-1.5 py-0.2">
                                Promo Item
                              </span>
                            ) : null}

                            {item.matchedSku ? (
                              <span className="text-slate-400">
                                SKU: {item.matchedSku.sku_code}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSkuMappingModal({ item })}
                                className="flex items-center gap-1 rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-bold hover:bg-amber-200 transition"
                              >
                                <Link2 className="h-3 w-3" />
                                <span>Link Inventory SKU</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Col 3: Order Qty */}
                        <td className="py-2.5 px-2 text-right font-black font-mono text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800 tabular-nums">
                          {Math.round(item.orderedQty).toLocaleString()}
                        </td>

                        {/* Col 4: Warehouse Stock (Current in Godown) */}
                        <td className="py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-800">
                          {isPromo ? (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {item.matchedSku ? (
                                <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold font-mono ${
                                  currentStock >= curDispatchQty 
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}>
                                  {currentStock.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs font-mono">0</span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenQuickIn(item)}
                                className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-1.5 py-0.5 text-[10px] font-black transition active:scale-95"
                                title="Add stock to warehouse"
                              >
                                +IN
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Col 5: Dispatch Qty (Partial Shipment Support) */}
                        <td className="py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-800">
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="text"
                              value={curDispatchQtyStr}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setRawInputMap(prev => ({ ...prev, [`${item.slNo}_dispatchQty`]: val }));
                                if (val !== '') {
                                  handleUpdateDispatchQty(item.slNo, parseInt(val, 10));
                                }
                              }}
                              onBlur={() => {
                                const val = rawInputMap[`${item.slNo}_dispatchQty`];
                                if (val === '' || isNaN(parseInt(val, 10))) {
                                  handleUpdateDispatchQty(item.slNo, Math.round(item.orderedQty));
                                }
                                setRawInputMap(prev => {
                                  const next = { ...prev };
                                  delete next[`${item.slNo}_dispatchQty`];
                                  return next;
                                });
                              }}
                              className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-mono text-xs sm:text-sm font-bold text-slate-900 focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                            {isPartial && (
                              <span className="rounded bg-amber-100 text-amber-800 text-[10px] font-black px-1.5 py-0.2">
                                Partial ({curDispatchQty}/{Math.round(item.orderedQty)})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Col 6: Stock After Dispatch (Allows Negative Stock) */}
                        <td className="py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-800">
                          {isPromo ? (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className={`font-mono text-xs font-black ${
                                willGoNegative 
                                  ? 'text-rose-600 dark:text-rose-400' 
                                  : 'text-emerald-700 dark:text-emerald-300'
                              }`}>
                                {projectedStock > 0 ? `+${projectedStock}` : projectedStock}
                              </span>
                              {willGoNegative && (
                                <span className="rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[9px] font-bold px-1.5 py-0.2 mt-0.5">
                                  Minus Stock (-ve)
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Col 7: Qty / Box */}
                        <td className="py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={curUnitsPerBoxStr}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setRawInputMap(prev => ({ ...prev, [`${item.slNo}_unitsPerBox`]: val }));
                              if (val !== '') {
                                handleUpdateItemPacking(item.slNo, 'unitsPerBox', Math.max(1, parseInt(val, 10)));
                              }
                            }}
                            onBlur={() => {
                              const val = rawInputMap[`${item.slNo}_unitsPerBox`];
                              if (val === '' || isNaN(parseInt(val, 10)) || parseInt(val, 10) <= 0) {
                                handleUpdateItemPacking(item.slNo, 'unitsPerBox', curDispatchQty > 10 ? 10 : curDispatchQty);
                              }
                              setRawInputMap(prev => {
                                const next = { ...prev };
                                delete next[`${item.slNo}_unitsPerBox`];
                                return next;
                              });
                            }}
                            className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-mono text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </td>

                        {/* Col 8: Box Wt (Kg) */}
                        <td className="py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={curGrossWeightStr}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, '');
                              setRawInputMap(prev => ({ ...prev, [`${item.slNo}_grossWeight`]: val }));
                              if (val !== '' && !isNaN(parseFloat(val))) {
                                handleUpdateItemPacking(item.slNo, 'grossWeightPerBox', parseFloat(val));
                              }
                            }}
                            onBlur={() => {
                              const val = rawInputMap[`${item.slNo}_grossWeight`];
                              if (val === '' || isNaN(parseFloat(val)) || parseFloat(val) <= 0) {
                                handleUpdateItemPacking(item.slNo, 'grossWeightPerBox', 10.00);
                              }
                              setRawInputMap(prev => {
                                const next = { ...prev };
                                delete next[`${item.slNo}_grossWeight`];
                                return next;
                              });
                            }}
                            className="w-18 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-mono text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </td>

                        {/* Col 9: Cartons Assigned & Setup Trigger */}
                        <td className="py-2.5 px-2 text-center min-w-0">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold font-mono whitespace-nowrap ${
                              boxBadge.isShared
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                            }`}>
                              {boxBadge.text}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSelectBuilderItemAndScroll(item.slNo)}
                              className="text-[10px] font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1"
                            >
                              <SlidersHorizontal className="h-3 w-3" />
                              <span>Box Setup</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer Actions */}
            <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Tip: Click <strong>"Box Setup"</strong> on any item to view its box breakdown, set pieces per carton, and gross weight.
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleAutoFillPackingDefaults}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 transition shadow-2xs"
                  title="Auto-fill standard carton units and weights"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  <span>Auto Fill Defaults</span>
                </button>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* SECTION D: EDITABLE PACKING LIST TABLE & BOX STICKERS                 */}
          {/* --------------------------------------------------------------------- */}
          {activeSummary && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-3">
                {/* Switcher: Packing List Table vs Box Stickers */}
                <div className="flex items-center gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => setOutputTab('packing-list')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition ${
                      outputTab === 'packing-list'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Packing List Table</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOutputTab('box-labels')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition ${
                      outputTab === 'box-labels'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Tag className="h-4 w-4" />
                    <span>Box Stickers ({activeSummary.totalBoxes} Boxes)</span>
                  </button>
                </div>

                {/* Right Actions: Print & Excel Downloads */}
                <div className="flex flex-wrap items-center gap-2">
                  {customCartons && (
                    <button
                      type="button"
                      onClick={() => setCustomCartons(null)}
                      className="flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-200 transition"
                      title="Reset manual cell edits back to auto-calculated boxes"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset Edits</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadPackagingExcel}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 transition shadow-2xs"
                    title="Download Packaging List (.xlsx) matching official template"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Packing List (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadLabelsExcel}
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 transition shadow-2xs"
                    title="Download Box Labels (.xlsx) matching official sticker cards"
                  >
                    <Download className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Labels (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white px-3.5 py-1.5 text-xs font-black shadow-xs transition active:scale-95"
                    title="Print directly or save as PDF"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              {/* VIEW 1: LIVE EDITABLE PACKING LIST TABLE */}
              {outputTab === 'packing-list' && (
                <div className="space-y-3 font-sans">
                  {/* Order Meta Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-slate-900 dark:border-slate-100 gap-2 font-mono text-xs sm:text-sm">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <span className="text-slate-500 uppercase">Party Name :</span>
                      <span className="font-extrabold uppercase">{activeSummary.partyName}</span>
                    </div>
                    <div className="flex items-center gap-4 font-bold text-slate-900 dark:text-white">
                      <div>
                        <span className="text-slate-500 uppercase">PI : </span>
                        <span className="font-extrabold">{activeSummary.piNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 uppercase">Mark: </span>
                        <span className="text-orange-700 dark:text-orange-400 font-extrabold">{activeSummary.shippingMark}</span>
                      </div>
                    </div>
                  </div>

                  {/* Table with directly typeable cells */}
                  <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-[700px] border-collapse text-left border border-slate-300 dark:border-slate-700">
                      <thead>
                        <tr className="border-b-2 border-slate-300 bg-slate-100 text-xs sm:text-sm font-extrabold text-slate-800 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          <th className="w-[14%] py-2.5 px-3 text-center border-r border-slate-300 dark:border-slate-700">Carton No.</th>
                          <th className="w-[50%] py-2.5 px-3 border-r border-slate-300 dark:border-slate-700">Item Name</th>
                          <th className="w-[14%] py-2.5 px-3 text-right border-r border-slate-300 dark:border-slate-700">Qty</th>
                          <th className="w-[14%] py-2.5 px-3 text-right border-r border-slate-300 dark:border-slate-700">Gross Wt. (Kg)</th>
                          <th className="w-[8%] py-2.5 px-2 text-center no-print">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono text-xs sm:text-sm">
                        {activeSummary.cartons.map((carton, cartonIdx) => {
                          const isPromoBox = carton.items.some(it => it.isPromoOrNonStock);

                          return carton.items.map((item, itemIdx) => {
                            const isFirstItemOfCarton = itemIdx === 0;

                            return (
                              <tr 
                                key={item.id || `c-${cartonIdx}-i-${itemIdx}`} 
                                className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                                  isPromoBox ? 'bg-purple-50/20 dark:bg-purple-950/10' : ''
                                }`}
                              >
                                {/* Carton No (Editable on first row of carton) */}
                                <td className="py-1.5 px-2 text-center font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                                  {isFirstItemOfCarton ? (
                                    <input
                                      type="number"
                                      min={1}
                                      value={carton.cartonNo}
                                      onChange={(e) => handleUpdateCartonField(cartonIdx, 'cartonNo', e.target.value)}
                                      className="w-16 rounded border border-transparent hover:border-slate-300 focus:border-orange-500 bg-transparent px-1 py-0.5 text-center font-bold text-slate-900 dark:text-white focus:outline-none"
                                    />
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-600">↳</span>
                                  )}
                                </td>

                                {/* Item Name (Editable) */}
                                <td className="py-1.5 px-3 font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 whitespace-normal break-words">
                                  <input
                                    type="text"
                                    value={item.cleanName}
                                    onChange={(e) => handleUpdateCartonItemField(cartonIdx, itemIdx, 'cleanName', e.target.value)}
                                    className="w-full rounded border border-transparent hover:border-slate-300 focus:border-orange-500 bg-transparent px-1.5 py-0.5 font-bold text-slate-900 dark:text-white focus:outline-none uppercase"
                                  />
                                </td>

                                {/* Qty (Editable) */}
                                <td className="py-1.5 px-2 text-right font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 tabular-nums">
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.qty}
                                    onChange={(e) => handleUpdateCartonItemField(cartonIdx, itemIdx, 'qty', e.target.value)}
                                    className="w-20 rounded border border-transparent hover:border-slate-300 focus:border-orange-500 bg-transparent px-1 py-0.5 text-right font-bold text-slate-900 dark:text-white focus:outline-none tabular-nums ml-auto block"
                                  />
                                </td>

                                {/* Gross Wt (Editable on first row of carton) */}
                                <td className="py-1.5 px-3 text-right font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 tabular-nums">
                                  {isFirstItemOfCarton ? (
                                    <input
                                      type="number"
                                      step={0.01}
                                      min={0}
                                      value={carton.grossWeightKg}
                                      onChange={(e) => handleUpdateCartonField(cartonIdx, 'grossWeightKg', e.target.value)}
                                      className="w-22 rounded border border-transparent hover:border-slate-300 focus:border-orange-500 bg-transparent px-1 py-0.5 text-right font-bold text-slate-900 dark:text-white focus:outline-none tabular-nums ml-auto block"
                                    />
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-600">—</span>
                                  )}
                                </td>

                                {/* Actions (no-print) */}
                                <td className="py-1.5 px-2 text-center no-print">
                                  <div className="flex items-center justify-center gap-1">
                                    {isFirstItemOfCarton && (
                                      <button
                                        type="button"
                                        onClick={() => handleAddItemToCarton(cartonIdx)}
                                        className="p-1 text-slate-400 hover:text-emerald-600 transition"
                                        title="Add another item into this box"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItemFromCarton(cartonIdx, itemIdx)}
                                      className="p-1 text-slate-400 hover:text-rose-600 transition"
                                      title="Remove item from carton"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        })}

                        {/* Total Footer Rows */}
                        <tr className="border-t-2 border-slate-900 bg-slate-50 font-black text-slate-900 dark:border-slate-100 dark:bg-slate-800/80 dark:text-white">
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-700">
                            Total
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700">
                            {activeSummary.totalBoxes} Cartons ({activeSummary.totalUnits.toLocaleString()} Pcs Total)
                          </td>
                          <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-700 tabular-nums">
                            {activeSummary.totalUnits.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-700 tabular-nums text-orange-600 dark:text-orange-400">
                            {activeSummary.totalGrossWeight.toFixed(2)} Kg
                          </td>
                          <td className="no-print"></td>
                        </tr>

                        <tr className="bg-slate-100/90 font-black text-slate-900 dark:bg-slate-800 dark:text-white">
                          <td colSpan={3} className="py-2 px-3 border-r border-slate-200 dark:border-slate-700 text-right uppercase text-xs">
                            Total Boxes:
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-xs sm:text-sm">
                            {activeSummary.totalBoxes} BOX
                          </td>
                          <td className="no-print"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VIEW 2: BOX LABELS / STICKERS */}
              {outputTab === 'box-labels' && (
                <div className="space-y-4">
                  {/* Single vs All Switcher */}
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800/60 no-print">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setLabelViewMode('all-grid')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          labelViewMode === 'all-grid'
                            ? 'bg-orange-600 text-white shadow-2xs'
                            : 'bg-white border text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        All Stickers Grid ({activeSummary.totalBoxes})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLabelViewMode('single-carousel')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          labelViewMode === 'single-carousel'
                            ? 'bg-orange-600 text-white shadow-2xs'
                            : 'bg-white border text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Single Sticker Carousel
                      </button>
                    </div>

                    {labelViewMode === 'single-carousel' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentCartonIndex(prev => Math.max(0, prev - 1))}
                          disabled={currentCartonIndex === 0}
                          className="px-2.5 py-1 rounded-lg border bg-white text-xs font-bold disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <span className="font-mono text-xs font-black">
                          {currentCartonIndex + 1} of {activeSummary.totalBoxes}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentCartonIndex(prev => Math.min(activeSummary.cartons.length - 1, prev + 1))}
                          disabled={currentCartonIndex === activeSummary.cartons.length - 1}
                          className="px-2.5 py-1 rounded-lg border bg-white text-xs font-bold disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Stickers Grid */}
                  <div className={labelViewMode === 'all-grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4 print-grid-2cols' : 'max-w-xl mx-auto'}>
                    {(labelViewMode === 'all-grid' ? activeSummary.cartons : [activeSummary.cartons[currentCartonIndex]]).map((carton, cartonIdx) => {
                      if (!carton) return null;
                      const realCartonIdx = labelViewMode === 'all-grid' ? cartonIdx : currentCartonIndex;
                      const isPromoBox = carton.items.some(it => it.isPromoOrNonStock);

                      return (
                        <div
                          key={carton.id || `carton-label-${carton.cartonNo}`}
                          className={`rounded-2xl border-3 bg-white p-4 shadow-sm dark:bg-slate-900 font-sans print-page-break relative ${
                            isPromoBox ? 'border-purple-600 dark:border-purple-400' : 'border-slate-900 dark:border-slate-200'
                          }`}
                        >
                          {/* Header Block: Carton# | Shipping Mark | PI# */}
                          <div className="grid grid-cols-3 border-b-2 border-slate-900 pb-2.5 dark:border-slate-200 font-mono">
                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase">Carton#</div>
                              <input
                                type="number"
                                min={1}
                                value={carton.cartonNo}
                                onChange={(e) => handleUpdateCartonField(realCartonIdx, 'cartonNo', e.target.value)}
                                className="text-xl font-black text-slate-900 dark:text-white mt-0.5 w-18 bg-transparent border-b border-dashed border-slate-300 focus:outline-none"
                              />
                            </div>

                            <div className="text-center">
                              <div className="text-[10px] font-bold text-slate-500 uppercase">Shipping Mark</div>
                              <input
                                type="text"
                                value={carton.shippingMark}
                                onChange={(e) => handleUpdateCartonField(realCartonIdx, 'shippingMark', e.target.value)}
                                className="text-sm font-black text-orange-700 dark:text-orange-400 mt-0.5 text-center w-full bg-transparent border-b border-dashed border-orange-300 focus:outline-none uppercase"
                              />
                            </div>

                            <div className="text-right">
                              <div className="text-[10px] font-bold text-slate-500 uppercase">PI#</div>
                              <input
                                type="text"
                                value={carton.piNumber}
                                onChange={(e) => handleUpdateCartonField(realCartonIdx, 'piNumber', e.target.value)}
                                className="text-xl font-black text-slate-900 dark:text-white mt-0.5 text-right w-18 bg-transparent border-b border-dashed border-slate-300 focus:outline-none ml-auto block"
                              />
                            </div>
                          </div>

                          {/* Table Block: S# | Product/Size | Quantity (Nos) | Weight (Kg) */}
                          <div className="mt-2.5">
                            <table className="w-full table-fixed border-collapse text-left font-mono">
                              <thead>
                                <tr className="border-b border-slate-300 text-[10px] font-black text-slate-700 uppercase dark:border-slate-700 dark:text-slate-300">
                                  <th className="w-[10%] py-1.5 px-1 text-center">S#</th>
                                  <th className="w-[50%] py-1.5 px-2">Product/Size</th>
                                  <th className="w-[20%] py-1.5 px-1 text-right">Quantity (Nos)</th>
                                  <th className="w-[20%] py-1.5 px-2 text-right">Weight (Kg)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                                {carton.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="py-1.5 px-1 text-center font-bold text-slate-500">
                                      {idx + 1}
                                    </td>
                                    <td className="py-1.5 px-2 font-black text-slate-900 dark:text-white whitespace-normal break-words leading-tight">
                                      <input
                                        type="text"
                                        value={item.cleanName}
                                        onChange={(e) => handleUpdateCartonItemField(realCartonIdx, idx, 'cleanName', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-500 focus:outline-none uppercase font-black"
                                      />
                                    </td>
                                    <td className="py-1.5 px-1 text-right font-black text-slate-900 dark:text-white tabular-nums">
                                      <input
                                        type="number"
                                        min={0}
                                        value={item.qty}
                                        onChange={(e) => handleUpdateCartonItemField(realCartonIdx, idx, 'qty', e.target.value)}
                                        className="w-16 text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-500 focus:outline-none font-black tabular-nums ml-auto block"
                                      />
                                    </td>
                                    <td className="py-1.5 px-2 text-right font-bold text-slate-900 dark:text-white tabular-nums">
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
                                        className="w-18 text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-500 focus:outline-none font-bold tabular-nums ml-auto block"
                                      />
                                    </td>
                                  </tr>
                                ))}

                                {/* Total Row */}
                                <tr className="border-t-2 border-slate-900 font-black text-slate-900 dark:border-slate-200 dark:text-white text-xs">
                                  <td colSpan={2} className="py-1.5 px-2 uppercase text-[10px]">
                                    Total
                                  </td>
                                  <td className="py-1.5 px-1 text-right tabular-nums">
                                    {carton.totalQty}
                                  </td>
                                  <td className="py-1.5 px-2 text-right tabular-nums">
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

      {/* ========================================================================= */}
      {/* MODAL 1: NEGATIVE STOCK DISPATCH CONFIRMATION                             */}
      {/* ========================================================================= */}
      {negativeStockModal && negativeStockModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div 
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-rose-300 bg-white shadow-2xl transition-all dark:border-rose-900 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-rose-200 dark:border-rose-900/60 flex items-center justify-between bg-rose-50/60 dark:bg-rose-950/30">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center font-black">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Confirm Dispatch with Negative Stock (स्टॉक माइनस होगा)
                  </h3>
                  <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">
                    Order quantity exceeds available warehouse stock. Negative stock is fully allowed.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNegativeStockModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Aapke paas neeche di gayi items ka stock kam hai. Agar aap dispatch confirm karte hain, to ye item inventory mein <strong className="text-rose-600 dark:text-rose-400 font-bold">Negative (-ve)</strong> chali jayengi, jo system mein fully supported hai:
              </p>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-3">Item Description</th>
                      <th className="py-2 px-2 text-right">In Stock</th>
                      <th className="py-2 px-2 text-right">Dispatching</th>
                      <th className="py-2 px-3 text-right">New Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {negativeStockModal.negativeItems.map((n, i) => (
                      <tr key={i} className="hover:bg-rose-50/30 dark:hover:bg-rose-950/20">
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white font-sans">
                          {n.item.cleanItemName}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                          {n.currentStock}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-slate-900 dark:text-white">
                          {n.dispatchQty}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/40">
                          {n.newStock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3 text-xs text-amber-800 dark:text-amber-300">
                💡 <strong>Warehouse Note:</strong> Dispatch confirm karne par Stock Master mein in items ke saamne <strong>Red Tag (-ve)</strong> show hoga aur new stock inward hote hi ye balance out ho jayengi.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setNegativeStockModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeductStock}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-black shadow-md transition active:scale-95 flex items-center gap-1.5"
                >
                  <PackageCheck className="h-4 w-4" />
                  <span>Yes, Confirm & Minus Stock</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: QUICK STOCK IN MODAL                                             */}
      {/* ========================================================================= */}
      {quickInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div 
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black">
                  +IN
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Quick Stock IN Entry
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Replenish stock for PI #{soData?.piNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickInModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-xs font-black text-slate-900 dark:text-white leading-snug">
                  {quickInModal.item.cleanItemName}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>Current Godown Stock:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {quickInModal.item.matchedSku ? Math.round(quickInModal.item.matchedSku.current_stock) : 0} Pcs
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono mt-1">
                  <span>Sales Order Dispatch Qty:</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400">
                    {Math.round(quickInModal.item.dispatchQty ?? quickInModal.item.orderedQty)} Pcs
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Quantity to Add (Pcs):
                </label>
                <input
                  type="number"
                  min={1}
                  value={quickInModal.inQty}
                  onChange={(e) => setQuickInModal({ ...quickInModal, inQty: parseInt(e.target.value, 10) || 1 })}
                  className="w-full text-center tracking-wider text-2xl font-black rounded-2xl border border-slate-300 bg-white py-3 font-mono text-slate-900 focus:outline-none focus:border-emerald-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white shadow-inner"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Inward Reason / Notes:
                </label>
                <input
                  type="text"
                  value={quickInModal.reason}
                  onChange={(e) => setQuickInModal({ ...quickInModal, reason: e.target.value })}
                  placeholder="e.g. Factory Floor Heat Treatment Batch / Emergency Inward"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickInModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmQuickIn}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white hover:bg-emerald-700 shadow-sm transition active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>Confirm Stock IN (+{quickInModal.inQty})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MANUAL SKU MAPPING MODAL                                         */}
      {/* ========================================================================= */}
      {skuMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div 
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 flex items-center justify-center font-black">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Link Item to Warehouse SKU
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Match item to track live warehouse stock & deduct on dispatch
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSkuMappingModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-500 font-bold block">Selected Sales Order Item:</span>
                <span className="text-xs font-black text-slate-900 dark:text-white font-sans mt-0.5 block">
                  #{skuMappingModal.item.slNo} {skuMappingModal.item.cleanItemName}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Search Warehouse SKU by Name or Code:
                </label>
                <input
                  type="text"
                  value={skuSearchQuery}
                  onChange={(e) => setSkuSearchQuery(e.target.value)}
                  placeholder="e.g. GRINDING WHEEL 100 or DIM-001..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:outline-none focus:border-orange-500"
                  autoFocus
                />
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {filteredSkusForMapping.map(sku => (
                  <div 
                    key={sku.id}
                    onClick={() => handleMapSkuToItem(sku)}
                    className="p-2.5 hover:bg-orange-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between gap-2 transition"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {sku.clean_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {sku.division} • {sku.sku_code} • {sku.main_category}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs font-bold px-2 py-0.5">
                        Stock: {Math.round(sku.current_stock)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSkuMappingModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
