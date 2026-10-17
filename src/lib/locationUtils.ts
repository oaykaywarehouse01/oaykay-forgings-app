import { WarehouseLocation, LocationType } from '../types/inventory';

/**
 * Detects legacy mock location codes synthesized in initial scripts (e.g. M-12-6, N-05-3, T-20-2)
 */
export const isMockLocationCode = (input: string | null | undefined): boolean => {
  if (!input) return false;
  return /^[MNT]-\d{2}-\d+$/i.test(String(input).trim());
};

/**
 * Normalizes user or excel location string into standard Oaykay format:
 * - "a1", "a 1", "A-1", "A 1", "A1 - Steel Rack A — Shelf 1 (Bottom)" -> "A1"
 * - "h4", "H-4", "h 4", "Floor Pallet Line H — Pallet Position 4", "Pallet H4" -> "H4"
 * - "bin 5", "bin-05", "Bin 5", "BIN05", "Small Parts Storage Bin #5" -> "BIN-5"
 */
export const normalizeLocationCode = (input: string | null | undefined): string => {
  if (!input) return '';
  const raw = String(input).trim();
  if (!raw) return '';

  // If input matches legacy mock pattern (e.g. M-12-6, N-05-3, T-20-2), treat as unassigned
  if (isMockLocationCode(raw)) {
    return '';
  }

  const cleaned = raw.toUpperCase().trim();

  // 1. Direct match for Rack or Pallet: e.g. "A1", "A 1", "A-1", "H4", "H-4", "A1 - Steel Rack"
  const directMatch = cleaned.match(/^([A-P])[\s-_]*0*([1-9])\b/i);
  if (directMatch) {
    const letter = directMatch[1].toUpperCase();
    const num = parseInt(directMatch[2], 10);
    return `${letter}${num}`;
  }

  // 2. Match BIN patterns: e.g. BIN-1, BIN 1, BIN01, BIN-01, Bin #5, Small Parts Storage Bin #5
  const binMatch = cleaned.match(/(?:BIN|STORAGE\s*BIN)[\s-_#]*0*(\d+)\b/i);
  if (binMatch) {
    return `BIN-${parseInt(binMatch[1], 10)}`;
  }

  // 3. Descriptive Rack Match: e.g. "Steel Rack A — Shelf 1", "Rack A Shelf 2", "Steel Rack B"
  const descRackMatch = cleaned.match(/(?:STEEL\s*)?RACK[\s-_]*([A-G])[\s-_]*(?:SHELF[\s-_]*)?0*([1-9])\b/i);
  if (descRackMatch) {
    return `${descRackMatch[1].toUpperCase()}${parseInt(descRackMatch[2], 10)}`;
  }

  // 4. Descriptive Pallet Match: e.g. "Floor Pallet Line H — Pallet Position 4", "Pallet Line I 2"
  const descPalletMatch = cleaned.match(/(?:FLOOR\s*)?PALLET[\s-_]*(?:LINE\s*)?([H-P])[\s-_]*(?:(?:PALLET\s*)?POSITION[\s-_]*)?0*([1-9])\b/i);
  if (descPalletMatch) {
    return `${descPalletMatch[1].toUpperCase()}${parseInt(descPalletMatch[2], 10)}`;
  }

  // 5. Match custom 2-letter racks: e.g. "AA 2", "AA-2"
  const doubleLetterMatch = cleaned.match(/^([A-Z]{2})[\s-_]*0*(\d+)\b/i);
  if (doubleLetterMatch) {
    return `${doubleLetterMatch[1].toUpperCase()}${parseInt(doubleLetterMatch[2], 10)}`;
  }

  // 6. If contains separator " - " or " — ", try resolving the first token
  if (cleaned.includes(' - ') || cleaned.includes(' — ')) {
    const firstToken = cleaned.split(/\s*[-—]\s*/)[0];
    const candidate = normalizeLocationCode(firstToken);
    if (candidate) return candidate;
  }

  return cleaned.replace(/\s+/g, '-');
};

/**
 * Returns human-readable physical warehouse description for any location code
 * e.g. A1 -> "Steel Rack A — Shelf 1 (Bottom)"
 *      H4 -> "Floor Pallet Line H — Pallet Position 4"
 *      BIN-5 -> "Small Parts Storage Bin #5"
 */
export const getLocationDescription = (code: string | null | undefined, customDesc?: string): string => {
  if (!code) return '';
  if (customDesc && customDesc.trim() && !customDesc.toLowerCase().startsWith('location ') && customDesc !== code) {
    return customDesc.trim();
  }
  const norm = normalizeLocationCode(code);
  
  // Steel Racks: A1 to G3
  const rackMatch = norm.match(/^([A-G])(\d+)$/);
  if (rackMatch) {
    const rack = rackMatch[1];
    const shelf = parseInt(rackMatch[2], 10);
    const pos = shelf === 1 ? 'Bottom' : shelf === 2 ? 'Middle' : shelf === 3 ? 'Top' : `Level ${shelf}`;
    return `Steel Rack ${rack} — Shelf ${shelf} (${pos})`;
  }

  // Pallet Lines: H1 to P6
  const palletMatch = norm.match(/^([H-P])(\d+)$/);
  if (palletMatch) {
    const line = palletMatch[1];
    const pos = parseInt(palletMatch[2], 10);
    return `Floor Pallet Line ${line} — Pallet Position ${pos}`;
  }

  // Bins: BIN-1 to BIN-50
  const binMatch = norm.match(/^BIN-(\d+)$/);
  if (binMatch) {
    return `Small Parts Storage Bin #${binMatch[1]}`;
  }

  return customDesc?.trim() || `Warehouse Location ${norm}`;
};

/**
 * Returns Zone category (e.g. "Rack A", "Pallet Line H", "Storage Bins")
 */
export const getLocationZone = (code: string | null | undefined): string => {
  if (!code) return '';
  const norm = normalizeLocationCode(code);
  if (norm.match(/^[A-G]/)) return `Rack ${norm.charAt(0)}`;
  if (norm.match(/^[H-P]/)) return `Pallet Line ${norm.charAt(0)}`;
  if (norm.startsWith('BIN')) return 'Storage Bins';
  return 'Floor Storage';
};

/**
 * Pre-seeds the exact Oaykay warehouse architecture:
 * 1. Steel Racks: A to G (3 shelves each: A1, A2, A3 ... G1, G2, G3) = 21 locations
 * 2. Pallet Lines: H to P (6 pallets each: H1..H6 ... P1..P6) = 54 locations
 * 3. Storage Bins: BIN-1 to BIN-30 = 30 locations
 * Total = 105 standard warehouse locations
 */
export const generateInitialWarehouseLocations = (): WarehouseLocation[] => {
  const locations: WarehouseLocation[] = [];

  // 1. Steel Racks A to G (3 shelves each)
  const rackLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  rackLetters.forEach(rack => {
    for (let shelf = 1; shelf <= 3; shelf++) {
      locations.push({
        code: `${rack}${shelf}`,
        type: 'RACK',
        zone: `Rack ${rack}`,
        shelfOrIndex: shelf,
        description: `Steel Rack ${rack} — Shelf ${shelf} (${shelf === 1 ? 'Bottom' : shelf === 2 ? 'Middle' : 'Top'})`
      });
    }
  });

  // 2. Horizontal Pallet Lines H to P (6 pallets each)
  const palletLines = ['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
  palletLines.forEach(line => {
    for (let pos = 1; pos <= 6; pos++) {
      locations.push({
        code: `${line}${pos}`,
        type: 'PALLET',
        zone: `Pallet Line ${line}`,
        shelfOrIndex: pos,
        description: `Floor Pallet Line ${line} — Pallet Position ${pos}`
      });
    }
  });

  // 3. Storage Bins BIN-1 to BIN-30
  for (let b = 1; b <= 30; b++) {
    locations.push({
      code: `BIN-${b}`,
      type: 'BIN',
      zone: 'Storage Bins',
      shelfOrIndex: b,
      description: `Small Parts Storage Bin #${b}`
    });
  }

  return locations;
};

/**
 * Helper to generate locations for a new Steel Rack (e.g. Rack AA with 3 shelves)
 */
export const createNewSteelRackLocations = (
  rackCode: string, 
  shelfCount: number = 3
): WarehouseLocation[] => {
  const cleanCode = rackCode.trim().toUpperCase().replace(/[^A-Z]/g, '');
  const count = Math.max(1, Math.min(10, shelfCount));
  const newLocs: WarehouseLocation[] = [];
  
  for (let s = 1; s <= count; s++) {
    newLocs.push({
      code: `${cleanCode}${s}`,
      type: 'RACK',
      zone: `Rack ${cleanCode}`,
      shelfOrIndex: s,
      description: `Steel Rack ${cleanCode} — Shelf ${s}`
    });
  }
  return newLocs;
};

/**
 * Helper to generate locations for a new Pallet Line (e.g. Line Q with 6 pallets)
 */
export const createNewPalletLineLocations = (
  lineCode: string, 
  palletCount: number = 6
): WarehouseLocation[] => {
  const cleanCode = lineCode.trim().toUpperCase().replace(/[^A-Z]/g, '');
  const count = Math.max(1, Math.min(20, palletCount));
  const newLocs: WarehouseLocation[] = [];

  for (let p = 1; p <= count; p++) {
    newLocs.push({
      code: `${cleanCode}${p}`,
      type: 'PALLET',
      zone: `Pallet Line ${cleanCode}`,
      shelfOrIndex: p,
      description: `Floor Pallet Line ${cleanCode} — Position ${p}`
    });
  }
  return newLocs;
};

/**
 * Helper to generate a range of Storage Bins (e.g. BIN-31 to BIN-50)
 */
export const createNewBinRange = (startBin: number, endBin: number): WarehouseLocation[] => {
  const start = Math.max(1, Math.min(startBin, endBin));
  const end = Math.max(start, Math.max(startBin, endBin));
  const newLocs: WarehouseLocation[] = [];

  for (let b = start; b <= end; b++) {
    newLocs.push({
      code: `BIN-${b}`,
      type: 'BIN',
      zone: 'Storage Bins',
      shelfOrIndex: b,
      description: `Small Parts Storage Bin #${b}`
    });
  }
  return newLocs;
};
