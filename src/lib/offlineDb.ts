import {
  type Category,
  type PriceHistoryEntry,
  type Product,
  type StaffProfile,
  type StoreSettings,
} from '../types/store';

const DB_NAME = 'omor_food_offline_v1';
const DB_VERSION = 1;
const STORE_SNAPSHOT = 'snapshot';
const STORE_PENDING_BARCODES = 'pending_barcodes';

export interface CachedDeviceAuth {
  email: string;
  isAuthorized: boolean;
  isDeviceAdmin: boolean;
  savedAt: number;
  storePassSalt?: string;
  storePassHash?: string;
}

export interface PendingOfflineBarcode {
  barcode: string;
  scannedAt: number;
  scannedByName: string;
}

export interface OfflineSnapshot {
  deviceAuth: CachedDeviceAuth | null;
  categories: Category[];
  products: Product[];
  staff: StaffProfile[];
  priceHistory: PriceHistoryEntry[];
  settings: { data: StoreSettings | null; exists: boolean } | null;
  lastSyncAt: number | null;
  pendingBarcodes: PendingOfflineBarcode[];
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SNAPSHOT)) {
        db.createObjectStore(STORE_SNAPSHOT);
      }
      if (!db.objectStoreNames.contains(STORE_PENDING_BARCODES)) {
        db.createObjectStore(STORE_PENDING_BARCODES, { keyPath: 'barcode' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSnapshotValue<T>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_SNAPSHOT, 'readonly');
      const req = tx.objectStore(STORE_SNAPSHOT).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getAllPendingBarcodes(db: IDBDatabase): Promise<PendingOfflineBarcode[]> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PENDING_BARCODES, 'readonly');
      const req = tx.objectStore(STORE_PENDING_BARCODES).getAll();
      req.onsuccess = () => {
        const rows = (req.result as PendingOfflineBarcode[] | undefined) ?? [];
        rows.sort((a, b) => b.scannedAt - a.scannedAt);
        resolve(rows);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function loadOfflineSnapshot(): Promise<OfflineSnapshot> {
  const empty: OfflineSnapshot = {
    deviceAuth: null,
    categories: [],
    products: [],
    staff: [],
    priceHistory: [],
    settings: null,
    lastSyncAt: null,
    pendingBarcodes: [],
  };
  try {
    const db = await openOfflineDb();
    const [deviceAuth, categories, products, staff, priceHistory, settings, lastSyncAt, pendingBarcodes] =
      await Promise.all([
        getSnapshotValue<CachedDeviceAuth>(db, 'deviceAuth'),
        getSnapshotValue<Category[]>(db, 'categories'),
        getSnapshotValue<Product[]>(db, 'products'),
        getSnapshotValue<StaffProfile[]>(db, 'staff'),
        getSnapshotValue<PriceHistoryEntry[]>(db, 'priceHistory'),
        getSnapshotValue<{ data: StoreSettings | null; exists: boolean }>(db, 'settings'),
        getSnapshotValue<number>(db, 'lastSyncAt'),
        getAllPendingBarcodes(db),
      ]);
    db.close();
    return {
      deviceAuth,
      categories: categories ?? [],
      products: products ?? [],
      staff: staff ?? [],
      priceHistory: priceHistory ?? [],
      settings,
      lastSyncAt,
      pendingBarcodes,
    };
  } catch {
    return empty;
  }
}

export async function saveOfflineKey<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOT, 'readwrite');
      tx.objectStore(STORE_SNAPSHOT).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore storage quota errors gracefully
  }
}

export async function clearOfflineAuthSnapshot(): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_SNAPSHOT, 'readwrite');
      tx.objectStore(STORE_SNAPSHOT).delete('deviceAuth');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // ignore
  }
}

export async function savePendingOfflineBarcode(
  entry: PendingOfflineBarcode
): Promise<PendingOfflineBarcode[]> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING_BARCODES, 'readwrite');
      tx.objectStore(STORE_PENDING_BARCODES).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const list = await getAllPendingBarcodes(db);
    db.close();
    return list;
  } catch {
    return [];
  }
}

export async function removePendingOfflineBarcode(
  barcode: string
): Promise<PendingOfflineBarcode[]> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING_BARCODES, 'readwrite');
      tx.objectStore(STORE_PENDING_BARCODES).delete(barcode);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const list = await getAllPendingBarcodes(db);
    db.close();
    return list;
  } catch {
    return [];
  }
}
