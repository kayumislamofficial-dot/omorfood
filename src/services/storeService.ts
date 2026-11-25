import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { generateSaltHex, hashPin, verifyPin } from '../lib/crypto';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  buildSearchKeywords,
  isSafeImageUrl,
  isValidBarcodeFormat,
  normalizeBarcode,
} from '../lib/format';
import {
  DEFAULT_STORE_SETTINGS,
  type AuthorizedEmail,
  type Category,
  type Product,
  type StaffProfile,
  type StaffRole,
  type StoreSettings,
} from '../types/store';

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('অথেনটিকেশন পাওয়া যায়নি। অনুগ্রহ করে আবার সংযুক্ত হোন।');
  }
  return uid;
}

function clampString(val: string, max: number): string {
  return val.trim().slice(0, max);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export async function saveCategory(params: {
  id?: string;
  nameBn: string;
  nameEn: string;
  sortOrder: number;
}): Promise<string> {
  const uid = requireUid();
  const nameBn = clampString(params.nameBn, 80);
  const nameEn = clampString(params.nameEn, 80);
  const sortOrder = Math.max(0, Math.min(100000, Math.round(params.sortOrder || 0)));

  if (!nameBn) {
    throw new Error('ক্যাটাগরির বাংলা নাম লিখুন।');
  }

  const catId = params.id || doc(collection(db, 'categories')).id;
  const catRef = doc(db, 'categories', catId);

  try {
    if (params.id) {
      await updateDoc(catRef, {
        nameBn,
        nameEn,
        sortOrder,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(catRef, {
        nameBn,
        nameEn,
        sortOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
      });
    }
    return catId;
  } catch (error) {
    handleFirestoreError(error, params.id ? OperationType.UPDATE : OperationType.CREATE, `categories/${catId}`);
  }
}

export async function deleteCategory(categoryId: string, productsInCategory: number): Promise<void> {
  if (productsInCategory > 0) {
    throw new Error('এই ক্যাটাগরিতে পণ্য রয়েছে। আগে পণ্যগুলোর ক্যাটাগরি পরিবর্তন করুন বা মুছে দিন।');
  }
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `categories/${categoryId}`);
  }
}

export async function seedStarterCategories(): Promise<void> {
  const uid = requireUid();
  const starters = [
    { nameBn: 'চাল ও ডাল', nameEn: 'Rice & Lentils', sortOrder: 1 },
    { nameBn: 'ভোজ্যতেল ও ঘি', nameEn: 'Cooking Oil & Ghee', sortOrder: 2 },
    { nameBn: 'মসলা ও লবণ', nameEn: 'Spices & Salt', sortOrder: 3 },
    { nameBn: 'চিনি, আটা ও ময়দা', nameEn: 'Sugar & Flour', sortOrder: 4 },
    { nameBn: 'বিস্কুট ও স্ন্যাকস', nameEn: 'Biscuits & Snacks', sortOrder: 5 },
    { nameBn: 'চা, কফি ও পানীয়', nameEn: 'Tea, Coffee & Beverages', sortOrder: 6 },
    { nameBn: 'দুগ্ধজাত পণ্য', nameEn: 'Dairy Products', sortOrder: 7 },
    { nameBn: 'সাবান ও পরিচ্ছন্নতা', nameEn: 'Soap & Household', sortOrder: 8 },
  ];

  const batch = writeBatch(db);
  for (const item of starters) {
    const ref = doc(collection(db, 'categories'));
    batch.set(ref, {
      nameBn: item.nameBn,
      nameEn: item.nameEn,
      sortOrder: item.sortOrder,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: uid,
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'categories');
  }
}

// ---------------------------------------------------------------------------
// Products (Atomic Barcode Uniqueness + Conflict Detection + Price History)
// ---------------------------------------------------------------------------
export interface ProductInput {
  nameBn: string;
  nameEn: string;
  barcode: string;
  purchasePrice: number;
  sellingPrice: number;
  categoryId: string;
  categoryName: string;
  unit: string;
  hasStock: boolean;
  stockQty: number;
  lowStockThreshold: number;
  imageUrl: string;
}

export async function createProduct(
  input: ProductInput,
  actor: { staffId: string; name: string; role: StaffRole }
): Promise<string> {
  const uid = requireUid();
  const nameBn = clampString(input.nameBn, 120);
  const nameEn = clampString(input.nameEn, 120);
  const barcode = normalizeBarcode(input.barcode);
  const categoryName = clampString(input.categoryName, 80);
  const unit = clampString(input.unit, 30) || 'পিস';
  const imageUrl = clampString(input.imageUrl, 1000);
  const purchasePrice = Math.max(0, Number(input.purchasePrice) || 0);
  const sellingPrice = Math.max(0, Number(input.sellingPrice) || 0);
  const stockQty = input.hasStock ? Math.max(0, Number(input.stockQty) || 0) : 0;
  const lowStockThreshold = input.hasStock ? Math.max(0, Number(input.lowStockThreshold) || 0) : 0;

  if (!nameBn) throw new Error('পণ্যের বাংলা নাম আবশ্যক।');
  if (!input.categoryId || !categoryName) throw new Error('একটি ক্যাটাগরি নির্বাচন করুন।');
  if (!isValidBarcodeFormat(barcode)) {
    throw new Error('বারকোডে শুধুমাত্র ইংরেজি অক্ষর, সংখ্যা, -, _, . ব্যবহার করা যাবে।');
  }
  if (!isSafeImageUrl(imageUrl)) {
    throw new Error('ছবির লিংক অবশ্যই https:// দিয়ে শুরু হতে হবে।');
  }

  const productRef = doc(collection(db, 'products'));
  const historyRef = doc(collection(db, 'priceHistory'));
  const searchKeywords = buildSearchKeywords(nameBn, nameEn, barcode);
  const updatedByName = clampString(actor.name, 80) || 'অ্যাডমিন';

  try {
    await runTransaction(db, async (tx) => {
      if (barcode) {
        const barcodeRef = doc(db, 'barcodes', barcode);
        const existingBarcode = await tx.get(barcodeRef);
        if (existingBarcode.exists()) {
          throw new Error('DUPLICATE_BARCODE');
        }
        tx.set(barcodeRef, {
          productId: productRef.id,
          createdAt: serverTimestamp(),
          createdBy: uid,
        });
      }

      tx.set(productRef, {
        nameBn,
        nameEn,
        searchKeywords,
        barcode,
        purchasePrice,
        sellingPrice,
        categoryId: input.categoryId,
        categoryName,
        unit,
        hasStock: Boolean(input.hasStock),
        stockQty,
        lowStockThreshold,
        imageUrl,
        version: 1,
        updatedByName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
      });

      tx.set(historyRef, {
        productId: productRef.id,
        productNameBn: nameBn,
        oldPurchasePrice: 0,
        newPurchasePrice: purchasePrice,
        oldSellingPrice: 0,
        newSellingPrice: sellingPrice,
        changedByStaffId: actor.staffId,
        changedByName: updatedByName,
        changedByRole: actor.role,
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
    });

    return productRef.id;
  } catch (error) {
    if (error instanceof Error && error.message === 'DUPLICATE_BARCODE') {
      throw new Error('এই বারকোডটি ইতিমধ্যে অন্য একটি পণ্যে ব্যবহৃত হয়েছে! প্রতিটি পণ্যের বারকোড আলাদা হতে হবে।');
    }
    handleFirestoreError(error, OperationType.CREATE, `products/${productRef.id}`);
  }
}

export async function updateProduct(
  existingProduct: Product,
  input: ProductInput,
  actor: { staffId: string; name: string; role: StaffRole }
): Promise<void> {
  const uid = requireUid();
  const nameBn = clampString(input.nameBn, 120);
  const nameEn = clampString(input.nameEn, 120);
  const newBarcode = normalizeBarcode(input.barcode);
  const oldBarcode = normalizeBarcode(existingProduct.barcode);
  const categoryName = clampString(input.categoryName, 80);
  const unit = clampString(input.unit, 30) || 'পিস';
  const imageUrl = clampString(input.imageUrl, 1000);
  const purchasePrice = Math.max(0, Number(input.purchasePrice) || 0);
  const sellingPrice = Math.max(0, Number(input.sellingPrice) || 0);
  const stockQty = input.hasStock ? Math.max(0, Number(input.stockQty) || 0) : 0;
  const lowStockThreshold = input.hasStock ? Math.max(0, Number(input.lowStockThreshold) || 0) : 0;

  if (!nameBn) throw new Error('পণ্যের বাংলা নাম আবশ্যক।');
  if (!input.categoryId || !categoryName) throw new Error('একটি ক্যাটাগরি নির্বাচন করুন।');
  if (!isValidBarcodeFormat(newBarcode)) {
    throw new Error('বারকোডে শুধুমাত্র ইংরেজি অক্ষর, সংখ্যা, -, _, . ব্যবহার করা যাবে।');
  }
  if (!isSafeImageUrl(imageUrl)) {
    throw new Error('ছবির লিংক অবশ্যই https:// দিয়ে শুরু হতে হবে।');
  }

  const productRef = doc(db, 'products', existingProduct.id);
  const searchKeywords = buildSearchKeywords(nameBn, nameEn, newBarcode);
  const updatedByName = clampString(actor.name, 80) || 'অ্যাডমিন';

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(productRef);
      if (!snap.exists()) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      const serverData = snap.data() as Product;
      if (serverData.version !== existingProduct.version) {
        throw new Error('VERSION_CONFLICT');
      }

      if (newBarcode !== oldBarcode) {
        if (newBarcode) {
          const newBarcodeRef = doc(db, 'barcodes', newBarcode);
          const existingNewLock = await tx.get(newBarcodeRef);
          if (existingNewLock.exists() && existingNewLock.data()?.productId !== existingProduct.id) {
            throw new Error('DUPLICATE_BARCODE');
          }
          tx.set(newBarcodeRef, {
            productId: existingProduct.id,
            createdAt: serverTimestamp(),
            createdBy: uid,
          });
        }
        if (oldBarcode) {
          tx.delete(doc(db, 'barcodes', oldBarcode));
        }
      }

      tx.update(productRef, {
        nameBn,
        nameEn,
        searchKeywords,
        barcode: newBarcode,
        purchasePrice,
        sellingPrice,
        categoryId: input.categoryId,
        categoryName,
        unit,
        hasStock: Boolean(input.hasStock),
        stockQty,
        lowStockThreshold,
        imageUrl,
        version: serverData.version + 1,
        updatedByName,
        updatedAt: serverTimestamp(),
      });

      const priceChanged =
        serverData.purchasePrice !== purchasePrice || serverData.sellingPrice !== sellingPrice;

      if (priceChanged) {
        const historyRef = doc(collection(db, 'priceHistory'));
        tx.set(historyRef, {
          productId: existingProduct.id,
          productNameBn: nameBn,
          oldPurchasePrice: serverData.purchasePrice,
          newPurchasePrice: purchasePrice,
          oldSellingPrice: serverData.sellingPrice,
          newSellingPrice: sellingPrice,
          changedByStaffId: actor.staffId,
          changedByName: updatedByName,
          changedByRole: actor.role,
          createdAt: serverTimestamp(),
          createdBy: uid,
        });
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'DUPLICATE_BARCODE') {
        throw new Error('এই বারকোডটি ইতিমধ্যে অন্য একটি পণ্যে ব্যবহৃত হয়েছে!');
      }
      if (error.message === 'VERSION_CONFLICT') {
        throw new Error('অন্য একটি ফোন থেকে এই পণ্যটি এইমাত্র আপডেট করা হয়েছে। অনুগ্রহ করে ফর্মটি বন্ধ করে আবার খুলুন।');
      }
      if (error.message === 'PRODUCT_NOT_FOUND') {
        throw new Error('পণ্যটি ডাটাবেসে পাওয়া যায়নি (সম্ভবত মুছে ফেলা হয়েছে)।');
      }
    }
    handleFirestoreError(error, OperationType.UPDATE, `products/${existingProduct.id}`);
  }
}

export async function deleteProduct(product: Product): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'products', product.id));
  if (product.barcode) {
    batch.delete(doc(db, 'barcodes', product.barcode));
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${product.id}`);
  }
}

// ---------------------------------------------------------------------------
// Staff & PIN Profiles
// ---------------------------------------------------------------------------
async function ensureUniquePin(pin: string, excludeStaffId?: string): Promise<void> {
  const snapshot = await getDocs(collection(db, 'staff'));
  for (const docSnap of snapshot.docs) {
    if (excludeStaffId && docSnap.id === excludeStaffId) continue;
    const staff = docSnap.data() as StaffProfile;
    const matches = await verifyPin(pin, staff.pinSalt, staff.pinHash);
    if (matches) {
      throw new Error('DUPLICATE_PIN');
    }
  }
}

export async function createStaffProfile(params: {
  name: string;
  role: StaffRole;
  pin: string;
}): Promise<string> {
  const uid = requireUid();
  const name = clampString(params.name, 80);
  const pin = params.pin.trim();

  if (!name) throw new Error('স্টাফ বা অ্যাডমিনের নাম লিখুন।');
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('পিন অবশ্যই ৪ থেকে ৬ সংখ্যার (ইংরেজি ডিজিট) হতে হবে।');
  }

  try {
    await ensureUniquePin(pin);
  } catch (error) {
    if (error instanceof Error && error.message === 'DUPLICATE_PIN') {
      throw new Error('এই পিনটি ইতিমধ্যে অন্য একজন ব্যবহার করছেন। ভিন্ন পিন দিন।');
    }
    throw error;
  }

  const salt = generateSaltHex(16);
  const pinHash = await hashPin(pin, salt);
  const staffRef = doc(collection(db, 'staff'));

  try {
    await setDoc(staffRef, {
      name,
      role: params.role,
      pinHash,
      pinSalt: salt,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: uid,
    });
    return staffRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `staff/${staffRef.id}`);
  }
}

export async function updateStaffProfile(params: {
  staffId: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  newPin?: string;
  existingSalt: string;
  existingHash: string;
}): Promise<void> {
  requireUid();
  const name = clampString(params.name, 80);
  if (!name) throw new Error('নাম খালি রাখা যাবে না।');

  let pinSalt = params.existingSalt;
  let pinHash = params.existingHash;

  if (params.newPin && params.newPin.trim().length > 0) {
    const cleanPin = params.newPin.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      throw new Error('নতুন পিন অবশ্যই ৪ থেকে ৬ সংখ্যার হতে হবে।');
    }
    try {
      await ensureUniquePin(cleanPin, params.staffId);
    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE_PIN') {
        throw new Error('এই পিনটি ইতিমধ্যে অন্য একজন ব্যবহার করছেন।');
      }
      throw error;
    }
    pinSalt = generateSaltHex(16);
    pinHash = await hashPin(cleanPin, pinSalt);
  }

  try {
    await updateDoc(doc(db, 'staff', params.staffId), {
      name,
      role: params.role,
      isActive: params.isActive,
      pinSalt,
      pinHash,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `staff/${params.staffId}`);
  }
}

export async function deleteStaffProfile(staffId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'staff', staffId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `staff/${staffId}`);
  }
}

// ---------------------------------------------------------------------------
// Authorized Google Accounts (Multi-Phone Device Access)
// ---------------------------------------------------------------------------
export async function saveAuthorizedEmail(params: {
  email: string;
  label: string;
  role: StaffRole;
  isActive: boolean;
  isUpdate?: boolean;
}): Promise<void> {
  const uid = requireUid();
  const email = params.email.trim().toLowerCase();
  const label = clampString(params.label, 80);

  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
    throw new Error('সঠিক ইমেইল ঠিকানা লিখুন।');
  }
  if (!label) {
    throw new Error('ডিভাইস বা স্টাফের পরিচয় লিখুন।');
  }

  const ref = doc(db, 'authorizedEmails', email);

  try {
    if (params.isUpdate) {
      await updateDoc(ref, {
        label,
        role: params.role,
        isActive: params.isActive,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        email,
        label,
        role: params.role,
        isActive: params.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      params.isUpdate ? OperationType.UPDATE : OperationType.CREATE,
      `authorizedEmails/${email}`
    );
  }
}

export async function deleteAuthorizedEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  try {
    await deleteDoc(doc(db, 'authorizedEmails', normalized));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `authorizedEmails/${normalized}`);
  }
}

// ---------------------------------------------------------------------------
// Store Settings
// ---------------------------------------------------------------------------
export async function saveStoreSettings(
  settings: Partial<Omit<StoreSettings, 'updatedAt' | 'updatedBy'>>,
  existsOnServer: boolean
): Promise<void> {
  const uid = requireUid();
  const payload = {
    storeName: clampString(settings.storeName || DEFAULT_STORE_SETTINGS.storeName, 80),
    storeAddress: clampString(settings.storeAddress || DEFAULT_STORE_SETTINGS.storeAddress, 160),
    storePhones: clampString(settings.storePhones || DEFAULT_STORE_SETTINGS.storePhones, 120),
    hidePurchasePriceForStaff:
      typeof settings.hidePurchasePriceForStaff === 'boolean'
        ? settings.hidePurchasePriceForStaff
        : DEFAULT_STORE_SETTINGS.hidePurchasePriceForStaff,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };

  const ref = doc(db, 'storeSettings', 'config');
  try {
    if (existsOnServer) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, existsOnServer ? OperationType.UPDATE : OperationType.CREATE, 'storeSettings/config');
  }
}

export type { Category, AuthorizedEmail, StaffProfile };
