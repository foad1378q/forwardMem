import React, { useState, useEffect } from 'react';
import { TelegramClientConfig } from '../types';
import {
  sendTelegramClientCode,
  disconnectTelegramClient,
  testTelegramClientConnection,
  reconnectTelegramClient,
  pauseTelegramMonitoring,
  resumeTelegramMonitoring,
} from '../lib/telegramApi';
import { TelegramAuthModal } from './TelegramAuthModal';
import { formatTehranDateTime } from '../lib/timeUtils';
import {
  ShieldCheck,
  Phone,
  Key,
  Hash,
  Wifi,
  Power,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Send,
  Lock,
  Activity,
  Clock,
  PauseCircle,
  PlayCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TelegramClientCardProps {
  clientConfig?: TelegramClientConfig;
  onConfigChange: () => void;
}

// Default standard Telegram API credentials
const DEFAULT_API_ID = '2040';
const DEFAULT_API_HASH = 'b18441a1ed60741557078c33d425e276';

export const TelegramClientCard: React.FC<TelegramClientCardProps> = ({
  clientConfig,
  onConfigChange,
}) => {
  const [apiId, setApiId] = useState<string>(
    clientConfig?.apiId ? String(clientConfig.apiId) : DEFAULT_API_ID
  );
  const [apiHash, setApiHash] = useState<string>(
    clientConfig?.apiHash || DEFAULT_API_HASH
  );
  const [phoneNumber, setPhoneNumber] = useState<string>(
    clientConfig?.phoneNumber || ''
  );

  const [isUserEditing, setIsUserEditing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Sync state from server ONLY if user is not actively editing inputs
  useEffect(() => {
    if (clientConfig && !isUserEditing) {
      if (clientConfig.apiId) setApiId(String(clientConfig.apiId));
      if (clientConfig.apiHash) setApiHash(clientConfig.apiHash);
      if (clientConfig.phoneNumber) setPhoneNumber(clientConfig.phoneNumber);
    }
  }, [clientConfig, isUserEditing]);

  const isConnected = !!clientConfig?.isConnected;
  const isPaused = !!clientConfig?.isMonitoringPaused;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiId.trim() || !apiHash.trim() || !phoneNumber.trim()) {
      setErrorMsg('لطفاً فیلدهای API ID، API HASH و شماره تلفن را به طور کامل تکمیل نمایید.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await sendTelegramClientCode(apiId.trim(), apiHash.trim(), phoneNumber.trim());
      if (res.success) {
        setSuccessMsg('کد تایید ورود به شماره/تلگرام شما ارسال گردید.');
        setRequiresPassword(false);
        setIsAuthModalOpen(true);
      } else {
        setErrorMsg(res.message || 'خطا در ارسال کد تایید ورود.');
      }
    } catch (err: any) {
      setErrorMsg(`خطا در ارسال کد تایید: ${err.message || 'خطای شبکه'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Telegram permanently?')) {
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await disconnectTelegramClient();
      if (res.success) {
        setSuccessMsg(res.message);
        onConfigChange();
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(`خطا در قطع ارتباط: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePause = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isPaused) {
        const res = await resumeTelegramMonitoring();
        if (res.success) {
          setSuccessMsg(res.message);
          onConfigChange();
        } else {
          setErrorMsg(res.message);
        }
      } else {
        const res = await pauseTelegramMonitoring();
        if (res.success) {
          setSuccessMsg(res.message);
          onConfigChange();
        } else {
          setErrorMsg(res.message);
        }
      }
    } catch (err: any) {
      setErrorMsg(`خطا در تغییر وضعیت مانیتورینگ: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await testTelegramClientConnection();
      if (res.success) {
        setSuccessMsg(res.message);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(`خطا در تست اتصال: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconnect = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await reconnectTelegramClient();
      if (res.success) {
        setSuccessMsg(res.message);
        onConfigChange();
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(`خطا در بازاتصال: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMaskedPhone = (phone?: string) => {
    if (!phone) return '+98**********';
    const clean = phone.replace(/\s+/g, '');
    if (clean.length > 7) {
      return `${clean.substring(0, 4)}*****${clean.substring(clean.length - 3)}`;
    }
    return clean;
  };

  const formatLastConnectionTime = (iso?: string) => {
    if (!iso) return 'هم‌اکنون فعال';
    try {
      return formatTehranDateTime(iso);
    } catch (_) {
      return 'هم‌اکنون فعال';
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 shadow-xl shadow-slate-200/50 transition duration-300">
      {/* Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between cursor-pointer select-none pb-4 mb-5 border-b border-slate-100 group"
      >
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${
            isConnected
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
              : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/20'
          }`}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h2 className="text-base font-black text-slate-900 group-hover:text-blue-600 transition">Telegram Client Connection</h2>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition" />
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              تنظیمات کلاینت GramJS تلگرام جهت مانیتورینگ زنده کانال‌ها و گروه‌های عمومی
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse">
          {isConnected ? (
            isPaused ? (
              <span className="inline-flex items-center space-x-1.5 space-x-reverse px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>🟡 Monitoring Paused</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 space-x-reverse px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>🟢 Telegram Client Connected</span>
              </span>
            )
          ) : (
            <span className="inline-flex items-center space-x-1.5 space-x-reverse px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>🔴 Disconnected</span>
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="animate-fadeIn space-y-4">
          {/* Alert Messages */}
      {errorMsg && (
        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start space-x-2 space-x-reverse">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 flex items-start space-x-2 space-x-reverse">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{successMsg}</span>
        </div>
      )}

      {/* Connected View */}
      {isConnected ? (
        <div className="space-y-5">
          <div className={`${isPaused ? 'bg-amber-50/70 border-amber-200/80' : 'bg-emerald-50/70 border-emerald-200/80'} border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition`}>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 space-x-reverse">
                <CheckCircle2 className={`w-5 h-5 ${isPaused ? 'text-amber-600' : 'text-emerald-600'}`} />
                <span className={`text-sm font-black ${isPaused ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {isPaused ? '🟡 Monitoring Paused' : '🟢 Telegram Client Connected'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-800">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-semibold text-slate-500">Phone:</span>
                  <span className="font-mono font-bold dir-ltr">{formatMaskedPhone(clientConfig?.connectedPhone || phoneNumber)}</span>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-semibold text-slate-500">Session Status:</span>
                  <span className={`font-bold ${isPaused ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {isPaused ? 'Paused (پوزشده)' : 'Active (فعال و ذخیره‌شده)'}
                  </span>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-semibold text-slate-500">Last Connection Time:</span>
                  <span className="font-semibold">{formatLastConnectionTime(clientConfig?.lastConnectedAt)}</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed bg-slate-50/80 border border-slate-100 p-3 rounded-xl">
            💡 نشست GramJS کلاینت شما به صورت دائمی در سرور ذخیره شده است. نیازی به ورود مجدد ندارید و با ری‌استارت سرور کلاینت به طور خودکار بازاتصال خواهد شد.
          </p>

          {/* Connected Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isLoading}
              className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold rounded-xl text-xs transition flex items-center space-x-2 space-x-reverse disabled:opacity-50"
            >
              <Wifi className="w-4 h-4" />
              <span>Test Connection</span>
            </button>

            {isPaused ? (
              <button
                type="button"
                onClick={handleTogglePause}
                disabled={isLoading}
                className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded-xl text-xs transition flex items-center space-x-2 space-x-reverse disabled:opacity-50"
              >
                <PlayCircle className="w-4 h-4 text-emerald-600" />
                <span>Resume Monitoring</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTogglePause}
                disabled={isLoading}
                className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold rounded-xl text-xs transition flex items-center space-x-2 space-x-reverse disabled:opacity-50"
              >
                <PauseCircle className="w-4 h-4 text-amber-600" />
                <span>Pause Monitoring</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleReconnect}
              disabled={isLoading}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-xl text-xs transition flex items-center space-x-2 space-x-reverse disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Reconnect</span>
            </button>

            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isLoading}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs transition flex items-center space-x-2 space-x-reverse disabled:opacity-50 mr-auto"
            >
              <Power className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      ) : (
        /* Disconnected Form View */
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* API ID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1 space-x-reverse">
                <Hash className="w-3.5 h-3.5 text-blue-600" />
                <span>API ID</span>
              </label>
              <input
                type="text"
                value={apiId}
                onChange={(e) => {
                  setApiId(e.target.value);
                  setIsUserEditing(true);
                }}
                placeholder="2040"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition dir-ltr font-mono min-w-0"
                required
              />
            </div>

            {/* API HASH */}
            <div className="space-y-1.5 min-w-0">
              <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1 space-x-reverse">
                <Key className="w-3.5 h-3.5 text-blue-600" />
                <span>API HASH</span>
              </label>
              <input
                type="text"
                value={apiHash}
                onChange={(e) => {
                  setApiHash(e.target.value);
                  setIsUserEditing(true);
                }}
                placeholder="b18441a1ed60741557078c33d425e276"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition dir-ltr font-mono min-w-0"
                required
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5 min-w-0">
              <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1 space-x-reverse">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span>شماره تلفن (Phone Number)</span>
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  setIsUserEditing(true);
                }}
                placeholder="+989123456789"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition dir-ltr font-mono min-w-0"
                required
              />
            </div>
          </div>

          <div className="text-xs text-slate-500 flex items-center space-x-2 space-x-reverse">
            <span className="text-blue-600 font-bold">راهنما:</span>
            <span>با کلیک روی «اتصال تلگرام»، کد ۵ رقمی تایید تلگرام ارسال خواهد شد.</span>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-blue-500/20 transition flex items-center space-x-2 space-x-reverse disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال ارسال کد...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>اتصال تلگرام (Connect Telegram)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isLoading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center space-x-2 space-x-reverse"
            >
              <Wifi className="w-4 h-4 text-slate-500" />
              <span>تست ارتباط (Test Connection)</span>
            </button>
          </div>
        </form>
      )}
        </div>
      )}

      {/* Auth Verification Modal */}
      <TelegramAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        phoneNumber={phoneNumber}
        initialRequiresPassword={requiresPassword}
        onSuccess={(newConfig) => {
          setSuccessMsg('🟢 کلاینت تلگرام با موفقیت متصل گردید!');
          onConfigChange();
        }}
      />
    </div>
  );
};
