import React, { useState, useEffect, useRef } from 'react';
import {
  Megaphone,
  Clock,
  Send,
  Pin,
  Image as ImageIcon,
  Link as LinkIcon,
  Save,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
  Play,
  RotateCcw,
  Upload,
  Trash2,
  Plus,
  ExternalLink,
  Bot,
  Globe,
  Radio,
  FileText,
  Video,
  X,
  Check,
} from 'lucide-react';
import { AdBannerSettings, InlineButtonConfig } from '../types';
import { getAdBannerSettings, saveAdBannerSettings, sendAdBannerNow } from '../lib/telegramApi';

interface AdBannerCardProps {
  destinationChannel?: string;
  onRefresh?: () => void;
}

const QUICK_BUTTON_TEMPLATES = [
  { label: 'ورود به ربات', text: '🤖 ورود به ربات اسپانسر', url: 'https://t.me/BotFather?start=ad' },
  { label: 'کانال اسپانسر', text: '📢 عضویت در کانال حامی', url: 'https://t.me/telegram' },
  { label: 'وبسایت رسمی', text: '🌐 مشاهده وبسایت', url: 'https://google.com' },
  { label: 'رزرو تبلیغات', text: '💬 ارتباط با ادمین تبلیغات', url: 'https://t.me/' },
  { label: 'کد تخفیف', text: '🎁 دریافت تخفیف اختصاصی', url: 'https://t.me/' },
];

