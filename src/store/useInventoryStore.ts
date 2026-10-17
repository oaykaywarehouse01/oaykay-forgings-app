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
  SalesOrderData,
  WarehouseLocation,
  LocationStockEntry,
  CountSession,
  AppUser,
  InwardScope
} from '../types/inventory';
import { InventorySearchEngine } from '../lib/searchEngine';
import { generateInitialWarehouseLocations, normalizeLocationCode, isMockLocationCode, getLocationDescription } from '../lib/locationUtils';
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

export const defaultUsers: AppUser[] = [
  {
    id: 'user-admin',
    name: 'Admin',
    role: 'admin',
    pin: '1234',
    avatarColor: 'bg-orange-600',
    permissions: {
      canEditStockMaster: true,
      canDispatchSO: true,
      canInwardStock: true,
      canCountLocations: true,
      canGoLiveLocations: true,
      canManageUsers: true,
      canResetData: true,
    }
  },
  {
    id: 'user-dispatch',
    name: 'Dispatch',
    role: 'dispatch_manager',
    pin: '2222',
    avatarColor: 'bg-emerald-600',
    permissions: {
      canEditStockMaster: false,
      canDispatchSO: true,
      canInwardStock: false,
      canCountLocations: false,
      canGoLiveLocations: false,
      canManageUsers: false,
      canResetData: false,
    }
  },
  {
    id: 'user-storekeeper',
    name: 'Inward',
    role: 'inward_storekeeper',
    pin: '3333',
    avatarColor: 'bg-indigo-600',
    permissions: {
      canEditStockMaster: false,
      canDispatchSO: false,
      canInwardStock: true,
      canCountLocations: true,
      canGoLiveLocations: false,
      canManageUsers: false,
      canResetData: false,
    }
  },
  {
    id: 'user-count',
    name: 'Location Counter',
    role: 'count_staff',
    pin: '4444',
    avatarColor: 'bg-amber-600',
    permissions: {
      canEditStockMaster: false,
      canDispatchSO: false,
      canInwardStock: false,
      canCountLocations: true,
      canGoLiveLocations: false,
      canManageUsers: false,
      canResetData: false,
    }
  }
];

interface InventoryStore {
  // Master Inventory Data
  skus: SkuItem[];
  categories: CategoryGroup[];
  divisions: Record<DivisionCode, DivisionInfo>;
  transactions: Transaction[];
  stats: InventoryStats;
  deductedSalesOrders: Record<string, DeductedSOInfo>;

  // Warehouse Location & Physical Count Data (100% Independent until Live Sync)
  warehouseLocations: WarehouseLocation[];
  locationStockEntries: LocationStockEntry[];
  countSession: CountSession;

  // Role-Based Users & Permissions
  users: AppUser[];
  currentUser: AppUser | null;

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
  isAddNewSkuModalOpen: boolean;
  isUserManagementModalOpen: boolean;
  isCloudSyncModalOpen: boolean;
  stockTransactionModalSku: SkuItem | null;
  updateWriteOffModalCategory: CategoryGroup | null;
  isDarkMode: boolean;

  // Navigation Actions
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
  setAddNewSkuModalOpen: (open: boolean) => void;
  setUserManagementModalOpen: (open: boolean) => void;
  setCloudSyncModalOpen: (open: boolean) => void;
  setStockTransactionModalSku: (sku: SkuItem | null) => void;
  setUpdateWriteOffModalCategory: (cat: CategoryGroup | null) => void;
  toggleDarkMode: () => void;

  // User Actions
  setCurrentUserByPin: (pin: string) => { success: boolean; message: string; user?: AppUser };
  addUser: (user: Omit<AppUser, 'id'>) => void;
  updateUser: (id: string, updates: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;

  // Master Inventory Operations
  quickAdjustStock: (skuId: string, delta: number) => void;
  recordTransaction: (
    skuId: string, 
    type: TransactionType, 
    quantity: number, 
    reason?: string, 
    performedBy?: string,
    notes?: string,
    location?: string,
    referenceNo?: string,
    scope?: InwardScope
  ) => void;
  addNewSku: (item: {
    clean_name: string;
    division: DivisionCode;
    main_category: string;
    sub_category: string;
    product_group?: string;
    unit?: string;
    size_spec?: string;
    material_and_tier?: string;
    pack_type?: string;
    initial_stock?: number;
    location_bin?: string;
  }) => SkuItem;
  updateCategoryWriteOffDate: (groupId: string, newDate: string, auditNote?: string) => void;
  updateSkuWriteOffDate: (skuId: string, newDate: string) => void;
  batchUpdateWriteOffDate: (division: DivisionCode, mainCat: string, newDate: string) => void;
  resetToInitialSeed: () => void;
  exportCatalogToExcel: () => void;
  importStockExcel: (file: File) => Promise<{ success: boolean; message: string; stats?: any }>;
  deductSalesOrderStock: (so: SalesOrderData) => { success: boolean; message: string };
  undoDeductSalesOrderStock: (piNumber: string) => { success: boolean; message: string };

  // Warehouse Location Operations
  addWarehouseLocation: (loc: WarehouseLocation | WarehouseLocation[]) => void;
  updateWarehouseLocation: (oldCode: string, updated: Partial<WarehouseLocation>) => void;
  deleteWarehouseLocation: (code: string) => void;
  saveLocationStockEntry: (entry: Omit<LocationStockEntry, 'id' | 'countedAt'>) => void;
  batchSaveLocationStockEntries: (entries: Array<Omit<LocationStockEntry, 'id' | 'countedAt'>>) => void;
  deleteLocationStockEntry: (id: string) => void;
  clearLocationStockEntries: () => void;
  deleteTransaction: (id: string) => void;
  clearTransactions: () => void;
  clearAllDeductedSalesOrders: () => void;
  setCountSession: (session: Partial<CountSession>) => void;
  applyOutwardReconciliation: (
    piNumber: string, 
    items: Array<{ skuCode: string; cleanName: string; outwardQty: number; deductFromLocation: string }>
  ) => { success: boolean; message: string };
  syncLocationStockToMaster: () => { 
    success: boolean; 
    message: string; 
    updatedCount: number; 
    totalLiveUnits: number 
  };
  restoreFullDatabase: (backupData: any) => { success: boolean; message: string };

  // User Management
  setCurrentUser: (user: AppUser | null) => void;
  logout: () => void;

  // Complete Data Deletion & Purge Options
  clearAllLocationCounts: () => void;
  clearAllDispatchedOrders: () => void;
  resetDatabaseClean: () => void;
}

export const computeStats = (skus: SkuItem[]): InventoryStats => {
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

const STORAGE_KEY = 'okf_inventory_store_v3_master';

const saveStorage = (data: any) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Storage save warning', e);
  }
};

