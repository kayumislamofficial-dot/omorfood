# Security Specification — Omor Food Smart Store (Phase 0)

## 1. Data Invariants
1. **Verified Store Auth Only**: No unauthenticated or unverified (`email_verified == false`) user can read or write any collection.
2. **Store Member Boundary**: Only the bootstrapped owner (`kayumislam.official@gmail.com`) or an active entry in `authorizedEmails/{lowercaseEmail}` can read catalog/staff PIN profiles.
3. **Admin-Only Catalog & Staff Mutations**: Only Admins (`isAdmin()`) can create, update, or delete `categories`, `products`, `barcodes`, `staff`, `authorizedEmails`, or `storeSettings`. Staff accounts (`role == 'staff'`) have read-only access to products/categories/settings and cannot escalate their own role or tamper with prices or PINs.
4. **Immutable Audit Logs**: `priceHistory` records can only be created by Admins with server timestamp (`request.time`) and cannot be updated or deleted.
5. **Barcode Uniqueness & Atomicity**: Creating or changing a product barcode requires an atomic `barcodes/{barcodeId}` lock document pointing to that `productId`.
6. **Strict Schema & No Shadow Fields**: Every write passes `isValid[Entity](incoming())` enforcing `hasAll` + `hasOnly`, strict types, string `.size()` bounds, numeric non-negative bounds, and `request.time` on `createdAt`/`updatedAt`.
7. **No Invoice/Sales/Customer Persistence**: No `invoices`, `sales`, or `customers` collections are permitted anywhere in Firestore (default-deny catch-all blocks any other path).

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Product Read/Write**: `request.auth == null` reading `/products/{id}` -> DENIED.
2. **Unverified Email Spoof**: `request.auth.token.email == 'kayumislam.official@gmail.com'` with `email_verified == false` -> DENIED.
3. **Unauthorized Outsider Google Account**: Verified Gmail not in `authorizedEmails` reading `/products` -> DENIED.
4. **Staff Privilege Escalation**: Staff user creating `/staff/evil` with `role: 'admin'` -> DENIED.
5. **Shadow Field Injection**: Admin writing `/products/p1` with extra ghost field `isVerified: true` -> DENIED (`hasOnly` check).
6. **ID Poisoning**: Admin writing `/products/aaaa...200chars` or `/products/bad$id` -> DENIED (`isValidId`).
7. **Negative Price Poisoning**: Admin creating `/products/p1` with `sellingPrice: -50` -> DENIED.
8. **Type Poisoning**: Admin updating `/products/p1` with `sellingPrice: "100"` (string instead of number) -> DENIED.
9. **Timestamp Spoofing**: Admin creating `/products/p1` with client-forged `createdAt` != `request.time` -> DENIED.
10. **Price History Tampering**: Anyone attempting `update` or `delete` on `/priceHistory/{id}` -> DENIED.
11. **PII Leak on `authorizedEmails`**: Staff A attempting `get` on `/authorizedEmails/staffB@gmail.com` -> DENIED (only `isAdmin()` or self email can read).
12. **Client-Invented Collection Write**: Writing to `/invoices/inv1` or `/customers/c1` -> DENIED (default-deny catch-all).
