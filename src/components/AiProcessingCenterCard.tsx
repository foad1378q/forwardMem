import React, { useState, useEffect } from 'react';
import { AiProcessingConfig } from '../types';
import {
  getAiProcessingSettings,
  saveAiProcessingSettings,
  testContentCleaning,
} from '../lib/telegramApi';
import {
  Cpu,
  Filter,
  Scissors,
  Paperclip,
  CopyX,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Layers,
  PenTool,
  CheckSquare,
  Link,
  AtSign,
  Hash,
  Smile,
  ShieldCheck,
  Zap,
  FileText,
  Phone,
} from 'lucide-react';

interface AiProcessingCenterCardProps {
  isAdmin: boolean;
  onRequireLogin: () => void;
  onSettingsSaved?: () => void;
}

const DEFAULT_CONFIG: AiProcessingConfig = {
  enableAiProcessing: true,

  // Tab 1: Keyword Filter
  enableKeywordFilter: false,
  allowedKeywords: [],
  blockedKeywords: [],
  keywordMatchMode: 'any',
  messagesPassed: 0,
  messagesBlocked: 0,

  // Tab 2: Content Cleaner
  enableContentCleaning: false,
  cleaningRules: ['https://', 'http://', '@', '#'],
  removeTelegramLinks: true,
  removeInstagramLinks: true,
  removeAllUrls: false,
  removeUsernames: true,
  removeHashtags: true,
  removeEmojis: false,

  // Contact Information
  enableContactManager: false,
  defaultContactNote: '📌 جهت ارتباط با ادمین در ارتباط باشید',

  // Tab 3: Media Rules
  enableMediaControl: true,
  forwardPhotos: true,
  forwardVideos: true,
  forwardPdfs: true,
  forwardDocuments: true,
  forwardAudios: true,
  mediaOrder: 'media_first',

  // Tab 4: Message Signature
  enableMessageSignature: false,
  signatureText: '',
  addSignatureAfterEveryMessage: true,

  // Tab 5: Duplicate Protection
  enableDuplicateProtection: true,
  duplicateDetectionType: 'both',
  timeWindowHours: 12,
  maxForwardingCount: 1,

  // Job Extractor
  enableJobExtraction: false,
};

