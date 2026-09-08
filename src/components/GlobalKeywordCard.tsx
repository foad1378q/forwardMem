import React, { useState, useEffect } from 'react';
import {
  Filter,
  Check,
  Plus,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Send,
  SlidersHorizontal,
} from 'lucide-react';

interface GlobalKeywordCardProps {
  isAdmin: boolean;
  onRequireLogin: () => void;
}

export const GlobalKeywordCard: React.FC<GlobalKeywordCardProps> = ({ isAdmin, onRequireLogin }) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [forbiddenKeywords, setForbiddenKeywords] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState<'any' | 'all'>('any');

  const [inputForward, setInputForward] = useState<string>('');
  const [inputForbidden, setInputForbidden] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load global keywords on mount
  const fetchGlobalKeywords = async () => {
    try {
      const res = await fetch('/api/global-keywords');
      const data = await res.json();
      if (data) {
        setEnabled(!!data.enableGlobalKeywords);
        setKeywords(data.globalKeywords || []);
        setForbiddenKeywords(data.globalForbiddenKeywords || []);
        setMatchMode(data.globalKeywordMatchMode || 'any');
      }
    } catch (err) {
      console.error('Failed to load global keywords:', err);
    }
  };

  useEffect(() => {
    fetchGlobalKeywords();
  }, []);

  const handleAddForwardKeywords = () => {
    if (!inputForward.trim()) return;
    const newItems = inputForward
      .split(/[\n,،]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0 && !keywords.includes(k));

    if (newItems.length > 0) {
      setKeywords([...keywords, ...newItems]);
      setInputForward('');
    }
  };

  const handleRemoveForwardKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter((k) => k !== keywordToRemove));
  };

  const handleAddForbiddenKeywords = () => {
    if (!inputForbidden.trim()) return;
    const newItems = inputForbidden
      .split(/[\n,،]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0 && !forbiddenKeywords.includes(k));

    if (newItems.length > 0) {
      setForbiddenKeywords([...forbiddenKeywords, ...newItems]);
      setInputForbidden('');
    }
  };

  const handleRemoveForbiddenKeyword = (keywordToRemove: string) => {
    setForbiddenKeywords(forbiddenKeywords.filter((k) => k !== keywordToRemove));
  };

  const handleSave = async () => {
    if (!isAdmin) {
      onRequireLogin();
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/global-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enableGlobalKeywords: enabled,
          globalKeywords: keywords,
          globalForbiddenKeywords: forbiddenKeywords,
          globalKeywordMatchMode: matchMode,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ text: 'تنظیمات فیلتر کلمات کلیدی با موفقیت ذخیره شد.', type: 'success' });
      } else {
        setMessage({ text: data.message || 'خطا در ذخیره فیلتر کلمات کلیدی.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'خطا در برقراری ارتباط با سرور.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 relative overflow-hidden transition duration-300 hover:shadow-2xl hover:shadow-blue-500/10"
      id="global-keyword-card"
    >
      {/* Header Bar with Toggle & Accordion */}
      <div className="p-6 pb-4 flex items-center justify-between gap-4 border-b border-slate-100 select-none">
        <div
          className="flex items-center space-x-3 space-x-reverse cursor-pointer flex-1"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
            <Filter className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-1">
              <h2 className="text-lg font-bold text-slate-800">فیلتر سراسری کلمات کلیدی</h2>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  enabled
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {enabled ? '🟢 فعال' : '⚪ غیرفعال'}
              </span>

              {/* Summary badging when collapsed */}
              {isCollapsed && (
                <div className="flex items-center space-x-2 space-x-reverse text-[11px] font-semibold text-slate-500 mr-2">
                  <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                    🔴 {forbiddenKeywords.length} کلمه ممنوعه
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                    🟢 {keywords.length} کلمه فروارد
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              مدیریت هوشمند کلمات ارسال ممنوع (بلاک) و کلمات کلیدی مجاز برای فروارد به کانال مقصد
            </p>
          </div>
        </div>

        {/* Action Controls: Switch & Collapse Toggle */}
        <div className="flex items-center space-x-3 space-x-reverse shrink-0">
          <div className="flex items-center space-x-2 space-x-reverse">
            <span className="text-xs font-semibold text-slate-600 hidden sm:inline">وضعیت فیلتر:</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEnabled(!enabled);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? 'bg-blue-600' : 'bg-slate-200'
              }`}
              title="فعال/غیرفعال‌سازی فیلتر عمومی"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? '-translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition flex items-center justify-center"
            title={isCollapsed ? 'باز کردن باکس' : 'بستن کشویی باکس'}
          >
            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Collapsible Content Body */}
      {!isCollapsed && (
        <div className="p-6 pt-5 space-y-6 animate-fadeIn">
          {message && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center space-x-2 space-x-reverse ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Two Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category 1: کلمات ارسال ممنوع (Forbidden / Blacklist) */}
            <div className="bg-rose-50/40 border border-rose-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-200 flex items-center justify-center text-rose-600">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-rose-900">۱. کلمات ارسال ممنوع (Blacklist)</h3>
                      <p className="text-[11px] text-rose-700/80">
                        در صورت داشتن این کلمات، پست به هیچ وجه فروارد نخواهد شد.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-lg">
                    {forbiddenKeywords.length} کلمه
                  </span>
                </div>

                {/* Input for Forbidden */}
                <div className="space-y-1.5 pt-2">
                  <label className="block text-[11px] font-bold text-slate-700">افزودن کلمات ممنوعه:</label>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="text"
                      value={inputForbidden}
                      onChange={(e) => setInputForbidden(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddForbiddenKeywords();
                        }
                      }}
                      placeholder="مثال: تبلیغات، شرط‌بندی، پورن..."
                      className="flex-1 bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                    />
                    <button
                      type="button"
                      onClick={handleAddForbiddenKeywords}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1 space-x-reverse shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن</span>
                    </button>
                  </div>
                </div>

                {/* Forbidden Keywords Chips */}
                <div className="mt-3">
                  {forbiddenKeywords.length === 0 ? (
                    <div className="p-3 bg-white/70 border border-dashed border-rose-200 rounded-xl text-center text-xs text-rose-400">
                      هیچ کلمه ممنوعه‌ای تعریف نشده است.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 bg-white/80 border border-rose-200 rounded-xl">
                      {forbiddenKeywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1.5 space-x-reverse bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-xs font-bold shadow-2xs"
                        >
                          <span>🚫 {kw}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveForbiddenKeyword(kw)}
                            className="text-rose-400 hover:text-rose-800 transition rounded-full p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Category 2: کلمات کلیدی فروارد (Forward / Whitelist) */}
            <div className="bg-blue-50/40 border border-blue-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-200 flex items-center justify-center text-blue-600">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-blue-900">۲. کلمات کلیدی فروارد (Whitelist)</h3>
                      <p className="text-[11px] text-blue-700/80">
                        پیام‌ها فقط در صورت داشتن این کلمات فروارد می‌شوند (خالی = همه پیام‌های غیرممنوع).
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-lg">
                    {keywords.length} کلمه
                  </span>
                </div>

                {/* Match Mode Radio Selection */}
                <div className="bg-white/80 border border-blue-100 rounded-xl p-2.5 mb-3 text-xs text-slate-700">
                  <div className="flex items-center space-x-3 space-x-reverse font-medium">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center space-x-1 space-x-reverse">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                      <span>منطق:</span>
                    </span>
                    <label className="flex items-center space-x-1 space-x-reverse cursor-pointer">
                      <input
                        type="radio"
                        name="matchMode"
                        value="any"
                        checked={matchMode === 'any'}
                        onChange={() => setMatchMode('any')}
                        className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span>حداقل یک کلمه (OR)</span>
                    </label>
                    <label className="flex items-center space-x-1 space-x-reverse cursor-pointer">
                      <input
                        type="radio"
                        name="matchMode"
                        value="all"
                        checked={matchMode === 'all'}
                        onChange={() => setMatchMode('all')}
                        className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span>تمام کلمات (AND)</span>
                    </label>
                  </div>
                </div>

                {/* Input for Forward Keywords */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700">افزودن کلمات کلیدی فروارد:</label>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="text"
                      value={inputForward}
                      onChange={(e) => setInputForward(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddForwardKeywords();
                        }
                      }}
                      placeholder="مثال: استخدام، کریپتو، اخبار..."
                      className="flex-1 bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                    />
                    <button
                      type="button"
                      onClick={handleAddForwardKeywords}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1 space-x-reverse shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن</span>
                    </button>
                  </div>
                </div>

                {/* Forward Keywords Chips */}
                <div className="mt-3">
                  {keywords.length === 0 ? (
                    <div className="p-3 bg-white/70 border border-dashed border-blue-200 rounded-xl text-center text-xs text-blue-400">
                      هیچ کلمه‌ای تعیین نشده است (همه پیام‌های مجاز ارسال می‌شوند).
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 bg-white/80 border border-blue-200 rounded-xl">
                      {keywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1.5 space-x-reverse bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-bold shadow-2xs"
                        >
                          <span>🟢 {kw}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveForwardKeyword(kw)}
                            className="text-blue-400 hover:text-blue-800 transition rounded-full p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-[11px] text-slate-400">
              تغییرات به صورت لحظه‌ای ذخیره شده و روی تمام کانال‌های مانیتور شده اعمال می‌گردد.
            </p>

            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال ذخیره‌سازی...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>ذخیره فیلتر کلمات کلیدی</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