const getInitialState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.skus && parsed.skus.length >= 1421) {
        // Strip any legacy dummy/fake transactions
        const rawTxns = (parsed.transactions || []) as Transaction[];
        const sanitizedTxns = rawTxns.filter((t: any) => 
          !t.performed_by?.includes('Sharma') && 
          !t.performed_by?.includes('Gupta') && 
          !t.performed_by?.includes('Kohli') &&
          !t.reason?.includes('Plant 1 Forging') &&
          !t.reason?.includes('Container Import Clearance')
        );

        // Sanitize users: remove any legacy mock Indian names
        const sanitizedUsers = (parsed.users && parsed.users.length > 0)
          ? (parsed.users as AppUser[]).map(u => {
              if (u.name === 'Dispatch Manager') return { ...u, name: 'Dispatch' };
              if (u.name === 'Inward Storekeeper') return { ...u, name: 'Inward' };
              if (u.name === 'Godown Count Staff') return { ...u, name: 'Location Counter' };
              if (
                u.name.includes('Singh') || 
                u.name.includes('Rajesh') || 
                u.name.includes('Sharma') || 
                u.name.includes('Verma') || 
                u.name === 'Administrator'
              ) {
                const matchingDefault = defaultUsers.find(d => d.role === u.role);
                return matchingDefault ? { ...matchingDefault, pin: u.pin || matchingDefault.pin } : { ...u, name: u.role === 'admin' ? 'Admin' : u.role.replace('_', ' ') };
              }
              return u;
            })
          : defaultUsers;

        const savedSessionUserId = (() => {
          try {
            return sessionStorage.getItem('okf_logged_in_user_id');
          } catch (e) {
            return null;
          }
        })();

        const activeCurUser = savedSessionUserId
          ? (sanitizedUsers.find(u => u.id === savedSessionUserId) || null)
          : null;

        // Sanitize legacy mock location codes like M-12-6, N-05-3, T-20-2
        let hadMockLocations = false;
        const sanitizedSkus = (parsed.skus as SkuItem[]).map(s => {
          if (s.location_bin && isMockLocationCode(s.location_bin)) {
            hadMockLocations = true;
            return { ...s, location_bin: '' };
          }
          return s;
        });

        const stateObj = {
          skus: sanitizedSkus,
          categories: parsed.categories as CategoryGroup[],
          divisions: parsed.divisions as Record<DivisionCode, DivisionInfo>,
          transactions: sanitizedTxns,
          deductedSalesOrders: (parsed.deductedSalesOrders || {}) as Record<string, DeductedSOInfo>,
          warehouseLocations: ((parsed.warehouseLocations && parsed.warehouseLocations.length > 0)
            ? parsed.warehouseLocations as WarehouseLocation[]
            : generateInitialWarehouseLocations()
          ).map(l => ({
            ...l,
            description: (l.description && !l.description.startsWith('Location ') && l.description !== l.code)
              ? l.description
              : getLocationDescription(l.code, l.description)
          })),
          locationStockEntries: (parsed.locationStockEntries || []) as LocationStockEntry[],
          countSession: (parsed.countSession || {
            startDate: new Date().toISOString().slice(0, 10),
            endDate: new Date().toISOString().slice(0, 10),
            isActive: false,
            reconciledOrders: []
          }) as CountSession,
          users: sanitizedUsers,
          currentUser: activeCurUser
        };

        if (hadMockLocations) {
          saveStorage(stateObj);
        }

        return stateObj;
      }
    }
  } catch (e) {
    console.warn('Could not restore from localStorage, using initial seed data', e);
  }

  const cleanSeedSkus = (initialSeedData.skus as unknown as SkuItem[]).map(s => {
    if (s.location_bin && isMockLocationCode(s.location_bin)) {
      return { ...s, location_bin: '' };
    }
    return s;
  });

  return {
    skus: cleanSeedSkus,
    categories: initialSeedData.categories_hierarchy as CategoryGroup[],
    divisions: initialSeedData.divisions as Record<DivisionCode, DivisionInfo>,
    transactions: [] as Transaction[],
    deductedSalesOrders: {} as Record<string, DeductedSOInfo>,
    warehouseLocations: generateInitialWarehouseLocations(),
    locationStockEntries: [] as LocationStockEntry[],
    countSession: {
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      isActive: false,
      reconciledOrders: []
    } as CountSession,
    users: defaultUsers,
    currentUser: null
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
  warehouseLocations: initial.warehouseLocations,
  locationStockEntries: initial.locationStockEntries,
  countSession: initial.countSession,
  users: initial.users,
  currentUser: initial.currentUser,
  searchEngine: initialEngine,

  activeModule: 'stock-master',
  drillDown: {
    level: 1,
    segment: 'Domestic',
    division: null,
    mainCategory: null,
    subCategory: null,
    productGroup: null
  },
  selectedSku: null,
  globalSearchQuery: '',
  activeDivisionFilter: 'ALL',

  isCommandPaletteOpen: false,
  isKeyboardShortcutsOpen: false,
  isSidebarOpen: true,
  isAddNewSkuModalOpen: false,
  isUserManagementModalOpen: false,
  isCloudSyncModalOpen: false,
  stockTransactionModalSku: null,
  updateWriteOffModalCategory: null,
  isDarkMode: false,

  setActiveModule: (module) => set({ activeModule: module }),
  setDrillDown: (partial) => set(state => ({ drillDown: { ...state.drillDown, ...partial } })),
  
  navigateToLevel: (level) => set(state => {
    const nextDrill = { ...state.drillDown, level };
    if (level === 1) {
      nextDrill.division = null;
      nextDrill.mainCategory = null;
      nextDrill.subCategory = null;
      nextDrill.productGroup = null;
    } else if (level === 2) {
      nextDrill.mainCategory = null;
      nextDrill.subCategory = null;
      nextDrill.productGroup = null;
    } else if (level === 3) {
      nextDrill.subCategory = null;
      nextDrill.productGroup = null;
    }
    return { drillDown: nextDrill };
  }),

  setSelectedSku: (sku) => set({ selectedSku: sku }),
  setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
  setActiveDivisionFilter: (div) => set({ activeDivisionFilter: div }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setKeyboardShortcutsOpen: (open) => set({ isKeyboardShortcutsOpen: open }),
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setAddNewSkuModalOpen: (open) => set({ isAddNewSkuModalOpen: open }),
  setUserManagementModalOpen: (open) => set({ isUserManagementModalOpen: open }),
  setCloudSyncModalOpen: (open) => set({ isCloudSyncModalOpen: open }),
  setStockTransactionModalSku: (sku) => set({ stockTransactionModalSku: sku }),
  setUpdateWriteOffModalCategory: (cat) => set({ updateWriteOffModalCategory: cat }),
  toggleDarkMode: () => set(state => ({ isDarkMode: !state.isDarkMode })),

  // User System Operations
  setCurrentUserByPin: (pin: string) => {
    const state = get();
    const user = state.users.find(u => u.pin === pin.trim());
    if (user) {
      try {
        sessionStorage.setItem('okf_logged_in_user_id', user.id);
      } catch (e) {}
      set({ currentUser: user });
      saveStorage({
        ...state,
        currentUser: user
      });
      return { success: true, message: `Welcome, ${user.name}! (${user.role.toUpperCase()})`, user };
    }
    return { success: false, message: 'Invalid PIN. Please check and try again.' };
  },

  logout: () => {
    const state = get();
    try {
      sessionStorage.removeItem('okf_logged_in_user_id');
      localStorage.removeItem('okf_logged_in_user_id');
    } catch (e) {}
    set({ currentUser: null });
    saveStorage({ ...state, currentUser: null });
  },

  addUser: (userData) => {
    const state = get();
    const newUser: AppUser = {
      ...userData,
      id: `user-${Date.now()}`
    };
    const nextUsers = [...state.users, newUser];
    set({ users: nextUsers });
    saveStorage({ ...state, users: nextUsers });
  },

  updateUser: (id, updates) => {
    const state = get();
    const nextUsers = state.users.map(u => u.id === id ? { ...u, ...updates } : u);
    const nextCurrentUser = state.currentUser?.id === id ? { ...state.currentUser, ...updates } : state.currentUser;
    set({ users: nextUsers, currentUser: nextCurrentUser });
    saveStorage({ ...state, users: nextUsers, currentUser: nextCurrentUser });
  },

  deleteUser: (id) => {
    const state = get();
    if (state.users.length <= 1) return;
    const nextUsers = state.users.filter(u => u.id !== id);
    const nextCurrentUser = state.currentUser?.id === id ? nextUsers[0] : state.currentUser;
    set({ users: nextUsers, currentUser: nextCurrentUser });
    saveStorage({ ...state, users: nextUsers, currentUser: nextCurrentUser });
  },

  // Inventory Adjustments & Transactions
  quickAdjustStock: (skuId, delta) => {
    const state = get();
    const sku = state.skus.find(s => s.id === skuId);
    if (!sku) return;

    const prevStock = Math.round(sku.current_stock);
    const intDelta = Math.round(delta);
    const newStock = prevStock + intDelta;

    const updatedSku: SkuItem = {
      ...sku,
      current_stock: newStock,
      quantity: newStock,
      status: newStock === 0 ? 'Zero Stock' : (newStock < 0 ? 'Negative' : 'In Stock'),
      last_modified: new Date().toISOString()
    };

    const txnType: TransactionType = intDelta > 0 ? 'STOCK_IN' : 'STOCK_OUT';
    const qtyChange = Math.abs(intDelta);

    const newTxn: Transaction = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      sku_code: sku.sku_code,
      sku_name: sku.clean_name,
      type: txnType,
      quantity: qtyChange,
      reason: intDelta > 0 ? 'Quick Inline Stock Increment (+)' : 'Quick Inline Stock Decrement (-)',
      performed_by: state.currentUser?.name || 'Warehouse Staff',
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
    });

    saveStorage({
      skus: nextSkus,
      categories: state.categories,
      divisions: nextDivisions,
      transactions: nextTransactions,
      deductedSalesOrders: state.deductedSalesOrders,
      warehouseLocations: state.warehouseLocations,
      locationStockEntries: state.locationStockEntries,
      countSession: state.countSession,
      users: state.users,
      currentUser: state.currentUser
    });
  },

  recordTransaction: (skuId, type, quantity, reason, performedBy, notes, location, referenceNo, scope) => {
    const state = get();
    const sku = state.skus.find(s => s.id === skuId);
    if (!sku) return;

    const prevStock = Math.round(sku.current_stock);
    const intQty = Math.round(quantity);
    
    // Default scope resolution:
    // If scope is explicitly provided, use it. Otherwise, if location is provided default to 'BOTH', else 'TOTAL_STOCK_ONLY'
    const resolvedScope: InwardScope = scope || (location ? 'BOTH' : 'TOTAL_STOCK_ONLY');

    let newStock = prevStock;
    if (resolvedScope === 'TOTAL_STOCK_ONLY' || resolvedScope === 'BOTH') {
      if (type === 'STOCK_IN') {
        newStock = prevStock + intQty;
      } else if (type === 'STOCK_OUT') {
        newStock = prevStock - intQty;
      } else if (type === 'AUDIT_ADJUSTMENT' || type === 'LOCATION_RECONCILIATION') {
        newStock = intQty;
      }
    } else {
      // LOCATION_ONLY: Master / Tally total stock does NOT change!
      newStock = prevStock;
    }

    let nextLocationEntries = [...state.locationStockEntries];
    let nextLocations = [...state.warehouseLocations];
    const normLoc = location ? normalizeLocationCode(location) : '';

    // If location is provided and scope touches location
    if (normLoc && (resolvedScope === 'LOCATION_ONLY' || resolvedScope === 'BOTH')) {
      const existingEntryIdx = nextLocationEntries.findIndex(
        e => e.skuId === sku.id && e.locationCode === normLoc
      );

      if (type === 'STOCK_IN' || resolvedScope === 'LOCATION_ONLY') {
        if (existingEntryIdx !== -1) {
          nextLocationEntries[existingEntryIdx] = {
            ...nextLocationEntries[existingEntryIdx],
            countedQty: Math.max(0, nextLocationEntries[existingEntryIdx].countedQty + intQty),
            countedAt: new Date().toISOString(),
            countedBy: performedBy || state.currentUser?.name || 'Staff',
            notes: notes || nextLocationEntries[existingEntryIdx].notes
          };
        } else {
          nextLocationEntries.push({
            id: `LOC-ENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            skuId: sku.id,
            skuCode: sku.sku_code,
            cleanName: sku.clean_name,
            division: sku.division,
            mainCategory: sku.main_category,
            locationCode: normLoc,
            countedQty: intQty,
            countedAt: new Date().toISOString(),
            countedBy: performedBy || state.currentUser?.name || 'Staff',
            notes: notes || (resolvedScope === 'LOCATION_ONLY' ? 'Location Mapping Entry' : 'Stock IN Putaway')
          });
        }
      } else if (type === 'STOCK_OUT') {
        if (existingEntryIdx !== -1) {
          nextLocationEntries[existingEntryIdx] = {
            ...nextLocationEntries[existingEntryIdx],
            countedQty: Math.max(0, nextLocationEntries[existingEntryIdx].countedQty - intQty),
            countedAt: new Date().toISOString(),
            countedBy: performedBy || state.currentUser?.name || 'Staff',
            notes: notes || nextLocationEntries[existingEntryIdx].notes
          };
        }
      }

      // Auto-register location in warehouseLocations if not already registered
      if (!nextLocations.some(l => l.code === normLoc)) {
        nextLocations.push({
          code: normLoc,
          type: normLoc.startsWith('BIN') ? 'BIN' : (normLoc.match(/^[A-G]/) ? 'RACK' : 'PALLET'),
          zone: normLoc.startsWith('BIN') ? 'Storage Bins' : (normLoc.match(/^[A-G]/) ? `Rack ${normLoc.charAt(0)}` : `Line ${normLoc.charAt(0)}`),
          description: getLocationDescription(normLoc)
        });
      }
    }

    // Determine final location_bin string for SKU
    let finalLocationBin = sku.location_bin;
    if (resolvedScope === 'LOCATION_ONLY' || resolvedScope === 'BOTH') {
      const activeEntries = nextLocationEntries.filter(e => e.skuId === sku.id && e.countedQty > 0);
      if (activeEntries.length > 0) {
        finalLocationBin = activeEntries.map(e => `${e.locationCode} (${e.countedQty})`).join(', ');
      } else if (normLoc) {
        finalLocationBin = normLoc;
      }
    }

    const updatedSku: SkuItem = {
      ...sku,
      current_stock: newStock,
      quantity: newStock,
      location_bin: finalLocationBin,
      status: newStock === 0 ? 'Zero Stock' : (newStock < 0 ? 'Negative' : 'In Stock'),
      last_modified: new Date().toISOString(),
      last_audit_date: (type === 'AUDIT_ADJUSTMENT' || resolvedScope === 'LOCATION_ONLY') 
        ? new Date().toLocaleDateString('en-GB') 
        : sku.last_audit_date
    };

    let displayReason = reason;
    if (!displayReason) {
      if (resolvedScope === 'LOCATION_ONLY') {
        displayReason = `Location Floor Count: ${type === 'STOCK_IN' ? '+' : '-'}${intQty} ${sku.unit} on ${normLoc || 'Location'} (Tally total unchanged at ${prevStock})`;
      } else if (resolvedScope === 'TOTAL_STOCK_ONLY') {
        displayReason = `Total Stock Inward: ${type === 'STOCK_IN' ? '+' : '-'}${intQty} ${sku.unit} (Tally Balance ${prevStock} → ${newStock}, Location uncounted)`;
      } else {
        displayReason = `${type} (Simultaneous: Total Stock + Location ${normLoc || ''})`;
      }
    }

    const newTxn: Transaction = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      sku_code: sku.sku_code,
      sku_name: sku.clean_name,
      type: resolvedScope === 'LOCATION_ONLY' ? 'LOCATION_RECONCILIATION' : type,
      quantity: intQty,
      reason: displayReason,
      performed_by: performedBy || state.currentUser?.name || 'Operator',
      timestamp: new Date().toISOString(),
      prev_stock: prevStock,
      new_stock: newStock,
      notes: notes || undefined,
      location: resolvedScope === 'TOTAL_STOCK_ONLY' 
        ? (normLoc ? `${normLoc} (Unverified/Ref)` : 'Tally Stock (Unassigned)') 
        : (normLoc || sku.location_bin),
      referenceNo: referenceNo || undefined,
      division: sku.division,
      main_category: sku.main_category,
      scope: resolvedScope
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

    const nextCategories = state.categories.map(c => {
      if (c.division === sku.division && c.main_category === sku.main_category && c.sub_category === sku.sub_category) {
        const catStock = nextSkus
          .filter(s => s.division === c.division && s.main_category === c.main_category && s.sub_category === c.sub_category)
          .reduce((a, s) => a + Math.round(s.current_stock), 0);
        return { ...c, total_stock: catStock };
      }
      return c;
    });

    state.searchEngine.updateData(nextSkus);

    set({
      skus: nextSkus,
      categories: nextCategories,
      divisions: nextDivisions,
      transactions: nextTransactions,
      locationStockEntries: nextLocationEntries,
      warehouseLocations: nextLocations,
      stats: nextStats,
      selectedSku: state.selectedSku?.id === skuId ? updatedSku : state.selectedSku,
      stockTransactionModalSku: null
    });

    saveStorage({
      skus: nextSkus,
      categories: nextCategories,
      divisions: nextDivisions,
      transactions: nextTransactions,
      deductedSalesOrders: state.deductedSalesOrders,
      warehouseLocations: nextLocations,
      locationStockEntries: nextLocationEntries,
      countSession: state.countSession,
      users: state.users,
      currentUser: state.currentUser
    });
  },

  // PART 6: Global Add New Item / SKU
  addNewSku: (item) => {
    const state = get();
    const div = item.division;

    // Find highest current SKU number for this division
    const divSkus = state.skus.filter(s => s.division === div);
    let maxNum = 0;
    divSkus.forEach(s => {
      const m = s.sku_code.match(/OKF-[A-Z]+-(\d+)/);
      if (m) {
        const val = parseInt(m[1], 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    });
    const nextCodeNum = maxNum + 1;
    const skuCode = `OKF-${div}-${String(nextCodeNum).padStart(4, '0')}`;
    const initialQty = Math.round(item.initial_stock || 0);
    const locBin = item.location_bin ? normalizeLocationCode(item.location_bin) : '';

    const cleanName = item.clean_name.trim();

    const newSku: SkuItem = {
      id: `sku-new-${Date.now()}`,
      sku_code: skuCode,
      excel_row: state.skus.length + 1,
      segment: 'Domestic',
      division: div,
      main_category: item.main_category.trim(),
      sub_category: item.sub_category.trim(),
      product_group: (item.product_group || item.sub_category).trim(),
      category_path: `Domestic > ${div} > ${item.main_category.trim()} > ${item.sub_category.trim()}`,
      clean_name: cleanName,
      size_spec: item.size_spec || 'Standard',
      material_and_tier: item.material_and_tier || 'Industrial Standard',
      pack_type: item.pack_type || 'Standard Box',
      original_tally_name: cleanName,
      normalized_key: cleanName.toLowerCase().replace(/[\s_]/g, ''),
      quantity: initialQty,
      current_stock: initialQty,
      unit: item.unit || 'Pcs',
      status: initialQty === 0 ? 'Zero Stock' : (initialQty < 0 ? 'Negative' : 'In Stock'),
      location_bin: locBin,
      last_write_off_date: new Date().toLocaleDateString('en-GB'),
      write_off_source_header: 'New SKU Onboarded',
      last_audit_date: new Date().toLocaleDateString('en-GB'),
      last_modified: new Date().toISOString()
    };

    const nextSkus = [newSku, ...state.skus];

    // Update categories group or add if new
    let nextCategories = [...state.categories];
    const catIdx = nextCategories.findIndex(
      c => c.division === div && c.main_category === newSku.main_category && c.sub_category === newSku.sub_category
    );
    if (catIdx !== -1) {
      nextCategories[catIdx] = {
        ...nextCategories[catIdx],
        sku_count: nextCategories[catIdx].sku_count + 1,
        total_stock: nextCategories[catIdx].total_stock + initialQty
      };
    } else {
      nextCategories.push({
        group_id: `GRP-${Date.now().toString().slice(-4)}`,
        division: div,
        main_category: newSku.main_category,
        sub_category: newSku.sub_category,
        product_group: newSku.product_group,
        last_write_off_date: new Date().toLocaleDateString('en-GB'),
        original_write_off_header: 'New Category Added',
        sku_count: 1,
        total_stock: initialQty
      });
    }

    // Update division totals
    const nextDivisions = { ...state.divisions };
    if (nextDivisions[div]) {
      const dStock = nextSkus.filter(s => s.division === div).reduce((a, s) => a + Math.round(s.current_stock), 0);
      nextDivisions[div] = {
        ...nextDivisions[div],
        total_skus: nextDivisions[div].total_skus + 1,
        total_stock: dStock
      };
    }

    // Record initial transaction if opening stock > 0
    let nextTxns = [...state.transactions];
    if (initialQty > 0) {
      nextTxns = [
        {
          id: `TXN-NEW-${Date.now().toString().slice(-6)}`,
          sku_code: skuCode,
          sku_name: cleanName,
          type: 'STOCK_IN',
          quantity: initialQty,
          reason: `New SKU Onboarded with Opening Stock (${locBin})`,
          performed_by: state.currentUser?.name || 'Administrator',
          timestamp: new Date().toISOString(),
          prev_stock: 0,
          new_stock: initialQty,
          location: locBin,
          division: div,
          main_category: newSku.main_category
        },
        ...nextTxns
      ];
    }

    const nextStats = computeStats(nextSkus);
    state.searchEngine.updateData(nextSkus);

    set({
      skus: nextSkus,
      categories: nextCategories,
      divisions: nextDivisions,
      transactions: nextTxns,
      stats: nextStats,
      selectedSku: newSku,
      isAddNewSkuModalOpen: false
    });

    saveStorage({
      skus: nextSkus,
      categories: nextCategories,
      divisions: nextDivisions,
      transactions: nextTxns,
      deductedSalesOrders: state.deductedSalesOrders,
      warehouseLocations: state.warehouseLocations,
      locationStockEntries: state.locationStockEntries,
      countSession: state.countSession,
      users: state.users,
      currentUser: state.currentUser
    });

    return newSku;
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
      performed_by: state.currentUser?.name || 'Inventory Auditor',
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

    saveStorage({
      skus: nextSkus,
      categories: nextCategories,
      divisions: state.divisions,
      transactions: nextTransactions,
      deductedSalesOrders: state.deductedSalesOrders,
      warehouseLocations: state.warehouseLocations,
      locationStockEntries: state.locationStockEntries,
      countSession: state.countSession,
      users: state.users,
      currentUser: state.currentUser
    });
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

    saveStorage({
      skus: nextSkus,
      categories: state.categories,
      divisions: state.divisions,
      transactions: state.transactions,
      deductedSalesOrders: state.deductedSalesOrders,
      warehouseLocations: state.warehouseLocations,
      locationStockEntries: state.locationStockEntries,
      countSession: state.countSession,
      users: state.users,
      currentUser: state.currentUser
    });
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

    saveStorage({
      skus: nextSkus,
      categories: nextCategories,
      divisions: state.divisions,
      transactions: state.transactions,
      deductedSalesOrders: state.deductedSalesOrders,
      warehouseLocations: state.warehouseLocations,
      locationStockEntries: state.locationStockEntries,
      countSession: state.countSession,
      users: state.users,
      currentUser: state.currentUser
    });
  },

  resetToInitialSeed: () => {
    localStorage.removeItem(STORAGE_KEY);
    const skus = initialSeedData.skus as unknown as SkuItem[];
    const categories = initialSeedData.categories_hierarchy as CategoryGroup[];
    const divisions = initialSeedData.divisions as Record<DivisionCode, DivisionInfo>;
    const transactions: Transaction[] = [];
    const locations = generateInitialWarehouseLocations();
    
    const engine = new InventorySearchEngine(skus);

    set({
      skus,
      categories,
      divisions,
      transactions,
      stats: computeStats(skus),
      searchEngine: engine,
      selectedSku: null,
      globalSearchQuery: '',
      deductedSalesOrders: {},
      warehouseLocations: locations,
      locationStockEntries: [],
      countSession: {
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        isActive: false,
        reconciledOrders: []
      },
      users: defaultUsers,
      currentUser: defaultUsers[0]
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
      'Bin Location': s.location_bin && !isMockLocationCode(s.location_bin) ? s.location_bin : '',
      'Original Tally Name': s.original_tally_name
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'OKF Stock Quantity Master');
    XLSX.writeFile(workbook, `OKF_Stock_Master_${state.skus.length}_SKUs_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

          const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:C3000');
          let updatedCount = 0;
          let matchedTotalStock = 0;

          const nextSkus = [...state.skus];

          for (let r = range.s.r; r <= range.e.r; r++) {
            const cellA = ws[XLSX.utils.encode_cell({ r, c: 0 })];
            const cellB = ws[XLSX.utils.encode_cell({ r, c: 1 })];

            if (!cellA || !cellA.v) continue;
            const rawName = String(cellA.v).trim();
            const normKey = rawName.replace(/['"]/g, '"').replace(/[\s_]/g, '').toLowerCase();

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

          saveStorage({
            skus: nextSkus,
            categories: state.categories,
            divisions: nextDivisions,
            transactions: state.transactions,
            deductedSalesOrders: state.deductedSalesOrders,
            warehouseLocations: state.warehouseLocations,
            locationStockEntries: state.locationStockEntries,
            countSession: state.countSession,
            users: state.users,
            currentUser: state.currentUser
          });

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
        performed_by: state.currentUser?.name || 'Dispatch Staff',
        timestamp: new Date().toISOString(),
        prev_stock: prevStock,
        new_stock: newStock,
        referenceNo: `PI #${so.piNumber}`,
        division: sku.division,
        main_category: sku.main_category
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

    saveStorage({
      skus: nextSkus,
      categories: state.categories,
      divisions: nextDivisions,
      transactions: nextTransactions,
      deductedSalesOrders: nextDeductedSOs,
      warehouseLocations: state.warehouseLocations,
      locationStockEntries: state.locationStockEntries,
      countSession: state.countSession,
      users: state.users,
      currentUser: state.currentUser
    });

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
          performed_by: state.currentUser?.name || 'Warehouse Admin',
          timestamp: new Date().toISOString(),
          prev_stock: prevStock,
          new_stock: newStock,
          referenceNo: `PI #${piNumber} (Reversal)`,
          division: sku.division,
          main_category: sku.main_category
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

    saveStorage({
      skus: nextSkus,
      categories: state.categories,
      divisions: nextDivisions,
      transactions: nextTransactions,
      deductedSalesOrders: nextDeductedSOs,
      warehouseLocations: state.warehouseLocations,
      locationStockEntries: state.locationStockEntries,
      countSession: state.countSession,
      users: state.users,
      currentUser: state.currentUser
    });

    return {
      success: true,
      message: `Reversed stock deduction for PI #${piNumber}. Stock restored.`
    };
  },

  // ==========================================================================
  // WAREHOUSE LOCATION & PHYSICAL COUNT OPERATIONS (PART 3, 4, 5)
  // ==========================================================================

  addWarehouseLocation: (loc) => {
    const state = get();
    const locsToAdd = Array.isArray(loc) ? loc : [loc];
    const existingCodes = new Set(state.warehouseLocations.map(l => l.code));
    const toInsert: WarehouseLocation[] = [];

    locsToAdd.forEach(l => {
      const norm = normalizeLocationCode(l.code);
      if (norm && !existingCodes.has(norm)) {
        existingCodes.add(norm);
        toInsert.push({
          ...l,
          code: norm
        });
      }
    });

    if (toInsert.length === 0) return;

    const nextLocations = [...state.warehouseLocations, ...toInsert];
    set({ warehouseLocations: nextLocations });
    saveStorage({ ...state, warehouseLocations: nextLocations });
  },

  saveLocationStockEntry: (entryData) => {
    const state = get();
    const normLoc = normalizeLocationCode(entryData.locationCode);
    const existingIdx = state.locationStockEntries.findIndex(
      e => e.skuId === entryData.skuId && e.locationCode === normLoc
    );

    let nextEntries = [...state.locationStockEntries];
    if (existingIdx !== -1) {
      nextEntries[existingIdx] = {
        ...nextEntries[existingIdx],
        countedQty: Math.round(entryData.countedQty),
        notes: entryData.notes || nextEntries[existingIdx].notes,
        countedAt: new Date().toISOString(),
        countedBy: entryData.countedBy || state.currentUser?.name || 'Staff'
      };
    } else {
      nextEntries.push({
        id: `LOC-ENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        skuId: entryData.skuId,
        skuCode: entryData.skuCode,
        cleanName: entryData.cleanName,
        division: entryData.division,
        mainCategory: entryData.mainCategory,
        locationCode: normLoc,
        countedQty: Math.round(entryData.countedQty),
        countedAt: new Date().toISOString(),
        countedBy: entryData.countedBy || state.currentUser?.name || 'Staff',
        notes: entryData.notes
      });
    }

    // Auto-register location in warehouseLocations if not yet registered
    let nextLocations = [...state.warehouseLocations];
    if (!nextLocations.some(l => l.code === normLoc)) {
      nextLocations.push({
        code: normLoc,
        type: normLoc.startsWith('BIN') ? 'BIN' : (normLoc.match(/^[A-G]/) ? 'RACK' : 'PALLET'),
        zone: normLoc.startsWith('BIN') ? 'Storage Bins' : (normLoc.match(/^[A-G]/) ? `Rack ${normLoc.charAt(0)}` : `Line ${normLoc.charAt(0)}`),
        description: getLocationDescription(normLoc)
      });
    }

    set({ locationStockEntries: nextEntries, warehouseLocations: nextLocations });
    saveStorage({ ...state, locationStockEntries: nextEntries, warehouseLocations: nextLocations });
  },

  batchSaveLocationStockEntries: (entries) => {
    const state = get();
    const map = new Map<string, LocationStockEntry>();

    // Seed existing
    state.locationStockEntries.forEach(e => {
      map.set(`${e.skuId}__${e.locationCode}`, e);
    });

    const newLocations: WarehouseLocation[] = [];
    const existingLocCodes = new Set(state.warehouseLocations.map(l => l.code));

    entries.forEach(e => {
      const normLoc = normalizeLocationCode(e.locationCode);
      if (!normLoc) return;

      const key = `${e.skuId}__${normLoc}`;
      map.set(key, {
        id: map.get(key)?.id || `LOC-ENT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        skuId: e.skuId,
        skuCode: e.skuCode,
        cleanName: e.cleanName,
        division: e.division,
        mainCategory: e.mainCategory,
        locationCode: normLoc,
        countedQty: Math.round(e.countedQty),
        countedAt: new Date().toISOString(),
        countedBy: e.countedBy || state.currentUser?.name || 'Excel Importer',
        notes: e.notes
      });

      if (!existingLocCodes.has(normLoc)) {
        existingLocCodes.add(normLoc);
        newLocations.push({
          code: normLoc,
          type: normLoc.startsWith('BIN') ? 'BIN' : (normLoc.match(/^[A-G]/) ? 'RACK' : 'PALLET'),
          zone: normLoc.startsWith('BIN') ? 'Storage Bins' : (normLoc.match(/^[A-G]/) ? `Rack ${normLoc.charAt(0)}` : `Line ${normLoc.charAt(0)}`),
          description: getLocationDescription(normLoc)
        });
      }
    });

    const nextEntries = Array.from(map.values());
    const nextLocations = [...state.warehouseLocations, ...newLocations];

    set({
      locationStockEntries: nextEntries,
      warehouseLocations: nextLocations
    });

    saveStorage({
      ...state,
      locationStockEntries: nextEntries,
      warehouseLocations: nextLocations
    });
  },

  updateWarehouseLocation: (oldCode, updated) => {
    const state = get();
    const newCode = updated.code ? normalizeLocationCode(updated.code) : oldCode;
    const nextLocations = state.warehouseLocations.map(loc => {
      if (loc.code === oldCode) {
        return { ...loc, ...updated, code: newCode };
      }
      return loc;
    });

    // Also update any locationStockEntries that referenced oldCode
    const nextEntries = state.locationStockEntries.map(e => {
      if (e.locationCode === oldCode) {
        return { ...e, locationCode: newCode };
      }
      return e;
    });

    set({ warehouseLocations: nextLocations, locationStockEntries: nextEntries });
    saveStorage({ ...state, warehouseLocations: nextLocations, locationStockEntries: nextEntries });
  },

  deleteWarehouseLocation: (code) => {
    const state = get();
    const nextLocations = state.warehouseLocations.filter(loc => loc.code !== code);
    set({ warehouseLocations: nextLocations });
    saveStorage({ ...state, warehouseLocations: nextLocations });
  },

  deleteLocationStockEntry: (id) => {
    const state = get();
    const nextEntries = state.locationStockEntries.filter(e => e.id !== id);
    set({ locationStockEntries: nextEntries });
    saveStorage({ ...state, locationStockEntries: nextEntries });
  },

  clearLocationStockEntries: () => {
    const state = get();
    set({ locationStockEntries: [] });
    saveStorage({ ...state, locationStockEntries: [] });
  },

  deleteTransaction: (id) => {
    const state = get();
    const nextTxns = state.transactions.filter(t => t.id !== id);
    set({ transactions: nextTxns });
    saveStorage({ ...state, transactions: nextTxns });
  },

  clearTransactions: () => {
    const state = get();
    set({ transactions: [] });
    saveStorage({ ...state, transactions: [] });
  },

  clearAllDeductedSalesOrders: () => {
    const state = get();
    set({ deductedSalesOrders: {} });
    saveStorage({ ...state, deductedSalesOrders: {} });
  },

  setCountSession: (sessionPartial) => {
    const state = get();
    const nextSession = { ...state.countSession, ...sessionPartial };
    set({ countSession: nextSession });
    saveStorage({ ...state, countSession: nextSession });
  },

  applyOutwardReconciliation: (piNumber, items) => {
    const state = get();
    if (state.countSession.reconciledOrders.includes(piNumber)) {
      return { success: false, message: `Sales Order PI #${piNumber} has already been deducted from location counts.` };
    }

    let nextEntries = [...state.locationStockEntries];
    let deductedItemsCount = 0;

    items.forEach(it => {
      const normLoc = normalizeLocationCode(it.deductFromLocation);
      const targetIdx = nextEntries.findIndex(
        e => (e.skuCode === it.skuCode || e.cleanName.toLowerCase() === it.cleanName.toLowerCase()) && 
             (!normLoc || e.locationCode === normLoc)
      );

      if (targetIdx !== -1) {
        const cur = nextEntries[targetIdx];
        const newQty = Math.max(0, cur.countedQty - Math.round(it.outwardQty));
        nextEntries[targetIdx] = {
          ...cur,
          countedQty: newQty,
          notes: `${cur.notes ? cur.notes + '; ' : ''}Reconciled -${it.outwardQty} from PI #${piNumber}`
        };
        deductedItemsCount++;
      }
    });

    const nextSession = {
      ...state.countSession,
      reconciledOrders: [...state.countSession.reconciledOrders, piNumber]
    };

    set({
      locationStockEntries: nextEntries,
      countSession: nextSession
    });

    saveStorage({
      ...state,
      locationStockEntries: nextEntries,
      countSession: nextSession
    });

    return {
      success: true,
      message: `Reconciled PI #${piNumber}: Deducted outward quantities for ${deductedItemsCount} items from location stock.`
    };
  },

  // PART 5: Make Location Stock LIVE (Sync to Main Stock Master)
  syncLocationStockToMaster: () => {
    const state = get();
    if (state.currentUser?.role !== 'admin') {
      return {
        success: false,
        message: 'Permission Denied: Only Admin (Owner/Superuser) can make Location Stock live.',
        updatedCount: 0,
        totalLiveUnits: 0
      };
    }

    // Aggregate by SKU ID
    const skuLocationTotals = new Map<string, { totalQty: number; locs: string[] }>();
    state.locationStockEntries.forEach(entry => {
      if (!skuLocationTotals.has(entry.skuId)) {
        skuLocationTotals.set(entry.skuId, { totalQty: 0, locs: [] });
      }
      const record = skuLocationTotals.get(entry.skuId)!;
      record.totalQty += entry.countedQty;
      if (entry.countedQty > 0) {
        record.locs.push(`${entry.locationCode} (${entry.countedQty})`);
      }
    });

    let updatedCount = 0;
    let totalLiveUnits = 0;
    const auditTxns: Transaction[] = [];

    const nextSkus = state.skus.map(sku => {
      const locData = skuLocationTotals.get(sku.id);
      if (locData !== undefined) {
        const prevStock = Math.round(sku.current_stock);
        const liveQty = Math.round(locData.totalQty);
        updatedCount++;
        totalLiveUnits += liveQty;

        const binString = locData.locs.length > 0 ? locData.locs.join(', ') : sku.location_bin;

        auditTxns.push({
          id: `TXN-LOC-SYNC-${Date.now().toString().slice(-4)}-${updatedCount}`,
          sku_code: sku.sku_code,
          sku_name: sku.clean_name,
          type: 'LOCATION_RECONCILIATION',
          quantity: liveQty,
          reason: `Physical Warehouse Location Count Go-Live Sync (${binString})`,
          performed_by: `${state.currentUser?.name || 'Admin'} (Admin Live Sync)`,
          timestamp: new Date().toISOString(),
          prev_stock: prevStock,
          new_stock: liveQty,
          location: binString,
          division: sku.division,
          main_category: sku.main_category
        });

        return {
          ...sku,
          current_stock: liveQty,
          quantity: liveQty,
          status: (liveQty === 0 ? 'Zero Stock' : (liveQty < 0 ? 'Negative' : 'In Stock')) as 'In Stock' | 'Zero Stock' | 'Negative',
          location_bin: binString,
          last_audit_date: new Date().toLocaleDateString('en-GB'),
          last_write_off_date: new Date().toLocaleDateString('en-GB'),
          write_off_source_header: 'Physical Location Audit Sync',
          last_modified: new Date().toISOString()
        };
      }
      return sku;
    });

    const nextStats = computeStats(nextSkus);

    // Update division stock totals
    const nextDivisions = { ...state.divisions };
    (['DIM', 'DIN', 'DTR'] as DivisionCode[]).forEach(d => {
      if (nextDivisions[d]) {
        const dStock = nextSkus.filter(s => s.division === d).reduce((a, s) => a + Math.round(s.current_stock), 0);
        nextDivisions[d] = {
          ...nextDivisions[d],
          total_stock: dStock
        };
      }
    });

    const nextTransactions = [...auditTxns, ...state.transactions];

    state.searchEngine.updateData(nextSkus);

    set({
      skus: nextSkus,
      divisions: nextDivisions,
      transactions: nextTransactions,
      stats: nextStats
    });

    saveStorage({
      skus: nextSkus,
      categories: state.categories,
      divisions: nextDivisions,
      transactions: nextTransactions,
      deductedSalesOrders: state.deductedSalesOrders,
      warehouseLocations: state.warehouseLocations,
      locationStockEntries: state.locationStockEntries,
      countSession: state.countSession,
      users: state.users,
      currentUser: state.currentUser
    });

    return {
      success: true,
      message: `Warehouse Location Stock is now LIVE! Updated ${updatedCount} SKUs. Main catalog physical balance synchronized to ${nextStats.total_stock.toLocaleString()} Units.`,
      updatedCount,
      totalLiveUnits
    };
  },

  restoreFullDatabase: (backupData: any) => {
    try {
      const data = backupData.data || backupData;
      if (!data.skus || !Array.isArray(data.skus)) {
        return { success: false, message: 'Invalid backup JSON file: Missing "skus" array.' };
      }

      const skus = data.skus as SkuItem[];
      const categories = (data.categories || initialSeedData.categories_hierarchy) as CategoryGroup[];
      const divisions = (data.divisions || initialSeedData.divisions) as Record<DivisionCode, DivisionInfo>;
      const transactions = (data.transactions || []) as Transaction[];
      const deductedSalesOrders = (data.deductedSalesOrders || {}) as Record<string, DeductedSOInfo>;
      const warehouseLocations = (data.warehouseLocations || generateInitialWarehouseLocations()) as WarehouseLocation[];
      const locationStockEntries = (data.locationStockEntries || []) as LocationStockEntry[];
      const countSession = (data.countSession || {
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        isActive: false,
        reconciledOrders: []
      }) as CountSession;
      const users = (data.users && data.users.length > 0) ? data.users as AppUser[] : defaultUsers;
      const currentUser = users[0];

      const engine = new InventorySearchEngine(skus);
      const stats = computeStats(skus);

      set({
        skus,
        categories,
        divisions,
        transactions,
        stats,
        deductedSalesOrders,
        warehouseLocations,
        locationStockEntries,
        countSession,
        users,
        currentUser,
        searchEngine: engine
      });

      saveStorage({
        skus,
        categories,
        divisions,
        transactions,
        deductedSalesOrders,
        warehouseLocations,
        locationStockEntries,
        countSession,
        users,
        currentUser
      });

      return {
        success: true,
        message: `Database successfully restored! Loaded ${skus.length.toLocaleString()} SKUs, ${warehouseLocations.length} locations, and ${transactions.length} transactions.`
      };
    } catch (err) {
      return {
        success: false,
        message: `Restore failed: ${(err as Error).message}`
      };
    }
  },

  // User Management Implementations
  setCurrentUser: (user: AppUser | null) => {
    const state = get();
    if (user) {
      try {
        sessionStorage.setItem('okf_logged_in_user_id', user.id);
      } catch (e) {}
    } else {
      try {
        sessionStorage.removeItem('okf_logged_in_user_id');
        localStorage.removeItem('okf_logged_in_user_id');
      } catch (e) {}
    }
    set({ currentUser: user });
    saveStorage({ ...state, currentUser: user });
  },

  // Complete Data Deletion & Purge Options
  clearAllLocationCounts: () => {
    const state = get();
    set({ locationStockEntries: [] });
    saveStorage({ ...state, locationStockEntries: [] });
  },

  clearAllDispatchedOrders: () => {
    const state = get();
    set({ deductedSalesOrders: {} });
    saveStorage({ ...state, deductedSalesOrders: {} });
  },

  resetDatabaseClean: () => {
    const skus = initialSeedData.skus as unknown as SkuItem[];
    const categories = initialSeedData.categories_hierarchy as CategoryGroup[];
    const divisions = initialSeedData.divisions as Record<DivisionCode, DivisionInfo>;
    const transactions: Transaction[] = [];
    const deductedSalesOrders: Record<string, DeductedSOInfo> = {};
    const warehouseLocations = generateInitialWarehouseLocations();
    const locationStockEntries: LocationStockEntry[] = [];
    const countSession: CountSession = {
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      isActive: false,
      reconciledOrders: []
    };
    const users = defaultUsers;
    const currentUser = defaultUsers[0];

    const engine = new InventorySearchEngine(skus);
    const stats = computeStats(skus);

    set({
      skus,
      categories,
      divisions,
      transactions,
      stats,
      deductedSalesOrders,
      warehouseLocations,
      locationStockEntries,
      countSession,
      users,
      currentUser,
      searchEngine: engine
    });

    saveStorage({
      skus,
      categories,
      divisions,
      transactions,
      deductedSalesOrders,
      warehouseLocations,
      locationStockEntries,
      countSession,
      users,
      currentUser
    });
  }
}));
