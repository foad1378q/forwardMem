import React, { useState } from 'react';
import { X, Plus, Radio, Users, AlertCircle, RefreshCw, Search, ListPlus } from 'lucide-react';
import { addSource } from '../lib/telegramApi';
import { SourceChannel } from '../types';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSourceAdded: (source: SourceChannel) => void;
  onBulkAdded?: () => void;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  onSourceAdded,
  onBulkAdded,
}) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [username, setUsername] = useState('');
  const [bulkInputs, setBulkInputs] = useState('');
  const [type, setType] = useState<'channel' | 'group'>('channel');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await addSource(username, type);
      if (res.success && res.source) {
        onSourceAdded(res.source);
        setUsername('');
        onClose();
      } else {
        setError(res.message || 'خطا در اضافه کردن کانال/گروه.');
      }
    } catch (err: any) {
      setError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInputs.trim()) return;

    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const lines = bulkInputs
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        setError('لطفاً حداقل یک آیدی عددی یا شناسه وارد کنید.');
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/sources/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lines, type }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || `${data.addedCount} کانال/گروه با موفقیت اضافه شدند.`);
        setBulkInputs('');
        if (onBulkAdded) onBulkAdded();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(data.message || 'خطا در افزودن دسته‌جمعی کانال‌ها.');
      }
    } catch (err: any) {
      setError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5 text-slate-800 dark:text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
            {mode === 'single' ? <Plus className="w-6 h-6" /> : <ListPlus className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold">افزودن مبدأ مانیتورینگ جدید</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              پشتیبانی کامل از **آیدی‌های عددی** (مانند 1001234567890-) و لینک/یوزرنیم
            </p>
          </div>
        </div>

        {/* Single or Bulk Tabs Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center space-x-2 space-x-reverse ${
              mode === 'single'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>افزودن تکی</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center space-x-2 space-x-reverse ${
              mode === 'bulk'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ListPlus className="w-4 h-4" />
            <span>افزودن دسته‌جمعی (لیست چند خطی)</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2 space-x-reverse">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center space-x-2 space-x-reverse">
            <AlertCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {mode === 'single' ? (
          <form onSubmit={handleSingleSubmit} className="space-y-4">
            {/* Channel or Group Type */}
            <div>
              <label className="block text-xs font-semibold mb-2">نوع مبدأ</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('channel')}
                  className={`flex items-center justify-center space-x-2 space-x-reverse p-3 rounded-xl border text-xs font-bold transition ${
                    type === 'channel'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                  <span>کانال (عمومی / خصوصی)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType('group')}
                  className={`flex items-center justify-center space-x-2 space-x-reverse p-3 rounded-xl border text-xs font-bold transition ${
                    type === 'group'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>گروه / سوپرگروه</span>
                </button>
              </div>
            </div>

            {/* Single Input */}
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                آیدی عددی یا شناسه / لینک کانال یا گروه
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: 1001987654321- یا durov@ یا لینک"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition dir-ltr"
                  autoFocus
                  required
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                💡 می‌توانید آیدی عددی مانند <code className="font-mono text-blue-500">-1001234567890</code> وارد کنید تا اسم کانال به صورت خودکار شناسایی شود.
              </span>
            </div>

            <div className="pt-3 flex justify-end space-x-3 space-x-reverse border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isLoading || !username.trim()}
                className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
                id="confirm-add-source-btn"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال استخراج نام کانال...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>افزودن و مانیتورینگ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleBulkSubmit} className="space-y-4">
            {/* Channel or Group Type */}
            <div>
              <label className="block text-xs font-semibold mb-2">نوع پیش‌فرض موارد وارد شده</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('channel')}
                  className={`flex items-center justify-center space-x-2 space-x-reverse p-2.5 rounded-xl border text-xs font-bold transition ${
                    type === 'channel'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                  <span>کانال‌ها</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType('group')}
                  className={`flex items-center justify-center space-x-2 space-x-reverse p-2.5 rounded-xl border text-xs font-bold transition ${
                    type === 'group'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>گروه‌ها</span>
                </button>
              </div>
            </div>

            {/* Bulk Textarea Input */}
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                لیست آیدی‌های عددی و شناسه کانال‌ها (هر کدام در یک خط)
              </label>
              <textarea
                rows={6}
                value={bulkInputs}
                onChange={(e) => setBulkInputs(e.target.value)}
                placeholder={`مثال:\n-1001234567890\n-1009876543210\n@radiopedia7\nhttps://t.me/channelname`}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition dir-ltr"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                تعداد خطوط شناسه‌ها به صورت خودکار تفکیک و نام آن‌ها استخراج شده و به لیست در حال مانیتورینگ افزوده می‌شود.
              </span>
            </div>

            <div className="pt-3 flex justify-end space-x-3 space-x-reverse border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isLoading || !bulkInputs.trim()}
                className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال افزودن دسته‌جمعی...</span>
                  </>
                ) : (
                  <>
                    <ListPlus className="w-4 h-4" />
                    <span>افزودن دسته‌جمعی به مانیتورینگ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
