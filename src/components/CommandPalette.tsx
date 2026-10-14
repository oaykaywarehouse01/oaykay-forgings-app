import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Calendar, 
  Layers, 
  ChevronRight, 
  ArrowRight, 
  Tag, 
  Package, 
  Hash, 
  SlidersHorizontal,
  Clock,
  Sparkles
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { SkuItem } from '../types/inventory';
import { SearchMatch } from '../lib/searchEngine';

export const CommandPalette: React.FC = () => {
  const { 
    isCommandPaletteOpen, 
    setCommandPaletteOpen, 
    searchEngine, 
    setSelectedSku, 
    setDrillDown,
    setActiveModule,
    skus 
  } = useInventoryStore();

  const [query, setQuery] = useState('');
  const [filterDivision, setFilterDivision] = useState<string>('ALL');
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchTimeMs, setSearchTimeMs] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isCommandPaletteOpen]);

  // Execute search with latency measurement
  useEffect(() => {
    const t0 = performance.now();
    const matches = searchEngine.search(query, {
      division: filterDivision,
      limit: 60
    });
    const t1 = performance.now();
    setSearchTimeMs(Math.round((t1 - t0) * 100) / 100);
    setResults(matches);
    setSelectedIndex(0);
  }, [query, filterDivision, searchEngine]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle palette on Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
        return;
      }

      if (!isCommandPaletteOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setCommandPaletteOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        // Auto scroll
        ensureVisible(selectedIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        ensureVisible(selectedIndex - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelectSku(results[selectedIndex].item);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, results, selectedIndex]);

  const ensureVisible = (idx: number) => {
    if (!listRef.current) return;
    const elements = listRef.current.querySelectorAll('[data-result-item]');
    if (elements[idx]) {
      elements[idx].scrollIntoView({ block: 'nearest' });
    }
  };

  const handleSelectSku = (sku: SkuItem) => {
    setSelectedSku(sku);
    setCommandPaletteOpen(false);
  };

  const handleDrillToCategory = (sku: SkuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveModule('stock-master');
    setDrillDown({
      level: 4,
      segment: 'Domestic',
      division: sku.division,
      mainCategory: sku.main_category,
      subCategory: sku.sub_category,
      productGroup: sku.product_group
    });
    setCommandPaletteOpen(false);
  };

  if (!isCommandPaletteOpen) return null;

  // Highlight matches helper
  const renderHighlighted = (text: string, matchedTokens: string[]) => {
    if (!query.trim() || matchedTokens.length === 0) return text;
    // Simple regex escape
    const escaped = matchedTokens
      .filter(t => t.length > 1)
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    if (!escaped) return text;

    try {
      const regex = new RegExp(`(${escaped})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="highlight">{part}</mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-14 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-slate-200 px-4 dark:border-slate-800">
          <Search className="h-5 w-5 text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by part name, SKU, dimension (e.g. 19mm, 1/2x18, 4 inch), synonym ('spa', 'doe', 'sd'), W/off..."
            className="h-14 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden dark:text-white"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Pills + Latency Metric */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs dark:border-slate-800/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center gap-1">
              <SlidersHorizontal className="h-3 w-3" />
              <span>Division:</span>
            </span>
            {(['ALL', 'DIM', 'DIN', 'DTR'] as const).map(div => (
              <button
                key={div}
                onClick={() => setFilterDivision(div)}
                className={`rounded-md px-2 py-0.5 text-xs font-semibold transition ${
                  filterDivision === div
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                {div}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0 font-mono">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3 w-3" />
              <span>{searchTimeMs}ms</span>
            </span>
            <span>•</span>
            <span>{results.length} results</span>
          </div>
        </div>

        {/* Search Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                No matching tools or SKUs found
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Try searching tool shorthands like <code className="font-mono text-orange-600">spa</code>, <code className="font-mono text-orange-600">com</code>, <code className="font-mono text-orange-600">crv</code>, or dimensions like <code className="font-mono text-orange-600">19mm</code> or <code className="font-mono text-orange-600">12x100</code>
              </p>
            </div>
          ) : (
            results.map((match, idx) => {
              const item = match.item;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={item.id}
                  data-result-item
                  onClick={() => handleSelectSku(item)}
                  className={`group flex items-start justify-between rounded-xl p-3 text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-orange-50 border border-orange-200/80 dark:bg-orange-950/30 dark:border-orange-800/60'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    {/* Top Row: Division Badge, SKU Code, Monospace Size, Pack Type */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold font-mono ${
                        item.division === 'DIM'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                          : item.division === 'DIN'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                      }`}>
                        {item.division}
                      </span>

                      <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {item.sku_code}
                      </span>

                      {item.size_spec && item.size_spec !== 'Standard' && (
                        <span className="font-mono text-[11px] font-medium text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded dark:bg-slate-800 dark:text-slate-300">
                          {item.size_spec}
                        </span>
                      )}

                      {item.material_and_tier && item.material_and_tier !== 'Standard' && (
                        <span className="text-[10px] font-medium text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded dark:bg-purple-950 dark:text-purple-300">
                          {item.material_and_tier}
                        </span>
                      )}

                      {item.last_write_off_date && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded dark:bg-indigo-950 dark:text-indigo-300">
                          <Calendar className="h-2.5 w-2.5" />
                          <span>W/Off: {item.last_write_off_date}</span>
                        </span>
                      )}
                    </div>

                    {/* Part Name */}
                    <h4 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {renderHighlighted(item.clean_name, match.matchedTokens)}
                    </h4>

                    {/* Category Breadcrumbs (Clickable to jump directly to drill-down) */}
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 truncate">
                      <button
                        onClick={(e) => handleDrillToCategory(item, e)}
                        className="hover:text-orange-600 hover:underline flex items-center gap-1 transition"
                      >
                        <Layers className="h-3 w-3" />
                        <span>{item.main_category}</span>
                        <ChevronRight className="h-3 w-3 text-slate-300" />
                        <span>{item.sub_category}</span>
                      </button>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-slate-500 font-mono text-[10px]">Row #{item.excel_row}</span>
                    </div>
                  </div>

                  {/* Right: Stock Quantity + Status Pill */}
                  <div className="flex flex-col items-end shrink-0 pl-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono text-sm font-bold tabular-nums ${
                        item.current_stock < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'
                      }`}>
                        {item.current_stock.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">{item.unit}</span>
                    </div>

                    <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      item.current_stock > 0
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : item.current_stock === 0
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        item.current_stock > 0 ? 'bg-emerald-500' : item.current_stock === 0 ? 'bg-amber-400' : 'bg-rose-500'
                      }`} />
                      <span>{item.current_stock > 0 ? 'In Stock' : item.current_stock === 0 ? 'Zero Stock' : 'Negative'}</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400">
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px] shadow-xs dark:border-slate-700 dark:bg-slate-800">↑</kbd>
              <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px] shadow-xs dark:border-slate-700 dark:bg-slate-800">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px] shadow-xs dark:border-slate-700 dark:bg-slate-800">↵</kbd>
              <span>to inspect</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px] shadow-xs dark:border-slate-700 dark:bg-slate-800">esc</kbd>
              <span>to close</span>
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            Oaykay Multi-Token Search Engine
          </div>
        </div>
      </div>
    </div>
  );
};
