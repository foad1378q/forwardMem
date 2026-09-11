import React, { useEffect } from 'react';
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
  Clock,
  ShieldAlert,
  Sparkles,
  Megaphone,
  X,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { SystemStats } from '../types';

export interface NavSection {
  id: string;
  label: string;
  icon: React.ElementType;
  category: 'overview' | 'automation' | 'telegram' | 'processing' | 'system';
  requiresAdmin?: boolean;
}

export const NAV_SECTIONS: NavSection[] = [
  // Overview
  {
    id: 'stats-overview',
    label: 'آمار و سلامت سیستم',
    icon: BarChart3,
    category: 'overview',
  },

  // Automation & Delivery
  {
    id: 'queue-management-card',
    label: 'صف ارسال هوشمند',
    icon: Clock,
    category: 'automation',
  },
  {
    id: 'engagement-center-card',
    label: 'دکمه‌های شیشه‌ای و تعاملی',
    icon: Sparkles,
    category: 'automation',
  },
  {
    id: 'ad-banner-card',
    label: 'بنر تبلیغاتی و اسپانسر',
    icon: Megaphone,
    category: 'automation',
  },
  {
    id: 'report-group-card',
    label: 'کانال گزارشات و هشدار',
    icon: ShieldAlert,
    category: 'automation',
  },

  // Telegram Infrastructure
  {
    id: 'telegram-client-card',
    label: 'اکانت کلاینت تلگرام',
    icon: Smartphone,
    category: 'telegram',
  },
  {
    id: 'bot-setup-card',
    label: 'ربات ارسال‌کننده و مقصد',
    icon: Bot,
    category: 'telegram',
  },
  {
    id: 'in-bot-admin-card',
    label: 'مدیریت درون تلگرام',
    icon: MessageSquareCode,
    category: 'telegram',
  },

  // Content & Filtering
  {
    id: 'ai-processing-center-card',
    label: 'فیلتر کلمات و پاکسازی',
    icon: Cpu,
    category: 'processing',
  },
  {
    id: 'sources-table',
    label: 'کانال‌های مبدا',
    icon: Radio,
    category: 'processing',
  },
  {
    id: 'logs-panel',
    label: 'لاگ‌ها و سوابق فعالیت',
    icon: FileText,
    category: 'processing',
  },

  // System & Database
  {
    id: 'database-management-card',
    label: 'پایگاه داده و پشتیبان',
    icon: HardDrive,
    requiresAdmin: true,
    category: 'system',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  overview: 'وضعیت و آمار',
  automation: 'ارسال و اتوماسیون',
  telegram: 'زیرساخت تلگرام',
  processing: 'فیلترها و کانال‌ها',
  system: 'تنظیمات و امنیت',
};

interface SidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (id: string) => void;
  viewMode: 'all' | 'single';
  setViewMode: (mode: 'all' | 'single') => void;
  isAdmin?: boolean;
  onRequireLogin?: (callback?: () => void) => void;
  stats?: SystemStats;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  viewMode,
  setViewMode,
  isAdmin = true,
  onRequireLogin,
  stats,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNavClick = (sec: NavSection) => {
    if (sec.requiresAdmin && !isAdmin && onRequireLogin) {
      onRequireLogin(() => {
        setActiveTab(sec.id);
        scrollToElement(sec.id);
        onClose();
      });
      return;
    }

    setActiveTab(sec.id);
    if (viewMode === 'all') {
      scrollToElement(sec.id);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    onClose();
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

  const categories = ['overview', 'automation', 'telegram', 'processing', 'system'] as const;

  return (
    <>
      {/* Backdrop with real-time blur and dark scrim covering the entire screen */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 transition-all duration-300 ease-in-out ${
          isOpen
            ? 'opacity-100 pointer-events-auto bg-slate-950/60 backdrop-blur-md'
            : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
        id="sidebar-backdrop"
      />

      {/* Slide-Out Drawer from Right (RTL) */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-72 sm:w-80 max-w-[88vw] bg-slate-900 border-l border-slate-800/90 shadow-2xl text-slate-100 flex flex-col transition-transform duration-300 ease-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="سایدبار ناوبری عمودی"
        id="vertical-sidebar"
      >
        {/* Minimalist Sidebar Header */}
        <div className="px-4 py-3.5 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0 bg-slate-900">
          <div className="flex items-center space-x-2 space-x-reverse min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Send className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-black text-white tracking-wide truncate">
                فهرست بخش‌های سامانه
              </h2>
              <span className="text-3xs text-slate-400 font-medium block">
                دسترسی سریع به ۱۲ بخش
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition flex items-center justify-center active:scale-95 shrink-0"
            title="بستن منو (Esc)"
            id="sidebar-close-btn"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Compact View Mode Switcher */}
        <div className="px-3.5 py-2 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between gap-2 shrink-0">
          <span className="text-3xs font-medium text-slate-400">حالت نمایش:</span>
          <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setViewMode('all')}
              className={`px-2 py-0.5 rounded-md text-3xs font-bold transition flex items-center gap-1 ${
                viewMode === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-2.5 h-2.5" />
              <span>همه کارت‌ها</span>
            </button>
            <button
              onClick={() => setViewMode('single')}
              className={`px-2 py-0.5 rounded-md text-3xs font-bold transition flex items-center gap-1 ${
                viewMode === 'single'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-2.5 h-2.5" />
              <span>تک‌بخش</span>
            </button>
          </div>
        </div>

        {/* Clean, Keyword-Focused, Easily Scrollable Menu List */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3.5 custom-scrollbar">
          {categories.map((catKey) => {
            const items = NAV_SECTIONS.filter((s) => s.category === catKey);
            if (items.length === 0) return null;

            return (
              <div key={catKey} className="space-y-1">
                {/* Clean Group Header */}
                <div className="px-2 py-0.5 text-3xs font-bold text-slate-400 tracking-wider">
                  {CATEGORY_LABELS[catKey]}
                </div>

                {/* Compact Menu Items */}
                <div className="space-y-0.5">
                  {items.map((sec) => {
                    const Icon = sec.icon;
                    const isActive = activeTab === sec.id;
                    const isLocked = sec.requiresAdmin && !isAdmin;

                    return (
                      <button
                        key={sec.id}
                        onClick={() => handleNavClick(sec)}
                        className={`w-full group text-right px-2.5 py-2 rounded-xl transition-all flex items-center justify-between gap-2 relative ${
                          isActive
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'hover:bg-slate-800/70 text-slate-300 hover:text-white'
                        }`}
                        id={`sidebar-item-${sec.id}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive
                                ? 'text-white'
                                : 'text-slate-400 group-hover:text-blue-400'
                            }`}
                          />
                          <span className="text-xs truncate">
                            {sec.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isLocked && (
                            <span className="flex items-center gap-0.5 text-3xs text-amber-400 bg-amber-950/80 border border-amber-800/80 px-1.5 py-0.5 rounded font-medium">
                              <Lock className="w-2.5 h-2.5" />
                              <span>قفل</span>
                            </span>
                          )}

                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Minimalist Bottom Bar */}
        <div className="px-3.5 py-2.5 bg-slate-950/60 border-t border-slate-800/80 shrink-0 flex items-center justify-between text-3xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>{isAdmin ? 'مدیریت تایید شد' : 'مشاهده عمومی'}</span>
          </div>
          <span className="font-mono text-slate-400">Esc: بستن</span>
        </div>
      </aside>
    </>
  );
};
