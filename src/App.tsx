import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  Calculator,
  FolderTree,
  History,
  LayoutDashboard,
  Lock,
  Menu,
  Package,
  Settings,
  Users,
  X,
} from 'lucide-react';
import {
  CategoriesManager,
  PriceHistoryView,
  SettingsView,
  StaffManager,
} from './components/AdminSections';
import { OmorFoodMark, SplashLoadingScreen } from './components/BrandLogo';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InvoiceCalculatorView } from './components/InvoiceCalculatorView';
import { PinLoginScreen } from './components/PinLoginScreen';
import { ProductsView } from './components/ProductsView';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { useOnlineStatus } from './hooks/usePWAInstall';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  OWNER_ADMIN_EMAIL,
  STORE_ACCESS_EMAIL,
  testConnection,
} from './lib/firebase';
import {
  clearOfflineAuthSnapshot,
  loadOfflineSnapshot,
  removePendingOfflineBarcode,
  saveOfflineKey,
  savePendingOfflineBarcode,
  type CachedDeviceAuth,
  type PendingOfflineBarcode,
} from './lib/offlineDb';
import {
  type AppView,
  type AuthorizedEmail,
  type Category,
  type PriceHistoryEntry,
  type Product,
  type StaffProfile,
  type StoreSettings,
} from './types/store';

