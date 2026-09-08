import React, { useState } from 'react';
import { ActivityLog } from '../types';
import { clearLogs } from '../lib/telegramApi';
import { formatTehranTime, formatTehranDateTime } from '../lib/timeUtils';
import {
  ScrollText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Info,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface LogsPanelProps {
  logs: ActivityLog[];
  onRefresh: () => void;
  isAdmin: boolean;
  onRequireLogin: () => void;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({
  logs,
  onRefresh,
  isAdmin,
  onRequireLogin,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isClearing, setIsClearing] = useState(false);

  const handleClear = async () => {
    if (!isAdmin) {
      onRequireLogin();
      return;
    }
    if (!window.confirm('آیا از پاکسازی تمام لاگ‌های سیستم اطمینان دارید؟')) return;

    setIsClearing(true);
    try {
      await clearLogs();
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    if (
      searchTerm &&
      !log.sourceTitle.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !log.sourceUsername.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !log.details.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const getStatusBadge = (status: ActivityLog['status']) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center space-x-1 space-x-reverse bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>موفق</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center space-x-1 space-x-reverse bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>خطا</span>
          </span>
        );
      case 'duplicate':
      case 'skipped':
        return (
          <span className="inline-flex items-center space-x-1 space-x-reverse bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">
            <Filter className="w-3 h-3 text-amber-600" />
            <span>فیلتر / تکراری</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 space-x-reverse bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">
            <Info className="w-3 h-3 text-slate-500" />
            <span>اطلاعات</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 shadow-xl shadow-slate-200/50 space-y-4 transition duration-300 hover:shadow-2xl hover:shadow-blue-500/10">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="cursor-pointer group flex items-start space-x-3 space-x-reverse"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-105 transition">
            <ScrollText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2 space-x-reverse group-hover:text-blue-600 transition flex-wrap gap-y-1">
              <span>تاریخچه و لاگ‌های انتقال خودکار GramJS</span>
              <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full border border-slate-200 font-mono">
                {logs.length}
              </span>
              <span className="bg-blue-50 text-blue-700 text-[10px] font-medium px-2 py-0.5 rounded-full border border-blue-200">
                ساعت تهران (+03:30)
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              گزارش واقعی فروارد پیام‌ها، فیلتر کلمات کلیدی، جلوگیری از ارسال تکراری و خطاهای سیستم
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse shrink-0">
          <button
            onClick={onRefresh}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs transition border border-slate-200"
            title="به‌روزرسانی لاگ‌ها"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {logs.length > 0 && isExpanded && (
            <button
              onClick={handleClear}
              disabled={isClearing}
              className="flex items-center space-x-1.5 space-x-reverse px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>پاکسازی</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1.5 space-x-reverse px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition shadow-sm"
          >
            {isExpanded ? (
              <>
                <span>بستن پنل</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>مشاهده لاگ‌ها</span>
                <ChevronDown className="w-4 h-4 animate-bounce" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Content Section */}
      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-slate-100 animate-fadeIn">
          {/* Filters & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجو در لاگ‌ها (نام کانال، جزئیات، شماره پست)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-3.5 pl-9 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <div className="flex items-center space-x-1 space-x-reverse bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                همه ({logs.length})
              </button>
              <button
                onClick={() => setFilterStatus('success')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  filterStatus === 'success'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                موفق
              </button>
              <button
                onClick={() => setFilterStatus('error')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  filterStatus === 'error'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                خطاها
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/50">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                هیچ لاگی بر اساس فیلترهای انتخاب شده یافت نشد.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-200/60 text-xs">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 hover:bg-slate-100/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-right"
                  >
                    <div className="flex items-start space-x-2 space-x-reverse">
                      <div className="mt-0.5">{getStatusBadge(log.status)}</div>
                      <div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="font-bold text-slate-800 text-xs">{log.sourceTitle}</span>
                          <span className="text-[10px] text-blue-600 font-mono dir-ltr">@{log.sourceUsername}</span>
                          {log.messageId > 0 && (
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                              #{log.messageId}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                          {log.details}
                        </p>
                      </div>
                    </div>

                    <div
                      className="text-[10px] text-slate-400 shrink-0 text-left dir-ltr flex items-center space-x-1 space-x-reverse self-end sm:self-center"
                      title={formatTehranDateTime(log.timestamp) + " (به وقت تهران)"}
                    >
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{formatTehranTime(log.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

