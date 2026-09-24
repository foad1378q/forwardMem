import React from 'react';
import { SystemStats } from '../types';
import { SystemHealthDashboard } from './SystemHealthDashboard';
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
  Megaphone,
  Sparkles,
  TrendingUp,
  Activity,
} from 'lucide-react';

interface StatsOverviewProps {
  stats: SystemStats;
  onNavigateToEngagement?: () => void;
  onNavigateToAdBanner?: () => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  stats,
  onNavigateToEngagement,
  onNavigateToAdBanner,
}) => {
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
  const hourlyData = stats.hourlyActivity || [];
  const maxHourlyCount = Math.max(1, ...hourlyData.map((d) => d.count + (d.failedCount || 0)));

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

      {/* Main Metric Cards Grid (5 Core Metrics) */}
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

      {/* Secondary Row: Sponsored Ad Banner & Glass Buttons KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ad Banner & Glass Buttons KPI Card */}
        <div
          onClick={onNavigateToAdBanner}
          className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between transition hover:border-amber-300 hover:shadow-sm cursor-pointer group"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold text-slate-400">بنر و تبلیغات اسپانسر</span>
              <span className="px-2 py-0.2 rounded-full bg-amber-50 text-amber-700 text-3xs font-black">
                اسپانسر هوشمند
              </span>
            </div>
            <div className="flex items-baseline space-x-2 space-x-reverse">
              <span className="text-2xl font-black text-amber-600">
                {(stats.totalAdsSent || 0).toLocaleString('fa-IR')}
              </span>
              <span className="text-2xs text-slate-500 font-medium">
                بنر منتشر شده ({stats.postsSinceLastAd || 0} پست از آخرین تبلیغ)
              </span>
            </div>
            <p className="text-3xs text-slate-400">
              ارسال زمان‌بندی شده بنر آپلود شده همراه با دکمه‌های شیشه‌ای تعاملی
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-110 transition">
            <Megaphone className="w-6 h-6 text-amber-600" />
          </div>
        </div>

        {/* Telegram Destination & Bot Status Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold text-slate-400">وضعیت اتصال و کانال مقصد</span>
              <span className={`px-2 py-0.2 rounded-full text-3xs font-black ${
                stats.destinationVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
              }`}>
                {stats.destinationVerified ? 'متصل و فعال' : 'در انتظار اتصال'}
              </span>
            </div>
            <div className="flex items-baseline space-x-2 space-x-reverse">
              <span className="text-lg font-black text-slate-800 font-mono">
                {stats.botConnected ? 'ربات تلگرام آماده' : 'در حال همگام‌سازی'}
              </span>
            </div>
            <p className="text-3xs text-slate-400">
              پایش بلادرنگ صف ارسال، اتصال کلاینت و ربات به کانال هدف
            </p>
          </div>
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
            stats.destinationVerified
              ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
              : 'bg-slate-50 border-slate-200 text-slate-400'
          }`}>
            <Zap className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Real-time D3.js System Health & Node Telemetry Dashboard */}
      <SystemHealthDashboard initialMetrics={stats.healthMetrics} />

      {/* 24-Hour Activity Distribution Chart */}
      {hourlyData.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">
                توزیع حجم ارسال پیام‌ها در ۲۴ ساعت گذشته
              </span>
            </div>
            <span className="text-3xs text-slate-400">
              بازه ۳ ساعته • میانگین حجم ترافیک
            </span>
          </div>

          <div className="h-28 flex items-end justify-between gap-2 pt-4 px-2 border-b border-slate-100 pb-2">
            {hourlyData.map((pt, idx) => {
              const total = pt.count + (pt.failedCount || 0);
              const heightPercent = Math.max(8, Math.round((total / maxHourlyCount) * 100));
              const successHeight = total > 0 ? Math.round((pt.count / total) * 100) : 100;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-10 bg-slate-900 text-white px-2 py-1 rounded-lg text-3xs font-mono opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10 shadow-md">
                    ساعت {pt.hour}: {pt.count} ارسال موفق {pt.failedCount ? `(${pt.failedCount} خطا)` : ''}
                  </div>

                  {/* Stacked Bar */}
                  <div
                    className="w-full max-w-[28px] rounded-t-lg bg-emerald-500 transition-all group-hover:brightness-110"
                    style={{ height: `${heightPercent}%` }}
                  >
                    {pt.failedCount > 0 && (
                      <div
                        className="w-full bg-rose-500 rounded-t-lg"
                        style={{ height: `${100 - successHeight}%` }}
                      />
                    )}
                  </div>

                  <span className="text-3xs font-mono text-slate-400 group-hover:text-slate-800 transition">
                    {pt.hour}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-3xs text-slate-500 pt-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span>ارسال موفق</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                <span>خطا یا مسدود</span>
              </div>
            </div>
            <span className="font-mono">پیک ترافیک: {maxHourlyCount} پیام</span>
          </div>
        </div>
      )}

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
