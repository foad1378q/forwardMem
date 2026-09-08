import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Send,
  CheckCircle2,
  AlertTriangle,
  BellRing,
  HelpCircle,
  FileBarChart,
  RefreshCw,
  Info,
  Calendar,
} from 'lucide-react';
import {
  getReportGroupConfig,
  saveReportGroupConfig,
  testReportGroup,
  sendDailyDigestNow,
} from '../lib/telegramApi';
import { ReportGroupConfig } from '../types';

interface AdminReportGroupCardProps {
  isAdmin?: boolean;
  onRequireLogin?: () => void;
}

export const AdminReportGroupCard: React.FC<AdminReportGroupCardProps> = ({
  isAdmin = true,
  onRequireLogin,
}) => {
  const [config, setConfig] = useState<ReportGroupConfig>({
    chatId: '',
    status: 'not_configured',
    alertsEnabled: true,
  });

  const [chatIdInput, setChatIdInput] = useState<string>('');
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSendingDigest, setIsSendingDigest] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await getReportGroupConfig();
      if (res?.success && res.config) {
        setConfig(res.config);
        setChatIdInput(res.config.chatId || '');
        setAlertsEnabled(res.config.alertsEnabled !== false);
      }
    } catch (err) {
      console.error('Failed to load report group config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const showFeedback = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }

    setIsLoading(true);
    try {
      const res = await saveReportGroupConfig({
        chatId: chatIdInput.trim(),
        alertsEnabled,
      });

      if (res.success) {
        showFeedback('تنظیمات گروه گزارش با موفقیت در دیتابیس ثبت گردید.');
        fetchConfig();
      } else {
        showFeedback(res.message || 'خطا در ثبت تنظیمات', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در برقراری ارتباط', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }

    if (!chatIdInput.trim()) {
      showFeedback('لطفاً ابتدا شناسه چت یا گروه گزارش را وارد کنید.', 'error');
      return;
    }

    setIsTesting(true);
    try {
      const res = await testReportGroup(chatIdInput.trim());
      if (res.success) {
        showFeedback(res.message || 'پیام تستی با موفقیت به گروه گزارش ارسال گردید.');
        fetchConfig();
      } else {
        showFeedback(res.message || 'خطا در ارسال پیام تستی به تلگرام', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در ارسال تست', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendDigestNow = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }

    setIsSendingDigest(true);
    try {
      const res = await sendDailyDigestNow();
      if (res.success) {
        showFeedback('گزارش تجمیعی روزانه به گروه گزارش ارسال گردید.');
      } else {
        showFeedback(res.message || 'خطا در ارسال گزارش روزانه', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در ارسال گزارش روزانه', 'error');
    } finally {
      setIsSendingDigest(false);
    }
  };

  const getStatusBadge = () => {
    switch (config.status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
            متصل و فعال
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 ml-1" />
            خطای اتصال
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Info className="w-3.5 h-3.5 ml-1" />
            تنظیم نشده
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-800">گروه گزارش و هشدارهای ادمین (Report Group)</h2>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              دریافت مستقل هشدارهای قطعی کلاینت، انقضای نشست، خطاهای صف، FloodWait و گزارش تجمیعی روزانه
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchConfig}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="بروزرسانی"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Security Isolation Notice */}
      <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-blue-900 text-xs flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-bold">حفاظت از کانال مقصد و ایزولاسیون کامل گزارش‌ها:</p>
          <p className="text-2xs text-blue-800">
            این گروه <strong>کاملاً مستقل از کانال مقصد</strong> است. به هیچ عنوان گزارش‌ها، خطاها و گزارش‌های روزانه به کانال‌های مبدا یا مقصد ارسال نمی‌شوند. همچنین توکن ربات، رشته نشست (Session) و پسوردها همواره ماسک‌شده و مخفی می‌مانند.
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`mx-6 mt-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
          {feedback.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />}
          {feedback.type === 'info' && <Info className="w-4 h-4 shrink-0 text-blue-600" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Form Body */}
      <form onSubmit={handleSaveConfig} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chat ID Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>شناسه گروه گزارش تلگرام (Report Group Chat ID)</span>
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={chatIdInput}
                onChange={e => setChatIdInput(e.target.value)}
                placeholder="مثال: -1001234567890 یا @my_admin_group"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono text-left dir-ltr"
              />
            </div>
            <p className="text-2xs text-slate-500">
              شناسه عددی گروه ادمین (شروع با <code>-100</code>). ربات تلگرام باید در این گروه عضو و ترجیحاً ادمین باشد.
            </p>
          </div>

          {/* Test & Actions */}
          <div className="space-y-2 flex flex-col justify-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !chatIdInput.trim()}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${isTesting ? 'animate-bounce' : ''}`} />
                <span>{isTesting ? 'در حال ارسال تست...' : 'تست اتصال با ارسال پیام تستی'}</span>
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-xs transition disabled:opacity-50"
              >
                {isLoading ? 'ذخیره...' : 'ذخیره شناسه گروه'}
              </button>
            </div>
            {config.lastTestedAt && (
              <span className="text-2xs text-slate-400 block text-left dir-ltr font-mono">
                آخرین تست موفق: {new Date(config.lastTestedAt).toLocaleString('fa-IR')}
              </span>
            )}
          </div>
        </div>

        {/* Trigger Alerts Checklist */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <BellRing className="w-4 h-4 text-indigo-600" />
              <span>هشدارهای خودکار فعال (Alert Triggers)</span>
            </h4>

            <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
              <input
                type="checkbox"
                checked={alertsEnabled}
                onChange={e => setAlertsEnabled(e.target.checked)}
                className="w-4 h-4 rounded-md text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span className="text-xs font-bold text-slate-700">فعال بودن کل سیستم هشدارها</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { title: 'قطع ارتباط حساب تلگرام (Client Disconnect)', desc: 'هشدار فوری هنگام قطعی GramJS یا خطا در کانکشن', icon: '🚨' },
              { title: 'انقضای نشست کاربر (Session Expired)', desc: 'اطلاع‌رسانی در صورت نیاز به ورود مجدد به اکانت تلگرام', icon: '⚠️' },
              { title: 'محدودیت FloodWait تلگرام', desc: 'گزارش ثانیه‌های تاخیر و ساعت شروع مجدد ارسال‌ها', icon: '⏱' },
              { title: 'خطاهای متوالی صف (۳ بار شکست)', desc: 'ارسال هشدار به همراه متن خطا و مشخصات پیام ناموفق', icon: '❌' },
              { title: 'خطاهای پایگاه داده (Database Error)', desc: 'اطلاع‌رسانی فوری در صورت قطعی اتصال به PostgreSQL', icon: '🗄' },
              { title: 'گزارش تجمیعی روزانه (Daily Digest)', desc: 'ارسال خودکار خلاصه آمار ۲۴ ساعته راس ساعت 00:00 تهران', icon: '📊' },
            ].map((item, idx) => (
              <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                <span className="text-base">{item.icon}</span>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800">{item.title}</p>
                  <p className="text-2xs text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Digest Section */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/60">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-indigo-950">گزارش تجمیعی ۲۴ ساعته (Daily Digest)</h4>
              <p className="text-2xs text-indigo-800/80 mt-0.5">
                هر شب راس ساعت 00:00 (به وقت تهران) گزارش کاملی از تعداد پیام‌های دریافتی، فیلتر شده، ارسالی، خطاها و وضعیت صف به این گروه ارسال می‌گردد.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendDigestNow}
            disabled={isSendingDigest || !chatIdInput.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            <FileBarChart className="w-3.5 h-3.5" />
            <span>{isSendingDigest ? 'در حال ارسال گزارش...' : 'ارسال دستی خلاصه وضعیت (تست)'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
