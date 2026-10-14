import { SkuItem } from '../types/inventory';

// Industry tool synonyms map (bidirectional)
const SYNONYMS: Record<string, string[]> = {
  spa: ['spanner', 'spanners'],
  spanner: ['spa', 'spanners'],
  spanners: ['spa', 'spanner'],
  com: ['combination'],
  combination: ['com'],
  doe: ['double open end', 'double open jaw'],
  sd: ['screwdriver', 'screw driver'],
  screwdriver: ['sd', 'screw driver'],
  pta: ['power tool accessories', 'cutting wheel', 'diamond blade', 'flap disc', 'sds', 'tct', 'blade'],
  rachet: ['ratchet'],
  ratchet: ['rachet'],
  ellept: ['elliptical'],
  elliptical: ['ellept'],
  trolly: ['trolley'],
  trolley: ['trolly'],
  crv: ['chrome vanadium'],
  crmo: ['chrome molybdenum'],
  hss: ['high speed steel'],
  s2: ['s2 steel'],
  woff: ['write-off', 'writeoff', 'audit'],
  writeoff: ['woff', 'write-off'],
};

// 1-character Levenshtein distance check for fuzzy matching
function isLevenshtein1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length < 4 || b.length < 4) return a === b;

  let diffs = 0;
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] !== b[j]) {
      diffs++;
      if (diffs > 1) return false;
      if (a.length > b.length) {
        i++;
      } else if (b.length > a.length) {
        j++;
      } else {
        i++;
        j++;
      }
    } else {
      i++;
      j++;
    }
  }

  return true;
}

