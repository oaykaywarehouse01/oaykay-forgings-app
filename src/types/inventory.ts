export type DivisionCode = 'DIM' | 'DIN' | 'DTR';

export interface DivisionInfo {
  code: DivisionCode;
  name: string;
  badge: string;
  badge_color: 'indigo' | 'emerald' | 'amber';
  accent_hex: string;
  tagline: string;
  description: string;
  total_skus: number;
  total_stock: number;
  main_categories_count: number;
  sub_groups_count: number;
  audited_skus: number;
}

export interface CategoryGroup {
  group_id: string;
  division: DivisionCode;
  main_category: string;
  sub_category: string;
  product_group: string;
  last_write_off_date: string | null;
  original_write_off_header: string | null;
  sku_count: number;
  total_stock: number;
}

export interface SkuItem {
  id: string;
  sku_code: string;
  excel_row: number;
  segment: string;
  division: DivisionCode;
  main_category: string;
  sub_category: string;
  product_group: string;
  category_path: string;
  clean_name: string;
  size_spec: string;
  material_and_tier: string;
  pack_type: string;
  original_tally_name: string;
  normalized_key?: string;
  quantity: number;
  current_stock: number;
  unit: string;
  status: 'In Stock' | 'Zero Stock' | 'Negative';
  location_bin: string;
  last_write_off_date: string | null;
  write_off_source_header: string | null;
  last_audit_date: string;
  last_modified: string;
}

export type TransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'AUDIT_ADJUSTMENT' | 'WRITE_OFF_SYNC' | 'LOCATION_RECONCILIATION';

export type InwardScope = 'BOTH' | 'TOTAL_STOCK_ONLY' | 'LOCATION_ONLY';

export interface Transaction {
  id: string;
  sku_code: string;
  sku_name: string;
  type: TransactionType;
  quantity: number;
  reason: string;
  performed_by: string;
  timestamp: string;
  prev_stock: number;
  new_stock: number;
  notes?: string;
  location?: string;
  referenceNo?: string;
  division?: DivisionCode;
  main_category?: string;
  scope?: InwardScope;
}

export interface InventoryStats {
  total_skus: number;
  total_stock: number;
  total_divisions: number;
  total_main_categories: number;
  total_sub_groups: number;
  total_audited_skus: number;
  total_positive_stock: number;
  total_zero_stock: number;
  total_negative_stock: number;
}

export interface InventoryData {
  stats: InventoryStats;
  divisions: Record<DivisionCode, DivisionInfo>;
  categories_hierarchy: CategoryGroup[];
  skus: SkuItem[];
  initial_transactions: Transaction[];
}

export type ActiveNavModule = 
  | 'stock-master' 
  | 'sales-dispatch'
  | 'location-stock'
  | 'stock-entry' 
  | 'write-off-audit' 
  | 'stock-alerts' 
  | 'tally-sync'
  | 'reports-hub';

export interface DrillDownState {
  level: 1 | 2 | 3 | 4;
  segment: string;
  division: DivisionCode | null;
  mainCategory: string | null;
  subCategory: string | null;
  productGroup: string | null;
}

export interface SalesOrderItem {
  slNo: number;
  rawItemName: string;
  cleanItemName: string; // Uppercase, trimmed, trailing Dim/Din/Dtr removed
  orderedQty: number; // 100% whole integer
  dispatchQty?: number; // Partial fulfillment quantity to dispatch (defaults to orderedQty)
  matchedSku: SkuItem | null;
  isPromoOrNonStock: boolean;
  selectedForLastBox?: boolean; // Selected to pack in final / bottom box
  
  // Packaging specs (from SO Excel or Master)
  size?: string;
  icCapacity?: number | null; // Inner carton capacity (e.g. 10 pcs)
  mcCapacity?: number | null; // Master carton capacity (e.g. 100 pcs)
  icCount?: number | null; // Total IC count
  mcCount?: number | null; // Total MC count (or fraction e.g. 0.1)

  // Packing configuration (Step 3)
  unitsPerBox: number; // Units per box (Whole integer)
  grossWeightPerBox: number; // Gross weight per box in kg (2 decimals)
  isMixedCarton?: boolean;
  mixedCartonNo?: number | null; // Shared carton number e.g. 7, 8
  mixedCartonGrossWeight?: number | null; // Shared carton gross weight
  assignedBoxNo?: number | null; // Direct box number assignment (e.g. 1, 2, 3...)
}

export interface SalesOrderData {
  piNumber: string; // e.g. "699"
  orderDate: string; // e.g. "30-Sep-26"
  partyName: string; // e.g. "R M Tools Solutions"
  partyAbbr: string; // e.g. "RMTS"
  stateName: string; // e.g. "Delhi"
  stateCode: string; // e.g. "07"
  shippingMark: string; // e.g. "RMTS/Delhi/07"
  buyerAddress?: string;
  items: SalesOrderItem[];
  rawFileName?: string;
}

export interface CartonItem {
  id?: string;
  sourceItemSlNo?: number; // Links back directly to SalesOrderItem.slNo
  slNo: number; // 1, 2, 3 inside carton
  rawName: string;
  cleanName: string; // Uppercase
  size?: string;
  icInfo?: string;
  qty: number; // Whole integer
  weightKg: number; // Weight in kg
  isPromoOrNonStock: boolean;
}

export interface Carton {
  id?: string;
  cartonNo: number; // 1, 2, 3...
  shippingMark: string; // e.g. "RMTS/Delhi/07"
  piNumber: string; // e.g. "699"
  partyName: string;
  items: CartonItem[];
  totalQty: number; // Whole integer sum
  grossWeightKg: number; // Gross weight in kg (2 decimals)
  isMixed: boolean;
}

export interface PackingListSummary {
  partyName: string;
  piNumber: string;
  orderDate: string;
  shippingMark: string;
  cartons: Carton[];
  totalBoxes: number;
  totalGrossWeight: number; // 2 decimals
  totalUnits: number; // Whole integer
}

// ============================================================================
// WAREHOUSE LOCATION & PHYSICAL COUNT MODULE TYPES
// ============================================================================

export type LocationType = 'RACK' | 'PALLET' | 'BIN';

export interface WarehouseLocation {
  code: string; // e.g. "A1", "H2", "BIN-5"
  type: LocationType;
  zone: string; // e.g. "Rack A", "Line H", "Bins"
  shelfOrIndex?: number;
  description?: string;
}

export interface LocationStockEntry {
  id: string;
  skuId: string;
  skuCode: string;
  cleanName: string;
  division: DivisionCode;
  mainCategory: string;
  locationCode: string; // e.g. "A1", "H2", "BIN-1"
  countedQty: number;
  countedAt: string;
  countedBy: string;
  notes?: string;
}

export interface CountSession {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isActive: boolean;
  reconciledOrders: string[]; // List of PI numbers
}

// ============================================================================
// USER ROLES & PERMISSIONS
// ============================================================================

export type UserRole = 'admin' | 'dispatch_manager' | 'inward_storekeeper' | 'count_staff';

export interface UserPermissions {
  canEditStockMaster: boolean;
  canDispatchSO: boolean;
  canInwardStock: boolean;
  canCountLocations: boolean;
  canGoLiveLocations: boolean;
  canManageUsers: boolean;
  canResetData: boolean;
}

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
  avatarColor: string;
  permissions: UserPermissions;
}

