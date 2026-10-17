import * as XLSX from 'xlsx';
import { SkuItem, SalesOrderData, SalesOrderItem, Carton, CartonItem, PackingListSummary } from '../types/inventory';

// Normalize string for fuzzy/exact matching against Stock Master
export const normalizeNameForMatch = (name: string): string => {
  if (!name) return '';
  return String(name)
    .replace(/_x000D_|[\r\n]/g, ' ')
    .replace(/''/g, '"')
    .replace(/\s+/g, '')
    .toLowerCase();
};

// Clean item name for official Packaging List and Box Stickers
// Example: 'Bench Vice SG Iron Fixed Base 5" Med Dtr_x000D_\n' -> 'BENCH VICE SG IRON FIXED BASE 5" MED'
export const cleanItemNameForPackaging = (rawName: string): string => {
  if (!rawName) return '';
  let cleaned = String(rawName)
    .replace(/_x000D_|[\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Strip trailing division indicators: 'Dim', 'Din', 'Dtr'
  cleaned = cleaned.replace(/\s+(dim|din|dtr)$/i, '').trim();
  return cleaned.toUpperCase();
};

// Auto-generate Party Abbreviation from words (e.g. "R M Tools Solutions" -> "RMTS", "Parkash Oil Company" -> "POC")
export const getPartyAbbreviation = (partyName: string): string => {
  if (!partyName) return 'OKF';
  const clean = partyName.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length >= 2) {
    return words.map(w => w[0].toUpperCase()).join('').slice(0, 5);
  }
  return partyName.slice(0, 4).toUpperCase();
};

// Auto-build Shipping Mark: <Party Abbreviation>/<State Name>/<State Code>
export const buildShippingMark = (abbr: string, stateName: string, stateCode: string): string => {
  const cleanAbbr = (abbr || 'OKF').trim();
  const cleanState = (stateName || 'State').trim();
  const cleanCode = (stateCode || '00').trim();
  return `${cleanAbbr}/${cleanState}/${cleanCode}`;
};

// Known promotional / non-stock item keywords
const PROMO_KEYWORDS = [
  'note pad',
  'pens',
  'key rings',
  'pop socket',
  'price list',
  'catalogue',
  'brochure',
  't-shirt',
  'cap',
  'calendar'
];

export const isLikelyPromoItem = (name: string): boolean => {
  const lower = name.toLowerCase();
  return PROMO_KEYWORDS.some(kw => lower.includes(kw));
};

// Match SO item against Stock Master SKUs
export const matchItemToSku = (
  rawName: string, 
  skus: SkuItem[]
): { matchedSku: SkuItem | null; isPromo: boolean } => {
  if (isLikelyPromoItem(rawName)) {
    return { matchedSku: null, isPromo: true };
  }

  const normRaw = normalizeNameForMatch(rawName);
  const normRawNoDiv = normRaw.replace(/(dim|din|dtr)$/i, '');

  // 1. Exact match on original_tally_name
  let matched = skus.find(s => s.original_tally_name && normalizeNameForMatch(s.original_tally_name) === normRaw);
  if (matched) return { matchedSku: matched, isPromo: false };

  // 2. Exact match on clean_name
  matched = skus.find(s => normalizeNameForMatch(s.clean_name) === normRaw);
  if (matched) return { matchedSku: matched, isPromo: false };

  // 3. Match without division suffix
  matched = skus.find(s => {
    const sNormClean = normalizeNameForMatch(s.clean_name);
    const sNormTally = s.original_tally_name ? normalizeNameForMatch(s.original_tally_name) : '';
    return sNormClean === normRawNoDiv || sNormTally === normRawNoDiv;
  });
  if (matched) return { matchedSku: matched, isPromo: false };

  // 4. Fallback search by key tokens
  const tokens = rawName
    .replace(/_x000D_|[\r\n]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2 && !['dim', 'din', 'dtr'].includes(t));

  if (tokens.length >= 2) {
    matched = skus.find(s => {
      const sName = (s.clean_name + ' ' + (s.original_tally_name || '')).toLowerCase();
      return tokens.every(tok => sName.includes(tok));
    });
    if (matched) return { matchedSku: matched, isPromo: false };
  }

  // If still not matched, check if it could be a non-stock / promo item
  return { matchedSku: null, isPromo: isLikelyPromoItem(rawName) };
};

// Default packing suggestions based on item name and quantity
export const getDefaultPackingConfig = (cleanName: string, orderedQty: number): { unitsPerBox: number; grossWeightPerBox: number } => {
  const lower = cleanName.toLowerCase();
  
  if (lower.includes('grinding wheel') || lower.includes('cutting wheel') || lower.includes('flap disc')) {
    const units = orderedQty >= 150 ? 150 : (orderedQty >= 100 ? 100 : (orderedQty >= 50 ? 50 : orderedQty));
    return { unitsPerBox: units, grossWeightPerBox: 18.50 };
  }
  if (lower.includes('vice') || lower.includes('bench vice')) {
    const units = orderedQty > 10 ? 2 : (orderedQty > 5 ? 1 : orderedQty);
    return { unitsPerBox: units, grossWeightPerBox: 16.00 };
  }
  if (lower.includes('handle') || lower.includes('l-handle') || lower.includes('spanner')) {
    const units = orderedQty >= 48 ? 48 : (orderedQty >= 24 ? 24 : (orderedQty >= 12 ? 12 : orderedQty));
    return { unitsPerBox: units, grossWeightPerBox: 12.00 };
  }
  if (lower.includes('pipe wrench') || lower.includes('wrench')) {
    const units = orderedQty >= 12 ? 12 : (orderedQty >= 6 ? 6 : orderedQty);
    return { unitsPerBox: units, grossWeightPerBox: 14.50 };
  }
  if (lower.includes('cutter') || lower.includes('cable cutter') || lower.includes('plier')) {
    const units = orderedQty >= 12 ? 12 : (orderedQty >= 6 ? 6 : orderedQty);
    return { unitsPerBox: units, grossWeightPerBox: 10.50 };
  }
  if (isLikelyPromoItem(cleanName)) {
    return { unitsPerBox: orderedQty, grossWeightPerBox: 2.00 };
  }

  // General default: whole order in 1 box if small, or split in chunks
  const units = orderedQty <= 50 ? orderedQty : (orderedQty <= 200 ? 50 : 100);
  return { unitsPerBox: units, grossWeightPerBox: 15.00 };
};

// Parse uploaded Tally Sales Order Excel (.xlsx) file
export const parseSalesOrderExcel = async (file: File, skus: SkuItem[]): Promise<SalesOrderData> => {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  
  // Use sheet 'SALES ORDER' if present, otherwise first sheet
  const sheetName = wb.SheetNames.includes('SALES ORDER') ? 'SALES ORDER' : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  if (!sheet) {
    throw new Error('Sales Order sheet not found in the uploaded workbook.');
  }

  // Convert sheet to 2D array of rows
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // 1. PI Number (Voucher No.): Cell G4 (Row 4, Col 7), fallback G8
  let piNumber = '';
  if (sheet['G4'] && sheet['G4'].v) {
    piNumber = String(sheet['G4'].v).trim();
  } else if (sheet['G8'] && sheet['G8'].v) {
    piNumber = String(sheet['G8'].v).trim();
  } else {
    // Scan rows for 'Voucher No.'
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const row = rows[r] || [];
      const vIdx = row.findIndex((c: any) => String(c).toLowerCase().includes('voucher no'));
      if (vIdx !== -1 && rows[r + 1] && rows[r + 1][vIdx]) {
        piNumber = String(rows[r + 1][vIdx]).trim();
        break;
      }
    }
  }
  if (!piNumber) piNumber = '699'; // Safe fallback

  // 2. Order Date (Dated): Cell J4 (Row 4, Col 10)
  let orderDate = '';
  if (sheet['J4']) {
    orderDate = String(sheet['J4'].w || sheet['J4'].v).trim();
  } else {
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const row = rows[r] || [];
      const dIdx = row.findIndex((c: any) => String(c).toLowerCase() === 'dated');
      if (dIdx !== -1 && rows[r + 1] && rows[r + 1][dIdx]) {
        orderDate = String(rows[r + 1][dIdx]).trim();
        break;
      }
    }
  }
  if (!orderDate) orderDate = new Date().toLocaleDateString('en-GB');

  // 3. Party Name: Below 'Consignee (Ship to)' or 'Buyer (Bill to)'
  let partyName = '';
  let buyerAddress = '';
  let consigneeRowIdx = -1;
  let buyerRowIdx = -1;

  for (let r = 0; r < Math.min(rows.length, 28); r++) {
    const colA = String(rows[r]?.[0] || '').toLowerCase().trim();
    if (colA.includes('consignee (ship to)')) {
      consigneeRowIdx = r;
    }
    if (colA.includes('buyer (bill to)')) {
      buyerRowIdx = r;
    }
  }

  const targetPartyRow = consigneeRowIdx !== -1 ? consigneeRowIdx + 1 : (buyerRowIdx !== -1 ? buyerRowIdx + 1 : -1);
  if (targetPartyRow !== -1 && rows[targetPartyRow]?.[0]) {
    partyName = String(rows[targetPartyRow][0]).trim();
    if (rows[targetPartyRow + 1]?.[0]) {
      buyerAddress = String(rows[targetPartyRow + 1][0]).trim();
    }
  }
  if (!partyName) partyName = 'R M Tools Solutions';

  // 4. State Name & State Code: Search starting from Consignee / Buyer row (NOT Seller Row 9!)
  let stateName = 'Delhi';
  let stateCode = '07';
  const stateSearchStart = consigneeRowIdx !== -1 ? consigneeRowIdx : (buyerRowIdx !== -1 ? buyerRowIdx : 10);

  for (let r = stateSearchStart; r < Math.min(rows.length, 32); r++) {
    const colA = String(rows[r]?.[0] || '').toLowerCase().trim();
    if (colA.includes('state name')) {
      // Check Col D (index 3) or subsequent non-empty columns in this row, or inline after ':' in Col A
      let stateCell = String(rows[r]?.[3] || rows[r]?.[2] || rows[r]?.[1] || '').trim();
      if (!stateCell && colA.includes(':')) {
        stateCell = String(rows[r]?.[0] || '').split(':').slice(1).join(':').trim();
      }
      if (stateCell) {
        // e.g. "Delhi, Code : 07" or "Haryana, Code : 06"
        const parts = stateCell.split(',');
        if (parts[0] && parts[0].trim()) {
          stateName = parts[0].trim();
        }
        const codeMatch = stateCell.match(/code\s*:\s*(\d+)/i) || (parts[1] ? parts[1].match(/\d+/) : null);
        if (codeMatch) {
          stateCode = codeMatch[1] || codeMatch[0];
        }
        break;
      }
    }
  }

  // 5. Party Abbreviation & Shipping Mark
  const partyAbbr = getPartyAbbreviation(partyName);
  const shippingMark = buildShippingMark(partyAbbr, stateName, stateCode);

  // 6. Ordered Items List: Find table header row
  let headerRowIdx = -1;
  let descColIdx = 1; // Col B default
  let qtyColIdx = 10; // Col K default

  for (let r = 0; r < Math.min(rows.length, 32); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').toLowerCase().trim();
      if (val.includes('description of goods')) {
        headerRowIdx = r;
        descColIdx = c;
      }
      if (val.includes('quantity')) {
        qtyColIdx = c;
      }
    }
    if (headerRowIdx !== -1) break;
  }

  const items: SalesOrderItem[] = [];
  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 28;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r] || [];
    const colA = row[0];
    const rawDesc = row[descColIdx];
    const rawQty = row[qtyColIdx];

    // Check if this row is a valid item row (serial number in Col A or valid description)
    const isSerial = typeof colA === 'number' || (typeof colA === 'string' && /^\d+$/.test(colA.trim()));
    if (isSerial && rawDesc) {
      const rawItemName = String(rawDesc).trim();
      if (!rawItemName) continue;

      const cleanItemName = cleanItemNameForPackaging(rawItemName);
      const orderedQty = Math.round(Number(rawQty) || 0);

      const { matchedSku, isPromo } = matchItemToSku(rawItemName, skus);
      const packingConfig = getDefaultPackingConfig(cleanItemName, orderedQty);

      items.push({
        slNo: items.length + 1,
        rawItemName,
        cleanItemName,
        orderedQty,
        dispatchQty: orderedQty, // Default dispatch qty = full ordered qty
        matchedSku,
        isPromoOrNonStock: isPromo,
        selectedForLastBox: isPromo, // Non-stock / promo items default to packing in last box
        unitsPerBox: packingConfig.unitsPerBox,
        grossWeightPerBox: packingConfig.grossWeightPerBox,
        isMixedCarton: isPromo, // Promo items default to mixed carton
        mixedCartonNo: null,
        assignedBoxNo: null
      });
    }
  }

  return {
    piNumber,
    orderDate,
    partyName,
    partyAbbr,
    stateName,
    stateCode,
    shippingMark,
    buyerAddress,
    items,
    rawFileName: file.name
  };
};

