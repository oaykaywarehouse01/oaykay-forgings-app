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

export type TransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'AUDIT_ADJUSTMENT' | 'WRITE_OFF_SYNC';

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
  | 'stock-entry' 
  | 'write-off-audit' 
  | 'stock-alerts' 
  | 'tally-sync';

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
  slNo: number; // 1, 2, 3 inside carton
  rawName: string;
  cleanName: string; // Uppercase
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

