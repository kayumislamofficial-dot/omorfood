import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, Copy, Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton({
  variant = 'primary',
}: {
  variant?: 'primary' | 'compact' | 'subtle';
}) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isInstalled || Capacitor.isNativePlatform()) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) return;
    } else {
      setShowGuideModal(true);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const buttonClass =
    variant === 'compact'
      ? 'min-h-[38px] px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors'
      : variant === 'subtle'
      ? 'w-full min-h-[42px] px-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors'
      : 'w-full min-h-[44px] px-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors';

  return (
    <>
      <button type="button" onClick={handleClick} className={buttonClass}>
        <Download className="w-4 h-4 shrink-0" />
        <span>{variant === 'compact' ? 'ইনস্টল' : 'ফোনে অ্যাপ ইনস্টল করুন'}</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isIOS ? 'iPhone / iPad-এ ইনস্টল করুন' : 'মোবাইলে অ্যাপ ইনস্টল করুন'}
                  </h3>
                  <p className="text-xs text-slate-500">ওমর ফুড — হোম স্ক্রিন অ্যাপ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-w-[38px] min-h-[38px] rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                aria-label="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-sm text-slate-700 bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-700">১.</span>
                  <span>
                    ফোনের <strong>Safari</strong> ব্রাউজারে এই লিংকটি খুলুন।
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-700">২.</span>
                  <span className="inline-flex flex-wrap items-center gap-1">
                    নিচের বার থেকে <Share className="w-4 h-4 text-blue-700 inline" />{' '}
                    <strong>Share</strong> আইকনে ট্যাপ করুন।
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-700">৩.</span>
                  <span>
                    নিচে স্ক্রল করে <strong>Add to Home Screen</strong> চাপুন এবং <strong>Add</strong> দিন।
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-sm text-slate-700 bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-700">১.</span>
                  <span>
                    ফোনের <strong>Google Chrome</strong> ব্রাউজারে অ্যাপের লিংকটি সরাসরি খুলুন।
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-700">২.</span>
                  <span>
                    উপরের ডান কোণায় <strong>⋮ (তিন ডট)</strong> মেনুতে ট্যাপ করুন।
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-700">৩.</span>
                  <span>
                    <strong>Install app</strong> অথবা <strong>Add to Home screen</strong> নির্বাচন করে ইনস্টল করুন।
                  </span>
                </li>
              </ol>
            )}

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">ফোনে খোলার লিংক:</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={window.location.origin}
                  className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono-num text-slate-700"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="min-h-[40px] px-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'কপি হয়েছে' : 'কপি'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer"
            >
              বুঝেছি
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="no-print fixed bottom-16 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>অফলাইন মোড — সংরক্ষিত ক্যাশ ডেটা ব্যবহৃত হচ্ছে</span>
    </div>
  );
}