// Hardcoded Sample SO #699 (exact match with Sales Order_699 (1).xlsx)
export const getSampleSalesOrder699 = (skus: SkuItem[]): SalesOrderData => {
  const rawItems = [
    { name: 'Bench Vice SG Iron Fixed Base 5" Med Dtr', qty: 20 },
    { name: 'All Steel Vice Fixed Base 100mm(4")  Dtr', qty: 30 },
    { name: 'L-Handle 1/2 Crv 18" Din', qty: 96 },
    { name: 'Grinding Wheel Black 5" 02 Net Dim', qty: 450 },
    { name: 'Note Pad', qty: 10 },
    { name: 'Pens 18%', qty: 10 },
    { name: 'Key Rings', qty: 10 },
    { name: 'Pop Socket 18%', qty: 5 },
    { name: 'PRICE LIST-18%', qty: 20 },
  ];

  const items: SalesOrderItem[] = rawItems.map((item, idx) => {
    const cleanItemName = cleanItemNameForPackaging(item.name);
    const { matchedSku, isPromo } = matchItemToSku(item.name, skus);
    const packingConfig = getDefaultPackingConfig(cleanItemName, item.qty);

    return {
      slNo: idx + 1,
      rawItemName: item.name,
      cleanItemName,
      orderedQty: Math.round(item.qty),
      dispatchQty: Math.round(item.qty),
      matchedSku,
      isPromoOrNonStock: isPromo,
      selectedForLastBox: isPromo,
      unitsPerBox: packingConfig.unitsPerBox,
      grossWeightPerBox: packingConfig.grossWeightPerBox,
      isMixedCarton: isPromo,
      mixedCartonNo: null,
      assignedBoxNo: null
    };
  });

  return {
    piNumber: '699',
    orderDate: '30-Sep-26',
    partyName: 'R M Tools Solutions',
    partyAbbr: 'RMTS',
    stateName: 'Delhi',
    stateCode: '07',
    shippingMark: 'RMTS/Delhi/07',
    buyerAddress: '3319-21 Ground Floor, PVT NO.-6, Kucha Kashgiri, (Near Sardar Ghee), Bazar Sita Ram, Delhi',
    items,
    rawFileName: 'Sales Order_699 (1).xlsx'
  };
};