function StoreApplication() {
  const [splashDone, setSplashDone] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  // Device-level authorization check
  const [authDoc, setAuthDoc] = useState<AuthorizedEmail | null>(null);
  const [authDocChecked, setAuthDocChecked] = useState(false);

  // Active PIN session (always required on open; cleared on Lock)
  const [activeStaff, setActiveStaff] = useState<StaffProfile | null>(null);
  const [lockNotice, setLockNotice] = useState<string>('');

  // Central Firestore real-time state
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [authorizedEmails, setAuthorizedEmails] = useState<AuthorizedEmail[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [settingsExists, setSettingsExists] = useState(false);

  const isOnline = useOnlineStatus();
  const [offlineHydrated, setOfflineHydrated] = useState(false);
  const [cachedAuth, setCachedAuth] = useState<CachedDeviceAuth | null>(null);
  const [pendingBarcodes, setPendingBarcodes] = useState<PendingOfflineBarcode[]>([]);

  // Navigation & transient UI state
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [openScannerOnProducts, setOpenScannerOnProducts] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hydrate offline IndexedDB store immediately on boot + Capacitor native setup
  useEffect(() => {
    let active = true;
    loadOfflineSnapshot().then((snap) => {
      if (!active) return;
      if (snap.deviceAuth?.isAuthorized) {
        setCachedAuth(snap.deviceAuth);
        setStaffList(snap.staff);
        setCategories(snap.categories);
        setProducts(snap.products);
        setPriceHistory(snap.priceHistory);
        if (snap.settings) {
          setStoreSettings(snap.settings.data);
          setSettingsExists(snap.settings.exists);
        }
        setStaffLoading(false);
      }
      setPendingBarcodes(snap.pendingBarcodes);
      setOfflineHydrated(true);
    });

    if (Capacitor.isNativePlatform()) {
      StatusBar.setBackgroundColor({ color: '#1D4ED8' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      SplashScreen.hide().catch(() => {});
    }

    const handleReconnect = () => {
      void testConnection();
    };
    window.addEventListener('online', handleReconnect);

    if (navigator.onLine) {
      void testConnection();
    }
    const timer = setTimeout(() => setSplashDone(true), 850);
    return () => {
      active = false;
      window.removeEventListener('online', handleReconnect);
      clearTimeout(timer);
    };
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setAuthDoc(null);
        setAuthDocChecked(true);
        // Only wipe state if we are NOT relying on cached offline device auth
        if (navigator.onLine) {
          setActiveStaff(null);
        }
      }
    });
    return () => unsub();
  }, []);

  const userEmail = (firebaseUser?.email || '').trim().toLowerCase();
  const isStorePasscodeAccount = Boolean(firebaseUser && userEmail === STORE_ACCESS_EMAIL);
  const isOwnerEmail = Boolean(
    firebaseUser?.emailVerified && userEmail === OWNER_ADMIN_EMAIL
  );

  // Check authorizedEmails/{userEmail} for non-owner Google phones
  useEffect(() => {
    if (!firebaseUser || !userEmail) {
      setAuthDoc(null);
      setAuthDocChecked(true);
      return;
    }

    if (isOwnerEmail || isStorePasscodeAccount) {
      setAuthDocChecked(true);
      return;
    }

    if (!firebaseUser.emailVerified) {
      setAuthDoc(null);
      setAuthDocChecked(true);
      return;
    }

    setAuthDocChecked(false);
    const unsub = onSnapshot(
      doc(db, 'authorizedEmails', userEmail),
      (snap) => {
        if (snap.exists()) {
          setAuthDoc({ id: snap.id, ...(snap.data() as Omit<AuthorizedEmail, 'id'>) });
        } else {
          setAuthDoc(null);
        }
        setAuthDocChecked(true);
      },
      (error) => {
        setAuthDoc(null);
        setAuthDocChecked(true);
        handleFirestoreError(error, OperationType.GET, `authorizedEmails/${userEmail}`);
      }
    );

    return () => unsub();
  }, [firebaseUser, userEmail, isOwnerEmail, isStorePasscodeAccount]);

  const isAuthorizedDevice = Boolean(
    firebaseUser &&
      (isStorePasscodeAccount ||
        (firebaseUser.emailVerified &&
          (isOwnerEmail || (authDoc !== null && authDoc.isActive))))
  );

  const isDeviceAdmin = Boolean(
    firebaseUser &&
      (isStorePasscodeAccount ||
        (firebaseUser.emailVerified &&
          (isOwnerEmail || (authDoc !== null && authDoc.isActive && authDoc.role === 'admin'))))
  );

  const hasOfflineDeviceCache = Boolean(
    cachedAuth?.isAuthorized &&
      (staffList.length > 0 || Boolean(cachedAuth.storePassHash)) &&
      (!firebaseUser || (!isOnline && cachedAuth.email === userEmail))
  );

  const effectiveDeviceAuthorized = isAuthorizedDevice || hasOfflineDeviceCache;

  // Persist device authorization metadata to IndexedDB when online-verified
  useEffect(() => {
    if (isAuthorizedDevice && userEmail) {
      setCachedAuth((prev) => {
        const nextAuth: CachedDeviceAuth = {
          email: userEmail,
          isAuthorized: true,
          isDeviceAdmin,
          savedAt: Date.now(),
          storePassSalt: prev?.storePassSalt,
          storePassHash: prev?.storePassHash,
        };
        void saveOfflineKey('deviceAuth', nextAuth);
        return nextAuth;
      });
    }
  }, [isAuthorizedDevice, isDeviceAdmin, userEmail]);

  // Attach real-time Firestore listeners when device is online-authorized
  useEffect(() => {
    if (!isAuthorizedDevice) {
      if (!hasOfflineDeviceCache) {
        setStaffLoading(false);
      }
      return;
    }

    const isOfflineError = (err: unknown) => {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      return !navigator.onLine || msg.includes('offline') || msg.includes('unavailable');
    };

    if (!hasOfflineDeviceCache) {
      setStaffLoading(true);
    }

    const unsubStaff = onSnapshot(
      collection(db, 'staff'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StaffProfile, 'id'>),
        }));
        setStaffList(list);
        setStaffLoading(false);
        void saveOfflineKey('staff', list);

        // Real-time enforcement: if active staff gets disabled or deleted, lock immediately
        setActiveStaff((prev) => {
          if (!prev) return null;
          if (prev.id === 'store-admin') return prev;
          const updated = list.find((s) => s.id === prev.id);
          if (!updated || !updated.isActive) {
            setLockNotice('আপনার অ্যাক্সেস অ্যাডমিন কর্তৃক বন্ধ বা পরিবর্তন করা হয়েছে।');
            return null;
          }
          return updated;
        });
      },
      (error) => {
        setStaffLoading(false);
        if (!isOfflineError(error)) {
          handleFirestoreError(error, OperationType.LIST, 'staff');
        }
      }
    );

    const unsubCategories = onSnapshot(
      query(collection(db, 'categories'), orderBy('sortOrder', 'asc')),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Category, 'id'>),
        }));
        setCategories(list);
        void saveOfflineKey('categories', list);
      },
      (error) => {
        if (!isOfflineError(error)) {
          handleFirestoreError(error, OperationType.LIST, 'categories');
        }
      }
    );

    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), orderBy('nameBn', 'asc')),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, 'id'>),
        }));
        setProducts(list);
        void saveOfflineKey('products', list);
        void saveOfflineKey('lastSyncAt', Date.now());
      },
      (error) => {
        if (!isOfflineError(error)) {
          handleFirestoreError(error, OperationType.LIST, 'products');
        }
      }
    );

    const unsubHistory = onSnapshot(
      query(collection(db, 'priceHistory'), orderBy('createdAt', 'desc'), limit(150)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PriceHistoryEntry, 'id'>),
        }));
        setPriceHistory(list);
        void saveOfflineKey('priceHistory', list);
      },
      (error) => {
        if (!isOfflineError(error)) {
          handleFirestoreError(error, OperationType.LIST, 'priceHistory');
        }
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'storeSettings', 'config'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as StoreSettings;
          setStoreSettings(data);
          setSettingsExists(true);
          void saveOfflineKey('settings', { data, exists: true });
        } else {
          setStoreSettings(null);
          setSettingsExists(false);
          void saveOfflineKey('settings', { data: null, exists: false });
        }
      },
      (error) => {
        if (!isOfflineError(error)) {
          handleFirestoreError(error, OperationType.GET, 'storeSettings/config');
        }
      }
    );

    return () => {
      unsubStaff();
      unsubCategories();
      unsubProducts();
      unsubHistory();
      unsubSettings();
    };
  }, [isAuthorizedDevice, hasOfflineDeviceCache]);

  // Admin-only authorizedEmails listener
  useEffect(() => {
    if (!isDeviceAdmin) {
      setAuthorizedEmails([]);
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'authorizedEmails'),
      (snap) => {
        setAuthorizedEmails(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AuthorizedEmail, 'id'>),
          }))
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'authorizedEmails')
    );

    return () => unsub();
  }, [isDeviceAdmin]);

  const navItems = useMemo(() => {
    const isPinAdmin = activeStaff?.role === 'admin';
    const base: { id: AppView; label: string; icon: typeof LayoutDashboard }[] = [
      { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
      { id: 'calculator', label: 'হিসাব ক্যালকুলেটর', icon: Calculator },
      { id: 'products', label: 'পণ্য ও দাম', icon: Package },
    ];
    if (isPinAdmin) {
      base.push(
        { id: 'categories', label: 'ক্যাটাগরি', icon: FolderTree },
        { id: 'history', label: 'মূল্য ইতিহাস', icon: History },
        { id: 'staff', label: 'স্টাফ ও পিন', icon: Users },
        { id: 'settings', label: 'সেটিংস', icon: Settings }
      );
    }
    return base;
  }, [activeStaff]);

  if (
    !splashDone ||
    !authReady ||
    !offlineHydrated ||
    (firebaseUser && !authDocChecked && isOnline)
  ) {
    return <SplashLoadingScreen />;
  }

  if (!effectiveDeviceAuthorized || !activeStaff) {
    return (
      <PinLoginScreen
        firebaseUser={firebaseUser}
        isAuthorizedDevice={effectiveDeviceAuthorized}
        cachedAuth={cachedAuth}
        isOnline={isOnline}
        canCreateAdminBootstrap={isDeviceAdmin}
        staffList={staffList}
        staffLoading={staffLoading}
        lockNotice={lockNotice}
        onStorePasscodeSuccess={(salt, hash) => {
          const nextAuth: CachedDeviceAuth = {
            email: STORE_ACCESS_EMAIL,
            isAuthorized: true,
            isDeviceAdmin: true,
            savedAt: Date.now(),
            storePassSalt: salt,
            storePassHash: hash,
          };
          setCachedAuth(nextAuth);
          void saveOfflineKey('deviceAuth', nextAuth);
        }}
        onClearOfflineDevice={() => {
          setCachedAuth(null);
          setStaffList([]);
          setCategories([]);
          setProducts([]);
          setPriceHistory([]);
          void clearOfflineAuthSnapshot();
        }}
        onUnlock={(staff) => {
          setLockNotice('');
          setActiveStaff(staff);
          setActiveView('dashboard');
        }}
      />
    );
  }

  const actor = {
    staffId: activeStaff.id,
    name: activeStaff.name,
    role: activeStaff.role,
  };
  const isPinAdmin = activeStaff.role === 'admin';
  const canViewPurchasePrice = isPinAdmin || !storeSettings?.hidePurchasePriceForStaff;

  const handleLockSession = () => {
    setActiveStaff(null);
    setMobileMenuOpen(false);
    setLockNotice('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-3">
          <OmorFoodMark className="w-10 h-10 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-lg text-slate-900 leading-tight truncate">
              {storeSettings?.storeName || 'ওমর ফুড'}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {storeSettings?.storeAddress || 'কালিবাড়ী, ঠাকুরগাঁও'}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveView(item.id);
                  setOpenScannerOnProducts(false);
                }}
                className={`w-full min-h-[44px] px-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-3">
          <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="text-xs font-bold text-slate-900 truncate">{activeStaff.name}</div>
            <div className="text-[11px] text-slate-500">
              {isPinAdmin ? 'অ্যাডমিন অ্যাক্সেস' : 'স্টাফ অ্যাক্সেস'}
            </div>
          </div>
          <PWAInstallButton variant="subtle" />
          <button
            type="button"
            onClick={handleLockSession}
            className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            স্ক্রিন লক করুন
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar (compact, single-row) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <OmorFoodMark className="w-8 h-8 shrink-0" />
          <span className="font-bold text-base text-slate-900 truncate">
            {storeSettings?.storeName || 'ওমর ফুড'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton variant="compact" />
          <button
            type="button"
            onClick={handleLockSession}
            className="min-h-[38px] px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            লক
          </button>
          {isPinAdmin && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="min-w-[38px] min-h-[38px] rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center cursor-pointer"
              aria-label="মেনু"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </header>

      {/* Mobile Admin Drawer */}
      {mobileMenuOpen && isPinAdmin && (
        <div className="lg:hidden fixed inset-x-0 top-14 z-40 bg-white border-b border-slate-200 shadow-lg p-3 grid grid-cols-2 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveView(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`min-h-[44px] px-3 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                  active ? 'bg-blue-700 text-white' : 'bg-slate-50 text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 lg:pl-64 pb-20 lg:pb-8">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {activeView === 'dashboard' && (
            <DashboardView
              products={products}
              categories={categories}
              staffList={staffList}
              priceHistory={priceHistory}
              settings={storeSettings}
              actor={actor}
              onNavigate={(view) => {
                setOpenScannerOnProducts(false);
                setActiveView(view);
              }}
              onOpenBarcodeSearch={() => {
                setOpenScannerOnProducts(true);
                setActiveView('products');
              }}
            />
          )}

          {activeView === 'calculator' && (
            <InvoiceCalculatorView
              products={products}
              categories={categories}
              settings={storeSettings}
              staffName={activeStaff.name}
            />
          )}

          {activeView === 'products' && (
            <ProductsView
              products={products}
              categories={categories}
              settings={storeSettings}
              actor={actor}
              isOnline={isOnline}
              pendingBarcodes={pendingBarcodes}
              onSavePendingBarcode={async (barcode) => {
                const updated = await savePendingOfflineBarcode({
                  barcode,
                  scannedAt: Date.now(),
                  scannedByName: activeStaff.name,
                });
                setPendingBarcodes(updated);
              }}
              onRemovePendingBarcode={async (barcode) => {
                const updated = await removePendingOfflineBarcode(barcode);
                setPendingBarcodes(updated);
              }}
              initialScanPrompt={openScannerOnProducts}
              onClearScanPrompt={() => setOpenScannerOnProducts(false)}
            />
          )}

          {activeView === 'categories' && isPinAdmin && (
            <CategoriesManager categories={categories} products={products} />
          )}

          {activeView === 'staff' && isPinAdmin && (
            <StaffManager
              staffList={staffList}
              authorizedEmails={authorizedEmails}
              currentStaffId={activeStaff.id}
            />
          )}

          {activeView === 'history' && isPinAdmin && (
            <PriceHistoryView
              priceHistory={priceHistory}
              canViewPurchasePrice={canViewPurchasePrice}
            />
          )}

          {activeView === 'settings' && isPinAdmin && (
            <SettingsView settings={storeSettings} settingsExists={settingsExists} />
          )}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar (Thumb-zone navigation, compact 60px) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-3 h-[60px]">
        {[
          { id: 'dashboard' as AppView, label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
          { id: 'calculator' as AppView, label: 'হিসাব', icon: Calculator },
          { id: 'products' as AppView, label: 'পণ্য ও দাম', icon: Package },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveView(tab.id);
                setMobileMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                active ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-semibold">{tab.label}</span>
            </button>
          );
        })}
      </nav>
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreApplication />
    </ErrorBoundary>
  );
}
