import { create } from 'zustand';
import initialSeedData from '../data/okf_stock_seed.json';
import { 
  SkuItem, 
  CategoryGroup, 
  DivisionCode, 
  DivisionInfo, 
  Transaction, 
  InventoryStats, 
  ActiveNavModule, 
  DrillDownState,
  TransactionType,
  SalesOrderData
} from '../types/inventory';
import { InventorySearchEngine } from '../lib/searchEngine';
import * as XLSX from 'xlsx';

export interface DeductedSOInfo {
  piNumber: string;
  partyName: string;
  deductedAt: string;
  itemsCount: number;
  unitsTotal: number;
  deductions: Array<{
    skuId: string;
    skuCode: string;
    cleanName: string;
    qtyDeducted: number;
    prevStock: number;
    newStock: number;
  }>;
  soDataSnapshot?: SalesOrderData;
}

interface InventoryStore {
  // Data
  skus: SkuItem[];
  categories: CategoryGroup[];
  divisions: Record<DivisionCode, DivisionInfo>;
  transactions: Transaction[];
  stats: InventoryStats;
  deductedSalesOrders: Record<string, DeductedSOInfo>;

  // Search Engine Instance
  searchEngine: InventorySearchEngine;

  // Navigation & Drill-Down State
  activeModule: ActiveNavModule;
  drillDown: DrillDownState;
  selectedSku: SkuItem | null;
  globalSearchQuery: string;
  activeDivisionFilter: DivisionCode | 'ALL';

  // Modals & Drawers
  isCommandPaletteOpen: boolean;
  isKeyboardShortcutsOpen: boolean;
  isSidebarOpen: boolean;
  stockTransactionModalSku: SkuItem | null;
  updateWriteOffModalCategory: CategoryGroup | null;
  isDarkMode: boolean;

  // Actions
  setActiveModule: (module: ActiveNavModule) => void;
  setDrillDown: (state: Partial<DrillDownState>) => void;
  navigateToLevel: (level: 1 | 2 | 3 | 4) => void;
  setSelectedSku: (sku: SkuItem | null) => void;
  setGlobalSearchQuery: (query: string) => void;
  setActiveDivisionFilter: (div: DivisionCode | 'ALL') => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setKeyboardShortcutsOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setStockTransactionModalSku: (sku: SkuItem | null) => void;
  setUpdateWriteOffModalCategory: (cat: CategoryGroup | null) => void;
  toggleDarkMode: () => void;

  // Inventory Operations
  quickAdjustStock: (skuId: string, delta: number) => void;
  recordTransaction: (
    skuId: string, 
    type: TransactionType, 
    quantity: number, 
    reason: string, 
    performedBy: string
  ) => void;
  updateCategoryWriteOffDate: (groupId: string, newDate: string, auditNote?: string) => void;
  updateSkuWriteOffDate: (skuId: string, newDate: string) => void;
  batchUpdateWriteOffDate: (division: DivisionCode, mainCat: string, newDate: string) => void;
  resetToInitialSeed: () => void;
  exportCatalogToExcel: () => void;
  importStockExcel: (file: File) => Promise<{ success: boolean; message: string; stats?: any }>;
  deductSalesOrderStock: (so: SalesOrderData) => { success: boolean; message: string };
  undoDeductSalesOrderStock: (piNumber: string) => { success: boolean; message: string };
}

const computeStats = (skus: SkuItem[]): InventoryStats => {
  const totalStock = skus.reduce((acc, s) => acc + Math.round(s.current_stock), 0);
  return {
    total_skus: skus.length,
    total_stock: totalStock,
    total_divisions: 3,
    total_main_categories: new Set(skus.map(s => s.main_category)).size,
    total_sub_groups: new Set(skus.map(s => `${s.division}>${s.main_category}>${s.sub_category}>${s.product_group}`)).size,
    total_audited_skus: skus.filter(s => s.last_write_off_date).length,
    total_positive_stock: skus.filter(s => s.current_stock > 0).length,
    total_zero_stock: skus.filter(s => s.current_stock === 0).length,
    total_negative_stock: skus.filter(s => s.current_stock < 0).length,
  };
};