// Generate Cartons and Packaging List Summary
// CRITICAL RULE: Non-stock / promo items (notepad, pen, key rings, etc.) are ALWAYS
// packed in the LAST BOX (at the very bottom) so tool boxes come first!
export const generateCartonsAndPackagingList = (soData: SalesOrderData): PackingListSummary => {
  const cartons: Carton[] = [];
  let currentCartonNo = 1;

  // Filter items with active dispatchQty > 0
  const activeItems = soData.items.filter(item => {
    const qty = typeof item.dispatchQty === 'number' ? item.dispatchQty : item.orderedQty;
    return qty > 0;
  });

  // 1. Separate items:
  // - Tool / Inventory items
  // - Non-stock / Promo items (to be placed at the very bottom / last box)
  const toolItems = activeItems.filter(item => !item.isPromoOrNonStock);
  const promoItems = activeItems.filter(item => item.isPromoOrNonStock);

  // 2. Process tool items: Standard & Box Assigned
  // CRITICAL LOGIC: If an item has totalQty > unitsPerBox (e.g. 400 pcs with unitsPerBox = 200),
  // it MUST be split into multiple individual cartons:
  // - Box 1: 200 pcs, Gross Weight: 18.00 kg
  // - Box 2: 200 pcs, Gross Weight: 18.00 kg
  // Each full box receives the exact item.grossWeightPerBox!

  // Group tool items that share a mixed box (items with <= unitsPerBox sharing the same assignedBoxNo or mixedCartonNo)
  const explicitMixedGroups: Record<number, SalesOrderItem[]> = {};
  const standardOrSplitItems: SalesOrderItem[] = [];

  toolItems.forEach(item => {
    const totalQty = typeof item.dispatchQty === 'number' ? Math.round(item.dispatchQty) : Math.round(item.orderedQty);
    const unitsPerBox = Math.max(1, Math.round(item.unitsPerBox || totalQty));

    // If item is explicitly marked mixed or shares a box with another item and fits in 1 box
    if (item.isMixedCarton && item.mixedCartonNo) {
      if (!explicitMixedGroups[item.mixedCartonNo]) explicitMixedGroups[item.mixedCartonNo] = [];
      explicitMixedGroups[item.mixedCartonNo].push(item);
    } else {
      standardOrSplitItems.push(item);
    }
  });

  // Collect all manually reserved assignedBoxNo values upfront so Auto boxes never collide
  const reservedBoxNos = new Set(standardOrSplitItems.map(i => i.assignedBoxNo).filter(Boolean) as number[]);
  Object.keys(explicitMixedGroups).forEach(k => {
    const num = parseInt(k, 10);
    if (!isNaN(num) && num > 0) reservedBoxNos.add(num);
  });

  // Pack standard and split tool items
  standardOrSplitItems.forEach(item => {
    const totalQty = typeof item.dispatchQty === 'number' ? Math.round(item.dispatchQty) : Math.round(item.orderedQty);
    if (totalQty <= 0) return;

    const unitsPerBox = Math.max(1, Math.round(item.unitsPerBox || totalQty));
    const grossWtPerBox = Number(Number(item.grossWeightPerBox || 15.00).toFixed(2));

    let remainingQty = totalQty;
    if (!item.assignedBoxNo) {
      while (reservedBoxNos.has(currentCartonNo)) {
        currentCartonNo++;
      }
    }
    let boxNum = item.assignedBoxNo ? item.assignedBoxNo : currentCartonNo;

    while (remainingQty > 0) {
      const boxQty = Math.min(unitsPerBox, remainingQty);
      // For a full box (e.g. 200/200), weight is exactly grossWtPerBox (e.g. 18.00 kg)
      // For a partial remainder box (e.g. 50/200), weight is proportional
      const boxWt = boxQty === unitsPerBox 
        ? grossWtPerBox 
        : Number(((boxQty / unitsPerBox) * grossWtPerBox).toFixed(2));

      // If a carton with this boxNum already exists (from another item sharing it)
      const existingCartonIndex = cartons.findIndex(c => c.cartonNo === boxNum);
      if (existingCartonIndex !== -1 && item.assignedBoxNo) {
        // Append item to existing carton
        const existingCarton = cartons[existingCartonIndex];
        existingCarton.items.push({
          id: `item-${boxNum}-${item.slNo}-${remainingQty}`,
          sourceItemSlNo: item.slNo,
          slNo: existingCarton.items.length + 1,
          rawName: item.rawItemName,
          cleanName: item.cleanItemName,
          qty: boxQty,
          weightKg: boxWt,
          isPromoOrNonStock: false
        });
        existingCarton.totalQty += boxQty;
        existingCarton.grossWeightKg = Number((existingCarton.grossWeightKg + boxWt).toFixed(2));
        existingCarton.isMixed = true;
      } else {
        // Create new carton
        cartons.push({
          id: `carton-${boxNum}-${item.slNo}-${remainingQty}`,
          cartonNo: boxNum,
          shippingMark: soData.shippingMark,
          piNumber: soData.piNumber,
          partyName: soData.partyName,
          items: [{
            id: `item-${boxNum}-${item.slNo}`,
            sourceItemSlNo: item.slNo,
            slNo: 1,
            rawName: item.rawItemName,
            cleanName: item.cleanItemName,
            qty: boxQty,
            weightKg: boxWt,
            isPromoOrNonStock: false
          }],
          totalQty: boxQty,
          grossWeightKg: boxWt,
          isMixed: false
        });
      }

      if (!item.assignedBoxNo) {
        currentCartonNo++;
        while (reservedBoxNos.has(currentCartonNo)) {
          currentCartonNo++;
        }
        boxNum = currentCartonNo;
      } else {
        boxNum++;
        if (boxNum > currentCartonNo) {
          currentCartonNo = boxNum;
        }
      }

      remainingQty -= boxQty;
    }
  });

  // Pack explicit mixed tool groups
  Object.entries(explicitMixedGroups).forEach(([cNoStr, groupItems]) => {
    let assignedNo = parseInt(cNoStr, 10);
    if (isNaN(assignedNo) || assignedNo < currentCartonNo) {
      assignedNo = currentCartonNo++;
    } else if (assignedNo >= currentCartonNo) {
      currentCartonNo = assignedNo + 1;
    }

    const combinedWeight = Number(
      Number(groupItems[0]?.mixedCartonGrossWeight || groupItems[0]?.grossWeightPerBox || 15.00).toFixed(2)
    );

    const cartonItems: CartonItem[] = groupItems.map((gi, idx) => {
      const itemQty = typeof gi.dispatchQty === 'number' ? Math.round(gi.dispatchQty) : Math.round(gi.orderedQty);
      return {
        id: `item-${assignedNo}-${gi.slNo}`,
        sourceItemSlNo: gi.slNo,
        slNo: idx + 1,
        rawName: gi.rawItemName,
        cleanName: gi.cleanItemName,
        qty: itemQty,
        weightKg: Number((combinedWeight / groupItems.length).toFixed(2)),
        isPromoOrNonStock: false
      };
    });

    const totalQty = cartonItems.reduce((acc, ci) => acc + ci.qty, 0);

    cartons.push({
      id: `carton-${assignedNo}-mixed-tools`,
      cartonNo: assignedNo,
      shippingMark: soData.shippingMark,
      piNumber: soData.piNumber,
      partyName: soData.partyName,
      items: cartonItems,
      totalQty,
      grossWeightKg: combinedWeight,
      isMixed: true
    });
  });

  // 5. PROCESS PROMO / NON-STOCK ITEMS (ALWAYS PACKED AT THE VERY BOTTOM / LAST BOX)
  if (promoItems.length > 0) {
    // Determine the highest carton number so far
    const maxToolCartonNo = cartons.reduce((max, c) => Math.max(max, c.cartonNo), 0);
    const lastCartonNo = Math.max(maxToolCartonNo + 1, currentCartonNo);

    // Filter promo items selected for packing into the last box
    const selectedForLast = promoItems.filter(p => p.selectedForLastBox !== false);
    const notSelectedForLast = promoItems.filter(p => p.selectedForLastBox === false);

    // Group all selected promo items into ONE single final carton (The Last Box)
    if (selectedForLast.length > 0) {
      const promoWeight = Number(Number(selectedForLast[0]?.mixedCartonGrossWeight || 6.50).toFixed(2));
      const cartonItems: CartonItem[] = selectedForLast.map((pi, idx) => {
        const itemQty = typeof pi.dispatchQty === 'number' ? Math.round(pi.dispatchQty) : Math.round(pi.orderedQty);
        return {
          id: `item-lastbox-${pi.slNo}`,
          sourceItemSlNo: pi.slNo,
          slNo: idx + 1,
          rawName: pi.rawItemName,
          cleanName: pi.cleanItemName,
          qty: itemQty,
          weightKg: Number((promoWeight / selectedForLast.length).toFixed(2)),
          isPromoOrNonStock: true
        };
      });

      const totalQty = cartonItems.reduce((acc, ci) => acc + ci.qty, 0);

      cartons.push({
        id: `carton-${lastCartonNo}-lastbox-promo`,
        cartonNo: lastCartonNo,
        shippingMark: soData.shippingMark,
        piNumber: soData.piNumber,
        partyName: soData.partyName,
        items: cartonItems,
        totalQty,
        grossWeightKg: promoWeight,
        isMixed: true
      });
    }

    // Any individual non-stock items not in the combined last box
    let extraCartonNo = lastCartonNo + 1;
    notSelectedForLast.forEach(pi => {
      const itemQty = typeof pi.dispatchQty === 'number' ? Math.round(pi.dispatchQty) : Math.round(pi.orderedQty);
      const wt = Number((pi.grossWeightPerBox || 2.50).toFixed(2));
      const cNo = pi.assignedBoxNo || extraCartonNo++;

      cartons.push({
        id: `carton-${cNo}-single-promo-${pi.slNo}`,
        cartonNo: cNo,
        shippingMark: soData.shippingMark,
        piNumber: soData.piNumber,
        partyName: soData.partyName,
        items: [{
          id: `item-${cNo}-${pi.slNo}`,
          sourceItemSlNo: pi.slNo,
          slNo: 1,
          rawName: pi.rawItemName,
          cleanName: pi.cleanItemName,
          qty: itemQty,
          weightKg: wt,
          isPromoOrNonStock: true
        }],
        totalQty: itemQty,
        grossWeightKg: wt,
        isMixed: false
      });
    });
  }

  // Sort cartons sequentially by cartonNo so tools are first and promo box is at the VERY BOTTOM
  cartons.sort((a, b) => a.cartonNo - b.cartonNo);

  const totalBoxes = cartons.length;
  const totalGrossWeight = Number(cartons.reduce((acc, c) => acc + c.grossWeightKg, 0).toFixed(2));
  const totalUnits = cartons.reduce((acc, c) => acc + c.totalQty, 0);

  return {
    partyName: soData.partyName,
    piNumber: soData.piNumber,
    orderDate: soData.orderDate,
    shippingMark: soData.shippingMark,
    cartons,
    totalBoxes,
    totalGrossWeight,
    totalUnits
  };
};

