import { useEffect, useState } from 'react';
import { Camera, PackagePlus, Save, X } from 'lucide-react';
import { formatBDT, normalizeBarcode } from '../lib/format';
import { createProduct, updateProduct } from '../services/storeService';
import {
  PRODUCT_UNITS,
  type Category,
  type Product,
  type StaffRole,
} from '../types/store';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface ProductFormModalProps {
  isOpen: boolean;
  editingProduct: Product | null;
  initialBarcode?: string;
  categories: Category[];
  existingProducts: Product[];
  actor: { staffId: string; name: string; role: StaffRole };
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function ProductFormModal({
  isOpen,
  editingProduct,
  initialBarcode = '',
  categories,
  existingProducts,
  actor,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const [nameBn, setNameBn] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [barcode, setBarcode] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState<string>('পিস');
  const [hasStock, setHasStock] = useState(false);
  const [stockQty, setStockQty] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [imageUrl, setImageUrl] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    if (editingProduct) {
      setNameBn(editingProduct.nameBn);
      setNameEn(editingProduct.nameEn);
      setBarcode(editingProduct.barcode);
      setPurchasePrice(String(editingProduct.purchasePrice));
      setSellingPrice(String(editingProduct.sellingPrice));
      setCategoryId(editingProduct.categoryId);
      setUnit(editingProduct.unit || 'পিস');
      setHasStock(editingProduct.hasStock);
      setStockQty(String(editingProduct.stockQty));
      setLowStockThreshold(String(editingProduct.lowStockThreshold));
      setImageUrl(editingProduct.imageUrl || '');
    } else {
      setNameBn('');
      setNameEn('');
      setBarcode(initialBarcode);
      setPurchasePrice('');
      setSellingPrice('');
      setCategoryId(categories[0]?.id || '');
      setUnit('পিস');
      setHasStock(false);
      setStockQty('0');
      setLowStockThreshold('5');
      setImageUrl('');
    }
  }, [isOpen, editingProduct, initialBarcode, categories]);

  if (!isOpen) return null;

  const normalizedBarcode = normalizeBarcode(barcode);
  const duplicateProduct = normalizedBarcode
    ? existingProducts.find(
        (p) =>
          p.barcode.toLowerCase() === normalizedBarcode.toLowerCase() &&
          p.id !== editingProduct?.id
      )
    : undefined;

  const parsedPurchase = Number(purchasePrice) || 0;
  const parsedSelling = Number(sellingPrice) || 0;
  const profit = parsedSelling - parsedPurchase;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!navigator.onLine) {
      setErrorMsg('অফলাইন অবস্থায় পণ্য যোগ বা পরিবর্তন করা যাবে না। ইন্টারনেট সংযোগ চালু করে আবার চেষ্টা করুন।');
      return;
    }

    if (duplicateProduct) {
      setErrorMsg(
        `এই বারকোডটি ইতিমধ্যে "${duplicateProduct.nameBn}" পণ্যে ব্যবহার করা হয়েছে। একই বারকোড দুবার ব্যবহার করা যাবে না।`
      );
      return;
    }

    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) {
      setErrorMsg('অনুগ্রহ করে একটি ক্যাটাগরি নির্বাচন করুন। (না থাকলে আগে ক্যাটাগরি তৈরি করুন)');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nameBn,
        nameEn,
        barcode: normalizedBarcode,
        purchasePrice: parsedPurchase,
        sellingPrice: parsedSelling,
        categoryId: cat.id,
        categoryName: cat.nameBn,
        unit,
        hasStock,
        stockQty: Number(stockQty) || 0,
        lowStockThreshold: Number(lowStockThreshold) || 0,
        imageUrl,
      };

      if (editingProduct) {
        await updateProduct(editingProduct, payload, actor);
        onSaved(`"${nameBn.trim()}" পণ্যের তথ্য সফলভাবে আপডেট হয়েছে।`);
      } else {
        await createProduct(payload, actor);
        onSaved(`"${nameBn.trim()}" নতুন পণ্য হিসেবে ডাটাবেসে যোগ হয়েছে।`);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'পণ্য সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-3xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-blue-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center">
                <PackagePlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingProduct ? 'পণ্যের তথ্য সম্পাদনা' : 'নতুন পণ্য যোগ করুন'}
                </h3>
                <p className="text-xs text-slate-500">
                  দাম পরিবর্তন করলে স্বয়ংক্রিয়ভাবে প্রাইস হিস্ট্রি সংরক্ষিত হবে
                </p>
              </div>
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

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {errorMsg && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পণ্যের নাম (বাংলা) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nameBn}
                  onChange={(e) => setNameBn(e.target.value)}
                  placeholder="যেমন: মিনিকেট চাল"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পণ্যের নাম (English)
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Miniket Rice"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ক্যাটাগরি <span className="text-red-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                >
                  {categories.length === 0 && <option value="">আগে ক্যাটাগরি যোগ করুন</option>}
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nameBn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  একক (Unit) <span className="text-red-500">*</span>
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {PRODUCT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Barcode with Camera Scan */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                বারকোড নম্বর (ঐচ্ছিক, প্রতিটি পণ্যের জন্য আলাদা)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="স্ক্যান করুন বা বারকোড লিখুন..."
                  className={`flex-1 min-h-[44px] px-3.5 rounded-xl border text-sm font-mono-num focus:outline-none focus:ring-2 ${
                    duplicateProduct
                      ? 'border-red-400 focus:ring-red-500 bg-red-50/40'
                      : 'border-slate-300 focus:ring-blue-600'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="min-h-[44px] px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  স্ক্যান করুন
                </button>
              </div>
              {duplicateProduct && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  সতর্কতা: এই বারকোড ইতিমধ্যে "{duplicateProduct.nameBn}"-তে ব্যবহৃত হয়েছে!
                </p>
              )}
            </div>

            {/* Purchase & Selling Price */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  কেনা দাম (৳) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="০"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বিক্রির দাম (৳) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="০"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div className="flex flex-col justify-center">
                <span className="text-xs text-slate-500">প্রতি {unit} আনুমানিক লাভ</span>
                <span
                  className={`text-lg font-bold font-mono-num mt-0.5 ${
                    profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {formatBDT(profit)}
                </span>
              </div>
            </div>

            {/* Optional Stock Section */}
            <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-semibold text-slate-800 block">
                    স্টক পরিমাণ ট্র্যাকিং (ঐচ্ছিক)
                  </span>
                  <span className="text-xs text-slate-500">
                    চালু করলে ড্যাশবোর্ডে কম স্টকের পণ্য সতর্কতা দেখাবে
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={hasStock}
                  onChange={(e) => setHasStock(e.target.checked)}
                  className="w-5 h-5 rounded accent-blue-700 cursor-pointer"
                />
              </label>

              {hasStock && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      বর্তমান স্টক ({unit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={stockQty}
                      onChange={(e) => setStockQty(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      কম স্টক সতর্কতা সীমা
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Optional Image URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                পণ্যের ছবির লিংক (ঐচ্ছিক, https://...)
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/product.jpg"
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={isSaving || Boolean(duplicateProduct) || categories.length === 0}
                className="min-h-[44px] px-5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'সংরক্ষণ হচ্ছে...' : editingProduct ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        title="পণ্যের বারকোড স্ক্যান করুন"
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => {
          setBarcode(code);
          setIsScannerOpen(false);
        }}
      />
    </>
  );
}
