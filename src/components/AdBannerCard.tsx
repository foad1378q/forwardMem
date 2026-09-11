import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { AdBannerSettings } from '../types';
import { getAdBannerSettings, saveAdBannerSettings, sendAdBannerNow } from '../lib/telegramApi';

interface AdBannerCardProps {
  destinationChannel?: string;
  onRefresh?: () => void;
}

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
    adButtonText: '💬 ارتباط با بخش تبلیغات',
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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getAdBannerSettings();
      if (res.success && res.adBanner) {
        setAdSettings(res.adBanner);
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
        setSaveSuccess('تنظیمات بنر تبلیغاتی با موفقیت ذخیره گردید.');
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
      setErrorMsg('کانال مقصد تنظیم نشده است.');
      return;
    }
    const confirmed = window.confirm('آیا از ارسال فوری بنر تبلیغاتی هم‌اکنون به کانال مقصد اطمینان دارید؟');
    if (!confirmed) return;

    setIsSendingNow(true);
    setSendSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await sendAdBannerNow();
      if (res.success) {
        setSendSuccessMsg('بنر تبلیغاتی با موفقیت به کانال مقصد ارسال شد!');
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

  const formatLastSent = (timestamp?: string) => {
    if (!timestamp) return 'هنوز ارسالی ثبت نشده است';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('fa-IR');
    } catch {
      return timestamp;
    }
  };

  return (
    <div id="ad-banner-card" className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-800">
                بنر تبلیغاتی زمان‌بندی و اسپانسری کانال
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-3xs font-black">
                Scheduled Ad Banner
              </span>
            </div>
            <p className="text-2xs text-slate-500 mt-0.5">
              درج خودکار پیام‌های تبلیغاتی و اسپانسر براساس تعداد پست‌های فوروارد شده یا ساعات مشخص
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSendNow}
            disabled={isSendingNow || !destinationChannel}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            title="ارسال دستی و آنی بنر به کانال مقصد"
          >
            <Send className={`w-3.5 h-3.5 ${isSendingNow ? 'animate-bounce' : ''}`} />
            {isSendingNow ? 'در حال ارسال...' : 'ارسال فوری بنر هم‌اکنون'}
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {sendSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{sendSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-3xs font-bold text-slate-400 block mb-0.5">کل بنرهای ارسالی</span>
            <span className="text-xl font-black text-slate-800">
              {(adSettings.totalAdsSent || 0).toLocaleString('fa-IR')}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-3xs font-bold text-slate-400 block mb-0.5">پست‌های فوروارد شده پس از آخرین بنر</span>
            <span className="text-xl font-black text-indigo-600">
              {(adSettings.postsSinceLastAd || 0).toLocaleString('fa-IR')}
            </span>
            <span className="text-3xs text-slate-400 mr-1.5 font-medium">از {adSettings.postInterval || 10} پست</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-3xs font-bold text-slate-400 block mb-0.5">تاریخ آخرین ارسال تبلیغ</span>
            <span className="text-xs font-bold text-slate-700 block mt-1">
              {formatLastSent(adSettings.lastAdSentAt)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Activation Toggle */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
        <div>
          <span className="text-xs font-black text-slate-800 block">
            فعال‌سازی سیستم درج خودکار بنر تبلیغاتی
          </span>
          <span className="text-2xs text-slate-500">
            در صورت فعال بودن، پس از گذشت تعداد مشخصی از پست‌ها یا بازه زمانی، بنر تبلیغاتی تنظیم شده در کانال مقصد قرار می‌گیرد.
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={adSettings.enableAdBanner}
            onChange={(e) => setAdSettings({ ...adSettings, enableAdBanner: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
        </label>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Timing and Trigger Rules */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-4">
            <span className="text-xs font-black text-slate-800 block border-b border-slate-100 pb-2">
              نحوه و زمان‌بندی انتشار بنر (Trigger Mode)
            </span>

            {/* Mode Selectors */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAdSettings({ ...adSettings, triggerMode: 'interval' })}
                className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                  adSettings.triggerMode === 'interval'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 font-black'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                <span className="text-2xs block">تعداد پست</span>
              </button>

              <button
                type="button"
                onClick={() => setAdSettings({ ...adSettings, triggerMode: 'hourly' })}
                className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                  adSettings.triggerMode === 'hourly'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 font-black'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                <span className="text-2xs block">بازه ساعتی</span>
              </button>

              <button
                type="button"
                onClick={() => setAdSettings({ ...adSettings, triggerMode: 'both' })}
                className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                  adSettings.triggerMode === 'both'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 font-black'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                <span className="text-2xs block">هر دو حالت</span>
              </button>
            </div>

            {/* Interval by Post Count */}
            {(adSettings.triggerMode === 'interval' || adSettings.triggerMode === 'both') && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-2xs font-bold text-slate-700">
                  <span>فاصله بین تبلیغات بر اساس تعداد پست:</span>
                  <span className="text-amber-600 font-black">هر {adSettings.postInterval || 10} پست</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="50"
                  step="1"
                  value={adSettings.postInterval || 10}
                  onChange={(e) =>
                    setAdSettings({ ...adSettings, postInterval: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-3xs text-slate-400 block">
                  به ازای هر {adSettings.postInterval || 10} پیام ارسال‌شده از مبداها، یک بنر تبلیغاتی منتشر می‌شود.
                </span>
              </div>
            )}

            {/* Interval by Hours */}
            {(adSettings.triggerMode === 'hourly' || adSettings.triggerMode === 'both') && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-2xs font-bold text-slate-700">
                  <span>فاصله زمانی بر اساس ساعت:</span>
                  <span className="text-amber-600 font-black">هر {adSettings.hourInterval || 6} ساعت</span>
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
                  هر {adSettings.hourInterval || 6} ساعت یکبار، بنر تبلیغاتی به طور خودکار بازنشر داده خواهد شد.
                </span>
              </div>
            )}

            {/* Pin Message Toggle */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-amber-600" />
                <span className="text-2xs font-bold text-slate-700">
                  پین کردن بنر تبلیغاتی در کانال مقصد
                </span>
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

          {/* Interactive Button for Ad */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
            <span className="text-xs font-black text-slate-800 block border-b border-slate-100 pb-2">
              دکمه شیشه‌ای متصل به بنر تبلیغاتی
            </span>

            <div>
              <label className="text-3xs font-bold text-slate-600 block mb-1">متن دکمه تبلیغ:</label>
              <input
                type="text"
                value={adSettings.adButtonText || ''}
                onChange={(e) => setAdSettings({ ...adSettings, adButtonText: e.target.value })}
                placeholder="💬 ارتباط با بخش تبلیغات"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-3xs font-bold text-slate-600 block mb-1">
                لینک دکمه (آیدی یا وبسایت):
              </label>
              <input
                type="text"
                value={adSettings.adButtonUrl || ''}
                onChange={(e) => setAdSettings({ ...adSettings, adButtonUrl: e.target.value })}
                placeholder="https://t.me/admin_id یا https://example.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-400 font-mono text-left dir-ltr"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Ad Content & Live Preview */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
            <span className="text-xs font-black text-slate-800 block border-b border-slate-100 pb-2">
              محتوای بنر (متن و رسانه)
            </span>

            {/* Media URL Input */}
            <div>
              <label className="text-3xs font-bold text-slate-600 block mb-1">
                آدرس مستقیم تصویر یا ویدیو بنر (اختیاری):
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
                    onClick={() => setAdSettings({ ...adSettings, adMediaUrl: '' })}
                    className="px-2.5 py-2 rounded-xl text-3xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                  >
                    حذف عکس
                  </button>
                )}
              </div>
            </div>

            {/* Ad Textarea */}
            <div>
              <label className="text-3xs font-bold text-slate-600 block mb-1">
                متن بنر تبلیغاتی (پشتیبانی از تگ‌های HTML نظیر b, i, a):
              </label>
              <textarea
                rows={5}
                value={adSettings.adText || ''}
                onChange={(e) => setAdSettings({ ...adSettings, adText: e.target.value })}
                placeholder="متن تبلیغات را اینجا وارد کنید..."
                className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-400 leading-relaxed font-sans"
              />
            </div>
          </div>

          {/* Realistic Live Telegram Ad Mockup */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-2xs font-bold text-slate-700 block">
              پیش‌نمایش ظاهر بنر در کانال مقصد:
            </span>

            <div className="bg-[#efeae2] dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-300/80">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-xs border border-slate-200 dark:border-slate-800 space-y-2.5">
                {/* Pin Indicator */}
                {adSettings.pinAdMessage && (
                  <div className="flex items-center gap-1.5 text-3xs font-bold text-amber-700 border-b border-slate-100 pb-1.5">
                    <Pin className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>پیام پین شده در کانال</span>
                  </div>
                )}

                {/* Media preview */}
                {adSettings.adMediaUrl && (
                  <div className="rounded-lg overflow-hidden border border-slate-200/80 max-h-48 bg-slate-100 flex items-center justify-center">
                    <img
                      src={adSettings.adMediaUrl}
                      alt="Ad Preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-auto object-cover max-h-48"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Text preview */}
                <div
                  className="text-2xs text-slate-800 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html:
                      adSettings.adText ||
                      '📢 <b>حامی مالی کانال</b>\n\nجهت درج تبلیغات با ما در ارتباط باشید.',
                  }}
                />

                {/* Button preview */}
                {adSettings.adButtonText && (
                  <a
                    href={adSettings.adButtonUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-2xs font-black text-center block transition shadow-xs cursor-pointer truncate"
                  >
                    {adSettings.adButtonText}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