// Storage key updated for 100% whole integer dataset (1,421 SKUs, 3,812,304 Stock)
const STORAGE_KEY = 'okf_inventory_store_qty_whole_v1';

const getInitialState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.skus && parsed.skus.length === 1421) {
        return {
          skus: parsed.skus as SkuItem[],
          categories: parsed.categories as CategoryGroup[],
          divisions: parsed.divisions as Record<DivisionCode, DivisionInfo>,
          transactions: parsed.transactions as Transaction[],
          deductedSalesOrders: (parsed.deductedSalesOrders || {}) as Record<string, DeductedSOInfo>,
        };
      }
    }
  } catch (e) {
    console.warn('Could not restore from localStorage, using initial seed data', e);
  }

  return {
    skus: initialSeedData.skus as unknown as SkuItem[],
    categories: initialSeedData.categories_hierarchy as CategoryGroup[],
    divisions: initialSeedData.divisions as Record<DivisionCode, DivisionInfo>,
    transactions: initialSeedData.initial_transactions as Transaction[],
    deductedSalesOrders: {} as Record<string, DeductedSOInfo>,
  };
};

const initial = getInitialState();
const initialEngine = new InventorySearchEngine(initial.skus);

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  skus: initial.skus,
  categories: initial.categories,
  divisions: initial.divisions,
  transactions: initial.transactions,
  stats: computeStats(initial.skus),
  deductedSalesOrders: initial.deductedSalesOrders,
  searchEngine: initialEngine,

  activeModule: 'stock-master',
  drillDown: {
    level: 1,
    segment: 'Domestic',
    division: null,
    mainCategory: null,
    subCategory: null,
    productGroup: null,
  },
  selectedSku: null,
  globalSearchQuery: '',
  activeDivisionFilter: 'ALL',

  isCommandPaletteOpen: false,
  isKeyboardShortcutsOpen: false,
  isSidebarOpen: false,
  stockTransactionModalSku: null,
  updateWriteOffModalCategory: null,
  isDarkMode: typeof document !== 'undefined' ? (document.documentElement.classList.contains('dark') || localStorage.getItem('okf_theme') === 'dark') : false,

  setActiveModule: (module) => set({ activeModule: module }),

  setDrillDown: (partial) => {
    set(state => ({
      drillDown: { ...state.drillDown, ...partial }
    }));
  },

  navigateToLevel: (level) => {
    set(state => {
      const dd = { ...state.drillDown, level };
      if (level === 1) {
        dd.division = null;
        dd.mainCategory = null;
        dd.subCategory = null;
        dd.productGroup = null;
      } else if (level === 2) {
        dd.mainCategory = null;
        dd.subCategory = null;
        dd.productGroup = null;
      } else if (level === 3) {
        dd.subCategory = null;
        dd.productGroup = null;
      }
      return { drillDown: dd };
    });
  },

  setSelectedSku: (sku) => set({ selectedSku: sku }),
  setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
  setActiveDivisionFilter: (div) => set({ activeDivisionFilter: div }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setKeyboardShortcutsOpen: (open) => set({ isKeyboardShortcutsOpen: open }),
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setStockTransactionModalSku: (sku) => set({ stockTransactionModalSku: sku }),
  setUpdateWriteOffModalCategory: (cat) => set({ updateWriteOffModalCategory: cat }),
  
  toggleDarkMode: () => {
    set(state => {
      const next = !state.isDarkMode;
      if (typeof document !== 'undefined') {
        if (next) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('okf_theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('okf_theme', 'light');
        }
      }
      return { isDarkMode: next };
    });
  },

  quickAdjustStock: (skuId, delta) => {
    const state = get();
    const sku = state.skus.find(s => s.id === skuId);
    if (!sku) return;

    const intDelta = Math.round(delta);
    const prevStock = Math.round(sku.current_stock);
    const newStock = prevStock + intDelta;
    const qtyChange = Math.abs(intDelta);
    const txnType: TransactionType = intDelta > 0 ? 'STOCK_IN' : 'STOCK_OUT';

    const updatedSku: SkuItem = {
      ...sku,
      current_stock: newStock,
      quantity: newStock,
      status: newStock === 0 ? 'Zero Stock' : (newStock < 0 ? 'Negative' : 'In Stock'),
      last_modified: new Date().toISOString()
    };

    const newTxn: Transaction = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      sku_code: sku.sku_code,
      sku_name: sku.clean_name,
      type: txnType,
      quantity: qtyChange,
      reason: intDelta > 0 ? 'Quick Inline Stock Increment (+)' : 'Quick Inline Stock Decrement (-)',
      performed_by: 'Warehouse Staff',
      timestamp: new Date().toISOString(),
      prev_stock: prevStock,
      new_stock: newStock,
    };

    const nextSkus = state.skus.map(s => s.id === skuId ? updatedSku : s);
    const nextTransactions = [newTxn, ...state.transactions];
    const nextStats = computeStats(nextSkus);

    // Update division total stock as whole integer
    const nextDivisions = { ...state.divisions };
    if (nextDivisions[sku.division]) {
      const divStock = nextSkus.filter(s => s.division === sku.division).reduce((a, s) => a + Math.round(s.current_stock), 0);
      nextDivisions[sku.division] = {
        ...nextDivisions[sku.division],
        total_stock: divStock
      };
    }

    state.searchEngine.updateData(nextSkus);

    set({
      skus: nextSkus,
      divisions: nextDivisions,
      transactions: nextTransactions,
      stats: nextStats,
      selectedSku: state.selectedSku?.id === skuId ? updatedSku : state.selectedSku,
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        skus: nextSkus,
        categories: state.categories,
        divisions: nextDivisions,
        transactions: nextTransactions,
      }));
    } catch (e) {
      console.warn('Storage save error', e);
    }
  },

  recordTransaction: (skuId, type, quantity, reason, performedBy) => {
    const state = get();
    const sku = state.skus.find(s => s.id === skuId);
    if (!sku) return;

    const prevStock = Math.round(sku.current_stock);
    let newStock = prevStock;
    const intQty = Math.round(quantity);

    if (type === 'STOCK_IN') {
      newStock = prevStock + intQty;
    } else if (type === 'STOCK_OUT') {
      newStock = prevStock - intQty;
    } else if (type === 'AUDIT_ADJUSTMENT') {
      newStock = intQty;
    }

    const updatedSku: SkuItem = {
      ...sku,
      current_stock: newStock,
      quantity: newStock,
      status: newStock === 0 ? 'Zero Stock' : (newStock < 0 ? 'Negative' : 'In Stock'),
      last_modified: new Date().toISOString(),
      last_audit_date: type === 'AUDIT_ADJUSTMENT' ? new Date().toLocaleDateString('en-GB') : sku.last_audit_date
    };

    const newTxn: Transaction = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      sku_code: sku.sku_code,
      sku_name: sku.clean_name,
      type,
      quantity: intQty,
      reason: reason || `${type} operation`,
      performed_by: performedBy || 'Operator',
      timestamp: new Date().toISOString(),
      prev_stock: prevStock,
      new_stock: newStock,
    };

    const nextSkus = state.skus.map(s => s.id === skuId ? updatedSku : s);
    const nextTransactions = [newTxn, ...state.transactions];
    const nextStats = computeStats(nextSkus);

    const nextDivisions = { ...state.divisions };
    if (nextDivisions[sku.division]) {
      const divStock = nextSkus.filter(s => s.division === sku.division).reduce((a, s) => a + Math.round(s.current_stock), 0);
      nextDivisions[sku.division] = {
        ...nextDivisions[sku.division],
        total_stock: divStock
      };
    }

    state.searchEngine.updateData(nextSkus);

    set({
      skus: nextSkus,
      divisions: nextDivisions,
      transactions: nextTransactions,
      stats: nextStats,
      selectedSku: state.selectedSku?.id === skuId ? updatedSku : state.selectedSku,
      stockTransactionModalSku: null
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        skus: nextSkus,
        categories: state.categories,
        divisions: nextDivisions,
        transactions: nextTransactions,
      }));
    } catch (e) {
      console.warn('Storage save error', e);
    }
  },

  updateCategoryWriteOffDate: (groupId, newDate, auditNote) => {
    const state = get();
    const group = state.categories.find(c => c.group_id === groupId);
    if (!group) return;

    const nextCategories = state.categories.map(c => 
      c.group_id === groupId ? { ...c, last_write_off_date: newDate } : c
    );

    const nextSkus = state.skus.map(s => {
      if (s.division === group.division && s.main_category === group.main_category && s.sub_category === group.sub_category) {
        return {
          ...s,
          last_write_off_date: newDate,
          write_off_source_header: `Manual Audit Update (${newDate})`,
          last_audit_date: newDate,
          last_modified: new Date().toISOString()
        };
      }
      return s;
    });

    const newTxn: Transaction = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      sku_code: groupId,
      sku_name: `${group.division} > ${group.main_category} > ${group.sub_category}`,
      type: 'WRITE_OFF_SYNC',
      quantity: group.sku_count,
      reason: auditNote ? `Audit Date Set: ${newDate} - ${auditNote}` : `Write-Off Date Updated to ${newDate}`,
      performed_by: 'Inventory Auditor',
      timestamp: new Date().toISOString(),
      prev_stock: 0,
      new_stock: 0,
    };

    const nextTransactions = [newTxn, ...state.transactions];
    const nextStats = computeStats(nextSkus);

    state.searchEngine.updateData(nextSkus);

    set({
      categories: nextCategories,
      skus: nextSkus,
      transactions: nextTransactions,
      stats: nextStats,
      updateWriteOffModalCategory: null
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        skus: nextSkus,
        categories: nextCategories,
        divisions: state.divisions,
        transactions: nextTransactions,
      }));
    } catch (e) {
      console.warn('Storage save error', e);
    }
  },

  updateSkuWriteOffDate: (skuId, newDate) => {
    const state = get();
    const sku = state.skus.find(s => s.id === skuId);
    if (!sku) return;

    const updatedSku: SkuItem = {
      ...sku,
      last_write_off_date: newDate,
      write_off_source_header: `Manual SKU Audit (${newDate})`,
      last_audit_date: newDate,
      last_modified: new Date().toISOString()
    };

    const nextSkus = state.skus.map(s => s.id === skuId ? updatedSku : s);
    const nextStats = computeStats(nextSkus);
    state.searchEngine.updateData(nextSkus);

    set({
      skus: nextSkus,
      stats: nextStats,
      selectedSku: state.selectedSku?.id === skuId ? updatedSku : state.selectedSku
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        skus: nextSkus,
        categories: state.categories,
        divisions: state.divisions,
        transactions: state.transactions,
      }));
    } catch (e) {
      console.warn('Storage save error', e);
    }
  },

  batchUpdateWriteOffDate: (division, mainCat, newDate) => {
    const state = get();
    const nextCategories = state.categories.map(c => {
      if (c.division === division && c.main_category === mainCat) {
        return { ...c, last_write_off_date: newDate };
      }
      return c;
    });

    const nextSkus = state.skus.map(s => {
      if (s.division === division && s.main_category === mainCat) {
        return {
          ...s,
          last_write_off_date: newDate,
          write_off_source_header: `Batch Main Category Audit (${newDate})`,
          last_audit_date: newDate,
          last_modified: new Date().toISOString()
        };
      }
      return s;
    });

    const nextStats = computeStats(nextSkus);
    state.searchEngine.updateData(nextSkus);

    set({
      categories: nextCategories,
      skus: nextSkus,
      stats: nextStats
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        skus: nextSkus,
        categories: nextCategories,
        divisions: state.divisions,
        transactions: state.transactions,
      }));
    } catch (e) {
      console.warn('Storage save error', e);
    }
  },

  resetToInitialSeed: () => {
    localStorage.removeItem(STORAGE_KEY);
    const skus = initialSeedData.skus as unknown as SkuItem[];
    const categories = initialSeedData.categories_hierarchy as CategoryGroup[];
    const divisions = initialSeedData.divisions as Record<DivisionCode, DivisionInfo>;
    const transactions = initialSeedData.initial_transactions as Transaction[];
    
    const engine = new InventorySearchEngine(skus);

    set({
      skus,
      categories,
      divisions,
      transactions,
      stats: computeStats(skus),
      searchEngine: engine,
      selectedSku: null,
      globalSearchQuery: ''
    });
  },

  exportCatalogToExcel: () => {
    const state = get();
    const rows = state.skus.map(s => ({
      'SKU Code': s.sku_code,
      'Excel Row': s.excel_row,
      'Division': s.division,
      'Main Category': s.main_category,
      'Sub-Category': s.sub_category,
      'Product Group': s.product_group,
      'Cleaned Part Name': s.clean_name,
      'Size / Spec': s.size_spec,
      'Material / Brand Tier': s.material_and_tier,
      'Pack Type': s.pack_type,
      'Last Write-Off Date': s.last_write_off_date || 'Not Recorded',
      'Write-Off Source Header': s.write_off_source_header || 'None',
      'Stock Quantity': s.current_stock,
      'Unit': s.unit,
      'Stock Status': s.status,
      'Bin Location': s.location_bin,
      'Original Tally Name': s.original_tally_name
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'OKF Stock Quantity Master');
    XLSX.writeFile(workbook, `OKF_Stock_Master_1421_SKUs_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  importStockExcel: async (file: File) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          const wb = XLSX.read(buffer, { type: 'binary', cellStyles: true });
          const ws = wb.Sheets[wb.SheetNames[0]];

          const state = get();
          const existingMap = new Map<string, SkuItem>();
          state.skus.forEach(s => {
            const key = (s.normalized_key || s.original_tally_name).replace(/[\s_]/g, '').toLowerCase();
            existingMap.set(key, s);
          });

          // Read range
          const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:C2000');
          let updatedCount = 0;
          let matchedTotalStock = 0;

          const nextSkus = [...state.skus];

          for (let r = range.s.r; r <= range.e.r; r++) {
            const cellA = ws[XLSX.utils.encode_cell({ r, c: 0 })];
            const cellB = ws[XLSX.utils.encode_cell({ r, c: 1 })];

            if (!cellA || !cellA.v) continue;
            const rawName = String(cellA.v).trim();
            const normKey = rawName.replace(/['"]/g, '"').replace(/[\s_]/g, '').toLowerCase();

            // Ignore header rows
            if (rawName.toLowerCase() === 'particulars' || rawName.toLowerCase() === 'grand total') continue;

            const existing = existingMap.get(normKey);
            if (existing) {
              let qty = 0;
              if (cellB && cellB.v !== undefined && cellB.v !== null && cellB.v !== '') {
                const valF = parseFloat(String(cellB.v));
                if (!isNaN(valF)) {
                  qty = Math.round(valF);
                }
              }

              const idx = nextSkus.findIndex(s => s.id === existing.id);
              if (idx !== -1) {
                nextSkus[idx] = {
                  ...nextSkus[idx],
                  current_stock: qty,
                  quantity: qty,
                  status: qty === 0 ? 'Zero Stock' : (qty < 0 ? 'Negative' : 'In Stock'),
                  last_modified: new Date().toISOString()
                };
                updatedCount++;
                matchedTotalStock += qty;
              }
            }
          }

          const nextStats = computeStats(nextSkus);

          // Update divisions total stock
          const nextDivisions = { ...state.divisions };
          for (const d of ['DIM', 'DIN', 'DTR'] as DivisionCode[]) {
            const dStock = nextSkus.filter(s => s.division === d).reduce((a, s) => a + Math.round(s.current_stock), 0);
            if (nextDivisions[d]) {
              nextDivisions[d] = {
                ...nextDivisions[d],
                total_stock: dStock
              };
            }
          }

          state.searchEngine.updateData(nextSkus);

          set({
            skus: nextSkus,
            divisions: nextDivisions,
            stats: nextStats
          });

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
              skus: nextSkus,
              categories: state.categories,
              divisions: nextDivisions,
              transactions: state.transactions,
            }));
          } catch (err) {
            console.warn(err);
          }

          resolve({
            success: true,
            message: `Successfully updated stock quantities for ${updatedCount} SKUs. Total physical stock: ${nextStats.total_stock.toLocaleString()}`,
            stats: nextStats
          });
        } catch (err) {
          resolve({
            success: false,
            message: `Error parsing Tally Excel sheet: ${(err as Error).message}`
          });
        }
      };
      reader.readAsBinaryString(file);
    });
  },

  deductSalesOrderStock: (so: SalesOrderData) => {
    const state = get();
    if (state.deductedSalesOrders[so.piNumber]) {
      const existing = state.deductedSalesOrders[so.piNumber];
      return {
        success: false,
        message: `Duplicate Deduction Blocked: PI #${so.piNumber} was already deducted on ${existing.deductedAt}.`
      };
    }

    const deductions: DeductedSOInfo['deductions'] = [];
    const nextSkus = [...state.skus];
    let unitsTotal = 0;
    const newTxns: Transaction[] = [];

    so.items.forEach(item => {
      if (!item.matchedSku || item.isPromoOrNonStock) return;
      const idx = nextSkus.findIndex(s => s.id === item.matchedSku!.id);
      if (idx === -1) return;

      const sku = nextSkus[idx];
      const prevStock = Math.round(sku.current_stock);
      const deductQty = typeof item.dispatchQty === 'number' ? Math.round(item.dispatchQty) : Math.round(item.orderedQty);
      if (deductQty <= 0) return;
      const newStock = prevStock - deductQty;

      nextSkus[idx] = {
        ...sku,
        current_stock: newStock,
        quantity: newStock,
        status: newStock === 0 ? 'Zero Stock' : (newStock < 0 ? 'Negative' : 'In Stock'),
        last_modified: new Date().toISOString()
      };

      unitsTotal += deductQty;
      deductions.push({
        skuId: sku.id,
        skuCode: sku.sku_code,
        cleanName: sku.clean_name,
        qtyDeducted: deductQty,
        prevStock,
        newStock
      });

      const isPartial = deductQty < Math.round(item.orderedQty);
      newTxns.push({
        id: `TXN-SO-${so.piNumber}-${Date.now().toString().slice(-4)}-${deductions.length}`,
        sku_code: sku.sku_code,
        sku_name: sku.clean_name,
        type: 'STOCK_OUT',
        quantity: deductQty,
        reason: isPartial
          ? `Sales Order PI #${so.piNumber} Partial Dispatch (${deductQty} of ${item.orderedQty} ordered) to ${so.partyName}`
          : `Sales Order PI #${so.piNumber} Full Dispatch (${deductQty} Units) to ${so.partyName}`,
        performed_by: 'Dispatch Staff',
        timestamp: new Date().toISOString(),
        prev_stock: prevStock,
        new_stock: newStock
      });
    });

    if (deductions.length === 0) {
      return {
        success: false,
        message: 'No stock-tracked items to deduct in this Sales Order.'
      };
    }

    const nextDivisions = { ...state.divisions };
    (['DIM', 'DIN', 'DTR'] as DivisionCode[]).forEach(divCode => {
      if (nextDivisions[divCode]) {
        const divStock = nextSkus.filter(s => s.division === divCode).reduce((a, s) => a + Math.round(s.current_stock), 0);
        nextDivisions[divCode] = {
          ...nextDivisions[divCode],
          total_stock: divStock
        };
      }
    });

    const nextStats = computeStats(nextSkus);
    state.searchEngine.updateData(nextSkus);

    const soRecord: DeductedSOInfo = {
      piNumber: so.piNumber,
      partyName: so.partyName,
      deductedAt: new Date().toLocaleString('en-GB'),
      itemsCount: deductions.length,
      unitsTotal,
      deductions,
      soDataSnapshot: so
    };

    const nextDeductedSOs = {
      ...state.deductedSalesOrders,
      [so.piNumber]: soRecord
    };

    const nextTransactions = [...newTxns, ...state.transactions];

    set({
      skus: nextSkus,
      divisions: nextDivisions,
      transactions: nextTransactions,
      stats: nextStats,
      deductedSalesOrders: nextDeductedSOs
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        skus: nextSkus,
        categories: state.categories,
        divisions: nextDivisions,
        transactions: nextTransactions,
        deductedSalesOrders: nextDeductedSOs
      }));
    } catch (err) {
      console.warn('Storage save error', err);
    }

    return {
      success: true,
      message: `Successfully deducted ${unitsTotal.toLocaleString()} units for PI #${so.piNumber} (${deductions.length} SKUs).`
    };
  },

  undoDeductSalesOrderStock: (piNumber: string) => {
    const state = get();
    const record = state.deductedSalesOrders[piNumber];
    if (!record) return { success: false, message: `No deduction record found for PI #${piNumber}` };

    const nextSkus = [...state.skus];
    const undoTxns: Transaction[] = [];

    record.deductions.forEach(d => {
      const idx = nextSkus.findIndex(s => s.id === d.skuId);
      if (idx !== -1) {
        const sku = nextSkus[idx];
        const prevStock = Math.round(sku.current_stock);
        const newStock = prevStock + d.qtyDeducted;

        nextSkus[idx] = {
          ...sku,
          current_stock: newStock,
          quantity: newStock,
          status: newStock === 0 ? 'Zero Stock' : (newStock < 0 ? 'Negative' : 'In Stock'),
          last_modified: new Date().toISOString()
        };

        undoTxns.push({
          id: `TXN-UNDO-SO-${piNumber}-${Date.now().toString().slice(-4)}`,
          sku_code: sku.sku_code,
          sku_name: sku.clean_name,
          type: 'STOCK_IN',
          quantity: d.qtyDeducted,
          reason: `Reversal of PI #${piNumber} Dispatch Deduction`,
          performed_by: 'Warehouse Admin',
          timestamp: new Date().toISOString(),
          prev_stock: prevStock,
          new_stock: newStock
        });
      }
    });

    const nextDivisions = { ...state.divisions };
    (['DIM', 'DIN', 'DTR'] as DivisionCode[]).forEach(divCode => {
      if (nextDivisions[divCode]) {
        const divStock = nextSkus.filter(s => s.division === divCode).reduce((a, s) => a + Math.round(s.current_stock), 0);
        nextDivisions[divCode] = {
          ...nextDivisions[divCode],
          total_stock: divStock
        };
      }
    });

    const nextStats = computeStats(nextSkus);
    state.searchEngine.updateData(nextSkus);

    const nextDeductedSOs = { ...state.deductedSalesOrders };
    delete nextDeductedSOs[piNumber];

    const nextTransactions = [...undoTxns, ...state.transactions];

    set({
      skus: nextSkus,
      divisions: nextDivisions,
      transactions: nextTransactions,
      stats: nextStats,
      deductedSalesOrders: nextDeductedSOs
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        skus: nextSkus,
        categories: state.categories,
        divisions: nextDivisions,
        transactions: nextTransactions,
        deductedSalesOrders: nextDeductedSOs
      }));
    } catch (err) {
      console.warn('Storage save error', err);
    }

    return {
      success: true,
      message: `Reversed stock deduction for PI #${piNumber}. Stock restored.`
    };
  }
}));