// Export Packaging List to Excel (.xlsx) matching Packaging list.xlsx format
export const exportPackagingListToExcel = (summary: PackingListSummary): void => {
  const wb = XLSX.utils.book_new();

  // Layout matching Packaging list.xlsx:
  // Row 1: Party Name : | <PARTY NAME> | PI : | <PI NO>
  // Row 2: empty
  // Row 3: Carton No. | Item Name | Qty | Gross Wt.
  // Row 4+: Carton rows (Carton No. & Gross Wt. displayed on first row of mixed carton)
  // Footer: Total | Gross Wt. Sum
  // Footer: <Total> BOX
  const sheetData: any[][] = [];

  sheetData.push([
    'Party Name :',
    summary.partyName.toUpperCase(),
    'PI :',
    Number(summary.piNumber) || summary.piNumber
  ]);
  sheetData.push([]); // blank row 2
  sheetData.push(['Carton No.', 'Item Name', 'Qty', 'Gross Wt.']);

  summary.cartons.forEach(carton => {
    if (carton.items.length === 1) {
      sheetData.push([
        carton.cartonNo,
        carton.items[0].cleanName,
        carton.items[0].qty,
        carton.grossWeightKg
      ]);
    } else {
      // Mixed carton: first item row has Carton No. and Gross Wt., others have null
      carton.items.forEach((item, idx) => {
        if (idx === 0) {
          sheetData.push([
            carton.cartonNo,
            item.cleanName,
            item.qty,
            carton.grossWeightKg
          ]);
        } else {
          sheetData.push([
            null,
            item.cleanName,
            item.qty,
            null
          ]);
        }
      });
    }
  });

  // Footer rows
  sheetData.push(['Total', null, null, summary.totalGrossWeight]);
  sheetData.push([null, null, null, `${summary.totalBoxes} BOX`]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  // Column widths matching Packaging list.xlsx
  ws['!cols'] = [
    { wch: 14 },
    { wch: 36 },
    { wch: 10 },
    { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const fileName = `Packaging_List_PI_${summary.piNumber}_${summary.partyName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// Export Box Labels to Excel (.xlsx) matching LABELS.xlsx format (1 Label Card per Carton)
export const exportLabelsToExcel = (summary: PackingListSummary): void => {
  const wb = XLSX.utils.book_new();

  // We can create a master "All Labels" sheet where each carton label is stacked cleanly
  // with exact 5-row blocks matching LABELS.xlsx:
  // Row 1: Carton# | Shipping Mark | | PI#
  // Row 2: <Carton No.> | <Shipping Mark> | | <PI#>
  // Row 3: S# | Product/Size | Quantity (Nos) | Weight (Kg)
  // Row 4+: 1 | <Item Name> | <Qty> | <Weight>
  // Row 5: | Total | <Total Qty> | <Carton Wt>
  const masterSheetData: any[][] = [];

  summary.cartons.forEach((carton, idx) => {
    if (idx > 0) {
      masterSheetData.push([]); // blank separator row between labels
    }

    masterSheetData.push(['Carton#', 'Shipping Mark', null, 'PI#']);
    masterSheetData.push([
      String(carton.cartonNo),
      carton.shippingMark,
      null,
      Number(carton.piNumber) || carton.piNumber
    ]);
    masterSheetData.push(['S#', 'Product/Size', 'Quantity (Nos)', 'Weight (Kg)']);

    carton.items.forEach(item => {
      masterSheetData.push([
        item.slNo,
        item.cleanName,
        item.qty,
        item.weightKg
      ]);
    });

    masterSheetData.push([
      null,
      'Total',
      carton.totalQty,
      carton.grossWeightKg
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(masterSheetData);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 32 },
    { wch: 18 },
    { wch: 16 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'All Labels');
  const fileName = `Carton_Labels_PI_${summary.piNumber}_(${summary.totalBoxes}_BOXES).xlsx`;
  XLSX.writeFile(wb, fileName);
};
