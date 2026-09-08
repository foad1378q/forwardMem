import React, { useState, useEffect, useCallback } from 'react';
import { BotSettings, SourceChannel, ActivityLog, SystemStats } from './types';
import { getSettings, getSources, getLogs, getStats } from './lib/telegramApi';
import { Navbar, AppTheme } from './components/Navbar';
import { TaskbarNav } from './components/TaskbarNav';
import { StatsOverview } from './components/StatsOverview';
import { TelegramClientCard } from './components/TelegramClientCard';
import { BotSetupCard } from './components/BotSetupCard';
import { AiProcessingCenterCard } from './components/AiProcessingCenterCard';
import { SourcesTable } from './components/SourcesTable';
import { AddSourceModal } from './components/AddSourceModal';
import { FeedPreviewModal } from './components/FeedPreviewModal';
import { QuickTestModal } from './components/QuickTestModal';
import { LogsPanel } from './components/LogsPanel';
import { AdminLoginModal } from './components/AdminLoginModal';
import { DatabaseManagementCard } from './components/DatabaseManagementCard';
import { InBotManagementCard } from './components/InBotManagementCard';
import { SetupWizardModal } from './components/SetupWizardModal';
import { Lock, KeyRound } from 'lucide-react';

export default function App() {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return sessionStorage.getItem('is_admin') === 'true';
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState<boolean>(false);
  const [loginModalMode, setLoginModalMode] = useState<'login' | 'change_password'>('login');
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('app_theme');
    return (saved as AppTheme) || 'light';
  });

  const handleSetTheme = (newTheme: AppTheme) => {
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [activeTab, setActiveTab] = useState<string>('stats-overview');
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');

  const [settings, setSettings] = useState<BotSettings>({
    botToken: '',
    destinationChannel: '',
    isVerified: false,
  });

  const [sources, setSources] = useState<SourceChannel[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalSources: 0,
    activeSources: 0,
    totalTransferred: 0,
    isPollingActive: false,
    botStatus: 'not_configured',
    uptimeSeconds: 0,
  });

  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState<boolean>(false);
  const [isQuickTestOpen, setIsQuickTestOpen] = useState<boolean>(false);
  const [previewSource, setPreviewSource] = useState<SourceChannel | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Fetch all app data
  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [settingsRes, sourcesRes, logsRes, statsRes] = await Promise.all([
        getSettings(),
        getSources(),
        getLogs(),
        getStats(),
      ]);

      if (settingsRes?.settings) setSettings(settingsRes.settings);
      if (sourcesRes?.sources) setSources(sourcesRes.sources);
      if (logsRes?.logs) setLogs(logsRes.logs);
      if (statsRes?.stats) setStats(statsRes.stats);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initial load & Polling interval
  useEffect(() => {
    fetchData();
    // Check if initial setup is needed (No-ENV first install)
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.isConfigured) {
          setIsSetupWizardOpen(true);
        }
      })
      .catch(() => {});

    const interval = setInterval(fetchData, 10000); // 10s auto refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleOpenLogin = (callback?: () => void) => {
    setLoginModalMode('login');
    if (callback) setPendingCallback(() => callback);
    setIsLoginModalOpen(true);
  };

  const handleLoginSuccess = () => {
    setIsAdmin(true);
    sessionStorage.setItem('is_admin', 'true');
    if (pendingCallback) {
      pendingCallback();
      setPendingCallback(null);
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem('is_admin');
  };

  // Helper function to check if card should be shown
  const shouldShow = (cardId: string) => {
    return viewMode === 'all' || activeTab === cardId;
  };

  const getContainerBg = () => {
    switch (theme) {
      case 'dark':
        return 'bg-slate-950 text-slate-100 dark';
      case 'neumorphic':
        return 'bg-[#dce3ee] text-slate-800';
      case 'light':
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className={`min-h-screen ${getContainerBg()} transition-colors duration-500 flex flex-col font-sans selection:bg-blue-500 selection:text-white dir-rtl pb-16 md:pb-0`}>
      
      {/* Top Header Navbar */}
      <Navbar
        settings={settings}
        stats={stats}
        isAdmin={isAdmin}
        theme={theme}
        setTheme={handleSetTheme}
        onOpenLogin={() => handleOpenLogin()}
        onOpenChangePassword={() => {
          setLoginModalMode('change_password');
          setIsLoginModalOpen(true);
        }}
        onOpenSetupWizard={() => setIsSetupWizardOpen(true)}
        onLogout={handleLogout}
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
      />

      {/* Taskbar Navigation for quick access & responsive mobile tabs */}
      <TaskbarNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isAdmin={isAdmin}
        onRequireLogin={handleOpenLogin}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-28 space-y-6 overflow-x-hidden">
        
        {/* System Stats Overview */}
        {shouldShow('stats-overview') && (
          <div id="stats-overview">
            <StatsOverview stats={stats} />
          </div>
        )}

        {/* Telegram Client Connection Card */}
        {shouldShow('telegram-client-card') && (
          <div id="telegram-client-card">
            <TelegramClientCard
              clientConfig={stats.clientConfig}
              onConfigChange={fetchData}
            />
          </div>
        )}

        {/* Bot Token & Destination Setup Card */}
        {shouldShow('bot-setup-card') && (
          <div id="bot-setup-card">
            <BotSetupCard
              settings={settings}
              onSettingsSaved={fetchData}
              isAdmin={isAdmin}
              onRequireLogin={() => handleOpenLogin()}
            />
          </div>
        )}

        {/* In-Bot Telegram Management & Live Simulator */}
        {shouldShow('in-bot-admin-card') && (
          <div id="in-bot-admin-card">
            <InBotManagementCard
              settings={settings}
              isMonitoringPaused={!!stats.clientConfig?.isMonitoringPaused}
              onTogglePause={fetchData}
              onRefreshData={fetchData}
            />
          </div>
        )}

        {/* AI Message Processing Center */}
        {shouldShow('ai-processing-center-card') && (
          <div id="ai-processing-center-card">
            <AiProcessingCenterCard
              isAdmin={isAdmin}
              onRequireLogin={() => handleOpenLogin()}
              onSettingsSaved={fetchData}
            />
          </div>
        )}

        {/* Monitored Channels & Groups Table */}
        {shouldShow('sources-table') && (
          <div id="sources-table">
            <SourcesTable
              sources={sources}
              onRefresh={fetchData}
              onPreviewChannel={(source) => setPreviewSource(source)}
              onOpenAddModal={() => setIsAddSourceModalOpen(true)}
              isAdmin={isAdmin}
              onRequireLogin={() => handleOpenLogin()}
            />
          </div>
        )}

        {/* Realtime Logs Panel */}
        {shouldShow('logs-panel') && (
          <div id="logs-panel">
            <LogsPanel
              logs={logs}
              onRefresh={fetchData}
              isAdmin={isAdmin}
              onRequireLogin={() => handleOpenLogin()}
            />
          </div>
        )}

        {/* Backup & Data Management Card */}
        {shouldShow('database-management-card') && (
          <div id="database-management-card">
            {isAdmin ? (
              <DatabaseManagementCard onRefreshAll={fetchData} />
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center shadow-xs space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-base font-black text-slate-800">بخش مدیریت و پشتیبان‌گیری قفل است</h3>
                  <p className="text-xs text-slate-500">
                    برای دسترسی به ایجاد پشتیبان، استخراج داده‌ها و بازنشانی، لطفاً با رمز عبور ادمین وارد شوید.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenLogin(() => setActiveTab('database-management-card'))}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition inline-flex items-center space-x-2 space-x-reverse"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>ورود به حساب ادمین</span>
                </button>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>سامانه مانیتورینگ و فروارد هوشمند تلگرام (GramJS) - مدیریت و پشتیبان‌گیری داده‌ها</p>
          <div className="flex items-center space-x-4 space-x-reverse text-slate-500">
            <span>پشتیبانی از متن، آلبوم، عکس، ویدیو، فیلتر کلمات و امضا</span>
            <span>•</span>
            <span className="text-emerald-600 font-bold">🟢 سیستم فعال</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        mode={loginModalMode}
        onClose={() => {
          setIsLoginModalOpen(false);
          setPendingCallback(null);
        }}
        onSuccess={handleLoginSuccess}
      />

      <AddSourceModal
        isOpen={isAddSourceModalOpen}
        onClose={() => setIsAddSourceModalOpen(false)}
        onSourceAdded={() => {
          fetchData();
        }}
      />

      <FeedPreviewModal
        isOpen={!!previewSource}
        onClose={() => setPreviewSource(null)}
        source={previewSource}
      />

      <QuickTestModal
        isOpen={isQuickTestOpen}
        onClose={() => setIsQuickTestOpen(false)}
        defaultBotToken={settings.botToken}
        defaultDestination={settings.destinationChannel}
        onSuccess={() => {
          fetchData();
        }}
      />

      <SetupWizardModal
        isOpen={isSetupWizardOpen}
        onClose={() => setIsSetupWizardOpen(false)}
        onSuccess={() => {
          setIsAdmin(true);
          fetchData();
        }}
      />

    </div>
  );
}
