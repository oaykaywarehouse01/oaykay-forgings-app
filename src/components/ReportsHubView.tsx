import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Search, 
  Filter, 
  Boxes, 
  MapPin, 
  ArrowLeftRight, 
  AlertTriangle, 
  Clock, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  TrendingUp, 
  Calendar,
  Layers,
  Database,
  ShieldCheck,
  RefreshCw,
  FileText
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { DivisionCode, SkuItem, LocationStockEntry, Transaction } from '../types/inventory';
import { getLocationDescription } from '../lib/locationUtils';
import * as XLSX from 'xlsx';

export type ReportType = 
  | 'master-valuation'
  | 'location-variance'
  | 'inward-movement'
  | 'location-occupancy'
  | 'low-stock-reorder'
  | 'audit-compliance'
  | 'dispatch-summary';

export const ReportsHubView: React.FC = () => {
  const { 
    skus, 
    categories, 
    divisions, 
    stats, 
    transactions, 
    warehouseLocations, 
    locationStockEntries, 
    deductedSalesOrders,
    currentUser 
  } = useInventoryStore();

  const [activeReport, setActiveReport] = useState<ReportType>('master-valuation');
  const [selectedDivision, setSelectedDivision] = useState<DivisionCode | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [varianceStatusFilter, setVarianceStatusFilter] = useState<'ALL' | 'MISMATCH_ONLY' | 'MATCHED'>('ALL');
  const [movementScopeFilter, setMovementScopeFilter] = useState<'ALL' | 'TOTAL_STOCK_ONLY' | 'LOCATION_ONLY' | 'BOTH'>('ALL');

  // Available Reports Definition
  const reportsList: Array<{
    id: ReportType;
    title: string;
    shortTitle: string;
    icon: React.ElementType;
    badge: string;
    description: string;
  }> = [
    {
      id: 'master-valuation',
      title: 'Master Inventory Valuation & Stock Summary',
      shortTitle: '1. Stock Summary',
      icon: Boxes,
      badge: `${stats.total_skus} SKUs`,
      description: 'Comprehensive inventory balance report categorized by division, main category, and sub-groups.'
    },
    {
      id: 'location-variance',
      title: 'Tally Stock vs Location Variance (Mismatch Detection)',
      shortTitle: '2. Location Variance',
      icon: ArrowLeftRight,
      badge: 'Dual-Track Audit',
      description: 'Audits Tally master balance against physical warehouse rack counts to detect unlocated stock or discrepancies.'
    },
    {
      id: 'inward-movement',
      title: 'Material Movement & Inward Day-Book',
      shortTitle: '3. Inward Ledger',
      icon: Layers,
      badge: `${transactions.length} Logs`,
      description: 'Transaction ledger tracking Total Stock Inwards vs Physical Location putaways and reference documents.'
    },
    {
      id: 'location-occupancy',
      title: 'Warehouse Rack & Bin Occupancy Report',
      shortTitle: '4. Rack Occupancy',
      icon: MapPin,
      badge: `${warehouseLocations.length} Bins`,
      description: 'Physical utilization analysis of steel racks (A1-G3), pallet lines (H1-P6), and storage bins.'
    },
    {
      id: 'low-stock-reorder',
      title: 'Critical Zero & Negative Stock Reorder List',
      shortTitle: '5. Zero / Reorder',
      icon: AlertTriangle,
      badge: `${stats.total_zero_stock + stats.total_negative_stock} Items`,
      description: 'Immediate action procurement list of depleted parts requiring forging or purchase orders.'
    },
    {
      id: 'audit-compliance',
      title: 'Write-Off & Physical Audit Compliance Aging',
      shortTitle: '6. Audit Aging',
      icon: Clock,
      badge: `${Math.round((stats.total_audited_skus / stats.total_skus) * 100)}% Verified`,
      description: 'Aging report of categories and SKUs tracking days since last write-off audit.'
    },
    {
      id: 'dispatch-summary',
      title: 'Sales Dispatch & Fulfillment Summary',
      shortTitle: '7. SO Dispatch',
      icon: Truck,
      badge: `${Object.keys(deductedSalesOrders).length} Dispatches`,
      description: 'Historical records of customer orders fulfilled, carton packaging metrics, and gross weights.'
    }
  ];

  // Map SKU to counted locations
  const skuLocationCounts = useMemo(() => {
    const map = new Map<string, { totalCounted: number; locationsList: Array<{ code: string; qty: number }> }>();
    locationStockEntries.forEach(entry => {
      if (!map.has(entry.skuId)) {
        map.set(entry.skuId, { totalCounted: 0, locationsList: [] });
      }
      const item = map.get(entry.skuId)!;
      item.totalCounted += entry.countedQty;
      if (entry.countedQty > 0) {
        item.locationsList.push({ code: entry.locationCode, qty: entry.countedQty });
      }
    });
    return map;
  }, [locationStockEntries]);

  // Report 1: Master Inventory Valuation Data
  const report1Data = useMemo(() => {
    return categories
      .filter(c => selectedDivision === 'ALL' || c.division === selectedDivision)
      .map(c => {
        const catSkus = skus.filter(
          s => s.division === c.division && s.main_category === c.main_category && s.sub_category === c.sub_category
        );
        const totalUnits = catSkus.reduce((sum, s) => sum + Math.round(s.current_stock), 0);
        const positiveSkus = catSkus.filter(s => s.current_stock > 0).length;
        const zeroSkus = catSkus.filter(s => s.current_stock === 0).length;
        const negativeSkus = catSkus.filter(s => s.current_stock < 0).length;

        return {
          ...c,
          totalUnits,
          positiveSkus,
          zeroSkus,
          negativeSkus,
          skuCount: catSkus.length
        };
      })
      .filter(row => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          row.main_category.toLowerCase().includes(q) ||
          row.sub_category.toLowerCase().includes(q) ||
          row.product_group.toLowerCase().includes(q) ||
          row.division.toLowerCase().includes(q)
        );
      });
  }, [categories, skus, selectedDivision, searchQuery]);

  // Report 2: Location Variance Data
  const report2Data = useMemo(() => {
    return skus
      .filter(s => selectedDivision === 'ALL' || s.division === selectedDivision)
      .map(s => {
        const locInfo = skuLocationCounts.get(s.id) || { totalCounted: 0, locationsList: [] };
        const masterStock = Math.round(s.current_stock);
        const rackStock = locInfo.totalCounted;
        const unlocatedDiff = masterStock - rackStock;

        let status: 'MATCHED' | 'UNLOCATED_PENDING' | 'OVER_ALLOCATED';
        if (unlocatedDiff === 0) {
          status = 'MATCHED';
        } else if (unlocatedDiff > 0) {
          status = 'UNLOCATED_PENDING';
        } else {
          status = 'OVER_ALLOCATED';
        }

        return {
          sku: s,
          masterStock,
          rackStock,
          unlocatedDiff,
          status,
          locationsList: locInfo.locationsList
        };
      })
      .filter(row => {
        if (varianceStatusFilter === 'MISMATCH_ONLY' && row.status === 'MATCHED') return false;
        if (varianceStatusFilter === 'MATCHED' && row.status !== 'MATCHED') return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          row.sku.clean_name.toLowerCase().includes(q) ||
          row.sku.sku_code.toLowerCase().includes(q) ||
          row.sku.main_category.toLowerCase().includes(q) ||
          row.sku.sub_category.toLowerCase().includes(q)
        );
      });
  }, [skus, skuLocationCounts, selectedDivision, varianceStatusFilter, searchQuery]);

  // Report 3: Inward Movements Day-Book Data
  const report3Data = useMemo(() => {
    return transactions
      .filter(t => selectedDivision === 'ALL' || t.division === selectedDivision)
      .filter(t => {
        if (movementScopeFilter === 'ALL') return true;
        return t.scope === movementScopeFilter;
      })
      .filter(t => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.sku_name.toLowerCase().includes(q) ||
          t.sku_code.toLowerCase().includes(q) ||
          (t.referenceNo || '').toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q) ||
          t.performed_by.toLowerCase().includes(q) ||
          (t.location || '').toLowerCase().includes(q)
        );
      });
  }, [transactions, selectedDivision, movementScopeFilter, searchQuery]);

  // Report 4: Location Occupancy Data
  const report4Data = useMemo(() => {
    const locMap = new Map<string, { totalUnits: number; skus: Array<{ name: string; code: string; qty: number }> }>();
    locationStockEntries.forEach(e => {
      if (!locMap.has(e.locationCode)) {
        locMap.set(e.locationCode, { totalUnits: 0, skus: [] });
      }
      const item = locMap.get(e.locationCode)!;
      item.totalUnits += e.countedQty;
      if (e.countedQty > 0) {
        item.skus.push({ name: e.cleanName, code: e.skuCode, qty: e.countedQty });
      }
    });

    return warehouseLocations
      .map(loc => {
        const data = locMap.get(loc.code) || { totalUnits: 0, skus: [] };
        return {
          code: loc.code,
          zone: loc.zone,
          type: loc.type,
          description: loc.description || getLocationDescription(loc.code),
          totalUnits: data.totalUnits,
          skuCount: data.skus.length,
          skusList: data.skus
        };
      })
      .filter(row => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          row.code.toLowerCase().includes(q) ||
          row.zone.toLowerCase().includes(q) ||
          row.description.toLowerCase().includes(q) ||
          row.skusList.some(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
        );
      });
  }, [warehouseLocations, locationStockEntries, searchQuery]);

  // Report 5: Low & Negative Stock Reorder Data
  const report5Data = useMemo(() => {
    return skus
      .filter(s => selectedDivision === 'ALL' || s.division === selectedDivision)
      .filter(s => s.current_stock <= 0)
      .filter(s => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          s.clean_name.toLowerCase().includes(q) ||
          s.sku_code.toLowerCase().includes(q) ||
          s.main_category.toLowerCase().includes(q)
        );
      });
  }, [skus, selectedDivision, searchQuery]);

  // Report 6: Write-off & Audit Compliance Aging Data
  const report6Data = useMemo(() => {
    return categories
      .filter(c => selectedDivision === 'ALL' || c.division === selectedDivision)
      .map(c => {
        const catSkus = skus.filter(
          s => s.division === c.division && s.main_category === c.main_category && s.sub_category === c.sub_category
        );
        const lastDate = c.last_write_off_date;
        let daysAgo: number | null = null;
        if (lastDate) {
          const parts = lastDate.split(/[-/]/);
          if (parts.length === 3) {
            // Check day/month/year or year/month/day
            const d = new Date(lastDate);
            if (!isNaN(d.getTime())) {
              daysAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
            }
          }
        }

        return {
          ...c,
          skuCount: catSkus.length,
          totalStock: catSkus.reduce((a, s) => a + Math.round(s.current_stock), 0),
          daysAgo
        };
      })
      .filter(row => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          row.main_category.toLowerCase().includes(q) ||
          row.sub_category.toLowerCase().includes(q) ||
          row.product_group.toLowerCase().includes(q)
        );
      });
  }, [categories, skus, selectedDivision, searchQuery]);

  // Report 7: Sales Dispatch Data
  const report7Data = useMemo(() => {
    return Object.entries(deductedSalesOrders).map(([pi, info]) => ({
      piNumber: pi,
      partyName: info.partyName,
      deductedAt: info.deductedAt,
      itemsCount: info.itemsCount,
      unitsTotal: info.unitsTotal,
      deductions: info.deductions
    })).filter(row => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return row.piNumber.toLowerCase().includes(q) || row.partyName.toLowerCase().includes(q);
    });
  }, [deductedSalesOrders, searchQuery]);

  // 1-Click Formatted Excel Export Function
  const handleExportExcel = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const wb = XLSX.utils.book_new();

    if (activeReport === 'master-valuation') {
      const rows = report1Data.map(r => ({
        'Division': r.division,
        'Main Category': r.main_category,
        'Sub Category': r.sub_category,
        'Product Group': r.product_group,
        'Total SKUs': r.skuCount,
        'Total Stock Units': r.totalUnits,
        'In-Stock SKUs': r.positiveSkus,
        'Zero-Stock SKUs': r.zeroSkus,
        'Negative-Stock SKUs': r.negativeSkus,
        'Last Write-Off Date': r.last_write_off_date || 'N/A'
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Summary');
      XLSX.writeFile(wb, `OKF_Stock_Summary_Report_${timestamp}.xlsx`);
    } else if (activeReport === 'location-variance') {
      const rows = report2Data.map(r => ({
        'SKU Code': r.sku.sku_code,
        'Item Name': r.sku.clean_name,
        'Division': r.sku.division,
        'Category': r.sku.main_category,
        'Tally Master Stock': r.masterStock,
        'Rack Counted Stock': r.rackStock,
        'Unlocated Variance': r.unlocatedDiff,
        'Status': r.status === 'MATCHED' ? '100% Located' : r.status === 'UNLOCATED_PENDING' ? 'Pending Rack Count' : 'Over-Allocated',
        'Physical Racks': r.locationsList.map(l => `${l.code} (${l.qty})`).join(', ') || 'None'
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Location Variance');
      XLSX.writeFile(wb, `OKF_Location_Variance_Report_${timestamp}.xlsx`);
    } else if (activeReport === 'inward-movement') {
      const rows = report3Data.map(r => ({
        'Date & Time': new Date(r.timestamp).toLocaleString('en-GB'),
        'Type': r.type,
        'Scope': r.scope || 'N/A',
        'SKU Code': r.sku_code,
        'Item Name': r.sku_name,
        'Division': r.division || 'N/A',
        'Quantity': r.quantity,
        'Previous Master Stock': r.prev_stock,
        'New Master Stock': r.new_stock,
        'Location': r.location || 'N/A',
        'Reference No': r.referenceNo || 'N/A',
        'Notes / Reason': r.notes || r.reason,
        'Operator': r.performed_by
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Movement Ledger');
      XLSX.writeFile(wb, `OKF_Material_Movement_Report_${timestamp}.xlsx`);
    } else if (activeReport === 'location-occupancy') {
      const rows = report4Data.map(r => ({
        'Location Code': r.code,
        'Zone / Aisle': r.zone,
        'Type': r.type,
        'Description': r.description,
        'Total Units Stored': r.totalUnits,
        'SKU Variety Count': r.skuCount,
        'Parts Placed': r.skusList.map(s => `${s.name} [${s.qty}]`).join('; ')
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Rack Occupancy');
      XLSX.writeFile(wb, `OKF_Location_Occupancy_Report_${timestamp}.xlsx`);
    } else if (activeReport === 'low-stock-reorder') {
      const rows = report5Data.map(s => ({
        'SKU Code': s.sku_code,
        'Item Name': s.clean_name,
        'Division': s.division,
        'Main Category': s.main_category,
        'Sub Category': s.sub_category,
        'Current Stock': s.current_stock,
        'Unit': s.unit,
        'Status': s.status,
        'Last Audit Date': s.last_audit_date
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Critical Reorder List');
      XLSX.writeFile(wb, `OKF_Low_Stock_Reorder_Report_${timestamp}.xlsx`);
    } else if (activeReport === 'audit-compliance') {
      const rows = report6Data.map(r => ({
        'Division': r.division,
        'Main Category': r.main_category,
        'Sub Category': r.sub_category,
        'Product Group': r.product_group,
        'Total SKUs': r.skuCount,
        'Total Stock': r.totalStock,
        'Last Write-Off Date': r.last_write_off_date || 'Never Audited',
        'Days Elapsed': r.daysAgo !== null ? `${r.daysAgo} days` : 'N/A'
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Audit Compliance');
      XLSX.writeFile(wb, `OKF_Audit_Compliance_Report_${timestamp}.xlsx`);
    } else if (activeReport === 'dispatch-summary') {
      const rows = report7Data.map(r => ({
        'PI Number': r.piNumber,
        'Party Name': r.partyName,
        'Dispatch Date': new Date(r.deductedAt).toLocaleString('en-GB'),
        'Items Dispatched': r.itemsCount,
        'Total Units': r.unitsTotal
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Dispatch Summary');
      XLSX.writeFile(wb, `OKF_Sales_Dispatch_Report_${timestamp}.xlsx`);
    }
  };

  const currentReportMeta = reportsList.find(r => r.id === activeReport)!;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-orange-600 uppercase tracking-wider">
            <BarChart3 className="h-4 w-4" />
            <span>Executive Warehouse Reports & Analytics Hub</span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
            Reports & Compliance Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time operational ledgers, location discrepancy audits, and 1-click formatted Excel/PDF exports.
          </p>
        </div>

        {/* Global Export & Print Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Print / PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-98 transition cursor-pointer"
            title="Download formatted Excel sheet"
          >
            <Download className="h-4 w-4 text-white" />
            <span>Export to Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Horizontal Report Switcher Pills (Touch-Friendly Scrollable Bar) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {reportsList.map(rep => {
          const Icon = rep.icon;
          const isActive = activeReport === rep.id;
          return (
            <button
              key={rep.id}
              onClick={() => setActiveReport(rep.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 border ${
                isActive
                  ? 'border-orange-500 bg-orange-50 text-orange-950 dark:bg-orange-950/60 dark:border-orange-500 dark:text-orange-200 shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}`} />
              <span>{rep.shortTitle}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                isActive 
                  ? 'bg-orange-200/70 text-orange-900 dark:bg-orange-900 dark:text-orange-100' 
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {rep.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Report Header Card with Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                <currentReportMeta.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {currentReportMeta.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentReportMeta.description}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Division Filter */}
            {activeReport !== 'location-occupancy' && activeReport !== 'dispatch-summary' && (
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value as any)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Divisions (DIM • DIN • DTR)</option>
                <option value="DIM">DIM (Domestic Import)</option>
                <option value="DIN">DIN (In-House Forged)</option>
                <option value="DTR">DTR (Domestic Trading)</option>
              </select>
            )}

            {/* Special Filter for Location Variance */}
            {activeReport === 'location-variance' && (
              <select
                value={varianceStatusFilter}
                onChange={(e) => setVarianceStatusFilter(e.target.value as any)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Items</option>
                <option value="MISMATCH_ONLY">⚠️ Mismatched Only (Unlocated/Excess)</option>
                <option value="MATCHED">✓ 100% Fully Located</option>
              </select>
            )}

            {/* Special Filter for Inward Movement Scope */}
            {activeReport === 'inward-movement' && (
              <select
                value={movementScopeFilter}
                onChange={(e) => setMovementScopeFilter(e.target.value as any)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Scopes</option>
                <option value="TOTAL_STOCK_ONLY">📦 Total Stock Only (Tally)</option>
                <option value="LOCATION_ONLY">📍 Location Only (Floor Count)</option>
                <option value="BOTH">⚡ Simultaneous Both</option>
              </select>
            )}

            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search report records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* REPORT 1: MASTER INVENTORY VALUATION & STOCK SUMMARY               */}
        {/* ================================================================= */}
        {activeReport === 'master-valuation' && (
          <div className="mt-5 space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/30">
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase block">Total SKUs Tracked</span>
                <div className="mt-1 font-mono text-xl font-black text-slate-900 dark:text-white tabular-nums">
                  {stats.total_skus.toLocaleString()}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block">Total Stock Units</span>
                <div className="mt-1 font-mono text-xl font-black text-slate-900 dark:text-white tabular-nums">
                  {Math.round(stats.total_stock).toLocaleString()}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block">In-Stock Catalog</span>
                <div className="mt-1 font-mono text-xl font-black text-slate-900 dark:text-white tabular-nums">
                  {stats.total_positive_stock.toLocaleString()}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30">
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase block">Zero / Depleted Stock</span>
                <div className="mt-1 font-mono text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                  {(stats.total_zero_stock + stats.total_negative_stock).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Division</th>
                    <th className="py-3 px-3">Main Category</th>
                    <th className="py-3 px-3">Sub Category</th>
                    <th className="py-3 px-3 text-right">SKUs</th>
                    <th className="py-3 px-4 text-right">Total Units</th>
                    <th className="py-3 px-3 text-center">In Stock</th>
                    <th className="py-3 px-3 text-center">Zero Stock</th>
                    <th className="py-3 px-3 text-center">Last W/Off</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {report1Data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${
                          row.division === 'DIM' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' :
                          row.division === 'DIN' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {row.division}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                        {row.main_category}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-300">
                        {row.sub_category}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                        {row.skuCount}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900 dark:text-white">
                        {row.totalUnits.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">
                        {row.positiveSkus}
                      </td>
                      <td className="py-2.5 px-3 text-center text-rose-600 font-bold">
                        {row.zeroSkus + row.negativeSkus}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-sans text-[11px]">
                        {row.last_write_off_date || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-2.5">
              {report1Data.map((row, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{row.main_category}</span>
                    <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                      {row.totalUnits.toLocaleString()} Units
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{row.sub_category} ({row.division})</div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono border-t border-slate-200 dark:border-slate-700 pt-2">
                    <span>{row.skuCount} SKUs</span>
                    <span className="text-emerald-600 font-bold">{row.positiveSkus} In-Stock</span>
                    <span className="text-rose-600 font-bold">{row.zeroSkus} Zero</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* REPORT 2: TALLY STOCK VS LOCATION VARIANCE (MISMATCH DETECTION)    */}
        {/* ================================================================= */}
        {activeReport === 'location-variance' && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/30">
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase block">1. Total Stock in Tally</span>
                <div className="mt-1 font-mono text-xl font-black text-slate-900 dark:text-white tabular-nums">
                  {Math.round(stats.total_stock).toLocaleString()}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/30">
                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase block">2. Floor Counted on Racks</span>
                <div className="mt-1 font-mono text-xl font-black text-slate-900 dark:text-white tabular-nums">
                  {locationStockEntries.reduce((a, e) => a + e.countedQty, 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block">3. Pending Rack Location</span>
                <div className="mt-1 font-mono text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {(Math.round(stats.total_stock) - locationStockEntries.reduce((a, e) => a + e.countedQty, 0)).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-[500px]">
              <table className="w-full text-left text-xs sticky top-0">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-3 px-3">SKU & Part Name</th>
                    <th className="py-3 px-2 text-center">Division</th>
                    <th className="py-3 px-4 text-right">Tally Total</th>
                    <th className="py-3 px-4 text-right">Rack Counted</th>
                    <th className="py-3 px-4 text-right">Unlocated / Variance</th>
                    <th className="py-3 px-3 text-center">Audit Status</th>
                    <th className="py-3 px-4">Locations Placed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {report2Data.map(r => (
                    <tr key={r.sku.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-bold text-slate-900 dark:text-white truncate max-w-[240px]">
                          {r.sku.clean_name}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{r.sku.sku_code}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {r.sku.division}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900 dark:text-white">
                        {r.masterStock.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-purple-700 dark:text-purple-300">
                        {r.rackStock.toLocaleString()}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-black ${
                        r.unlocatedDiff === 0 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : r.unlocatedDiff > 0 
                          ? 'text-amber-600 dark:text-amber-400' 
                          : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {r.unlocatedDiff > 0 ? `+${r.unlocatedDiff.toLocaleString()}` : r.unlocatedDiff.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {r.status === 'MATCHED' ? (
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>100% Located</span>
                          </span>
                        ) : r.status === 'UNLOCATED_PENDING' ? (
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <Clock className="h-3 w-3" />
                            <span>Pending Count</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            <AlertCircle className="h-3 w-3" />
                            <span>Excess Counted</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-sans text-xs">
                        {r.locationsList.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.locationsList.map(l => (
                              <span key={l.code} className="inline-block px-1.5 py-0.2 rounded bg-purple-50 border border-purple-200 text-purple-800 text-[10px] font-mono dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300 font-bold">
                                {l.code} ({l.qty})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No racks tagged</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-2.5">
              {report2Data.map(r => (
                <div key={r.sku.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">{r.sku.clean_name}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{r.sku.sku_code} • {r.sku.division}</div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center font-mono text-xs border-y border-slate-200 dark:border-slate-700 py-1.5">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-sans">Tally</span>
                      <strong>{r.masterStock}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-purple-600 block font-sans">Rack</span>
                      <strong>{r.rackStock}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-amber-600 block font-sans">Pending</span>
                      <strong className={r.unlocatedDiff === 0 ? 'text-emerald-600' : 'text-amber-600'}>{r.unlocatedDiff}</strong>
                    </div>
                  </div>
                  {r.locationsList.length > 0 && (
                    <div className="mt-1.5 text-[10px] text-slate-500">
                      Racks: {r.locationsList.map(l => `${l.code} (${l.qty})`).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* REPORT 3: MATERIAL INWARD & MOVEMENT DAY-BOOK                     */}
        {/* ================================================================= */}
        {activeReport === 'inward-movement' && (
          <div className="mt-5 space-y-4">
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-2 text-center">Type</th>
                    <th className="py-3 px-2 text-center">Scope</th>
                    <th className="py-3 px-3">SKU & Item Name</th>
                    <th className="py-3 px-3 text-right">Quantity</th>
                    <th className="py-3 px-3 text-right">Master Stock</th>
                    <th className="py-3 px-3 text-center">Location</th>
                    <th className="py-3 px-4">Ref / Notes</th>
                    <th className="py-3 px-3">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {report3Data.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(t.timestamp).toLocaleString('en-GB')}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase ${
                          t.type === 'STOCK_IN' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {t.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center font-sans">
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {t.scope === 'TOTAL_STOCK_ONLY' ? 'Total Only' : t.scope === 'LOCATION_ONLY' ? 'Location Only' : 'Both'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <div className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{t.sku_name}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{t.sku_code}</span>
                      </td>
                      <td className="py-2 px-3 text-right font-black text-slate-900 dark:text-white">
                        {t.quantity.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500 text-[11px]">
                        {t.prev_stock} → <strong>{t.new_stock}</strong>
                      </td>
                      <td className="py-2 px-3 text-center text-orange-600 font-bold">
                        {t.location || '—'}
                      </td>
                      <td className="py-2 px-4 font-sans text-slate-600 dark:text-slate-300 text-xs truncate max-w-[200px]">
                        {t.notes || t.reason}
                      </td>
                      <td className="py-2 px-3 text-slate-500 font-sans text-[11px]">
                        {t.performed_by}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="sm:hidden space-y-2">
              {report3Data.map(t => (
                <div key={t.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[200px]">{t.sku_name}</span>
                    <span className="font-mono text-xs font-black text-emerald-600">+{t.quantity}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>{new Date(t.timestamp).toLocaleDateString('en-GB')}</span>
                    <span>Loc: {t.location || 'N/A'}</span>
                    <span>By: {t.performed_by}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* REPORT 4: WAREHOUSE LOCATION & RACK UTILIZATION                   */}
        {/* ================================================================= */}
        {activeReport === 'location-occupancy' && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Registered Warehouse Bins</span>
                <div className="mt-1 font-mono text-xl font-black text-slate-900 dark:text-white tabular-nums">
                  {warehouseLocations.length} Locations
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block">Occupied / Active Bins</span>
                <div className="mt-1 font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {report4Data.filter(l => l.totalUnits > 0).length} Bins Active
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40">
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase block">Total Physical Units Stored</span>
                <div className="mt-1 font-mono text-xl font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
                  {report4Data.reduce((a, l) => a + l.totalUnits, 0).toLocaleString()} Units
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {report4Data.map(loc => (
                <div key={loc.code} className="p-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-black text-orange-600 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-900">
                        {loc.code}
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{loc.zone}</span>
                    </div>
                    <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                      {loc.totalUnits.toLocaleString()} Pcs
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 font-medium">
                    {loc.description}
                  </div>
                  <div className="mt-2.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="font-bold">{loc.skuCount} SKUs Stored:</span>
                    {loc.skusList.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {loc.skusList.slice(0, 3).map((s, idx) => (
                          <span key={idx} className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] truncate max-w-[150px]">
                            {s.name} ({s.qty})
                          </span>
                        ))}
                        {loc.skusList.length > 3 && (
                          <span className="text-[10px] text-slate-400 font-bold">+{loc.skusList.length - 3} more</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic block mt-0.5">Empty location</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* REPORT 5: CRITICAL ZERO & NEGATIVE STOCK REORDER LIST              */}
        {/* ================================================================= */}
        {activeReport === 'low-stock-reorder' && (
          <div className="mt-5 space-y-4">
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/40 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-rose-900 dark:text-rose-200 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span>{report5Data.length} Depleted Items Requiring Reorder</span>
                </h4>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                  Parts with zero stock or negative book stock that need immediate production planning.
                </p>
              </div>
            </div>

            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-3">SKU Code</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-2 text-center">Division</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Current Stock</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {report5Data.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-bold">
                        {s.sku_code}
                      </td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-900 dark:text-white">
                        {s.clean_name}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold">
                        {s.division}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-500">
                        {s.main_category} &gt; {s.sub_category}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-rose-600 dark:text-rose-400">
                        {s.current_stock} {s.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="rounded px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-2">
              {report5Data.map(s => (
                <div key={s.id} className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{s.clean_name}</span>
                    <span className="font-mono text-xs font-black text-rose-600">{s.current_stock} {s.unit}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    {s.sku_code} • {s.division} • {s.main_category}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* REPORT 6: WRITE-OFF & PHYSICAL AUDIT COMPLIANCE AGING             */}
        {/* ================================================================= */}
        {activeReport === 'audit-compliance' && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Categories</span>
                <div className="mt-1 font-mono text-xl font-black text-slate-900 dark:text-white tabular-nums">
                  {categories.length} Groups
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block">Audited & Verified</span>
                <div className="mt-1 font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {categories.filter(c => c.last_write_off_date).length} Categories
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40">
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase block">SKU Audit Rate</span>
                <div className="mt-1 font-mono text-xl font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
                  {Math.round((stats.total_audited_skus / stats.total_skus) * 100)}%
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block">Pending Audit</span>
                <div className="mt-1 font-mono text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {categories.filter(c => !c.last_write_off_date).length} Categories
                </div>
              </div>
            </div>

            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Division</th>
                    <th className="py-3 px-4">Category Group</th>
                    <th className="py-3 px-3 text-right">SKU Count</th>
                    <th className="py-3 px-3 text-right">Stock Qty</th>
                    <th className="py-3 px-4 text-center">Last Write-Off Header</th>
                    <th className="py-3 px-3 text-center">Audit Date</th>
                    <th className="py-3 px-3 text-center">Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {report6Data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold">{row.division}</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-900 dark:text-white">
                        {row.main_category} &gt; {row.sub_category}
                      </td>
                      <td className="py-2.5 px-3 text-right">{row.skuCount}</td>
                      <td className="py-2.5 px-3 text-right font-black">{row.totalStock.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-center font-sans text-slate-500 text-[11px]">
                        {row.original_write_off_header || 'Manual Audit'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-indigo-700 dark:text-indigo-400">
                        {row.last_write_off_date || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {row.last_write_off_date ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                            <Clock className="h-3 w-3" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="sm:hidden space-y-2">
              {report6Data.map((row, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between font-bold text-xs">
                    <span>{row.main_category}</span>
                    <span className={row.last_write_off_date ? 'text-indigo-600' : 'text-slate-400'}>
                      {row.last_write_off_date || 'Not Audited'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{row.sub_category} ({row.division})</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* REPORT 7: SALES DISPATCH & PACKAGING PERFORMANCE                  */}
        {/* ================================================================= */}
        {activeReport === 'dispatch-summary' && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Dispatches</span>
                <div className="mt-1 font-mono text-xl font-black text-slate-900 dark:text-white tabular-nums">
                  {report7Data.length} Orders
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block">Units Dispatched</span>
                <div className="mt-1 font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {report7Data.reduce((a, r) => a + r.unitsTotal, 0).toLocaleString()} Units
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40">
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase block">Total Line Items</span>
                <div className="mt-1 font-mono text-xl font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
                  {report7Data.reduce((a, r) => a + r.itemsCount, 0)} Items
                </div>
              </div>
            </div>

            {report7Data.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium border border-dashed rounded-xl border-slate-200 dark:border-slate-800">
                No processed sales dispatches found. Upload and process a Sales Order in SO & Dispatch to generate records.
              </div>
            ) : (
              <div className="space-y-3">
                {report7Data.map(d => (
                  <div key={d.piNumber} className="p-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-orange-600 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-900">
                            PI #{d.piNumber}
                          </span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{d.partyName}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          Dispatched on {new Date(d.deductedAt).toLocaleString('en-GB')}
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {d.unitsTotal.toLocaleString()} Units
                        </span>
                        <span className="text-xs text-slate-400 block font-sans">
                          {d.itemsCount} Items Fulfilled
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
