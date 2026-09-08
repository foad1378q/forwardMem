import React from 'react';
import { SystemStats } from '../types';
import {
  Radio,
  Zap,
  ShieldCheck,
  Clock,
  FilterX,
  Database,
  Bot,
  Layers,
  AlertTriangle,
  BellRing,
} from 'lucide-react';

interface StatsOverviewProps {
  stats: SystemStats;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  const formatUptime = (sec: number) => {
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (days > 0) return `${days} روز و ${hours} ساعت`;
    if (hours > 0) return `${hours} ساعت و ${mins} دقیقه`;
    return `${mins} دقیقه`;
  };

  const filteredCount = stats.filteredMessages ?? stats.unsentMessages ?? 0;
  const queueStats = stats.queueStats;

  return (
    <div className="space-y-4">
      {/* FloodWait Emergency Alert (if active) */}
      {queueStats?.floodWaitActiveUntil && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              <strong>وقوع محدودیت FloodWait تلگرام:</strong> ارسال به کانال مقصد تا ساعت{' '}
              <code>{new Date(queueStats.floodWaitActiveUntil).toLocaleTimeString('fa-IR')}</code> موقتاً متوقف گردیده و پس از اتمام زمان وقفه، ارسال‌ها به ترتیب صف ادامه می‌یابد.
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 text-2xs font-bold shrink-0">
            حفاظت هوشمند صف
          </span>
        </div>
      )}

      {/* Main 5-Card Metric Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Monitored Channels Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between transition hover:border-slate-300">
          <div>
            <span className="text-2xs font-bold text-slate-400 block mb-1">کانال‌های مانیتورینگ</span>
            <div className="flex items-baseline space-x-2 space-x-reverse">
              <span className="text-2xl font-black text-slate-800">{stats.activeSources}</span>
              <span className="text-2xs text-slate-400 font-medium">از {stats.totalSources} کانال</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* Transferred Messages Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between transition hover:border-slate-300">
          <div>
            <span className="text-2xs font-bold text-slate-400 block mb-1">پیام‌های ارسال‌شده</span>
            <div className="flex items-baseline space-x-2 space-x-reverse">
              <span className="text-2xl font-black text-emerald-600">
                {stats.totalTransferred.toLocaleString('fa-IR')}
              </span>
              <span className="text-2xs text-emerald-600/80 font-medium">پست</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Zap className="w-6 h-6" />
          </div>
        </div>

        {/* Filtered Messages Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between transition hover:border-slate-300">
          <div>
            <span className="text-2xs font-bold text-slate-400 block mb-1">فیلتر / مسدود شده</span>
            <div className="flex items-baseline space-x-2 space-x-reverse">
              <span className="text-2xl font-black text-rose-600">
                {filteredCount.toLocaleString('fa-IR')}
              </span>
              <span className="text-2xs text-rose-600/80 font-medium">رد شده</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <FilterX className="w-6 h-6" />
          </div>
        </div>

        {/* Persistent Queue Status Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between transition hover:border-slate-300">
          <div>
            <span className="text-2xs font-bold text-slate-400 block mb-1">صف ارسال هوشمند</span>
            <div className="flex items-baseline space-x-2 space-x-reverse">
              <span className="text-2xl font-black text-indigo-600">
                {(queueStats?.totalQueued ?? 0).toLocaleString('fa-IR')}
              </span>
              <span className="text-2xs text-indigo-600/80 font-medium">در صف</span>
            </div>
            {queueStats?.currentRatePerMinute !== undefined && (
              <span className="text-3xs text-slate-400 font-mono mt-0.5 block">
                نرخ: {queueStats.currentRatePerMinute} پ/دقیقه
              </span>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Uptime Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between transition hover:border-slate-300">
          <div>
            <span className="text-2xs font-bold text-slate-400 block mb-1">مدت زمان آنلاین (Uptime)</span>
            <span className="text-xs font-bold text-purple-700 block mt-1 font-mono">
              {formatUptime(stats.uptimeSeconds)}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* System Infrastructure Health Strip */}
      <div className="bg-slate-900 text-white rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-bold">سلامت زیرساخت و ارتباطات سیستم:</span>
        </div>

        <div className="flex items-center flex-wrap gap-4 text-2xs font-bold">
          {/* Telegram Client Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-normal">اکانت تلگرام:</span>
            {stats.gramStatus === 'connected' && stats.telegramClientConnected ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                متصل و مانیتورینگ فعال
              </span>
            ) : stats.gramStatus === 'connecting' ? (
              <span className="text-amber-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                در حال اتصال...
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                قطع شده
              </span>
            )}
          </div>

          {/* Telegram Bot Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-normal">ربات تلگرام:</span>
            {stats.botStatus === 'connected' ? (
              <span className="text-emerald-400">🟢 فعال</span>
            ) : (
              <span className="text-slate-400">⚪ تنظیم نشده</span>
            )}
          </div>

          {/* Database Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-normal">پایگاه داده:</span>
            {stats.databaseConnected ? (
              <span className="text-emerald-400">🟢 PostgreSQL متصل</span>
            ) : (
              <span className="text-amber-400">🟡 دیتابیس لوکال</span>
            )}
          </div>

          {/* Report Group Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-normal">گروه هشدارها:</span>
            {stats.reportGroupConfig?.status === 'active' ? (
              <span className="text-emerald-400">🟢 متصل</span>
            ) : (
              <span className="text-slate-400">⚪ غیرفعال</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
