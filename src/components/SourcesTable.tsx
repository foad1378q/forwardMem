import React, { useState } from 'react';
import { SourceChannel } from '../types';
import { toggleSourceStatus, deleteSource, testForwardSource, testMonitoringSource } from '../lib/telegramApi';
import {
  Play,
  Pause,
  Trash2,
  Send,
  Eye,
  Radio,
  Users,
  Filter,
  X,
  Plus,
  Check,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Activity,
} from 'lucide-react';

interface SourcesTableProps {
  sources: SourceChannel[];
  onRefresh: () => void;
  onPreviewChannel: (source: SourceChannel) => void;
  onOpenAddModal: () => void;
  isAdmin: boolean;
  onRequireLogin: () => void;
}

export const SourcesTable: React.FC<SourcesTableProps> = ({
  sources,
  onRefresh,
  onPreviewChannel,
  onOpenAddModal,
  isAdmin,
  onRequireLogin,
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal States
  const [testSourceModal, setTestSourceModal] = useState<SourceChannel | null>(null);
  const [deleteSourceModal, setDeleteSourceModal] = useState<SourceChannel | null>(null);
  const [isPerformingAction, setIsPerformingAction] = useState<boolean>(false);

  // Per-Source Keyword Filter Modal State
  const [activeKeywordSource, setActiveKeywordSource] = useState<SourceChannel | null>(null);
  const [kwEnabled, setKwEnabled] = useState<boolean>(false);
  const [kwList, setKwList] = useState<string[]>([]);
  const [kwMode, setKwMode] = useState<'any' | 'all'>('any');
  const [kwInput, setKwInput] = useState<string>('');
  const [isSavingKw, setIsSavingKw] = useState<boolean>(false);

  // Open Keyword Modal
  const handleOpenKwModal = (source: SourceChannel) => {
    setActiveKeywordSource(source);
    setKwEnabled(!!source.enableKeywords);
    setKwList(source.keywords || []);
    setKwMode(source.keywordMatchMode || 'any');
    setKwInput('');
  };

  // Save Keyword Modal
  const handleSaveKwModal = async () => {
    if (!activeKeywordSource) return;
    if (!isAdmin) {
      onRequireLogin();
      return;
    }

    setIsSavingKw(true);
    try {
      const res = await fetch(`/api/sources/${activeKeywordSource.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enableKeywords: kwEnabled,
          keywords: kwList,
          keywordMatchMode: kwMode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMsg({
          text: `فیلتر کلمات کلیدی کانال @${activeKeywordSource.username} با موفقیت ذخیره شد.`,
          type: 'success',
        });
        setActiveKeywordSource(null);
        onRefresh();
      } else {
        setActionMsg({ text: data.message || 'خطا در ذخیره فیلتر کلمات کلیدی.', type: 'error' });
      }
    } catch (err) {
      setActionMsg({ text: 'خطا در برقراری ارتباط با سرور.', type: 'error' });
    } finally {
      setIsSavingKw(false);
    }
  };

  // Toggle Monitoring (Play / Pause)
  const handleToggleMonitoring = async (source: SourceChannel) => {
    if (!isAdmin) {
      onRequireLogin();
      return;
    }
    const nextStatus = source.status === 'active' ? 'paused' : 'active';
    setLoadingId(source.id);
    setActionMsg(null);
    try {
      const res = await toggleSourceStatus(source.id, nextStatus);
      if (res.success) {
        setActionMsg({
          text: `وضعیت مانیتورینگ کانال @${source.username} به ${
            nextStatus === 'active' ? '«فعال»' : '«متوقف شده»'
          } تغییر یافت.`,
          type: 'success',
        });
        onRefresh();
      } else {
        setActionMsg({ text: res.message || 'خطا در تغییر وضعیت مانیتورینگ.', type: 'error' });
      }
    } catch (err) {
      setActionMsg({ text: 'خطا در تغییر وضعیت مانیتورینگ.', type: 'error' });
    } finally {
      setLoadingId(null);
    }
  };

  // Test Monitoring Status & Identifier Resolution
  const handleTestMonitoring = async (source: SourceChannel) => {
    if (!isAdmin) {
      onRequireLogin();
      return;
    }

    setLoadingId(source.id);
    setActionMsg(null);

    try {
      const res = await testMonitoringSource(source.id);
      if (res.success) {
        setActionMsg({
          text: res.message || `مانیتورینگ کانال @${source.username} تایید شد.`,
          type: 'success',
        });
        onRefresh();
      } else {
        setActionMsg({ text: res.message || 'خطا در تست مانیتورینگ کانال.', type: 'error' });
      }
    } catch (err) {
      setActionMsg({ text: 'خطا در برقراری ارتباط با سرور برای تست مانیتورینگ.', type: 'error' });
    } finally {
      setLoadingId(null);
    }
  };

  // Confirm Test Forward Execution
  const handleConfirmTestForward = async () => {
    if (!testSourceModal) return;
    if (!isAdmin) {
      onRequireLogin();
      return;
    }

    const source = testSourceModal;
    setIsPerformingAction(true);
    setActionMsg(null);

    try {
      const res = await testForwardSource(source.id);
      if (res.success) {
        setActionMsg({
          text: res.message || `آخرین پیام کانال @${source.username} با موفقیت به کانال مقصد ارسال شد.`,
          type: 'success',
        });
        setTestSourceModal(null);
        onRefresh();
      } else {
        setActionMsg({ text: res.message || 'خطا در ارسال پیام تست.', type: 'error' });
      }
    } catch (err) {
      setActionMsg({ text: 'خطا در اجرای تست ارسال پیام.', type: 'error' });
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Confirm Delete Execution
  const handleConfirmDelete = async () => {
    if (!deleteSourceModal) return;
    if (!isAdmin) {
      onRequireLogin();
      return;
    }

    const source = deleteSourceModal;
    setIsPerformingAction(true);
    setActionMsg(null);

    try {
      const res = await deleteSource(source.id);
      if (res.success) {
        setActionMsg({
          text: res.message || `کانال/گروه @${source.username} به صورت کامل و دائمی حذف گردید.`,
          type: 'success',
        });
        setDeleteSourceModal(null);
        onRefresh();
      } else {
        setActionMsg({ text: res.message || 'خطا در حذف کانال.', type: 'error' });
      }
    } catch (err) {
      setActionMsg({ text: 'خطا در برقراری ارتباط با سرور جهت حذف.', type: 'error' });
    } finally {
      setIsPerformingAction(false);
    }
  };

  return (
    <div
      className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-6 shadow-xl shadow-slate-200/50 space-y-6 relative overflow-hidden"
      id="monitored-sources-table"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800">کانال‌ها و گروه‌های مانیتور شده</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              مدیریت هوشمند منابع مبدأ، وضعیت مانیتورینگ لحظه‌ای، فیلتر کلمات و تست ارسال
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!isAdmin) {
              onRequireLogin();
              return;
            }
            onOpenAddModal();
          }}
          className="flex items-center justify-center space-x-2 space-x-reverse px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition self-start sm:self-auto shrink-0 active:scale-95"
          id="add-source-btn"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن کانال / گروه</span>
        </button>
      </div>

      {/* Global Notification Banner */}
      {actionMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between space-x-2 space-x-reverse ${
            actionMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center space-x-2 space-x-reverse">
            {actionMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{actionMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            className="text-slate-400 hover:text-slate-700 text-xs p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Empty State */}
      {sources.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto mb-4 shadow-sm">
            <Radio className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">هیچ کانال یا گروهی ثبت نشده است</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
            برای شروع مانیتورینگ و دریافت خودکار پیام‌ها، شناسه عمومی یک کانال یا گروه (مانند durov@) را اضافه کنید.
          </p>
          <button
            type="button"
            onClick={() => {
              if (!isAdmin) {
                onRequireLogin();
                return;
              }
              onOpenAddModal();
            }}
            className="inline-flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن کانال / گروه</span>
          </button>
        </div>
      ) : (
        /* Modern Clean Resource Management Table */
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs font-bold">
                <th className="py-3.5 px-4">کانال / گروه مبدأ</th>
                <th className="py-3.5 px-4">وضعیت مانیتورینگ</th>
                <th className="py-3.5 px-4">فیلتر اختصاصی</th>
                <th className="py-3.5 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sources.map((source) => {
                const isLoadingThis = loadingId === source.id;

                return (
                  <tr key={source.id} className="hover:bg-slate-50/80 transition group">
                    {/* Column 1: Source Channel / Group Info */}
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3 space-x-reverse">
                        {source.avatarUrl ? (
                          <img
                            src={source.avatarUrl}
                            alt={source.title}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-200/80 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0 shadow-2xs">
                            {source.type === 'group' ? <Users className="w-5 h-5" /> : source.title.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <span className="font-black text-slate-800 dark:text-slate-100 text-sm">{source.title}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                source.type === 'group'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                                  : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                              }`}
                            >
                              {source.type === 'group' ? 'گروه' : 'کانال'}
                            </span>
                          </div>
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] dir-ltr inline-block font-mono mt-0.5 font-semibold">
                            {source.username.startsWith('-') || /^\d+$/.test(source.username)
                              ? `🆔 آیدی عددی: ${source.username}`
                              : `@${source.username}`}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Connection Status */}
                    <td className="py-4 px-4">
                      {source.status === 'active' ? (
                        <div className="inline-flex items-center space-x-2 space-x-reverse bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl text-emerald-700 font-bold text-xs shadow-2xs">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                          <span>🟢 فعال / مانیتورینگ</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center space-x-2 space-x-reverse bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl text-amber-700 font-bold text-xs shadow-2xs">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                          <span>🟡 متوقف / غیرفعال</span>
                        </div>
                      )}
                    </td>

                    {/* Column 3: Per-Source Keyword Filter */}
                    <td className="py-4 px-4">
                      <button
                        type="button"
                        onClick={() => handleOpenKwModal(source)}
                        className={`inline-flex items-center space-x-1.5 space-x-reverse px-3 py-1.5 rounded-xl text-xs font-bold border transition duration-200 ${
                          source.enableKeywords && source.keywords?.length
                            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-2xs'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                        <span>
                          {source.enableKeywords && source.keywords?.length
                            ? `تنظیمات فیلتر (${source.keywords.length} کلمه)`
                            : 'تنظیمات فیلتر'}
                        </span>
                      </button>
                    </td>

                    {/* Column 4: Redesigned Operations Column (Modern Icon Buttons with Tooltips) */}
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center space-x-2 space-x-reverse">
                        {/* 1. Monitoring Toggle (Play / Pause) */}
                        <div className="relative group/btn">
                          <button
                            type="button"
                            onClick={() => handleToggleMonitoring(source)}
                            disabled={isLoadingThis}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl backdrop-blur-md border shadow-2xs transition duration-200 active:scale-95 disabled:opacity-50 ${
                              source.status === 'active'
                                ? 'bg-amber-50/90 hover:bg-amber-100/90 text-amber-700 border-amber-200/80'
                                : 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border-emerald-200/80'
                            }`}
                          >
                            {isLoadingThis ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                            ) : source.status === 'active' ? (
                              <Pause className="w-4 h-4 fill-amber-600" />
                            ) : (
                              <Play className="w-4 h-4 fill-emerald-600" />
                            )}
                          </button>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/btn:block z-30 px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
                            {source.status === 'active' ? 'توقف مانیتورینگ' : 'شروع مانیتورینگ'}
                          </div>
                        </div>

                        {/* 2. Test Forward */}
                        <div className="relative group/btn">
                          <button
                            type="button"
                            onClick={() => {
                              if (!isAdmin) {
                                onRequireLogin();
                                return;
                              }
                              setTestSourceModal(source);
                            }}
                            disabled={isLoadingThis}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50/90 hover:bg-blue-100/90 text-blue-600 border border-blue-200/80 shadow-2xs transition duration-200 active:scale-95 disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/btn:block z-30 px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
                            تست ارسال پیام
                          </div>
                        </div>

                        {/* 2.5. Test Monitoring */}
                        <div className="relative group/btn">
                          <button
                            type="button"
                            onClick={() => handleTestMonitoring(source)}
                            disabled={isLoadingThis}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-purple-50/90 hover:bg-purple-100/90 text-purple-600 border border-purple-200/80 shadow-2xs transition duration-200 active:scale-95 disabled:opacity-50"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/btn:block z-30 px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
                            تست مانیتورینگ کانال
                          </div>
                        </div>

                        {/* 3. Preview Messages */}
                        <div className="relative group/btn">
                          <button
                            type="button"
                            onClick={() => onPreviewChannel(source)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 border border-slate-200/80 shadow-2xs transition duration-200 active:scale-95"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/btn:block z-30 px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
                            پیش‌نمایش پیام‌ها
                          </div>
                        </div>

                        {/* 4. Delete Source */}
                        <div className="relative group/btn">
                          <button
                            type="button"
                            onClick={() => {
                              if (!isAdmin) {
                                onRequireLogin();
                                return;
                              }
                              setDeleteSourceModal(source);
                            }}
                            disabled={isLoadingThis}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-rose-50/90 hover:bg-rose-100/90 text-rose-600 border border-rose-200/80 shadow-2xs transition duration-200 active:scale-95 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/btn:block z-30 px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
                            حذف دائمی مبدأ
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal: Test Forward */}
      {testSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">تست ارسال پیام به کانال مقصد</h3>
                <p className="text-xs text-slate-500">منبع: @{testSourceModal.username}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              آیا از ارسال آخرین پیام موجود در کانال <strong>{testSourceModal.title}</strong> به کانال مقصد اطمینان دارید؟
            </p>

            <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2">
              <button
                type="button"
                onClick={() => setTestSourceModal(null)}
                disabled={isPerformingAction}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmTestForward}
                disabled={isPerformingAction}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition flex items-center space-x-1.5 space-x-reverse"
              >
                {isPerformingAction ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال ارسال...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>تایید و ارسال به کانال مقصد</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Source */}
      {deleteSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">حذف دائمی مبدأ مانیتورینگ</h3>
                <p className="text-xs text-rose-600 font-bold">@{deleteSourceModal.username}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-rose-50/50 p-3.5 rounded-2xl border border-rose-100">
              آیا از حذف دائمی کانال/گروه <strong>{deleteSourceModal.title}</strong> اطمینان دارید؟ با حذف این مبدأ، دریافت و پردازش خودکار پیام‌های آن به صورت کامل متوقف می‌گردد.
            </p>

            <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2">
              <button
                type="button"
                onClick={() => setDeleteSourceModal(null)}
                disabled={isPerformingAction}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isPerformingAction}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-500/20 transition flex items-center space-x-1.5 space-x-reverse"
              >
                {isPerformingAction ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال حذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>حذف دائمی مبدأ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-Source Keyword Filter Settings Modal */}
      {activeKeywordSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Filter className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">
                  فیلتر کلمات کلیدی اختصاصی @{activeKeywordSource.username}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveKeywordSource(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">فعال‌سازی فیلتر اختصاصی این کانال:</span>
              <button
                type="button"
                onClick={() => setKwEnabled(!kwEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  kwEnabled ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    kwEnabled ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">شرایط منطقی تطبیق کلمات:</span>
                <div className="flex items-center space-x-4 space-x-reverse text-xs text-slate-700 font-medium">
                  <label className="flex items-center space-x-1.5 space-x-reverse cursor-pointer">
                    <input
                      type="radio"
                      name="kwMode"
                      value="any"
                      checked={kwMode === 'any'}
                      onChange={() => setKwMode('any')}
                      className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>شامل حداقل یک کلمه (OR)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 space-x-reverse cursor-pointer">
                    <input
                      type="radio"
                      name="kwMode"
                      value="all"
                      checked={kwMode === 'all'}
                      onChange={() => setKwMode('all')}
                      className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>شامل تمام کلمات (AND)</span>
                  </label>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">افزودن کلمه کلیدی جدید:</span>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="text"
                    value={kwInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (kwInput.trim() && !kwList.includes(kwInput.trim())) {
                          setKwList([...kwList, kwInput.trim()]);
                          setKwInput('');
                        }
                      }
                    }}
                    placeholder="مثال: خبر، فوری، قیمت..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (kwInput.trim() && !kwList.includes(kwInput.trim())) {
                        setKwList([...kwList, kwInput.trim()]);
                        setKwInput('');
                      }
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 space-x-reverse"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                {kwList.length === 0 ? (
                  <span className="text-[11px] text-slate-400 p-1">هیچ کلمه کلیدی تعریف نشده است.</span>
                ) : (
                  kwList.map((k, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center space-x-1.5 space-x-reverse bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-medium border border-blue-200 shadow-2xs"
                    >
                      <span>{k}</span>
                      <button
                        type="button"
                        onClick={() => setKwList(kwList.filter((x) => x !== k))}
                        className="text-blue-400 hover:text-blue-800 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 space-x-reverse border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setActiveKeywordSource(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveKwModal}
                disabled={isSavingKw}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center space-x-1.5 space-x-reverse"
              >
                {isSavingKw ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال ذخیره...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>ذخیره تنظیمات فیلتر</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
