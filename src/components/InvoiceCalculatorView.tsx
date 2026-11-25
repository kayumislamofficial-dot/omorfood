import { useMemo, useState } from 'react';
import {
  Calculator,
  Camera,
  Eraser,
  Minus,
  Plus,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import { formatBDT, normalizeBarcode, toBnDigits } from '../lib/format';
import {
  type CalculatorRow,
  type Category,
  type Product,
  type StoreSettings,
} from '../types/store';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { PrintInvoiceModal } from './PrintInvoiceModal';
import { ProductSelectModal } from './ProductSelectModal';

interface InvoiceCalculatorViewProps {
  products: Product[];
  categories: Category[];
  settings: StoreSettings | null;
  staffName: string;
}

function createEmptyRow(): CalculatorRow {
  return {
    rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product: null,
    quantity: 1,
  };
}

export function InvoiceCalculatorView({
  products,
  categories,
  settings,
  staffName,
}: InvoiceCalculatorViewProps) {
  const [rows, setRows] = useState<CalculatorRow[]>(() => [
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ]);
  const [discountInput, setDiscountInput] = useState<string>('');
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [isQuickScanOpen, setIsQuickScanOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [quickBarcodeText, setQuickBarcodeText] = useState('');
  const [scanMessage, setScanMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const selectedCount = useMemo(
    () => rows.filter((r) => r.product !== null).length,
    [rows]
  );

  const subtotal = useMemo(
    () =>
      rows.reduce((sum, r) => {
        if (!r.product || !Number.isFinite(r.quantity) || r.quantity <= 0) return sum;
        return sum + r.product.sellingPrice * r.quantity;
      }, 0),
    [rows]
  );

  const discountAmount = useMemo(() => {
    const parsed = Number(discountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(subtotal, parsed);
  }, [discountInput, subtotal]);

  const grandTotal = Math.max(0, subtotal - discountAmount);

  const handleSelectProductForRow = (product: Product) => {
    if (!activeRowId) return;
    setRows((prev) =>
      prev.map((row) =>
        row.rowId === activeRowId
          ? { ...row, product, quantity: row.quantity > 0 ? row.quantity : 1 }
          : row
      )
    );
    setActiveRowId(null);
    setScanMessage(null);
  };

  const addScannedProduct = (rawCode: string) => {
    const cleaned = normalizeBarcode(rawCode);
    if (!cleaned) return;
    const match = products.find((p) => p.barcode.toLowerCase() === cleaned.toLowerCase());
    if (!match) {
      setScanMessage({
        type: 'err',
        text: `"${cleaned}" বারকোডের কোনো পণ্য ডাটাবেসে পাওয়া যায়নি।`,
      });
      return;
    }

    setRows((prev) => {
      const existingIdx = prev.findIndex((r) => r.product?.id === match.id);
      if (existingIdx >= 0) {
        return prev.map((r, i) =>
          i === existingIdx ? { ...r, quantity: Number((r.quantity + 1).toFixed(3)) } : r
        );
      }
      const emptyIdx = prev.findIndex((r) => r.product === null);
      if (emptyIdx >= 0) {
        return prev.map((r, i) => (i === emptyIdx ? { ...r, product: match, quantity: 1 } : r));
      }
      return [...prev, { rowId: createEmptyRow().rowId, product: match, quantity: 1 }];
    });

    setScanMessage({
      type: 'ok',
      text: `${match.nameBn} হিসাবে যোগ করা হয়েছে (${formatBDT(match.sellingPrice)})`,
    });
    setQuickBarcodeText('');
  };

  const handleStepQty = (rowId: string, delta: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const next = Math.max(0.1, Number((r.quantity + delta).toFixed(3)));
        return { ...r, quantity: next };
      })
    );
  };

  const handleManualQty = (rowId: string, rawVal: string) => {
    if (rawVal === '') {
      setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, quantity: 0 } : r)));
      return;
    }
    const parsed = Number(rawVal);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, quantity: parsed } : r)));
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        return [createEmptyRow()];
      }
      return prev.filter((r) => r.rowId !== rowId);
    });
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleClearAll = () => {
    setRows([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
    setDiscountInput('');
    setScanMessage(null);
    setQuickBarcodeText('');
  };

  return (
    <div className="space-y-5">
      {/* Page Title & Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold mb-1">
              <Calculator className="w-4 h-4" />
              তাৎক্ষণিক হিসাব ক্যালকুলেটর (শুধুমাত্র লোকাল মেমোরি)
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              স্মার্ট ইনভয়েস বিল্ডার ও ক্যালকুলেটর
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              প্রতিটি সারিতে পণ্য বাছাই করুন অথবা বারকোড স্ক্যান করুন। মোট হিসাব স্বয়ংক্রিয়ভাবে তৈরি হবে।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsQuickScanOpen(true)}
              className="min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4" />
              বারকোড স্ক্যান
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Eraser className="w-4 h-4" />
              সব মুছুন
            </button>
            <button
              type="button"
              onClick={() => setIsPrintOpen(true)}
              disabled={selectedCount === 0}
              className="min-h-[44px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              প্রিন্ট করুন
            </button>
          </div>
        </div>

        {/* Fast Barcode Entry Bar (USB Scanner or Manual Barcode) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addScannedProduct(quickBarcodeText);
          }}
          className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={quickBarcodeText}
              onChange={(e) => setQuickBarcodeText(e.target.value)}
              placeholder="সরাসরি বারকোড নম্বর লিখে বা USB স্ক্যানারে স্ক্যান করে Enter চাপুন..."
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            disabled={!quickBarcodeText.trim()}
            className="min-h-[44px] px-5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 disabled:opacity-50 text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors"
          >
            বারকোডে যোগ করুন
          </button>
        </form>

        {scanMessage && (
          <div
            className={`mt-3 rounded-xl px-3.5 py-2.5 text-xs font-medium border ${
              scanMessage.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {scanMessage.text}
          </div>
        )}
      </div>

      {/* Star Tech PC Builder-style Product Rows */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Desktop Header */}
        <div className="hidden md:grid md:grid-cols-12 gap-3 px-5 py-3 bg-blue-50/70 border-b border-slate-200 text-xs font-bold text-blue-900">
          <div className="col-span-1">ক্র:নং</div>
          <div className="col-span-4">পণ্যের নাম ও একক</div>
          <div className="col-span-2 text-right">বিক্রির দাম</div>
          <div className="col-span-2 text-center">পরিমাণ</div>
          <div className="col-span-2 text-right">উপমোট</div>
          <div className="col-span-1 text-right">অ্যাকশন</div>
        </div>

        <div className="divide-y divide-slate-100">
          {rows.map((row, index) => {
            const product = row.product;
            const rowSubtotal = product ? product.sellingPrice * row.quantity : 0;

            return (
              <div
                key={row.rowId}
                className="p-4 sm:px-5 sm:py-4 grid grid-cols-1 md:grid-cols-12 gap-3 md:items-center hover:bg-slate-50/70 transition-colors"
              >
                {/* Serial & Mobile Title Row */}
                <div className="md:col-span-1 flex items-center justify-between md:justify-start">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs font-mono-num">
                    {toBnDigits(index + 1)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.rowId)}
                    className="md:hidden min-w-[36px] min-h-[36px] rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                    aria-label="সারি মুছুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Product Name + Choose Button */}
                <div className="md:col-span-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {product ? (
                      <>
                        <div className="font-semibold text-sm text-slate-900 truncate">
                          {product.nameBn}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{product.categoryName}</span>
                          <span aria-hidden="true">·</span>
                          <span>একক: {product.unit}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-slate-400 font-medium">
                        এখনও কোনো পণ্য নির্বাচন করা হয়নি
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveRowId(row.rowId)}
                    className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      product
                        ? 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'bg-blue-700 text-white hover:bg-blue-800'
                    }`}
                  >
                    {product ? 'পরিবর্তন' : 'পণ্য বাছুন'}
                  </button>
                </div>

                {/* Unit Selling Price */}
                <div className="md:col-span-2 flex md:block items-center justify-between">
                  <span className="md:hidden text-xs text-slate-500">বিক্রির দাম:</span>
                  <div className="md:text-right font-mono-num text-sm font-semibold text-slate-800">
                    {product ? formatBDT(product.sellingPrice) : '—'}
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="md:col-span-2 flex items-center justify-between md:justify-center gap-1.5">
                  <span className="md:hidden text-xs text-slate-500">পরিমাণ:</span>
                  <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden">
                    <button
                      type="button"
                      disabled={!product}
                      onClick={() => handleStepQty(row.rowId, -1)}
                      className="min-w-[38px] min-h-[38px] flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      aria-label="পরিমাণ কমান"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      disabled={!product}
                      value={row.quantity === 0 ? '' : row.quantity}
                      onChange={(e) => handleManualQty(row.rowId, e.target.value)}
                      className="w-16 text-center text-sm font-bold font-mono-num text-slate-900 focus:outline-none disabled:bg-slate-50"
                      aria-label="পরিমাণ"
                    />
                    <button
                      type="button"
                      disabled={!product}
                      onClick={() => handleStepQty(row.rowId, 1)}
                      className="min-w-[38px] min-h-[38px] flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      aria-label="পরিমাণ বাড়ান"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subtotal */}
                <div className="md:col-span-2 flex md:block items-center justify-between">
                  <span className="md:hidden text-xs text-slate-500">উপমোট:</span>
                  <div className="md:text-right font-mono-num text-sm font-bold text-blue-700">
                    {product ? formatBDT(rowSubtotal) : '৳ ০'}
                  </div>
                </div>

                {/* Remove Button (Desktop) */}
                <div className="hidden md:flex md:col-span-1 justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.rowId)}
                    className="min-w-[38px] min-h-[38px] rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer transition-colors"
                    title="সারি মুছুন"
                    aria-label="সারি মুছুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add More Product Row Bar */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleAddRow}
            className="min-h-[42px] px-4 rounded-xl border border-blue-300 bg-white hover:bg-blue-50 text-blue-700 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            আরও পণ্য যোগ করুন
          </button>
          <span className="text-xs text-slate-500">
            নির্বাচিত পণ্য: <strong className="text-slate-900 font-mono-num">{toBnDigits(selectedCount)}</strong>টি
          </span>
        </div>
      </div>

      {/* Summary & Grand Total Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-end">
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              ছাড় / ডিসকাউন্ট (টাকায়, ঐচ্ছিক)
            </label>
            <div className="flex items-center gap-3 max-w-xs">
              <input
                type="number"
                min="0"
                step="any"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="০"
                className="w-full min-h-[46px] px-4 rounded-xl border border-slate-300 text-base font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {discountInput && (
                <button
                  type="button"
                  onClick={() => setDiscountInput('')}
                  className="min-h-[46px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  রিসেট
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              নোট: পেজ রিফ্রেশ করলে বা "সব মুছুন" চাপলে এই হিসাব মুছে যাবে; পণ্যের মূল ডাটাবেসে কোনো পরিবর্তন হবে না।
            </p>
          </div>

          <div className="bg-blue-50/70 rounded-2xl border border-blue-200/80 p-5 space-y-2.5">
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span>মোট উপমোট</span>
              <span className="font-mono-num font-semibold">{formatBDT(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span>ছাড় / ডিসকাউন্ট</span>
              <span className="font-mono-num font-semibold text-slate-900">
                - {formatBDT(discountAmount)}
              </span>
            </div>
            <div className="pt-2.5 border-t border-blue-200 flex items-center justify-between">
              <span className="text-base font-bold text-blue-900">সর্বমোট (Grand Total)</span>
              <span className="text-2xl sm:text-3xl font-bold text-blue-700 font-mono-num">
                {formatBDT(grandTotal)}
              </span>
            </div>
            <div className="pt-2 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleClearAll}
                className="flex-1 min-h-[46px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Eraser className="w-4 h-4" />
                সব মুছুন
              </button>
              <button
                type="button"
                onClick={() => setIsPrintOpen(true)}
                disabled={selectedCount === 0}
                className="flex-1 min-h-[46px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                প্রিন্ট ইনভয়েস
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProductSelectModal
        isOpen={activeRowId !== null}
        products={products}
        categories={categories}
        onClose={() => setActiveRowId(null)}
        onSelect={handleSelectProductForRow}
      />

      <BarcodeScannerModal
        isOpen={isQuickScanOpen}
        title="হিসাবে যোগ করতে বারকোড স্ক্যান করুন"
        onClose={() => setIsQuickScanOpen(false)}
        onScan={(code) => {
          setIsQuickScanOpen(false);
          addScannedProduct(code);
        }}
      />

      <PrintInvoiceModal
        isOpen={isPrintOpen}
        rows={rows}
        discount={discountAmount}
        settings={settings}
        staffName={staffName}
        onClose={() => setIsPrintOpen(false)}
      />
    </div>
  );
}
