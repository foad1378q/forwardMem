import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Info,
  Zap,
  Search,
  Eye,
  X,
  Power,
  Layers,
  Sparkles,
  ArrowRightLeft,
  CalendarCheck,
} from 'lucide-react';
import {
  getQueueItems,
  getQueueStats,
  updateQueueSettings,
  pauseQueue,
  resumeQueue,
  retryFailedQueue,
  clearFailedQueue,
  clearAllQueue,
  sendQueueItemNow,
  deleteQueueItem,
  toggleQueueEnable,
  releaseDeferredNightMessages,
} from '../lib/telegramApi';
import { QueueItem, QueueSettings, QueueStats } from '../types';
import { formatTehranTime, formatTehranDateTime } from '../lib/timeUtils';

interface QueueManagementCardProps {
  isAdmin?: boolean;
  onRequireLogin?: () => void;
}

type ActiveTab = 'scheduled' | 'sent' | 'failed' | 'settings' | null;

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
    isQueueEnabled: true,
    isEmergencyHalted: false,
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
    isQueueEnabled: true,
  });

  // Collapsible active tab: if null, all lists are folded for maximum performance and minimalism
  const [activeTab, setActiveTab] = useState<ActiveTab>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [itemsLimit, setItemsLimit] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTogglingMaster, setIsTogglingMaster] = useState<boolean>(false);
  const [isReleasingNight, setIsReleasingNight] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<QueueItem | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch queue items and stats
  const fetchQueueData = useCallback(async () => {
    try {
      // Determine what status to query based on open tab
      let statusQuery = 'all';
      if (activeTab === 'scheduled') statusQuery = 'scheduled';
      else if (activeTab === 'sent') statusQuery = 'sent';
      else if (activeTab === 'failed') statusQuery = 'failed';

      const [itemsRes, statsRes] = await Promise.all([
        getQueueItems(statusQuery, 80),
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
    }
  }, [activeTab]);

  useEffect(() => {
    fetchQueueData();
    const interval = setInterval(fetchQueueData, 4000);
    return () => clearInterval(interval);
  }, [fetchQueueData]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Toggle Tab
  const toggleTab = (tab: ActiveTab) => {
    setItemsLimit(10);
    setSearchQuery('');
    setActiveTab(prev => (prev === tab ? null : tab));
  };

  // Master One-Click Queue Toggle (Enable/Disable)
  const handleToggleQueueMaster = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    setIsTogglingMaster(true);
    try {
      const res = await toggleQueueEnable();
      if (res.success) {
        showFeedback(res.message);
        setStats(prev => ({ ...prev, isQueueEnabled: res.isQueueEnabled }));
        setSettings(prev => ({ ...prev, isQueueEnabled: res.isQueueEnabled }));
        await fetchQueueData();
      } else {
        showFeedback(res.message || 'خطا در تغییر وضعیت صف', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در برقراری ارتباط با سرور', 'error');
    } finally {
      setIsTogglingMaster(false);
    }
  };

  // Release Night / Deferred Messages
  const handleReleaseNightMessages = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    setIsReleasingNight(true);
    try {
      const res = await releaseDeferredNightMessages();
      if (res.success) {
        showFeedback(res.message);
        await fetchQueueData();
      } else {
        showFeedback(res.message || 'خطا در آزادسازی پیام‌های معلق', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در آزادسازی پیام‌ها', 'error');
    } finally {
      setIsReleasingNight(false);
    }
  };

  // Pause / Resume Queue
  const handleTogglePause = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    try {
      if (stats.isQueuePaused) {
        const res = await resumeQueue();
        if (res.success) {
          showFeedback('صف ارسال هوشمند با موفقیت فعال شد.');
          fetchQueueData();
        }
      } else {
        const res = await pauseQueue();
        if (res.success) {
          showFeedback('صف ارسال پیام‌ها موقتاً متوقف گردید.');
          fetchQueueData();
        }
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در تغییر وضعیت صف', 'error');
    }
  };

  // Retry Failed
  const handleRetryFailed = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    try {
      const res = await retryFailedQueue();
      if (res.success) {
        showFeedback(res.message || `تعداد ${res.count} پیام مجدداً در صف قرار گرفت.`);
        fetchQueueData();
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در تلاش مجدد', 'error');
    }
  };

  // Clear Failed
  const handleClearFailed = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    if (!window.confirm('آیا از پاک‌سازی پیام‌های ناموفق اطمینان دارید؟')) return;
    try {
      const res = await clearFailedQueue();
      if (res.success) {
        showFeedback(res.message || `تعداد ${res.count} پیام خطادار از صف پاک شد.`);
        fetchQueueData();
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در پاک‌سازی', 'error');
    }
  };

  // Clear All Queue
  const handleClearAll = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    if (!window.confirm('آیا از پاک‌سازی کامل تمام پیام‌های موجود در صف اطمینان دارید؟')) return;
    try {
      const res = await clearAllQueue();
      if (res.success) {
        showFeedback(res.message || 'صف ارسال با موفقیت پاکسازی شد.');
        fetchQueueData();
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در پاک‌سازی کامل صف', 'error');
    }
  };

  // Send Single Item Now
  const handleSendNow = async (id: string) => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    setActionInProgressId(id);
    try {
      const res = await sendQueueItemNow(id);
      if (res.success) {
        showFeedback('پیام برای ارسال آنی در اولویت اول صف قرار گرفت.');
        fetchQueueData();
      } else {
        showFeedback(res.message || 'خطا در ارسال فوری پیام', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در اولویت‌بندی پیام', 'error');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Delete Single Item
  const handleDeleteItem = async (id: string) => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    setActionInProgressId(id);
    try {
      const res = await deleteQueueItem(id);
      if (res.success) {
        showFeedback('پیام با موفقیت از صف حذف شد.');
        fetchQueueData();
      } else {
        showFeedback(res.message || 'خطا در حذف پیام', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در حذف پیام', 'error');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Save Settings
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
        showFeedback('تنظیمات صف هوشمند با موفقیت ذخیره شد.');
        if (res.settings) {
          setSettings(res.settings);
        }
        fetchQueueData();
      } else {
        showFeedback(res.message || 'خطا در ذخیره تنظیمات', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در ذخیره تنظیمات', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Filter items for current active tab
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Tab filter
      if (activeTab === 'scheduled') {
        if (item.status !== 'scheduled' && item.status !== 'pending' && item.status !== 'sending') return false;
      } else if (activeTab === 'sent') {
        if (item.status !== 'sent') return false;
      } else if (activeTab === 'failed') {
        if (item.status !== 'failed') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const textMatch = item.messageText?.toLowerCase().includes(q) || false;
        const titleMatch = item.sourceChannelTitle?.toLowerCase().includes(q) || false;
        const userMatch = item.sourceChannelUsername?.toLowerCase().includes(q) || false;
        return textMatch || titleMatch || userMatch;
      }
      return true;
    });
  }, [items, activeTab, searchQuery]);

  const displayedItems = useMemo(() => {
    return filteredItems.slice(0, itemsLimit);
  }, [filteredItems, itemsLimit]);

  const isQueueActive = stats.isQueueEnabled !== false;

  return (
    <div id="queue-management-container" className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 transition-all">
      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          id="queue-feedback-toast"
          className={`mb-4 p-3 rounded-xl text-xs font-medium flex items-center justify-between border transition-all animate-fadeIn ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2 space-x-reverse">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Section */}
      <div id="queue-header-row" className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isQueueActive
              ? 'bg-blue-50 text-blue-600 border-blue-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-1">
              <h2 className="text-base font-bold text-slate-800">مدیریت صف ارسال پیام‌ها</h2>
              {/* Status Badges */}
              {isQueueActive ? (
                stats.isQueuePaused ? (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                    <Pause className="w-3 h-3" />
                    صف متوقف
                  </span>
                ) : (
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    صف فعال (ضد اسپم تلگرام)
                  </span>
                )
              ) : (
                <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-600" />
                  صف غیرفعال (ارسال مستقیم و آنی)
                </span>
              )}

              {/* Night mode state indicator */}
              {!settings.silentHoursEnabled && (
                <span className="bg-sky-50 text-sky-700 text-[10px] font-medium px-2 py-0.5 rounded-full border border-sky-200 flex items-center gap-1" title="تایم شب خاموش است و پیام‌ها به فردا صبح موکول نمی‌شوند">
                  <CalendarCheck className="w-3 h-3 text-sky-600" />
                  تایم شب: غیرفعال
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              تنظیم تاخیر تصادفی، زمان‌بندی هوشمند و ارسال مطمئن بدون قطعی یا مسدودی اکانت
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div id="queue-header-actions" className="flex items-center space-x-2 space-x-reverse shrink-0 flex-wrap gap-y-1.5">
          {/* Master 1-Click Toggle: Disable / Enable Queue */}
          <button
            id="queue-master-toggle-btn"
            onClick={handleToggleQueueMaster}
            disabled={isTogglingMaster}
            className={`flex items-center space-x-1.5 space-x-reverse px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm border ${
              isQueueActive
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
            }`}
            title={isQueueActive ? 'کلیک برای غیرفعال‌سازی صف و ارسال فوری پیام‌ها' : 'کلیک برای فعال‌سازی صف ارسال و تاخیر امن'}
          >
            {isQueueActive ? (
              <>
                <Power className="w-3.5 h-3.5 text-rose-600" />
                <span>غیرفعال کردن صف</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>فعال کردن صف</span>
              </>
            )}
          </button>

          {/* Pause / Resume Button (when queue is enabled) */}
          {isQueueActive && (
            <button
              id="queue-pause-resume-btn"
              onClick={handleTogglePause}
              className={`flex items-center space-x-1 space-x-reverse px-2.5 py-1.5 rounded-xl text-xs font-medium transition border ${
                stats.isQueuePaused
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {stats.isQueuePaused ? (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ادامه ارسال</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-slate-500" />
                  <span>توقف موقت</span>
                </>
              )}
            </button>
          )}

          {/* Refresh Button */}
          <button
            id="queue-refresh-btn"
            onClick={fetchQueueData}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition"
            title="به‌روزرسانی آمار و پیام‌ها"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Night Schedule Bugfix Banner & Instant Release Button */}
      {(!settings.silentHoursEnabled || (stats.scheduledCount > 0)) && (
        <div id="queue-night-mode-banner" className="mt-3 p-2.5 bg-sky-50/70 border border-sky-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-sky-900">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Moon className="w-4 h-4 text-sky-600 shrink-0" />
            <span>
              {!settings.silentHoursEnabled
                ? 'زمان‌بندی تایم شب خاموش است. کلیه پیام‌ها بدون موکول‌شدن به فردا ارسال خواهند شد.'
                : `تایم شب فعال است (${settings.silentHoursStart} تا ${settings.silentHoursEnd}).`}
            </span>
          </div>

          <button
            id="queue-release-night-btn"
            onClick={handleReleaseNightMessages}
            disabled={isReleasingNight}
            className="flex items-center space-x-1 space-x-reverse px-2.5 py-1 bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-lg text-xs font-semibold transition shrink-0 self-start sm:self-auto shadow-xs"
            title="اگر پیامی به فردا صبح موکول شده باشد با این دکمه بلافاصله در صف جاری قرار می‌گیرد"
          >
            <ArrowRightLeft className="w-3 h-3 text-sky-600" />
            <span>{isReleasingNight ? 'در حال آزادسازی...' : 'آزادسازی پیام‌های معلق'}</span>
          </button>
        </div>
      )}

      {/* Minimalist 4 Stat Cards (Click to open respective collapsible drawer) */}
      <div id="queue-stat-cards-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-4">
        {/* Card 1: Scheduled / Pending */}
        <button
          id="queue-tab-scheduled-btn"
          onClick={() => toggleTab('scheduled')}
          className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
            activeTab === 'scheduled'
              ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-400/20 shadow-xs'
              : 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">در صف انتظار</span>
            <Clock className={`w-4 h-4 ${activeTab === 'scheduled' ? 'text-blue-600' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-slate-800 font-mono">
              {stats.scheduledCount + stats.pendingCount}
            </span>
            <span className="text-[11px] text-blue-600 font-medium flex items-center gap-0.5">
              {activeTab === 'scheduled' ? 'بستن کشو' : 'مشاهده پیام‌ها'}
              {activeTab === 'scheduled' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          </div>
        </button>

        {/* Card 2: Sending (Real-time count) */}
        <div
          id="queue-card-sending"
          className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/70 text-right flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">در حال ارسال</span>
            <Send className="w-4 h-4 text-emerald-500 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-emerald-700 font-mono">
              {stats.sendingCount}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {stats.currentRatePerMinute} پیام/دقیقه
            </span>
          </div>
        </div>

        {/* Card 3: Sent (Successful) */}
        <button
          id="queue-tab-sent-btn"
          onClick={() => toggleTab('sent')}
          className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
            activeTab === 'sent'
              ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
              : 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">ارسال‌های موفق</span>
            <CheckCircle2 className={`w-4 h-4 ${activeTab === 'sent' ? 'text-emerald-600' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-slate-800 font-mono">
              {stats.sentCount}
            </span>
            <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-0.5">
              {activeTab === 'sent' ? 'بستن کشو' : 'مشاهده موفق‌ها'}
              {activeTab === 'sent' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          </div>
        </button>

        {/* Card 4: Failed (Errors) */}
        <button
          id="queue-tab-failed-btn"
          onClick={() => toggleTab('failed')}
          className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
            activeTab === 'failed'
              ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-400/20 shadow-xs'
              : 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">ناموفق / خطا</span>
            <AlertTriangle className={`w-4 h-4 ${activeTab === 'failed' ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-xl font-extrabold font-mono ${stats.failedCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {stats.failedCount}
            </span>
            <span className="text-[11px] text-rose-700 font-medium flex items-center gap-0.5">
              {activeTab === 'failed' ? 'بستن کشو' : 'مشاهده خطاها'}
              {activeTab === 'failed' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          </div>
        </button>
      </div>

      {/* Settings Tab Toggle Row */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="text-xs text-slate-500">
          {stats.nextScheduledItemTime && (
            <span>ارسال پیام بعدی: <strong className="text-slate-700 font-mono">{formatTehranTime(stats.nextScheduledItemTime)}</strong></span>
          )}
        </div>

        <button
          id="queue-tab-settings-btn"
          onClick={() => toggleTab('settings')}
          className={`flex items-center space-x-1.5 space-x-reverse px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
            activeTab === 'settings'
              ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-2 ring-indigo-400/20'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>تنظیمات تاخیر و ساعات سکوت</span>
          {activeTab === 'settings' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* COLLAPSIBLE SECTION: Rendered strictly on-demand to prevent lag and freeze */}
      {/* ========================================================================= */}
      {activeTab && (
        <div id="queue-collapsible-drawer" className="mt-4 pt-4 border-t border-slate-200 animate-fadeIn">
          {/* TAB 1: Scheduled Messages */}
          {activeTab === 'scheduled' && (
            <div id="queue-scheduled-section" className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <h3 className="text-sm font-bold text-slate-800">پیام‌های در نوبت ارسال</h3>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-mono">
                    {filteredItems.length} پیام
                  </span>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  {filteredItems.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="flex items-center space-x-1 space-x-reverse px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>پاکسازی صف</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                    title="بستن کشو"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="جستجو در پیام‌های صف بر اساس متن یا کانال..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-3 pl-8 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              {/* Items List */}
              {displayedItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">صف ارسال خالی است</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">هیچ پیامی در نوبت ارسال قرار ندارد.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedItems.map(item => (
                    <div
                      key={item.id}
                      className="p-3 bg-white hover:bg-slate-50/80 border border-slate-200 rounded-xl transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-1 mb-1">
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {item.sourceChannelTitle || item.sourceChannelUsername || 'کانال مبدا'}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                            زمان: {formatTehranTime(item.scheduledTime)}
                          </span>
                          {item.mediaType && item.mediaType !== 'text' && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded">
                              {item.mediaType}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1 break-words">
                          {item.messageText ? item.messageText.substring(0, 100) : 'بدون متن (فایل رسانه‌ای)'}
                        </p>
                      </div>

                      {/* Item Quick Actions */}
                      <div className="flex items-center space-x-1.5 space-x-reverse shrink-0 self-end sm:self-auto">
                        <button
                          onClick={() => setPreviewItem(item)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs"
                          title="مشاهده جزئیات پیام"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSendNow(item.id)}
                          disabled={actionInProgressId === item.id}
                          className="flex items-center space-x-1 space-x-reverse px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-medium transition border border-blue-200"
                          title="ارسال بلافاصله بدون فوت وقت"
                        >
                          <Send className="w-3 h-3" />
                          <span>ارسال فوری</span>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={actionInProgressId === item.id}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs"
                          title="حذف از صف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Load More Button if more items exist */}
                  {filteredItems.length > itemsLimit && (
                    <button
                      onClick={() => setItemsLimit(prev => prev + 15)}
                      className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition"
                    >
                      نمایش ۱۵ مورد بیشتر (باقی‌مانده: {filteredItems.length - itemsLimit})
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Sent Messages (Successful) */}
          {activeTab === 'sent' && (
            <div id="queue-sent-section" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <h3 className="text-sm font-bold text-slate-800">پیام‌های ارسال‌شده موفق</h3>
                  <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono">
                    {filteredItems.length} پیام
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  title="بستن کشو"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Items List */}
              {displayedItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">هنوز پیامی ثبت نشده است</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedItems.map(item => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center space-x-2 space-x-reverse truncate">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-bold text-slate-800 truncate">
                          {item.sourceChannelTitle || item.sourceChannelUsername || 'کانال مبدا'}
                        </span>
                        <span className="text-slate-500 truncate max-w-xs sm:max-w-md">
                          {item.messageText ? item.messageText.substring(0, 70) : 'رسانه'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.sentAt ? formatTehranTime(item.sentAt) : formatTehranTime(item.updatedAt)}
                        </span>
                        <button
                          onClick={() => setPreviewItem(item)}
                          className="p-1 text-slate-400 hover:text-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredItems.length > itemsLimit && (
                    <button
                      onClick={() => setItemsLimit(prev => prev + 15)}
                      className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition"
                    >
                      نمایش ۱۵ مورد بیشتر
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Failed Messages */}
          {activeTab === 'failed' && (
            <div id="queue-failed-section" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <h3 className="text-sm font-bold text-slate-800">پیام‌های ناموفق و دارای خطا</h3>
                  <span className="text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-mono">
                    {filteredItems.length} پیام
                  </span>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  {filteredItems.length > 0 && (
                    <>
                      <button
                        onClick={handleRetryFailed}
                        className="flex items-center space-x-1 space-x-reverse px-2.5 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition font-medium"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>ارسال مجدد همه</span>
                      </button>
                      <button
                        onClick={handleClearFailed}
                        className="flex items-center space-x-1 space-x-reverse px-2.5 py-1 text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>پاکسازی خطاها</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setActiveTab(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                    title="بستن کشو"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              {displayedItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">هیچ خطایی در صف ثبت نشده است</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">تمام ارسال‌ها با موفقیت کامل انجام شده‌اند.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedItems.map(item => (
                    <div
                      key={item.id}
                      className="p-3 bg-rose-50/40 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2 space-x-reverse mb-1">
                          <span className="text-xs font-bold text-slate-800">
                            {item.sourceChannelTitle || item.sourceChannelUsername}
                          </span>
                          <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-mono">
                            تلاش‌ها: {item.attemptsCount || 1}
                          </span>
                        </div>
                        {item.lastError && (
                          <p className="text-xs text-rose-700 font-medium break-words">
                            علت خطا: {item.lastError}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-1.5 space-x-reverse shrink-0 self-end sm:self-auto">
                        <button
                          onClick={() => handleSendNow(item.id)}
                          className="flex items-center space-x-1 space-x-reverse px-2 py-1 bg-white text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>تلاش مجدد</span>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Queue Settings Form */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} id="queue-settings-form" className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>تنظیمات هوشمند تاخیر، نرخ ارسال و ساعات سکوت</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  title="بستن تنظیمات"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid of Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    حداقل تاخیر تصادفی (ثانیه)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={settings.minDelaySeconds}
                    onChange={e => setSettings(prev => ({ ...prev, minDelaySeconds: parseInt(e.target.value, 10) || 5 }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">حداقل زمان انتظار قبل از ارسال پیام جدید</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    حداکثر تاخیر تصادفی (ثانیه)
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="300"
                    value={settings.maxDelaySeconds}
                    onChange={e => setSettings(prev => ({ ...prev, maxDelaySeconds: parseInt(e.target.value, 10) || 45 }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">تاخیر متغیر رفتار انسانی شبیه‌سازی می‌کند</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    حداکثر تعداد پیام در هر دقیقه
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.maxMessagesPerMinute}
                    onChange={e => setSettings(prev => ({ ...prev, maxMessagesPerMinute: parseInt(e.target.value, 10) || 12 }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">سقف مجاز ارسال در هر ۶۰ ثانیه (توصیه: ۱۰ الی ۱۵)</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    حداقل فاصله بین دو ارسال متوالی (ثانیه)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.minIntervalSeconds}
                    onChange={e => setSettings(prev => ({ ...prev, minIntervalSeconds: parseInt(e.target.value, 10) || 5 }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">فاصله تنفسی میان ارسال‌ها برای جلوگیری از FloodWait</p>
                </div>
              </div>

              {/* Silent Hours / Night Mode Section */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Moon className="w-4 h-4 text-indigo-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-800">زمان‌بندی تایم شب (ساعات سکوت)</span>
                      <p className="text-[11px] text-slate-500">
                        {settings.silentHoursEnabled
                          ? 'در این ساعات پیام‌ها به صبح روز بعد موکول می‌شوند.'
                          : 'تایم شب خاموش است؛ پیام‌ها به فردا صبح موکول نمی‌شوند و بی‌وقفه ارسال خواهند شد.'}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.silentHoursEnabled}
                      onChange={e => setSettings(prev => ({ ...prev, silentHoursEnabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {settings.silentHoursEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 animate-fadeIn">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        شروع ساعات سکوت (به وقت تهران)
                      </label>
                      <input
                        type="time"
                        value={settings.silentHoursStart}
                        onChange={e => setSettings(prev => ({ ...prev, silentHoursStart: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        پایان ساعات سکوت و شروع مجدد ارسال
                      </label>
                      <input
                        type="time"
                        value={settings.silentHoursEnd}
                        onChange={e => setSettings(prev => ({ ...prev, silentHoursEnd: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Form Submit Button */}
              <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1.5 space-x-reverse"
                >
                  <span>{isSavingSettings ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Item Details Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-4 sm:p-5 text-right space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>جزئیات پیام در صف</span>
              </h3>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">کانال مبدا:</span>
                <span className="font-bold text-slate-800">
                  {previewItem.sourceChannelTitle || previewItem.sourceChannelUsername || 'نامشخص'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">شناسه پیام در مبدا:</span>
                <span className="font-mono text-slate-800">{previewItem.originalMessageId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">زمان برنامه‌ریزی‌شده ارسال:</span>
                <span className="font-mono text-slate-800">{formatTehranDateTime(previewItem.scheduledTime)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">وضعیت فعلی:</span>
                <span className="font-bold text-slate-800">{previewItem.status}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">متن پیام:</span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-48 overflow-y-auto text-slate-800 text-xs whitespace-pre-wrap">
                  {previewItem.messageText || '(پیام فاقد متن است)'}
                </div>
              </div>
              {previewItem.lastError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                  خطا: {previewItem.lastError}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
