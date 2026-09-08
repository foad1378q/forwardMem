import React, { useState, useEffect } from 'react';
import { AiProcessingConfig } from '../types';
import {
  getAiProcessingSettings,
  saveAiProcessingSettings,
  testContentCleaning,
  testAiRewrite,
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
  Sparkles,
  Wand2,
  ShieldCheck,
  Zap,
  Copy,
  FileText,
  Bot,
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

  // Tab: AI Rewrite (Self-Hosted Engine)
  ai_rewrite_enabled: false,
  aiRewriteEnabled: false,
  enableAiRewrite: false,
  ai_rewrite_style: 'formal_news',
  ai_rewrite_intensity: 'medium',
  ai_rewrite_custom_prompt: '',
  ai_rewrite_max_length: 2000,
  writingStyle: 'formal',
  customWritingStyle: '',

  // Contact Information
  enableContactManager: false,
  defaultContactNote: '📌 جهت ارتباط با مدیر کانال در ارتباط باشید',

  // Tab 3: Media Rules
  enableMediaControl: false,
  forwardPhotos: true,
  forwardVideos: true,
  forwardPdfs: true,
  forwardDocuments: true,
  forwardAudios: true,
  mediaOrder: 'media_first',

  // Tab 5: Duplicate Protection
  enableDuplicateProtection: false,
  duplicateDetectionType: 'both',
  timeWindowHours: 1,
  maxForwardingCount: 2,

  // AI Job Extractor
  enableJobExtraction: false,

  // Tab 4: Message Signature
  enableMessageSignature: false,
  signatureText: `━━━━━━━━━━━━━━\n📢 کانال رسمی اطلاع‌رسانی\n@YourChannelID\n━━━━━━━━━━━━━━`,
  addSignatureAfterEveryMessage: true,
};

