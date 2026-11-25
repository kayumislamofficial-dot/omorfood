import { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, KeyRound, Lock, LogOut, ShieldCheck, UserPlus } from 'lucide-react';
import { type User } from 'firebase/auth';
import { generateSaltHex, hashPin, verifyPin } from '../lib/crypto';
import {
  signInWithGoogleDevice,
  signInWithStorePasscode,
  signOutGoogleDevice,
  STORE_ACCESS_EMAIL,
} from '../lib/firebase';
import { type CachedDeviceAuth } from '../lib/offlineDb';
import { createStaffProfile } from '../services/storeService';
import { type StaffProfile } from '../types/store';
import { OmorFoodMark } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface PinLoginScreenProps {
  firebaseUser: User | null;
  isAuthorizedDevice: boolean;
  cachedAuth?: CachedDeviceAuth | null;
  isOnline?: boolean;
  canCreateAdminBootstrap: boolean;
  staffList: StaffProfile[];
  staffLoading: boolean;
  lockNotice?: string;
  onStorePasscodeSuccess: (salt: string, hash: string) => void;
  onClearOfflineDevice?: () => void;
  onUnlock: (staff: StaffProfile) => void;
}

const DEFAULT_STORE_SESSION: StaffProfile = {
  id: 'store-admin',
  name: 'ওমর ফুড',
  role: 'admin',
  pinHash: '',
  pinSalt: '',
  isActive: true,
  createdAt: null,
  updatedAt: null,
  createdBy: 'store-admin',
};

