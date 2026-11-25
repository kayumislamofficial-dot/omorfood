import { useMemo, useState } from 'react';
import { FileText, Printer, Receipt, X } from 'lucide-react';
import { formatBDT, formatNumberBn, toBnDigits } from '../lib/format';
import {
  DEFAULT_STORE_SETTINGS,
  type CalculatorRow,
  type PrintLayoutMode,
  type StoreSettings,
} from '../types/store';

interface PrintInvoiceModalProps {
  isOpen: boolean;
  rows: CalculatorRow[];
  discount: number;
  settings: StoreSettings | null;
  staffName: string;
  onClose: () => void;
}

export function PrintInvoiceModal({
  isOpen,
  rows,
  discount,
  settings,
  staffName,
  onClose,
}: PrintInvoiceModalProps) {
  const [layoutMode, setLayoutMode] = useState<PrintLayoutMode>('a4');
  const [tempBuyerName, setTempBuyerName] = useState('');

  const activeItems = useMemo(
    () => rows.filter((r) => r.product !== null && r.quantity > 0),
    [rows]
  );

  const subtotal = useMemo(
    () =>
      activeItems.reduce(
        (sum, r) => sum + (r.product ? r.product.sellingPrice * r.quantity : 0),
        0
      ),
    [activeItems]
  );

  const safeDiscount = Math.max(0, Math.min(subtotal, discount));
  const grandTotal = Math.max(0, subtotal - safeDiscount);

  const now = useMemo(() => new Date(), [isOpen]);
  const slipRef = useMemo(() => {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `OMR-${hh}${mm}${ss}`;
  }, [now]);

  const dateStr = useMemo(
    () =>
      new Intl.DateTimeFormat('bn-BD', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(now),
    [now]
  );

  const timeStr = useMemo(
    () =>
      new Intl.DateTimeFormat('bn-BD', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(now),
    [now]
  );

  if (!isOpen) return null;

  const storeName = settings?.storeName || DEFAULT_STORE_SETTINGS.storeName;
  const storeAddress = settings?.storeAddress || DEFAULT_STORE_SETTINGS.storeAddress;
  const storePhones = settings?.storePhones || DEFAULT_STORE_SETTINGS.storePhones;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Modal Controls (hidden during print) */}
        <div className="no-print px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">ইনভয়েস প্রিভিউ ও প্রিন্ট</h3>
            <p className="text-xs text-slate-500">
              এই রসিদ শুধুমাত্র প্রিন্টের জন্য; কোনো তথ্য ডাটাবেসে সংরক্ষণ করা হয় না।
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Layout Mode Switch */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => setLayoutMode('a4')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                  layoutMode === 'a4'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                A4 প্রিন্ট
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('thermal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                  layoutMode === 'thermal'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                80mm থার্মাল
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              disabled={activeItems.length === 0}
              className="min-h-[40px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              প্রিন্ট করুন
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 flex items-center justify-center cursor-pointer"
              aria-label="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Temporary Buyer Name Bar (not saved anywhere) */}
        <div className="no-print px-5 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
            রসিদে ক্রেতার নাম (ঐচ্ছিক, সংরক্ষণ হবে না):
          </label>
          <input
            type="text"
            value={tempBuyerName}
            onChange={(e) => setTempBuyerName(e.target.value)}
            placeholder="যেমন: নগদ ক্রেতা / নাম লিখুন..."
            className="flex-1 min-w-[200px] min-h-[38px] px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {/* Printable Sheet Preview Area */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 flex justify-center">
          <div
            id="omor-print-root"
            className={`bg-white text-slate-900 border border-slate-200 shadow-sm ${
              layoutMode === 'thermal'
                ? 'thermal-mode w-[302px] p-4 text-xs'
                : 'w-full max-w-[760px] p-7 sm:p-10 text-sm'
            }`}
          >
            {/* Store Header matching the real Omor Food paper receipt */}
            <div className="text-center border-b-2 border-blue-800 pb-3 mb-3">
              <h1
                className={`font-bold text-blue-800 tracking-tight ${
                  layoutMode === 'thermal' ? 'text-2xl' : 'text-3xl'
                }`}
              >
                {storeName}
              </h1>
              <p className="text-blue-900 font-semibold mt-0.5">{storeAddress}</p>
              <p className="text-slate-700 text-xs mt-1 font-mono-num">
                মোবাইল: {storePhones}
              </p>
            </div>

            {/* Meta Info Row */}
            <div
              className={`grid gap-1.5 pb-3 mb-3 border-b border-slate-200 ${
                layoutMode === 'thermal' ? 'grid-cols-1 text-[11px]' : 'grid-cols-2 text-xs'
              }`}
            >
              <div>
                <span className="font-semibold text-blue-900">নাম: </span>
                <span>{tempBuyerName.trim() || 'নগদ ক্রেতা'}</span>
              </div>
              <div className={layoutMode === 'thermal' ? '' : 'text-right'}>
                <span className="font-semibold text-blue-900">স্লিপ নং: </span>
                <span className="font-mono-num">{toBnDigits(slipRef)}</span>
              </div>
              <div>
                <span className="font-semibold text-blue-900">তারিখ: </span>
                <span>{dateStr}</span>
              </div>
              <div className={layoutMode === 'thermal' ? '' : 'text-right'}>
                <span className="font-semibold text-blue-900">সময়: </span>
                <span>{timeStr}</span>
              </div>
            </div>

            {/* Items Table matching "ক্র:নং | নাম | পরিমাণ | দর | টাকা" */}
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-blue-50 text-blue-900 border-y border-blue-700">
                  <th className="py-2 px-1.5 text-left font-bold border-r border-blue-200 w-10">
                    ক্র:নং
                  </th>
                  <th className="py-2 px-2 text-left font-bold border-r border-blue-200">
                    নাম
                  </th>
                  <th className="py-2 px-1.5 text-right font-bold border-r border-blue-200 whitespace-nowrap">
                    পরিমাণ
                  </th>
                  {layoutMode === 'a4' && (
                    <th className="py-2 px-2 text-right font-bold border-r border-blue-200 whitespace-nowrap">
                      দর
                    </th>
                  )}
                  <th className="py-2 px-1.5 text-right font-bold whitespace-nowrap">
                    টাকা
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((row, idx) => {
                  const product = row.product!;
                  const lineTotal = product.sellingPrice * row.quantity;
                  return (
                    <tr key={row.rowId} className="border-b border-slate-200">
                      <td className="py-2 px-1.5 font-mono-num text-slate-700 border-r border-slate-200 align-top">
                        {toBnDigits(idx + 1)}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 align-top">
                        <div className="font-medium text-slate-900">{product.nameBn}</div>
                        {layoutMode === 'thermal' && (
                          <div className="text-[10px] text-slate-500 font-mono-num">
                            দর: {formatBDT(product.sellingPrice)} / {product.unit}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-1.5 text-right font-mono-num whitespace-nowrap border-r border-slate-200 align-top">
                        {formatNumberBn(row.quantity)} {product.unit}
                      </td>
                      {layoutMode === 'a4' && (
                        <td className="py-2 px-2 text-right font-mono-num whitespace-nowrap border-r border-slate-200 align-top">
                          {formatBDT(product.sellingPrice)}
                        </td>
                      )}
                      <td className="py-2 px-1.5 text-right font-semibold font-mono-num whitespace-nowrap align-top">
                        {formatBDT(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals Summary */}
            <div className="mt-4 pt-3 border-t-2 border-blue-800 space-y-1.5">
              <div className="flex justify-between text-slate-700">
                <span>মোট ({toBnDigits(activeItems.length)}টি পণ্য):</span>
                <span className="font-mono-num font-semibold">{formatBDT(subtotal)}</span>
              </div>
              {safeDiscount > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>ছাড় / ডিসকাউন্ট:</span>
                  <span className="font-mono-num font-semibold">- {formatBDT(safeDiscount)}</span>
                </div>
              )}
              <div
                className={`flex justify-between font-bold text-blue-900 pt-1.5 border-t border-slate-200 ${
                  layoutMode === 'thermal' ? 'text-sm' : 'text-lg'
                }`}
              >
                <span>সর্বমোট টাকা:</span>
                <span className="font-mono-num">{formatBDT(grandTotal)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-3 border-t border-dashed border-slate-300 flex items-center justify-between text-[11px] text-slate-500">
              <span>প্রস্তুতকারক: {staffName}</span>
              <span>ধন্যবাদ, আবার আসবেন!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
