const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBnDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function formatNumberBn(value: number, decimals?: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted =
    typeof decimals === 'number'
      ? safe.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : safe.toLocaleString('en-US', {
          maximumFractionDigits: 2,
        });
  return toBnDigits(formatted);
}

export function formatBDT(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const hasFraction = Math.abs(safe % 1) > 0.001;
  const formatted = safe.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `৳ ${toBnDigits(formatted)}`;
}

export function normalizeBarcode(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_\-.]/g, '');
}

export function isValidBarcodeFormat(barcode: string): boolean {
  if (!barcode) return true;
  return /^[a-zA-Z0-9_\-.]{1,64}$/.test(barcode);
}

export function buildSearchKeywords(nameBn: string, nameEn: string, barcode: string): string {
  const combined = `${nameBn.trim()} ${nameEn.trim()} ${barcode.trim()}`.toLowerCase().trim();
  return combined.slice(0, 300) || 'product';
}

export function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  return trimmed.startsWith('https://') || trimmed.startsWith('/assets/');
}

export function formatBnDateTime(ts: unknown): string {
  let date: Date | null = null;
  if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    date = (ts as { toDate: () => Date }).toDate();
  } else if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'number' || typeof ts === 'string') {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  if (!date) return 'এখনই';

  return new Intl.DateTimeFormat('bn-BD', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
