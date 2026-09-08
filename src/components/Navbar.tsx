import React, { useState } from 'react';
import { BotSettings, SystemStats } from '../types';
import { Lock, Unlock, RefreshCw, Send, KeyRound, Palette, Moon, Sun, Layers, LogOut, Sparkles } from 'lucide-react';

export type AppTheme = 'light' | 'dark' | 'neumorphic';

interface NavbarProps {
  settings: BotSettings;
  stats: SystemStats;
  isAdmin: boolean;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  onOpenLogin: () => void;
  onOpenChangePassword: () => void;
  onOpenSetupWizard?: () => void;
  onLogout?: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdmin,
  theme,
  setTheme,
  onOpenLogin,
  onOpenChangePassword,
  onOpenSetupWizard,
  onLogout,
  onRefresh,
  isRefreshing,
}) => {
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  const themeOptions: { id: AppTheme; name: string; icon: React.ElementType; badgeColor: string }[] = [
    { id: 'light', name: 'روشن کلاسیک', icon: Sun, badgeColor: 'bg-amber-400' },
    { id: 'dark', name: 'تاریک (Dark)', icon: Moon, badgeColor: 'bg-indigo-600' },
    { id: 'neumorphic', name: 'نئومورفیسم آبی', icon: Layers, badgeColor: 'bg-blue-500 shadow-xs' },
  ];

  return (
    <header className={`backdrop-blur-xl border-b sticky top-0 z-30 transition-colors duration-300 w-full overflow-visible ${
      theme === 'dark'
        ? 'bg-slate-900/90 border-slate-800 text-white'
        : theme === 'neumorphic'
        ? 'bg-[#e2e8f0]/90 border-slate-300/60 text-slate-800'
        : 'bg-white/90 border-slate-200/80 text-slate-900'
    }`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        
        {/* Brand */}
        <div className="flex items-center space-x-2.5 space-x-reverse min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5 space-x-reverse">
              <h1 className="text-sm sm:text-base font-bold tracking-wide truncate">فروارد هوشمند تلگرام</h1>
              <span className="hidden xs:inline-block text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-mono font-bold shrink-0">
                GramJS v3.0
              </span>
            </div>
            <p className="text-[11px] sm:text-xs opacity-75 truncate hidden xs:block">داشبورد پیشرفته مانیتورینگ و فیلتر کانال‌ها</p>
          </div>
        </div>

        {/* Clean Right Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 space-x-reverse shrink-0">
          
          {/* Quick Setup Wizard Button */}
          {onOpenSetupWizard && (
            <button
              onClick={onOpenSetupWizard}
              className="p-1.5 sm:px-3 sm:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition shadow-xs flex items-center space-x-1 space-x-reverse text-xs font-bold shrink-0 active:scale-95 border border-white/20"
              title="ویزارد راه‌اندازی سریع و تنظیمات No-ENV"
              id="quick-setup-btn"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline-block text-[11px]">راه‌اندازی سریع</span>
            </button>
          )}

          {/* Theme Palette Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              className="p-1.5 sm:p-2 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:opacity-90 text-white rounded-xl transition shadow-sm flex items-center space-x-1 space-x-reverse text-xs font-bold shrink-0 active:scale-95"
              title="تغییر تمپلیت و تم رنگی"
              id="theme-switcher-btn"
            >
              <Palette className="w-4 h-4" />
              <span className="hidden md:inline-block text-[11px]">تمپلیت</span>
            </button>

            {isThemeMenuOpen && (
              <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-fadeIn text-slate-800 dark:text-slate-100">
                <div className="text-[10px] font-bold text-slate-400 px-2 py-1 border-b border-slate-100 dark:border-slate-800 mb-1">
                  انتخاب تمپلیت و رنگ:
                </div>
                {themeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = theme === opt.id;

                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setTheme(opt.id);
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Icon className="w-4 h-4" />
                        <span>{opt.name}</span>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full ${opt.badgeColor}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition border border-slate-200 dark:border-slate-700 focus:outline-none shrink-0"
            title="به‌روزرسانی اطلاعات"
            id="refresh-btn"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Admin & Password buttons */}
          {isAdmin ? (
            <div className="flex items-center space-x-1.5 space-x-reverse">
              <button
                onClick={onOpenChangePassword}
                className="flex items-center space-x-1 space-x-reverse px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition shrink-0"
                id="change-password-btn"
                title="تغییر رمز عبور ادمین"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline-block">تغییر رمز</span>
              </button>

              <div className="flex items-center space-x-1 space-x-reverse px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-bold shrink-0">
                <Unlock className="w-3.5 h-3.5" />
                <span className="hidden xs:inline-block">ادمین تایید شد</span>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition flex items-center space-x-1 space-x-reverse shrink-0"
                  title="خروج از حساب ادمین"
                  id="logout-btn"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline-block">خروج</span>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center space-x-1.5 space-x-reverse px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition shrink-0 active:scale-95"
              id="admin-login-btn"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>ورود ادمین (رمز عبور)</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