export function PinLoginScreen({
  firebaseUser,
  isAuthorizedDevice,
  cachedAuth = null,
  isOnline = true,
  canCreateAdminBootstrap,
  staffList,
  staffLoading,
  lockNotice,
  onStorePasscodeSuccess,
  onClearOfflineDevice,
  onUnlock,
}: PinLoginScreenProps) {
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  // Optional Google first-run Admin PIN bootstrap (only when connected via Google email)
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
        setErrorMsg('Google অ্যাকাউন্ট সংযুক্ত করতে সমস্যা হয়েছে।');
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = passcodeInput.trim();
    if (candidate.length < 4) {
      setErrorMsg('সঠিক স্টোর পাসকোড বা পিন দিন (কমপক্ষে ৪ অক্ষর)।');
      return;
    }

    setErrorMsg('');
    setIsChecking(true);

    try {
      // 1. Check staff/admin 4-6 digit PIN profiles if device already has staff records
      if ((isAuthorizedDevice || cachedAuth?.isAuthorized) && staffList.length > 0) {
        let matchedInactive = false;
        for (const staff of staffList) {
          const isMatch = await verifyPin(candidate, staff.pinSalt, staff.pinHash);
          if (isMatch) {
            if (!staff.isActive) {
              matchedInactive = true;
              break;
            }
            setPasscodeInput('');
            onUnlock(staff);
            return;
          }
        }
        if (matchedInactive) {
          setErrorMsg('আপনার স্টাফ অ্যাক্সেস বর্তমানে অ্যাডমিন কর্তৃক বন্ধ করা হয়েছে।');
          setPasscodeInput('');
          return;
        }
      }

      // 2. Check cached salted SHA-256 store passcode locally (works 100% offline & fast on lock screen)
      if (cachedAuth?.storePassHash && cachedAuth?.storePassSalt) {
        const matchesCachedPasscode = await verifyPin(
          candidate,
          cachedAuth.storePassSalt,
          cachedAuth.storePassHash
        );
        if (matchesCachedPasscode && (isAuthorizedDevice || !isOnline)) {
          setPasscodeInput('');
          onUnlock(DEFAULT_STORE_SESSION);
          return;
        }
      }

      // 3. Authenticate online with Firebase Email/Password using shared store ID (no Gmail needed)
      if (!isOnline) {
        if (!cachedAuth?.isAuthorized) {
          setErrorMsg('প্রথমবার এই ফোনে প্রবেশ করতে ইন্টারনেট চালু করে স্টোর পাসকোড দিন।');
        } else {
          setErrorMsg('ভুল পাসকোড বা পিন! অনুগ্রহ করে সঠিক পাসকোড দিন।');
        }
        setPasscodeInput('');
        return;
      }

      await signInWithStorePasscode(candidate);
      const salt = generateSaltHex(16);
      const hash = await hashPin(candidate, salt);
      onStorePasscodeSuccess(salt, hash);
      setPasscodeInput('');
      onUnlock(DEFAULT_STORE_SESSION);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      const msg = err instanceof Error ? err.message : '';
      if (code === 'auth/operation-not-allowed' || msg.includes('operation-not-allowed')) {
        setErrorMsg(
          'Firebase Console > Authentication > Sign-in method থেকে Email/Password চালু করুন।'
        );
      } else if (code === 'auth/user-not-found') {
        setErrorMsg(
          `Firebase Console > Authentication > Users-এ "${STORE_ACCESS_EMAIL}" অ্যাকাউন্টটি যোগ করুন।`
        );
      } else if (code === 'auth/network-request-failed') {
        setErrorMsg('ইন্টারনেট সংযোগ পাওয়া যায়নি। নেটওয়ার্ক চালু করে আবার চেষ্টা করুন।');
      } else if (code === 'auth/too-many-requests') {
        setErrorMsg('অনেকবার ভুল চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।');
      } else {
        setErrorMsg('ভুল পাসকোড! অনুগ্রহ করে সঠিক স্টোর পাসকোড দিন।');
      }
      setPasscodeInput('');
    } finally {
      setIsChecking(false);
    }
  };

  const isUnauthorizedGoogleUser = Boolean(
    firebaseUser &&
      firebaseUser.email?.toLowerCase() !== STORE_ACCESS_EMAIL &&
      !isAuthorizedDevice
  );

  const isGoogleAdminNeedsBootstrap = Boolean(
    firebaseUser &&
      firebaseUser.email?.toLowerCase() !== STORE_ACCESS_EMAIL &&
      isAuthorizedDevice &&
      !staffLoading &&
      staffList.length === 0 &&
      canCreateAdminBootstrap
  );

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

          {isUnauthorizedGoogleUser ? (
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">এই Google অ্যাকাউন্টটি অনুমোদিত নয়</h2>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  আপনি চাইলে কোনো জিমেইল ছাড়াই সরাসরি স্টোর পাসকোড দিয়ে প্রবেশ করতে পারেন।
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClearOfflineDevice?.();
                  void signOutGoogleDevice();
                }}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                পাসকোড লগইন স্ক্রিনে ফিরে যান
              </button>
            </div>
          ) : isGoogleAdminNeedsBootstrap ? (
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
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 mx-auto flex items-center justify-center mb-2">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  পিন / পাসকোড দিয়ে প্রবেশ করুন
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  কোনো Gmail ছাড়াই সরাসরি স্টোর পাসকোড দিন। {!isOnline && '(অফলাইন মোড চালু)'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  স্টোর পাসকোড বা স্টাফ পিন
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={passcodeInput}
                    onChange={(e) => {
                      setErrorMsg('');
                      setPasscodeInput(e.target.value);
                    }}
                    placeholder="পাসকোড লিখুন..."
                    className="w-full min-h-[50px] pl-4 pr-12 rounded-xl border border-slate-300 bg-slate-50 text-base font-mono-num tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 flex items-center justify-center cursor-pointer"
                    aria-label={showPasscode ? 'লুকান' : 'দেখুন'}
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isChecking || passcodeInput.trim().length < 4}
                className="w-full min-h-[50px] rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                {isChecking ? 'যাচাই হচ্ছে...' : 'প্রবেশ করুন'}
              </button>

              {!firebaseUser && !cachedAuth?.isAuthorized && isOnline && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleGoogleConnect}
                    disabled={isConnectingGoogle}
                    className="text-xs text-slate-400 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    {isConnectingGoogle ? 'সংযুক্ত হচ্ছে...' : 'অ্যাডমিন Google দিয়ে প্রবেশ (ঐচ্ছিক)'}
                  </button>
                </div>
              )}

              {(firebaseUser || cachedAuth?.isAuthorized) && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="truncate max-w-[200px]">
                    {cachedAuth?.isAuthorized ? 'ডিভাইস সংযুক্ত আছে' : firebaseUser?.email}
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
                    সেশন রিসেট
                  </button>
                </div>
              )}
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
