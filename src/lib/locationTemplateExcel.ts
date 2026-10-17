import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { SkuItem, WarehouseLocation, CategoryGroup, DivisionCode } from '../types/inventory';
import { normalizeLocationCode, isMockLocationCode, getLocationDescription, getLocationZone } from './locationUtils';

/**
 * Generates and downloads the official OKF 3-Sheet Location-Wise Stock Template
 * Built with ExcelJS for rich professional styling, column widths, colors, borders, and frozen panes.
 */
export const downloadLocationStockTemplate = async (
  skus: SkuItem[],
  locations: WarehouseLocation[],
  categories: CategoryGroup[]
) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Oaykay Forgings Pvt Ltd';
  wb.lastModifiedBy = 'OKF Inventory System';
  wb.created = new Date();
  wb.modified = new Date();

  // --------------------------------------------------------------------------
  // SHEET 1: Location Stock Entry
  // --------------------------------------------------------------------------
  const ws1 = wb.addWorksheet('Location Stock Entry', {
    views: [{ state: 'frozen', ySplit: 4 }]
  });

  // Set explicit, generous column widths (Supports up to 5 Locations per SKU)
  ws1.columns = [
    { key: 'skuCode', width: 18 },        // A: SKU Code
    { key: 'cleanName', width: 44 },      // B: Item Name / Description
    { key: 'division', width: 13 },       // C: Division
    { key: 'mainCategory', width: 25 },   // D: Category
    { key: 'loc1', width: 16 },           // E: Location 1
    { key: 'qty1', width: 14 },           // F: Qty 1
    { key: 'loc2', width: 16 },           // G: 2nd Location
    { key: 'qty2', width: 14 },           // H: 2nd Qty
    { key: 'loc3', width: 16 },           // I: 3rd Location
    { key: 'qty3', width: 14 },           // J: 3rd Qty
    { key: 'loc4', width: 16 },           // K: 4th Location
    { key: 'qty4', width: 14 },           // L: 4th Qty
    { key: 'loc5', width: 16 },           // M: 5th Location
    { key: 'qty5', width: 14 },           // N: 5th Qty
    { key: 'totalQty', width: 18 },       // O: Total Units Counted
    { key: 'notes', width: 28 },          // P: Staff Notes / Remarks
  ];

  // Row 1: Main Title
  const titleRow = ws1.addRow(['OAYKAY FORGINGS PVT LTD — WAREHOUSE PHYSICAL STOCK COUNT TEMPLATE']);
  ws1.mergeCells('A1:P1');
  titleRow.height = 36;
  const titleCell = ws1.getCell('A1');
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Dark Navy / Slate 900
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 2: Subtitle & Instructions
  const subRow = ws1.addRow(['INSTRUCTIONS: 1) Columns A-D are pre-filled catalog SKUs. 2) Enter Locations (Racks A1-G3, Pallets H1+, Bins BIN-1+) & Quantities in the location columns (supports up to 5 locations per SKU). 3) Total Counted is calculated automatically.']);
  ws1.mergeCells('A2:P2');
  subRow.height = 24;
  const subCell = ws1.getCell('A2');
  subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 800
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 3: Blank separator
  const emptyRow = ws1.addRow([]);
  emptyRow.height = 8;

  // Row 4: Column Headers
  const headerRow = ws1.addRow([
    'SKU Code',
    'Item Description / Part Name',
    'Division',
    'Category',
    'Location 1 (E)',
    'Qty 1 (F)',
    '2nd Location (G)',
    '2nd Qty (H)',
    '3rd Location (I)',
    '3rd Qty (J)',
    '4th Location (K)',
    '4th Qty (L)',
    '5th Location (M)',
    '5th Qty (N)',
    'Total Counted (O)',
    'Auditor Notes / Remarks (P)'
  ]);
  headerRow.height = 30;

  headerRow.eachCell((cell, colNumber) => {
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    };

    if (colNumber === 5 || colNumber === 6) {
      // Primary location input: Soft Amber / Warm Yellow
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF92400E' } };
    } else if (colNumber === 7 || colNumber === 8) {
      // 2nd location: Light Slate
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF334155' } };
    } else if (colNumber === 9 || colNumber === 10) {
      // 3rd location: Soft Indigo/Blue
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF3730A3' } };
    } else if (colNumber === 11 || colNumber === 12) {
      // 4th location: Soft Violet/Purple
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF5B21B6' } };
    } else if (colNumber === 13 || colNumber === 14) {
      // 5th location: Soft Teal
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF115E59' } };
    } else if (colNumber === 15) {
      // Total column: Soft Emerald
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF065F46' } };
    } else {
      // Standard header: Slate 900
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    }
  });

  // Pre-fill active catalog SKUs
  skus.forEach((sku, idx) => {
    const rowNum = idx + 5; // 1-based row number
    const row = ws1.addRow([
      sku.sku_code,
      sku.clean_name,
      sku.division,
      sku.main_category,
      sku.location_bin && !isMockLocationCode(sku.location_bin) ? sku.location_bin.split(',')[0]?.trim().replace(/\s*\(.*\)/, '') : '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      { formula: `SUM(F${rowNum},H${rowNum},J${rowNum},L${rowNum},N${rowNum})` },
      ''
    ]);
    row.height = 22;

    const isEven = idx % 2 === 0;
    const bgNeutral = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF475569' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgNeutral } };
      } else if (colNumber === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgNeutral } };
      } else if (colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { 
          name: 'Segoe UI', 
          size: 9.5, 
          bold: true, 
          color: { argb: sku.division === 'DIM' ? 'FF4338CA' : (sku.division === 'DIN' ? 'FF047857' : 'FFB45309') } 
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgNeutral } };
      } else if (colNumber === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF334155' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgNeutral } };
      } else if (colNumber === 5 || colNumber === 7 || colNumber === 9 || colNumber === 11 || colNumber === 13) {
        // Location code columns
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }; // Soft light amber
      } else if (colNumber === 6 || colNumber === 8 || colNumber === 10 || colNumber === 12 || colNumber === 14) {
        // Qty columns
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
        cell.numFmt = '#,##0';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
      } else if (colNumber === 15) {
        // Total column
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF047857' } };
        cell.numFmt = '#,##0';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }; // Soft light emerald
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF64748B' } };
      }
    });
  });

  // Add 30 clearly marked blank template rows for new SKUs
  for (let b = 1; b <= 30; b++) {
    const rowNum = skus.length + 4 + b;
    const row = ws1.addRow([
      `[NEW-ITEM-${b}]`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      { formula: `SUM(F${rowNum},H${rowNum},J${rowNum},L${rowNum},N${rowNum})` },
      'Brand new SKU entered by staff'
    ]);
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { name: 'Consolas', size: 9, bold: true, color: { argb: 'FF2563EB' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      } else if (colNumber === 15) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF047857' } };
        cell.numFmt = '#,##0';
      }
    });
  }

  // --------------------------------------------------------------------------
  // SHEET 2: Warehouse Location Master
  // --------------------------------------------------------------------------
  const ws2 = wb.addWorksheet('Warehouse Locations Master', {
    views: [{ state: 'frozen', ySplit: 3 }]
  });
  ws2.columns = [
    { key: 'code', width: 18 },
    { key: 'type', width: 20 },
    { key: 'zone', width: 24 },
    { key: 'shelf', width: 20 },
    { key: 'desc', width: 34 }
  ];

  const t2 = ws2.addRow(['OAYKAY FORGINGS — WAREHOUSE STORAGE LOCATION MASTER']);
  ws2.mergeCells('A1:E1');
  t2.height = 32;
  const c2 = ws2.getCell('A1');
  c2.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  c2.alignment = { vertical: 'middle', horizontal: 'center' };

  ws2.addRow([]).height = 6;

  const h2 = ws2.addRow(['Location Code', 'Storage Type', 'Rack / Line / Zone', 'Shelf / Position', 'Description']);
  h2.height = 26;
  h2.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  locations.forEach((loc, idx) => {
    const row = ws2.addRow([
      loc.code,
      loc.type === 'RACK' ? 'Steel Rack' : loc.type === 'PALLET' ? 'Pallet Line' : 'Storage Bin',
      loc.zone,
      loc.shelfOrIndex ? (loc.type === 'RACK' ? `Shelf ${loc.shelfOrIndex}` : `Position ${loc.shelfOrIndex}`) : 'N/A',
      loc.description || `${loc.zone} - ${loc.code}`
    ]);
    row.height = 20;
    const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    row.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF334155' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // --------------------------------------------------------------------------
  // SHEET 3: Division & Category Guide
  // --------------------------------------------------------------------------
  const ws3 = wb.addWorksheet('Division & Category Guide', {
    views: [{ state: 'frozen', ySplit: 3 }]
  });
  ws3.columns = [
    { key: 'code', width: 14 },
    { key: 'full', width: 34 },
    { key: 'mainCat', width: 28 },
    { key: 'subCat', width: 28 },
    { key: 'skus', width: 16 }
  ];

  const t3 = ws3.addRow(['OAYKAY FORGINGS — DIVISION & CATEGORY REFERENCE GUIDE']);
  ws3.mergeCells('A1:E1');
  t3.height = 32;
  const c3 = ws3.getCell('A1');
  c3.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  c3.alignment = { vertical: 'middle', horizontal: 'center' };

  ws3.addRow([]).height = 6;

  const h3 = ws3.addRow(['Division', 'Division Full Name', 'Main Category', 'Sub-Category / Product Line', 'Catalog SKUs']);
  h3.height = 26;
  h3.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  categories.forEach((cat, idx) => {
    const fullName = cat.division === 'DIM'
      ? 'Domestic Import (DIM)'
      : cat.division === 'DIN'
      ? 'Domestic In-House Manufactured (DIN)'
      : 'Domestic Trading (DTR)';

    const row = ws3.addRow([
      cat.division,
      fullName,
      cat.main_category,
      cat.sub_category,
      cat.sku_count
    ]);
    row.height = 20;
    const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    row.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF334155' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // Write and Trigger Download in browser
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `OKF_Location_Wise_Stock_Template_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export interface ParsedLocationStockResult {
  entries: Array<{
    skuId: string;
    skuCode: string;
    cleanName: string;
    division: DivisionCode;
    mainCategory: string;
    locationCode: string;
    locationDescription?: string;
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
 * Universal, intelligent parser for uploaded Location Stock Excel files.
 * Automatically adapts to:
 * - 16-column 5-location template (Cols E to N)
 * - 12-column 3-location template
 * - 10-column 2-location template
 * - Legacy 14-column layout
 * - Any user-rearranged column layouts using dynamic header analysis
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

        // Prefer sheet named 'Location Stock Entry', 'Location', or first sheet
        const sheetName = wb.SheetNames.find(n => {
          const l = n.toLowerCase();
          return l.includes('location stock') || l.includes('entry') || l.includes('stock');
        }) || wb.SheetNames[0];

        const ws = wb.Sheets[sheetName];
        if (!ws) {
          throw new Error('Could not find a valid worksheet in the uploaded Excel file.');
        }

        // Convert worksheet to 2D array with formula values evaluated
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
        if (rows.length < 3) {
          throw new Error('Excel sheet does not have enough rows or data.');
        }

        // 1. Locate the Column Headers row (usually row 3 or 4, or first row with "SKU" / "Location")
        let headerRowIdx = -1;
        for (let r = 0; r < Math.min(rows.length, 12); r++) {
          const rowStr = (rows[r] || []).map(c => String(c || '').toLowerCase()).join(' ');
          if (
            (rowStr.includes('sku') || rowStr.includes('part name') || rowStr.includes('item description')) &&
            (rowStr.includes('location') || rowStr.includes('qty') || rowStr.includes('count'))
          ) {
            headerRowIdx = r;
            break;
          }
        }

        // Fallback search if strict match fails
        if (headerRowIdx === -1) {
          for (let r = 0; r < Math.min(rows.length, 12); r++) {
            const rowStr = (rows[r] || []).map(c => String(c || '').toLowerCase()).join(' ');
            if (rowStr.includes('sku') || rowStr.includes('location')) {
              headerRowIdx = r;
              break;
            }
          }
        }

        if (headerRowIdx === -1) {
          headerRowIdx = 3; // Default to row 4 (index 3) of official template
        }

        const headerCells = (rows[headerRowIdx] || []).map(c => String(c || '').toLowerCase().trim());

        // 2. Dynamically identify key column positions
        let skuCol = -1;
        let nameCol = -1;
        let divCol = -1;
        let catCol = -1;
        let notesCol = -1;

        headerCells.forEach((h, colIdx) => {
          if (skuCol === -1 && (h.includes('sku') || (h.includes('code') && !h.includes('location')))) {
            skuCol = colIdx;
          } else if (nameCol === -1 && (h.includes('description') || h.includes('part name') || h.includes('item name') || h.includes('clean name'))) {
            nameCol = colIdx;
          } else if (divCol === -1 && (h.includes('division') || h === 'div')) {
            divCol = colIdx;
          } else if (catCol === -1 && (h.includes('category') || h === 'cat')) {
            catCol = colIdx;
          } else if (notesCol === -1 && (h.includes('note') || h.includes('remark') || h.includes('auditor'))) {
            notesCol = colIdx;
          }
        });

        // 3. Dynamically discover all Location & Qty pairs
        const pairsConfig: Array<{ locCol: number; qtyCol: number }> = [];

        // Check for numbered locations (1 to 5)
        for (let num = 1; num <= 5; num++) {
          const numStr = String(num);
          const ordinal = num === 1 ? '1st' : num === 2 ? '2nd' : num === 3 ? '3rd' : num === 4 ? '4th' : '5th';
          const letter = num === 1 ? '(e)' : num === 2 ? '(g)' : num === 3 ? '(i)' : num === 4 ? '(k)' : '(m)';
          const qtyLetter = num === 1 ? '(f)' : num === 2 ? '(h)' : num === 3 ? '(j)' : num === 4 ? '(l)' : '(n)';

          const locIdx = headerCells.findIndex(h => 
            (h.includes('loc') && (h.includes(numStr) || h.includes(ordinal) || h.includes(letter))) ||
            (num === 1 && (h.includes('primary location') || h === 'location code' || h === 'location'))
          );

          let qtyIdx = headerCells.findIndex(h => 
            (h.includes('qty') || h.includes('count') || h.includes('quantity')) &&
            (h.includes(numStr) || h.includes(ordinal) || h.includes(qtyLetter))
          );

          // If qtyIdx not found explicitly by number, but locIdx is found, check if locIdx + 1 is the qty
          if (locIdx !== -1 && qtyIdx === -1 && locIdx + 1 < headerCells.length) {
            qtyIdx = locIdx + 1;
          }

          if (locIdx !== -1 && qtyIdx !== -1 && locIdx !== qtyIdx) {
            pairsConfig.push({ locCol: locIdx, qtyCol: qtyIdx });
          }
        }

        // If no numbered pairs were found via headers, use positional fallback
        if (pairsConfig.length === 0) {
          // Check standard 16-column template: cols (4,5), (6,7), (8,9), (10,11), (12,13)
          if (headerCells.length >= 6) {
            for (let c = 4; c <= Math.min(headerCells.length - 2, 12); c += 2) {
              pairsConfig.push({ locCol: c, qtyCol: c + 1 });
            }
          } else if (headerCells.length >= 2) {
            pairsConfig.push({ locCol: 0, qtyCol: 1 });
          }
        }

        // Set fallbacks for SKU and Name columns if not matched
        if (skuCol === -1) skuCol = 0;
        if (nameCol === -1) nameCol = 1;
        if (divCol === -1) divCol = 2;
        if (catCol === -1) catCol = 3;

        // 4. Create robust SKU lookup indexes
        const skuByCode = new Map<string, SkuItem>();
        const skuByCleanCode = new Map<string, SkuItem>();
        const skuByName = new Map<string, SkuItem>();
        const skuByTallyName = new Map<string, SkuItem>();

        existingSkus.forEach(s => {
          const upperCode = s.sku_code.toUpperCase().trim();
          skuByCode.set(upperCode, s);
          skuByCleanCode.set(upperCode.replace(/[\s\-_]/g, ''), s);

          const nameKey = s.clean_name.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (nameKey) skuByName.set(nameKey, s);

          if (s.original_tally_name) {
            const tallyKey = s.original_tally_name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (tallyKey) skuByTallyName.set(tallyKey, s);
          }
        });

        // Location lookup for description
        const existingLocMap = new Map<string, WarehouseLocation>();
        existingLocations.forEach(l => existingLocMap.set(l.code, l));

        const entries: ParsedLocationStockResult['entries'] = [];
        const newSkusToAdd: ParsedLocationStockResult['newSkusToAdd'] = [];
        const newLocationsDiscoveredSet = new Set<string>();
        let totalUnitsCounted = 0;

        // 5. Parse Data Rows
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r] || [];
          const rawCode = String(row[skuCol] || '').trim();
          const rawName = String(row[nameCol] || '').trim();
          const rawDivCand = String(row[divCol] || '').trim().toUpperCase();
          const rawDiv: DivisionCode = (rawDivCand === 'DIM' || rawDivCand === 'DIN' || rawDivCand === 'DTR') ? rawDivCand as DivisionCode : 'DIM';
          const rawMainCat = String(row[catCol] || '').trim();
          const notes = notesCol !== -1 ? String(row[notesCol] || '').trim() : '';

          // Skip completely empty rows
          if (!rawCode && !rawName) continue;

          // Parse all location & qty pairs in this row
          const pairs: Array<{ loc: string; qty: number }> = [];

          pairsConfig.forEach(({ locCol, qtyCol }) => {
            const locVal = row[locCol];
            const qtyVal = row[qtyCol];

            const loc = normalizeLocationCode(locVal);
            const qtyStr = String(qtyVal || '0').replace(/,/g, '').trim();
            const parsedQty = Math.round(parseFloat(qtyStr) || 0);

            if (loc && parsedQty > 0) {
              pairs.push({ loc, qty: parsedQty });
            }
          });

          // If no location counts on this row, skip
          if (pairs.length === 0) continue;

          // Match SKU:
          let matchedSku: SkuItem | undefined = undefined;
          if (rawCode && !rawCode.startsWith('[NEW-') && !rawCode.startsWith('[AUTO-NEW-')) {
            matchedSku = skuByCode.get(rawCode.toUpperCase());
            if (!matchedSku) {
              matchedSku = skuByCleanCode.get(rawCode.toUpperCase().replace(/[\s\-_]/g, ''));
            }
          }

          if (!matchedSku && rawName) {
            const nameKey = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
            matchedSku = skuByName.get(nameKey) || skuByTallyName.get(nameKey);
          }

          // Register new locations discovered
          pairs.forEach(p => {
            if (!existingLocMap.has(p.loc)) {
              newLocationsDiscoveredSet.add(p.loc);
            }
          });

          if (matchedSku) {
            pairs.forEach(p => {
              const locDesc = existingLocMap.get(p.loc)?.description || getLocationDescription(p.loc);
              entries.push({
                skuId: matchedSku!.id,
                skuCode: matchedSku!.sku_code,
                cleanName: matchedSku!.clean_name,
                division: matchedSku!.division,
                mainCategory: matchedSku!.main_category,
                locationCode: p.loc,
                locationDescription: locDesc,
                countedQty: p.qty,
                countedBy: 'Excel Bulk Upload',
                notes: notes || undefined
              });
              totalUnitsCounted += p.qty;
            });
          } else if (rawName) {
            // New SKU found in bottom rows
            const totalQty = pairs.reduce((sum, p) => sum + p.qty, 0);

            newSkusToAdd.push({
              clean_name: rawName,
              division: rawDiv,
              main_category: rawMainCat || 'General Warehouse',
              sub_category: rawMainCat || 'General Warehouse',
              initial_stock: totalQty,
              location_bin: pairs.map(p => `${p.loc} (${p.qty})`).join(', ')
            });

            pairs.forEach(p => {
              const locDesc = existingLocMap.get(p.loc)?.description || getLocationDescription(p.loc);
              entries.push({
                skuId: `new-sku-${entries.length}`,
                skuCode: rawCode && !rawCode.startsWith('[NEW-') ? rawCode : `NEW-${entries.length + 1}`,
                cleanName: rawName,
                division: rawDiv,
                mainCategory: rawMainCat || 'General Warehouse',
                locationCode: p.loc,
                locationDescription: locDesc,
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
