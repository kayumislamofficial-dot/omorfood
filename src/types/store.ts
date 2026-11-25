export type StaffRole = 'admin' | 'staff';

export interface Category {
  id: string;
  nameBn: string;
  nameEn: string;
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
}

export interface Product {
  id: string;
  nameBn: string;
  nameEn: string;
  searchKeywords: string;
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
  version: number;
  updatedByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
}

export interface PriceHistoryEntry {
  id: string;
  productId: string;
  productNameBn: string;
  oldPurchasePrice: number;
  newPurchasePrice: number;
  oldSellingPrice: number;
  newSellingPrice: number;
  changedByStaffId: string;
  changedByName: string;
  changedByRole: StaffRole;
  createdAt?: unknown;
  createdBy: string;
}

export interface StaffProfile {
  id: string;
  name: string;
  role: StaffRole;
  pinHash: string;
  pinSalt: string;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
}

export interface AuthorizedEmail {
  id: string;
  email: string;
  label: string;
  role: StaffRole;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
}

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhones: string;
  hidePurchasePriceForStaff: boolean;
  updatedAt?: unknown;
  updatedBy: string;
}

/**
 * Transient local-only row in the Smart Invoice Calculator.
 * Never persisted to Firebase.
 */
export interface CalculatorRow {
  rowId: string;
  product: Product | null;
  quantity: number;
}

export type AppView = 'dashboard' | 'calculator' | 'products' | 'categories' | 'staff' | 'history' | 'settings';

export type PrintLayoutMode = 'a4' | 'thermal';

export const PRODUCT_UNITS = [
  'কেজি',
  'গ্রাম',
  'লিটার',
  'মিলি',
  'পিস',
  'প্যাকেট',
  'ডজন',
  'বোতল',
  'বস্তা',
  'বক্স',
] as const;

export const DEFAULT_STORE_SETTINGS: Omit<StoreSettings, 'updatedAt' | 'updatedBy'> = {
  storeName: 'ওমর ফুড',
  storeAddress: 'কালিবাড়ী, ঠাকুরগাঁও।',
  storePhones: '০১৭৪২১২৬৩৬৬, ০১৯৯৯০৫৭১৮১',
  hidePurchasePriceForStaff: true,
};
