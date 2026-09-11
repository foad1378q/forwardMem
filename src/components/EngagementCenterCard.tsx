import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Heart,
  Flame,
  ThumbsUp,
  Share2,
  ExternalLink,
  Plus,
  Trash2,
  Save,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Sliders,
  Eye,
  Link,
  Users,
} from 'lucide-react';
import { ReactionSettings, InteractiveButtonsSettings, InlineButtonConfig } from '../types';
import {
  getReactionSettings,
  saveReactionSettings,
  getInteractiveButtonsSettings,
  saveInteractiveButtonsSettings,
  testPostEngagement,
} from '../lib/telegramApi';

interface EngagementCenterCardProps {
  destinationChannel?: string;
  onRefresh?: () => void;
}

const EMOJI_PRESETS = [
  { name: 'محبوب و پرانرژی', emojis: ['👍', '❤️', '🔥', '👏'] },
  { name: 'حرفه‌ای و تخصصی', emojis: ['🚀', '💯', '⭐', '💡'] },
  { name: 'نظرسنجی و بازخورد', emojis: ['👍', '👎', '❤️', '😍'] },
  { name: 'جوان‌پسند و فان', emojis: ['😂', '🔥', '👀', '🎉'] },
];

export const EngagementCenterCard: React.FC<EngagementCenterCardProps> = ({
  destinationChannel,
  onRefresh,
}) => {
  // Reaction State
  const [rxSettings, setRxSettings] = useState<ReactionSettings>({
    enableReactions: true,
    emojis: ['👍', '❤️', '🔥', '👏'],
    allowMultiple: false,
    totalReactionsCount: 0,
  });

  // Interactive Buttons State
  const [btnSettings, setBtnSettings] = useState<InteractiveButtonsSettings>({
    enableButtons: true,
    enableChannelJoinButton: true,
    channelJoinText: '📢 عضویت در کانال',
    channelJoinUrl: '',
    enableShareButton: true,
    shareText: '🔄 اشتراک‌گذاری پست',
    customButtons: [],
  });

  // UI States
  const [activeSubTab, setActiveSubTab] = useState<'reactions' | 'buttons' | 'preview'>('reactions');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // New Custom Button Inputs
  const [newBtnText, setNewBtnText] = useState('');
  const [newBtnUrl, setNewBtnUrl] = useState('');
  const [newCustomEmoji, setNewCustomEmoji] = useState('');

  // Mock interaction state for dashboard preview
  const [previewVotes, setPreviewVotes] = useState<Record<string, number>>({
    '👍': 14,
    '❤️': 28,
    '🔥': 19,
    '👏': 9,
  });
  const [userSelectedEmoji, setUserSelectedEmoji] = useState<string | null>('❤️');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [rxRes, btnRes] = await Promise.all([
        getReactionSettings(),
        getInteractiveButtonsSettings(),
      ]);
      if (rxRes.success && rxRes.reactions) {
        setRxSettings(rxRes.reactions);
      }
      if (btnRes.success && btnRes.buttons) {
        setBtnSettings(btnRes.buttons);
      }
    } catch (err: any) {
      console.error('Error loading engagement settings:', err);
      setErrorMsg('خطا در بارگذاری تنظیمات تعامل و دکمه‌ها.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    setErrorMsg(null);
    try {
      const [rxRes, btnRes] = await Promise.all([
        saveReactionSettings(rxSettings),
        saveInteractiveButtonsSettings(btnSettings),
      ]);

      if (rxRes.success && btnRes.success) {
        setSaveSuccess('تنظیمات شمارنده ری‌اکشن‌ها و دکمه‌های تعاملی با موفقیت ذخیره شد.');
        setTimeout(() => setSaveSuccess(null), 4000);
        if (onRefresh) onRefresh();
      } else {
        setErrorMsg(rxRes.message || btnRes.message || 'خطا در ذخیره تنظیمات');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطای غیرمنتظره در ذخیره تنظیمات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPost = async () => {
    setIsTesting(true);
    setTestResult(null);
    setErrorMsg(null);
    try {
      const res = await testPostEngagement();
      if (res.success) {
        setTestResult('پیام نمونه با موفقیت به کانال مقصد ارسال گردید!');
        setTimeout(() => setTestResult(null), 5000);
      } else {
        setErrorMsg(res.message || 'خطا در ارسال پیام تستی');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در برقراری ارتباط با سرور');
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddEmoji = () => {
    const trimmed = newCustomEmoji.trim();
    if (!trimmed) return;
    if (rxSettings.emojis.includes(trimmed)) {
      setErrorMsg('این ایموجی قبلاً اضافه شده است.');
      return;
    }
    if (rxSettings.emojis.length >= 8) {
      setErrorMsg('حداکثر می‌توانید تا ۸ ایموجی تنظیم کنید.');
      return;
    }
    setRxSettings({
      ...rxSettings,
      emojis: [...rxSettings.emojis, trimmed],
    });
    setNewCustomEmoji('');
  };

  const handleRemoveEmoji = (emojiToRemove: string) => {
    if (rxSettings.emojis.length <= 1) {
      setErrorMsg('حداقل یک ایموجی باید در لیست باقی بماند.');
      return;
    }
    setRxSettings({
      ...rxSettings,
      emojis: rxSettings.emojis.filter((e) => e !== emojiToRemove),
    });
  };

  const handleApplyPreset = (presetEmojis: string[]) => {
    setRxSettings({
      ...rxSettings,
      emojis: [...presetEmojis],
    });
  };

  const handleAddCustomButton = () => {
    if (!newBtnText.trim() || !newBtnUrl.trim()) {
      setErrorMsg('متن و آدرس لینک برای دکمه الزامی است.');
      return;
    }
    let url = newBtnUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('tg://')) {
      url = `https://${url}`;
    }

    const newBtn: InlineButtonConfig = {
      id: `btn_${Date.now()}`,
      text: newBtnText.trim(),
      url: url,
    };

    setBtnSettings({
      ...btnSettings,
      customButtons: [...(btnSettings.customButtons || []), newBtn],
    });
    setNewBtnText('');
    setNewBtnUrl('');
    setErrorMsg(null);
  };

  const handleRemoveCustomButton = (id: string) => {
    setBtnSettings({
      ...btnSettings,
      customButtons: (btnSettings.customButtons || []).filter((b) => b.id !== id),
    });
  };

  const handlePreviewEmojiClick = (emoji: string) => {
    setPreviewVotes((prev) => {
      const copy = { ...prev };
      if (userSelectedEmoji === emoji) {
        copy[emoji] = Math.max(0, (copy[emoji] || 1) - 1);
        setUserSelectedEmoji(null);
      } else {
        if (userSelectedEmoji && !rxSettings.allowMultiple) {
          copy[userSelectedEmoji] = Math.max(0, (copy[userSelectedEmoji] || 1) - 1);
        }
        copy[emoji] = (copy[emoji] || 0) + 1;
        setUserSelectedEmoji(emoji);
      }
      return copy;
    });
  };

  return (
    <div id="engagement-center-card" className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-800">
                مرکز تعامل و دکمه‌های شیشه‌ای پست‌ها
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-3xs font-black">
                Interactive Posts
              </span>
            </div>
            <p className="text-2xs text-slate-500 mt-0.5">
              شمارنده هوشمند واکنش ایموجی و دکمه‌های شیشه‌ای تلگرام زیر پیام‌های فوروارد شده
            </p>
          </div>
        </div>

        {/* Global Save & Test Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestPost}
            disabled={isTesting || !destinationChannel}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            title="ارسال یک پست آزمایشی به کانال مقصد جهت بررسی دکمه‌ها"
          >
            <Send className={`w-3.5 h-3.5 ${isTesting ? 'animate-bounce' : ''}`} />
            {isTesting ? 'در حال ارسال...' : 'تست در کانال مقصد'}
          </button>

          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'در حال ذخیره...' : 'ذخیره کلیه تنظیمات'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {testResult && (
        <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{testResult}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Internal Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 space-x-reverse border-b border-slate-100 pb-1">
        <button
          onClick={() => setActiveSubTab('reactions')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'reactions'
              ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Heart className="w-4 h-4 text-rose-500" />
          شمارنده ری‌اکشن‌ها (Reactions)
        </button>

        <button
          onClick={() => setActiveSubTab('buttons')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'buttons'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ExternalLink className="w-4 h-4 text-indigo-600" />
          دکمه‌های شیشه‌ای تعاملی (Inline Buttons)
        </button>

        <button
          onClick={() => setActiveSubTab('preview')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'preview'
              ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Eye className="w-4 h-4 text-amber-600" />
          پیش‌نمایش زنده در تلگرام
        </button>
      </div>

      {/* TAB 1: Reactions Settings */}
      {activeSubTab === 'reactions' && (
        <div className="space-y-6">
          {/* Main Activation Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
            <div>
              <span className="text-xs font-black text-slate-800 block">
                فعال‌سازی شمارنده ری‌اکشن زیر پست‌ها
              </span>
              <span className="text-2xs text-slate-500">
                در زیر هر پست فوروارد شده، دکمه‌های شیشه‌ای حاوی ایموجی و تعداد واکنش کاربران درج می‌شود.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={rxSettings.enableReactions}
                onChange={(e) => setRxSettings({ ...rxSettings, enableReactions: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Emoji Preset Buttons */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-700 block">
              قالب‌های آماده ایموجی ری‌اکشن:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {EMOJI_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handleApplyPreset(preset.emojis)}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 text-right transition flex items-center justify-between cursor-pointer group"
                >
                  <div>
                    <span className="text-2xs font-bold text-slate-700 block group-hover:text-rose-700">
                      {preset.name}
                    </span>
                    <div className="text-base mt-1 tracking-wider">
                      {preset.emojis.join(' ')}
                    </div>
                  </div>
                  <span className="text-3xs text-rose-600 font-bold opacity-0 group-hover:opacity-100 transition">
                    انتخاب
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Emojis List & Custom Adder */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                ایموجی‌های فعال کنونی ({rxSettings.emojis.length} از ۸):
              </span>
              <span className="text-3xs text-slate-400">
                با کلیک بر روی علامت حذف، ایموجی برداشته می‌شود.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {rxSettings.emojis.map((emoji) => (
                <div
                  key={emoji}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs font-bold text-sm"
                >
                  <span className="text-base">{emoji}</span>
                  <button
                    onClick={() => handleRemoveEmoji(emoji)}
                    className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="حذف ایموجی"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Custom Emoji Input */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
              <input
                type="text"
                value={newCustomEmoji}
                onChange={(e) => setNewCustomEmoji(e.target.value)}
                placeholder="افزودن ایموجی جدید (مثلاً 🔥 یا 👏)"
                className="w-48 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-400"
              />
              <button
                onClick={handleAddEmoji}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                افزودن
              </button>
            </div>
          </div>

          {/* Multiple Reaction Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                امکان ثبت چند واکنش همزمان توسط یک کاربر
              </span>
              <span className="text-2xs text-slate-500">
                در صورت غیرفعال بودن، ثبت واکنش جدید واکنش قبلی کاربر را جایگزین می‌کند (مانند تلگرام پرمیوم).
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={rxSettings.allowMultiple}
                onChange={(e) => setRxSettings({ ...rxSettings, allowMultiple: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
            </label>
          </div>
        </div>
      )}

      {/* TAB 2: Interactive Inline Buttons */}
      {activeSubTab === 'buttons' && (
        <div className="space-y-6">
          {/* Main Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
            <div>
              <span className="text-xs font-black text-slate-800 block">
                فعال‌سازی دکمه‌های شیشه‌ای زیر پست‌ها
              </span>
              <span className="text-2xs text-slate-500">
                افزودن دکمه‌های لینک‌دار شیشه‌ای (Inline Keyboard) جهت افزایش عضویت، بازنشر و هدایت کاربران
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={btnSettings.enableButtons}
                onChange={(e) => setBtnSettings({ ...btnSettings, enableButtons: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Standard Channel Join Button */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">
                  دکمه عضویت در کانال (Join Channel)
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={btnSettings.enableChannelJoinButton}
                  onChange={(e) =>
                    setBtnSettings({ ...btnSettings, enableChannelJoinButton: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-3xs font-bold text-slate-600 block mb-1">متن روی دکمه:</label>
                <input
                  type="text"
                  value={btnSettings.channelJoinText || ''}
                  onChange={(e) =>
                    setBtnSettings({ ...btnSettings, channelJoinText: e.target.value })
                  }
                  placeholder="📢 عضویت در کانال"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="text-3xs font-bold text-slate-600 block mb-1">
                  لینک اختصاصی کانال (اختیاری):
                </label>
                <input
                  type="text"
                  value={btnSettings.channelJoinUrl || ''}
                  onChange={(e) =>
                    setBtnSettings({ ...btnSettings, channelJoinUrl: e.target.value })
                  }
                  placeholder="https://t.me/your_channel (در صورت خالی بودن خودکار از کانال مقصد استفاده می‌شود)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 font-mono text-left dir-ltr"
                />
              </div>
            </div>
          </div>

          {/* Standard Share Button */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  دکمه اشتراک‌گذاری پست (Share Button)
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={btnSettings.enableShareButton}
                  onChange={(e) =>
                    setBtnSettings({ ...btnSettings, enableShareButton: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div>
              <label className="text-3xs font-bold text-slate-600 block mb-1">متن روی دکمه:</label>
              <input
                type="text"
                value={btnSettings.shareText || ''}
                onChange={(e) => setBtnSettings({ ...btnSettings, shareText: e.target.value })}
                placeholder="🔄 بازنشر پست"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-400 max-w-sm"
              />
            </div>
          </div>

          {/* Custom Buttons Section */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">
                  دکمه‌های شیشه‌ای سفارشی (وبسایت، ارتباط، فروشگاه و ...)
                </span>
              </div>
              <span className="text-3xs text-slate-500">
                {(btnSettings.customButtons || []).length} دکمه فعال
              </span>
            </div>

            {/* List of Custom Buttons */}
            {(btnSettings.customButtons || []).length > 0 && (
              <div className="space-y-2">
                {btnSettings.customButtons.map((btn) => (
                  <div
                    key={btn.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-black">
                        {btn.text}
                      </span>
                      <span className="text-2xs text-slate-400 font-mono dir-ltr">{btn.url}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveCustomButton(btn.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="حذف دکمه"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Custom Button Form */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
              <span className="text-2xs font-bold text-slate-700 block">افزودن دکمه شیشه‌ای جدید:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newBtnText}
                  onChange={(e) => setNewBtnText(e.target.value)}
                  placeholder="عنوان دکمه (مثلاً: 🌐 وب‌سایت رسمی)"
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                />
                <input
                  type="text"
                  value={newBtnUrl}
                  onChange={(e) => setNewBtnUrl(e.target.value)}
                  placeholder="آدرس اینترنتی (https://example.com)"
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 font-mono text-left dir-ltr"
                />
              </div>
              <button
                onClick={handleAddCustomButton}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                ثبت دکمه جدید
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Live Realistic Telegram Mockup Preview */}
      {activeSubTab === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              <strong>پیش‌نمایش تعاملی:</strong> دکمه‌های زیر دقیقاً همانند محیط واقعی تلگرام رندر شده و قابل کلیک می‌باشند.
            </span>
            <span className="text-2xs text-slate-400">شبیه‌ساز پیام‌رسان تلگرام</span>
          </div>

          {/* Telegram Message Box Mockup */}
          <div className="max-w-md mx-auto bg-[#efeae2] dark:bg-slate-950 p-4 rounded-3xl border border-slate-300/80 shadow-inner">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/70 dark:border-slate-800 space-y-3">
              {/* Channel Header in Message */}
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-black text-xs flex items-center justify-center">
                  کانال
                </div>
                <div>
                  <span className="text-2xs font-bold text-slate-800 block">
                    {destinationChannel || 'کانال تلگرامی من'}
                  </span>
                  <span className="text-3xs text-slate-400 font-mono">14:35</span>
                </div>
              </div>

              {/* Message Content */}
              <div className="text-xs text-slate-700 leading-relaxed space-y-1.5">
                <p className="font-bold text-slate-900">
                  اطلاعیه مهم و جدیدترین اخبار روز 🚀
                </p>
                <p>
                  این یک نمونه از پست فوروارد شده با تمام فرمت‌های متنی و استایل‌های تلگرام است. سیستم به صورت کاملاً خودکار دکمه‌های شیشه‌ای تعاملی و شمارنده ری‌اکشن‌ها را در پایین پیام می‌چسباند.
                </p>
              </div>

              {/* Glass / Inline Buttons Mockup */}
              <div className="space-y-1.5 pt-2">
                {/* Row 1: Reactions */}
                {rxSettings.enableReactions && rxSettings.emojis.length > 0 && (
                  <div className="grid grid-flow-col auto-cols-fr gap-1.5">
                    {rxSettings.emojis.map((emoji) => {
                      const count = previewVotes[emoji] || 0;
                      const isSelected = userSelectedEmoji === emoji;
                      return (
                        <button
                          key={emoji}
                          onClick={() => handlePreviewEmojiClick(emoji)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer select-none border ${
                            isSelected
                              ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                              : 'bg-slate-100/90 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span className="text-sm">{emoji}</span>
                          <span className="text-2xs font-mono">{count > 0 ? count : ''}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Row 2: Standard Buttons */}
                {btnSettings.enableButtons && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {btnSettings.enableChannelJoinButton && (
                      <a
                        href={btnSettings.channelJoinUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-2xs font-bold text-center block transition truncate cursor-pointer"
                      >
                        {btnSettings.channelJoinText || '📢 عضویت در کانال'}
                      </a>
                    )}
                    {btnSettings.enableShareButton && (
                      <button
                        className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-2xs font-bold text-center block transition truncate cursor-pointer"
                      >
                        {btnSettings.shareText || '🔄 بازنشر'}
                      </button>
                    )}
                  </div>
                )}

                {/* Row 3: Custom Buttons */}
                {btnSettings.enableButtons &&
                  btnSettings.customButtons &&
                  btnSettings.customButtons.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {btnSettings.customButtons.map((btn) => (
                        <a
                          key={btn.id}
                          href={btn.url}
                          target="_blank"
                          rel="noreferrer"
                          className="py-2 px-3 rounded-xl bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-2xs font-bold text-center block transition truncate cursor-pointer"
                        >
                          {btn.text}
                        </a>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
