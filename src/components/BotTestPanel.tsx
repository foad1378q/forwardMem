import React, { useState } from 'react';
import { sendBotTestMessage } from '../lib/telegramApi';
import { BotSettings, SystemStats } from '../types';
import { Send, CheckCircle2, AlertTriangle, RefreshCw, Zap, Bot, SendHorizontal, Image as ImageIcon, Clock } from 'lucide-react';

interface BotTestPanelProps {
  settings: BotSettings;
  stats: SystemStats;
  isAdmin: boolean;
  onRequireLogin: () => void;
  onRefresh: () => void;
}

export const BotTestPanel: React.FC<BotTestPanelProps> = ({
  settings,
  stats,
  isAdmin,
  onRequireLogin,
  onRefresh,
}) => {
  const [testText, setTestText] = useState<string>('ربات تست فروارد هوشمند - این یک پیام آزمایشی است 🚀');
  const [testMedia, setTestMedia] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resultMsg, setResultMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [lastTestTime, setLastTestTime] = useState<string | null>(null);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequireLogin();
      return;
    }

    setIsLoading(true);
    setResultMsg(null);

    try {
      const res = await sendBotTestMessage(testText.trim(), testMedia.trim() || undefined);
      if (res.success) {
        setResultMsg({ text: res.message || 'پیام تست با موفقیت ارسال شد!', success: true });
        setLastTestTime(new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        onRefresh();
      } else {
        setResultMsg({ text: res.message || 'خطا در ارسال پیام تست.', success: false });
      }
    } catch (err: any) {
      setResultMsg({ text: `خطا: ${err.message || 'امکان ارسال تست وجود ندارد'}`, success: false });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-blue-600/90 via-indigo-600/90 to-blue-800/90 backdrop-blur-2xl border border-blue-400/30 text-white shadow-2xl shadow-blue-600/20"
      id="bot-test-panel"
    >
      {/* Glossy Overlay Decor */}
      <div className="absolute -top-24 -left-24 w-60 h-60 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10 relative z-10">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-sky-200 shadow-inner">
            <Zap className="w-6 h-6 fill-sky-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h2 className="text-lg font-bold tracking-wide">Telegram Bot Test Panel</h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-sky-400/20 text-sky-200 border border-sky-300/30 font-semibold">
                ارسال مستقیم تست
              </span>
            </div>
            <p className="text-xs text-blue-100/80 mt-0.5">
              تست عملکرد ربات و تحویل مستقیم پیام‌ها (متن و رسانه) به کانال مقصد
            </p>
          </div>
        </div>

        {/* System Status Metrics */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Bot Status */}
          <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center space-x-1.5 space-x-reverse">
            <Bot className="w-3.5 h-3.5 text-sky-300" />
            <span className="text-blue-100/70">ربات:</span>
            <span className="font-bold text-white">
              {stats.botConnected ? '🟢 متصل' : '🔴 غیرمتصل'}
            </span>
          </div>

          {/* Destination Status */}
          <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center space-x-1.5 space-x-reverse">
            <SendHorizontal className="w-3.5 h-3.5 text-sky-300" />
            <span className="text-blue-100/70">مقصد:</span>
            <span className="font-bold text-white font-mono">
              {settings.destinationChannel || 'نامشخص'}
            </span>
          </div>

          {/* Last Test Time */}
          {lastTestTime && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-400/20 border border-emerald-300/30 flex items-center space-x-1.5 space-x-reverse text-emerald-200 font-mono">
              <Clock className="w-3.5 h-3.5 text-emerald-300" />
              <span>آخرین تست: {lastTestTime}</span>
            </div>
          )}
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSendTest} className="space-y-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Test Message Text */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-blue-100 flex items-center space-x-1.5 space-x-reverse">
              <Send className="w-3.5 h-3.5 text-sky-300" />
              <span>متن پیام آزمایشی</span>
            </label>
            <textarea
              rows={2}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="متن پیام تست را وارد کنید..."
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-blue-200/50 focus:outline-none focus:ring-2 focus:ring-sky-300 transition resize-none"
              required
            />
          </div>

          {/* Optional Media URL */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-blue-100 flex items-center space-x-1.5 space-x-reverse">
              <ImageIcon className="w-3.5 h-3.5 text-sky-300" />
              <span>لینک تصویر / عکس (اختیاری)</span>
            </label>
            <input
              type="url"
              value={testMedia}
              onChange={(e) => setTestMedia(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-blue-200/50 focus:outline-none focus:ring-2 focus:ring-sky-300 transition dir-ltr font-mono"
            />
            <p className="text-[10px] text-blue-200/60">در صورت وارد کردن لینک، پیام همراه عکس ارسال می‌گردد.</p>
          </div>
        </div>

        {/* Result Message Banner */}
        {resultMsg && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-start space-x-2 space-x-reverse backdrop-blur-md border ${
              resultMsg.success
                ? 'bg-emerald-500/20 border-emerald-300/30 text-emerald-100'
                : 'bg-rose-500/20 border-rose-300/30 text-rose-100'
            }`}
          >
            {resultMsg.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed font-medium">{resultMsg.text}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isLoading || !stats.botConnected}
            className="px-6 py-2.5 bg-gradient-to-r from-sky-400 to-blue-400 hover:from-sky-300 hover:to-blue-300 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-sky-400/20 flex items-center space-x-2 space-x-reverse disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>در حال ارسال پیام تست...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>ارسال مستقیم پیام تست (Send Bot Test)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
