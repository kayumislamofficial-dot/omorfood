import { useMemo, useState } from 'react';
import { Camera, Check, Package, Search, X } from 'lucide-react';
import { formatBDT, normalizeBarcode, toBnDigits } from '../lib/format';
import { type Category, type Product } from '../types/store';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface ProductSelectModalProps {
  isOpen: boolean;
  products: Product[];
  categories: Category[];
  onClose: () => void;
  onSelect: (product: Product) => void;
}

const PAGE_SIZE = 30;

export function ProductSelectModal({
  isOpen,
  products,
  categories,
  onClose,
  onSelect,
}: ProductSelectModalProps) {
  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanError, setScanError] = useState('');

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
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
  }, [products, query, selectedCategoryId]);

  if (!isOpen) return null;

  const visibleProducts = filteredProducts.slice(0, visibleLimit);

  const handleBarcodeMatch = (rawCode: string) => {
    const cleaned = normalizeBarcode(rawCode);
    setIsScannerOpen(false);
    const match = products.find((p) => p.barcode.toLowerCase() === cleaned.toLowerCase());
    if (match) {
      setScanError('');
      onSelect(match);
    } else {
      setQuery(cleaned);
      setScanError(`"${cleaned}" বারকোডের কোনো পণ্য ডাটাবেসে পাওয়া যায়নি।`);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-3xl border border-slate-200 shadow-2xl max-h-[88vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-blue-50/50">
            <div>
              <h3 className="text-lg font-bold text-slate-900">পণ্য নির্বাচন করুন</h3>
              <p className="text-xs text-slate-500">
                বাংলা/ইংরেজি নাম বা বারকোড দিয়ে খুঁজুন অথবা ক্যামেরায় স্ক্যান করুন
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              aria-label="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Scan Controls */}
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setScanError('');
                    setVisibleLimit(PAGE_SIZE);
                  }}
                  placeholder="পণ্যের নাম (বাংলা/English) বা বারকোড লিখুন..."
                  className="w-full min-h-[46px] pl-10 pr-4 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="min-h-[46px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                স্ক্যান করুন
              </button>
            </div>

            {scanError && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                {scanError}
              </div>
            )}

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('all');
                  setVisibleLimit(PAGE_SIZE);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  selectedCategoryId === 'all'
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                সব পণ্য ({toBnDigits(products.length)})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setVisibleLimit(PAGE_SIZE);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    selectedCategoryId === cat.id
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.nameBn}
                </button>
              ))}
            </div>
          </div>

          {/* Product Results */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {visibleProducts.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                <p className="text-sm font-semibold text-slate-700">কোনো পণ্য পাওয়া যায়নি</p>
                <p className="text-xs text-slate-500 mt-1">
                  সার্চ শব্দ পরিবর্তন করে দেখুন অথবা অন্য ক্যাটাগরি নির্বাচন করুন।
                </p>
              </div>
            ) : (
              visibleProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelect(product)}
                  className="w-full px-5 py-3.5 text-left hover:bg-blue-50/70 transition-colors flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {product.nameBn}
                      </span>
                      {product.nameEn && (
                        <span className="text-xs text-slate-500 truncate hidden sm:inline">
                          ({product.nameEn})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span>{product.categoryName}</span>
                      <span aria-hidden="true">·</span>
                      <span>একক: {product.unit}</span>
                      {product.barcode && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num">{product.barcode}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold text-blue-700 font-mono-num">
                        {formatBDT(product.sellingPrice)}
                      </div>
                      <div className="text-[11px] text-slate-400">প্রতি {product.unit}</div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                </button>
              ))
            )}

            {filteredProducts.length > visibleLimit && (
              <div className="p-4 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  আরও দেখুন ({toBnDigits(filteredProducts.length - visibleLimit)}টি বাকি)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        title="হিসাবে পণ্য যোগ করতে স্ক্যান করুন"
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeMatch}
      />
    </>
  );
}
