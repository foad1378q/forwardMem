import React from 'react';
import { SystemStats } from '../types';
import { Radio, Zap, ShieldCheck, Clock, CheckCircle2, AlertTriangle, Layers, FilterX } from 'lucide-react';

interface StatsOverviewProps {
  stats: SystemStats;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  const formatUptime = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hours > 0) return `${hours} ساعت و ${mins} دقیقه`;
    return `${mins} دقیقه`;
  };

  const filteredOrUnsentCount = stats.filteredMessages ?? stats.unsentMessages ?? stats.failedMessages ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Monitored Channels Card */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 shadow-xl shadow-slate-200/50 flex items-center justify-between transition duration-300 hover:shadow-2xl hover:shadow-blue-500/10">
        <div>
          <span className="text-xs font-semibold text-slate-500 block mb-1">کانال‌های مانیتور شده</span>
          <div className="flex items-baseline space-x-2 space-x-reverse">
            <span className="text-2xl font-black text-slate-900">{stats.activeSources}</span>
            <span className="text-xs text-slate-400 font-medium">از {stats.totalSources} کانال</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
          <Radio className="w-6 h-6 animate-pulse" />
        </div>
      </div>

      {/* Total Messages Transferred */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 shadow-xl shadow-slate-200/50 flex items-center justify-between transition duration-300 hover:shadow-2xl hover:shadow-emerald-500/10">
        <div>
          <span className="text-xs font-semibold text-slate-500 block mb-1">کل پیام‌های منتقل‌شده</span>
          <div className="flex items-baseline space-x-2 space-x-reverse">
            <span className="text-2xl font-black text-emerald-600">{stats.totalTransferred.toLocaleString('fa-IR')}</span>
            <span className="text-xs text-emerald-600/80 font-medium">پست</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
          <Zap className="w-6 h-6" />
        </div>
      </div>

      {/* Filtered and Unsent Messages Card */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 shadow-xl shadow-slate-200/50 flex items-center justify-between transition duration-300 hover:shadow-2xl hover:shadow-rose-500/10">
        <div>
          <span className="text-xs font-semibold text-slate-500 block mb-1">پیام‌های فیلتر شده و ارسال‌نشده</span>
          <div className="flex items-baseline space-x-2 space-x-reverse">
            <span className="text-2xl font-black text-rose-600">{filteredOrUnsentCount.toLocaleString('fa-IR')}</span>
            <span className="text-xs text-rose-600/80 font-medium">پست رد/مسدود</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm">
          <FilterX className="w-6 h-6" />
        </div>
      </div>

      {/* Connection Status */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 shadow-xl shadow-slate-200/50 flex items-center justify-between transition duration-300 hover:shadow-2xl hover:shadow-amber-500/10">
        <div>
          <span className="text-xs font-semibold text-slate-500 block mb-1">ارتباط GramJS تلگرام</span>
          <div className="flex items-center space-x-1.5 space-x-reverse mt-1">
            {stats.botStatus === 'connected' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-emerald-600">🟢 متصل و آماده</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-xs font-bold text-amber-600">🟡 در حال اتصال</span>
              </>
            )}
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
          <ShieldCheck className="w-6 h-6" />
        </div>
      </div>

      {/* Uptime */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 shadow-xl shadow-slate-200/50 flex items-center justify-between transition duration-300 hover:shadow-2xl hover:shadow-purple-500/10">
        <div>
          <span className="text-xs font-semibold text-slate-500 block mb-1">زمان فعالیت آنلاین</span>
          <span className="text-xs font-bold text-purple-700 block mt-1">
            {formatUptime(stats.uptimeSeconds)}
          </span>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-sm">
          <Clock className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
