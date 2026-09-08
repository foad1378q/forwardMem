import React from 'react';
import {
  BarChart3,
  Smartphone,
  Bot,
  Cpu,
  Radio,
  FileText,
  HardDrive,
  Grid,
  Layers,
  Lock,
  MessageSquareCode,
} from 'lucide-react';

export interface NavSection {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  badge?: string;
  requiresAdmin?: boolean;
}

export const NAV_SECTIONS: NavSection[] = [
  { id: 'stats-overview', label: 'آمار کلی', shortLabel: 'آمار', icon: BarChart3 },
  { id: 'telegram-client-card', label: 'حساب تلگرام', shortLabel: 'اکانت', icon: Smartphone },
  { id: 'bot-setup-card', label: 'تنظیمات ربات', shortLabel: 'ربات', icon: Bot },
  { id: 'in-bot-admin-card', label: 'مدیریت از داخل ربات', shortLabel: 'مدیریت ربات', icon: MessageSquareCode },
  { id: 'ai-processing-center-card', label: 'پردازش هوشمند', shortLabel: 'پردازش', icon: Cpu },
  { id: 'sources-table', label: 'کانال‌های مبدا', shortLabel: 'کانال‌ها', icon: Radio },
  { id: 'logs-panel', label: 'گزارشات لاگ', shortLabel: 'لاگ‌ها', icon: FileText },
  { id: 'database-management-card', label: 'پشتیبان‌گیری', shortLabel: 'پشتیبان', icon: HardDrive, requiresAdmin: true },
];

interface TaskbarNavProps {
  activeTab: string;
  setActiveTab: (id: string) => void;
  viewMode: 'all' | 'single';
  setViewMode: (mode: 'all' | 'single') => void;
  isAdmin?: boolean;
  onRequireLogin?: (callback?: () => void) => void;
}

export const TaskbarNav: React.FC<TaskbarNavProps> = ({
  activeTab,
  setActiveTab,
  viewMode,
  setViewMode,
  isAdmin = true,
  onRequireLogin,
}) => {
  const handleNavClick = (sec: NavSection) => {
    if (sec.requiresAdmin && !isAdmin && onRequireLogin) {
      onRequireLogin(() => {
        setActiveTab(sec.id);
        scrollToElement(sec.id);
      });
      return;
    }

    setActiveTab(sec.id);
    if (viewMode === 'all') {
      scrollToElement(sec.id);
    }
  };

  const scrollToElement = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    /* Floating Dark Bottom Navigation Dock for Mobile & Desktop */
    <div className="fixed bottom-3 left-2 right-2 sm:left-auto sm:right-1/2 sm:translate-x-1/2 z-40 max-w-4xl w-auto">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 text-white rounded-2xl shadow-2xl p-1.5 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar max-w-full">
        
        {/* Nav Items */}
        <div className="flex items-center space-x-1 space-x-reverse overflow-x-auto no-scrollbar py-0.5">
          {NAV_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeTab === sec.id;
            const isLocked = sec.requiresAdmin && !isAdmin;

            return (
              <button
                key={sec.id}
                onClick={() => handleNavClick(sec)}
                className={`flex flex-col sm:flex-row items-center justify-center py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-xl transition-all shrink-0 select-none ${
                  isActive
                    ? 'text-blue-400 bg-white/15 font-bold shadow-inner border border-white/10 scale-102'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <div className="relative mb-0.5 sm:mb-0 sm:ml-1.5 shrink-0">
                  <Icon className="w-4 h-4" />
                  {isLocked && (
                    <Lock className="w-2.5 h-2.5 text-amber-400 absolute -top-1 -right-1.5 bg-slate-900 rounded-full" />
                  )}
                </div>
                <span className="text-[10px] sm:text-xs whitespace-nowrap">{sec.shortLabel}</span>
                {sec.badge && (
                  <span className="hidden sm:inline-block ml-1 text-[9px] bg-blue-500/30 text-blue-300 border border-blue-400/30 px-1 py-0.2 rounded font-mono">
                    {sec.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* View Mode Toggle Switch on Desktop/Tablet */}
        <div className="hidden md:flex items-center space-x-1 space-x-reverse border-r border-slate-700/80 pr-2 mr-1 shrink-0">
          <button
            onClick={() => setViewMode(viewMode === 'all' ? 'single' : 'all')}
            className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 space-x-reverse ${
              viewMode === 'single' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
            title={viewMode === 'all' ? 'سوئیچ به نمای تک‌کارت' : 'سوئیچ به نمای همه کارت‌ها'}
          >
            {viewMode === 'all' ? <Grid className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
          </button>
        </div>

      </div>
    </div>
  );
};
