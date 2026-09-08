import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Send,
  Sliders,
  Moon,
  ShieldCheck,
  RefreshCw,
  XCircle,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getQueueItems,
  getQueueStats,
  updateQueueSettings,
  pauseQueue,
  resumeQueue,
  retryFailedQueue,
  clearFailedQueue,
  deleteQueueItem,
} from '../lib/telegramApi';
import { QueueItem, QueueSettings, QueueStats } from '../types';

interface QueueManagementCardProps {
  isAdmin?: boolean;
  onRequireLogin?: () => void;
}

export const QueueManagementCard: React.FC<QueueManagementCardProps> = ({
  isAdmin = true,
  onRequireLogin,
}) => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    pendingCount: 0,
    scheduledCount: 0,
    sendingCount: 0,
    sentCount: 0,
    failedCount: 0,
    totalQueued: 0,
    isQueuePaused: false,
    currentRatePerMinute: 0,
  });

  const [settings, setSettings] = useState<QueueSettings>({
    minDelaySeconds: 10,
    maxDelaySeconds: 45,
    silentHoursEnabled: false,
    silentHoursStart: '23:00',
    silentHoursEnd: '07:00',
    minIntervalSeconds: 5,
    maxMessagesPerMinute: 12,
    isQueuePaused: false,
  });

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchQueueData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [itemsRes, statsRes] = await Promise.all([
        getQueueItems(statusFilter, 50),
        getQueueStats(),
      ]);

      if (itemsRes?.success && Array.isArray(itemsRes.items)) {
        setItems(itemsRes.items);
      }
      if (statsRes?.success && statsRes.stats) {
        setStats(statsRes.stats);
        if (statsRes.stats.settings) {
          setSettings(statsRes.stats.settings);
        }
      }
    } catch (err) {
      console.error('Error fetching queue:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchQueueData();
    const interval = setInterval(fetchQueueData, 5000); // Polling every 5s
    return () => clearInterval(interval);
  }, [fetchQueueData]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleTogglePause = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    try {
      if (stats.isQueuePaused) {
        const res = await resumeQueue();
        if (res.success) {
          showFeedback('صف ارسال با موفقیت فعال شد.');
          fetchQueueData();
        }
      } else {
        const res = await pauseQueue();
        if (res.success) {
          showFeedback('صف ارسال موقتاً متوقف گردید.');
          fetchQueueData();
        }
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در تغییر وضعیت صف', 'error');
    }
  };

  const handleRetryFailed = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    try {
      const res = await retryFailedQueue();
      if (res.success) {
        showFeedback(`تعداد ${res.count} پیام خطادار مجدداً در صف زمان‌بندی قرار گرفت.`);
        fetchQueueData();
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در تلاش مجدد', 'error');
    }
  };

  const handleClearFailed = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    if (!window.confirm('آیا از پاک‌سازی پیام‌های ناموفق در صف اطمینان دارید؟')) return;
    try {
      const res = await clearFailedQueue();
      if (res.success) {
        showFeedback(`تعداد ${res.count} پیام خطادار از صف پاک شد.`);
        fetchQueueData();
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در پاک‌سازی صف', 'error');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    try {
      const res = await deleteQueueItem(id);
      if (res.success) {
        showFeedback('پیام از صف حذف گردید.');
        setItems(prev => prev.filter(i => i.id !== id));
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در حذف پیام', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    setIsSavingSettings(true);
    try {
      const res = await updateQueueSettings(settings);
      if (res.success) {
        showFeedback('تنظیمات صف و زمان‌بندی با موفقیت ذخیره شد.');
        setShowSettingsDrawer(false);
        fetchQueueData();
      } else {
        showFeedback(res.message || 'خطا در ذخیره تنظیمات', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در برقراری ارتباط', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const formatScheduledTime = (isoString?: string) => {
    if (!isoString) return 'نامشخص';
    try {
      const target = new Date(isoString).getTime();
      const diffSec = Math.round((target - Date.now()) / 1000);
      if (diffSec <= 0) return 'هم‌اکنون';
      if (diffSec < 60) return `${diffSec} ثانیه دیگر`;
      const diffMin = Math.round(diffSec / 60);
      return `${diffMin} دقیقه دیگر`;
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Timer className="w-3 h-3 ml-1" />
            زمان‌بندی‌شده
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <Send className="w-3 h-3 ml-1" />
            در حال ارسال
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 ml-1" />
            ارسال‌شده
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 ml-1" />
            خطا در ارسال
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 ml-1" />
            در صف انتظار
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
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <span>مدیریت صف پیام‌ها و زمان‌بندی هوشمند</span>
              {stats.isQueuePaused && (
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  متوقف‌شده
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ذخیره‌سازی در دیتابیس، جلوگیری از بلاک شدن با تاخیر و جیتر، رعایت ساعات سکوت و مدیریت خطا
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={fetchQueueData}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="بروزرسانی داده‌ها"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            <span>تنظیمات تاخیر و نرخ</span>
            {showSettingsDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            onClick={handleTogglePause}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5 ${
              stats.isQueuePaused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20'
            }`}
          >
            {stats.isQueuePaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>از سرگیری صف</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>توقف موقت صف</span>
              </>
            )}
          </button>

          {stats.failedCount > 0 && (
            <>
              <button
                onClick={handleRetryFailed}
                className="px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تلاش مجدد ({stats.failedCount})</span>
              </button>
              <button
                onClick={handleClearFailed}
                className="px-2.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition flex items-center gap-1"
                title="پاک‌سازی خطادارها"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMessage && (
        <div
          className={`mx-6 mt-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* FloodWait Notification Banner */}
      {stats.floodWaitActiveUntil && (
        <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>وقوع FloodWait تلگرام:</strong> ارسال پیام‌ها تا{' '}
              <code>{new Date(stats.floodWaitActiveUntil).toLocaleTimeString('fa-IR')}</code> موقتاً متوقف گردیده است.
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 text-2xs font-bold">
            محافظت خودکار
          </span>
        </div>
      )}

      {/* Settings Panel Drawer */}
      {showSettingsDrawer && (
        <form onSubmit={handleSaveSettings} className="p-5 bg-slate-50 border-b border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>پیکربندی تاخیر، جیتر و محدودیت نرخ ارسال</span>
            </h3>
            <span className="text-2xs text-slate-500">ذخیره خودکار در دیتابیس پایدار</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Min Delay */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">حداقل تاخیر (ثانیه)</label>
              <input
                type="number"
                min="1"
                max="300"
                value={settings.minDelaySeconds}
                onChange={e => setSettings({ ...settings, minDelaySeconds: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
              <span className="text-2xs text-slate-400 block">حداقل فاصله تا زمان ارسال پیام</span>
            </div>

            {/* Max Delay */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">حداکثر تاخیر (جیتر تصادفی)</label>
              <input
                type="number"
                min="1"
                max="600"
                value={settings.maxDelaySeconds}
                onChange={e => setSettings({ ...settings, maxDelaySeconds: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
              <span className="text-2xs text-slate-400 block">تاخیر تصادفی بین حداقل و حداکثر</span>
            </div>

            {/* Min Interval */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">فاصله امن بین هر ۲ ارسال (ثانیه)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.minIntervalSeconds}
                onChange={e => setSettings({ ...settings, minIntervalSeconds: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
              <span className="text-2xs text-slate-400 block">جلوگیری از ارسال هم‌زمان و پشت‌سرهم</span>
            </div>

            {/* Max Per Min */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">سقف مجاز در هر دقیقه</label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.maxMessagesPerMinute}
                onChange={e => setSettings({ ...settings, maxMessagesPerMinute: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
              <span className="text-2xs text-slate-400 block">حداکثر پیام خروجی به کانال در دقیقه</span>
            </div>
          </div>

          {/* Silent Hours Section */}
          <div className="pt-3 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="flex items-center space-x-3 space-x-reverse">
              <input
                type="checkbox"
                id="silentHoursToggle"
                checked={settings.silentHoursEnabled}
                onChange={e => setSettings({ ...settings, silentHoursEnabled: e.target.checked })}
                className="w-4 h-4 rounded-md text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <label htmlFor="silentHoursToggle" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span>فعال‌سازی ساعات سکوت (Silent Hours)</span>
              </label>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse">
              <span className="text-xs font-medium text-slate-600">شروع:</span>
              <input
                type="time"
                disabled={!settings.silentHoursEnabled}
                value={settings.silentHoursStart}
                onChange={e => setSettings({ ...settings, silentHoursStart: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-mono disabled:opacity-50"
              />
              <span className="text-xs font-medium text-slate-600">پایان:</span>
              <input
                type="time"
                disabled={!settings.silentHoursEnabled}
                value={settings.silentHoursEnd}
                onChange={e => setSettings({ ...settings, silentHoursEnd: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-mono disabled:opacity-50"
              />
            </div>

            <div className="text-left flex justify-end">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-xs transition"
              >
                {isSavingSettings ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-x-reverse divide-slate-100 border-b border-slate-100 bg-slate-50/50">
        <div className="p-4 text-center">
          <span className="text-2xs font-bold text-slate-500 block mb-1">در انتظار زمان‌بندی</span>
          <span className="text-lg font-black text-amber-600">{stats.scheduledCount.toLocaleString('fa-IR')}</span>
        </div>
        <div className="p-4 text-center">
          <span className="text-2xs font-bold text-slate-500 block mb-1">در حال ارسال</span>
          <span className="text-lg font-black text-blue-600">{stats.sendingCount.toLocaleString('fa-IR')}</span>
        </div>
        <div className="p-4 text-center">
          <span className="text-2xs font-bold text-slate-500 block mb-1">موفق (Sent)</span>
          <span className="text-lg font-black text-emerald-600">{stats.sentCount.toLocaleString('fa-IR')}</span>
        </div>
        <div className="p-4 text-center">
          <span className="text-2xs font-bold text-slate-500 block mb-1">ناموفق (Failed)</span>
          <span className="text-lg font-black text-rose-600">{stats.failedCount.toLocaleString('fa-IR')}</span>
        </div>
        <div className="p-4 text-center col-span-2 sm:col-span-1">
          <span className="text-2xs font-bold text-slate-500 block mb-1">نرخ ارسال فعلی</span>
          <span className="text-xs font-bold text-slate-700">
            {stats.currentRatePerMinute} <span className="text-2xs text-slate-400">پیام/دقیقه</span>
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center space-x-1 space-x-reverse text-xs">
          {[
            { key: 'all', label: 'همه' },
            { key: 'scheduled', label: 'زمان‌بندی‌شده' },
            { key: 'sending', label: 'در حال ارسال' },
            { key: 'sent', label: 'ارسال‌شده' },
            { key: 'failed', label: 'خطادار' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                statusFilter === f.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {stats.nextScheduledItemTime && (
          <div className="text-2xs text-slate-500 flex items-center gap-1 shrink-0 font-medium">
            <Timer className="w-3.5 h-3.5 text-indigo-500" />
            <span>پیام بعدی: {formatScheduledTime(stats.nextScheduledItemTime)}</span>
          </div>
        )}
      </div>

      {/* Queue Items List / Table */}
      <div className="overflow-x-auto">
        {items.length === 0 ? (
          <div className="p-10 text-center text-slate-400 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
            <p className="text-xs font-medium">هیچ پیامی در این دسته‌بندی صف وجود ندارد.</p>
          </div>
        ) : (
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                <th className="py-2.5 px-4">شناسه</th>
                <th className="py-2.5 px-4">کانال مبدا</th>
                <th className="py-2.5 px-4">نوع رسانه</th>
                <th className="py-2.5 px-4">زمان ارسال هدف</th>
                <th className="py-2.5 px-4">وضعیت</th>
                <th className="py-2.5 px-4">تلاش‌ها / خطا</th>
                <th className="py-2.5 px-4 text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4 font-mono text-2xs text-slate-500">
                    #{item.originalMessageId}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-800 block">
                      {item.sourceChannelTitle || item.sourceChannelUsername || item.sourceChannelId}
                    </span>
                    {item.sourceChannelUsername && (
                      <span className="text-2xs text-slate-400 font-mono">@{item.sourceChannelUsername}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-2xs font-semibold">
                      {item.mediaType || 'text'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-medium">
                    {formatScheduledTime(item.scheduledTime)}
                    <span className="block text-2xs text-slate-400 font-mono mt-0.5">
                      {new Date(item.scheduledTime).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-2xs font-mono text-slate-500 block">
                      تلاش: {item.attemptsCount}
                    </span>
                    {item.lastError && (
                      <span className="text-2xs text-rose-600 font-mono block max-w-xs truncate" title={item.lastError}>
                        {item.lastError}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-left">
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="حذف از صف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
