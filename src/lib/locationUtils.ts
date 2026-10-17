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
 * - "a1", "a 1", "A-1", "A 1" -> "A1"
 * - "h4", "H-4", "h 4" -> "H4"
 * - "bin 5", "bin-05", "Bin 5", "BIN05" -> "BIN-5"
 */
export const normalizeLocationCode = (input: string | null | undefined): string => {
  if (!input) return '';
  const cleaned = String(input).trim().toUpperCase();

  // If input matches legacy mock pattern (e.g. M-12-6, N-05-3, T-20-2), treat as unassigned
  if (isMockLocationCode(cleaned)) {
    return '';
  }

  // Match BIN patterns: e.g. BIN-1, BIN 1, BIN01, BIN-01, B1 (if explicit bin context)
  const binMatch = cleaned.match(/^BIN[\s-_]*0*(\d+)$/i);
  if (binMatch) {
    return `BIN-${parseInt(binMatch[1], 10)}`;
  }

  // Match Steel Rack or Pallet: e.g. "A 1", "A-1", "A1", "H 6", "AA 2"
  const rackPalletMatch = cleaned.match(/^([A-Z]{1,2})[\s-_]*(\d+)$/);
  if (rackPalletMatch) {
    return `${rackPalletMatch[1]}${parseInt(rackPalletMatch[2], 10)}`;
  }

  return cleaned.replace(/\s+/g, '-');
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