export const AiProcessingCenterCard: React.FC<AiProcessingCenterCardProps> = ({
  isAdmin,
  onRequireLogin,
  onSettingsSaved,
}) => {
  const [config, setConfig] = useState<AiProcessingConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Accordion active tab state
  const [openTab, setOpenTab] = useState<string | null>('tab_1');

  // Tab 1 Inputs
  const [allowedKwInput, setAllowedKwInput] = useState<string>('');
  const [blockedKwInput, setBlockedKwInput] = useState<string>('');

  // Tab 2 Input
  const [ruleInput, setRuleInput] = useState<string>('');

  // Content Cleaner Test State
  const [testCleanText, setTestCleanText] = useState<string>(
    'سلام دوستان! 🚀 لایو امشب ساعت ۲۱:۰۰ رو از دست ندید.\n' +
    'لینک جوین کانال اصلی: https://t.me/examplechannel\n' +
    'پیج اینستاگرام ما: https://instagram.com/examplepage\n' +
    'ارتباط با مدیر: @channeladmin\n' +
    '#استخدام #فرصت_شغلی #تبلیغات\n' +
    'حذف این عبارت تبلیغاتی ویژه'
  );
  const [isTestingClean, setIsTestingClean] = useState<boolean>(false);
  const [testCleanResult, setTestCleanResult] = useState<{
    originalText: string;
    cleanedText: string;
    removedItems: string[];
    finalWithSignature: string;
    signatureAdded: boolean;
  } | null>(null);

  // Test Content Cleaner
  const handleRunTestClean = async () => {
    if (!testCleanText.trim()) return;
    setIsTestingClean(true);
    try {
      const res = await testContentCleaning(testCleanText, config);
      if (res.success) {
        setTestCleanResult({
          originalText: res.originalText,
          cleanedText: res.cleanedText,
          removedItems: res.removedItems || [],
          finalWithSignature: res.finalWithSignature || res.cleanedText,
          signatureAdded: res.signatureAdded || false,
        });
      } else {
        setMsg({ text: res.message || 'خطا در تست پاکسازی محتوا', type: 'error' });
      }
    } catch (err) {
      setMsg({ text: 'خطا در اجرای تست پاکسازی.', type: 'error' });
    } finally {
      setIsTestingClean(false);
    }
  };

  // Tab 5: AI Message Rewriter Test State
  const [rewriteTestText, setRewriteTestText] = useState<string>(
    'شاهین زریبار 2 - 1 سیروان دهگلان\n' +
    'در جریان هفته دوازدهم لیگ دسته اول، تیم شاهین زریبار توانست با نتیجه ۲ بر ۱ از سد سیروان دهگلان عبور کند. گل‌های مسابقه در دقایق ۳۴ و ۷۸ به ثمر رسید.\n' +
    'اطلاعات و گزارش کامل: https://t.me/SportsChannel\n' +
    'تماس جهت هماهنگی: 09123456789\n' +
    'ارتباط با روابط عمومی: @SportsAdmin\n' +
    '#فوتبال #لیگ_یک #شاهین_زریبار'
  );
  const [isTestingRewrite, setIsTestingRewrite] = useState<boolean>(false);
  const [rewriteTestResult, setRewriteTestResult] = useState<{
    originalText: string;
    rewrittenText: string;
    processingTimeMs: number;
    preservedEntities?: any;
    providerUsed?: string;
    stats?: {
      originalWords: number;
      rewrittenWords: number;
      changedWords: number;
      changePercentage: number;
    };
  } | null>(null);
  const [rewriteCopied, setRewriteCopied] = useState<boolean>(false);

  const handleRunTestRewrite = async () => {
    if (!rewriteTestText.trim()) return;
    setIsTestingRewrite(true);
    setRewriteCopied(false);
    try {
      const res = await testAiRewrite(rewriteTestText, {
        style: config.ai_rewrite_style || 'formal_news',
        intensity: config.ai_rewrite_intensity || 'medium',
        customPrompt: config.ai_rewrite_custom_prompt || '',
        maxLength: config.ai_rewrite_max_length || 2000,
      });
      if (res.success) {
        setRewriteTestResult(res);
      } else {
        setMsg({ text: res.message || 'خطا در اجرای تست بازنویسی هوشمند', type: 'error' });
      }
    } catch (err) {
      setMsg({ text: 'خطا در برقراری ارتباط با ماژول بازنویسی محلی.', type: 'error' });
    } finally {
      setIsTestingRewrite(false);
    }
  };

  // Load Settings on Mount
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const res = await getAiProcessingSettings();
        if (res?.success && res.aiProcessing) {
          setConfig({ ...DEFAULT_CONFIG, ...res.aiProcessing });
        }
      } catch (err) {
        console.error('Failed to load AI processing settings:', err);
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
        setMsg({ text: 'تنظیمات مرکز پردازش هوشمند پیام‌ها با موفقیت ذخیره گردید.', type: 'success' });
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

  return (
    <div
      className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-6 shadow-xl shadow-slate-200/50 space-y-6 relative overflow-hidden"
      id="ai-processing-center-card"
    >
      {/* Top Header & Master Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-1">
              <h2 className="text-lg font-black text-slate-800">مرکز پردازش هوشمند پیام‌ها (AI Processing Center)</h2>
              <span
                className={`text-xs px-3 py-0.5 rounded-full font-extrabold border ${
                  config.enableAiProcessing
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {config.enableAiProcessing ? '⚡ سیستم پردازش فعال' : '⏸️ سیستم پردازش غیرفعال'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              مدیریت پیشرفته فیلتر کلمات، پاکسازی لینک‌ها، قوانین رسانه‌ای، امضای خودکار و جلوگیری از پیام تکراری
            </p>
          </div>
        </div>

        {/* Global Master Switch */}
        <div className="flex items-center space-x-3 space-x-reverse bg-slate-50 p-2.5 px-4 rounded-2xl border border-slate-200 self-start sm:self-auto shrink-0 shadow-2xs">
          <span className="text-xs font-black text-slate-700">سوئیچ اصلی (Master Switch):</span>
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
            title="فعال/غیرفعال‌سازی کلی خط پردازش هوشمند"
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
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-4 text-white shadow-md overflow-x-auto">
        <div className="text-[11px] font-bold text-indigo-300 mb-2 flex items-center space-x-2 space-x-reverse">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>ترتیب و خط لوله پردازش پیام‌ها (Processing Pipeline):</span>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse text-[11px] font-medium whitespace-nowrap min-w-max">
          <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-slate-300 border border-slate-700">دریافت پیام</span>
          <span className="text-slate-500">←</span>
          <span className={`px-2.5 py-1 rounded-lg border ${config.enableDuplicateProtection ? 'bg-indigo-900/80 text-indigo-200 border-indigo-700 font-bold' : 'bg-slate-800 text-slate-400 border-slate-800'}`}>
            ۱. بررسی تکراری
          </span>
          <span className="text-slate-500">←</span>
          <span className={`px-2.5 py-1 rounded-lg border ${config.enableKeywordFilter ? 'bg-indigo-900/80 text-indigo-200 border-indigo-700 font-bold' : 'bg-slate-800 text-slate-400 border-slate-800'}`}>
            ۲. فیلتر کلمات
          </span>
          <span className="text-slate-500">←</span>
          <span className={`px-2.5 py-1 rounded-lg border ${config.enableContentCleaning ? 'bg-indigo-900/80 text-indigo-200 border-indigo-700 font-bold' : 'bg-slate-800 text-slate-400 border-slate-800'}`}>
            ۳. پاکسازی محتوا
          </span>
          <span className="text-slate-500">←</span>
          <span className={`px-2.5 py-1 rounded-lg border ${config.enableMediaControl ? 'bg-indigo-900/80 text-indigo-200 border-indigo-700 font-bold' : 'bg-slate-800 text-slate-400 border-slate-800'}`}>
            ۴. قوانین رسانه
          </span>
          <span className="text-slate-500">←</span>
          <span className={`px-2.5 py-1 rounded-lg border ${config.enableMessageSignature ? 'bg-indigo-900/80 text-indigo-200 border-indigo-700 font-bold' : 'bg-slate-800 text-slate-400 border-slate-800'}`}>
            ۵. امضای پیام
          </span>
          <span className="text-slate-500">←</span>
          <span className={`px-2.5 py-1 rounded-lg border ${(config.ai_rewrite_enabled || config.enableAiRewrite) ? 'bg-purple-900/90 text-purple-200 border-purple-600 font-bold' : 'bg-slate-800 text-slate-400 border-slate-800'}`}>
            ✨ ۶. بازنویسی هوشمند
          </span>
          <span className="text-slate-500">←</span>
          <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 rounded-lg font-bold border border-emerald-800">ارسال به مقصد</span>
        </div>
      </div>

      {/* Accordion Tabs for Processing Modules */}
      <div className="space-y-3">
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
                  <span className="font-bold text-slate-800 text-sm">تب ۱: 🔎 فیلتر هوشمند کلمات (Keyword Filter)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${config.enableKeywordFilter ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {config.enableKeywordFilter ? 'روشن' : 'خاموش'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">کلمات مجاز برای فروارد و کلمات مسدود شده (ارسال ممنوع)</p>
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
            <div className="p-5 border-t border-slate-100 space-y-6 animate-fadeIn">
              {/* Match Mode */}
              <div className="flex items-center justify-between bg-blue-50/50 border border-blue-200/80 rounded-xl p-3.5">
                <div>
                  <span className="text-xs font-bold text-blue-900 block">نحوه بررسی کلمات کلیدی (Match Mode)</span>
                  <span className="text-[11px] text-blue-700">شرط پذیرش پیام برای ارسال به کانال مقصد</span>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, keywordMatchMode: 'any' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      config.keywordMatchMode === 'any'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    حداقل یک کلمه (OR)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, keywordMatchMode: 'all' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      config.keywordMatchMode === 'all'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    تمامی کلمات مجاز (AND)
                  </button>
                </div>
              </div>

              {/* 2-Columns: Allowed & Blocked */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Allowed Keywords */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center space-x-1.5 space-x-reverse">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>کلمات کلیدی مجاز (Allowed Keywords):</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      تعداد: {config.allowedKeywords.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
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
                      placeholder="کلمه را بنویسید یا با کاما جدا کنید..."
                      className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddAllowedKw}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 space-x-reverse shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {config.allowedKeywords.length === 0 ? (
                      <span className="text-[11px] text-slate-400 p-1">هیچ کلمه مجازی ثبت نشده (همه پیام‌ها مجازند).</span>
                    ) : (
                      config.allowedKeywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1 space-x-reverse bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-semibold"
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
                            className="text-emerald-400 hover:text-emerald-900"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Blocked Keywords */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800 flex items-center space-x-1.5 space-x-reverse">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>کلمات مسدود و ممنوعه (Blocked Keywords):</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      تعداد: {config.blockedKeywords.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
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
                      placeholder="کلمه ممنوعه را بنویسید..."
                      className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddBlockedKw}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 space-x-reverse shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {config.blockedKeywords.length === 0 ? (
                      <span className="text-[11px] text-slate-400 p-1">هیچ کلمه مسدودی ثبت نشده است.</span>
                    ) : (
                      config.blockedKeywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1 space-x-reverse bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-lg text-xs font-semibold"
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
                            className="text-rose-400 hover:text-rose-900"
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
                  <span className="font-bold text-slate-800 text-sm">تب ۲: 🧹 پاکسازی محتوا (Content Cleaner)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${config.enableContentCleaning ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {config.enableContentCleaning ? 'روشن' : 'خاموش'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">حذف خودکار لینک‌ها، آیدی‌های تلگرامی، هشتگ‌ها و عبارات تبلیغاتی از متن</p>
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
              {/* Quick Preset Toggles */}
              <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-4 space-y-3">
                <span className="block text-xs font-bold text-purple-900 flex items-center space-x-1.5 space-x-reverse">
                  <CheckSquare className="w-4 h-4 text-purple-600" />
                  <span>گزینه‌های پاکسازی خودکار (Automatic Cleaning Rules):</span>
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <label className="flex items-center space-x-2 space-x-reverse bg-white p-2.5 rounded-xl border border-purple-100 shadow-2xs cursor-pointer text-xs font-bold text-slate-700 hover:bg-purple-50/30 transition">
                    <input
                      type="checkbox"
                      checked={config.removeTelegramLinks !== false}
                      onChange={(e) => setConfig({ ...config, removeTelegramLinks: e.target.checked })}
                      className="text-purple-600 rounded focus:ring-purple-500 h-4 w-4"
                    />
                    <Link className="w-3.5 h-3.5 text-blue-500" />
                    <span>حذف لینک‌های تلگرام (t.me / telegram.me)</span>
                  </label>

                  <label className="flex items-center space-x-2 space-x-reverse bg-white p-2.5 rounded-xl border border-purple-100 shadow-2xs cursor-pointer text-xs font-bold text-slate-700 hover:bg-purple-50/30 transition">
                    <input
                      type="checkbox"
                      checked={config.removeInstagramLinks !== false}
                      onChange={(e) => setConfig({ ...config, removeInstagramLinks: e.target.checked })}
                      className="text-purple-600 rounded focus:ring-purple-500 h-4 w-4"
                    />
                    <Link className="w-3.5 h-3.5 text-pink-500" />
                    <span>حذف لینک‌های اینستاگرام (instagram.com)</span>
                  </label>

                  <label className="flex items-center space-x-2 space-x-reverse bg-white p-2.5 rounded-xl border border-purple-100 shadow-2xs cursor-pointer text-xs font-bold text-slate-700 hover:bg-purple-50/30 transition">
                    <input
                      type="checkbox"
                      checked={!!config.removeAllUrls}
                      onChange={(e) => setConfig({ ...config, removeAllUrls: e.target.checked })}
                      className="text-purple-600 rounded focus:ring-purple-500 h-4 w-4"
                    />
                    <Link className="w-3.5 h-3.5 text-indigo-500" />
                    <span>حذف تمامی آدرس‌های اینترنتی (URLs)</span>
                  </label>

                  <label className="flex items-center space-x-2 space-x-reverse bg-white p-2.5 rounded-xl border border-purple-100 shadow-2xs cursor-pointer text-xs font-bold text-slate-700 hover:bg-purple-50/30 transition">
                    <input
                      type="checkbox"
                      checked={config.removeUsernames !== false}
                      onChange={(e) => setConfig({ ...config, removeUsernames: e.target.checked })}
                      className="text-purple-600 rounded focus:ring-purple-500 h-4 w-4"
                    />
                    <AtSign className="w-3.5 h-3.5 text-emerald-500" />
                    <span>حذف آیدی‌های تلگرام (@username)</span>
                  </label>

                  <label className="flex items-center space-x-2 space-x-reverse bg-white p-2.5 rounded-xl border border-purple-100 shadow-2xs cursor-pointer text-xs font-bold text-slate-700 hover:bg-purple-50/30 transition">
                    <input
                      type="checkbox"
                      checked={config.removeHashtags !== false}
                      onChange={(e) => setConfig({ ...config, removeHashtags: e.target.checked })}
                      className="text-purple-600 rounded focus:ring-purple-500 h-4 w-4"
                    />
                    <Hash className="w-3.5 h-3.5 text-amber-500" />
                    <span>حذف تمامی هشتگ‌ها (#hashtag)</span>
                  </label>

                  <label className="flex items-center space-x-2 space-x-reverse bg-white p-2.5 rounded-xl border border-purple-100 shadow-2xs cursor-pointer text-xs font-bold text-slate-700 hover:bg-purple-50/30 transition">
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
                    <span>🧪 مرکز تست و پاکسازی آزمایشی محتوا (Message Cleaning Test Center):</span>
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
                          <span>در حال پاکسازی آزمایشی...</span>
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

        {/* TAB 5: AI Message Rewriter */}
        <div className="border border-purple-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div
            className="p-4 flex items-center justify-between cursor-pointer select-none bg-purple-50/40 hover:bg-purple-50/70 transition"
            onClick={() => toggleTab('tab_5')}
          >
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 font-bold shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="font-bold text-slate-800 text-sm">تب ۵: ✨ بازنویسی هوشمند (AI Message Rewriter)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${(config.ai_rewrite_enabled || config.enableAiRewrite) ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {(config.ai_rewrite_enabled || config.enableAiRewrite) ? 'روشن' : 'خاموش'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">بازنویسی هوشمند محتوا با موتور محلی خودمیزبان بدون نیاز به API خارجی و با حفظ ۱۰۰٪ موجودیت‌های واقعی</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 space-x-reverse">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextVal = !(config.ai_rewrite_enabled || config.enableAiRewrite);
                  setConfig({
                    ...config,
                    ai_rewrite_enabled: nextVal,
                    aiRewriteEnabled: nextVal,
                    enableAiRewrite: nextVal,
                  });
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  (config.ai_rewrite_enabled || config.enableAiRewrite) ? 'bg-purple-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    (config.ai_rewrite_enabled || config.enableAiRewrite) ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              {openTab === 'tab_5' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>

          {openTab === 'tab_5' && (
            <div className="p-5 border-t border-purple-100 space-y-5 animate-fadeIn">
              {/* Architecture & Zero-Cost Banner */}
              <div className="bg-gradient-to-r from-purple-50 via-indigo-50/40 to-slate-50 border border-purple-200/90 rounded-xl p-3.5 text-xs flex items-start space-x-3 space-x-reverse">
                <ShieldCheck className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-purple-950 block">معماری امن و خودمیزبان (Self-Hosted Architecture):</span>
                  <p className="text-purple-900/90 text-[11px] leading-relaxed">
                    این ماژول کاملاً بر روی سرور شما در Railway اجرا شده و به هیچ سرویس ابری یا شخص ثالث وابسته نیست.
                    تمام اطلاعات حیاتی شامل <b>اعداد، نتایج مسابقات (مثلاً ۲ - ۱)، نام تیم‌ها و اشخاص، لینک‌ها، آیدی‌های @، شماره‌های تلفن و هشتگ‌ها</b> با الگوریتم استخراج توکن ۱۰۰٪ محفوظ می‌مانند. در صورت هرگونه تأخیر سرور، پیام اصلی به‌صورت خودکار (Fail-safe) فوروارد می‌شود.
                  </p>
                </div>
              </div>

              {/* Style Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">سبک و لحن نگارش (Rewrite Style):</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'formal_news', title: 'رسمی و خبری', desc: 'مناسب خبرگزاری‌ها و رسانه‌های رسمی' },
                    { id: 'news_engaging', title: 'خبری و جذاب', desc: 'تیترهای خواندنی و پرمخاطب' },
                    { id: 'concise', title: 'کوتاه و خلاصه', desc: 'انتقال سریع پیام بدون حاشیه' },
                    { id: 'friendly', title: 'دوستانه', desc: 'لحن صمیمی و محاوره‌ای روان' },
                    { id: 'promotional', title: 'تبلیغاتی', desc: 'ترغیب مخاطب به اقدام و خرید' },
                    { id: 'sports', title: 'ورزشی', desc: 'هیجان‌انگیز با حفظ دقیق نتایج' },
                    { id: 'professional', title: 'حرفه‌ای', desc: 'زبان کسب‌وکار و تجاری متین' },
                    { id: 'custom', title: 'سفارشی', desc: 'پیروی از پرامپت اختصاصی مدیر' },
                  ].map((styleItem) => {
                    const isSelected = (config.ai_rewrite_style || 'formal_news') === styleItem.id;
                    return (
                      <button
                        key={styleItem.id}
                        type="button"
                        onClick={() => setConfig({ ...config, ai_rewrite_style: styleItem.id as any })}
                        className={`p-2.5 rounded-xl border text-right transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-xs font-bold">{styleItem.title}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className={`text-[10px] leading-tight ${isSelected ? 'text-purple-100' : 'text-slate-500'}`}>
                          {styleItem.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Intensity & Max Length */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Intensity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">شدت بازنویسی (Rewrite Intensity):</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'low', title: 'کم (Low)', desc: 'تغییرات سبک و روان‌سازی' },
                      { id: 'medium', title: 'متوسط (Medium)', desc: 'بازنویسی متعادل جملات' },
                      { id: 'high', title: 'زیاد (High)', desc: 'بازآفرینی کامل ساختار متن' },
                    ].map((intItem) => {
                      const isSelected = (config.ai_rewrite_intensity || 'medium') === intItem.id;
                      return (
                        <button
                          key={intItem.id}
                          type="button"
                          onClick={() => setConfig({ ...config, ai_rewrite_intensity: intItem.id as any })}
                          className={`p-2 rounded-xl border text-center transition ${
                            isSelected
                              ? 'bg-purple-700 text-white border-purple-700 font-bold shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span className="block text-xs">{intItem.title}</span>
                          <span className={`block text-[10px] mt-0.5 ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                            {intItem.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Max Length */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">حداکثر طول متن خروجی (Max Length - کاراکتر):</label>
                  <input
                    type="number"
                    min={200}
                    max={4000}
                    step={100}
                    value={config.ai_rewrite_max_length || 2000}
                    onChange={(e) => setConfig({ ...config, ai_rewrite_max_length: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="2000"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">حداکثر سقف استاندارد طول پیام برای تلگرام (معمولاً بین ۱۰۰۰ تا ۳۰۰۰ کاراکتر)</p>
                </div>
              </div>

              {/* Custom Instruction */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">دستورات سفارشی مدیر (Custom Instruction):</label>
                <textarea
                  rows={2}
                  value={config.ai_rewrite_custom_prompt || ''}
                  onChange={(e) => setConfig({ ...config, ai_rewrite_custom_prompt: e.target.value })}
                  placeholder="مثال: به نام تیم‌ها و اسامی تأکید شود، ایموجی‌های مناسب ورزشی اضافه گردد و لحن خبر هیجانی و پرانرژی باشد..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Live Preview & Testing Box */}
              <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 space-x-reverse text-xs font-bold text-purple-900">
                    <Wand2 className="w-4 h-4 text-purple-600" />
                    <span>پیش‌نمایش و تست زنده بازنویسی هوشمند:</span>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse text-[11px]">
                    <button
                      type="button"
                      onClick={() => setRewriteTestText(
                        'شاهین زریبار 2 - 1 سیروان دهگلان\n' +
                        'در هفته دوازدهم لیگ دسته اول، تیم فوتبال شاهین زریبار موفق شد با نتیجه ۲ بر ۱ حریف خود سیروان دهگلان را شکست دهد.\n' +
                        'تماس: 09123456789 | کانال ما: https://t.me/SportsChannel | ادمین: @AdminSports\n' +
                        '#فوتبال #شاهین_زریبار'
                      )}
                      className="text-purple-700 hover:text-purple-900 underline cursor-pointer"
                    >
                      نمونه ورزشی
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setRewriteTestText(
                        'شرکت فناوری آریا نیروی ارشد دواپس و فول‌استک با حقوق عالی استخدام می‌کند.\n' +
                        'علاقه‌مندان می‌توانند رزومه خود را به آیدی @TechJobRecruiter ارسال فرمایند یا با شماره 09129876543 تماس حاصل نمایند.\n' +
                        'سایت: https://tech-arya.ir/careers #استخدام #فرصت_شغلی'
                      )}
                      className="text-purple-700 hover:text-purple-900 underline cursor-pointer"
                    >
                      نمونه استخدامی
                    </button>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={rewriteTestText}
                  onChange={(e) => setRewriteTestText(e.target.value)}
                  placeholder="متن دلخواه خود را برای آزمایش بازنویسی اینجا بنویسید..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />

                <div className="flex items-center space-x-2 space-x-reverse">
                  <button
                    type="button"
                    onClick={handleRunTestRewrite}
                    disabled={isTestingRewrite || !rewriteTestText.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse disabled:opacity-50 shadow-sm"
                  >
                    {isTestingRewrite ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>در حال بازنویسی...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>✨ تست بازنویسی</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleRunTestRewrite}
                    disabled={isTestingRewrite || !rewriteTestText.trim()}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>↻ بازنویسی مجدد</span>
                  </button>
                </div>

                {/* Output Display */}
                {rewriteTestResult && (
                  <div className="mt-3 bg-white border border-purple-200 rounded-xl p-3.5 space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <span className="text-xs font-bold text-emerald-700 flex items-center space-x-1 space-x-reverse">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>نتیجه بازنویسی شده:</span>
                        </span>
                        <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-mono">
                          {rewriteTestResult.processingTimeMs} ms
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          موتور خودمیزبان
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(rewriteTestResult.rewrittenText);
                          setRewriteCopied(true);
                          setTimeout(() => setRewriteCopied(false), 2000);
                        }}
                        className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center space-x-1 space-x-reverse px-2 py-1 rounded bg-slate-50 border border-slate-200"
                      >
                        {rewriteCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600">کپی شد</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>کپی متن</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {rewriteTestResult.rewrittenText}
                    </div>

                    {/* Preserved Entities Badges */}
                    <div className="bg-purple-50/50 rounded-lg p-2.5 text-[11px] flex flex-wrap items-center gap-2 border border-purple-100">
                      <span className="font-bold text-purple-900 flex items-center space-x-1 space-x-reverse">
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                        <span>موجودیت‌های محافظت شده (بدون تغییر):</span>
                      </span>
                      <span className="bg-white border border-purple-200 px-2 py-0.5 rounded text-purple-800">
                        🔗 لینک‌ها: {rewriteTestResult.preservedEntities?.links?.length || 0} عدد
                      </span>
                      <span className="bg-white border border-purple-200 px-2 py-0.5 rounded text-purple-800">
                        👤 آیدی‌ها (@): {rewriteTestResult.preservedEntities?.usernames?.length || 0} عدد
                      </span>
                      <span className="bg-white border border-purple-200 px-2 py-0.5 rounded text-purple-800">
                        📞 شماره‌ها: {rewriteTestResult.preservedEntities?.phones?.length || 0} عدد
                      </span>
                      <span className="bg-white border border-purple-200 px-2 py-0.5 rounded text-purple-800">
                        #️⃣ هشتگ‌ها: {rewriteTestResult.preservedEntities?.hashtags?.length || 0} عدد
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* TAB 6: Duplicate Protection */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div
            className="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50/70 hover:bg-slate-100/80 transition"
            onClick={() => toggleTab('tab_6')}
          >
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold">
                <CopyX className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="font-bold text-slate-800 text-sm">تب ۶: ♻️ محافظت در برابر پیام‌های تکراری (Duplicate Protection)</span>
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
              {openTab === 'tab_6' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>

          {openTab === 'tab_6' && (
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
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition flex items-center space-x-2 space-x-reverse disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>در حال ذخیره...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>ذخیره تنظیمات مرکز پردازش</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
