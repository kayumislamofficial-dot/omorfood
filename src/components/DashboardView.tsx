import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  Camera,
  FolderTree,
  History,
  Package,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { formatBDT, formatBnDateTime, formatNumberBn, toBnDigits } from '../lib/format';
import { seedStarterCategories } from '../services/storeService';
import {
  type AppView,
  type Category,
  type PriceHistoryEntry,
  type Product,
  type StaffProfile,
  type StaffRole,
  type StoreSettings,
} from '../types/store';
import { useState } from 'react';

interface DashboardViewProps {
  products: Product[];
  categories: Category[];
  staffList: StaffProfile[];
  priceHistory: PriceHistoryEntry[];
  settings: StoreSettings | null;
  actor: { staffId: string; name: string; role: StaffRole };
  onNavigate: (view: AppView) => void;
  onOpenBarcodeSearch: () => void;
}

export function DashboardView({
  products,
  categories,
  staffList,
  priceHistory,
  settings,
  actor,
  onNavigate,
  onOpenBarcodeSearch,
}: DashboardViewProps) {
  const isAdmin = actor.role === 'admin';
  const canViewPurchasePrice = isAdmin || !settings?.hidePurchasePriceForStaff;
  const [isSeeding, setIsSeeding] = useState(false);

  const lowStockProducts = products.filter(
    (p) => p.hasStock && p.stockQty <= p.lowStockThreshold
  );
  const activeStaffCount = staffList.filter((s) => s.isActive).length;
  const recentPriceUpdates = priceHistory.slice(0, 6);

  const handleSeedCategories = async () => {
    setIsSeeding(true);
    try {
      await seedStarterCategories();
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Action Bar */}
      <div className="bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 rounded-2xl p-6 sm:p-7 text-white shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <p className="text-xs font-medium text-blue-100">
              স্বাগতম, {actor.name} · {isAdmin ? 'অ্যাডমিন অ্যাকাউন্ট' : 'স্টাফ অ্যাকাউন্ট'}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              {settings?.storeName || 'ওমর ফুড'} ড্যাশবোর্ড
            </h2>
            <p className="text-sm text-blue-100 mt-1.5 max-w-xl">
              কেন্দ্রীয় ডাটাবেস থেকে যেকোনো পণ্যের দাম খুঁজুন অথবা দ্রুত ক্যালকুলেটর দিয়ে ক্রেতার হিসাব ও প্রিন্ট তৈরি করুন।
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('calculator')}
              className="min-h-[46px] px-5 rounded-xl bg-white text-blue-800 hover:bg-blue-50 font-bold text-sm inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Calculator className="w-4 h-4" />
              স্মার্ট হিসাব খুলুন
            </button>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="min-h-[46px] px-4 rounded-xl bg-blue-900/40 hover:bg-blue-900/60 border border-white/25 text-white font-semibold text-sm inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Search className="w-4 h-4" />
              পণ্য খুঁজুন
            </button>
            <button
              type="button"
              onClick={onOpenBarcodeSearch}
              className="min-h-[46px] px-4 rounded-xl bg-blue-900/40 hover:bg-blue-900/60 border border-white/25 text-white font-semibold text-sm inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4" />
              বারকোড স্ক্যান
            </button>
          </div>
        </div>
      </div>

      {/* First-Time Setup Helper if Categories are Empty */}
      {isAdmin && categories.length === 0 && (
        <div className="bg-white rounded-2xl border border-blue-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">দ্রুত শুরু করতে ক্যাটাগরি তৈরি করুন</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                এখনও কোনো ক্যাটাগরি নেই। এক ক্লিকে বাংলাদেশের মুদি দোকানের প্রাথমিক ৮টি ক্যাটাগরি (চাল-ডাল, তেল, মসলা ইত্যাদি) যোগ করতে পারেন।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSeedCategories}
            disabled={isSeeding}
            className="min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSeeding ? 'যোগ হচ্ছে...' : 'প্রাথমিক ক্যাটাগরি যোগ করুন'}
          </button>
        </div>
      )}

      {/* 4 KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('products')}
          className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:border-blue-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>মোট পণ্য</span>
            <Package className="w-4 h-4 text-blue-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono-num mt-2">
            {toBnDigits(products.length)}
          </div>
          <div className="text-xs text-slate-500 mt-1">কেন্দ্রীয় ডাটাবেসে সংরক্ষিত</div>
        </button>

        <button
          type="button"
          onClick={() => (isAdmin ? onNavigate('categories') : onNavigate('products'))}
          className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:border-blue-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>মোট ক্যাটাগরি</span>
            <FolderTree className="w-4 h-4 text-blue-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono-num mt-2">
            {toBnDigits(categories.length)}
          </div>
          <div className="text-xs text-slate-500 mt-1">সক্রিয় পণ্যের ধরন</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('products')}
          className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:border-amber-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>কম স্টক পণ্য</span>
            <AlertTriangle
              className={`w-4 h-4 ${lowStockProducts.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}
            />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono-num mt-2">
            {toBnDigits(lowStockProducts.length)}
          </div>
          <div className="text-xs text-slate-500 mt-1">স্টক ট্র্যাকিং চালু থাকা পণ্য</div>
        </button>

        <button
          type="button"
          onClick={() => (isAdmin ? onNavigate('staff') : onNavigate('calculator'))}
          className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:border-blue-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>সক্রিয় স্টাফ ও অ্যাডমিন</span>
            <Users className="w-4 h-4 text-blue-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono-num mt-2">
            {toBnDigits(activeStaffCount)}
          </div>
          <div className="text-xs text-slate-500 mt-1">পিন অ্যাক্সেস চালু রয়েছে</div>
        </button>
      </div>

      {/* Two Column Details: Low Stock + Recent Price Updates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Low Stock Alert Card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="text-base font-bold text-slate-900">কম স্টক পণ্য সতর্কতা</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              সব পণ্য দেখুন <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {lowStockProducts.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                কম স্টকের কোনো পণ্য নেই অথবা স্টক ট্র্যাকিং চালু নেই।
              </div>
            ) : (
              lowStockProducts.slice(0, 6).map((p) => (
                <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 truncate">{p.nameBn}</div>
                    <div className="text-xs text-slate-500">{p.categoryName}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-amber-700 font-mono-num">
                      {formatNumberBn(p.stockQty)} {p.unit}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      সীমা: {formatNumberBn(p.lowStockThreshold)} {p.unit}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Price History Card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-700" />
              <h3 className="text-base font-bold text-slate-900">সাম্প্রতিক মূল্য পরিবর্তন</h3>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                পূর্ণ ইতিহাস <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {recentPriceUpdates.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                এখনও কোনো মূল্য পরিবর্তনের রেকর্ড নেই।
              </div>
            ) : (
              recentPriceUpdates.map((item) => (
                <div key={item.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {item.productNameBn}
                    </div>
                    <div className="text-xs text-slate-500">
                      পরিবর্তনকারী: {item.changedByName} · {formatBnDateTime(item.createdAt)}
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-xs font-mono-num">
                    <div className="font-bold text-blue-700">
                      বিক্রি: {formatBDT(item.oldSellingPrice)} → {formatBDT(item.newSellingPrice)}
                    </div>
                    {canViewPurchasePrice && (
                      <div className="text-slate-500 mt-0.5">
                        কেনা: {formatBDT(item.oldPurchasePrice)} → {formatBDT(item.newPurchasePrice)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
