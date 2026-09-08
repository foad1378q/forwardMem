import React, { useState, useEffect } from 'react';
import {
  Bot,
  Database,
  Send,
  Key,
  Shield,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Server,
  Terminal,
  ExternalLink,
  HelpCircle,
  Lock,
  Layers,
  Check,
  RefreshCw,
} from 'lucide-react';

interface SetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [testingBot, setTestingBot] = useState<boolean>(false);
  const [testingDb, setTestingDb] = useState<boolean>(false);
  const [botTestResult, setBotTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [dbTestResult, setDbTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Form state
  const [botToken, setBotToken] = useState<string>('');
  const [destinationChannel, setDestinationChannel] = useState<string>('');
  const [databaseUrl, setDatabaseUrl] = useState<string>('');
  const [apiId, setApiId] = useState<string>('2040');
  const [apiHash, setApiHash] = useState<string>('b18441a1ed60741557078c33d425e276');
  const [adminPassword, setAdminPassword] = useState<string>('admin123');

  // Load current setup status when opened
  useEffect(() => {
    if (!isOpen) return;
    const loadStatus = async () => {
      try {
        const res = await fetch('/api/setup/status');
        const data = await res.json();
        if (data) {
          if (data.destinationChannel) setDestinationChannel(data.destinationChannel);
          if (data.apiId) setApiId(String(data.apiId));
          if (data.apiHash) setApiHash(data.apiHash);
        }
      } catch (_) {}
    };
    loadStatus();
  }, [isOpen]);

  if (!isOpen) return null;

  // Test Bot Token
  const handleTestBot = async () => {
    if (!botToken.trim()) {
      setBotTestResult({ ok: false, message: 'لطفاً ابتدا توکن ربات را وارد کنید.' });
      return;
    }
    setTestingBot(true);
    setBotTestResult(null);
    try {
      const res = await fetch('/api/setup/test-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: botToken.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBotTestResult({ ok: true, message: data.message });
      } else {
        setBotTestResult({ ok: false, message: data.message || 'توکن نامعتبر است.' });
      }
    } catch (err: any) {
      setBotTestResult({ ok: false, message: 'عدم برقراری ارتباط با سرور: ' + err.message });
    } finally {
      setTestingBot(false);
    }
  };

  // Test Database Connection
  const handleTestDb = async () => {
    if (!databaseUrl.trim()) {
      setDbTestResult({ ok: false, message: 'لطفاً آدرس اتصال دیتابیس (DATABASE_URL) را وارد کنید.' });
      return;
    }
    setTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await fetch('/api/setup/test-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseUrl: databaseUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbTestResult({ ok: true, message: data.message });
      } else {
        setDbTestResult({ ok: false, message: data.message || 'خطا در اتصال به دیتابیس.' });
      }
    } catch (err: any) {
      setDbTestResult({ ok: false, message: 'خطای سرور: ' + err.message });
    } finally {
      setTestingDb(false);
    }
  };

  // Final Quick Connect Submission
  const handleFinalSubmit = async () => {
    setLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const payload = {
        botToken: botToken.trim(),
        destinationChannel: destinationChannel.trim(),
        apiId: apiId.trim() ? Number(apiId.trim()) : 2040,
        apiHash: apiHash.trim() || 'b18441a1ed60741557078c33d425e276',
        databaseUrl: databaseUrl.trim(),
        adminPassword: adminPassword.trim() || 'admin123',
      };

      const res = await fetch('/api/setup/quick-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmitSuccess(data.message);
        // Save admin authentication flag to immediately unlock panel
        sessionStorage.setItem('is_admin', 'true');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1800);
      } else {
        setSubmitError(data.message || 'خطا در راه‌اندازی سامانه.');
      }
    } catch (err: any) {
      setSubmitError('خطای ارتباط با سرور: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 dir-rtl font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 p-6 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
                <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">ویزارد راه‌اندازی سریع سامانه (No-ENV)</h2>
                <p className="text-xs text-blue-100/90 mt-0.5">
                  بدون نیاز به متغیرهای محیطی در ریل‌وی؛ مشخصات را وارد کرده و متصل شوید
                </p>
              </div>
            </div>
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center justify-center space-x-2 space-x-reverse mt-6">
            {[1, 2, 3, 4].map((s) => (
              <button
                key={s}
                onClick={() => setStep(s)}
                className={`flex items-center space-x-1.5 space-x-reverse px-3 py-1 rounded-full text-xs font-bold transition ${
                  step === s
                    ? 'bg-white text-indigo-950 shadow-sm'
                    : step > s
                    ? 'bg-white/30 text-white hover:bg-white/40'
                    : 'bg-white/10 text-white/60'
                }`}
              >
                <span>{s === 1 ? '۱. ربات' : s === 2 ? '۲. کانال مقصد' : s === 3 ? '۳. دیتابیس (کاملاً اختیاری)' : '۴. اتمام'}</span>
                {step > s && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Notification Alert */}
          {submitError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2 space-x-reverse">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2 space-x-reverse">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          {/* STEP 1: Bot Token & API Credentials */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center space-x-2 space-x-reverse text-indigo-900 dark:text-indigo-300">
                <Bot className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-sm">۱. توکن ربات تلگرام و شناسه کلاینت</h3>
              </div>

              {/* Bot Token Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>توکن ربات تلگرام (BOT_TOKEN) *</span>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1 space-x-reverse text-[11px]"
                  >
                    <span>دریافت از BotFather@</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleTestBot}
                    disabled={testingBot || !botToken.trim()}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse disabled:opacity-50 shrink-0 shadow-xs"
                  >
                    {testingBot ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
                    <span>تست توکن</span>
                  </button>
                </div>
                {botTestResult && (
                  <p className={`text-xs font-bold flex items-center space-x-1 space-x-reverse ${botTestResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {botTestResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span>{botTestResult.message}</span>
                  </p>
                )}
              </div>

              {/* API ID & Hash (Telegram Client) */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 space-x-reverse">
                    <Key className="w-4 h-4 text-indigo-500" />
                    <span>شناسه Telegram API (مخصوص کلاینت مانیتورینگ)</span>
                  </span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold">
                    پیش‌فرض استاندارد
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">API ID</label>
                    <input
                      type="number"
                      value={apiId}
                      onChange={(e) => setApiId(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">API Hash</label>
                    <input
                      type="text"
                      value={apiHash}
                      onChange={(e) => setApiHash(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  مقادیر پیش‌فرض فوق استانداردهای عمومی تلگرام هستند. در صورت تمایل می‌توانید آن‌ها را از <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="text-blue-500 underline">my.telegram.org</a> دریافت و جایگزین کنید.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Destination Channel or Group */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center space-x-2 space-x-reverse text-indigo-900 dark:text-indigo-300">
                <Send className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-sm">۲. کانال یا گروه مقصد برای ارسال پست‌ها و بک‌آپ</h3>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  آیدی کانال یا گروه مقصد (DESTINATION_CHANNEL) *
                </label>
                <input
                  type="text"
                  value={destinationChannel}
                  onChange={(e) => setDestinationChannel(e.target.value)}
                  placeholder="@my_channel یا 100123456789-"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  می‌توانید یوزرنیم کانال (مانند <code>@my_channel</code>) یا آیدی عددی گروه تلگرام (مانند <code>-100234567890</code>) را وارد نمایید.
                </p>
              </div>

              {/* Group / Channel Guidance Box */}
              <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-2">
                <div className="flex items-center space-x-2 space-x-reverse text-blue-900 dark:text-blue-200 font-bold text-xs">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  <span>راهنمای عضویت ربات در گروه یا کانال:</span>
                </div>
                <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>ربات را به کانال یا گروه مقصد اضافه (Add) کنید.</li>
                  <li>ربات را به عنوان <b>ادمین (Administrator)</b> با دسترسی ارسال پیام تعیین کنید.</li>
                  <li>بلافاصله پس از تکمیل نصب، پیام تست و اتصال موفقیت‌آمیز به این کانال/گروه فرستاده خواهد شد!</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 3: PostgreSQL Database */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 space-x-reverse text-indigo-900 dark:text-indigo-300">
                  <Database className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-black text-sm">۳. پایگاه داده PostgreSQL (کاملاً اختیاری و غیرضروری)</h3>
                </div>
                <span className="text-[11px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-full font-bold">
                  اختیاری - بدون نیاز به وارد کردن
                </span>
              </div>

              {/* Notice Banner */}
              <div className="p-4 rounded-2xl bg-blue-50/90 dark:bg-slate-800/80 border border-blue-200 dark:border-blue-900/60 space-y-2">
                <div className="flex items-center space-x-2 space-x-reverse text-blue-900 dark:text-blue-200 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  <span>آدرس دیتابیس برای نصب و ورود به پنل اصلاً ضروری نیست!</span>
                </div>
                <p className="text-[11px] text-blue-950/80 dark:text-slate-300 leading-relaxed">
                  می‌توانید این فیلد را کاملاً خالی بگذارید. سامانه با پایگاه داده محلی بسیار سریع و پایدار کار خود را آغاز می‌کند.
                  اگر از قبل فایل نسخه پشتیبان (مانند <code>backup.dump</code> یا <code>backup.json</code>) دارید، پس از ورود به ربات یا پنل مدیریت به راحتی می‌توانید آن را آپلود کرده تا تمام کانال‌ها و تنظیمات قبلی‌تان خودکار بازنشانی (Restore) شوند. همچنین بعداً هر زمان خواستید می‌توانید آدرس PostgreSQL را در صفحه تنظیمات متصل نمایید.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse shadow-xs"
                  >
                    <span>عبور از دیتابیس و ادامه به مرحله بعد ⚡</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>آدرس اتصال پایگاه داده (DATABASE_URL) - در صورت تمایل</span>
                  <span className="text-[11px] text-slate-400">اختیاری (Railway / Neon / Supabase)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={databaseUrl}
                    onChange={(e) => setDatabaseUrl(e.target.value)}
                    placeholder="postgresql://postgres:password@roundhouse.proxy.rlwy.net:12345/railway (اختیاری)"
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleTestDb}
                    disabled={testingDb || !databaseUrl.trim()}
                    className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse disabled:opacity-50 shrink-0 shadow-xs"
                  >
                    {testingDb ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                    <span>تست دیتابیس</span>
                  </button>
                </div>
                {dbTestResult && (
                  <p className={`text-xs font-bold flex items-center space-x-1 space-x-reverse ${dbTestResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {dbTestResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span>{dbTestResult.message}</span>
                  </p>
                )}
              </div>

              {/* 24-hour backup reminder */}
              <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-start space-x-3 space-x-reverse">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 dark:text-emerald-300 leading-relaxed">
                  <b>پشتیبان‌گیری خودکار ۲۴ ساعته:</b> ربات هر ۲۴ ساعت یک بار به صورت کاملاً خودکار فایل رسمی <code>backup.dump</code> را تولید و به تلگرام ارسال می‌کند تا در آینده نیز هیچ اطلاعاتی از بین نرود.
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Admin Password & Finish */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center space-x-2 space-x-reverse text-indigo-900 dark:text-indigo-300">
                <Shield className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-sm">۴. رمز عبور پنل مدیریت وب</h3>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  رمز عبور ادمین وب
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="admin123"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  پیش‌فرض: <code>admin123</code> (می‌توانید بعداً در پنل نیز آن را تغییر دهید)
                </p>
              </div>

              {/* Review Summary */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">خلاصه تنظیمات جهت راه‌اندازی:</span>
                <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>ربات تلگرام:</span>
                    <span className="font-mono text-slate-900 dark:text-white">{botToken ? '✓ وارد شده' : '❌ نامشخص'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>کانال/گروه مقصد:</span>
                    <span className="font-mono text-slate-900 dark:text-white">{destinationChannel || '❌ نامشخص'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>پایگاه داده:</span>
                    <span className="text-slate-900 dark:text-white font-medium">{databaseUrl.trim() ? 'PostgreSQL ابری' : 'دیتابیس محلی سامانه (امکان آپلود و بازنشانی backup.dump پس از ورود)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ارسال پیام تایید اتصال به ربات:</span>
                    <span className="text-emerald-600 font-bold">بله (بلافاصله پس از اتصال)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2.5 bg-white dark:bg-slate-700 hover:bg-slate-100 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse"
            >
              <ArrowRight className="w-4 h-4" />
              <span>مرحله قبل</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-xs font-bold transition"
            >
              انصراف
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !botToken.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse disabled:opacity-50 shadow-md shadow-blue-600/20"
            >
              <span>مرحله بعد</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={loading || !botToken.trim() || !destinationChannel.trim()}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 space-x-reverse disabled:opacity-50 shadow-md shadow-emerald-600/20"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-300" />
              )}
              <span>ذخیره، راه‌اندازی و اتصال فوری</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
