import React, { useState, useMemo } from 'react';
import { 
  Boxes, 
  ChevronRight, 
  Layers, 
  Package, 
  Calendar, 
  Tag, 
  ArrowRight, 
  ArrowLeft,
  Plus, 
  Minus, 
  Filter, 
  Search, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Edit3,
  Factory,
  Globe,
  HardHat,
  FolderTree,
  ChevronDown
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { DivisionCode, SkuItem, CategoryGroup } from '../types/inventory';

export const StockMasterView: React.FC = () => {
  const { 
    drillDown, 
    setDrillDown, 
    navigateToLevel, 
    divisions, 
    categories, 
    skus, 
    stats,
    quickAdjustStock,
    setSelectedSku,
    setStockTransactionModalSku,
    setUpdateWriteOffModalCategory
  } = useInventoryStore();

  // Local filters for Level 4 table
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [materialFilter, setMaterialFilter] = useState<string>('ALL');
  const [packFilter, setPackFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'excel_row' | 'sku_code' | 'clean_name' | 'current_stock'>('excel_row');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Left tree expanded states for Level 3 & 4
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  const toggleCatExpand = (catName: string) => {
    setExpandedCats(prev => ({ ...prev, [catName]: !prev[catName] }));
  };

  // Top-level hooks for Level 3 & 4 (Must be declared before conditional returns)
  const activeDiv = drillDown.division || 'DIM';
  const divInfo = divisions[activeDiv] || divisions['DIM'];

  // Filter categories belonging to active division
  const divCategories = categories.filter(c => c.division === activeDiv);

  // Group by Main Category
  const mainCategoriesMap = useMemo(() => {
    const map: Record<string, CategoryGroup[]> = {};
    divCategories.forEach(c => {
      if (!map[c.main_category]) {
        map[c.main_category] = [];
      }
      map[c.main_category].push(c);
    });
    return map;
  }, [divCategories]);

  const mainCategoryNames = Object.keys(mainCategoriesMap).sort();

  // SKUs in current category selection
  const filteredSkus = useMemo(() => {
    let list = skus.filter(s => s.division === activeDiv);

    if (drillDown.mainCategory) {
      list = list.filter(s => s.main_category === drillDown.mainCategory);
    }

    if (drillDown.subCategory) {
      list = list.filter(s => s.sub_category === drillDown.subCategory);
    }

    if (drillDown.productGroup && drillDown.productGroup !== drillDown.subCategory) {
      list = list.filter(s => s.product_group === drillDown.productGroup);
    }

    // Apply local search in Level 4
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      list = list.filter(s => 
        s.clean_name.toLowerCase().includes(q) ||
        s.sku_code.toLowerCase().includes(q) ||
        s.size_spec.toLowerCase().includes(q) ||
        s.original_tally_name.toLowerCase().includes(q) ||
        (s.last_write_off_date && s.last_write_off_date.includes(q))
      );
    }

    // Apply status filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'Positive') list = list.filter(s => s.current_stock > 0);
      else if (statusFilter === 'Zero Stock') list = list.filter(s => s.current_stock === 0);
      else if (statusFilter === 'Negative') list = list.filter(s => s.current_stock < 0);
    }

    // Apply material filter
    if (materialFilter !== 'ALL') {
      list = list.filter(s => s.material_and_tier.includes(materialFilter));
    }

    // Apply pack type filter
    if (packFilter !== 'ALL') {
      list = list.filter(s => s.pack_type.includes(packFilter));
    }

    // Sort
    list.sort((a, b) => {
      let res = 0;
      if (sortField === 'excel_row') res = a.excel_row - b.excel_row;
      else if (sortField === 'sku_code') res = a.sku_code.localeCompare(b.sku_code);
      else if (sortField === 'clean_name') res = a.clean_name.localeCompare(b.clean_name);
      else if (sortField === 'current_stock') res = a.current_stock - b.current_stock;
      return sortAsc ? res : -res;
    });

    return list;
  }, [skus, activeDiv, drillDown.mainCategory, drillDown.subCategory, drillDown.productGroup, tableSearch, statusFilter, materialFilter, packFilter, sortField, sortAsc]);

  const activeCategoryGroup = categories.find(c => 
    c.division === activeDiv && 
    c.main_category === drillDown.mainCategory &&
    (drillDown.subCategory ? c.sub_category === drillDown.subCategory : true)
  );

  // ==========================================
  // LEVEL 1: SEGMENT SELECTION
  // ==========================================
  if (drillDown.level === 1) {
    return (
      <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
        {/* Hero Summary Ribbon */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                  Finished Goods Master Catalog
                </span>
                <span className="text-xs text-slate-500 font-mono">Tally ERP Closing Stock (10.10.26)</span>
              </div>
              <h1 className="mt-2 text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Oaykay Inventory & Stock Hierarchy
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                100% verified parser mapping across 3 Domestic Divisions, 46 Main Categories, and 168 Sub-Groups with exact physical stock.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => setDrillDown({ level: 2, segment: 'Domestic' })}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-orange-700 active:scale-98"
              >
                <span>Explore Domestic Stock</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Ribbon (NO VALUATION, NO ESTIMATES) */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Total SKUs</span>
              <div className="mt-1 font-mono text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {stats.total_skus.toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-600 font-medium">100% Seeded</span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Physical Stock</span>
              <div className="mt-1 font-mono text-xl font-black text-orange-600 dark:text-orange-400 tabular-nums">
                {stats.total_stock.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500">Total Units on Hand</span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Divisions</span>
              <div className="mt-1 font-mono text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                3
              </div>
              <span className="text-[10px] text-slate-500">DIM, DIN, DTR</span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Main Categories</span>
              <div className="mt-1 font-mono text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {stats.total_main_categories}
              </div>
              <span className="text-[10px] text-slate-500">Industrial Lines</span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Sub-Groups</span>
              <div className="mt-1 font-mono text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {stats.total_sub_groups}
              </div>
              <span className="text-[10px] text-slate-500">Leaf Chains</span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Audited W/Off</span>
              <div className="mt-1 font-mono text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                {stats.total_audited_skus}
              </div>
              <span className="text-[10px] text-indigo-600 font-medium">{Math.round((stats.total_audited_skus / stats.total_skus) * 100)}% Coverage</span>
            </div>
          </div>
        </div>

        {/* Level 1 Segment Cards */}
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4 text-orange-600" />
            <span>Select Catalog Segment</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Primary: Domestic Finished Goods */}
            <div 
              onClick={() => setDrillDown({ level: 2, segment: 'Domestic' })}
              className="group relative flex flex-col justify-between rounded-2xl border-2 border-orange-500/60 bg-gradient-to-br from-white to-orange-50/30 p-6 shadow-sm transition hover:border-orange-500 hover:shadow-md cursor-pointer dark:from-slate-900 dark:to-slate-800/50"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-600 text-white shadow-sm">
                    <Factory className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Active Catalog
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-orange-600 transition-colors">
                    Domestic (FG Domestic Stock)
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Finished goods for domestic distribution across India. Includes imported accessories (DIM), in-house forged tools (DIN), and traded lines (DTR).
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                  <span><strong>1,421</strong> SKUs</span>
                  <span>•</span>
                  <span><strong>3</strong> Divisions</span>
                  <span>•</span>
                  <span><strong>{stats.total_stock.toLocaleString()}</strong> Units</span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between text-xs font-bold text-orange-600 group-hover:translate-x-1 transition-transform">
                <span>Enter Domestic Division Master</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>

            {/* Extensible: Export Segment */}
            <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white/60 p-6 opacity-75 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                    <Globe className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Extensible Hook
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">
                    Export (FG Export Stock)
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Export order dispatches, CE/DIN compliant forged tools, European & US pallet orders, container dispatch batches.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center text-xs text-slate-400 font-medium">
                <span>Ready for Tally Export Sheet Import</span>
              </div>
            </div>

            {/* Extensible: Raw Material & Forging Blanks */}
            <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white/60 p-6 opacity-75 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                    <HardHat className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Extensible Hook
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">
                    Raw Material & Forging Blanks
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Steel billets (31CrV3, EN9, EN19), drop forging die blocks, heat treatment batches, and un-machined tool blanks.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center text-xs text-slate-400 font-medium">
                <span>Ready for ERP Ledger Sync</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // LEVEL 2: 3 DIVISION BENTO CARDS (DIM, DIN, DTR)
  // ==========================================
  if (drillDown.level === 2) {
    const divList: DivisionCode[] = ['DIM', 'DIN', 'DTR'];

    return (
      <div className="space-y-6 p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 uppercase tracking-wider">
              <span>Domestic Segment</span>
              <span>•</span>
              <span>Level 2 Overview</span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
              Domestic Inventory Divisions
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select a division to inspect its Main Categories, Sub-Groups, and Stock Ledger.
            </p>
          </div>

          <button
            onClick={() => navigateToLevel(1)}
            className="flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-100 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 transition"
          >
            <ArrowLeft className="h-4 w-4 text-orange-600" />
            <span>← Back to Segments</span>
          </button>
        </div>

        {/* 3 Large Bento Cards with Exact Quantities (100% Whole Integer) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {divList.map(divCode => {
            const div = divisions[divCode] || { total_skus: 0, total_stock: 0, main_categories_count: 0, sub_groups_count: 0, name: '', tagline: '' };
            const divSkus = skus.filter(s => s.division === divCode);
            const auditedCount = divSkus.filter(s => s.last_write_off_date).length;
            const auditPct = div.total_skus > 0 ? Math.round((auditedCount / div.total_skus) * 100) : 0;

            const catCounts: Record<string, { count: number; stock: number }> = {};
            divSkus.forEach(s => {
              if (!catCounts[s.main_category]) {
                catCounts[s.main_category] = { count: 0, stock: 0 };
              }
              catCounts[s.main_category].count += 1;
              catCounts[s.main_category].stock += Math.round(s.current_stock);
            });
            const topCategories = Object.entries(catCounts)
              .sort((a, b) => b[1].stock - a[1].stock)
              .slice(0, 4);

            let accentBg = 'border-blue-300 hover:border-blue-500';
            let badgeStyle = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
            let barColor = 'bg-blue-600';
            if (divCode === 'DIN') {
              accentBg = 'border-emerald-300 hover:border-emerald-500';
              badgeStyle = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
              barColor = 'bg-emerald-600';
            } else if (divCode === 'DTR') {
              accentBg = 'border-amber-300 hover:border-amber-500';
              badgeStyle = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
              barColor = 'bg-amber-600';
            }

            return (
              <div
                key={divCode}
                onClick={() => setDrillDown({ level: 3, division: divCode })}
                className={`group flex flex-col justify-between rounded-2xl border-2 bg-white p-6 shadow-xs transition hover:shadow-lg cursor-pointer dark:bg-slate-900 ${accentBg}`}
              >
                <div className="space-y-4">
                  {/* Top Bar: Badge & Total Count */}
                  <div className="flex items-center justify-between">
                    <span className={`rounded-md px-2.5 py-1 text-xs font-black font-mono tracking-wider ${badgeStyle}`}>
                      {divCode}
                    </span>
                    <div className="text-right font-mono">
                      <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                        {Math.round(div.total_stock).toLocaleString()} <span className="text-xs text-slate-400 font-normal">Units</span>
                      </div>
                      <span className="text-xs text-slate-500 font-semibold">{div.total_skus} Items</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-orange-600 transition-colors">
                      {div.name}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2">
                      {div.tagline}
                    </p>
                  </div>

                  {/* Audit Progress Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Write-Off Audit Coverage</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {auditedCount} / {div.total_skus} ({auditPct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${auditPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Top Categories by Stock Quantity */}
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Top Categories by Stock ({div.main_categories_count} Total)
                    </span>
                    <div className="mt-2 space-y-1.5">
                      {topCategories.map(([cName, cData]) => (
                        <div key={cName} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-400 truncate max-w-[170px]">{cName}</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300 font-medium tabular-nums">
                            {cData.stock.toLocaleString()} ({cData.count})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-orange-600 group-hover:translate-x-1 transition-transform">
                  <span>Drill Into {divCode} Categories</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // LEVEL 3: CATEGORY CARDS (WITH BIG ← BACK BUTTON)
  // ==========================================
  if (drillDown.level === 3) {
    return (
      <div className="space-y-6 p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
        {/* Header Bar with Big ← Back to Divisions Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 uppercase tracking-wider">
              <span>{activeDiv} Division</span>
              <span>•</span>
              <span>Level 3 Categories</span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className={`inline-flex rounded-lg px-2.5 py-0.5 text-sm font-black font-mono ${
                activeDiv === 'DIM'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : activeDiv === 'DIN'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}>
                {activeDiv}
              </span>
              <span>{divInfo.name}</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Select a category below to open the Items Table, or view all {divInfo.total_skus} items in one master table.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigateToLevel(2)}
              className="flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-100 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 transition"
            >
              <ArrowLeft className="h-4 w-4 text-orange-600" />
              <span>← Back to Divisions</span>
            </button>

            <button
              onClick={() => setDrillDown({ level: 4, mainCategory: null, subCategory: null, productGroup: null })}
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 active:scale-95 transition"
            >
              <Boxes className="h-4 w-4" />
              <span>View All {divInfo.total_skus} {activeDiv} SKUs</span>
            </button>
          </div>
        </div>

        {/* Category Bento Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {mainCategoryNames.map(mainCat => {
            const subGroups = mainCategoriesMap[mainCat] || [];
            const catSkuCount = subGroups.reduce((acc, g) => acc + g.sku_count, 0);
            const catStock = subGroups.reduce((acc, g) => acc + Math.round(g.total_stock), 0);
            const woffDates = Array.from(new Set(subGroups.map(g => g.last_write_off_date).filter(Boolean)));

            return (
              <div
                key={mainCat}
                onClick={() => {
                  setDrillDown({
                    level: 4,
                    mainCategory: mainCat,
                    subCategory: null,
                    productGroup: null
                  });
                }}
                className="group flex flex-col justify-between rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-xs transition hover:border-orange-500 hover:shadow-lg cursor-pointer dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {subGroups.length} Sub-Groups
                    </span>
                    <div className="text-right font-mono">
                      <span className="text-base font-black text-slate-900 dark:text-white tabular-nums">
                        {catStock.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">Units</span>
                    </div>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white group-hover:text-orange-600 transition-colors">
                    {mainCat}
                  </h3>

                  <div className="mt-1 text-xs text-slate-500 font-mono">
                    {catSkuCount} Items
                  </div>

                  {/* Write off dates preview */}
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    {woffDates.length > 0 ? (
                      <span className="font-mono text-xs text-indigo-700 dark:text-indigo-400 font-semibold truncate">
                        Last W/Off: {woffDates.join(', ')}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No W/Off Recorded</span>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-orange-600">
                  <span>Explore {catSkuCount} Parts</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // LEVEL 4: 100% FULL-WIDTH ITEMS TABLE (ZERO HORIZONTAL SCROLL)
  // ==========================================
  return (
    <div className="space-y-5 p-4 lg:p-6 max-w-full mx-auto animate-in fade-in duration-200 overflow-x-hidden">
      {/* Top Header Strip with Big ← Back to Categories Button */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded px-2 py-0.5 font-mono font-bold ${
              activeDiv === 'DIM'
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                : activeDiv === 'DIN'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              {activeDiv}
            </span>
            <span className="text-slate-400">•</span>
            <span className="font-extrabold text-slate-900 dark:text-white text-base">
              {drillDown.mainCategory || `All ${activeDiv} Items`}
            </span>
            {drillDown.subCategory && (
              <>
                <ChevronRight className="h-4 w-4 text-slate-400" />
                <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">
                  {drillDown.subCategory}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            <span><strong>{filteredSkus.length}</strong> Items Listed</span>
            <span>•</span>
            <span>Total Stock: <strong className="text-slate-900 dark:text-white">{filteredSkus.reduce((a, s) => a + Math.round(s.current_stock), 0).toLocaleString()}</strong> Units</span>
            {activeCategoryGroup?.last_write_off_date && (
              <>
                <span>•</span>
                <span className="text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded dark:bg-indigo-950 dark:text-indigo-300">
                  Last W/Off: {activeCategoryGroup.last_write_off_date}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Big ← Back to Categories Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setDrillDown({ level: 3, mainCategory: null, subCategory: null, productGroup: null })}
            className="flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-100 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 transition"
          >
            <ArrowLeft className="h-4 w-4 text-orange-600" />
            <span>← Back to Categories</span>
          </button>
        </div>
      </div>

      {/* Control Toolbar (Search, Category Switcher, Status Filter, Sort) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 items-center gap-2 min-w-[220px]">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Quick filter table by item name or spec..."
            className="w-full text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-hidden dark:text-white"
          />
          {tableSearch && (
            <button onClick={() => setTableSearch('')} className="text-xs text-slate-400 hover:text-slate-600">×</button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Category Switcher */}
          <select
            value={drillDown.mainCategory || 'ALL'}
            onChange={(e) => {
              const val = e.target.value;
              setDrillDown({
                mainCategory: val === 'ALL' ? null : val,
                subCategory: null,
                productGroup: null
              });
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Categories ({divInfo.total_skus})</option>
            {mainCategoryNames.map(mc => (
              <option key={mc} value={mc}>{mc} ({mainCategoriesMap[mc]?.reduce((a, g) => a + g.sku_count, 0)})</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Stock</option>
            <option value="Positive">In Stock (&gt; 0)</option>
            <option value="Zero Stock">Zero Stock (0)</option>
            <option value="Negative">Negative Stock (&lt; 0)</option>
          </select>

          {/* Sort Field */}
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="excel_row">Sort by Excel Row</option>
            <option value="clean_name">Sort by Item Name</option>
            <option value="current_stock">Sort by Stock Qty</option>
          </select>

          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            title="Toggle sort direction"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>{sortAsc ? 'Asc' : 'Desc'}</span>
          </button>
        </div>
      </div>

      {/* 5 ULTRA-CLEAN COLUMNS DATA TABLE (FIT 100% ON SCREEN — ZERO HORIZONTAL SCROLL) */}
      <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-bold text-slate-600 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/80">
              <th 
                className="w-[50%] py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                onClick={() => setSortField('clean_name')}
              >
                Item Name (Part Name)
              </th>
              <th className="w-[10%] py-3.5 px-3 text-center">
                Division
              </th>
              <th className="w-[15%] py-3.5 px-3 text-center">
                Last W/Off Date
              </th>
              <th 
                className="w-[15%] py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                onClick={() => setSortField('current_stock')}
              >
                Current Stock (Qty)
              </th>
              <th className="w-[10%] py-3.5 px-3 text-center">
                Stock Update (-/+)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredSkus.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                  No items match the selected filter criteria.
                </td>
              </tr>
            ) : (
              filteredSkus.map(item => {
                const roundedStock = Math.round(item.current_stock);
                return (
                  <tr 
                    key={item.id}
                    className="group transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                  >
                    {/* 1. Item Name (Part Name) (50% width, large bold, break-words) */}
                    <td className="py-3.5 px-4 w-[50%] align-middle">
                      <div 
                        onClick={() => setSelectedSku(item)}
                        className="text-[15px] sm:text-[16px] font-bold text-slate-900 dark:text-white whitespace-normal break-words leading-snug cursor-pointer hover:text-orange-600 transition-colors"
                        title={item.clean_name}
                      >
                        {item.clean_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 font-mono whitespace-normal break-words leading-tight">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">{item.division}</span>
                        <span> • </span>
                        <span>{item.main_category}</span>
                        {item.sub_category && item.sub_category !== item.main_category && (
                          <span> &gt; {item.sub_category}</span>
                        )}
                        <span className="text-slate-400 ml-2">({item.sku_code} • Row #{item.excel_row})</span>
                      </div>
                    </td>

                    {/* 2. Division (10% width, centered colored badge) */}
                    <td className="py-3.5 px-3 w-[10%] text-center align-middle">
                      <span className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-black font-mono tracking-wider ${
                        item.division === 'DIM'
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300'
                          : item.division === 'DIN'
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {item.division}
                      </span>
                    </td>

                    {/* 3. Last W/Off Date (15% width, centered) */}
                    <td className="py-3.5 px-3 w-[15%] text-center align-middle">
                      {item.last_write_off_date ? (
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
                          {item.last_write_off_date}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-mono">—</span>
                      )}
                    </td>

                    {/* 4. Current Stock (Qty) (15% width, right-aligned, big bold whole integer) */}
                    <td className="py-3.5 px-4 w-[15%] text-right align-middle">
                      <div className="flex flex-col items-end">
                        <span className={`text-[16px] sm:text-[18px] font-bold font-mono tabular-nums tracking-tight ${
                          roundedStock < 0 
                            ? 'text-rose-600 dark:text-rose-400' 
                            : roundedStock === 0 
                            ? 'text-slate-400 dark:text-slate-500' 
                            : 'text-slate-900 dark:text-white'
                        }`}>
                          {roundedStock.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.unit}
                        </span>
                      </div>
                    </td>

                    {/* 5. Stock Update (-/+) (10% width, centered tap-friendly buttons) */}
                    <td className="py-3.5 px-3 w-[10%] text-center align-middle">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => quickAdjustStock(item.id, -1)}
                          className="h-9 w-9 rounded-lg border-2 border-slate-200 bg-slate-50 text-slate-700 hover:bg-rose-500 hover:border-rose-500 hover:text-white active:scale-90 text-base font-black transition flex items-center justify-center shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          title="Deduct 1 unit (-1)"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => quickAdjustStock(item.id, 1)}
                          className="h-9 w-9 rounded-lg border-2 border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white active:scale-90 text-base font-black transition flex items-center justify-center shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          title="Add 1 unit (+1)"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