export const AdBannerCard: React.FC<AdBannerCardProps> = ({
  destinationChannel,
  onRefresh,
}) => {
  const [adSettings, setAdSettings] = useState<AdBannerSettings>({
    enableAdBanner: false,
    triggerMode: 'interval',
    postInterval: 10,
    hourInterval: 6,
    adText:
      '📢 <b>حامی مالی کانال</b>\n\nجهت رزرو تبلیغات و درج بنر در کانال با پشتیبانی در ارتباط باشید.\n🌐 <i>بازدید بالا و بازدهی عالی</i>',
    adMediaUrl: '',
    adMediaBase64: '',
    adMediaFileName: '',
    adMediaType: 'photo',
    enableButtons: true,
    buttons: [
      { id: 'btn_1', text: '🤖 ورود به ربات', url: 'https://t.me/BotFather', row: 1 },
      { id: 'btn_2', text: '📢 کانال اسپانسر', url: 'https://t.me/telegram', row: 1 },
      { id: 'btn_3', text: '💬 ارتباط با بخش تبلیغات', url: 'https://t.me/admin', row: 2 },
    ],
    adButtonText: '',
    adButtonUrl: '',
    pinAdMessage: false,
    postsSinceLastAd: 0,
    totalAdsSent: 0,
    lastAdSentAt: undefined,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingNow, setIsSendingNow] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sendSuccessMsg, setSendSuccessMsg] = useState<string | null>(null);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getAdBannerSettings();
      if (res.success && res.adBanner) {
        const loaded = res.adBanner;
        // Ensure buttons array exists
        if (!loaded.buttons || loaded.buttons.length === 0) {
          if (loaded.adButtonText && loaded.adButtonUrl) {
            loaded.buttons = [{ id: 'btn_1', text: loaded.adButtonText, url: loaded.adButtonUrl, row: 1 }];
          } else {
            loaded.buttons = [
              { id: 'btn_1', text: '🤖 ورود به ربات', url: 'https://t.me/BotFather', row: 1 },
              { id: 'btn_2', text: '📢 کانال اسپانسر', url: 'https://t.me/telegram', row: 1 },
            ];
          }
        }
        if (loaded.enableButtons === undefined) {
          loaded.enableButtons = true;
        }
        setAdSettings(loaded);
      }
    } catch (err: any) {
      console.error('Error loading ad banner settings:', err);
      setErrorMsg('خطا در دریافت اطلاعات بنر تبلیغاتی');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    setErrorMsg(null);
    try {
      const res = await saveAdBannerSettings(adSettings);
      if (res.success) {
        setSaveSuccess('تنظیمات پست و بنر تبلیغاتی اسپانسر با موفقیت ذخیره گردید.');
        setTimeout(() => setSaveSuccess(null), 4000);
        if (onRefresh) onRefresh();
      } else {
        setErrorMsg(res.message || 'خطا در ذخیره تنظیمات تبلیغات');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ارتباط با سرور');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendNow = async () => {
    if (!destinationChannel) {
      setErrorMsg('کانال مقصد تنظیم نشده است. ابتدا در بخش تنظیمات ربات، آیدی کانال مقصد را ثبت کنید.');
      return;
    }
    const confirmed = window.confirm('آیا از ارسال فوری بنر تبلیغاتی اسپانسر هم‌اکنون به کانال مقصد اطمینان دارید؟');
    if (!confirmed) return;

    setIsSendingNow(true);
    setSendSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await sendAdBannerNow();
      if (res.success) {
        setSendSuccessMsg('بنر و پست تبلیغاتی با موفقیت به همراه لینک‌های شیشه‌ای به کانال ارسال شد!');
        setTimeout(() => setSendSuccessMsg(null), 5000);
        loadSettings();
        if (onRefresh) onRefresh();
      } else {
        setErrorMsg(res.message || 'خطا در ارسال بنر تبلیغاتی');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در برقراری ارتباط با سرور');
    } finally {
      setIsSendingNow(false);
    }
  };

  // Process banner file upload (drag & drop or file picker)
  const handleFileProcess = (file: File) => {
    setMediaUploadError(null);
    if (!file) return;

    // Check file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      setMediaUploadError('حجم فایل انتخاب شده نباید بیش از ۲۵ مگابایت باشد.');
      return;
    }

    const isVid = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|avi|mkv)$/i);
    const isImg = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i);

    if (!isVid && !isImg) {
      setMediaUploadError('فرمت فایل پشتیبانی نمی‌شود. لطفاً یک تصویر (JPG, PNG, WEBP, GIF) یا ویدیو (MP4) بارگذاری کنید.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAdSettings((prev) => ({
        ...prev,
        adMediaBase64: base64,
        adMediaFileName: file.name,
        adMediaType: isVid ? 'video' : 'photo',
        adMediaUrl: '', // prefer uploaded local media
      }));
    };
    reader.onerror = () => {
      setMediaUploadError('خطا در خواندن فایل از دستگاه.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleClearUploadedMedia = () => {
    setAdSettings((prev) => ({
      ...prev,
      adMediaBase64: '',
      adMediaFileName: '',
      adMediaUrl: '',
      adMediaType: 'none',
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Button management methods
  const handleAddButton = () => {
    const newBtn: InlineButtonConfig = {
      id: `btn_${Date.now()}`,
      text: 'دکمه جدید',
      url: 'https://',
      row: 1,
    };
    setAdSettings((prev) => ({
      ...prev,
      buttons: [...(prev.buttons || []), newBtn],
    }));
  };

  const handleUpdateBtn = (id: string, updates: Partial<InlineButtonConfig>) => {
    setAdSettings((prev) => ({
      ...prev,
      buttons: (prev.buttons || []).map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
  };

  const handleDeleteBtn = (id: string) => {
    setAdSettings((prev) => ({
      ...prev,
      buttons: (prev.buttons || []).filter((b) => b.id !== id),
    }));
  };

  const handleApplyTemplate = (tmpl: { text: string; url: string }) => {
    const newBtn: InlineButtonConfig = {
      id: `btn_${Date.now()}`,
      text: tmpl.text,
      url: tmpl.url,
      row: 1,
    };
    setAdSettings((prev) => ({
      ...prev,
      buttons: [...(prev.buttons || []), newBtn],
    }));
  };

  // Group buttons into rows for the telegram preview
  const getPreviewRows = () => {
    const btns = (adSettings.buttons || []).filter((b) => b.text.trim() && b.url.trim());
    if (btns.length === 0) return [];

    const rowMap: Record<number, InlineButtonConfig[]> = {};
    const unassigned: InlineButtonConfig[] = [];

    btns.forEach((btn) => {
      const r = btn.row || 0;
      if (r > 0) {
        if (!rowMap[r]) rowMap[r] = [];
        rowMap[r].push(btn);
      } else {
        unassigned.push(btn);
      }
    });

    const result: InlineButtonConfig[][] = [];
    const sortedRowNums = Object.keys(rowMap).map(Number).sort((a, b) => a - b);
    for (const rNum of sortedRowNums) {
      result.push(rowMap[rNum]);
    }

    let tempRow: InlineButtonConfig[] = [];
    unassigned.forEach((b) => {
      tempRow.push(b);
      if (tempRow.length >= 2) {
        result.push(tempRow);
        tempRow = [];
      }
    });
    if (tempRow.length > 0) {
      result.push(tempRow);
    }

    return result;
  };

  const previewRows = getPreviewRows();
  const hasMedia = Boolean(adSettings.adMediaBase64 || adSettings.adMediaUrl);

  return (
    <div id="ad-banner-card" className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
              <span>تبلیغات اسپانسر و بنر با دکمه‌های شیشه‌ای</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-3xs font-black">
                اسپانسر هوشمند
              </span>
            </h2>
            <p className="text-2xs text-slate-400 mt-0.5">
              بارگذاری بنر تبلیغاتی، متن فرمت‌دار و دکمه‌های شیشه‌ای تعاملی مختص پست‌های اسپانسر
            </p>
          </div>
        </div>

        {/* Master Active Toggle & Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">فعال‌سازی تبلیغ خودکار:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={adSettings.enableAdBanner}
                onChange={(e) => setAdSettings({ ...adSettings, enableAdBanner: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <button
            onClick={handleSendNow}
            disabled={isSendingNow || !destinationChannel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            title="ارسال فوری بنر هم‌اکنون به کانال مقصد"
          >
            {isSendingNow ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            <span>ارسال فوری هم‌اکنون</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>ذخیره تنظیمات</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {sendSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{sendSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Stats Mini Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-3xs font-bold text-slate-400 block">کل بنرهای ارسالی</span>
            <span className="text-lg font-black text-amber-600 font-mono">
              {(adSettings.totalAdsSent || 0).toLocaleString('fa-IR')}
            </span>
          </div>
          <Megaphone className="w-5 h-5 text-amber-500/50" />
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-3xs font-bold text-slate-400 block">پست‌ها از آخرین تبلیغ</span>
            <span className="text-lg font-black text-indigo-600 font-mono">
              {(adSettings.postsSinceLastAd || 0).toLocaleString('fa-IR')}
            </span>
          </div>
          <Layers className="w-5 h-5 text-indigo-500/50" />
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-3xs font-bold text-slate-400 block">بازه فوروارد</span>
            <span className="text-xs font-bold text-slate-700 font-mono mt-1 block">
              هر {adSettings.postInterval || 10} پست
            </span>
          </div>
          <BarChart3 className="w-5 h-5 text-slate-400/50" />
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-3xs font-bold text-slate-400 block">آخرین زمان ارسال</span>
            <span className="text-3xs font-bold text-slate-700 font-mono mt-1 block truncate max-w-[120px]">
              {adSettings.lastAdSentAt ? new Date(adSettings.lastAdSentAt).toLocaleTimeString('fa-IR') : 'هنوز ارسال نشده'}
            </span>
          </div>
          <Clock className="w-5 h-5 text-slate-400/50" />
        </div>
      </div>

      {/* Main Grid: Settings & Configuration (Left) + Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: 7 Columns - Media Upload, Timing, HTML Text, and Glass Buttons */}
        <div className="lg:col-span-7 space-y-5">

          {/* 1. Banner Media Upload Section */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-black text-slate-800">
                  بارگذاری بنر تبلیغاتی اسپانسر (عکس یا ویدیو)
                </span>
              </div>
              <span className="text-3xs font-medium text-slate-400">
                حداکثر ۲۵ مگابایت (JPG, PNG, GIF, MP4)
              </span>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                isDragging
                  ? 'border-amber-500 bg-amber-50/50'
                  : 'border-slate-200 hover:border-amber-400 hover:bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/quicktime"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  برای آپلود بنر کلیک کنید یا فایل را اینجا بکشید و رها نمایید
                </p>
                <p className="text-3xs text-slate-400 mt-0.5">
                  پشتیبانی از عکس باکیفیت و ویدیوی تیزر کوتاه
                </p>
              </div>
            </div>

            {mediaUploadError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-3xs font-bold flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{mediaUploadError}</span>
              </div>
            )}

            {/* Active Media Preview / Information */}
            {adSettings.adMediaBase64 ? (
              <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-amber-300 bg-white shrink-0 flex items-center justify-center">
                    {adSettings.adMediaType === 'video' ? (
                      <Video className="w-6 h-6 text-amber-600" />
                    ) : (
                      <img
                        src={adSettings.adMediaBase64}
                        alt="Uploaded Banner"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-2xs font-bold text-slate-800 block truncate">
                      {adSettings.adMediaFileName || 'فایل بنر آپلود شده'}
                    </span>
                    <span className="text-3xs text-amber-700 font-semibold block">
                      آماده ارسال از حافظه داخلی ربات به کانال مقصد
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearUploadedMedia}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-3xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف بنر</span>
                </button>
              </div>
            ) : (
              /* Fallback: Direct Web URL */
              <div className="pt-2 border-t border-slate-100">
                <label className="text-3xs font-bold text-slate-600 block mb-1">
                  یا لینک مستقیم اینترنتی عکس / ویدیو:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={adSettings.adMediaUrl || ''}
                    onChange={(e) => setAdSettings({ ...adSettings, adMediaUrl: e.target.value })}
                    placeholder="https://example.com/banner.jpg"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-400 font-mono text-left dir-ltr"
                  />
                  {adSettings.adMediaUrl && (
                    <button
                      type="button"
                      onClick={() => setAdSettings({ ...adSettings, adMediaUrl: '' })}
                      className="px-2.5 py-2 rounded-xl text-3xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                    >
                      پاک کردن
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Ad Text / Caption (HTML Format) */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-800">
                متن و کپشن پست تبلیغاتی (HTML)
              </span>
              <span className="text-3xs text-slate-400">
                پشتیبانی از &lt;b&gt;, &lt;i&gt;, &lt;a&gt;, &lt;code&gt;
              </span>
            </div>

            <textarea
              rows={4}
              value={adSettings.adText || ''}
              onChange={(e) => setAdSettings({ ...adSettings, adText: e.target.value })}
              placeholder="متن تبلیغات را اینجا وارد کنید..."
              className="w-full p-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-400 leading-relaxed font-sans"
            />

            {/* Quick HTML tags insertion helper */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-3xs font-bold text-slate-500">ابزارهای فرمت:</span>
              <button
                type="button"
                onClick={() => setAdSettings({ ...adSettings, adText: (adSettings.adText || '') + '<b>متن بولد</b>' })}
                className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-3xs font-bold font-mono"
              >
                &lt;b&gt;بولد&lt;/b&gt;
              </button>
              <button
                type="button"
                onClick={() => setAdSettings({ ...adSettings, adText: (adSettings.adText || '') + '<i>متن ایتالیک</i>' })}
                className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-3xs font-bold font-mono"
              >
                &lt;i&gt;ایتالیک&lt;/i&gt;
              </button>
              <button
                type="button"
                onClick={() => setAdSettings({ ...adSettings, adText: (adSettings.adText || '') + '<a href="https://t.me/">لینک متنی</a>' })}
                className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-3xs font-bold font-mono"
              >
                &lt;a&gt;هایپرلینک&lt;/a&gt;
              </button>
            </div>
          </div>

          {/* 3. Interactive Glass Inline Buttons Section */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>دکمه‌های شیشه‌ای تعاملی زیر پست تبلیغاتی</span>
                </h3>
                <p className="text-3xs text-slate-400 mt-0.5">
                  این دکمه‌ها منحصراً در زیر پست تبلیغاتی اسپانسر نمایش داده می‌شوند و روی پست‌های عادی قرار نمی‌گیرند.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={adSettings.enableButtons !== false}
                  onChange={(e) => setAdSettings({ ...adSettings, enableButtons: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Quick Templates */}
            <div className="space-y-1.5">
              <span className="text-3xs font-bold text-slate-500 block">افزودن سریع دکمه با یک کلیک:</span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_BUTTON_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 text-3xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-amber-600" />
                    <span>{tmpl.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Configured Buttons List */}
            <div className="space-y-2.5">
              {(adSettings.buttons || []).map((btn, index) => (
                <div
                  key={btn.id || index}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-center gap-2.5"
                >
                  <div className="w-full sm:w-5/12">
                    <label className="text-3xs font-bold text-slate-500 block mb-0.5">متن روی دکمه:</label>
                    <input
                      type="text"
                      value={btn.text}
                      onChange={(e) => handleUpdateBtn(btn.id, { text: e.target.value })}
                      placeholder="مثلاً: 🤖 ورود به ربات"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="w-full sm:w-5/12">
                    <label className="text-3xs font-bold text-slate-500 block mb-0.5">لینک مقصد (آیدی یا وبسایت):</label>
                    <input
                      type="text"
                      value={btn.url}
                      onChange={(e) => handleUpdateBtn(btn.id, { url: e.target.value })}
                      placeholder="https://t.me/your_bot?start=ref"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white font-mono text-left dir-ltr focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="w-full sm:w-2/12 flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-4">
                    <select
                      value={btn.row || 1}
                      onChange={(e) => handleUpdateBtn(btn.id, { row: parseInt(e.target.value, 10) })}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-3xs font-bold text-slate-700 bg-white focus:outline-none cursor-pointer"
                      title="شماره ردیف دکمه"
                    >
                      <option value={1}>ردیف ۱</option>
                      <option value={2}>ردیف ۲</option>
                      <option value={3}>ردیف ۳</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDeleteBtn(btn.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 transition cursor-pointer"
                      title="حذف دکمه"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddButton}
                className="w-full py-2.5 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-100/50 text-amber-800 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-600" />
                <span>افزودن دکمه شیشه‌ای جدید</span>
              </button>
            </div>
          </div>

          {/* 4. Scheduling & Trigger Options */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-2xs">
            <span className="text-xs font-black text-slate-800 block border-b border-slate-100 pb-2">
              زمان‌بندی و شرایط انتشار بنر در کانال
            </span>

            {/* Mode selection */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAdSettings({ ...adSettings, triggerMode: 'interval' })}
                className={`p-2.5 rounded-xl text-center border text-xs font-bold transition cursor-pointer ${
                  adSettings.triggerMode === 'interval'
                    ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                به تعداد پست
              </button>
              <button
                type="button"
                onClick={() => setAdSettings({ ...adSettings, triggerMode: 'hourly' })}
                className={`p-2.5 rounded-xl text-center border text-xs font-bold transition cursor-pointer ${
                  adSettings.triggerMode === 'hourly'
                    ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                بازه ساعتی
              </button>
              <button
                type="button"
                onClick={() => setAdSettings({ ...adSettings, triggerMode: 'both' })}
                className={`p-2.5 rounded-xl text-center border text-xs font-bold transition cursor-pointer ${
                  adSettings.triggerMode === 'both'
                    ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                ترکیب هر دو
              </button>
            </div>

            {/* Post Interval Slider */}
            {(adSettings.triggerMode === 'interval' || adSettings.triggerMode === 'both') && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>فاصله بین هر بنر بر اساس تعداد پست:</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-mono">
                    هر {adSettings.postInterval || 10} پست
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="100"
                  step="1"
                  value={adSettings.postInterval || 10}
                  onChange={(e) =>
                    setAdSettings({ ...adSettings, postInterval: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-3xs text-slate-400 block">
                  پس از فوروارد موفق هر {adSettings.postInterval || 10} پست، این بنر تبلیغاتی اسپانسر ارسال می‌گردد.
                </span>
              </div>
            )}

            {/* Hourly Interval Slider */}
            {(adSettings.triggerMode === 'hourly' || adSettings.triggerMode === 'both') && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>بازه زمانی ارسال خودکار:</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-mono">
                    هر {adSettings.hourInterval || 6} ساعت
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="48"
                  step="1"
                  value={adSettings.hourInterval || 6}
                  onChange={(e) =>
                    setAdSettings({ ...adSettings, hourInterval: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-3xs text-slate-400 block">
                  هر {adSettings.hourInterval || 6} ساعت یکبار، بنر تبلیغاتی به طور خودکار به کانال مقصد ارسال خواهد شد.
                </span>
              </div>
            )}

            {/* Pin Message Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-amber-600" />
                <div>
                  <span className="text-xs font-bold text-slate-700 block">
                    پین کردن بنر تبلیغاتی در کانال مقصد
                  </span>
                  <span className="text-3xs text-slate-400 block">
                    پس از ارسال، پیام در بالای کانال مقصد سنجاق (Pin) خواهد شد.
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={adSettings.pinAdMessage}
                  onChange={(e) => setAdSettings({ ...adSettings, pinAdMessage: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Side: 5 Columns - Live Telegram Channel Post Mockup */}
        <div className="lg:col-span-5 space-y-4 sticky top-6">
          <div className="p-4.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-xs font-black text-slate-800">
                پیش‌نمایش زنده در کانال تلگرام
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-3xs font-bold font-mono dir-ltr">
                {destinationChannel || '@your_channel'}
              </span>
            </div>

            {/* Telegram Message Box */}
            <div className="bg-[#efeae2] dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-300/80 shadow-inner">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-xs border border-slate-200 dark:border-slate-800 space-y-2.5">
                
                {/* Pin Notification Banner */}
                {adSettings.pinAdMessage && (
                  <div className="flex items-center gap-1.5 text-3xs font-bold text-amber-700 border-b border-slate-100 pb-1.5">
                    <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>پیام پین شده در کانال</span>
                  </div>
                )}

                {/* Media Preview (Photo or Video) */}
                {hasMedia && (
                  <div className="rounded-lg overflow-hidden border border-slate-200/80 bg-slate-100 flex items-center justify-center max-h-56">
                    {adSettings.adMediaType === 'video' ? (
                      <div className="w-full py-8 bg-slate-900 text-white flex flex-col items-center justify-center gap-2">
                        <Video className="w-8 h-8 text-amber-400" />
                        <span className="text-3xs font-bold text-slate-300">
                          {adSettings.adMediaFileName || 'ویدیوی تبلیغاتی اسپانسر'}
                        </span>
                      </div>
                    ) : (
                      <img
                        src={adSettings.adMediaBase64 || adSettings.adMediaUrl}
                        alt="Ad Banner Preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-auto object-cover max-h-56"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Text Content with HTML preview */}
                <div
                  className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html:
                      adSettings.adText ||
                      '📢 <b>حامی مالی کانال</b>\n\nجهت درج تبلیغات با ما در ارتباط باشید.',
                  }}
                />

                {/* Telegram Glass Inline Keyboard Buttons */}
                {adSettings.enableButtons !== false && previewRows.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {previewRows.map((row, rIdx) => (
                      <div
                        key={rIdx}
                        className={`grid gap-1.5 ${
                          row.length === 1
                            ? 'grid-cols-1'
                            : row.length === 2
                            ? 'grid-cols-2'
                            : 'grid-cols-3'
                        }`}
                      >
                        {row.map((btn, bIdx) => (
                          <a
                            key={bIdx}
                            href={btn.url || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="py-2 px-2.5 rounded-lg bg-amber-500/90 hover:bg-amber-600 text-white text-2xs font-bold text-center block transition shadow-xs cursor-pointer truncate border border-amber-600/30 active:scale-98"
                            title={btn.url}
                          >
                            {btn.text}
                          </a>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Timestamp & Channel Watermark */}
                <div className="flex items-center justify-between text-3xs text-slate-400 pt-1 border-t border-slate-50">
                  <span className="font-mono">۱۱:۲۴</span>
                  <div className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-sky-500" />
                    <span>{destinationChannel || 'کانال مقصد'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Helpful explanation box */}
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-3xs space-y-1">
              <span className="font-bold block">💡 راهنما:</span>
              <p className="leading-relaxed">
                این دکمه‌های شیشه‌ای دقیقاً طبق همین چیدمان در زیر بنر در تلگرام نمایش داده می‌شوند. کاربر با کلیک روی هر دکمه به ربات، کانال اسپانسر، پیج یا وبسایت مقصد هدایت می‌گردد.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