// Normalize dimension units and tokens
export function normalizeDimensionText(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/''/g, '"')
    .replace(/\b(\d+)\s*(?:inch|inches|in)\b/gi, '$1"')
    .replace(/\b0+(\d+)(mm|cm|")/gi, '$1$2') // 08mm -> 8mm
    .replace(/\b0+(\d+)\b/g, '$1'); // 04 -> 4
}

// Tokenize text into normalized tokens including compound dimension breakdown
export function tokenizeQuery(query: string): string[] {
  const norm = normalizeDimensionText(query);
  const rawTokens = norm.split(/[\s,\-_/]+/).filter(t => t.length > 0);
  const expandedTokens: string[] = [];

  for (const t of rawTokens) {
    expandedTokens.push(t);

    // Expand compound dimensions like 12x100x160 or 6x7 or 1/2x9/16
    if (t.includes('x') || t.includes('*')) {
      const subParts = t.split(/[x*]/).filter(p => p.length > 0);
      for (const p of subParts) {
        if (p) expandedTokens.push(p);
      }
    }

    // Expand mm/inch attachment: "19mm" -> "19", "4\"" -> "4"
    const numUnitMatch = t.match(/^(\d+(?:\.\d+)?)(mm|cm|")$/);
    if (numUnitMatch) {
      expandedTokens.push(numUnitMatch[1]);
      expandedTokens.push(numUnitMatch[2]);
    }

    // Expand synonyms
    if (SYNONYMS[t]) {
      for (const syn of SYNONYMS[t]) {
        for (const subSyn of syn.split(' ')) {
          if (!expandedTokens.includes(subSyn)) {
            expandedTokens.push(subSyn);
          }
        }
      }
    }
  }

  return Array.from(new Set(expandedTokens));
}

export interface SearchMatch {
  item: SkuItem;
  score: number;
  matchedTokens: string[];
}

export class InventorySearchEngine {
  private skus: SkuItem[] = [];
  private indexedSkus: Array<{
    item: SkuItem;
    searchableString: string;
    tokens: Set<string>;
    numbers: Set<string>;
    hasWriteOff: boolean;
  }> = [];

  constructor(skus: SkuItem[]) {
    this.updateData(skus);
  }

  public updateData(skus: SkuItem[]) {
    this.skus = skus;
    this.indexedSkus = skus.map(item => {
      const fullText = [
        item.sku_code,
        item.clean_name,
        item.original_tally_name,
        item.division,
        item.main_category,
        item.sub_category,
        item.product_group,
        item.size_spec,
        item.material_and_tier,
        item.pack_type,
        (item as any).group_id || '',
        item.last_write_off_date || '',
        item.write_off_source_header || '',
        item.location_bin,
        item.status
      ].join(' ');

      const normText = normalizeDimensionText(fullText);
      const words = normText.split(/[\s,\-_/]+/).filter(w => w.length > 0);
      
      const tokens = new Set<string>();
      const numbers = new Set<string>();

      for (const w of words) {
        tokens.add(w);
        // check numeric
        const numOnly = w.replace(/[^\d.]/g, '');
        if (numOnly) numbers.add(numOnly);

        // compound dimensions: 12x100x160
        if (w.includes('x') || w.includes('*')) {
          w.split(/[x*]/).forEach(part => {
            const cleanPart = part.trim();
            if (cleanPart) {
              tokens.add(cleanPart);
              const subNum = cleanPart.replace(/[^\d.]/g, '');
              if (subNum) numbers.add(subNum);
            }
          });
        }
      }

      return {
        item,
        searchableString: normText,
        tokens,
        numbers,
        hasWriteOff: Boolean(item.last_write_off_date)
      };
    });
  }

  public search(query: string, options?: { division?: string; status?: string; limit?: number }): SearchMatch[] {
    const trimmed = query.trim();
    if (!trimmed) {
      let filtered = this.skus;
      if (options?.division && options.division !== 'ALL') {
        filtered = filtered.filter(s => s.division === options.division);
      }
      if (options?.status && options.status !== 'ALL') {
        filtered = filtered.filter(s => s.status === options.status);
      }
      const limit = options?.limit || 100;
      return filtered.slice(0, limit).map(item => ({
        item,
        score: 1,
        matchedTokens: []
      }));
    }

    const queryTokens = tokenizeQuery(trimmed);
    const results: SearchMatch[] = [];
    const limit = options?.limit || 100;

    for (const record of this.indexedSkus) {
      const item = record.item;

      // Division filter
      if (options?.division && options.division !== 'ALL' && item.division !== options.division) {
        continue;
      }
      // Status filter
      if (options?.status && options.status !== 'ALL' && item.status !== options.status) {
        continue;
      }

      let score = 0;
      let matchedCount = 0;
      const matchedTokens: string[] = [];

      for (const qToken of queryTokens) {
        // Special case: "woff" or "writeoff"
        if ((qToken === 'woff' || qToken === 'writeoff') && record.hasWriteOff) {
          score += 15;
          matchedCount++;
          matchedTokens.push('write-off');
          continue;
        }

        // Direct token exact match
        if (record.tokens.has(qToken)) {
          score += 10;
          matchedCount++;
          matchedTokens.push(qToken);
          continue;
        }

        // Exact SKU Code match
        if (item.sku_code.toLowerCase().includes(qToken)) {
          score += 25;
          matchedCount++;
          matchedTokens.push(qToken);
          continue;
        }

        // Number match (e.g. "19" in "19mm")
        if (record.numbers.has(qToken)) {
          score += 8;
          matchedCount++;
          matchedTokens.push(qToken);
          continue;
        }

        // Prefix match
        let prefixFound = false;
        for (const token of record.tokens) {
          if (token.startsWith(qToken) && qToken.length >= 2) {
            score += 5;
            matchedCount++;
            matchedTokens.push(qToken);
            prefixFound = true;
            break;
          }
        }
        if (prefixFound) continue;

        // Substring inside searchable string
        if (record.searchableString.includes(qToken)) {
          score += 4;
          matchedCount++;
          matchedTokens.push(qToken);
          continue;
        }

        // Fuzzy 1-edit Levenshtein match for words >= 4 chars
        if (qToken.length >= 4) {
          let fuzzyFound = false;
          for (const token of record.tokens) {
            if (token.length >= 4 && isLevenshtein1(qToken, token)) {
              score += 3;
              matchedCount++;
              matchedTokens.push(token);
              fuzzyFound = true;
              break;
            }
          }
          if (fuzzyFound) continue;
        }
      }

      // Check if primary query terms were matched
      // Require at least 50% of distinct user query terms to match
      const userTerms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
      const userMatchedCount = userTerms.filter(ut => 
        record.searchableString.includes(ut) || 
        record.tokens.has(ut) || 
        record.numbers.has(ut) ||
        matchedTokens.some(mt => mt.includes(ut) || ut.includes(mt))
      ).length;

      if (userMatchedCount >= Math.min(userTerms.length, Math.ceil(userTerms.length * 0.6))) {
        // Boost for clean_name match
        if (item.clean_name.toLowerCase().includes(trimmed.toLowerCase())) {
          score += 20;
        }
        // Boost for exact division token match
        if (userTerms.includes(item.division.toLowerCase())) {
          score += 10;
        }

        results.push({
          item,
          score: score + (userMatchedCount * 5),
          matchedTokens: Array.from(new Set(matchedTokens))
        });
      }
    }

    // Sort descending by score, then by excel_row ascending
    results.sort((a, b) => b.score - a.score || a.item.excel_row - b.item.excel_row);

    return results.slice(0, limit);
  }
}
