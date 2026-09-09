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
  PowerOff,
  Image,
  Video,
  Music,
  FileCode,
  Layers,
  Sparkles,
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
  toggleSystemPower,
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
  });

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [showArchitectureGuide, setShowArchitectureGuide] = useState<boolean>(false);
  const [confirmClearAllModal, setConfirmClearAllModal] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<QueueItem | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchQueueData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [itemsRes, statsRes] = await Promise.all([
        getQueueItems(statusFilter, 100),
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
    const interval = setInterval(fetchQueueData, 4000);
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
          showFeedback('صف ارسال هوشمند با موفقیت فعال شد و ارسال‌ها ادامه می‌یابند.');
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

  const handleToggleEmergencyPower = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    try {
      const nextTurnOff = !stats.isEmergencyHalted;
      const res = await toggleSystemPower(nextTurnOff);
      if (res.success) {
        showFeedback(
          res.isSystemTurnedOff
            ? '🛑 کلید خاموش اضطراری فعال شد: کلیه فرایندهای رصد کانال‌ها و ارسال پیام‌ها متوقف شدند.'
            : '🟢 سامانه مجدداً روشن و فعال شد: رصد و صف ارسال از سر گرفته شدند.'
        );
        fetchQueueData();
      } else {
        showFeedback(res.message || 'خطا در تغییر وضعیت برق اضطراری سامانه', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطای شبکه در اعمال کلید خاموش اضطراری', 'error');
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
        showFeedback(`تعداد ${res.count} پیام خطادار مجدداً با تاخیر امن در صف قرار گرفت.`);
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
    if (!window.confirm('آیا از پاک‌سازی پیام‌های ناموفق اطمینان دارید؟')) return;
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

  const handleClearAllQueue = async () => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    try {
      const res = await clearAllQueue();
      if (res.success) {
        showFeedback(res.message || 'صف ارسال هوشمند با موفقیت خالی شد.');
        setConfirmClearAllModal(false);
        fetchQueueData();
      } else {
        showFeedback(res.message || 'خطا در تخلیه صف', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطای شبکه در تخلیه صف', 'error');
    }
  };

  const handleSendNow = async (id: string) => {
    if (!isAdmin && onRequireLogin) {
      onRequireLogin();
      return;
    }
    setActionInProgressId(id);
    try {
      const res = await sendQueueItemNow(id);
      if (res.success) {
        showFeedback('پیام برای ارسال فوری اولویت‌بندی شد.');
        fetchQueueData();
      } else {
        showFeedback(res.message || 'خطا در اولویت‌بندی ارسال', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطای شبکه', 'error');
    } finally {
      setActionInProgressId(null);
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
        showFeedback('پیام با موفقیت از صف حذف گردید.');
        setItems(prev => prev.filter(i => i.id !== id));
      }
    } catch (err: any) {
      showFeedback(err.message || 'خطا در حذف پیام', 'error');
    }
  };

  const handleApplyPreset = (type: 'safe' | 'standard' | 'fast') => {
    if (type === 'safe') {
      setSettings(prev => ({
        ...prev,
        minDelaySeconds: 20,
        maxDelaySeconds: 80,
        minIntervalSeconds: 8,
        maxMessagesPerMinute: 8,
      }));
      showFeedback('پروفایل «فوق‌العاده امن (ضدبلاک)» انتخاب شد. لطفاً ذخیره را بزنید.');
    } else if (type === 'standard') {
      setSettings(prev => ({
        ...prev,
        minDelaySeconds: 10,
        maxDelaySeconds: 45,
        minIntervalSeconds: 5,
        maxMessagesPerMinute: 12,
      }));
      showFeedback('پروفایل «استاندارد متعادل» انتخاب شد.');
    } else {
      setSettings(prev => ({
        ...prev,
        minDelaySeconds: 3,
        maxDelaySeconds: 12,
        minIntervalSeconds: 2,
        maxMessagesPerMinute: 20,
      }));
      showFeedback('پروفایل «ارسال سریع» انتخاب شد.');
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
        showFeedback('تنظیمات صف و زمان‌بندی هوشمند با موفقیت ذخیره شد.');
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
      if (diffMin < 60) return `${diffMin} دقیقه دیگر`;
      const diffHours = Math.round(diffMin / 60);
      return `${diffHours} ساعت دیگر`;
    } catch {
      return isoString;
    }
  };

  const filteredItems = useMemo(() => {
    let list = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => {
        const idMatch = String(item.originalMessageId).includes(q);
        const titleMatch = (item.sourceChannelTitle || '').toLowerCase().includes(q);
        const userMatch = (item.sourceChannelUsername || '').toLowerCase().includes(q);
        const textMatch = (item.messageText || item.formattedText || '').toLowerCase().includes(q);
        return idMatch || titleMatch || userMatch || textMatch;
      });
    }
    return list;
  }, [items, searchQuery]);

  const getMediaIcon = (mediaType?: string) => {
    switch (mediaType) {
      case 'photo':
        return <Image className="w-3.5 h-3.5 text-blue-500" />;
      case 'video':
        return <Video className="w-3.5 h-3.5 text-purple-500" />;
      case 'audio':
        return <Music className="w-3.5 h-3.5 text-emerald-500" />;
      case 'document':
        return <FileCode className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Timer className="w-3 h-3 ml-1 text-amber-600" />
            زمان‌بندی‌شده
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <Send className="w-3 h-3 ml-1 text-blue-600" />
            در حال ارسال
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 ml-1 text-emerald-600" />
            ارسال‌شده
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 ml-1 text-rose-600" />
            خطا در ارسال
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 ml-1 text-slate-500" />
            در صف انتظار
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Top Emergency Halt Banner if System is Turned Off */}
      {stats.isEmergencyHalted && (
        <div className="bg-rose-600 text-white px-6 py-3 text-xs font-bold flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-2">
            <PowerOff className="w-4 h-4 text-white shrink-0 animate-pulse" />
            <span>
              <strong>هشدار کلید خاموش اضطراری:</strong> سامانه در وضعیت خاموش اضطراری قرار دارد. مانیتورینگ کانال‌ها و صف ارسال کاملاً متوقف شده‌اند.
            </span>
          </div>
          <button
            onClick={handleToggleEmergencyPower}
            className="px-3.5 py-1.5 rounded-xl bg-white text-rose-700 hover:bg-rose-50 text-xs font-black shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
          >
            <Power className="w-3.5 h-3.5 text-emerald-600" />
            <span>روشن‌سازی مجدد سامانه</span>
          </button>
        </div>
      )}

      {/* Card Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-slate-800">
                مدیریت صف پیام‌ها و زمان‌بندی هوشمند
              </h2>
              {stats.isEmergencyHalted ? (
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  خاموش اضطراری
                </span>
              ) : stats.isQueuePaused ? (
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  صف موقتاً متوقف
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  صف فعال و هوشمند
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              جلوگیری از بلاک شدن با تاخیر تصادفی و جیتر، رعایت ساعات سکوت شبانه، کنترل سقف نرخ و ارسال تک‌نخی
            </p>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setShowArchitectureGuide(!showArchitectureGuide)}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition flex items-center gap-1.5 ${
              showArchitectureGuide
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
            }`}
            title="راهنمای نحوه کارکرد صف هوشمند"
          >
            <Info className="w-3.5 h-3.5 text-indigo-600" />
            <span>راهنمای عملکرد</span>
          </button>

          <button
            onClick={fetchQueueData}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="تازه سازی وضعیت صف"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition flex items-center gap-1.5 ${
              showSettingsDrawer
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <Sliders className={`w-3.5 h-3.5 ${showSettingsDrawer ? 'text-white' : 'text-indigo-600'}`} />
            <span>پیکربندی تاخیر و نرخ</span>
            {showSettingsDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            onClick={handleToggleEmergencyPower}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer ${
              stats.isEmergencyHalted
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-300'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
            }`}
            title="کلید قطع برق اضطراری کل سامانه (توقف کامل رصد کانال‌ها و صف ارسال)"
          >
            <Power className="w-3.5 h-3.5" />
            <span>{stats.isEmergencyHalted ? 'روشن کردن سیستم' : 'خاموش اضطراری'}</span>
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

          {stats.totalQueued > 0 && (
            <button
              onClick={() => setConfirmClearAllModal(true)}
              className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition flex items-center gap-1"
              title="تخلیه کامل پیام‌های در صف"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>تخلیه صف ({stats.totalQueued})</span>
            </button>
          )}

          {stats.failedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRetryFailed}
                className="px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تلاش مجدد ({stats.failedCount})</span>
              </button>
              <button
                onClick={handleClearFailed}
                className="p-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition"
                title="پاک‌سازی خطادارها"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Visual Pipeline Infographic Banner */}
      {showArchitectureGuide && (
        <div className="p-5 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-purple-50/70 border-b border-indigo-100/70">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>معماری و چرخه ارسال هوشمند پیام‌ها:</span>
            </h4>
            <span className="text-2xs text-slate-500">حفاظت چندلایه از اکانت در برابر قوانین تلگرام</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center mx-auto mb-1 text-2xs">۱</span>
              <strong className="block text-slate-800 text-2xs">دریافت از مبدأ</strong>
              <p className="text-3xs text-slate-500 mt-0.5">شنود مداوم کانال‌ها و استخراج محتوا</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center mx-auto mb-1 text-2xs">۲</span>
              <strong className="block text-slate-800 text-2xs">فیلتر و پاک‌سازی</strong>
              <p className="text-3xs text-slate-500 mt-0.5">حذف لینک‌ها، ایدی‌ها و کلمات ممنوعه</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center mx-auto mb-1 text-2xs">۳</span>
              <strong className="block text-slate-800 text-2xs">محاسبه تاخیر و جیتر</strong>
              <p className="text-3xs text-slate-500 mt-0.5">ایجاد وقفه تصادفی جهت شبیه‌سازی رفتار انسان</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center mx-auto mb-1 text-2xs">۴</span>
              <strong className="block text-slate-800 text-2xs">بررسی ساعات سکوت</strong>
              <p className="text-3xs text-slate-500 mt-0.5">رزرو پیام‌های شبانه برای اول صبح بدون ریزش</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center mx-auto mb-1 text-2xs">۵</span>
              <strong className="block text-slate-800 text-2xs">ارسال ایمن به مقصد</strong>
              <p className="text-3xs text-slate-500 mt-0.5">تحویل تک‌نخی با فواصل مطمئن به مقصد</p>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`mx-6 mt-4 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
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

      {/* Telegram FloodWait Warning Banner */}
      {stats.floodWaitActiveUntil && (
        <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>وقوع FloodWait تلگرام:</strong> به دلیل ارسال‌های قبلی، تلگرام وقفه اعلام کرده است. ارسال پیام‌ها تا{' '}
              <code className="font-bold">{new Date(stats.floodWaitActiveUntil).toLocaleTimeString('fa-IR')}</code> متوقف می‌ماند و سپس به صورت کاملاً خودکار بدون از دست رفتن هیچ پیامی از سر گرفته خواهد شد.
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 text-2xs font-bold">
            محافظت هوشمند
          </span>
        </div>
      )}

      {/* Settings Panel Drawer */}
      {showSettingsDrawer && (
        <form onSubmit={handleSaveSettings} className="p-5 bg-slate-50 border-b border-slate-200 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>پیکربندی هوشمند تاخیر، جیتر و ساعات سکوت</span>
              </h3>
              <p className="text-2xs text-slate-500 mt-0.5">
                تنظیمات به محض ذخیره در دیتابیس پایدار ذخیره شده و روی تمام پیام‌های جدید اعمال می‌شوند.
              </p>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-2xs font-bold text-slate-500">پروفایل‌های پیشنهادی:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset('safe')}
                className="px-2.5 py-1 rounded-lg text-2xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
              >
                🛡️ امن (ضدبلاک)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('standard')}
                className="px-2.5 py-1 rounded-lg text-2xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
              >
                ⚖️ استاندارد
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('fast')}
                className="px-2.5 py-1 rounded-lg text-2xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition"
              >
                ⚡ سریع
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Min Delay */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>حداقل تاخیر</span>
                <span className="text-2xs font-mono text-indigo-600">{settings.minDelaySeconds} ثانیه</span>
              </label>
              <input
                type="number"
                min="1"
                max="300"
                value={settings.minDelaySeconds}
                onChange={e => setSettings({ ...settings, minDelaySeconds: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold"
              />
              <span className="text-3xs text-slate-400 block">حداقل زمان انتظار پیام قبل از ارسال</span>
            </div>

            {/* Max Delay */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>حداکثر تاخیر (جیتر تصادفی)</span>
                <span className="text-2xs font-mono text-indigo-600">{settings.maxDelaySeconds} ثانیه</span>
              </label>
              <input
                type="number"
                min="1"
                max="600"
                value={settings.maxDelaySeconds}
                onChange={e => setSettings({ ...settings, maxDelaySeconds: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold"
              />
              <span className="text-3xs text-slate-400 block">تاخیر تصادفی بین حداقل و حداکثر برای فریب الگوریتم اسپم</span>
            </div>

            {/* Min Interval */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>فاصله امن بین هر ۲ ارسال</span>
                <span className="text-2xs font-mono text-indigo-600">{settings.minIntervalSeconds} ثانیه</span>
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.minIntervalSeconds}
                onChange={e => setSettings({ ...settings, minIntervalSeconds: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold"
              />
              <span className="text-3xs text-slate-400 block">جلوگیری قطعی از ارسال رگباری و چندتایی</span>
            </div>

            {/* Max Per Min */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>سقف مجاز ارسال در دقیقه</span>
                <span className="text-2xs font-mono text-indigo-600">{settings.maxMessagesPerMinute} پیام</span>
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.maxMessagesPerMinute}
                onChange={e => setSettings({ ...settings, maxMessagesPerMinute: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold"
              />
              <span className="text-3xs text-slate-400 block">توقف خودکار در صورت عبور از سقف در دقیقه</span>
            </div>
          </div>

          {/* Silent Hours Section */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-3 space-x-reverse">
                <input
                  type="checkbox"
                  id="silentHoursToggle"
                  checked={settings.silentHoursEnabled}
                  onChange={e => setSettings({ ...settings, silentHoursEnabled: e.target.checked })}
                  className="w-4 h-4 rounded-md text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="silentHoursToggle" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span>فعال‌سازی ساعات سکوت شبانه (Silent Hours)</span>
                </label>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <span className="text-xs font-medium text-slate-600">شروع:</span>
                <input
                  type="time"
                  disabled={!settings.silentHoursEnabled}
                  value={settings.silentHoursStart}
                  onChange={e => setSettings({ ...settings, silentHoursStart: e.target.value })}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold disabled:opacity-40"
                />
                <span className="text-xs font-medium text-slate-600">پایان:</span>
                <input
                  type="time"
                  disabled={!settings.silentHoursEnabled}
                  value={settings.silentHoursEnd}
                  onChange={e => setSettings({ ...settings, silentHoursEnd: e.target.value })}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold disabled:opacity-40"
                />
                <span className="text-2xs text-slate-400 font-medium">(تهران +03:30)</span>
              </div>
            </div>
            <p className="text-2xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              💡 <strong>نحوه کار ساعات سکوت:</strong> پیام‌هایی که در این بازه از کانال‌های مبدا منتشر شوند هرگز دور ریخته نمی‌شوند؛ بلکه سیستم آنها را ذخیره کرده و ساعت ارسالشان را به پایان زمان سکوت (مثلاً ساعت 07:00 صبح) موکول می‌نماید تا اعضای کانال در خواب آزرده نشوند.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setShowSettingsDrawer(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-xs transition"
            >
              {isSavingSettings ? 'در حال ذخیره‌سازی...' : 'ذخیره تنظیمات صف'}
            </button>
          </div>
        </form>
      )}

      {/* Modern High-Scannable 6-Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-x-reverse divide-slate-100 border-b border-slate-100 bg-slate-50/40">
        {/* Total In Queue */}
        <div className="p-4 text-center">
          <span className="text-2xs font-bold text-slate-500 block mb-1">کل پیام‌های صف</span>
          <span className="text-xl font-black text-slate-800">
            {stats.totalQueued.toLocaleString('fa-IR')}
          </span>
          <span className="text-3xs text-slate-400 block mt-0.5 font-medium">
            {stats.isQueuePaused ? 'متوقف‌شده' : 'در گردش فعال'}
          </span>
        </div>

        {/* Scheduled / Waiting */}
        <div className="p-4 text-center">
          <span className="text-2xs font-bold text-amber-600 block mb-1">در انتظار زمان‌بندی</span>
          <span className="text-xl font-black text-amber-600">
            {stats.scheduledCount.toLocaleString('fa-IR')}
          </span>
          <span className="text-3xs text-slate-400 block mt-0.5 truncate">
            {stats.nextScheduledItemTime ? formatScheduledTime(stats.nextScheduledItemTime) : 'موردی نیست'}
          </span>
        </div>

        {/* Sending Now */}
        <div className="p-4 text-center">
          <span className="text-2xs font-bold text-blue-600 block mb-1">در حال ارسال</span>
          <span className="text-xl font-black text-blue-600">
            {stats.sendingCount.toLocaleString('fa-IR')}
          </span>
          <span className="text-3xs text-blue-500 block mt-0.5">
            تک‌نخی (Concurrency: 1)
          </span>
        </div>

        {/* Sent Successfully */}
        <div className="p-4 text-center">
          <span className="text-2xs font-bold text-emerald-600 block mb-1">ارسال‌شده (Sent)</span>
          <span className="text-xl font-black text-emerald-600">
            {stats.sentCount.toLocaleString('fa-IR')}
          </span>
          <span className="text-3xs text-emerald-600/70 block mt-0.5 font-medium">
            موفق در کانال مقصد
          </span>
        </div>

        {/* Failed */}
        <div className="p-4 text-center">
          <span className="text-2xs font-bold text-rose-600 block mb-1">ناموفق (Failed)</span>
          <span className="text-xl font-black text-rose-600">
            {stats.failedCount.toLocaleString('fa-IR')}
          </span>
          <span className="text-3xs text-rose-500 block mt-0.5 font-medium">
            {stats.failedCount > 0 ? 'نیاز به بررسی' : 'بدون خطا'}
          </span>
        </div>

        {/* Current Rate */}
        <div className="p-4 text-center">
          <span className="text-2xs font-bold text-indigo-600 block mb-1">نرخ ارسال زنده</span>
          <span className="text-xl font-black text-indigo-700">
            {stats.currentRatePerMinute}
          </span>
          <span className="text-3xs text-slate-400 block mt-0.5 font-medium">
            پیام / دقیقه (سقف: {settings.maxMessagesPerMinute})
          </span>
        </div>
      </div>

      {/* Filter Tabs & Quick Search */}
      <div className="px-5 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white">
        <div className="flex items-center space-x-1 space-x-reverse text-xs overflow-x-auto no-scrollbar">
          {[
            { key: 'all', label: 'همه', count: items.length },
            { key: 'scheduled', label: 'زمان‌بندی‌شده', count: stats.scheduledCount },
            { key: 'sending', label: 'در حال ارسال', count: stats.sendingCount },
            { key: 'sent', label: 'ارسال‌شده', count: stats.sentCount },
            { key: 'failed', label: 'خطادار', count: stats.failedCount },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 ${
                statusFilter === f.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-2xs font-mono font-bold ${
                  statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="جستجو در متن یا شناسه..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Queue Items Table */}
      <div className="overflow-x-auto">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-300">
              <Clock className="w-6 h-6 stroke-1" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600">هیچ پیامی در این وضعیت صف وجود ندارد.</p>
              <p className="text-2xs text-slate-400 mt-0.5">
                {searchQuery ? 'جستجو با این عبارت نتیجه‌ای در بر نداشت.' : 'پیام‌های جدید دریافتی از کانال‌های مبدا در اینجا لیست خواهند شد.'}
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                <th className="py-3 px-4">شناسه</th>
                <th className="py-3 px-4">کانال مبدأ</th>
                <th className="py-3 px-4">محتوا / رسانه</th>
                <th className="py-3 px-4">زمان ارسال هدف</th>
                <th className="py-3 px-4">وضعیت</th>
                <th className="py-3 px-4">تلاش‌ها و خطا</th>
                <th className="py-3 px-4 text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition">
                  {/* Message ID */}
                  <td className="py-3 px-4 font-mono text-2xs text-slate-500 font-bold">
                    #{item.originalMessageId}
                  </td>

                  {/* Source Channel */}
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-800 block truncate max-w-[180px]">
                      {item.sourceChannelTitle || item.sourceChannelUsername || item.sourceChannelId}
                    </span>
                    {item.sourceChannelUsername && (
                      <span className="text-2xs text-slate-400 font-mono block mt-0.5">
                        @{item.sourceChannelUsername}
                      </span>
                    )}
                  </td>

                  {/* Content & Media Badge */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="p-1 rounded-md bg-slate-100 text-slate-600 shrink-0">
                        {getMediaIcon(item.mediaType)}
                      </span>
                      <span className="text-2xs text-slate-700 font-medium truncate max-w-[200px]">
                        {item.messageText || item.formattedText || item.mediaMetadata?.caption || `[فایل ${item.mediaType || 'چندرسانه‌ای'}]`}
                      </span>
                    </div>
                  </td>

                  {/* Scheduled Target Time */}
                  <td className="py-3 px-4 text-slate-600 font-medium">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-indigo-700">{formatScheduledTime(item.scheduledTime)}</span>
                    </div>
                    <span className="block text-2xs text-slate-400 font-mono mt-0.5">
                      {new Date(item.scheduledTime).toLocaleTimeString('fa-IR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-4">
                    {getStatusBadge(item.status)}
                  </td>

                  {/* Attempts & Last Error */}
                  <td className="py-3 px-4">
                    <span className="text-2xs font-mono text-slate-500 block">
                      تلاش: {item.attemptsCount}
                    </span>
                    {item.lastError && (
                      <span className="text-2xs text-rose-600 font-medium block max-w-xs truncate mt-0.5" title={item.lastError}>
                        {item.lastError}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-left">
                    <div className="flex items-center justify-end gap-1">
                      {/* Preview Content */}
                      <button
                        onClick={() => setPreviewItem(item)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="مشاهده جزئیات پیام"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Instant Send for Scheduled items */}
                      {item.status === 'scheduled' && (
                        <button
                          onClick={() => handleSendNow(item.id)}
                          disabled={actionInProgressId === item.id}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="ارسال فوری همین حالا"
                        >
                          <Zap className={`w-3.5 h-3.5 ${actionInProgressId === item.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="حذف از صف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation Modal for Clear All Queue */}
      {confirmClearAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 text-right">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-slate-800">آیا از تخلیه کامل صف اطمینان دارید؟</h3>
              <p className="text-xs text-slate-500">
                این عملیات تعداد <strong>{stats.totalQueued} پیام</strong> در انتظار و زمان‌بندی‌شده را از صف حذف می‌کند. پیام‌های جدید مجدداً از کانال‌ها دریافت خواهند شد.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearAllModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleClearAllQueue}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-xs transition"
              >
                بله، تخلیه کامل صف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
                  {getMediaIcon(previewItem.mediaType)}
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-800">
                    پست #{previewItem.originalMessageId} از {previewItem.sourceChannelTitle || previewItem.sourceChannelUsername}
                  </h3>
                  <span className="text-2xs text-slate-400">
                    زمان برنامه‌ریزی: {new Date(previewItem.scheduledTime).toLocaleString('fa-IR')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-2xs font-bold text-slate-500 block">محتوای پردازش‌شده متن پیام:</label>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs font-sans text-slate-800 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                {previewItem.formattedText || previewItem.messageText || previewItem.mediaMetadata?.caption || 'این پیام فاقد متن است (صرفاً فایل چندرسانه‌ای).'}
              </div>
            </div>

            {previewItem.mediaMetadata?.removedItems && previewItem.mediaMetadata.removedItems.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-2xs text-amber-800">
                <strong>موارد پاکسازی‌شده خودکار:</strong> {previewItem.mediaMetadata.removedItems.join('، ')}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
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
