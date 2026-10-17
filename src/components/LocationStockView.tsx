import React, { useState, useMemo, useRef } from 'react';
import { 
  Boxes, 
  MapPin, 
  Download, 
  Upload, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Calendar, 
  ArrowRight, 
  Layers, 
  ShieldCheck, 
  FileSpreadsheet,
  Trash2,
  Edit3,
  Clock,
  Sparkles,
  RefreshCw,
  Sliders,
  Filter,
  Check,
  X
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { WarehouseLocation, LocationStockEntry, DivisionCode, SkuItem } from '../types/inventory';
import { 
  normalizeLocationCode, 
  createNewSteelRackLocations, 
  createNewPalletLineLocations, 
  createNewBinRange,
  getLocationDescription,
  getLocationZone
} from '../lib/locationUtils';
import { 
  downloadLocationStockTemplate, 
  parseUploadedLocationStockExcel 
} from '../lib/locationTemplateExcel';
import { parseSalesOrderExcel } from '../lib/salesOrderParser';
import * as XLSX from 'xlsx';

export const LocationStockView: React.FC = () => {
  const { 
    skus, 
    categories, 
    warehouseLocations, 
    locationStockEntries, 
    countSession, 
    currentUser,
    deductedSalesOrders,
    searchEngine,
    addWarehouseLocation, 
    updateWarehouseLocation,
    deleteWarehouseLocation,
    saveLocationStockEntry, 
    batchSaveLocationStockEntries,
    deleteLocationStockEntry,
    clearLocationStockEntries,
    setCountSession,
    applyOutwardReconciliation,
    syncLocationStockToMaster,
    addNewSku,
    setAddNewSkuModalOpen
  } = useInventoryStore();

  // Active view tab
  const [activeTab, setActiveTab] = useState<'grid' | 'reconcile' | 'ledger'>('grid');

  // Location filter in grid
  const [zoneFilter, setZoneFilter] = useState<'ALL' | 'RACK' | 'PALLET' | 'BIN'>('ALL');
  const [searchLocationQuery, setSearchLocationQuery] = useState('');

  // Selected location for editing/drawer
  const [selectedLocation, setSelectedLocation] = useState<WarehouseLocation | null>(null);
  const [isEditingLoc, setIsEditingLoc] = useState(false);
  const [editLocCode, setEditLocCode] = useState('');
  const [editLocDesc, setEditLocDesc] = useState('');

  // Autocomplete Search Combobox state for rapid entry
  const [selectedSkuForCount, setSelectedSkuForCount] = useState<SkuItem | null>(null);
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [selectedDivFilter, setSelectedDivFilter] = useState<DivisionCode | 'ALL'>('ALL');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [countedQtyInput, setCountedQtyInput] = useState<string>('');
  const [countNotes, setCountNotes] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Add Location Modal state
  const [isAddLocationModalOpen, setIsAddLocationModalOpen] = useState(false);
  const [newLocType, setNewLocType] = useState<'RACK' | 'PALLET' | 'BIN' | 'CUSTOM'>('CUSTOM');
  const [newLocCode, setNewLocCode] = useState('AA');
  const [newLocCount, setNewLocCount] = useState<number>(6);
  const [newBinStart, setNewBinStart] = useState<number>(31);
  const [newBinEnd, setNewBinEnd] = useState<number>(50);
  const [customLocCode, setCustomLocCode] = useState('');
  const [customLocZone, setCustomLocZone] = useState('');
  const [customLocDesc, setCustomLocDesc] = useState('');

  // Status & Notification messages
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);

  // Reconciliation state (Part 5)
  const [reconcileStartDate, setReconcileStartDate] = useState(countSession.startDate || '2026-10-16');
  const [reconcileEndDate, setReconcileEndDate] = useState(countSession.endDate || '2026-10-20');
  const [autoIncludeDispatched, setAutoIncludeDispatched] = useState(true);
  const [uploadedOutwardOrders, setUploadedOutwardOrders] = useState<Array<{
    piNumber: string;
    partyName: string;
    items: Array<{ skuCode: string; cleanName: string; outwardQty: number }>;
  }>>([]);
  const [selectedReconcileLocations, setSelectedReconcileLocations] = useState<Record<string, string>>({});

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Quick lookup map for physical location descriptions
  const locationDescMap = useMemo(() => {
    const map = new Map<string, string>();
    warehouseLocations.forEach(loc => {
      map.set(loc.code, loc.description || getLocationDescription(loc.code));
    });
    return map;
  }, [warehouseLocations]);

  // Aggregated units and SKU counts per location
  const locationStatsMap = useMemo(() => {
    const map = new Map<string, { skuCount: number; totalUnits: number }>();
    locationStockEntries.forEach(entry => {
      const loc = entry.locationCode;
      if (!map.has(loc)) {
        map.set(loc, { skuCount: 0, totalUnits: 0 });
      }
      const cur = map.get(loc)!;
      cur.skuCount += 1;
      cur.totalUnits += entry.countedQty;
    });
    return map;
  }, [locationStockEntries]);

  // Map of SKU ID to its counted locations with descriptions
  const skuLocationsMap = useMemo(() => {
    const map = new Map<string, Array<{ code: string; qty: number; desc: string }>>();
    locationStockEntries.forEach(entry => {
      if (!map.has(entry.skuId)) {
        map.set(entry.skuId, []);
      }
      const list = map.get(entry.skuId)!;
      list.push({
        code: entry.locationCode,
        qty: entry.countedQty,
        desc: locationDescMap.get(entry.locationCode) || getLocationDescription(entry.locationCode)
      });
    });
    return map;
  }, [locationStockEntries, locationDescMap]);

  // Filtered locations list (searches code, zone, or description)
  const filteredLocations = useMemo(() => {
    return warehouseLocations.filter(loc => {
      if (zoneFilter !== 'ALL' && loc.type !== zoneFilter) return false;
      if (searchLocationQuery.trim()) {
        const q = searchLocationQuery.toLowerCase();
        const desc = locationDescMap.get(loc.code) || loc.description || '';
        return loc.code.toLowerCase().includes(q) || 
               loc.zone.toLowerCase().includes(q) ||
               desc.toLowerCase().includes(q);
      }
      return true;
    });
  }, [warehouseLocations, zoneFilter, searchLocationQuery, locationDescMap]);

  // Overall totals
  const totalPhysicalUnits = useMemo(() => {
    return locationStockEntries.reduce((sum, e) => sum + e.countedQty, 0);
  }, [locationStockEntries]);

  const uniqueSkusCounted = useMemo(() => {
    return new Set(locationStockEntries.map(e => e.skuId)).size;
  }, [locationStockEntries]);

  // Autocomplete Suggestions: searchEngine + multi-token fallback + instant top 30 on empty query
  const suggestions = useMemo(() => {
    const query = skuSearchQuery.trim();
    const divFilter = selectedDivFilter !== 'ALL' ? selectedDivFilter : undefined;

    // When searchQuery is empty and user clicks/focuses the search box, immediately show top 30 items
    if (!query) {
      let pool = skus;
      if (divFilter) {
        pool = pool.filter(s => s.division === divFilter);
      }
      return pool.slice(0, 30);
    }

    // 1. Query searchEngine.search(searchQuery, { division: selectedDivFilter, limit: 40 })
    const searchResults = searchEngine.search(query, { division: divFilter, limit: 40 }).map(r => r.item);
    if (searchResults.length > 0) {
      return searchResults;
    }

    // 2. Multi-token fallback matching Part Name, Size/Dimension (19mm, 4", 8x10), SKU code, and shorthands
    const qLower = query.toLowerCase();
    const tokens = qLower.split(/[\s,\-_/]+/).filter(Boolean);
    return skus.filter(item => {
      if (divFilter && item.division !== divFilter) return false;
      const itemText = `${item.clean_name} ${item.sku_code} ${item.size_spec || ''} ${item.main_category} ${item.sub_category || ''}`.toLowerCase();
      return tokens.every(tok => itemText.includes(tok));
    }).slice(0, 40);
  }, [skuSearchQuery, selectedDivFilter, skus, searchEngine]);

  // Handle instant SKU selection from combobox dropdown
  const handleSelectSkuForLocation = (sku: SkuItem) => {
    setSelectedSkuForCount(sku);
    setSkuSearchQuery(sku.clean_name);
    setIsDropdownOpen(false);
    setHighlightedIndex(0);

    // If item is already recorded in current location, pre-populate that quantity
    const existingInLoc = locationStockEntries.find(
      e => e.locationCode === selectedLocation?.code && e.skuId === sku.id
    );
    if (existingInLoc) {
      setCountedQtyInput(String(existingInLoc.countedQty));
      setCountNotes(existingInLoc.notes || '');
    } else {
      setCountedQtyInput('');
      setCountNotes('');
    }

    // Auto-focus quantity input immediately
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 40);
  };

  // Active items counted inside the currently selected location
  const itemsInSelectedLocation = useMemo(() => {
    if (!selectedLocation) return [];
    return locationStockEntries.filter(e => e.locationCode === selectedLocation.code);
  }, [selectedLocation, locationStockEntries]);

  // Handlers for physical count save with rapid auto-focus back to search input
  const handleSaveCountEntry = () => {
    if (!selectedLocation || !selectedSkuForCount) {
      showStatus('error', 'Please select a location and an SKU to record physical count.');
      return;
    }
    const qty = parseInt(countedQtyInput, 10);
    if (isNaN(qty) || qty < 0) {
      showStatus('error', 'Please enter a valid whole-integer count quantity (0 or greater).');
      return;
    }

    saveLocationStockEntry({
      skuId: selectedSkuForCount.id,
      skuCode: selectedSkuForCount.sku_code,
      cleanName: selectedSkuForCount.clean_name,
      division: selectedSkuForCount.division,
      mainCategory: selectedSkuForCount.main_category,
      locationCode: selectedLocation.code,
      countedQty: qty,
      countedBy: currentUser?.name || 'Staff',
      notes: countNotes
    });

    showStatus('success', `Saved ${qty.toLocaleString()} Pcs of "${selectedSkuForCount.clean_name}" in ${selectedLocation.code}`);

    // Clear search box and inputs for rapid continuous entry
    setSkuSearchQuery('');
    setSelectedSkuForCount(null);
    setCountedQtyInput('');
    setCountNotes('');
    setIsDropdownOpen(false);

    // Auto-focus back to Item Search Input so godown staff never need mouse
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // 1-Click Excel Template Download
  const handleDownloadTemplate = () => {
    try {
      downloadLocationStockTemplate(skus, warehouseLocations, categories);
      showStatus('success', 'Location Stock Template downloaded with 3 sheets (Entry, Location Master, Division Guide).');
    } catch (err) {
      showStatus('error', `Failed to generate Excel template: ${(err as Error).message}`);
    }
  };

  // 1-Click Excel Upload
  const handleUploadFilledTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingExcel(true);
    try {
      const parsed = await parseUploadedLocationStockExcel(file, skus, warehouseLocations);
      
      // Auto-add new locations discovered
      if (parsed.newLocationsDiscovered.length > 0) {
        const newLocs: WarehouseLocation[] = parsed.newLocationsDiscovered.map(code => ({
          code,
          type: code.startsWith('BIN') ? 'BIN' : (code.match(/^[A-G]/) ? 'RACK' : 'PALLET'),
          zone: code.startsWith('BIN') ? 'Storage Bins' : (code.match(/^[A-G]/) ? `Rack ${code.charAt(0)}` : `Line ${code.charAt(0)}`),
          description: getLocationDescription(code)
        }));
        addWarehouseLocation(newLocs);
      }

      // Auto-add new SKUs discovered in bottom rows
      if (parsed.newSkusToAdd.length > 0) {
        parsed.newSkusToAdd.forEach(n => {
          addNewSku(n);
        });
      }

      // Batch save location stock entries
      batchSaveLocationStockEntries(parsed.entries);

      showStatus('success', `Successfully uploaded ${parsed.entries.length} location counts (${parsed.totalUnitsCounted.toLocaleString()} units). ${parsed.newSkusToAdd.length} new SKUs and ${parsed.newLocationsDiscovered.length} new locations registered.`);
    } catch (err) {
      showStatus('error', `Excel parse error: ${(err as Error).message}`);
    } finally {
      setIsUploadingExcel(false);
      e.target.value = '';
    }
  };

  // Add Location Modal submission
  const handleCreateNewLocations = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLocType === 'CUSTOM') {
      const norm = normalizeLocationCode(customLocCode);
      if (!norm) {
        showStatus('error', 'Please enter a valid location code (e.g. Pallet 7, Shed A, Floor 1).');
        return;
      }
      addWarehouseLocation({
        code: norm,
        type: norm.startsWith('BIN') ? 'BIN' : (norm.match(/^[A-G]/) ? 'RACK' : 'PALLET'),
        zone: customLocZone.trim() || 'Floor Storage',
        description: customLocDesc.trim() || `Warehouse Location ${norm}`
      });
      showStatus('success', `Created custom warehouse location ${norm}.`);
      setCustomLocCode('');
      setCustomLocZone('');
      setCustomLocDesc('');
    } else if (newLocType === 'RACK') {
      const created = createNewSteelRackLocations(newLocCode, newLocCount);
      addWarehouseLocation(created);
      showStatus('success', `Created Rack ${newLocCode} with ${created.length} shelves (${created.map(l => l.code).join(', ')}).`);
    } else if (newLocType === 'PALLET') {
      const created = createNewPalletLineLocations(newLocCode, newLocCount);
      addWarehouseLocation(created);
      showStatus('success', `Created Pallet Line ${newLocCode} with ${created.length} pallets (${created.map(l => l.code).join(', ')}).`);
    } else if (newLocType === 'BIN') {
      const created = createNewBinRange(newBinStart, newBinEnd);
      addWarehouseLocation(created);
      showStatus('success', `Created ${created.length} bins from BIN-${newBinStart} to BIN-${newBinEnd}.`);
    }
    setIsAddLocationModalOpen(false);
  };

  // Upload Outward SO for Counting Window (Part 5)
  const handleUploadOutwardSO = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedSO = await parseSalesOrderExcel(file, skus);
      const itemsList = parsedSO.items.map(it => ({
        skuCode: it.matchedSku?.sku_code || 'UNTRACKED',
        cleanName: it.cleanItemName,
        outwardQty: typeof it.dispatchQty === 'number' ? it.dispatchQty : it.orderedQty
      }));

      // Check duplicate PI
      if (countSession.reconciledOrders.includes(parsedSO.piNumber) || uploadedOutwardOrders.some(o => o.piNumber === parsedSO.piNumber)) {
        showStatus('error', `Sales Order PI #${parsedSO.piNumber} is already uploaded or reconciled!`);
        return;
      }

      setUploadedOutwardOrders(prev => [...prev, {
        piNumber: parsedSO.piNumber,
        partyName: parsedSO.partyName,
        items: itemsList
      }]);

      showStatus('success', `Uploaded Outward SO PI #${parsedSO.piNumber} (${parsedSO.partyName}) with ${itemsList.length} items.`);
    } catch (err) {
      showStatus('error', `Failed to parse Outward SO: ${(err as Error).message}`);
    } finally {
      e.target.value = '';
    }
  };

  // Reconciled items list combining uploaded orders + app dispatched orders
  const reconciliationTableItems = useMemo(() => {
    const list: Array<{
      id: string;
      source: string;
      skuCode: string;
      cleanName: string;
      outwardQty: number;
      countedStock: number;
      primaryLocation: string;
      netLiveStock: number;
    }> = [];

    // 1. From uploaded outward files
    uploadedOutwardOrders.forEach(ord => {
      ord.items.forEach(it => {
        const matchingEntries = locationStockEntries.filter(
          e => e.skuCode === it.skuCode || e.cleanName.toLowerCase() === it.cleanName.toLowerCase()
        );
        const countedTotal = matchingEntries.reduce((sum, e) => sum + e.countedQty, 0);
        const primaryLoc = matchingEntries[0]?.locationCode || 'A1';
        const net = Math.max(0, countedTotal - it.outwardQty);

        list.push({
          id: `outward-${ord.piNumber}-${it.skuCode}-${it.cleanName}`,
          source: `PI #${ord.piNumber} (${ord.partyName})`,
          skuCode: it.skuCode,
          cleanName: it.cleanName,
          outwardQty: it.outwardQty,
          countedStock: countedTotal,
          primaryLocation: primaryLoc,
          netLiveStock: net
        });
      });
    });

    // 2. From in-app dispatched orders between start & end dates
    if (autoIncludeDispatched) {
      Object.values(deductedSalesOrders).forEach(so => {
        if (!countSession.reconciledOrders.includes(so.piNumber) && !uploadedOutwardOrders.some(u => u.piNumber === so.piNumber)) {
          so.deductions.forEach(d => {
            const matchingEntries = locationStockEntries.filter(e => e.skuId === d.skuId);
            const countedTotal = matchingEntries.reduce((sum, e) => sum + e.countedQty, 0);
            const primaryLoc = matchingEntries[0]?.locationCode || 'A1';
            const net = Math.max(0, countedTotal - d.qtyDeducted);

            list.push({
              id: `app-so-${so.piNumber}-${d.skuId}`,
              source: `App Dispatched: PI #${so.piNumber} (${so.partyName})`,
              skuCode: d.skuCode,
              cleanName: d.cleanName,
              outwardQty: d.qtyDeducted,
              countedStock: countedTotal,
              primaryLocation: primaryLoc,
              netLiveStock: net
            });
          });
        }
      });
    }

    return list;
  }, [uploadedOutwardOrders, autoIncludeDispatched, deductedSalesOrders, locationStockEntries, countSession.reconciledOrders]);

  // Execute Outward Deduction
  const handleApplyOutwardDeductions = () => {
    if (reconciliationTableItems.length === 0) {
      showStatus('error', 'No outward items to reconcile. Upload outward Sales Orders first.');
      return;
    }

    uploadedOutwardOrders.forEach(ord => {
      const itemsToDeduct = ord.items.map(it => ({
        skuCode: it.skuCode,
        cleanName: it.cleanName,
        outwardQty: it.outwardQty,
        deductFromLocation: selectedReconcileLocations[`${ord.piNumber}-${it.skuCode}`] || 'A1'
      }));
      applyOutwardReconciliation(ord.piNumber, itemsToDeduct);
    });

    setUploadedOutwardOrders([]);
    showStatus('success', 'Applied outward deductions to location stock. Counts are now net of dispatches!');
  };

  // Make Location Stock LIVE (Admin Only)
  const handleMakeLocationStockLive = () => {
    if (currentUser?.role !== 'admin') {
      showStatus('error', 'Only Admin (Owner / Superuser) has the authority to make Location Stock LIVE.');
      return;
    }
    const res = syncLocationStockToMaster();
    if (res.success) {
      showStatus('success', res.message);
    } else {
      showStatus('error', res.message);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Status Alert Banner */}
      {statusMessage && (
        <div className={`flex items-center justify-between rounded-xl p-4 text-xs font-bold animate-in fade-in ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200' 
            : 'bg-rose-50 text-rose-900 border border-rose-300 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-rose-600" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Top Banner & Control Bar */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all space-y-4">
        {/* Row 1: Header Titles, Badges, and LIVE Sync button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-black text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 uppercase tracking-wide">
                <MapPin className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                Physical Count Module
              </span>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                100% Independent Sandbox
              </span>
            </div>

            <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Warehouse Location Stock
            </h1>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Physical counting operates isolated from daily dispatches until Admin triggers <strong className="text-slate-700 dark:text-slate-200 font-semibold">Make Location Stock LIVE</strong>.
            </p>
          </div>

          {currentUser?.role === 'admin' && (
            <div className="shrink-0">
              <button
                onClick={handleMakeLocationStockLive}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-orange-700 active:scale-95 transition cursor-pointer"
                title="Sync net location physical totals into main Stock Master"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Make Location Stock LIVE!</span>
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Warehouse Zones information on the left + Excel / Location Actions on the right */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-600 dark:text-slate-300">
            <span className="font-bold text-slate-900 dark:text-white">Active Warehouse Zones:</span> Steel Racks (A–G, 3 shelves) • Floor Pallet Lines (H–P, 6 pallets) • Small Parts Bins (BIN-1 to BIN-30)
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 transition shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
              title="Download pre-filled Excel template"
            >
              <Download className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
              <span>Download Template (.xlsx)</span>
            </button>

            <label className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/90 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer transition shadow-2xs hover:shadow-xs active:scale-95">
              <Upload className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{isUploadingExcel ? 'Uploading...' : 'Upload Filled Excel (.xlsx)'}</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUploadFilledTemplate}
                disabled={isUploadingExcel}
                className="sr-only"
              />
            </label>

            <button
              onClick={() => setIsAddLocationModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>+ Add Location</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Warehouse Locations</span>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {warehouseLocations.length} <span className="text-xs text-slate-400 font-normal">Registered</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">21 Racks • 54 Pallets • 30+ Bins</span>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">SKUs Counted</span>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {uniqueSkusCounted} <span className="text-xs font-normal text-slate-400">/ {skus.length}</span>
          </div>
          <span className="text-[11px] text-indigo-600/80 font-mono mt-0.5 block">{((uniqueSkusCounted / (skus.length || 1)) * 100).toFixed(1)}% Catalog Coverage</span>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Total Counted Units</span>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {totalPhysicalUnits.toLocaleString()} <span className="text-xs font-normal">Pcs</span>
          </div>
          <span className="text-[11px] text-emerald-600/80 font-mono mt-0.5 block">{locationStockEntries.length} Storage Placements</span>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Counting Window Status</span>
          <div className="mt-1 font-mono text-sm font-black text-slate-800 dark:text-slate-200 truncate">
            {reconcileStartDate} → {reconcileEndDate}
          </div>
          <span className="text-[11px] text-amber-600 font-mono font-bold mt-0.5 block">
            {countSession.reconciledOrders.length} Dispatches Reconciled
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('grid')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'grid'
              ? 'border-orange-500 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Boxes className="h-4 w-4" />
          <span>Interactive Location Grid & Entry</span>
        </button>

        <button
          onClick={() => setActiveTab('reconcile')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'reconcile'
              ? 'border-orange-500 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Count-Window Reconciliation & Go-Live</span>
          {reconciliationTableItems.length > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.2 text-[10px] font-black">
              {reconciliationTableItems.length} Pending
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'ledger'
              ? 'border-orange-500 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>All Counted Entries Ledger ({locationStockEntries.length})</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: INTERACTIVE LOCATION GRID & INLINE ENTRY                      */}
      {/* ===================================================================== */}
      {activeTab === 'grid' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {[
                { id: 'ALL', label: 'All Locations' },
                { id: 'RACK', label: 'Steel Racks (A–G)' },
                { id: 'PALLET', label: 'Pallet Lines (H–P)' },
                { id: 'BIN', label: 'Storage Bins (BIN-1–30)' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setZoneFilter(f.id as any)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    zoneFilter === f.id
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search location (e.g. A2, H4, BIN-5)..."
                value={searchLocationQuery}
                onChange={(e) => setSearchLocationQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Location Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {filteredLocations.map(loc => {
              const stats = locationStatsMap.get(loc.code) || { skuCount: 0, totalUnits: 0 };
              const isSelected = selectedLocation?.code === loc.code;
              const hasItems = stats.skuCount > 0;

              return (
                <div
                  key={loc.code}
                  onClick={() => setSelectedLocation(loc)}
                  className={`flex flex-col justify-between p-3 rounded-xl border-2 cursor-pointer transition select-none ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50/70 shadow-sm dark:bg-orange-950/40'
                      : hasItems
                      ? 'border-emerald-300 bg-emerald-50/30 hover:border-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-black text-slate-900 dark:text-white">
                      {loc.code}
                    </span>
                    <span className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.2 ${
                      loc.type === 'RACK' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' 
                        : loc.type === 'PALLET'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                    }`}>
                      {loc.type}
                    </span>
                  </div>

                  <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 font-sans line-clamp-1 leading-snug" title={locationDescMap.get(loc.code) || loc.description}>
                    {locationDescMap.get(loc.code) || loc.description || getLocationDescription(loc.code)}
                  </div>

                  <div className="mt-2.5">
                    <div className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                      {stats.totalUnits.toLocaleString()} Pcs
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {stats.skuCount} {stats.skuCount === 1 ? 'SKU' : 'SKUs'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drawer / Edit Box for Selected Location */}
          {selectedLocation && (
            <div className="rounded-2xl border-2 border-orange-400 bg-white p-6 shadow-md dark:border-orange-600 dark:bg-slate-900 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-2">
                <div>
                  {isEditingLoc ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Location Code / Name:</label>
                        <input
                          type="text"
                          value={editLocCode}
                          onChange={(e) => setEditLocCode(e.target.value.toUpperCase())}
                          className="rounded-lg border border-orange-400 bg-white px-2.5 py-1 text-sm font-mono font-black text-slate-900 dark:bg-slate-800 dark:text-white"
                          placeholder="e.g. H7 or Pallet 7"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Description:</label>
                        <input
                          type="text"
                          value={editLocDesc}
                          onChange={(e) => setEditLocDesc(e.target.value)}
                          className="rounded-lg border border-orange-400 bg-white px-2.5 py-1 text-xs text-slate-900 dark:bg-slate-800 dark:text-white"
                          placeholder="e.g. Floor Pallet 7"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 pt-4">
                        <button
                          onClick={() => {
                            if (editLocCode.trim()) {
                              const norm = normalizeLocationCode(editLocCode.trim());
                              updateWarehouseLocation(selectedLocation.code, {
                                code: norm,
                                description: editLocDesc.trim() || undefined
                              });
                              setSelectedLocation({
                                ...selectedLocation,
                                code: norm,
                                description: editLocDesc.trim() || selectedLocation.description
                              });
                              setIsEditingLoc(false);
                              showStatus('success', `Renamed location to ${norm}.`);
                            }
                          }}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setIsEditingLoc(false)}
                          className="rounded-lg bg-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                        Location {selectedLocation.code}
                      </span>
                      <span className="rounded-lg bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800 px-2.5 py-1 text-xs font-bold font-sans">
                        {locationDescMap.get(selectedLocation.code) || selectedLocation.description || getLocationDescription(selectedLocation.code)}
                      </span>
                      <button
                        onClick={() => {
                          setEditLocCode(selectedLocation.code);
                          setEditLocDesc(selectedLocation.description || '');
                          setIsEditingLoc(true);
                        }}
                        className="text-slate-400 hover:text-orange-600 transition p-1"
                        title="Edit / Rename Location"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete warehouse location ${selectedLocation.code}?`)) {
                              deleteWarehouseLocation(selectedLocation.code);
                              showStatus('success', `Deleted warehouse location ${selectedLocation.code}.`);
                              setSelectedLocation(null);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600 transition p-1"
                          title="Delete Location"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Select any SKU from the 1,421 catalog below (or click + Add New SKU) to record the counted physical stock at this location.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAddNewSkuModalOpen(true)}
                    className="flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Add New SKU</span>
                  </button>
                  <button
                    onClick={() => setSelectedLocation(null)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Two Column Layout: Left Search SKU Combobox + Right Enter Count */}
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: 100% Reliable Autocomplete Search Combobox */}
                <div className="lg:col-span-6 space-y-3">
                  {/* Division Quick Filter Pills */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Item Search & Autocomplete
                    </span>
                    <div className="flex items-center gap-1">
                      {(['ALL', 'DIM', 'DIN', 'DTR'] as const).map(div => (
                        <button
                          key={div}
                          type="button"
                          onClick={() => {
                            setSelectedDivFilter(div);
                            setIsDropdownOpen(true);
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono transition ${
                            selectedDivFilter === div
                              ? 'bg-orange-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {div}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Relative Container WITHOUT overflow-hidden for zero clipping */}
                  <div className="relative">
                    <div className="relative flex items-center">
                      <Search className="h-4 w-4 text-orange-500 absolute left-3 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Type name, size (19mm, 4&quot;, 8x10), SKU, or code (spa, doe, crv)..."
                        value={skuSearchQuery}
                        onChange={(e) => {
                          setSkuSearchQuery(e.target.value);
                          setIsDropdownOpen(true);
                          setHighlightedIndex(0);
                        }}
                        onFocus={() => {
                          setIsDropdownOpen(true);
                        }}
                        onBlur={() => {
                          // Allow onMouseDown on dropdown items to execute before closing
                          setTimeout(() => setIsDropdownOpen(false), 200);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setIsDropdownOpen(true);
                            setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setHighlightedIndex(prev => Math.max(prev - 1, 0));
                          } else if (e.key === 'Enter') {
                            if (isDropdownOpen && suggestions[highlightedIndex]) {
                              e.preventDefault();
                              handleSelectSkuForLocation(suggestions[highlightedIndex]);
                            } else if (selectedSkuForCount) {
                              e.preventDefault();
                              qtyInputRef.current?.focus();
                              qtyInputRef.current?.select();
                            }
                          } else if (e.key === 'Escape') {
                            setIsDropdownOpen(false);
                          }
                        }}
                        className="w-full rounded-xl border-2 border-slate-200 bg-white pl-9 pr-8 py-2.5 text-xs font-medium text-slate-900 shadow-xs focus:border-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      {skuSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSkuSearchQuery('');
                            setSelectedSkuForCount(null);
                            setIsDropdownOpen(true);
                            searchInputRef.current?.focus();
                          }}
                          className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Autocomplete Dropdown popup (Position absolute, z-50, shadow-2xl, max-h-72) */}
                    {isDropdownOpen && (
                      <div 
                        className="absolute top-full left-0 right-0 mt-1.5 z-50 max-h-72 overflow-y-auto rounded-2xl border-2 border-orange-400 bg-white shadow-2xl dark:border-orange-500 dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800"
                      >
                        <div className="sticky top-0 bg-orange-50/95 px-3 py-1.5 text-[10px] font-bold text-orange-900 dark:bg-orange-950/90 dark:text-orange-200 backdrop-blur-xs flex items-center justify-between border-b border-orange-200 dark:border-orange-900 z-10">
                          <span>
                            {suggestions.length} {suggestions.length === 1 ? 'item' : 'items'} {skuSearchQuery ? 'matching' : 'available'} (Enter to select)
                          </span>
                          <span className="font-mono text-[9px] text-orange-700 dark:text-orange-300">
                            ↑↓ Navigate
                          </span>
                        </div>

                        {suggestions.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            No matching items found for "{skuSearchQuery}". Try dimension (e.g. 19mm, 4", 8x10) or shorthand (spa, doe, crv).
                          </div>
                        ) : (
                          suggestions.map((sku, idx) => {
                            const isHighlighted = idx === highlightedIndex;
                            const existingInLoc = locationStockEntries.find(
                              e => e.locationCode === selectedLocation.code && e.skuId === sku.id
                            );

                            return (
                              <div
                                key={sku.id}
                                ref={el => {
                                  if (isHighlighted && el) {
                                    el.scrollIntoView({ block: 'nearest' });
                                  }
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevents input onBlur from closing dropdown before selection!
                                  handleSelectSkuForLocation(sku);
                                }}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                className={`p-3 cursor-pointer text-xs transition flex items-center justify-between gap-3 ${
                                  isHighlighted
                                    ? 'bg-orange-50 font-semibold text-orange-950 dark:bg-orange-950/60 dark:text-orange-100'
                                    : 'hover:bg-slate-50 text-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/60'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white truncate">
                                    {sku.clean_name}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                                    <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                                      sku.division === 'DIM'
                                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                        : sku.division === 'DIN'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                    }`}>
                                      {sku.division}
                                    </span>
                                    <span className="truncate">{sku.main_category}{sku.sub_category ? ` › ${sku.sub_category}` : ''}</span>
                                    <span>•</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{sku.sku_code}</span>
                                  </div>

                                  {/* Placements & Location Descriptions for this Item */}
                                  {(() => {
                                    const placements = skuLocationsMap.get(sku.id) || [];
                                    if (placements.length > 0) {
                                      return (
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                                          <span className="font-bold text-slate-500 dark:text-slate-400">Stored at:</span>
                                          {placements.map(p => (
                                            <span 
                                              key={p.code} 
                                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono ${
                                                p.code === selectedLocation.code 
                                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200 border border-orange-300 dark:border-orange-800 font-bold' 
                                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                              }`}
                                            >
                                              <span className="font-black text-orange-600 dark:text-orange-400">{p.code}</span>
                                              <span className="font-sans text-slate-500 font-medium truncate max-w-[180px]">({p.desc})</span>
                                              <span className="font-bold text-emerald-600 dark:text-emerald-400">: {p.qty} Pcs</span>
                                            </span>
                                          ))}
                                        </div>
                                      );
                                    } else if (sku.location_bin) {
                                      return (
                                        <div className="mt-1 text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                          <span className="font-bold text-slate-400">Bin:</span>
                                          <span className="font-semibold text-slate-700 dark:text-slate-300">{sku.location_bin}</span>
                                          <span className="font-sans text-slate-400">({getLocationDescription(sku.location_bin.split(',')[0])})</span>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>

                                {/* Badges on right: Existing Qty in Current Location */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {existingInLoc ? (
                                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                                      In {selectedLocation.code}: {existingInLoc.countedQty} Pcs
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono text-slate-400">
                                      Stock: {sku.current_stock}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Active Selected SKU preview card or rapid typing tip */}
                  {selectedSkuForCount ? (
                    <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Selected for {selectedLocation.code} ({locationDescMap.get(selectedLocation.code) || selectedLocation.description})</span>
                        </div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate mt-0.5">
                          {selectedSkuForCount.clean_name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {selectedSkuForCount.sku_code} • {selectedSkuForCount.division} • {selectedSkuForCount.main_category}
                        </div>
                        {/* Current locations of selected item */}
                        {(() => {
                          const curLocs = skuLocationsMap.get(selectedSkuForCount.id) || [];
                          if (curLocs.length > 0) {
                            return (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
                                <span className="font-bold text-slate-600 dark:text-slate-400">Recorded Locations:</span>
                                {curLocs.map(l => (
                                  <span key={l.code} className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 font-mono">
                                    <strong className="text-orange-600">{l.code}</strong> <span className="font-sans text-slate-500">({l.desc})</span>: <span className="font-bold text-emerald-600 dark:text-emerald-400">{l.qty} Pcs</span>
                                  </span>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedSkuForCount(null);
                          setSkuSearchQuery('');
                          searchInputRef.current?.focus();
                        }}
                        className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40 text-[11px] text-slate-500 leading-relaxed">
                      💡 <strong>Continuous Factory Flow:</strong> Click search box or type item dimension (e.g. <span className="font-mono text-orange-600 font-bold">19mm</span>, <span className="font-mono text-orange-600 font-bold">4"</span>, <span className="font-mono text-orange-600 font-bold">8x10</span>) or code (<span className="font-mono text-orange-600 font-bold">spa</span>, <span className="font-mono text-orange-600 font-bold">doe</span>). Press Enter to select, type quantity, and press Enter to save & jump straight back to search!
                    </div>
                  )}
                </div>

                {/* Right: Quantity & Notes with Enter-to-Save */}
                <div className="lg:col-span-6 flex flex-col justify-between space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  {selectedSkuForCount ? (
                    <div>
                      <div className="text-[10px] font-bold text-orange-600 uppercase">
                        Physical Count for {selectedLocation.code}:
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 truncate">
                        {selectedSkuForCount.clean_name}
                      </h4>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {selectedSkuForCount.sku_code} • {selectedSkuForCount.division} • {selectedSkuForCount.main_category}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Counted Quantity ({selectedSkuForCount.unit})
                          </label>
                          <input
                            ref={qtyInputRef}
                            type="number"
                            min={0}
                            placeholder="Type count (e.g. 50)"
                            value={countedQtyInput}
                            onChange={(e) => setCountedQtyInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveCountEntry();
                              }
                            }}
                            className="w-full rounded-xl border-2 border-orange-400 bg-white px-3 py-2 font-mono text-lg font-black text-slate-900 focus:outline-hidden dark:bg-slate-900 dark:border-orange-500 dark:text-white shadow-xs"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Count Notes (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 2 boxes + 10 loose"
                            value={countNotes}
                            onChange={(e) => setCountNotes(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveCountEntry();
                              }
                            }}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleSaveCountEntry}
                        className="mt-4 w-full rounded-xl bg-orange-600 py-2.5 text-xs font-black text-white shadow-xs hover:bg-orange-700 active:scale-98 transition flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>+ Save to {selectedLocation.code} (or Press Enter)</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 text-xs py-8">
                      <Search className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300">No item selected</p>
                      <p className="text-[11px] mt-0.5">Use the search box on the left or pick from the suggestion list.</p>
                    </div>
                  )}

                  {/* Items already recorded in this location */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center justify-between">
                      <span>Already Stored in {selectedLocation.code} ({itemsInSelectedLocation.length} items):</span>
                      <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        Total: {itemsInSelectedLocation.reduce((s, e) => s + e.countedQty, 0).toLocaleString()} Pcs
                      </span>
                    </div>
                    {itemsInSelectedLocation.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">No items stored in {selectedLocation.code} yet.</span>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {itemsInSelectedLocation.map(it => (
                          <div key={it.id} className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-900 dark:text-white truncate block">{it.cleanName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {it.skuCode} • {locationDescMap.get(it.locationCode) || selectedLocation.description}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                                {it.countedQty.toLocaleString()} Pcs
                              </span>
                              <button
                                onClick={() => deleteLocationStockEntry(it.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                                title="Remove entry"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: COUNT-WINDOW RECONCILIATION & GO-LIVE (PART 5)                 */}
      {/* ===================================================================== */}
      {activeTab === 'reconcile' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-600" />
              <span>Physical Count Window & Outward Sales Order Reconciliation</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Because counting takes several days while factory dispatches continue, upload outward Sales Orders executed between <strong>Start Date</strong> and <strong>End Date</strong> to subtract them from the counted location stock before making it live!
            </p>

            {/* Date Pickers & SO Upload */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Count Start Date:
                </label>
                <input
                  type="date"
                  value={reconcileStartDate}
                  onChange={(e) => {
                    setReconcileStartDate(e.target.value);
                    setCountSession({ startDate: e.target.value });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Count End Date:
                </label>
                <input
                  type="date"
                  value={reconcileEndDate}
                  onChange={(e) => {
                    setReconcileEndDate(e.target.value);
                    setCountSession({ endDate: e.target.value });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Upload Dispatched Sales Order (.xlsx):
                </label>
                <label className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-orange-300 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300 cursor-pointer transition">
                  <Upload className="h-4 w-4" />
                  <span>Upload Tally SO (.xlsx)</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleUploadOutwardSO}
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="flex items-center gap-2 pb-2">
                <input
                  type="checkbox"
                  id="autoIncludeDispatchedCheck"
                  checked={autoIncludeDispatched}
                  onChange={(e) => setAutoIncludeDispatched(e.target.checked)}
                  className="rounded border-slate-300 text-orange-600 focus:ring-0"
                />
                <label htmlFor="autoIncludeDispatchedCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Auto-Include Dispatched SOs in App
                </label>
              </div>
            </div>
          </div>

          {/* Reconciliation Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-sm">
                  Outward Reconciliation Preview Table
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {reconciliationTableItems.length} outward items detected in counting window
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleApplyOutwardDeductions}
                  disabled={reconciliationTableItems.length === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40 transition"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Apply Outward Deduction to Location Stock</span>
                </button>

                {currentUser?.role === 'admin' && (
                  <button
                    onClick={handleMakeLocationStockLive}
                    className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Make Location Stock LIVE</span>
                  </button>
                )}
              </div>
            </div>

            {reconciliationTableItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No outward orders currently queued for reconciliation. Upload a Tally Sales Order .xlsx file above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-800">
                      <th className="py-3 px-4">Item Name / SKU</th>
                      <th className="py-3 px-3">Dispatched Source</th>
                      <th className="py-3 px-3 text-right">Counted Location Stock</th>
                      <th className="py-3 px-3 text-right text-rose-600">Outward Qty (-)</th>
                      <th className="py-3 px-3 text-center">Deduct From Location</th>
                      <th className="py-3 px-3 text-right text-emerald-600">Final Net Live Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {reconciliationTableItems.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-white">
                          <div>{item.cleanName}</div>
                          <span className="text-[10px] text-slate-400 font-mono">{item.skuCode}</span>
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-600 dark:text-slate-400">
                          {item.source}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {item.countedStock.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-rose-600">
                          -{item.outwardQty.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <select
                            value={selectedReconcileLocations[item.id] || item.primaryLocation}
                            onChange={(e) => setSelectedReconcileLocations({
                              ...selectedReconcileLocations,
                              [item.id]: e.target.value
                            })}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                          >
                            {warehouseLocations.map(l => (
                              <option key={l.code} value={l.code}>
                                {l.code} — {locationDescMap.get(l.code) || l.description || getLocationDescription(l.code)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {item.netLiveStock.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: ALL COUNTED ENTRIES LEDGER                                    */}
      {/* ===================================================================== */}
      {activeTab === 'ledger' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-sm">
                Physical Count Entries Audit Ledger ({locationStockEntries.length})
              </h3>
              <p className="text-xs text-slate-500">Every counted item across Racks, Pallets, and Bins.</p>
            </div>

            {locationStockEntries.length > 0 && currentUser?.role === 'admin' && (
              <button
                onClick={() => {
                  if (confirm('Clear all physical location count entries?')) {
                    clearLocationStockEntries();
                    showStatus('success', 'Cleared all location entries.');
                  }
                }}
                className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Count Entries</span>
              </button>
            )}
          </div>

          {locationStockEntries.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No physical count entries recorded yet. Upload filled Excel or click any location in the Grid to enter counts.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-800 sticky top-0">
                    <th className="py-3 px-3">Location Code</th>
                    <th className="py-3 px-4">Location Description</th>
                    <th className="py-3 px-3">SKU Code</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-2 text-center">Division</th>
                    <th className="py-3 px-3 text-right">Counted Qty</th>
                    <th className="py-3 px-3">Counted By</th>
                    <th className="py-3 px-3">Notes</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {locationStockEntries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-black text-orange-600 dark:text-orange-400">
                        <span className="px-2 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 inline-block font-bold">
                          {e.locationCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-sans text-xs text-slate-700 dark:text-slate-300">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {locationDescMap.get(e.locationCode) || getLocationDescription(e.locationCode)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {getLocationZone(e.locationCode)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {e.skuCode}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                        {e.cleanName}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold">
                        <span className="rounded px-1.5 py-0.2 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {e.division}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                        {e.countedQty.toLocaleString()} Pcs
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {e.countedBy}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 truncate max-w-[200px]">
                        {e.notes || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => {
                            if (confirm(`Delete counted entry for "${e.cleanName}" at ${e.locationCode}?`)) {
                              deleteLocationStockEntry(e.id);
                              showStatus('success', `Deleted count entry for ${e.skuCode} at ${e.locationCode}.`);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Delete this counted entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ADD NEW LOCATION MODAL (RACK / PALLET LINE / BINS / CUSTOM)            */}
      {/* ===================================================================== */}
      {isAddLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-orange-600" />
              <span>+ Add New Warehouse Location</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Expand warehouse capacity with custom locations, pallets, racks, or bins.
            </p>

            <form onSubmit={handleCreateNewLocations} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Location Type:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'CUSTOM', label: 'Custom (Any)' },
                    { id: 'PALLET', label: 'Pallet Line' },
                    { id: 'RACK', label: 'Steel Rack' },
                    { id: 'BIN', label: 'Bins' },
                  ].map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setNewLocType(t.id as any)}
                      className={`py-2 px-1 text-center rounded-xl border text-[11px] font-bold transition ${
                        newLocType === t.id
                          ? 'border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {newLocType === 'CUSTOM' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Custom Location Name / Code: <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customLocCode}
                      onChange={(e) => setCustomLocCode(e.target.value)}
                      placeholder="e.g. Pallet 7, Shed A, Floor 1, QC Bay"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Zone / Area:
                      </label>
                      <input
                        type="text"
                        value={customLocZone}
                        onChange={(e) => setCustomLocZone(e.target.value)}
                        placeholder="e.g. Main Godown Floor"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Description:
                      </label>
                      <input
                        type="text"
                        value={customLocDesc}
                        onChange={(e) => setCustomLocDesc(e.target.value)}
                        placeholder="e.g. Heavy Duty Pallet"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}


              {newLocType === 'BIN' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Start Bin Number:
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newBinStart}
                      onChange={(e) => setNewBinStart(parseInt(e.target.value, 10) || 31)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      End Bin Number:
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newBinEnd}
                      onChange={(e) => setNewBinEnd(parseInt(e.target.value, 10) || 50)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddLocationModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 shadow-xs"
                >
                  Create Locations
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
