import React, { useState, useEffect } from "react";
import {
  Bot,
  Send,
  Play,
  Pause,
  Plus,
  Trash2,
  RefreshCw,
  Sliders,
  FileText,
  Key,
  UserCheck,
  ExternalLink,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
  Lock,
  Copy,
  Check,
  Power,
  AlertOctagon,
  Zap,
} from "lucide-react";
import { BotAdminConfig, BotSettings } from "../types";
import { formatTehranTime } from "../lib/timeUtils";
import { toggleSystemPower, getSystemPower } from "../lib/telegramApi";

interface InBotManagementCardProps {
  settings: BotSettings;
  isMonitoringPaused: boolean;
  onTogglePause?: () => void;
  onRefreshData?: () => void;
}

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: string;
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
  isAlert?: boolean;
}

export const InBotManagementCard: React.FC<InBotManagementCardProps> = ({
  settings,
  isMonitoringPaused: initialPaused,
  onTogglePause,
  onRefreshData,
}) => {
  const [adminUserId, setAdminUserId] = useState<string>("");
  const [adminPasscode, setAdminPasscode] = useState<string>("admin123");
  const [isBotPollingActive, setIsBotPollingActive] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Master Emergency Power Switch
  const [isSystemTurnedOff, setIsSystemTurnedOff] = useState<boolean>(!!settings?.isSystemTurnedOff);
  const [isTogglingPower, setIsTogglingPower] = useState<boolean>(false);
  const [pendingPromptType, setPendingPromptType] = useState<"report_channel" | "dest" | "add_channel" | null>(null);

  // Direct Test to Admin Telegram
  const [isSendingToAdmin, setIsSendingToAdmin] = useState<boolean>(false);
  const [adminSendStatus, setAdminSendStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Telegram Simulator State
  const [simInput, setSimInput] = useState<string>("");
  const [isSimLoading, setIsSimLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeMenuMarkup, setActiveMenuMarkup] = useState<any>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [localPaused, setLocalPaused] = useState<boolean>(initialPaused);

  useEffect(() => {
    setLocalPaused(initialPaused);
  }, [initialPaused]);

  useEffect(() => {
    if (settings?.isSystemTurnedOff !== undefined) {
      setIsSystemTurnedOff(!!settings.isSystemTurnedOff);
    }
  }, [settings?.isSystemTurnedOff]);

  // Fetch Bot Admin Config & Power Status
  const fetchConfig = async () => {
    try {
      const pRes = await getSystemPower();
      if (pRes?.success) {
        setIsSystemTurnedOff(!!pRes.isSystemTurnedOff);
      }
      const res = await fetch("/api/bot-admin/config");
      const data = await res.json();
      if (data.success) {
        if (data.botAdminConfig?.adminTelegramUserId) {
          setAdminUserId(data.botAdminConfig.adminTelegramUserId);
        }
        if (data.botAdminConfig?.adminPasscode) {
          setAdminPasscode(data.botAdminConfig.adminPasscode);
        }
        setIsBotPollingActive(data.botAdminConfig?.isBotPollingActive !== false);
        setLocalPaused(data.isMonitoringPaused);
      }
    } catch (err) {
      console.error("Error fetching bot admin config:", err);
    }
  };

  useEffect(() => {
    fetchConfig();
    initSimulator();
  }, []);

  // Handle Emergency Power Toggle from UI
  const handleToggleEmergencyPower = async () => {
    setIsTogglingPower(true);
    try {
      const nextState = !isSystemTurnedOff;
      const res = await toggleSystemPower(nextState);
      if (res.success) {
        setIsSystemTurnedOff(res.isSystemTurnedOff);
        await initSimulator();
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error("Failed to toggle emergency power:", err);
    } finally {
      setIsTogglingPower(false);
    }
  };

  // Initialize Simulator with Main Menu
  const initSimulator = async () => {
    setIsSimLoading(true);
    try {
      const res = await fetch("/api/bot-admin/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "menu" }),
      });
      const data = await res.json();
      if (data.success) {
        setChatMessages([
          {
            id: `msg_${Date.now()}`,
            sender: "bot",
            text: data.text,
            timestamp: formatTehranTime(new Date(), false),
            replyMarkup: data.reply_markup,
          },
        ]);
        setActiveMenuMarkup(data.reply_markup);
      }
    } catch (err) {
      console.error("Simulator init error:", err);
    } finally {
      setIsSimLoading(false);
    }
  };

  // Handle Save Admin Config
  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      const res = await fetch("/api/bot-admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminTelegramUserId: adminUserId.trim(),
          adminPasscode: adminPasscode.trim(),
          enableInBotAdmin: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess("تنظیمات با موفقیت ذخیره شد.");
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setSaveError(data.message || "خطا در ذخیره اطلاعات.");
      }
    } catch (err: any) {
      setSaveError(err.message || "خطای برقراری ارتباط با سرور.");
    } finally {
      setIsSaving(false);
    }
  };

  // Send Menu Direct to Admin's Private Telegram
  const handleSendToAdminTelegram = async () => {
    if (!adminUserId) {
      setAdminSendStatus({
        success: false,
        message: "لطفاً ابتدا شناسه عددی تلگرام خود را وارد و ذخیره کنید.",
      });
      return;
    }
    setIsSendingToAdmin(true);
    setAdminSendStatus(null);
    try {
      const res = await fetch("/api/bot-admin/send-test-to-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminTelegramUserId: adminUserId }),
      });
      const data = await res.json();
      setAdminSendStatus({
        success: data.success,
        message: data.message || (data.success ? "منوی مدیریت به تلگرام شما ارسال شد." : "خطا در ارسال."),
      });
    } catch (err: any) {
      setAdminSendStatus({
        success: false,
        message: err.message || "خطای ارتباط با تلگرام.",
      });
    } finally {
      setIsSendingToAdmin(false);
    }
  };

  // Execute Simulated Action
  const handleSimAction = async (actionType: string, payload?: any, btnLabel?: string) => {
    setIsSimLoading(true);

    if (btnLabel) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `usr_${Date.now()}`,
          sender: "user",
          text: btnLabel,
          timestamp: formatTehranTime(new Date(), false),
        },
      ]);
    }

    try {
      const res = await fetch("/api/bot-admin/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionType, payload }),
      });
      const data = await res.json();

      if (data.success) {
        if (actionType === "toggle_pause") {
          setLocalPaused((prev) => !prev);
          if (onTogglePause) onTogglePause();
          if (onRefreshData) onRefreshData();
        }

        if (actionType === "toggle_power" && data.isSystemTurnedOff !== undefined) {
          setIsSystemTurnedOff(!!data.isSystemTurnedOff);
          if (onRefreshData) onRefreshData();
        }

        const newMsg: ChatMessage = {
          id: `bot_${Date.now()}`,
          sender: "bot",
          text: data.text || (data.alert ? `🔔 ${data.alert}` : "عملیات انجام شد."),
          timestamp: formatTehranTime(new Date(), false),
          replyMarkup: data.reply_markup,
          isAlert: !!data.alert && !data.text,
        };

        setChatMessages((prev) => [...prev.slice(-10), newMsg]);
        if (data.reply_markup) {
          setActiveMenuMarkup(data.reply_markup);
        }
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setIsSimLoading(false);
    }
  };

  // Handle Direct Command in Simulator
  const handleSendSimCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = simInput.trim();
    if (!cmd) return;

    setSimInput("");

    if (cmd === "/start" || cmd === "/menu" || cmd === "/admin") {
      setPendingPromptType(null);
      handleSimAction("menu", undefined, cmd);
    } else if (cmd === "/status") {
      handleSimAction("status", undefined, cmd);
    } else if (cmd === "/pause" || cmd === "/resume") {
      handleSimAction("toggle_pause", undefined, cmd);
    } else if (cmd === "/stop" || cmd === "/off" || cmd === "/shutdown" || cmd === "/kill") {
      handleSimAction("toggle_power", { turnOff: true }, cmd);
    } else if (cmd === "/on" || cmd === "/start_system" || cmd === "/power") {
      handleSimAction("toggle_power", { turnOff: false }, cmd);
    } else if (cmd === "/report" || cmd === "/report_channel") {
      handleSimAction("report_channel", undefined, cmd);
    } else if (cmd === "/backup" || cmd === "/backup_now") {
      handleSimAction("backup_to_report_channel", undefined, cmd);
    } else if (cmd === "/channels") {
      handleSimAction("channels", undefined, cmd);
    } else if (cmd.startsWith("/add")) {
      const ch = cmd.replace(/^\/add\s*/, "").trim();
      handleSimAction("add_channel", { channel: ch }, cmd);
    } else if (cmd.startsWith("/dest")) {
      const dst = cmd.replace(/^\/dest\s*/, "").trim();
      handleSimAction("change_dest", { dest: dst }, cmd);
    } else if (pendingPromptType === "report_channel" || cmd.startsWith("-100")) {
      handleSimAction("change_report_channel", { channelId: cmd }, cmd);
      setPendingPromptType(null);
    } else if (pendingPromptType === "dest") {
      handleSimAction("change_dest", { dest: cmd }, cmd);
      setPendingPromptType(null);
    } else if (pendingPromptType === "add_channel") {
      handleSimAction("add_channel", { channel: cmd }, cmd);
      setPendingPromptType(null);
    } else if (cmd.startsWith("@")) {
      if (pendingPromptType === "report_channel") {
        handleSimAction("change_report_channel", { channelId: cmd }, cmd);
        setPendingPromptType(null);
      } else {
        handleSimAction("add_channel", { channel: cmd }, cmd);
      }
    } else if (cmd === "/test") {
      handleSimAction("test_msg", undefined, cmd);
    } else if (cmd === "/logs") {
      handleSimAction("logs", undefined, cmd);
    } else if (cmd === "/filters") {
      handleSimAction("filters", undefined, cmd);
    } else {
      // General command
      handleSimAction("menu", undefined, cmd);
    }
  };

  // Copy command to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const botUsername = settings?.botInfo?.username;
  const botLink = botUsername ? `https://t.me/${botUsername}?start=admin` : null;

  return (
    <div
      id="in-bot-admin-card"
      className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden"
    >
      {/* Decorative Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 mb-6">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl text-white shadow-lg shadow-cyan-500/20">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-white tracking-tight">
                مدیریت از داخل ربات تلگرام (In-Bot Control)
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Sparkles className="w-3 h-3" />
                کنترل بدون نیاز به داشبورد
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              توقف و اتصال مجدد مانیتورینگ، افزودن و حذف کانال‌های مبدا و تغییر کانال مقصد مستقیماً با دکمه‌های شیشه‌ای
              ربات
            </p>
          </div>
        </div>

        {/* Live Bot Link & Polling Status */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>شنود ربات:</span>
            <strong className="text-emerald-400 font-bold">فعال (Active)</strong>
          </div>

          {botLink && (
            <a
              href={botLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <Bot className="w-4 h-4" />
              <span>باز کردن ربات در تلگرام</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Master Emergency Power Banner */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border transition-all mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${
          isSystemTurnedOff
            ? "bg-rose-950/70 border-rose-500 shadow-xl shadow-rose-950/60 ring-2 ring-rose-500/40"
            : "bg-slate-950/70 border-emerald-500/40 shadow-lg shadow-emerald-950/20"
        }`}
      >
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
              isSystemTurnedOff
                ? "bg-rose-600/30 border border-rose-500 text-rose-300 animate-pulse"
                : "bg-emerald-600/20 border border-emerald-500/50 text-emerald-400"
            }`}
          >
            {isSystemTurnedOff ? <AlertOctagon className="w-6 h-6 text-rose-400" /> : <Power className="w-6 h-6 text-emerald-400" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white">
                {isSystemTurnedOff
                  ? "کل سامانه در وضعیت خاموشی کامل اضطراری (OFF) قرار دارد"
                  : "کل سامانه روشن و کلیه خدمات تبادل پیام فعال است (ON)"}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isSystemTurnedOff
                    ? "bg-rose-500 text-white animate-pulse"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                }`}
              >
                {isSystemTurnedOff ? "🛑 خاموش" : "🟢 روشن و فعال"}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {isSystemTurnedOff
                ? "در این حالت اضطراری، هیچ پیامی رصد، صف‌بندی یا ارسال نمی‌شود. سرور فوروارد کاملاً متوقف است."
                : "ربات و کلاینت تلگرام در حال پایش پیام‌های مبدا و ارسال زمان‌بندی‌شده به کانال مقصد هستند."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleEmergencyPower}
          disabled={isTogglingPower}
          className={`w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0 ${
            isSystemTurnedOff
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400 shadow-emerald-900/40"
              : "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white border border-rose-400 shadow-rose-900/40"
          }`}
        >
          {isTogglingPower ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : isSystemTurnedOff ? (
            <Power className="w-4 h-4 text-emerald-200" />
          ) : (
            <AlertOctagon className="w-4 h-4 text-rose-200" />
          )}
          <span>{isSystemTurnedOff ? "🟢 روشن کردن مجدد سامانه" : "🛑 خاموش کردن اضطراری کل سیستم"}</span>
        </button>
      </div>

      {/* Main Grid: Left = Telegram Simulator & Keyboards, Right = Config & Help */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: INTERACTIVE TELEGRAM BOT SIMULATOR & PREVIEW */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 flex flex-col bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Telegram App Header Mockup */}
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white font-bold text-base shadow">
                  <Bot className="w-5 h-5" />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-white">
                    {settings?.botInfo?.first_name || "ربات فورواردر هوشمند"}
                  </h4>
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />
                </div>
                <p className="text-[11px] text-emerald-400 font-medium">
                  {botUsername ? `@${botUsername}` : "آنلاین (bot)"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={initSimulator}
                title="بارگذاری مجدد منو"
                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isSimLoading ? "animate-spin text-cyan-400" : ""}`} />
              </button>
            </div>
          </div>

          {/* Telegram Chat Message History */}
          <div className="p-4 space-y-3.5 min-h-[380px] max-h-[460px] overflow-y-auto bg-slate-950/90 text-right">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl p-3.5 shadow-md relative text-xs leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-cyan-600 text-white rounded-br-none"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
                  }`}
                >
                  <div
                    className="whitespace-pre-wrap font-sans select-text"
                    dangerouslySetInnerHTML={{
                      __html: msg.text
                        .replace(/<b>/g, "<strong>")
                        .replace(/<\/b>/g, "</strong>")
                        .replace(/<i>/g, "<em>")
                        .replace(/<\/i>/g, "</em>")
                        .replace(/<code>/g, "<code class='bg-black/30 px-1 py-0.5 rounded text-cyan-300 font-mono'>")
                        .replace(/<\/code>/g, "</code>"),
                    }}
                  />
                  <div
                    className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${
                      msg.sender === "user" ? "text-cyan-200" : "text-slate-500"
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {msg.sender === "user" && <Check className="w-3 h-3" />}
                  </div>
                </div>

                {/* Inline Keyboard Buttons attached to Bot message */}
                {msg.replyMarkup?.inline_keyboard && (
                  <div className="w-full max-w-[92%] mt-2 space-y-1.5">
                    {msg.replyMarkup.inline_keyboard.map((row, rIdx) => (
                      <div key={`row_${rIdx}`} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                        {row.map((btn, bIdx) => {
                          const isPauseToggle = btn.callback_data === "cb_toggle_pause";
                          const isPowerToggle = btn.callback_data === "cb_toggle_power";
                          const isDeleteBtn = btn.callback_data.startsWith("cb_del_src_");
                          const isReportChannelBtn = btn.callback_data === "cb_report_channel";
                          const isBackupBtn = btn.callback_data === "cb_backup" || btn.callback_data === "cb_backup_to_report_channel";

                          return (
                            <button
                              key={`btn_${rIdx}_${bIdx}`}
                              type="button"
                              onClick={() => {
                                if (isDeleteBtn) {
                                  const srcId = btn.callback_data.replace("cb_del_src_", "");
                                  handleSimAction("del_channel", { sourceId: srcId }, btn.text);
                                } else if (btn.callback_data === "cb_toggle_power") {
                                  handleSimAction("toggle_power", undefined, btn.text);
                                } else if (btn.callback_data === "cb_report_channel") {
                                  handleSimAction("report_channel", undefined, btn.text);
                                } else if (btn.callback_data === "cb_change_report_channel") {
                                  setPendingPromptType("report_channel");
                                  handleSimAction("change_report_channel", undefined, btn.text);
                                } else if (btn.callback_data === "cb_test_report_channel") {
                                  handleSimAction("test_report_channel", undefined, btn.text);
                                } else if (btn.callback_data === "cb_backup_to_report_channel") {
                                  handleSimAction("backup_to_report_channel", undefined, btn.text);
                                } else if (btn.callback_data === "cb_toggle_report_backup") {
                                  handleSimAction("toggle_report_backup", undefined, btn.text);
                                } else if (btn.callback_data === "cb_change_dest") {
                                  setPendingPromptType("dest");
                                  handleSimAction("change_dest", undefined, btn.text);
                                } else if (btn.callback_data === "cb_status") {
                                  handleSimAction("status", undefined, btn.text);
                                } else if (btn.callback_data === "cb_toggle_pause") {
                                  handleSimAction("toggle_pause", undefined, btn.text);
                                } else if (btn.callback_data === "cb_channels") {
                                  handleSimAction("channels", undefined, btn.text);
                                } else if (btn.callback_data === "cb_add_channel") {
                                  setPendingPromptType("add_channel");
                                  handleSimAction("add_channel", undefined, btn.text);
                                } else if (btn.callback_data === "cb_test_msg") {
                                  handleSimAction("test_msg", undefined, btn.text);
                                } else if (btn.callback_data === "cb_filters_menu") {
                                  handleSimAction("filters", undefined, btn.text);
                                } else if (btn.callback_data === "cb_logs") {
                                  handleSimAction("logs", undefined, btn.text);
                                } else if (btn.callback_data === "cb_backup") {
                                  handleSimAction("backup_to_report_channel", undefined, btn.text);
                                } else if (btn.callback_data === "cb_main_menu") {
                                  setPendingPromptType(null);
                                  handleSimAction("menu", undefined, btn.text);
                                } else {
                                  handleSimAction("menu", undefined, btn.text);
                                }
                              }}
                              className={`py-2 px-2.5 text-xs font-semibold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 border shadow-sm ${
                                isPowerToggle
                                  ? isSystemTurnedOff
                                    ? "bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border-emerald-500 animate-pulse font-bold"
                                    : "bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 border-rose-500 font-bold"
                                  : isPauseToggle
                                  ? localPaused
                                    ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/40"
                                    : "bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border-amber-500/40"
                                  : isDeleteBtn
                                  ? "bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border-rose-500/30"
                                  : isReportChannelBtn
                                  ? "bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/40"
                                  : isBackupBtn
                                  ? "bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border-teal-500/40"
                                  : "bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700"
                              }`}
                            >
                              <span className="truncate">{btn.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isSimLoading && (
              <div className="flex items-center gap-2 text-xs text-cyan-400 bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl w-fit">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>ربات در حال پردازش دستور است...</span>
              </div>
            )}
          </div>

          {/* Quick Action Bar for Simulator */}
          <div className="bg-slate-900/90 border-t border-slate-800/80 p-2.5 flex flex-wrap gap-1.5">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 px-1">
              دستورات سریع:
            </span>
            <button
              type="button"
              onClick={() => handleSimAction("toggle_power", undefined, isSystemTurnedOff ? "/on" : "/stop")}
              className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold transition flex items-center gap-1 ${
                isSystemTurnedOff
                  ? "bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border-emerald-500/50 animate-pulse"
                  : "bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 border-rose-500/50"
              }`}
            >
              <Power className="w-3 h-3" />
              <span>{isSystemTurnedOff ? "روشن‌سازی (/on)" : "خاموشی (/stop)"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSimAction("report_channel", undefined, "/report")}
              className="text-[11px] px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg border border-indigo-500/40 transition"
            >
              📢 کانال گزارش (/report)
            </button>
            <button
              type="button"
              onClick={() => handleSimAction("backup_to_report_channel", undefined, "/backup_now")}
              className="text-[11px] px-2 py-1 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-lg border border-teal-500/40 transition"
            >
              📤 ارسال بک‌آپ
            </button>
            <button
              type="button"
              onClick={() => handleSimAction("status", undefined, "/status")}
              className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg border border-slate-700 transition"
            >
              /status
            </button>
            <button
              type="button"
              onClick={() => handleSimAction("toggle_pause", undefined, localPaused ? "/resume" : "/pause")}
              className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700 transition"
            >
              {localPaused ? "/resume" : "/pause"}
            </button>
            <button
              type="button"
              onClick={() => handleSimAction("channels", undefined, "/channels")}
              className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg border border-slate-700 transition"
            >
              /channels
            </button>
            <button
              type="button"
              onClick={() => handleSimAction("logs", undefined, "/logs")}
              className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-lg border border-slate-700 transition"
            >
              /logs
            </button>
            <button
              type="button"
              onClick={() => handleSimAction("test_msg", undefined, "/test")}
              className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-lg border border-slate-700 transition"
            >
              /test
            </button>
          </div>

          {/* Simulator Input Box */}
          <form onSubmit={handleSendSimCommand} className="bg-slate-900 border-t border-slate-800 p-3 flex gap-2">
            <input
              type="text"
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              placeholder="ارسال دستور به ربات (مانند /menu یا /add @channel)..."
              className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!simInput.trim() || isSimLoading}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <span>ارسال</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: ADMIN SECURITY, TELEGRAM PUSH & CHEAT SHEET */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Admin Authorization & Direct Telegram Push */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-sm border-b border-slate-800/80 pb-3">
              <UserCheck className="w-4 h-4 text-cyan-400" />
              <span>احراز هویت و اتصال حساب تلگرام مدیر</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  شناسه عددی اکانت تلگرام مدیر (Telegram User ID):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={adminUserId}
                    onChange={(e) => setAdminUserId(e.target.value)}
                    placeholder="مانند 123456789 (از @userinfobot)"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  💡 جهت دریافت شناسه عددی تلگرام خود، در ربات <code className="text-cyan-300">@userinfobot</code> پیام بفرستید.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  رمز عبور ورود به ربات در تلگرام (Passcode):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    placeholder="admin123"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  می‌توانید با ارسال <code className="text-cyan-300">/login {adminPasscode || "admin123"}</code> در پیوی ربات نیز وارد شوید.
                </p>
              </div>

              {saveSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{saveSuccess}</span>
                </div>
              )}

              {saveError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>ذخیره تنظیمات ادمین</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendToAdminTelegram}
                  disabled={isSendingToAdmin || !adminUserId}
                  title="ارسال منوی کنترل به تلگرام شما"
                  className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-cyan-300 rounded-xl text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5"
                >
                  {isSendingToAdmin ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>ارسال منو به تلگرام من</span>
                </button>
              </div>

              {adminSendStatus && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    adminSendStatus.success
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                  }`}
                >
                  {adminSendStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{adminSendStatus.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Command Cheat Sheet */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>راهنمای دستورات متنی ربات در تلگرام</span>
              </div>
              <span className="text-[10px] text-slate-500">کلیک برای کپی</span>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { cmd: "/menu", desc: "نمایش منوی اصلی شیشه‌ای و دکمه‌های کنترل" },
                { cmd: "/status", desc: "دریافت آمار زنده، کانال‌های فعال و خطاها" },
                { cmd: "/pause", desc: "توقف موقت مانیتورینگ بدون حذف تنظیمات" },
                { cmd: "/resume", desc: "شروع مجدد و فعال‌سازی فوری مانیتورینگ" },
                { cmd: "/channels", desc: "مشاهده لیست کانال‌ها با دکمه حذف هرکدام" },
                { cmd: "/add @channel", desc: "افزودن سریع کانال مبدا جدید" },
                { cmd: "/dest @channel", desc: "تغییر کانال مقصد فوروارد" },
                { cmd: "/test", desc: "ارسال پست تست به کانال مقصد" },
                { cmd: "/logs", desc: "نمایش آخرین گزارشات انتقال پیام" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCopy(item.cmd)}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-cyan-400 font-bold group-hover:text-cyan-300">
                      {item.cmd}
                    </code>
                    <span className="text-slate-400 text-[11px]">— {item.desc}</span>
                  </div>
                  <button type="button" className="text-slate-500 group-hover:text-slate-300 p-1">
                    {copiedCmd === item.cmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
