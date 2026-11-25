import { useState } from 'react';
import { motion } from 'motion/react';
import { Delete, KeyRound, Lock, LogOut, ShieldCheck, Smartphone, UserPlus } from 'lucide-react';
import { type User } from 'firebase/auth';
import { verifyPin } from '../lib/crypto';
import { signInWithGoogleDevice, signOutGoogleDevice } from '../lib/firebase';
import { toBnDigits } from '../lib/format';
import { createStaffProfile } from '../services/storeService';
import { type StaffProfile } from '../types/store';
import { OmorFoodMark } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface PinLoginScreenProps {
  firebaseUser: User | null;
  isAuthorizedDevice: boolean;
  offlineDeviceEmail?: string | null;
  isOnline?: boolean;
  canCreateAdminBootstrap: boolean;
  staffList: StaffProfile[];
  staffLoading: boolean;
  lockNotice?: string;
  onClearOfflineDevice?: () => void;
  onUnlock: (staff: StaffProfile) => void;
}

export function PinLoginScreen({
  firebaseUser,
  isAuthorizedDevice,
  offlineDeviceEmail = null,
  isOnline = true,
  canCreateAdminBootstrap,
  staffList,
  staffLoading,
  lockNotice,
  onClearOfflineDevice,
  onUnlock,
}: PinLoginScreenProps) {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  // First-run Admin PIN bootstrap state
  const [adminName, setAdminName] = useState('ওমর ফুড অ্যাডমিন');
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  const handleGoogleConnect = async () => {
    setErrorMsg('');
    setIsConnectingGoogle(true);
    try {
      await signInWithGoogleDevice();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('popup-closed')) {
        setErrorMsg('লগইন উইন্ডোটি বন্ধ করা হয়েছে। আবার চেষ্টা করুন।');
      } else {
        setErrorMsg('Google অ্যাকাউন্ট সংযুক্ত করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      }
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleBootstrapAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!adminName.trim()) {
      setErrorMsg('অ্যাডমিনের নাম লিখুন।');
      return;
    }
    if (!/^\d{4,6}$/.test(setupPin)) {
      setErrorMsg('পিন অবশ্যই ৪ থেকে ৬ সংখ্যার হতে হবে।');
      return;
    }
    if (setupPin !== setupConfirm) {
      setErrorMsg('দুইবার দেওয়া পিন মেলেনি।');
      return;
    }
    setIsChecking(true);
    try {
      await createStaffProfile({
        name: adminName.trim(),
        role: 'admin',
        pin: setupPin,
      });
      setSetupPin('');
      setSetupConfirm('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'অ্যাডমিন পিন তৈরি করা যায়নি।');
    } finally {
      setIsChecking(false);
    }
  };

  const verifyEnteredPin = async (candidatePin: string) => {
    if (!candidatePin || candidatePin.length < 4) {
      setErrorMsg('কমপক্ষে ৪ সংখ্যার পিন দিন।');
      return;
    }
    setErrorMsg('');
    setIsChecking(true);
    try {
      let matchedInactive = false;
      for (const staff of staffList) {
        const isMatch = await verifyPin(candidatePin, staff.pinSalt, staff.pinHash);
        if (isMatch) {
          if (!staff.isActive) {
            matchedInactive = true;
            break;
          }
          setPinInput('');
          onUnlock(staff);
          return;
        }
      }
      if (matchedInactive) {
        setErrorMsg('আপনার স্টাফ অ্যাক্সেস বর্তমানে অ্যাডমিন কর্তৃক বন্ধ করা হয়েছে।');
      } else {
        setErrorMsg('ভুল পিন! অনুগ্রহ করে সঠিক পিন দিন।');
      }
      setPinInput('');
    } catch {
      setErrorMsg('পিন যাচাই করতে সমস্যা হয়েছে।');
    } finally {
      setIsChecking(false);
    }
  };

  const appendDigit = (digit: string) => {
    if (isChecking || pinInput.length >= 6) return;
    setErrorMsg('');
    const next = pinInput + digit;
    setPinInput(next);
  };

  const removeLastDigit = () => {
    if (isChecking) return;
    setErrorMsg('');
    setPinInput((prev) => prev.slice(0, -1));
  };

  const handlePinFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void verifyEnteredPin(pinInput);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/60 to-slate-100 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-blue-900/5 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-blue-700 px-6 py-6 text-white text-center">
          <div className="inline-flex p-2 rounded-2xl bg-white/10 border border-white/20 mb-3">
            <OmorFoodMark className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ওমর ফুড</h1>
          <p className="text-xs text-blue-100 mt-1">
            কালিবাড়ী, ঠাকুরগাঁও · স্মার্ট স্টোর লগইন
          </p>
        </div>

        <div className="p-6 sm:p-7">
          {lockNotice && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs font-medium text-amber-800">
              {lockNotice}
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Step 1: Device not yet connected with Google (and no offline cache) */}
          {!firebaseUser && !offlineDeviceEmail && (
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 mx-auto flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">কেন্দ্রীয় ডাটাবেসে সংযুক্ত হোন</h2>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  সব মোবাইল ও কম্পিউটারে একই পণ্যের তালিকা ও দাম দেখতে একবার Google অ্যাকাউন্ট দিয়ে ডিভাইসটি সংযুক্ত করুন। এরপর ইন্টারনেট ছাড়াও পিন দিয়ে লগইন করতে পারবেন।
                </p>
              </div>
              <button
                type="button"
                onClick={handleGoogleConnect}
                disabled={isConnectingGoogle || !isOnline}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-5 h-5" />
                {!isOnline
                  ? 'প্রথমবার সংযোগের জন্য ইন্টারনেট চালু করুন'
                  : isConnectingGoogle
                  ? 'সংযুক্ত হচ্ছে...'
                  : 'Google দিয়ে ডিভাইস সংযুক্ত করুন'}
              </button>
            </div>
          )}

          {/* Step 2: Google signed in, but email not authorized by Admin */}
          {firebaseUser && !isAuthorizedDevice && (
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">ডিভাইস অনুমোদনের অপেক্ষায়</h2>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  আপনার ইমেইল <span className="font-mono-num font-semibold text-slate-900">{firebaseUser.email}</span> এখনও স্টোর অ্যাডমিনের অনুমোদিত তালিকায় যুক্ত নেই। অ্যাডমিনকে বলুন স্টাফ সেকশন থেকে এই ইমেইলটি অনুমোদন করতে।
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClearOfflineDevice?.();
                  void signOutGoogleDevice();
                }}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                অন্য Google অ্যাকাউন্ট ব্যবহার করুন
              </button>
            </div>
          )}

          {/* Step 3: Loading staff profiles */}
          {isAuthorizedDevice && staffLoading && (
            <div className="py-10 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-600">ডাটাবেস থেকে তথ্য লোড হচ্ছে...</p>
            </div>
          )}

          {/* Step 4: First-Run Admin PIN Bootstrap */}
          {firebaseUser && isAuthorizedDevice && !staffLoading && staffList.length === 0 && (
            <div>
              {canCreateAdminBootstrap ? (
                <form onSubmit={handleBootstrapAdmin} className="space-y-4">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">প্রথম অ্যাডমিন পিন সেটআপ</h2>
                      <p className="text-xs text-slate-500">দোকান পরিচালনার জন্য আপনার ৪–৬ সংখ্যার গোপন পিন তৈরি করুন</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">অ্যাডমিনের নাম</label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      placeholder="যেমন: ওমর ফুড ম্যানেজার"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">নতুন পিন (৪–৬ সংখ্যা)</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={setupPin}
                      onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-600"
                      placeholder="••••"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">পিন নিশ্চিত করুন</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={setupConfirm}
                      onChange={(e) => setSetupConfirm(e.target.value.replace(/\D/g, ''))}
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-600"
                      placeholder="••••"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isChecking}
                    className="w-full min-h-[48px] rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold text-sm transition-colors cursor-pointer"
                  >
                    {isChecking ? 'সংরক্ষণ হচ্ছে...' : 'অ্যাডমিন পিন সংরক্ষণ করুন'}
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-3 py-4">
                  <p className="text-sm text-slate-700">
                    এখনও কোনো অ্যাডমিন পিন তৈরি হয়নি। প্রথমে দোকানের অ্যাডমিনকে পিন সেটআপ করতে বলুন।
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Standard PIN Login Screen (works both Online & Offline!) */}
          {isAuthorizedDevice && !staffLoading && staffList.length > 0 && (
            <form onSubmit={handlePinFormSubmit} className="space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-1">
                  <KeyRound className="w-3.5 h-3.5" />
                  স্টাফ ও অ্যাডমিন পিন লগইন {!isOnline && '(অফলাইন মোড)'}
                </div>
                <p className="text-xs text-slate-500">আপনার ৪–৬ সংখ্যার পিন প্রবেশ করান</p>
              </div>

              {/* PIN Dots + Direct Keyboard Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2.5 py-2">
                  {Array.from({ length: Math.max(4, pinInput.length) }).map((_, idx) => {
                    const filled = idx < pinInput.length;
                    return (
                      <div
                        key={idx}
                        className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-colors ${
                          filled
                            ? 'border-blue-700 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-300'
                        }`}
                      >
                        {filled ? '●' : ''}
                      </div>
                    );
                  })}
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setErrorMsg('');
                    setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                  placeholder="কীবোর্ডেও পিন লিখতে পারেন"
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-center text-sm font-mono-num tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  autoFocus
                />
              </div>

              {/* Touch Keypad */}
              <div className="grid grid-cols-3 gap-2.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => appendDigit(digit)}
                    className="min-h-[52px] rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 active:scale-[0.98] text-lg font-bold text-slate-800 transition-all cursor-pointer"
                  >
                    {toBnDigits(digit)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setErrorMsg('');
                  }}
                  className="min-h-[52px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  মুছুন
                </button>
                <button
                  type="button"
                  onClick={() => appendDigit('0')}
                  className="min-h-[52px] rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 active:scale-[0.98] text-lg font-bold text-slate-800 transition-all cursor-pointer"
                >
                  {toBnDigits('0')}
                </button>
                <button
                  type="button"
                  onClick={removeLastDigit}
                  className="min-h-[52px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer"
                  aria-label="এক সংখ্যা মুছুন"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              <button
                type="submit"
                disabled={isChecking || pinInput.length < 4}
                className="w-full min-h-[48px] rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white font-semibold text-sm transition-colors cursor-pointer"
              >
                {isChecking ? 'যাচাই হচ্ছে...' : 'প্রবেশ করুন'}
              </button>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="truncate max-w-[200px]">
                  {firebaseUser?.email || offlineDeviceEmail}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClearOfflineDevice?.();
                    if (firebaseUser) {
                      void signOutGoogleDevice();
                    }
                  }}
                  className="text-blue-700 hover:underline font-medium shrink-0 cursor-pointer"
                >
                  ডিভাইস পরিবর্তন
                </button>
              </div>
            </form>
          )}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <PWAInstallButton variant="primary" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
