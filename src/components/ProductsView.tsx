import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Barcode,
  Camera,
  Edit3,
  Package,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { formatBDT, formatNumberBn, normalizeBarcode, toBnDigits } from '../lib/format';
import { type PendingOfflineBarcode } from '../lib/offlineDb';
import { deleteProduct } from '../services/storeService';
import {
  type Category,
  type Product,
  type StaffRole,
  type StoreSettings,
} from '../types/store';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ProductFormModal } from './ProductFormModal';

interface ProductsViewProps {
  products: Product[];
  categories: Category[];
  settings: StoreSettings | null;
  actor: { staffId: string; name: string; role: StaffRole };
  isOnline?: boolean;
  pendingBarcodes?: PendingOfflineBarcode[];
  onSavePendingBarcode?: (barcode: string) => Promise<void>;
  onRemovePendingBarcode?: (barcode: string) => Promise<void>;
  initialScanPrompt?: boolean;
  onClearScanPrompt?: () => void;
}

const PAGE_SIZE = 30;

export function ProductsView({
  products,
  categories,
  settings,
  actor,
  isOnline = true,
  pendingBarcodes = [],
  onSavePendingBarcode,
  onRemovePendingBarcode,
  initialScanPrompt = false,
  onClearScanPrompt,
}: ProductsViewProps) {
  const isAdmin = actor.role === 'admin';
  const canViewPurchasePrice = isAdmin || !settings?.hidePurchasePriceForStaff;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [isScannerOpen, setIsScannerOpen] = useState(initialScanPrompt);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prefillBarcode, setPrefillBarcode] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'warn'; text: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategoryId !== 'all' && p.categoryId !== selectedCategoryId) {
        return false;
      }
      if (!q) return true;
      return (
        p.searchKeywords.includes(q) ||
        p.nameBn.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, selectedCategoryId]);

  const visibleProducts = filteredProducts.slice(0, visibleLimit);

  const handleScanLookup = (rawCode: string) => {
    const cleaned = normalizeBarcode(rawCode);
    setIsScannerOpen(false);
    onClearScanPrompt?.();
    if (!cleaned) return;

    const match = products.find((p) => p.barcode.toLowerCase() === cleaned.toLowerCase());
    if (match) {
      setSearchQuery(cleaned);
      setSelectedCategoryId('all');
      setFeedback({
        type: 'ok',
        text: `পাওয়া গেছে: ${match.nameBn} — বিক্রির দাম ${formatBDT(match.sellingPrice)} / ${match.unit}`,
      });
    } else {
      setSearchQuery(cleaned);
      setPrefillBarcode(cleaned);
      setEditingProduct(null);
      if (!isOnline) {
        setFeedback({
          type: 'warn',
          text: `"${cleaned}" বারকোডের পণ্য লোকাল ডাটাবেসে পাওয়া যায়নি। অফলাইনে নতুন পণ্য যোগ করা যাবে না; অনলাইনে পরে যোগ করার জন্য সেভ করে রাখতে পারেন।`,
        });
      } else if (isAdmin) {
        setFeedback({
          type: 'warn',
          text: `"${cleaned}" বারকোডের কোনো পণ্য পাওয়া যায়নি। চাইলে নতুন পণ্য হিসেবে যোগ করতে পারেন।`,
        });
      } else {
        setFeedback({
          type: 'warn',
          text: `"${cleaned}" বারকোডের কোনো পণ্য ডাটাবেসে পাওয়া যায়নি।`,
        });
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    if (!isOnline) {
      setFeedback({
        type: 'warn',
        text: 'অফলাইন অবস্থায় পণ্য মুছে ফেলা যাবে না। ইন্টারনেট সংযোগ চালু করে আবার চেষ্টা করুন।',
      });
      setConfirmDelete(null);
      return;
    }
    setIsDeleting(true);
    try {
      await deleteProduct(confirmDelete);
      setFeedback({
        type: 'ok',
        text: `"${confirmDelete.nameBn}" পণ্যটি মুছে ফেলা হয়েছে।`,
      });
      setConfirmDelete(null);
    } catch (err) {
      setFeedback({
        type: 'warn',
        text: err instanceof Error ? err.message : 'পণ্য মুছতে সমস্যা হয়েছে।',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Big Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">কেন্দ্রীয় পণ্য তালিকা</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              মোট {toBnDigits(products.length)}টি পণ্য · বাংলা, ইংরেজি বা বারকোড দিয়ে খুঁজুন
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              disabled={!isOnline}
              onClick={() => {
                setEditingProduct(null);
                setPrefillBarcode('');
                setIsFormOpen(true);
              }}
              className="min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {isOnline ? 'নতুন পণ্য যোগ করুন' : 'নতুন পণ্য যোগ (অনলাইন প্রয়োজন)'}
            </button>
          )}
        </div>

        {/* Large Search Bar + Barcode Scan */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleLimit(PAGE_SIZE);
              }}
              placeholder="পণ্যের নাম (যেমন: চাল, তেল, Lux) অথবা বারকোড লিখুন..."
              className="w-full min-h-[48px] pl-11 pr-4 rounded-xl border border-slate-300 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="min-h-[48px] px-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            বারকোড স্ক্যান
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryId('all');
              setVisibleLimit(PAGE_SIZE);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              selectedCategoryId === 'all'
                ? 'bg-blue-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            সব ক্যাটাগরি
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategoryId(cat.id);
                setVisibleLimit(PAGE_SIZE);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                selectedCategoryId === cat.id
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.nameBn}
            </button>
          ))}
        </div>

        {feedback && (
          <div
            className={`rounded-xl px-4 py-3 text-xs font-medium flex flex-wrap items-center justify-between gap-2 border ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <span>{feedback.text}</span>
            {feedback.type === 'warn' && prefillBarcode && !isOnline && onSavePendingBarcode && (
              <button
                type="button"
                onClick={() => {
                  void onSavePendingBarcode(prefillBarcode).then(() => {
                    setFeedback({
                      type: 'ok',
                      text: `"${prefillBarcode}" বারকোডটি অনলাইনে পরে যোগ করার জন্য সেভ করা হয়েছে।`,
                    });
                    setPrefillBarcode('');
                  });
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer"
              >
                পরে যোগ করার জন্য সেভ করুন
              </button>
            )}
            {feedback.type === 'warn' && isAdmin && isOnline && prefillBarcode && (
              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                এই বারকোডে পণ্য যোগ করুন
              </button>
            )}
          </div>
        )}

        {isAdmin && isOnline && pendingBarcodes.length > 0 && (
          <div className="rounded-xl px-4 py-3 bg-blue-50 border border-blue-200 space-y-2">
            <div className="text-xs font-bold text-blue-900">
              অফলাইনে স্ক্যান করা অজানা বারকোড ({toBnDigits(pendingBarcodes.length)}টি) — এখন যোগ করতে পারেন:
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingBarcodes.map((item) => (
                <div
                  key={item.barcode}
                  className="inline-flex items-center gap-1.5 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <span className="font-mono-num font-semibold text-slate-800">{item.barcode}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setPrefillBarcode(item.barcode);
                      setIsFormOpen(true);
                    }}
                    className="text-blue-700 font-semibold hover:underline cursor-pointer"
                  >
                    যোগ করুন
                  </button>
                  {onRemovePendingBarcode && (
                    <button
                      type="button"
                      onClick={() => void onRemovePendingBarcode(item.barcode)}
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                      aria-label="বাদ দিন"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {visibleProducts.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">কোনো পণ্য পাওয়া যায়নি</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              {products.length === 0
                ? 'এখনও কোনো পণ্য যোগ করা হয়নি। অ্যাডমিন প্যানেল থেকে দোকানের পণ্য যোগ করা শুরু করুন।'
                : 'অনুসন্ধান শব্দ বা ক্যাটাগরি পরিবর্তন করে আবার চেষ্টা করুন।'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                    <th className="py-3 px-4">পণ্যের নাম</th>
                    <th className="py-3 px-4">ক্যাটাগরি ও একক</th>
                    <th className="py-3 px-4">বারকোড</th>
                    {canViewPurchasePrice && <th className="py-3 px-4 text-right">কেনা দাম</th>}
                    <th className="py-3 px-4 text-right">বিক্রির দাম</th>
                    {canViewPurchasePrice && <th className="py-3 px-4 text-right">লাভ</th>}
                    <th className="py-3 px-4 text-right">স্টক</th>
                    {isAdmin && <th className="py-3 px-4 text-right">অ্যাকশন</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {visibleProducts.map((p) => {
                    const profit = p.sellingPrice - p.purchasePrice;
                    const isLowStock = p.hasStock && p.stockQty <= p.lowStockThreshold;
                    return (
                      <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.nameBn}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">{p.nameBn}</div>
                              {p.nameEn && (
                                <div className="text-xs text-slate-500">{p.nameEn}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {p.categoryName} <span aria-hidden="true">·</span> {p.unit}
                        </td>
                        <td className="py-3 px-4 font-mono-num text-xs text-slate-600">
                          {p.barcode || '—'}
                        </td>
                        {canViewPurchasePrice && (
                          <td className="py-3 px-4 text-right font-mono-num text-slate-700">
                            {formatBDT(p.purchasePrice)}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right font-mono-num font-bold text-blue-700">
                          {formatBDT(p.sellingPrice)}
                        </td>
                        {canViewPurchasePrice && (
                          <td
                            className={`py-3 px-4 text-right font-mono-num font-semibold ${
                              profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {formatBDT(profit)}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right text-xs">
                          {p.hasStock ? (
                            <span
                              className={`font-mono-num font-semibold ${
                                isLowStock ? 'text-amber-700' : 'text-slate-700'
                              }`}
                            >
                              {formatNumberBn(p.stockQty)} {p.unit}
                              {isLowStock && ' (কম)'}
                            </span>
                          ) : (
                            <span className="text-slate-400">আনলিমিটেড</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProduct(p);
                                  setPrefillBarcode('');
                                  setIsFormOpen(true);
                                }}
                                className="p-2 rounded-lg text-blue-700 hover:bg-blue-50 cursor-pointer"
                                title="সম্পাদনা"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(p)}
                                className="p-2 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                                title="মুছুন"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {visibleProducts.map((p) => {
                const profit = p.sellingPrice - p.purchasePrice;
                const isLowStock = p.hasStock && p.stockQty <= p.lowStockThreshold;
                return (
                  <div key={p.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-base">{p.nameBn}</h4>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                          {p.nameEn && (
                            <>
                              <span>{p.nameEn}</span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span>{p.categoryName}</span>
                          <span aria-hidden="true">·</span>
                          <span>একক: {p.unit}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-bold text-blue-700 font-mono-num">
                          {formatBDT(p.sellingPrice)}
                        </div>
                        <div className="text-[11px] text-slate-400">বিক্রির দাম</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                      <div className="flex flex-wrap items-center gap-3">
                        {p.barcode && (
                          <span className="inline-flex items-center gap-1 font-mono-num">
                            <Barcode className="w-3.5 h-3.5 text-slate-400" />
                            {p.barcode}
                          </span>
                        )}
                        {canViewPurchasePrice && (
                          <span className="font-mono-num">
                            কেনা: {formatBDT(p.purchasePrice)} · লাভ: {formatBDT(profit)}
                          </span>
                        )}
                        {p.hasStock && (
                          <span className={isLowStock ? 'text-amber-700 font-semibold' : ''}>
                            স্টক: {formatNumberBn(p.stockQty)} {p.unit}
                            {isLowStock ? ' (কম)' : ''}
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(p);
                              setPrefillBarcode('');
                              setIsFormOpen(true);
                            }}
                            className="min-h-[36px] px-3 rounded-lg bg-blue-50 text-blue-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            এডিট
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(p)}
                            className="min-h-[36px] px-2.5 rounded-lg bg-red-50 text-red-600 inline-flex items-center cursor-pointer"
                            aria-label="মুছুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length > visibleLimit && (
              <div className="p-4 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  আরও পণ্য দেখুন ({toBnDigits(filteredProducts.length - visibleLimit)}টি বাকি)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Product Add/Edit Modal */}
      <ProductFormModal
        isOpen={isFormOpen}
        editingProduct={editingProduct}
        initialBarcode={prefillBarcode}
        categories={categories}
        existingProducts={products}
        actor={actor}
        onClose={() => setIsFormOpen(false)}
        onSaved={(msg) => {
          setFeedback({ type: 'ok', text: msg });
          if (prefillBarcode && onRemovePendingBarcode) {
            void onRemovePendingBarcode(prefillBarcode);
          }
        }}
      />

      {/* Camera Barcode Scanner */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        title="বারকোড দিয়ে পণ্য খুঁজুন"
        onClose={() => {
          setIsScannerOpen(false);
          onClearScanPrompt?.();
        }}
        onScan={handleScanLookup}
      />

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-slate-900">পণ্য মুছে ফেলতে চান?</h4>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong>"{confirmDelete.nameBn}"</strong> পণ্যটি স্থায়ীভাবে ডাটাবেস থেকে মুছে যাবে।
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="min-h-[42px] px-4 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-[42px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
              >
                {isDeleting ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, মুছে ফেলুন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
