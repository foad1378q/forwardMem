import React, { useState, useEffect } from 'react';
import { verifyTelegramClientCode, verifyTelegramClientPassword } from '../lib/telegramApi';
import { TelegramClientConfig } from '../types';
import {
  X,
  KeyRound,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Phone,
  Send,
} from 'lucide-react';

interface TelegramAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: string;
  initialRequiresPassword?: boolean;
  onSuccess: (config: TelegramClientConfig) => void;
}

export const TelegramAuthModal: React.FC<TelegramAuthModalProps> = ({
  isOpen,
  onClose,
  phoneNumber,
  initialRequiresPassword = false,
  onSuccess,
}) => {
  const [step, setStep] = useState<'code' | 'password'>(
    initialRequiresPassword ? 'password' : 'code'
  );
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(initialRequiresPassword ? 'password' : 'code');
      setCode('');
      setPassword('');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialRequiresPassword]);

  if (!isOpen) return null;

  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('لطفاً کد تایید ۵ رقمی دریافتی را وارد کنید.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await verifyTelegramClientCode(code.trim());
      if (res.success && res.clientConfig) {
        setSuccessMsg(res.message || 'اتصال کلاینت تلگرام با موفقیت انجام شد!');
        setTimeout(() => {
          onSuccess(res.clientConfig!);
          onClose();
        }, 1200);
      } else if (res.requiresPassword) {
        setStep('password');
        setError(res.message || 'این حساب دارای تایید دو مرحله‌ای است. لطفاً رمز عبور را وارد کنید.');
      } else {
        setError(res.message || 'کد تایید وارد شده نامعتبر است.');
      }
    } catch (err: any) {
      setError(`خطا در بررسی کد تایید: ${err.message || 'ارتباط با سرور برقرار نشد.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('لطفاً رمز عبور تایید دو مرحله‌ای را وارد کنید.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await verifyTelegramClientPassword(password.trim());
      if (res.success && res.clientConfig) {
        setSuccessMsg(res.message || 'ورود و تایید دو مرحله‌ای با موفقیت انجام شد!');
        setTimeout(() => {
          onSuccess(res.clientConfig!);
          onClose();
        }, 1200);
      } else {
        setError(res.message || 'رمز عبور دو مرحله‌ای اشتباه است.');
      }
    } catch (err: any) {
      setError(`خطا در بررسی رمز عبور: ${err.message || 'ارتباط با سرور برقرار نشد.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-slate-200/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
              {step === 'code' ? <Send className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {step === 'code' ? 'ورود کد تایید تلگرام' : 'رمز عبور تایید دو مرحله‌ای'}
              </h3>
              <p className="text-xs text-slate-500 flex items-center space-x-1 space-x-reverse mt-0.5">
                <Phone className="w-3 h-3 text-slate-400" />
                <span className="dir-ltr text-right font-mono">{phoneNumber}</span>
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

        {/* Feedback messages */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2 space-x-reverse">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center space-x-2 space-x-reverse">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Step 1: Verification Code Form */}
        {step === 'code' && (
          <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl text-xs text-blue-800 leading-relaxed">
              کد ۵ رقمی تایید به تلگرام شما ارسال شد. لطفاً آن را در کادر زیر وارد نمایید.
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                کد تایید تلگرام (Verification Code)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="مثال: 12345"
                className="w-full text-center tracking-[0.5em] text-lg font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition dir-ltr"
                maxLength={8}
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-blue-500/20 transition flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال بررسی کد...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>تایید کد و ورود</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2: 2FA Password Form */}
        {step === 'password' && (
          <form onSubmit={handleVerifyPasswordSubmit} className="space-y-4">
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl text-xs text-amber-800 leading-relaxed">
              🔒 برای این حساب تلگرام، «تایید دو مرحله‌ای» فعال است. لطفاً رمز عبور تلگرام خود را وارد نمایید.
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1 space-x-reverse">
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                <span>رمز عبور دو مرحله‌ای تلگرام (2FA Password)</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز عبور تلگرام..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition dir-ltr"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال بررسی رمز عبور...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 fill-slate-950" />
                  <span>تایید رمز و تکمیل ورود</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
