import { useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  FolderTree,
  History,
  KeyRound,
  Mail,
  Plus,
  Save,
  Settings,
  Shield,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { formatBDT, formatBnDateTime, toBnDigits } from '../lib/format';
import {
  createStaffProfile,
  deleteAuthorizedEmail,
  deleteCategory,
  deleteStaffProfile,
  saveAuthorizedEmail,
  saveCategory,
  saveStoreSettings,
  seedStarterCategories,
  updateStaffProfile,
} from '../services/storeService';
import {
  DEFAULT_STORE_SETTINGS,
  type AuthorizedEmail,
  type Category,
  type PriceHistoryEntry,
  type Product,
  type StaffProfile,
  type StaffRole,
  type StoreSettings,
} from '../types/store';

// ---------------------------------------------------------------------------
// 1. Category Manager
// ---------------------------------------------------------------------------
export function CategoriesManager({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const [nameBn, setNameBn] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [sortOrder, setSortOrder] = useState('1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const countByCat = (catId: string) => products.filter((p) => p.categoryId === catId).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!navigator.onLine) {
      setMsg({ type: 'err', text: 'অফলাইন অবস্থায় ক্যাটাগরি সংরক্ষণ করা যাবে না।' });
      return;
    }
    setIsSaving(true);
    try {
      await saveCategory({
        id: editingId || undefined,
        nameBn,
        nameEn,
        sortOrder: Number(sortOrder) || 0,
      });
      setMsg({
        type: 'ok',
        text: editingId ? 'ক্যাটাগরি আপডেট হয়েছে।' : 'নতুন ক্যাটাগরি যোগ হয়েছে।',
      });
      setNameBn('');
      setNameEn('');
      setSortOrder(String(categories.length + 2));
      setEditingId(null);
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'ক্যাটাগরি সংরক্ষণ করা যায়নি।',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    setMsg(null);
    if (!navigator.onLine) {
      setMsg({ type: 'err', text: 'অফলাইন অবস্থায় ক্যাটাগরি মোছা যাবে না।' });
      return;
    }
    try {
      await deleteCategory(cat.id, countByCat(cat.id));
      setMsg({ type: 'ok', text: `"${cat.nameBn}" ক্যাটাগরি মুছে ফেলা হয়েছে।` });
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'ক্যাটাগরি মোছা যায়নি।',
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <FolderTree className="w-5 h-5 text-blue-700" />
            <h2 className="text-xl font-bold text-slate-900">ক্যাটাগরি ম্যানেজমেন্ট</h2>
          </div>
          {categories.length === 0 && (
            <button
              type="button"
              onClick={() => void seedStarterCategories()}
              className="min-h-[40px] px-4 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold cursor-pointer"
            >
              প্রাথমিক ৮টি ক্যাটাগরি যোগ করুন
            </button>
          )}
        </div>

        {msg && (
          <div
            className={`mb-4 rounded-xl px-4 py-2.5 text-xs font-medium border ${
              msg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ক্যাটাগরির বাংলা নাম *
            </label>
            <input
              type="text"
              value={nameBn}
              onChange={(e) => setNameBn(e.target.value)}
              placeholder="যেমন: চাল ও ডাল"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ইংরেজি নাম (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. Rice & Lentils"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">ক্রম</label>
            <input
              type="number"
              min="0"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full min-h-[44px] px-2.5 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {editingId ? 'আপডেট' : 'যোগ'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setNameBn('');
                  setNameEn('');
                }}
                className="min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                বাতিল
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {categories.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">কোনো ক্যাটাগরি নেই।</div>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50"
            >
              <div>
                <div className="font-semibold text-slate-900">{cat.nameBn}</div>
                <div className="text-xs text-slate-500">
                  {cat.nameEn ? `${cat.nameEn} · ` : ''}পণ্য সংখ্যা: {toBnDigits(countByCat(cat.id))}টি
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(cat.id);
                    setNameBn(cat.nameBn);
                    setNameEn(cat.nameEn);
                    setSortOrder(String(cat.sortOrder));
                  }}
                  className="p-2 rounded-lg text-blue-700 hover:bg-blue-50 cursor-pointer"
                  title="সম্পাদনা"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(cat)}
                  className="p-2 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                  title="মুছুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Staff, PIN & Authorized Device Manager
// ---------------------------------------------------------------------------
export function StaffManager({
  staffList,
  authorizedEmails,
  currentStaffId,
}: {
  staffList: StaffProfile[];
  authorizedEmails: AuthorizedEmail[];
  currentStaffId: string;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('staff');
  const [pin, setPin] = useState('');
  const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);
  const [staffMsg, setStaffMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isSavingStaff, setIsSavingStaff] = useState(false);

  // Authorized Google Emails for extra phones
  const [emailInput, setEmailInput] = useState('');
  const [emailLabel, setEmailLabel] = useState('');
  const [emailRole, setEmailRole] = useState<StaffRole>('staff');
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffMsg(null);
    if (!navigator.onLine) {
      setStaffMsg({ type: 'err', text: 'অফলাইনে স্টাফ বা পিন পরিবর্তন করা যাবে না।' });
      return;
    }
    setIsSavingStaff(true);
    try {
      if (editingStaff) {
        await updateStaffProfile({
          staffId: editingStaff.id,
          name,
          role,
          isActive: editingStaff.isActive,
          newPin: pin || undefined,
          existingSalt: editingStaff.pinSalt,
          existingHash: editingStaff.pinHash,
        });
        setStaffMsg({ type: 'ok', text: `"${name}"-এর তথ্য ও পিন আপডেট হয়েছে।` });
        setEditingStaff(null);
      } else {
        await createStaffProfile({ name, role, pin });
        setStaffMsg({ type: 'ok', text: `নতুন ${role === 'admin' ? 'অ্যাডমিন' : 'স্টাফ'} পিন তৈরি হয়েছে।` });
      }
      setName('');
      setRole('staff');
      setPin('');
    } catch (err) {
      setStaffMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'সংরক্ষণ করা যায়নি।',
      });
    } finally {
      setIsSavingStaff(false);
    }
  };

  const toggleStaffStatus = async (staff: StaffProfile) => {
    if (!navigator.onLine) {
      setStaffMsg({ type: 'err', text: 'অফলাইনে স্টাফ অ্যাক্সেস পরিবর্তন করা যাবে না।' });
      return;
    }
    if (staff.id === currentStaffId && staff.isActive) {
      setStaffMsg({ type: 'err', text: 'নিজের চলমান অ্যাকাউন্ট নিজে বন্ধ করা যাবে না।' });
      return;
    }
    try {
      await updateStaffProfile({
        staffId: staff.id,
        name: staff.name,
        role: staff.role,
        isActive: !staff.isActive,
        existingSalt: staff.pinSalt,
        existingHash: staff.pinHash,
      });
      setStaffMsg({
        type: 'ok',
        text: staff.isActive
          ? `"${staff.name}"-এর অ্যাক্সেস বন্ধ করা হয়েছে।`
          : `"${staff.name}"-এর অ্যাক্সেস পুনরায় চালু করা হয়েছে।`,
      });
    } catch (err) {
      setStaffMsg({ type: 'err', text: err instanceof Error ? err.message : 'আপডেট করা যায়নি।' });
    }
  };

  const handleAddAuthorizedEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);
    if (!navigator.onLine) {
      setEmailMsg({ type: 'err', text: 'অফলাইনে নতুন ইমেইল অনুমোদন করা যাবে না।' });
      return;
    }
    try {
      await saveAuthorizedEmail({
        email: emailInput,
        label: emailLabel,
        role: emailRole,
        isActive: true,
      });
      setEmailMsg({ type: 'ok', text: 'স্টাফের ডিভাইস ইমেইল অনুমোদিত হয়েছে।' });
      setEmailInput('');
      setEmailLabel('');
      setEmailRole('staff');
    } catch (err) {
      setEmailMsg({ type: 'err', text: err instanceof Error ? err.message : 'ইমেইল যোগ করা যায়নি।' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Staff PIN Creation & Management */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <KeyRound className="w-5 h-5 text-blue-700" />
          <div>
            <h2 className="text-xl font-bold text-slate-900">স্টাফ ও পিন ম্যানেজমেন্ট</h2>
            <p className="text-xs text-slate-500">
              পিন নিরাপদ SHA-256 হ্যাশ হিসেবে সংরক্ষিত থাকে। যেকোনো সময় অ্যাক্সেস বন্ধ বা পিন পরিবর্তন করতে পারবেন।
            </p>
          </div>
        </div>

        {staffMsg && (
          <div
            className={`rounded-xl px-4 py-2.5 text-xs font-medium border ${
              staffMsg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {staffMsg.text}
          </div>
        )}

        <form onSubmit={handleStaffSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">নাম *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: করিম (ক্যাশিয়ার)"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">দায়িত্ব (Role)</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="staff">স্টাফ (Staff)</option>
              <option value="admin">অ্যাডমিন (Admin)</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {editingStaff ? 'নতুন পিন (ঐচ্ছিক)' : 'গোপন পিন (৪–৬ সংখ্যা) *'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-600"
              required={!editingStaff}
            />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={isSavingStaff}
              className="flex-1 min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
            >
              {editingStaff ? 'আপডেট' : 'তৈরি করুন'}
            </button>
            {editingStaff && (
              <button
                type="button"
                onClick={() => {
                  setEditingStaff(null);
                  setName('');
                  setPin('');
                  setRole('staff');
                }}
                className="min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                বাতিল
              </button>
            )}
          </div>
        </form>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {staffList.map((s) => (
            <div key={s.id} className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{s.name}</span>
                  {s.id === currentStaffId && (
                    <span className="text-xs font-semibold text-blue-700">(বর্তমান সেশন)</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  পদবি: {s.role === 'admin' ? 'অ্যাডমিন' : 'স্টাফ'} · অবস্থা:{' '}
                  <span className={s.isActive ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
                    {s.isActive ? 'সক্রিয়' : 'বন্ধ (Blocked)'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingStaff(s);
                    setName(s.name);
                    setRole(s.role);
                    setPin('');
                  }}
                  className="min-h-[36px] px-3 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  পিন/তথ্য
                </button>
                <button
                  type="button"
                  onClick={() => void toggleStaffStatus(s)}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                    s.isActive
                      ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {s.isActive ? (
                    <>
                      <UserX className="w-3.5 h-3.5" /> বন্ধ করুন
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" /> চালু করুন
                    </>
                  )}
                </button>
                {s.id !== currentStaffId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!navigator.onLine) {
                        setStaffMsg({ type: 'err', text: 'অফলাইনে স্টাফ মুছে ফেলা যাবে না।' });
                        return;
                      }
                      void deleteStaffProfile(s.id);
                    }}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                    title="মুছুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-Phone Google Device Authorization */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Mail className="w-5 h-5 text-blue-700" />
          <div>
            <h3 className="text-lg font-bold text-slate-900">অনুমোদিত স্টাফ ফোন / Google অ্যাকাউন্ট</h3>
            <p className="text-xs text-slate-500">
              স্টাফরা নিজস্ব ফোনের Google অ্যাকাউন্ট দিয়ে যুক্ত হতে চাইলে এখানে তাদের Gmail ঠিকানা যোগ করুন।
            </p>
          </div>
        </div>

        {emailMsg && (
          <div
            className={`rounded-xl px-4 py-2.5 text-xs font-medium border ${
              emailMsg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {emailMsg.text}
          </div>
        )}

        <form onSubmit={handleAddAuthorizedEmail} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1">স্টাফের Gmail ঠিকানা *</label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="staff@gmail.com"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">পরিচয় / ডিভাইস *</label>
            <input
              type="text"
              value={emailLabel}
              onChange={(e) => setEmailLabel(e.target.value)}
              placeholder="যেমন: কাউন্টার ফোন ২"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">অ্যাক্সেস</label>
            <select
              value={emailRole}
              onChange={(e) => setEmailRole(e.target.value as StaffRole)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="staff">স্টাফ</option>
              <option value="admin">অ্যাডমিন</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer"
            >
              যোগ করুন
            </button>
          </div>
        </form>

        {authorizedEmails.length > 0 && (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {authorizedEmails.map((acc) => (
              <div key={acc.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <div className="font-semibold text-slate-900">{acc.label}</div>
                  <div className="text-xs text-slate-500 font-mono-num">
                    {acc.email} · {acc.role === 'admin' ? 'অ্যাডমিন' : 'স্টাফ'} ·{' '}
                    {acc.isActive ? 'সক্রিয়' : 'বন্ধ'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.onLine) {
                      setEmailMsg({ type: 'err', text: 'অফলাইনে ইমেইল অপসারণ করা যাবে না।' });
                      return;
                    }
                    void deleteAuthorizedEmail(acc.email);
                  }}
                  className="p-2 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                  title="অপসারণ করুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Price Update History View
// ---------------------------------------------------------------------------
export function PriceHistoryView({
  priceHistory,
  canViewPurchasePrice,
}: {
  priceHistory: PriceHistoryEntry[];
  canViewPurchasePrice: boolean;
}) {
  const [query, setQuery] = useState('');
  const filtered = priceHistory.filter((item) =>
    item.productNameBn.toLowerCase().includes(query.trim().toLowerCase()) ||
    item.changedByName.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-blue-700" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">মূল্য পরিবর্তনের ইতিহাস</h2>
              <p className="text-xs text-slate-500">
                কে কখন কোন পণ্যের কেনা বা বিক্রির দাম পরিবর্তন করেছেন তার স্থায়ী রেকর্ড
              </p>
            </div>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="পণ্য বা পরিবর্তনকারীর নাম..."
            className="min-h-[42px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 sm:w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">কোনো মূল্য পরিবর্তনের ইতিহাস পাওয়া যায়নি।</div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="font-bold text-slate-900">{item.productNameBn}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  পরিবর্তনকারী: <strong className="text-slate-700">{item.changedByName}</strong> (
                  {item.changedByRole === 'admin' ? 'অ্যাডমিন' : 'স্টাফ'}) ·{' '}
                  {formatBnDateTime(item.createdAt)}
                </div>
              </div>
              <div className="text-sm font-mono-num sm:text-right space-y-0.5">
                <div className="font-bold text-blue-700">
                  বিক্রির দাম: {formatBDT(item.oldSellingPrice)} → {formatBDT(item.newSellingPrice)}
                </div>
                {canViewPurchasePrice && (
                  <div className="text-xs text-slate-600">
                    কেনা দাম: {formatBDT(item.oldPurchasePrice)} → {formatBDT(item.newPurchasePrice)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Store Settings View
// ---------------------------------------------------------------------------
export function SettingsView({
  settings,
  settingsExists,
}: {
  settings: StoreSettings | null;
  settingsExists: boolean;
}) {
  const [storeName, setStoreName] = useState(
    settings?.storeName || DEFAULT_STORE_SETTINGS.storeName
  );
  const [storeAddress, setStoreAddress] = useState(
    settings?.storeAddress || DEFAULT_STORE_SETTINGS.storeAddress
  );
  const [storePhones, setStorePhones] = useState(
    settings?.storePhones || DEFAULT_STORE_SETTINGS.storePhones
  );
  const [hidePurchasePriceForStaff, setHidePurchasePriceForStaff] = useState(
    settings?.hidePurchasePriceForStaff ?? DEFAULT_STORE_SETTINGS.hidePurchasePriceForStaff
  );
  const [savedOk, setSavedOk] = useState(false);
  const [settingsErr, setSettingsErr] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedOk(false);
    setSettingsErr('');
    if (!navigator.onLine) {
      setSettingsErr('অফলাইনে দোকানের সেটিংস সংরক্ষণ করা যাবে না।');
      return;
    }
    setIsSaving(true);
    try {
      await saveStoreSettings(
        {
          storeName,
          storeAddress,
          storePhones,
          hidePurchasePriceForStaff,
        },
        settingsExists
      );
      setSavedOk(true);
    } catch (err) {
      setSettingsErr(err instanceof Error ? err.message : 'সেটিংস সংরক্ষণ করা যায়নি।');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 max-w-2xl space-y-5">
      <div className="flex items-center gap-2.5">
        <Settings className="w-5 h-5 text-blue-700" />
        <div>
          <h2 className="text-xl font-bold text-slate-900">দোকানের সেটিংস ও নিরাপত্তা</h2>
          <p className="text-xs text-slate-500">
            ইনভয়েস প্রিন্ট হেডার এবং স্টাফের জন্য কেনা দাম গোপন রাখার নিয়ন্ত্রণ
          </p>
        </div>
      </div>

      {savedOk && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে।
        </div>
      )}

      {settingsErr && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-700">
          {settingsErr}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">দোকানের নাম</label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">দোকানের ঠিকানা</label>
          <input
            type="text"
            value={storeAddress}
            onChange={(e) => setStoreAddress(e.target.value)}
            className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">মোবাইল নম্বরসমূহ</label>
          <input
            type="text"
            value={storePhones}
            onChange={(e) => setStorePhones(e.target.value)}
            className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
            required
          />
        </div>

        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50">
          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div className="flex items-start gap-2.5">
              <Shield className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  শুধুমাত্র অ্যাডমিন কেনা দাম ও লাভ দেখতে পারবেন
                </span>
                <span className="text-xs text-slate-600 mt-0.5 block">
                  চালু রাখলে স্টাফ পিন দিয়ে লগইন করলে পণ্যের কেনা দাম এবং লাভের হিসাব সম্পূর্ণ লুকানো থাকবে।
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={hidePurchasePriceForStaff}
              onChange={(e) => setHidePurchasePriceForStaff(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-blue-700 cursor-pointer shrink-0"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="min-h-[46px] px-5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}
        </button>
      </form>
    </div>
  );
}
