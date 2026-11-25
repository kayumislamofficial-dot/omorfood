import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Keyboard, RefreshCw, X } from 'lucide-react';
import { normalizeBarcode } from '../lib/format';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScannerModal({
  isOpen,
  title = 'বারকোড স্ক্যান করুন',
  onClose,
  onScan,
}: BarcodeScannerModalProps) {
  const rawId = useId();
  const regionId = `qr-reader-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  const [cameraError, setCameraError] = useState<string>('');
  const [isStarting, setIsStarting] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      handledRef.current = false;
      setManualCode('');
      setCameraError('');
      return;
    }

    let cancelled = false;
    handledRef.current = false;
    setCameraError('');
    setIsStarting(true);

    const startScanner = async () => {
      await new Promise((r) => setTimeout(r, 120));
      if (cancelled) return;

      const element = document.getElementById(regionId);
      if (!element) return;

      try {
        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: { width: 250, height: 140 },
            aspectRatio: 1.4,
          },
          (decodedText) => {
            if (handledRef.current || cancelled) return;
            const cleaned = normalizeBarcode(decodedText);
            if (!cleaned) return;
            handledRef.current = true;
            onScan(cleaned);
          },
          () => {
            // ignore per-frame decode misses
          }
        );
        if (!cancelled) {
          setIsStarting(false);
        }
      } catch (err) {
        if (!cancelled) {
          setIsStarting(false);
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
            setCameraError('ক্যামেরার অনুমতি পাওয়া যায়নি। ব্রাউজার সেটিংস থেকে ক্যামেরা Allow করুন অথবা নিচে ম্যানুয়ালি বারকোড লিখুন।');
          } else {
            setCameraError('ক্যামেরা চালু করা যায়নি। নিচে হাতে বা USB স্ক্যানার দিয়ে বারকোড দিন।');
          }
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (instance) {
        try {
          if (instance.isScanning) {
            instance
              .stop()
              .then(() => {
                try {
                  instance.clear();
                } catch {
                  // ignore
                }
              })
              .catch(() => {});
          } else {
            instance.clear();
          }
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [isOpen, regionId, onScan, restartKey]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeBarcode(manualCode);
    if (!cleaned) return;
    onScan(cleaned);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-blue-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500">পণ্যের বারকোড ক্যামেরার সামনে ধরুন</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-200 min-h-[230px] flex items-center justify-center">
            <div id={regionId} className="w-full" />
            {isStarting && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white text-sm gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                <span>ক্যামেরা চালু হচ্ছে...</span>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-5 text-center gap-3">
                <p className="text-xs leading-relaxed text-slate-200">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => setRestartKey((k) => k + 1)}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  আবার চেষ্টা করুন
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Keyboard className="w-3.5 h-3.5 text-blue-700" />
              অথবা ম্যানুয়ালি / USB স্ক্যানারে বারকোড দিন
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="যেমন: 8901234567890"
                className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                autoFocus
              />
              <button
                type="submit"
                disabled={!normalizeBarcode(manualCode)}
                className="min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                ব্যবহার করুন
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
