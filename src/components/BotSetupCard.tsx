import React, { useState, useEffect, useRef } from 'react';
import { BotSettings } from '../types';
import { saveSettings, updateDestinationChannel } from '../lib/telegramApi';
import { 
  Bot, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Sparkles, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  Edit3, 
  Hash, 
  Link as LinkIcon, 
  AtSign, 
  KeyRound, 
  Check, 
  X,
  Layers
} from 'lucide-react';

interface BotSetupCardProps {
  settings: BotSettings;
  onSettingsSaved: () => void;
  isAdmin: boolean;
  onRequireLogin: () => void;
}

export const BotSetupCard: React.FC<BotSetupCardProps> = ({
  settings,
  onSettingsSaved,
  isAdmin,
  onRequireLogin,
}) => {
  // Local states
  const [botToken, setBotToken] = useState(settings.botToken || '');
  const [destinationChannel, setDestinationChannel] = useState(settings.destinationChannel || '');
  const [quickDestInput, setQuickDestInput] = useState(settings.destinationChannel || '');
  
  // UI toggles
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isFullEditing, setIsFullEditing] = useState(!settings.isVerified);
  const [isChangingDestination, setIsChangingDestination] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // References to prevent auto-revert during typing or polling
  const isEditingRef = useRef(false);
  isEditingRef.current = isFullEditing || isChangingDestination;

  // Sync from props only if user is NOT actively editing
  useEffect(() => {
    if (!isEditingRef.current) {
      if (settings.botToken) setBotToken(settings.botToken);
      if (settings.destinationChannel) {
        setDestinationChannel(settings.destinationChannel);
        setQuickDestInput(settings.destinationChannel);
      }
      if (settings.isVerified) {
        setIsFullEditing(false);
      }
    }
  }, [settings.botToken, settings.destinationChannel, settings.isVerified]);

  // Helper to detect destination input format
  const getDestinationType = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (/^-?\d+$/.test(trimmed)) {
      return { type: 'numeric', label: 'شناسه عددی (Numeric ID)', icon: Hash, color: 'text-amber-500 bg-amber-50 border-amber-200' };
    }
    if (/t\.me\//i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
      return { type: 'link', label: 'لینک تلگرام (Telegram Link)', icon: LinkIcon, color: 'text-blue-500 bg-blue-50 border-blue-200' };
    }
    return { type: 'username', label: 'نام کاربری (Username)', icon: AtSign, color: 'text-emerald-500 bg-emerald-50 border-emerald-200' };
  };

  // Full Save (Token + Destination)
  const handleFullSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequireLogin();
      return;
    }

    setMessage(null);
    setIsLoading(true);

    try {
      const res = await saveSettings(botToken, destinationChannel);
      if (res.success) {
        setMessage({ text: res.message || 'ربات و کانال مقصد با موفقیت متصل و ذخیره شدند.', type: 'success' });
        setIsFullEditing(false);
        setIsChangingDestination(false);
        onSettingsSaved();
      } else {
        setMessage({ text: res.message || 'خطا در ثبت و بررسی ربات یا کانال مقصد.', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: 'خطا در اتصال به سرور تلگرام.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Destination Change Only (Sleek Drawer)
  const handleQuickDestinationSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequireLogin();
      return;
    }

    if (!quickDestInput.trim()) {
      setMessage({ text: 'لطفاً شناسه عددی یا لینک کانال مقصد را وارد کنید.', type: 'error' });
      return;
    }

    setMessage(null);
    setIsQuickSaving(true);

    try {
      const res = await updateDestinationChannel(quickDestInput.trim());
      if (res.success) {
        setDestinationChannel(quickDestInput.trim());
        setMessage({ text: res.message || 'کانال مقصد با موفقیت به‌روزرسانی و ذخیره شد.', type: 'success' });
        setIsChangingDestination(false);
        onSettingsSaved();
      } else {
        setMessage({ text: res.message || 'خطا در تغییر کانال مقصد.', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: 'خطا در برقراری ارتباط با سرور.', type: 'error' });
    } finally {
      setIsQuickSaving(false);
    }
  };

  const destBadge = getDestinationType(isChangingDestination ? quickDestInput : destinationChannel);

  return (
    <div 
      id="bot-setup-card" 
      className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-lg shadow-slate-100/80 relative overflow-hidden transition-all duration-300"
    >
      {/* Top Accent Strip */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-500" />

      {/* Header Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-5 cursor-pointer select-none group border-b border-slate-100/90"
      >
        <div className="flex items-center space-x-3.5 space-x-reverse">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h2 className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition">
                تنظیمات ربات و کانال مقصد
              </h2>
              {settings.isVerified ? (
                <span className="inline-flex items-center space-x-1 space-x-reverse text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-full font-bold">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>متصل</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 space-x-reverse text-[11px] bg-amber-50 text-amber-700 border border-amber-200/80 px-2 py-0.5 rounded-full font-medium">
                  <span>در انتظار اتصال</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              مدیریت توکن ربات ارسال‌کننده و تعیین شناسه عددی یا لینک کانال مقصد
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse" onClick={(e) => e.stopPropagation()}>
          {settings.isVerified && !isFullEditing && (
            <button
              onClick={() => {
                if (!isAdmin) {
                  onRequireLogin();
                  return;
                }
                setBotToken(settings.botToken || '');
                setDestinationChannel(settings.destinationChannel || '');
                setIsFullEditing(true);
                setIsChangingDestination(false);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition flex items-center space-x-1.5 space-x-reverse"
              id="edit-full-settings-btn"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>ویرایش توکن</span>
            </button>
          )}

          <div className="p-1 text-slate-400 group-hover:text-slate-700 transition">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isExpanded && (
        <div className="p-5 space-y-4">
          
          {/* Notification Message */}
          {message && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center justify-between space-x-2 space-x-reverse animate-fadeIn ${
                message.type === 'success'
                  ? 'bg-emerald-50/90 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50/90 border border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span className="font-medium">{message.text}</span>
              </div>
              <button 
                onClick={() => setMessage(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Connected Minimal Overview View */}
          {settings.isVerified && !isFullEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                
                {/* 1. Bot Status Card */}
                <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-4 flex items-center justify-between hover:border-slate-300 transition">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100/90 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5 space-x-reverse">
                        <span className="text-xs font-bold text-slate-800">ربات تلگرام</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <p className="text-sm font-bold text-slate-900 dir-ltr text-right mt-0.5 font-mono">
                        @{settings.botInfo?.username || 'Telegram Bot'}
                      </p>
                      <p className="text-[11px] text-slate-400 dir-ltr text-right">
                        ID: {settings.botInfo?.id || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Destination Channel Card with Quick Action */}
                <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-4 flex items-center justify-between hover:border-slate-300 transition">
                  <div className="flex items-center space-x-3 space-x-reverse min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-100/90 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                      <Send className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5 space-x-reverse">
                        <span className="text-xs font-bold text-slate-800">کانال / گروه مقصد</span>
                        {destBadge && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium border ${destBadge.color}`}>
                            {destBadge.label.split(' ')[0]}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-blue-700 dir-ltr text-right mt-0.5 font-mono truncate">
                        {settings.destinationChannel || destinationChannel}
                      </p>
                      <p className="text-[11px] text-emerald-600 font-medium">آماده ارسال پیام‌ها</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!isAdmin) {
                        onRequireLogin();
                        return;
                      }
                      setQuickDestInput(settings.destinationChannel || destinationChannel || '');
                      setIsChangingDestination(!isChangingDestination);
                      setMessage(null);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse shrink-0 shadow-sm ${
                      isChangingDestination 
                        ? 'bg-blue-600 text-white shadow-blue-500/20' 
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                    id="toggle-change-destination-btn"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تغییر مقصد</span>
                  </button>
                </div>

              </div>

              {/* Collapsible Quick Destination Drawer (اسکرول / دراور حالت تغییر کانال مقصد) */}
              {isChangingDestination && (
                <div className="bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-slate-50 border border-blue-200/80 rounded-xl p-4.5 animate-fadeIn shadow-sm">
                  <form onSubmit={handleQuickDestinationSave} className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Layers className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-800">
                          تغییر مستقیم کانال یا گروه مقصد
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        فقط آیدی عددی یا لینک کانال را وارد نمایید
                      </span>
                    </div>

                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          value={quickDestInput}
                          onChange={(e) => setQuickDestInput(e.target.value)}
                          placeholder="مثال: 1002345678901- یا t.me/my_channel یا my_channel@"
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition dir-ltr"
                          autoFocus
                          required
                        />
                      </div>

                      {/* Format Helpers & Detector */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                        <div className="flex items-center space-x-2 space-x-reverse text-[11px] text-slate-500">
                          <span>پشتیبانی از:</span>
                          <button
                            type="button"
                            onClick={() => setQuickDestInput('-100')}
                            className="bg-white hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-mono text-slate-700 transition"
                          >
                            آیدی عددی (-100...)
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickDestInput('https://t.me/')}
                            className="bg-white hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-mono text-slate-700 transition"
                          >
                            لینک تلگرام (t.me/...)
                          </button>
                        </div>

                        {destBadge && (
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border flex items-center space-x-1 space-x-reverse ${destBadge.color}`}>
                            <span>فرمت:</span>
                            <span>{destBadge.label}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 space-x-reverse pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingDestination(false);
                          setMessage(null);
                        }}
                        className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium border border-slate-200 transition"
                      >
                        انصراف
                      </button>

                      <button
                        type="submit"
                        disabled={isQuickSaving}
                        className="flex items-center space-x-1.5 space-x-reverse px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                        id="save-quick-destination-btn"
                      >
                        {isQuickSaving ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>در حال ذخیره...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>ذخیره و ثبت کانال مقصد</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : (
            /* Full Form Mode (Initial Setup or Editing Bot Token) */
            <form onSubmit={handleFullSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Bot Token Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    توکن ربات تلگرام (Bot Token)
                  </label>
                  <input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="مثال: 7123456789:AAE...XyZ"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition dir-ltr"
                    required
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    توکن دریافتی از ربات رسمی BotFather@ در تلگرام
                  </span>
                </div>

                {/* 2. Destination Channel Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    شناسه عددی یا لینک کانال مقصد
                  </label>
                  <input
                    type="text"
                    value={destinationChannel}
                    onChange={(e) => setDestinationChannel(e.target.value)}
                    placeholder="مثال: 1001234567890- یا t.me/my_channel"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition dir-ltr"
                    required
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>ربات باید در کانال ادمین (Admin) با دسترسی ارسال باشد</span>
                    {destBadge && (
                      <span className="text-blue-600 font-medium font-sans">
                        {destBadge.label.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2">
                {settings.isVerified && (
                  <button
                    type="button"
                    onClick={() => {
                      setBotToken(settings.botToken || '');
                      setDestinationChannel(settings.destinationChannel || '');
                      setIsFullEditing(false);
                      setMessage(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition"
                  >
                    انصراف
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
                  id="save-bot-settings-btn"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>در حال بررسی و اتصال به تلگرام...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>اتصال و ذخیره‌سازی</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
      )}
    </div>
  );
};
