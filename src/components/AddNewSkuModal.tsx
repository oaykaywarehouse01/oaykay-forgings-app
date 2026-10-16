import React, { useState, useEffect, useMemo } from 'react';
import { 
  PackagePlus, 
  Boxes, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  Info
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { DivisionCode } from '../types/inventory';
import { normalizeLocationCode } from '../lib/locationUtils';

// Known Category to Division Map for smart bidirectional intelligence
const CATEGORY_TO_DIVISION_MAP: Record<string, DivisionCode> = {
  // DIN (Domestic In-House Forged)
  'Spanners': 'DIN',
  'Combination Spanners': 'DIN',
  'Ring Spanners': 'DIN',
  'Double Open End Spanners': 'DIN',
  'Bi-Hex Spanners': 'DIN',
  'Heavy Duty Spanners': 'DIN',
  'Pipe Wrench Heavy Duty': 'DIN',
  'PIPE WRENCH Stillson': 'DIN',
  'Wheel Spanners': 'DIN',
  'L-Handles': 'DIN',
  'Hammers': 'DIN',
  'Pincer and Plier': 'DIN',
  'Socket Accessories': 'DIN',

  // DIM (Domestic Import)
  'PTA': 'DIM',
  'Power Tool Accessories': 'DIM',
  'Allen Keys': 'DIM',
  'Cutting Tool': 'DIM',
  'Cutting Wheels': 'DIM',
  'Grinding Wheels': 'DIM',
  'Flap Discs': 'DIM',
  'Diamond Blades': 'DIM',
  'Hacksaw Blade': 'DIM',
  'Pliers': 'DIM',
  'Screwdriver Bits': 'DIM',
  'Bit Sockets': 'DIM',
  'Socket': 'DIM',
  'Building & Hobby': 'DIM',
  'Tool Box & Cabinets': 'DIM',
  'Wire Stripper & Crimping Pliers': 'DIM',
  'Bearing Puller': 'DIM',

  // DTR (Domestic Trading)
  'Vices': 'DTR',
  'Bench Vices': 'DTR',
  'All Steel Vices': 'DTR',
  'Screw Driver': 'DTR',
  'Screwdrivers': 'DTR',
  'Lubrication': 'DTR',
  'Grease Guns': 'DTR',
  'Tool Trolleys': 'DTR',
  'Tool Box': 'DTR',
  'Clamps': 'DTR',
  'Adjustable Wrench': 'DTR',
  'Box Spanner': 'DTR',
  'Jumbo Spanner': 'DTR',
  'Pipe Die Set': 'DTR',
  'General Purpose Kit': 'DTR',
  'Jack Plane': 'DTR',
  'Hammer': 'DTR'
};

export const AddNewSkuModal: React.FC = () => {
  const { 
    isAddNewSkuModalOpen, 
    setAddNewSkuModalOpen, 
    categories, 
    skus, 
    warehouseLocations,
    addNewSku 
  } = useInventoryStore();

  const [division, setDivision] = useState<DivisionCode>('DIM');
  const [selectedMainCat, setSelectedMainCat] = useState<string>('');
  const [customMainCat, setCustomMainCat] = useState<string>('');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('');
  const [customSubCat, setCustomSubCat] = useState<string>('');
  const [cleanName, setCleanName] = useState<string>('');
  const [sizeSpec, setSizeSpec] = useState<string>('');
  const [materialTier, setMaterialTier] = useState<string>('Industrial Grade CrV');
  const [unit, setUnit] = useState<string>('Pcs');
  const [openingStock, setOpeningStock] = useState<string>('0');
  const [locationBin, setLocationBin] = useState<string>('A1');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Available categories for selected division
  const divisionCategories = useMemo(() => {
    return Array.from(new Set(
      categories
        .filter(c => c.division === division)
        .map(c => c.main_category)
    )).sort();
  }, [categories, division]);

  // Available sub-categories for selected main category
  const subCategories = useMemo(() => {
    if (!selectedMainCat || selectedMainCat === '__NEW__') return [];
    return Array.from(new Set(
      categories
        .filter(c => c.division === division && c.main_category === selectedMainCat)
        .map(c => c.sub_category)
    )).sort();
  }, [categories, division, selectedMainCat]);

  // Auto-generate preview SKU Code
  const previewSkuCode = useMemo(() => {
    const divSkus = skus.filter(s => s.division === division);
    let maxNum = 0;
    divSkus.forEach(s => {
      const m = s.sku_code.match(/OKF-[A-Z]+-(\d+)/);
      if (m) {
        const val = parseInt(m[1], 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    });
    return `OKF-${division}-${String(maxNum + 1).padStart(4, '0')}`;
  }, [skus, division]);

  // Handle Main Category Change (Bidirectional Intelligence)
  const handleMainCatChange = (cat: string) => {
    setSelectedMainCat(cat);
    if (cat !== '__NEW__' && CATEGORY_TO_DIVISION_MAP[cat]) {
      const inferredDiv = CATEGORY_TO_DIVISION_MAP[cat];
      if (inferredDiv !== division) {
        setDivision(inferredDiv);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalMainCat = selectedMainCat === '__NEW__' ? customMainCat.trim() : selectedMainCat.trim();
    const finalSubCat = selectedSubCat === '__NEW__' ? customSubCat.trim() : (selectedSubCat.trim() || finalMainCat);
    const finalName = cleanName.trim();

    if (!finalName || !finalMainCat) {
      alert('Please fill in Item Name and Category.');
      return;
    }

    const created = addNewSku({
      clean_name: finalName,
      division,
      main_category: finalMainCat,
      sub_category: finalSubCat,
      size_spec: sizeSpec.trim() || undefined,
      material_and_tier: materialTier.trim() || undefined,
      unit,
      initial_stock: parseInt(openingStock, 10) || 0,
      location_bin: normalizeLocationCode(locationBin) || 'A1'
    });

    setSuccessToast(`Created new SKU: ${created.sku_code} — ${created.clean_name}`);
    setTimeout(() => {
      setSuccessToast(null);
      setAddNewSkuModalOpen(false);
      // Reset form
      setCleanName('');
      setSizeSpec('');
      setOpeningStock('0');
      setSelectedMainCat('');
      setSelectedSubCat('');
    }, 1500);
  };

  if (!isAddNewSkuModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div 
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-orange-600 uppercase tracking-wider">
              <PackagePlus className="h-4 w-4" />
              <span>Global Catalog Expansion</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
              + Add New SKU to Factory Catalog
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Smart Division-Category mapping automatically badges DIM, DIN, or DTR.
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Next SKU Code</span>
            <span className="font-mono text-base font-black text-orange-600 dark:text-orange-400">
              {previewSkuCode}
            </span>
          </div>
        </div>

        {successToast && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-300 p-4 text-xs font-bold text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Division Selector Cards (DIM / DIN / DTR) */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
              Select Division (Smart Detection)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  code: 'DIM' as DivisionCode,
                  name: 'Domestic Import',
                  badgeColor: 'bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-200',
                  activeBorder: 'border-indigo-600 ring-2 ring-indigo-500/30',
                  desc: 'Power Tool Accessories, Cutting Wheels, Blades, Allen Keys'
                },
                {
                  code: 'DIN' as DivisionCode,
                  name: 'In-House Forged',
                  badgeColor: 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200',
                  activeBorder: 'border-emerald-600 ring-2 ring-emerald-500/30',
                  desc: 'Manufactured Spanners, Wrenches, Hammers, L-Handles'
                },
                {
                  code: 'DTR' as DivisionCode,
                  name: 'Domestic Trading',
                  badgeColor: 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200',
                  activeBorder: 'border-amber-600 ring-2 ring-amber-500/30',
                  desc: 'Traded Screwdrivers, Vices, Clamps, Grease Guns'
                }
              ].map(d => {
                const isSelected = division === d.code;
                return (
                  <div
                    key={d.code}
                    onClick={() => setDivision(d.code)}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition select-none ${
                      isSelected 
                        ? `${d.badgeColor} ${d.activeBorder} shadow-xs` 
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-black">{d.code}</span>
                      <span className="text-[10px] font-bold uppercase">{d.name}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] opacity-80 leading-snug">
                      {d.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category & Sub-Category Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Main Category
              </label>
              <select
                value={selectedMainCat}
                onChange={(e) => handleMainCatChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              >
                <option value="">-- Choose Category --</option>
                {divisionCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__NEW__">+ Create New Category</option>
              </select>

              {selectedMainCat === '__NEW__' && (
                <input
                  type="text"
                  placeholder="Type new category name..."
                  value={customMainCat}
                  onChange={(e) => setCustomMainCat(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-orange-300 bg-orange-50/50 px-3 py-1.5 text-xs text-slate-900 dark:bg-slate-800 dark:text-white"
                  required
                />
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Sub-Category
              </label>
              <select
                value={selectedSubCat}
                onChange={(e) => setSelectedSubCat(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              >
                <option value="">-- Optional / Inherit --</option>
                {subCategories.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
                <option value="__NEW__">+ Create New Sub-Category</option>
              </select>

              {selectedSubCat === '__NEW__' && (
                <input
                  type="text"
                  placeholder="Type new sub-category..."
                  value={customSubCat}
                  onChange={(e) => setCustomSubCat(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-orange-300 bg-orange-50/50 px-3 py-1.5 text-xs text-slate-900 dark:bg-slate-800 dark:text-white"
                />
              )}
            </div>
          </div>

          {/* Clean Item Name */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Clean Item Name (Part Name)
            </label>
            <input
              type="text"
              placeholder="e.g. Ring Spanner 19mm CrV Satin Chrome"
              value={cleanName}
              onChange={(e) => setCleanName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              required
            />
          </div>

          {/* Size Spec & Material Tier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Size / Dimension Specification
              </label>
              <input
                type="text"
                placeholder="e.g. 19mm or 4 Inch (105mm)"
                value={sizeSpec}
                onChange={(e) => setSizeSpec(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Material / Brand Tier
              </label>
              <input
                type="text"
                value={materialTier}
                onChange={(e) => setMaterialTier(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
          </div>

          {/* Unit, Opening Stock & Initial Location */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Unit of Measure
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              >
                <option value="Pcs">Pcs</option>
                <option value="Sets">Sets</option>
                <option value="Boxes">Boxes</option>
                <option value="Pairs">Pairs</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Opening Stock Qty
              </label>
              <input
                type="number"
                min={0}
                value={openingStock}
                onChange={(e) => setOpeningStock(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Storage Location
              </label>
              <input
                type="text"
                placeholder="A1, H2, BIN-1"
                value={locationBin}
                onChange={(e) => setLocationBin(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setAddNewSkuModalOpen(false)}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-orange-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-orange-700 shadow-xs active:scale-98 transition flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Save & Onboard SKU</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