export const AiProcessingCenterCard: React.FC<AiProcessingCenterCardProps> = ({
  isAdmin,
  onRequireLogin,
  onSettingsSaved,
}) => {
  const [config, setConfig] = useState<AiProcessingConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [openTab, setOpenTab] = useState<string | null>('tab_1');

  // Tab 1 (Keyword filter inputs)
  const [allowedKwInput, setAllowedKwInput] = useState<string>('');
  const [blockedKwInput, setBlockedKwInput] = useState<string>('');

  // Tab 2 (Content cleaner inputs & test)
  const [ruleInput, setRuleInput] = useState<string>('');
  const [testCleanText, setTestCleanText] = useState<string>('سلام دوستان! به کانال @my_test_channel بپیوندید. لینک سایت ما: https://example.com #فوری #خبر');
  const [isTestingClean, setIsTestingClean] = useState<boolean>(false);
  const [testCleanResult, setTestCleanResult] = useState<{
    originalText: string;
    cleanedText: string;
    finalWithSignature: string;
    removedItems: string[];
    signatureAdded: boolean;
  } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const res = await getAiProcessingSettings();
        if (res?.success && res.aiProcessing) {
          setConfig({ ...DEFAULT_CONFIG, ...res.aiProcessing });
        }
      } catch (err) {
        console.error('Failed to load processing settings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSaveConfig = async (updatedConfig = config) => {
    if (!isAdmin) {
      onRequireLogin();
      return;
    }
    setIsSaving(true);
    setMsg(null);
    try {
      const res = await saveAiProcessingSettings(updatedConfig);
      if (res?.success) {
        setConfig(res.aiProcessing);
        setMsg({ text: 'تنظیمات مرکز پردازش و فیلتر پیام‌ها با موفقیت ذخیره گردید.', type: 'success' });
        if (onSettingsSaved) onSettingsSaved();
      } else {
        setMsg({ text: res?.message || 'خطا در ذخیره تنظیمات.', type: 'error' });
      }
    } catch (err) {
      setMsg({ text: 'خطا در برقراری ارتباط با سرور.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTab = (tabId: string) => {
    setOpenTab(openTab === tabId ? null : tabId);
  };

  // Tab 1 helpers
  const handleAddAllowedKw = () => {
    if (!allowedKwInput.trim()) return;
    const items = allowedKwInput.split(/[\n,،]/).map((k) => k.trim()).filter((k) => k.length > 0 && !config.allowedKeywords.includes(k));
    if (items.length > 0) {
      const updated = { ...config, allowedKeywords: [...config.allowedKeywords, ...items] };
      setConfig(updated);
      setAllowedKwInput('');
    }
  };

  const handleAddBlockedKw = () => {
    if (!blockedKwInput.trim()) return;
    const items = blockedKwInput.split(/[\n,،]/).map((k) => k.trim()).filter((k) => k.length > 0 && !config.blockedKeywords.includes(k));
    if (items.length > 0) {
      const updated = { ...config, blockedKeywords: [...config.blockedKeywords, ...items] };
      setConfig(updated);
      setBlockedKwInput('');
    }
  };

  // Tab 2 helpers
  const handleAddCleaningRule = () => {
    if (!ruleInput.trim()) return;
    if (!config.cleaningRules.includes(ruleInput.trim())) {
      const updated = { ...config, cleaningRules: [...config.cleaningRules, ruleInput.trim()] };
      setConfig(updated);
      setRuleInput('');
    }
  };

  const handleRunTestClean = async () => {
    if (!testCleanText.trim()) return;
    setIsTestingClean(true);
    try {
      const res = await testContentCleaning(testCleanText, config);
      if (res.success) {
        setTestCleanResult({
          originalText: res.originalText,
          cleanedText: res.cleanedText,
          finalWithSignature: res.finalWithSignature,
          removedItems: res.removedItems || [],
          signatureAdded: !!res.signatureAdded,
        });
      }
    } catch (err) {
      console.error('Error running test clean:', err);
    } finally {
      setIsTestingClean(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center text-slate-500 shadow-xs">
        <RefreshCw className="w-6 h-6 mx-auto animate-spin text-indigo-600 mb-2" />
        <p className="text-xs font-medium">در حال بارگذاری مرکز پردازش و فیلتر پیام‌ها...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-800">مرکز پردازش، فیلتر و پاکسازی هوشمند</h2>
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                  config.enableAiProcessing
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {config.enableAiProcessing ? '⚡ خط پردازش فعال' : '⏸️ خط پردازش غیرفعال'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              مدیریت فیلتر کلمات مجاز/ممنوع، پاکسازی خودکار لینک‌ها و آیدی‌ها، کنترل فرمت‌های رسانه، امضای اختصاصی و جلوگیری از تکرار
            </p>
          </div>
        </div>

        {/* Global Master Switch */}
        <div className="flex items-center space-x-3 space-x-reverse bg-slate-50 p-2.5 px-4 rounded-2xl border border-slate-200 self-start sm:self-auto shrink-0 shadow-2xs">
          <span className="text-xs font-black text-slate-700">کلید اصلی پردازش:</span>
          <button
            type="button"
            onClick={() => {
              const updated = { ...config, enableAiProcessing: !config.enableAiProcessing };
              setConfig(updated);
              handleSaveConfig(updated);
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              config.enableAiProcessing ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
            title="فعال/غیرفعال‌سازی کلی خط پردازش"
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.enableAiProcessing ? '-translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Global Notification Banner */}
      {msg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between space-x-2 space-x-reverse ${
            msg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center space-x-2 space-x-reverse">
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{msg.text}</span>
          </div>
          <button type="button" onClick={() => setMsg(null)} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Processing Pipeline Flowchart Indicator */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-4 text-white shadow-xs overflow-x-auto">
        <div className="text-[11px] font-bold text-indigo-300 mb-2 flex items-center space-x-2 space-x-reverse">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>ترتیب مراحل پردازش پیام‌ها (Processing Pipeline):</span>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse text-[11px] font-medium whitespace-nowrap min-w-max">
          <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-slate-300 border border-slate-700">دریافت پیام از کانال</span>
          <span className="text-slate-500">←</span>
          <span className={`px-2.5 py-1 rounded-lg border ${config.enableDuplicateProtection ? 'bg-indigo-900/80 text-indigo-200 border-indigo-700 font-bold' : 'bg-slate-800 text-slate-400 border-slate-800'}`}>
            ۱. بررسی عدم تکرار
          </span>
          <span className="text-slate-500">←</span>
          <span className={`px-2.5 py-1 rounded-lg border ${config.enableKeywordFilter ? 'bg-indigo-900/80 text-indigo-200 border-indigo-700 font-bold' : 'bg-slate-800 text-slate-400 border-slate-800'}`}>
            ۲. فیلتر کلمات
          </span>
          <span className="text-slate-500">←</span>
          <span className={`px-2.5 py-1 rounded-lg border ${config.enableContentCleaning ? 'bg-indigo-900/80 text-indigo-200 border-indigo-700 font-bold' : 'bg-slate-800 text-slate-400 border-slate-800'}`}>
            ۳. پاکسازی لینک و آیدی
          </span>
          <span className="text-slate-500">←</span>
          <span className={`px-2.5 py-1 rounded-lg border ${config.enableMediaControl ? 'bg-indigo-900/80 text-indigo-200 border-indigo-700 font-bold' : 'bg-slate-800 text-slate-400 border-slate-800'}`}>
            ۴. کنترل فرمت‌های رسانه
          </span>
          <span className="text-slate-500">←</span>
          <span className={`px-2.5 py-1 rounded-lg border ${config.enableMessageSignature ? 'bg-indigo-900/80 text-indigo-200 border-indigo-700 font-bold' : 'bg-slate-800 text-slate-400 border-slate-800'}`}>
            ۵. پیوست امضا
          </span>
          <span className="text-slate-500">←</span>
          <span className="px-2.5 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-700 rounded-lg font-bold">
            ۶. ورود به صف پایدار و ارسال زمان‌بندی‌شده
          </span>
        </div>
      </div>

      {/* Accordion Tabs Container */}
      <div className="space-y-4">
        {/* TAB 1: Keyword Filter */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div
            className="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50/70 hover:bg-slate-100/80 transition"
            onClick={() => toggleTab('tab_1')}
          >
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
                <Filter className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="font-bold text-slate-800 text-sm">تب ۱: 🔍 فیلتر کلمات کلیدی (Keyword Filter)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${config.enableKeywordFilter ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {config.enableKeywordFilter ? 'روشن' : 'خاموش'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">تعریف کلمات مجاز (شرط ارسال) و کلمات ممنوع (مسدودسازی پیام)</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 space-x-reverse">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfig({ ...config, enableKeywordFilter: !config.enableKeywordFilter });
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  config.enableKeywordFilter ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    config.enableKeywordFilter ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              {openTab === 'tab_1' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>

          {openTab === 'tab_1' && (
            <div className="p-5 border-t border-slate-100 space-y-5 animate-fadeIn">
              <div className="flex items-center space-x-4 space-x-reverse text-xs text-slate-700">
                <span className="font-bold">نحوه انطباق کلمات مجاز:</span>
                <label className="flex items-center space-x-1 space-x-reverse cursor-pointer">
                  <input
                    type="radio"
                    name="matchMode"
                    value="any"
                    checked={config.keywordMatchMode === 'any'}
                    onChange={() => setConfig({ ...config, keywordMatchMode: 'any' })}
                    className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span>وجود حداقل یکی از کلمات (Any)</span>
                </label>
                <label className="flex items-center space-x-1 space-x-reverse cursor-pointer">
                  <input
                    type="radio"
                    name="matchMode"
                    value="all"
                    checked={config.keywordMatchMode === 'all'}
                    onChange={() => setConfig({ ...config, keywordMatchMode: 'all' })}
                    className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span>وجود همه کلمات به صورت همزمان (All)</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Allowed Keywords */}
                <div className="space-y-3 bg-blue-50/40 p-4 rounded-2xl border border-blue-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 flex items-center space-x-1.5 space-x-reverse">
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                      <span>کلمات مجاز (پیام در صورت داشتن این کلمات منتقل می‌شود):</span>
                    </span>
                    <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                      {config.allowedKeywords.length} کلمه
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full min-w-0">
                    <input
                      type="text"
                      value={allowedKwInput}
                      onChange={(e) => setAllowedKwInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAllowedKw();
                        }
                      }}
                      placeholder="کلمه را تایپ کرده و Enter بزنید..."
                      className="flex-1 min-w-0 bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddAllowedKw}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 space-x-reverse shrink-0 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-white/70 rounded-xl border border-blue-100">
                    {config.allowedKeywords.length === 0 ? (
                      <span className="text-xs text-slate-400">هیچ کلمه‌ای ثبت نشده است (در این حالت پیام‌ها بر اساس کلمات مجاز محدود نمی‌شوند).</span>
                    ) : (
                      config.allowedKeywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1 space-x-reverse bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-medium"
                        >
                          <span>{kw}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setConfig({
                                ...config,
                                allowedKeywords: config.allowedKeywords.filter((k) => k !== kw),
                              })
                            }
                            className="text-blue-400 hover:text-blue-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Blocked Keywords */}
                <div className="space-y-3 bg-rose-50/40 p-4 rounded-2xl border border-rose-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900 flex items-center space-x-1.5 space-x-reverse">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>کلمات مسدود/ممنوع (پیام دارای این کلمات حذف می‌شود):</span>
                    </span>
                    <span className="text-[11px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                      {config.blockedKeywords.length} کلمه
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full min-w-0">
                    <input
                      type="text"
                      value={blockedKwInput}
                      onChange={(e) => setBlockedKwInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddBlockedKw();
                        }
                      }}
                      placeholder="کلمه ممنوع را تایپ کرده و Enter بزنید..."
                      className="flex-1 min-w-0 bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddBlockedKw}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 space-x-reverse shrink-0 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-white/70 rounded-xl border border-rose-100">
                    {config.blockedKeywords.length === 0 ? (
                      <span className="text-xs text-slate-400">هیچ کلمه ممنوعه‌ای ثبت نشده است.</span>
                    ) : (
                      config.blockedKeywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1 space-x-reverse bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-xs font-medium"
                        >
                          <span>{kw}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setConfig({
                                ...config,
                                blockedKeywords: config.blockedKeywords.filter((k) => k !== kw),
                              })
                            }
                            className="text-rose-400 hover:text-rose-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TAB 2: Content Cleaner */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div
            className="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50/70 hover:bg-slate-100/80 transition"
            onClick={() => toggleTab('tab_2')}
          >
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 font-bold">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="font-bold text-slate-800 text-sm">تب ۲: ✂️ پاکسازی محتوا (Content Cleaner)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${config.enableContentCleaning ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {config.enableContentCleaning ? 'روشن' : 'خاموش'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">حذف لینک‌های تلگرام، اینستاگرام، وبسایت‌ها، آیدی کانال‌ها (@)، هشتگ‌ها و الگوهای دلخواه</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 space-x-reverse">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfig({ ...config, enableContentCleaning: !config.enableContentCleaning });
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  config.enableContentCleaning ? 'bg-purple-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    config.enableContentCleaning ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              {openTab === 'tab_2' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>

          {openTab === 'tab_2' && (
            <div className="p-5 border-t border-slate-100 space-y-6 animate-fadeIn">
              {/* Preset Clean Toggles */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-3">قوانین سریع پاکسازی خودکار:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <label className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={!!config.removeTelegramLinks}
                      onChange={(e) => setConfig({ ...config, removeTelegramLinks: e.target.checked })}
                      className="text-purple-600 rounded focus:ring-purple-500 h-4 w-4"
                    />
                    <Link className="w-3.5 h-3.5 text-blue-500" />
                    <span>حذف لینک‌های تلگرام (t.me)</span>
                  </label>

                  <label className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={!!config.removeInstagramLinks}
                      onChange={(e) => setConfig({ ...config, removeInstagramLinks: e.target.checked })}
                      className="text-purple-600 rounded focus:ring-purple-500 h-4 w-4"
                    />
                    <Link className="w-3.5 h-3.5 text-pink-500" />
                    <span>حذف لینک‌های اینستاگرام</span>
                  </label>

                  <label className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={!!config.removeAllUrls}
                      onChange={(e) => setConfig({ ...config, removeAllUrls: e.target.checked })}
                      className="text-purple-600 rounded focus:ring-purple-500 h-4 w-4"
                    />
                    <Link className="w-3.5 h-3.5 text-slate-600" />
                    <span>حذف تمامی لینک‌ها و URLها</span>
                  </label>

                  <label className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={!!config.removeUsernames}
                      onChange={(e) => setConfig({ ...config, removeUsernames: e.target.checked })}
                      className="text-purple-600 rounded focus:ring-purple-500 h-4 w-4"
                    />
                    <AtSign className="w-3.5 h-3.5 text-indigo-500" />
                    <span>حذف نام‌های کاربری و آیدی‌ها (@)</span>
                  </label>

                  <label className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={!!config.removeHashtags}
                      onChange={(e) => setConfig({ ...config, removeHashtags: e.target.checked })}
                      className="text-purple-600 rounded focus:ring-purple-500 h-4 w-4"
                    />
                    <Hash className="w-3.5 h-3.5 text-teal-500" />
                    <span>حذف هشتگ‌ها (#)</span>
                  </label>

                  <label className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={!!config.removeEmojis}
                      onChange={(e) => setConfig({ ...config, removeEmojis: e.target.checked })}
                      className="text-purple-600 rounded focus:ring-purple-500 h-4 w-4"
                    />
                    <Smile className="w-3.5 h-3.5 text-orange-500" />
                    <span>حذف تمامی ایموجی‌ها (Emojis)</span>
                  </label>
                </div>
              </div>

              {/* Custom Removal Rules */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">کلمات، عبارات یا الگوهای سفارشی جهت حذف (Custom Removal Rules):</label>
                <div className="flex items-center gap-2 w-full min-w-0">
                  <input
                    type="text"
                    value={ruleInput}
                    onChange={(e) => setRuleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCleaningRule();
                      }
                    }}
                    placeholder="مثال: عبارت تبلیغاتی خاص یا @channelname"
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCleaningRule}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 space-x-reverse shrink-0 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن قانون</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl">
                {config.cleaningRules.length === 0 ? (
                  <span className="text-xs text-slate-400">هیچ قانون سفارشی ثبت نشده است.</span>
                ) : (
                  config.cleaningRules.map((rule, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center space-x-1.5 space-x-reverse bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-lg text-xs font-bold"
                    >
                      <span>✂️ {rule}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setConfig({
                            ...config,
                            cleaningRules: config.cleaningRules.filter((r) => r !== rule),
                          })
                        }
                        className="text-purple-400 hover:text-purple-900"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* TEST CONTENT CLEANING CENTER */}
              <div className="border border-indigo-200/80 rounded-2xl p-4 bg-gradient-to-br from-indigo-50/70 via-purple-50/30 to-white space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 space-x-reverse text-xs font-bold text-indigo-900">
                    <Scissors className="w-4 h-4 text-indigo-600" />
                    <span>🧪 تست و پاکسازی آزمایشی محتوا:</span>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                    تست زنده قوانین
                  </span>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={3}
                    value={testCleanText}
                    onChange={(e) => setTestCleanText(e.target.value)}
                    placeholder="متن نمونه برای بررسی پاکسازی..."
                    className="w-full bg-white border border-indigo-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleRunTestClean}
                      disabled={isTestingClean || !testCleanText.trim()}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 space-x-reverse disabled:opacity-50"
                    >
                      {isTestingClean ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>در حال پاکسازی...</span>
                        </>
                      ) : (
                        <>
                          <Scissors className="w-4 h-4" />
                          <span>اجرای تست پاکسازی</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* TEST RESULT DISPLAY */}
                {testCleanResult && (
                  <div className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-indigo-900 flex items-center space-x-1.5 space-x-reverse">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>نتیجه تست پاکسازی:</span>
                      </span>
                      {testCleanResult.signatureAdded && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                          ✍️ امضا نیز پیوست شد
                        </span>
                      )}
                    </div>

                    {testCleanResult.removedItems.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold text-rose-700 block mb-1">موارد شناسایی و حذف شده:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {testCleanResult.removedItems.map((item, idx) => (
                            <span key={idx} className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded text-[11px] font-mono">
                              ❌ {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <span className="block text-[11px] font-bold text-slate-500">متن اولیه (قبل از پاکسازی):</span>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 whitespace-pre-wrap font-mono min-h-[80px]">
                          {testCleanResult.originalText}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="block text-[11px] font-bold text-emerald-700">متن نهایی (پس از پاکسازی + امضا):</span>
                        <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3 text-xs text-slate-900 font-medium whitespace-pre-wrap font-mono min-h-[80px]">
                          {testCleanResult.finalWithSignature}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* TAB 3: Media Rules */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div
            className="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50/70 hover:bg-slate-100/80 transition"
            onClick={() => toggleTab('tab_3')}
          >
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold">
                <Paperclip className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="font-bold text-slate-800 text-sm">تب ۳: 📎 قوانین رسانه (Media Rules)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${config.enableMediaControl ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {config.enableMediaControl ? 'روشن' : 'خاموش'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">کنترل نوع رسانه‌های مجاز (تصاویر، ویدیوها، PDF، اسناد، صوتی) و ترتیب نمایش</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 space-x-reverse">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfig({ ...config, enableMediaControl: !config.enableMediaControl });
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  config.enableMediaControl ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    config.enableMediaControl ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              {openTab === 'tab_3' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>

          {openTab === 'tab_3' && (
            <div className="p-5 border-t border-slate-100 space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <label className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.forwardPhotos}
                    onChange={(e) => setConfig({ ...config, forwardPhotos: e.target.checked })}
                    className="text-indigo-600 rounded focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>🖼️ عکس‌ها</span>
                </label>

                <label className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.forwardVideos}
                    onChange={(e) => setConfig({ ...config, forwardVideos: e.target.checked })}
                    className="text-indigo-600 rounded focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>🎬 ویدیوها</span>
                </label>

                <label className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.forwardPdfs}
                    onChange={(e) => setConfig({ ...config, forwardPdfs: e.target.checked })}
                    className="text-indigo-600 rounded focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>📄 فایل‌های PDF</span>
                </label>

                <label className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.forwardDocuments}
                    onChange={(e) => setConfig({ ...config, forwardDocuments: e.target.checked })}
                    className="text-indigo-600 rounded focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>📁 اسناد و فایل‌ها</span>
                </label>

                <label className="flex items-center space-x-2 space-x-reverse bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.forwardAudios}
                    onChange={(e) => setConfig({ ...config, forwardAudios: e.target.checked })}
                    className="text-indigo-600 rounded focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>🎵 فایل‌های صوتی</span>
                </label>
              </div>

              <div className="pt-2">
                <span className="block text-xs font-bold text-slate-700 mb-1.5">ترتیب ارسال (Order):</span>
                <div className="flex items-center space-x-4 space-x-reverse text-xs text-slate-700 font-medium">
                  <label className="flex items-center space-x-1.5 space-x-reverse cursor-pointer">
                    <input
                      type="radio"
                      name="mediaOrder"
                      value="media_first"
                      checked={config.mediaOrder === 'media_first'}
                      onChange={() => setConfig({ ...config, mediaOrder: 'media_first' })}
                      className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>ابتدا رسانه، سپس متن (Media First)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 space-x-reverse cursor-pointer">
                    <input
                      type="radio"
                      name="mediaOrder"
                      value="text_first"
                      checked={config.mediaOrder === 'text_first'}
                      onChange={() => setConfig({ ...config, mediaOrder: 'text_first' })}
                      className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>ابتدا متن، سپس رسانه (Text First)</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TAB 4: Message Signature */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div
            className="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50/70 hover:bg-slate-100/80 transition"
            onClick={() => toggleTab('tab_4')}
          >
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 font-bold">
                <PenTool className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="font-bold text-slate-800 text-sm">تب ۴: ✍️ امضای انتهای پیام (Message Signature)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${config.enableMessageSignature ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {config.enableMessageSignature ? 'روشن' : 'خاموش'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">افزودن امضا، متن تبلیغاتی یا آیدی کانال به انتهای تمامی پیام‌های ارسالی</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 space-x-reverse">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfig({ ...config, enableMessageSignature: !config.enableMessageSignature });
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  config.enableMessageSignature ? 'bg-teal-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    config.enableMessageSignature ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              {openTab === 'tab_4' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>

          {openTab === 'tab_4' && (
            <div className="p-5 border-t border-slate-100 space-y-4 animate-fadeIn">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">متن امضای پیام (Signature Text):</label>
                <textarea
                  rows={4}
                  value={config.signatureText || ''}
                  onChange={(e) => setConfig({ ...config, signatureText: e.target.value })}
                  placeholder={`━━━━━━━━━━━━━━\n📢 کانال رسمی اطلاع‌رسانی\n@YourChannelID\n━━━━━━━━━━━━━━`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[11px] text-slate-400">
                  این متن به انتهای تمامی پیام‌ها (متنی و کپشن تصاویر/ویدیوها) پیوست خواهد شد.
                </p>
              </div>

              {/* Live Preview */}
              {config.signatureText && config.signatureText.trim() && (
                <div className="bg-teal-50/50 border border-teal-200 rounded-xl p-3.5 space-y-1.5">
                  <span className="block text-[11px] font-bold text-teal-800">پیش‌نمایش زنده امضا:</span>
                  <div className="bg-white border border-teal-100 rounded-lg p-3 text-xs text-slate-800 whitespace-pre-wrap font-mono">
                    <span className="text-slate-400 font-sans block mb-2">[متن پیام اصلی پردازش شده]</span>
                    <span className="text-teal-900 font-bold">{config.signatureText.trim()}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TAB 5: Duplicate Protection */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div
            className="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50/70 hover:bg-slate-100/80 transition"
            onClick={() => toggleTab('tab_5')}
          >
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold">
                <CopyX className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="font-bold text-slate-800 text-sm">تب ۵: ♻️ محافظت در برابر پیام‌های تکراری (Duplicate Protection)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${config.enableDuplicateProtection ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {config.enableDuplicateProtection ? 'روشن' : 'خاموش'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">جلوگیری از ارسال مجدد پیام‌های تکراری بر اساس تشابه متنی و هش فایل در پنجره زمانی مشخص</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 space-x-reverse">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfig({ ...config, enableDuplicateProtection: !config.enableDuplicateProtection });
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  config.enableDuplicateProtection ? 'bg-emerald-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    config.enableDuplicateProtection ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              {openTab === 'tab_5' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>

          {openTab === 'tab_5' && (
            <div className="p-5 border-t border-slate-100 space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">روش تشخیص تکرار (Detection Method):</label>
                  <select
                    value={config.duplicateDetectionType}
                    onChange={(e: any) => setConfig({ ...config, duplicateDetectionType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="text_similarity">تشابه متنی (Text Similarity)</option>
                    <option value="media_hash">هش رسانه (Media Hash)</option>
                    <option value="both">هر دو (Text + Media Hash)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">پنجره زمانی بررسی (Time Window):</label>
                  <select
                    value={config.timeWindowHours}
                    onChange={(e: any) => setConfig({ ...config, timeWindowHours: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={1}>۱ ساعت</option>
                    <option value={6}>۶ ساعت</option>
                    <option value={12}>۱۲ ساعت</option>
                    <option value={24}>۲۴ ساعت</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">حداکثر دفعات ارسال مجاز (Max Forwarding):</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={config.maxForwardingCount}
                    onChange={(e) => setConfig({ ...config, maxForwardingCount: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TAB 6: Contact Information Manager */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div
            className="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50/70 hover:bg-slate-100/80 transition"
            onClick={() => toggleTab('tab_6')}
          >
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="font-bold text-slate-800 text-sm">تب ۶: 📞 مدیریت اطلاعات تماس (Contact Manager)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${config.enableContactManager ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {config.enableContactManager ? 'روشن' : 'خاموش'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">حفظ اطلاعات تماس کاری و الصاق یادداشت هماهنگی ادمین</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 space-x-reverse">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfig({ ...config, enableContactManager: !config.enableContactManager });
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  config.enableContactManager ? 'bg-amber-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    config.enableContactManager ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              {openTab === 'tab_6' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>

          {openTab === 'tab_6' && (
            <div className="p-5 border-t border-slate-100 space-y-4 animate-fadeIn">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">یادداشت پیش‌فرض تماس و ارتباط:</label>
                <input
                  type="text"
                  value={config.defaultContactNote || ''}
                  onChange={(e) => setConfig({ ...config, defaultContactNote: e.target.value })}
                  placeholder="مثال: 📌 جهت هماهنگی و ارسال رزومه با ادمین در ارتباط باشید"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Settings Button Bar */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-[11px] text-slate-400">
          تنظیمات مرکز پردازش پس از ذخیره‌سازی، بر روی تمامی پیام‌های دریافتی جدید اعمال خواهند شد.
        </span>
        <button
          type="button"
          onClick={() => handleSaveConfig()}
          disabled={isSaving}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-2 space-x-reverse disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>در حال ذخیره...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>ذخیره تنظیمات پردازش و فیلتر</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
