import React, { useState, useEffect } from 'react';
import { quickTestForward } from '../lib/telegramApi';
import { TelegramPost } from '../types';
import {
  X,
  Zap,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Bot,
  Radio,
  ExternalLink,
} from 'lucide-react';

interface QuickTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultBotToken?: string;
  defaultDestination?: string;
  onSuccess?: () => void;
}

export const QuickTestModal: React.FC<QuickTestModalProps> = ({
  isOpen,
  onClose,
  defaultBotToken = '',
  defaultDestination = '',
  onSuccess,
}) => {
  const [botToken, setBotToken] = useState(defaultBotToken);
  const [sourceChannel, setSourceChannel] = useState('');
  const [destinationChannel, setDestinationChannel] = useState(defaultDestination);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    post?: TelegramPost;
    botUsername?: string;
    channelTitle?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (defaultBotToken) setBotToken(defaultBotToken);
      if (defaultDestination) setDestinationChannel(defaultDestination);
      setResult(null);
    }
  }, [isOpen, defaultBotToken, defaultDestination]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken.trim() || !sourceChannel.trim() || !destinationChannel.trim()) {
      setResult({
        success: false,
        message: 'لطفاً تمامی فیلدها (توکن ربات، کانال مبدأ و کانال مقصد) را تکمیل کنید.',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const res = await quickTestForward(
        botToken.trim(),
        sourceChannel.trim(),
        destinationChannel.trim()
      );

      setResult(res);
      if (res.success && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: `خطای غیرمنتظره در برقراری ارتباط: ${err.message || 'پاسخی از سرور دریافت نشد.'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-slate-200/80 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
              <Zap className="w-5 h-5 fill-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2 space-x-reverse">
                <span>تست فوری و مستقیم ارسال</span>
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                  تست بدون ذخیره
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تست و ارسال مستقیم «آخرین پست» کانال مبدأ به کانال مقصد
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bot Token */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1.5 space-x-reverse">
              <Bot className="w-3.5 h-3.5 text-blue-600" />
              <span>توکن ربات تلگرام (Bot Token)</span>
            </label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="مثال: 123456789:ABCdefGHIjklMNOpqrsTUVwxyZ"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition dir-ltr"
              required
            />
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Source */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1.5 space-x-reverse">
                <Radio className="w-3.5 h-3.5 text-amber-600" />
                <span>کانال مبدأ (برای خواندن پست)</span>
              </label>
              <input
                type="text"
                value={sourceChannel}
                onChange={(e) => setSourceChannel(e.target.value)}
                placeholder="مثال: durov@"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition dir-ltr"
                required
              />
              <p className="text-[10px] text-slate-400">شناسه عمومی کانال بدون نیاز به ادمین بودن</p>
            </div>

            {/* Destination */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1.5 space-x-reverse">
                <Send className="w-3.5 h-3.5 text-emerald-600" />
                <span>کانال مقصد (برای دریافت پست)</span>
              </label>
              <input
                type="text"
                value={destinationChannel}
                onChange={(e) => setDestinationChannel(e.target.value)}
                placeholder="مثال: my_channel@"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition dir-ltr"
                required
              />
              <p className="text-[10px] text-slate-400">ربات باید ادمین با دسترسی ارسال پیام باشد</p>
            </div>
          </div>

          {/* Test Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>در حال تست و ارسال با GramJS...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>دریافت و ارسال فوری آخرین پست</span>
              </>
            )}
          </button>
        </form>

        {/* Result & Feedback Box */}
        {result && (
          <div
            className={`p-4 rounded-2xl border space-y-3 transition-all ${
              result.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-start space-x-2.5 space-x-reverse">
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <h4 className="font-bold text-xs">
                  {result.success ? 'تست ارسال موفقیت‌آمیز بود!' : 'خطا در تست ارسال فوری'}
                </h4>
                <p className="text-xs leading-relaxed opacity-90">{result.message}</p>
              </div>
            </div>

            {/* If Post snippet available */}
            {result.post && (
              <div className="mt-2 pt-3 border-t border-emerald-200/60 bg-white/80 rounded-xl p-3 text-xs space-y-2 text-slate-700">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono text-blue-600 font-bold">آخرین پست شناسه: #{result.post.id}</span>
                  <a
                    href={result.post.rawUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 space-x-reverse text-blue-600 font-semibold hover:underline"
                  >
                    <span>مشاهده پست اصلی</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {result.post.formattedTextHtml ? (
                  <p className="text-slate-800 line-clamp-3 leading-relaxed dir-rtl text-right">
                    {result.post.text}
                  </p>
                ) : (
                  <p className="text-slate-400 italic">پست فاقد متن (فقط رسانه/فایل)</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tip */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-500 space-y-1">
          <p className="font-bold text-slate-700">💡 راهنمای تست فوری:</p>
          <ul className="list-disc list-inside space-y-0.5 text-slate-500">
            <li>کانال مبدأ باید عمومی باشد تا GramJS بتواند پست‌های آن را دریافت کند.</li>
            <li>ربات باید عضو کانال مقصد شده و دسترسی «ارسال پیام» داشته باشد.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
