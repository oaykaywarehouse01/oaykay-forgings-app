import * as XLSX from 'xlsx';
import { SkuItem, WarehouseLocation, CategoryGroup, DivisionCode } from '../types/inventory';
import { normalizeLocationCode } from './locationUtils';

/**
 * Generates and downloads the official OKF 3-Sheet Location-Wise Stock Template
 */
export const downloadLocationStockTemplate = (
  skus: SkuItem[],
  locations: WarehouseLocation[],
  categories: CategoryGroup[]
) => {
  const wb = XLSX.utils.book_new();

  // --------------------------------------------------------------------------
  // SHEET 1: Location Stock Entry
  // --------------------------------------------------------------------------
  const sheet1Rows: any[][] = [
    ['OAYKAY FORGINGS PVT LTD — WAREHOUSE LOCATION-WISE PHYSICAL STOCK TEMPLATE'],
    ['HOW TO USE: 1) Columns A–F are pre-filled with all catalog SKUs. 2) Fill physical count in YELLOW columns: Location 1 Code (Steel Racks: A1–G3 | Pallets: H1, H2... | Bins: BIN-1, BIN-2...) and Location 1 Qty. 3) If the same item is stored in multiple locations, fill Location 2 / Location 3. Column M [Auto] calculates Total Location Stock. 4) To add a NEW ITEM not in the list, scroll to the bottom rows and enter Division, Category, Item Name, Location & Qty.'],
    [],
    [],
    [
      'SKU Code',
      'Division',
      'Main Category',
      'Sub-Category',
      'Clean Item Name (Part Name)',
      'Unit',
      'Location 1 Code\n(A1..G3 / H1.. / BIN-1)',
      'Location 1 Qty\n(Whole Units)',
      'Location 2 Code\n(Optional)',
      'Location 2 Qty\n(Optional)',
      'Location 3 Code\n(Optional)',
      'Location 3 Qty\n(Optional)',
      'Total Location Stock [Auto]',
      'Count Date / Notes'
    ]
  ];

  // Pre-fill with active SKUs
  skus.forEach((sku, idx) => {
    const rowNum = idx + 6; // 1-based row index in Excel
    sheet1Rows.push([
      sku.sku_code,
      sku.division,
      sku.main_category,
      sku.sub_category,
      sku.clean_name,
      sku.unit,
      sku.location_bin ? sku.location_bin.split(',')[0]?.trim().replace(/\s*\(.*\)/, '') : '',
      '',
      '',
      '',
      '',
      '',
      { f: `SUM(H${rowNum},J${rowNum},L${rowNum})` },
      ''
    ]);
  });

  // Add 30 blank template rows at the bottom for adding brand-new SKUs
  for (let b = 1; b <= 30; b++) {
    const rowNum = skus.length + 5 + b;
    sheet1Rows.push([
      `[AUTO-NEW-${b}]`,
      '', // User enters DIM, DIN, or DTR
      '', // Main Category
      '', // Sub-Category
      '', // Clean Item Name
      'Pcs',
      '', // Location 1
      '', // Qty 1
      '',
      '',
      '',
      '',
      { f: `SUM(H${rowNum},J${rowNum},L${rowNum})` },
      'Brand new SKU onboarded via physical count'
    ]);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Location Stock Entry');

  // --------------------------------------------------------------------------
  // SHEET 2: Warehouse Location Master
  // --------------------------------------------------------------------------
  const sheet2Rows: any[][] = [
    ['OAYKAY FORGINGS — WAREHOUSE STORAGE LOCATION MASTER (RACKS A–G • PALLETS H+ • BINS)'],
    ['Standard Naming Rule: Steel Racks = A to G (3 Shelves each: A1, A2, A3 ... G1, G2, G3) | Horizontal Pallet Lines = H onwards (6 Pallets per line: H1–H6, I1–I6...) | Bins = BIN-1, BIN-2, BIN-3...'],
    [],
    [
      'Location Code',
      'Storage Type',
      'Rack / Line / Zone',
      'Shelf / Pallet Position',
      'Description',
      'Total Qty Stored Here [Auto]'
    ]
  ];

  locations.forEach(loc => {
    sheet2Rows.push([
      loc.code,
      loc.type === 'RACK' ? 'Steel Rack' : loc.type === 'PALLET' ? 'Pallet Line' : 'Storage Bin',
      loc.zone,
      loc.shelfOrIndex ? (loc.type === 'RACK' ? `Shelf ${loc.shelfOrIndex}` : `Position ${loc.shelfOrIndex}`) : 'N/A',
      loc.description || `${loc.zone} - ${loc.code}`,
      0
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Warehouse Location Master');

  // --------------------------------------------------------------------------
  // SHEET 3: Division & Category Guide
  // --------------------------------------------------------------------------
  const sheet3Rows: any[][] = [
    ['OAYKAY FORGINGS — DIVISION & CATEGORY REFERENCE GUIDE (DIM • DIN • DTR)'],
    ['DIM = Domestic Import (Power Tool Accessories, Allen Keys, Cutters, etc.) | DIN = Domestic In-House Manufactured (Spanners, Wrenches, Hammers, etc.) | DTR = Domestic Trading (Screwdrivers, Vices, Pliers, Lubri, etc.)'],
    [],
    [
      'Group ID',
      'Division Code',
      'Division Full Name',
      'Main Category',
      'Sub-Category / Product Line',
      'Catalog SKU Count'
    ]
  ];

  categories.forEach(cat => {
    const fullName = cat.division === 'DIM'
      ? 'Domestic Import (DIM)'
      : cat.division === 'DIN'
      ? 'Domestic In-House Manufactured (DIN)'
      : 'Domestic Trading (DTR)';

    sheet3Rows.push([
      cat.group_id,
      cat.division,
      fullName,
      cat.main_category,
      cat.sub_category,
      cat.sku_count
    ]);
  });

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);
  XLSX.utils.book_append_sheet(wb, ws3, 'Division & Category Guide');

  // Download file
  XLSX.writeFile(wb, `OKF_Location_Wise_Stock_Template_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export interface ParsedLocationStockResult {
  entries: Array<{
    skuId: string;
    skuCode: string;
    cleanName: string;
    division: DivisionCode;
    mainCategory: string;
    locationCode: string;
    countedQty: number;
    countedBy: string;
    notes?: string;
  }>;
  newSkusToAdd: Array<{
    clean_name: string;
    division: DivisionCode;
    main_category: string;
    sub_category: string;
    initial_stock: number;
    location_bin: string;
  }>;
  newLocationsDiscovered: string[];
  totalUnitsCounted: number;
}

/**
 * Parses uploaded Location Stock Excel file
 */
export const parseUploadedLocationStockExcel = async (
  file: File,
  existingSkus: SkuItem[],
  existingLocations: WarehouseLocation[]
): Promise<ParsedLocationStockResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const wb = XLSX.read(buffer, { type: 'binary', cellFormula: true, cellStyles: true });

        // Prefer sheet named 'Location Stock Entry' or first sheet
        const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('location stock') || n.toLowerCase().includes('entry')) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 5) {
          throw new Error('Excel sheet does not have enough rows or is missing header row.');
        }

        // Find header row (usually contains 'SKU Code' or 'Location 1')
        let headerRowIdx = 4;
        for (let r = 0; r < Math.min(rows.length, 10); r++) {
          const rowStr = (rows[r] || []).join(' ').toLowerCase();
          if (rowStr.includes('sku code') || rowStr.includes('clean item name') || rowStr.includes('location 1')) {
            headerRowIdx = r;
            break;
          }
        }

        // Create quick lookup maps for existing SKUs
        const skuByCode = new Map<string, SkuItem>();
        const skuByName = new Map<string, SkuItem>();

        existingSkus.forEach(s => {
          skuByCode.set(s.sku_code.toUpperCase().trim(), s);
          skuByName.set(s.clean_name.toLowerCase().replace(/[\s_]/g, ''), s);
        });

        const existingLocSet = new Set(existingLocations.map(l => l.code));
        const entries: ParsedLocationStockResult['entries'] = [];
        const newSkusToAdd: ParsedLocationStockResult['newSkusToAdd'] = [];
        const newLocationsDiscoveredSet = new Set<string>();
        let totalUnitsCounted = 0;

        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r] || [];
          const rawCode = String(row[0] || '').trim();
          const rawDiv = String(row[1] || '').trim().toUpperCase() as DivisionCode;
          const rawMainCat = String(row[2] || '').trim();
          const rawSubCat = String(row[3] || '').trim();
          const rawName = String(row[4] || '').trim();
          const notes = String(row[13] || '').trim();

          // Skip completely empty rows
          if (!rawCode && !rawName) continue;

          // Check if this is an existing SKU
          let matchedSku: SkuItem | undefined = undefined;
          if (rawCode && !rawCode.startsWith('[AUTO-NEW-')) {
            matchedSku = skuByCode.get(rawCode.toUpperCase());
          }
          if (!matchedSku && rawName) {
            matchedSku = skuByName.get(rawName.toLowerCase().replace(/[\s_]/g, ''));
          }

          // Read locations 1, 2, 3
          const loc1 = normalizeLocationCode(row[6]);
          const qty1 = Math.round(parseFloat(String(row[7] || '0')) || 0);

          const loc2 = normalizeLocationCode(row[8]);
          const qty2 = Math.round(parseFloat(String(row[9] || '0')) || 0);

          const loc3 = normalizeLocationCode(row[10]);
          const qty3 = Math.round(parseFloat(String(row[11] || '0')) || 0);

          const pairs = [
            { loc: loc1, qty: qty1 },
            { loc: loc2, qty: qty2 },
            { loc: loc3, qty: qty3 }
          ].filter(p => p.loc && p.qty > 0);

          if (pairs.length === 0) continue;

          pairs.forEach(p => {
            if (!existingLocSet.has(p.loc)) {
              newLocationsDiscoveredSet.add(p.loc);
            }
          });

          if (matchedSku) {
            pairs.forEach(p => {
              entries.push({
                skuId: matchedSku!.id,
                skuCode: matchedSku!.sku_code,
                cleanName: matchedSku!.clean_name,
                division: matchedSku!.division,
                mainCategory: matchedSku!.main_category,
                locationCode: p.loc,
                countedQty: p.qty,
                countedBy: 'Excel Bulk Upload',
                notes: notes || undefined
              });
              totalUnitsCounted += p.qty;
            });
          } else if (rawName && (rawDiv === 'DIM' || rawDiv === 'DIN' || rawDiv === 'DTR')) {
            // Brand new item discovered in bottom rows!
            const totalQty = pairs.reduce((sum, p) => sum + p.qty, 0);
            const primaryLoc = pairs[0].loc;

            newSkusToAdd.push({
              clean_name: rawName,
              division: rawDiv,
              main_category: rawMainCat || 'General Tools',
              sub_category: rawSubCat || rawMainCat || 'General Tools',
              initial_stock: totalQty,
              location_bin: pairs.map(p => `${p.loc} (${p.qty})`).join(', ')
            });

            pairs.forEach(p => {
              entries.push({
                skuId: `new-sku-${entries.length}`,
                skuCode: `NEW-${entries.length}`,
                cleanName: rawName,
                division: rawDiv,
                mainCategory: rawMainCat || 'General Tools',
                locationCode: p.loc,
                countedQty: p.qty,
                countedBy: 'Excel Bulk Upload',
                notes: notes || 'New SKU from Excel'
              });
              totalUnitsCounted += p.qty;
            });
          }
        }

        resolve({
          entries,
          newSkusToAdd,
          newLocationsDiscovered: Array.from(newLocationsDiscoveredSet),
          totalUnitsCounted
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
