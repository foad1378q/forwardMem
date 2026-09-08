import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Upload,
  CheckCircle2,
  FileCode,
  ShieldAlert,
  ShieldCheck,
  HardDrive,
  Clock,
  RefreshCw,
  Send,
} from 'lucide-react';
import { formatTehranDateTime } from '../lib/timeUtils';

interface DatabaseManagementCardProps {
  onRefreshAll?: () => void;
}

export const DatabaseManagementCard: React.FC<DatabaseManagementCardProps> = ({ onRefreshAll }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [testingTelegramBackup, setTestingTelegramBackup] = useState<boolean>(false);
  const [includeSecrets, setIncludeSecrets] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [destinationChannel, setDestinationChannel] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load last backup time and destination from db status
    const checkBackupStatus = async () => {
      try {
        const res = await fetch('/api/setup/status');
        const data = await res.json();
        if (data?.lastBackupTime) {
          setLastBackupTime(data.lastBackupTime);
        }
        if (data?.destinationChannel) {
          setDestinationChannel(data.destinationChannel);
        }
      } catch (err) {
        // silent
      }
    };
    checkBackupStatus();
  }, []);

  const handleBackupToTelegram = async () => {
    try {
      setTestingTelegramBackup(true);
      setMessage(null);
      const res = await fetch('/api/admin/backup-to-telegram', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.lastBackupTime) setLastBackupTime(data.lastBackupTime);
        setMessage({
          type: 'success',
          text: data.message || 'فایل بک‌آپ دیتابیس با موفقیت ایجاد و به کانال/گروه مقصد تلگرام ارسال گردید.',
        });
      } else {
        setMessage({
          type: 'error',
          text: data.message || 'خطا در ارسال بک‌آپ به تلگرام.',
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'خطای ارتباط با سرور: ' + err.message });
    } finally {
      setTestingTelegramBackup(false);
    }
  };

  const handleBackupNow = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const url = `/api/admin/backup?includeSecrets=${includeSecrets ? 'true' : 'false'}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('خطا در دریافت پشتیبان');

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `backup_${includeSecrets ? 'with_secrets_' : ''}${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      const now = new Date().toISOString();
      setLastBackupTime(now);
      setMessage({
        type: 'success',
        text: `فایل پشتیبان با موفقیت ایجاد و دانلود شد. (${includeSecrets ? 'همراه با توکن‌ها و کلیدهای حساس' : 'بدون اطلاعات حساس'})`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'خطا در پشتیبان‌گیری: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleExportSql = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const url = `/api/admin/database/export-sql?includeSecrets=${includeSecrets ? 'true' : 'false'}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('خطا در استخراج فایل SQL');

      const text = await res.text();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `database_dump_${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setMessage({ type: 'success', text: 'اسکریپت SQL با موفقیت دانلود شد.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'خطا در استخراج SQL: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDump = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch('/api/admin/backup-dump');
      if (!res.ok) throw new Error('خطا در دریافت فایل backup.dump از سرور');

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      a.download = `backup_${dateStamp}.dump`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setMessage({ type: 'success', text: `فایل رسمی backup_${dateStamp}.dump با موفقیت دانلود شد.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'خطا در دانلود فایل: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setMessage(null);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          let payload: any;
          if (file.name.endsWith('.sql')) {
            payload = { sqlDump: content };
          } else {
            payload = JSON.parse(content);
          }

          const res = await fetch('/api/admin/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data.success) {
            setMessage({
              type: 'success',
              text: data.message || `فایل ${file.name} با موفقیت بازنشانی شد و تمام کانال‌ها و تنظیمات لود شدند.`,
            });
            if (onRefreshAll) onRefreshAll();
          } else {
            setMessage({ type: 'error', text: data.message || 'خطا در بازنشانی داده‌ها' });
          }
        } catch (err: any) {
          setMessage({
            type: 'error',
            text: 'فایل انتخابی ساختار معتبری ندارد. لطفاً فایل backup.dump یا .json معتبر انتخاب کنید.',
          });
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'خطا در خواندن فایل: ' + err.message });
      setLoading(false);
    }
  };

  return (
    <div id="database-management-card" className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
            <HardDrive className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">💾 پشتیبان‌گیری و بازنشانی داده‌ها</h2>
            <p className="text-xs text-indigo-200/90 mt-1">
              ایجاد پشتیبان فوری از کانال‌ها، تنظیمات ربات و قوانین فیلتر، همراه با قابلیت بازنشانی سریع
            </p>
          </div>
        </div>

        {lastBackupTime && (
          <div className="flex items-center space-x-2 space-x-reverse bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
            <Clock className="w-4 h-4 text-indigo-300" />
            <span className="text-slate-300">آخرین پشتیبان:</span>
            <span className="font-bold text-white font-mono">{formatTehranDateTime(lastBackupTime)}</span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-5">
        {/* Notification Banner */}
        {message && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold flex items-center space-x-2 space-x-reverse border ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : message.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Security / Secrets Option */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3 space-x-reverse">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-amber-900 block">سیاست امنیتی توکن‌ها</span>
              <span className="text-[11px] text-amber-800 leading-relaxed block mt-0.5">
                برای امنیت بیشتر، توکن ربات به صورت پیش‌فرض سانسور می‌شود مگر اینکه گزینه زیر را فعال کنید.
              </span>
            </div>
          </div>

          <label className="flex items-center space-x-2 space-x-reverse shrink-0 cursor-pointer bg-white px-3.5 py-2 rounded-xl border border-amber-300 shadow-2xs">
            <input
              type="checkbox"
              checked={includeSecrets}
              onChange={(e) => setIncludeSecrets(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <span className="text-xs font-bold text-slate-800">شامل شدن توکن‌ها و کلیدهای حساس</span>
          </label>
        </div>

        {/* Automatic 24-hour Backup to Telegram Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:bg-slate-800/80 border border-blue-200/90 dark:border-indigo-900/60 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 space-x-reverse">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                پشتیبان‌گیری خودکار ۲۴ ساعته از PostgreSQL به تلگرام
              </span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold">
                فعال و خودکار
              </span>
            </div>
            <p className="text-[11px] text-indigo-900/80 dark:text-slate-300 leading-relaxed">
              هر ۲۴ ساعت یک‌بار فایل کامل پایگاه داده استخراج و مستقیماً به مقصد{' '}
              <b className="font-mono text-indigo-700 dark:text-indigo-400">{destinationChannel || 'کانال یا گروه تلگرام'}</b> ارسال می‌گردد.
            </p>
          </div>

          <button
            onClick={handleBackupToTelegram}
            disabled={testingTelegramBackup || loading}
            className="w-full md:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 space-x-reverse shadow-md shadow-indigo-600/20 disabled:opacity-50 shrink-0"
          >
            {testingTelegramBackup ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-amber-300" />
            )}
            <span>تست فوری بک‌آپ و ارسال به تلگرام</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Official backup.dump */}
          <button
            onClick={handleDownloadDump}
            disabled={loading}
            className="py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-2xl text-xs font-bold transition flex items-center justify-center space-x-2 space-x-reverse shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-amber-300" />}
            <span>دانلود رسمی (backup.dump)</span>
          </button>

          {/* Instant JSON Backup */}
          <button
            onClick={handleBackupNow}
            disabled={loading}
            className="py-3.5 px-4 bg-slate-700 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl text-xs font-bold transition flex items-center justify-center space-x-2 space-x-reverse shadow-xs disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>پشتیبان JSON</span>
          </button>

          {/* Export SQL */}
          <button
            onClick={handleExportSql}
            disabled={loading}
            className="py-3.5 px-4 bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white rounded-2xl text-xs font-bold transition flex items-center justify-center space-x-2 space-x-reverse shadow-xs disabled:opacity-50"
          >
            <FileCode className="w-4 h-4 text-indigo-300" />
            <span>استخراج پشتیبان SQL</span>
          </button>

          {/* Restore Backup File (.dump, .json, .sql) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleRestoreFile}
            accept=".dump,.json,.sql"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl text-xs font-bold transition flex items-center justify-center space-x-2 space-x-reverse shadow-md shadow-emerald-600/20 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>آپلود و بازنشانی (Restore)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
