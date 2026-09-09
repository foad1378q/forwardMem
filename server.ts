import "dotenv/config";

// Enforce Asia/Tehran timezone (UTC+03:30) as standard for all Node.js and Bot operations
process.env.TZ = "Asia/Tehran";

export const TEHRAN_TZ = "Asia/Tehran";

export function getTehranTimeString(d: Date | string | number = new Date(), includeSeconds = true): string {
  try {
    const dateObj = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return "--:--";
    return dateObj.toLocaleTimeString("fa-IR", {
      timeZone: TEHRAN_TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: includeSeconds ? "2-digit" : undefined,
    });
  } catch {
    return new Date(d).toLocaleTimeString("fa-IR");
  }
}

export function getTehranDateString(d: Date | string | number = new Date()): string {
  try {
    const dateObj = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return "----/--/--";
    return dateObj.toLocaleDateString("fa-IR", {
      timeZone: TEHRAN_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return new Date(d).toLocaleDateString("fa-IR");
  }
}

export function getTehranDateTimeString(d: Date | string | number = new Date()): string {
  return `${getTehranDateString(d)} ساعت ${getTehranTimeString(d, true)}`;
}

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage, NewMessageEvent } from "telegram/events/index.js";
import { computeCheck } from "telegram/Password.js";
import { defaultQueueService, QueueItem } from "./server/services/queue/queueService.js";
import { defaultReportGroupService } from "./server/services/reporting/reportGroupService.js";
import {
  AdminConfig,
  BotSettings,
  SourceChannel,
  ActivityLog,
  TelegramPost,
  SystemStats,
  TelegramMediaItem,
  TelegramClientConfig,
  AiProcessingConfig,
} from "./src/types.js";
import {
  initDatabase,
  pool,
  getStoreFromDb,
  saveSettingsToDb,
  saveAiProcessingToDb,
  saveTelegramClientConfigToDb,
  saveSourceToDb,
  bulkSaveSourcesToDb,
  deleteSourceFromDb,
  addLogToDb,
  clearLogsInDb,
  updateStatsInDb,
  getDatabaseHealth,
  exportDatabaseData,
  importDatabaseData,
  exportDatabaseSql,
  isDbConnected,
  getLatestDestinationChannelFromDb,
} from "./src/db/db.js";

const DEFAULT_AI_PROCESSING: AiProcessingConfig = {
  enableAiProcessing: true,
  enableKeywordFilter: false,
  allowedKeywords: [],
  blockedKeywords: [],
  keywordMatchMode: 'any',
  messagesPassed: 0,
  messagesBlocked: 0,
  enableContentCleaning: false,
  cleaningRules: ['https://', 'http://', '@', '#'],
  removeTelegramLinks: true,
  removeInstagramLinks: true,
  removeAllUrls: false,
  removeUsernames: true,
  removeHashtags: true,
  removeEmojis: false,
  enableContactManager: false,
  defaultContactNote: '📌 جهت ارتباط با مدیر کانال در ارتباط باشید',
  enableMediaControl: false,
  forwardPhotos: true,
  forwardVideos: true,
  forwardPdfs: true,
  forwardDocuments: true,
  forwardAudios: true,
  mediaOrder: 'media_first',
  enableDuplicateProtection: false,
  duplicateDetectionType: 'both',
  timeWindowHours: 1,
  maxForwardingCount: 2,
  enableJobExtraction: false,
  enableMessageSignature: false,
  signatureText: `━━━━━━━━━━━━━━\n📢 کانال رسمی اطلاع‌رسانی\n@YourChannelID\n━━━━━━━━━━━━━━`,
  addSignatureAfterEveryMessage: true,
};

// Content Cleaner Service Helper Function
export function cleanMessage(
  text: string,
  config: Partial<AiProcessingConfig>
): { cleanedText: string; removedItems: string[] } {
  if (!text) return { cleanedText: "", removedItems: [] };

  let currentText = text;
  const removedItems: string[] = [];

  const addRemoved = (item: string) => {
    const trimmed = item.trim();
    if (trimmed && !removedItems.includes(trimmed)) {
      removedItems.push(trimmed);
    }
  };

  // 1. Remove Telegram Links
  if (config.removeTelegramLinks !== false) {
    const tgRegex = /(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|tg:\/\/resolve[^\s]*)\/[a-zA-Z0-9_\/]+/gi;
    const matches = currentText.match(tgRegex);
    if (matches) {
      matches.forEach(addRemoved);
      currentText = currentText.replace(tgRegex, "");
    }
  }

  // 2. Remove Instagram Links
  if (config.removeInstagramLinks !== false) {
    const instaRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[a-zA-Z0-9_\.\/]+/gi;
    const matches = currentText.match(instaRegex);
    if (matches) {
      matches.forEach(addRemoved);
      currentText = currentText.replace(instaRegex, "");
    }
  }

  // 3. Remove All URLs if enabled
  if (config.removeAllUrls) {
    const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
    const matches = currentText.match(urlRegex);
    if (matches) {
      matches.forEach(addRemoved);
      currentText = currentText.replace(urlRegex, "");
    }
  }

  // 4. Remove Telegram Usernames (@channel, @user)
  if (config.removeUsernames !== false) {
    const usernameRegex = /@[a-zA-Z0-9_]{3,32}\b/gi;
    const matches = currentText.match(usernameRegex);
    if (matches) {
      matches.forEach(addRemoved);
      currentText = currentText.replace(usernameRegex, "");
    }
  }

  // 5. Remove Hashtags (#hashtag)
  if (config.removeHashtags !== false) {
    const hashtagRegex = /#[\w_آ-ی0-9]+/gi;
    const matches = currentText.match(hashtagRegex);
    if (matches) {
      matches.forEach(addRemoved);
      currentText = currentText.replace(hashtagRegex, "");
    }
  }

  // 6. Remove Emojis if enabled
  if (config.removeEmojis) {
    const emojiRegex = /\p{Extended_Pictographic}/gu;
    const matches = currentText.match(emojiRegex);
    if (matches) {
      matches.forEach(addRemoved);
      currentText = currentText.replace(emojiRegex, "");
    }
  }

  // 7. Custom Words/Sentences/Patterns from cleaningRules
  if (config.cleaningRules && Array.isArray(config.cleaningRules)) {
    for (const rule of config.cleaningRules) {
      const trimmedRule = rule.trim();
      if (!trimmedRule) continue;

      if (trimmedRule === "https://" || trimmedRule === "http://") {
        const matches = currentText.match(/https?:\/\/\S+/gi);
        if (matches) matches.forEach(addRemoved);
        currentText = currentText.replace(/https?:\/\/\S+/gi, "");
      } else if (trimmedRule === "@") {
        const matches = currentText.match(/@\w+/gi);
        if (matches) matches.forEach(addRemoved);
        currentText = currentText.replace(/@\w+/gi, "");
      } else if (trimmedRule === "#") {
        const matches = currentText.match(/#[\w_آ-ی0-9]+/gi);
        if (matches) matches.forEach(addRemoved);
        currentText = currentText.replace(/#[\w_آ-ی0-9]+/gi, "");
      } else {
        const escaped = trimmedRule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const customRegex = new RegExp(escaped, 'gi');
        if (customRegex.test(currentText)) {
          addRemoved(trimmedRule);
          currentText = currentText.replace(customRegex, "");
        }
      }
    }
  }

  // Clean up multiple empty lines or trailing spaces
  currentText = currentText.replace(/\n{3,}/g, "\n\n").trim();

  return { cleanedText: currentText, removedItems };
}

// Global Process Safety Handlers to prevent Railway container crashes from unhandled errors
process.on("uncaughtException", (err: any) => {
  console.error("❌ [PROCESS SAFETY] Uncaught Exception caught (process preserved):", err?.message || err);
  if (err?.stack) {
    console.error(err.stack);
  }
});

process.on("unhandledRejection", (reason: any, promise: any) => {
  console.error("❌ [PROCESS SAFETY] Unhandled Rejection caught (process preserved):", reason?.message || reason);
});

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "forwarder_store.json");

// Helper to normalize international phone numbers (e.g. converting Persian/Arabic digits, standardizing + prefix)
export function normalizeTelegramPhoneNumber(phone: string): string {
  if (!phone) return "";
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let clean = String(phone).trim();
  for (let i = 0; i < 10; i++) {
    clean = clean.replace(new RegExp(persianDigits[i], 'g'), i.toString());
    clean = clean.replace(new RegExp(arabicDigits[i], 'g'), i.toString());
  }
  // Strip whitespace, hyphens, dots, parentheses
  clean = clean.replace(/[\s\-\(\)\.]/g, '');

  if (clean.startsWith('00')) {
    clean = '+' + clean.slice(2);
  } else if (clean.startsWith('09') && clean.length === 11) {
    clean = '+98' + clean.slice(1);
  } else if (clean.startsWith('9') && clean.length === 10) {
    clean = '+98' + clean;
  } else if (!clean.startsWith('+')) {
    clean = '+' + clean;
  }
  return clean;
}

// Telegram RPC Error parser with specific Persian user-friendly messages
export function formatTelegramRpcError(err: any): { code: string; message: string; isAppCode?: boolean; floodWaitSeconds?: number } {
  const rawMsg = String(err?.message || err?.errorMessage || err?.description || err || "").toUpperCase();
  console.error("🔍 [TELEGRAM RPC ERROR ANALYSIS]:", { rawMsg, errName: err?.name, fullErr: err });

  // Flood wait handling
  if (rawMsg.includes("FLOOD_WAIT")) {
    const match = rawMsg.match(/FLOOD_WAIT_?(\d+)/i) || String(err?.seconds || "").match(/(\d+)/);
    const seconds = match ? parseInt(match[1], 10) : (typeof err?.seconds === "number" ? err.seconds : 60);
    return {
      code: "FLOOD_WAIT",
      message: `تلگرام به دلیل ارسال مکرر درخواست، این حساب یا آدرس IP را به مدت ${seconds} ثانیه محدود کرده است. لطفاً تا اتمام زمان صبر فرمایید.`,
      floodWaitSeconds: seconds,
    };
  }

  if (rawMsg.includes("API_ID_INVALID")) {
    return {
      code: "API_ID_INVALID",
      message: "شناسه API ID یا API HASH وارد شده نامعتبر است. لطفاً این مقادیر را از سایت my.telegram.org دریافت و به دقت وارد نمایید.",
    };
  }

  if (rawMsg.includes("API_ID_PUBLISHED_FLOOD")) {
    return {
      code: "API_ID_PUBLISHED_FLOOD",
      message: "این API ID عمومی شده و توسط تلگرام مسدود شده است. لطفاً از my.telegram.org یک API ID و API HASH اختصاصی ایجاد کرده و وارد کنید.",
    };
  }

  if (rawMsg.includes("PHONE_NUMBER_INVALID")) {
    return {
      code: "PHONE_NUMBER_INVALID",
      message: "شماره تلفن وارد شده نامعتبر است. لطفاً شماره را با فرمت بین‌المللی وارد فرمایید (مثال: +989123456789).",
    };
  }

  if (rawMsg.includes("PHONE_NUMBER_FLOOD")) {
    return {
      code: "PHONE_NUMBER_FLOOD",
      message: "به دلیل درخواست‌های مکرر و ناموفق، این شماره موقتاً توسط تلگرام محدود شده است. لطفاً چند ساعت بعد دوباره تلاش فرمایید.",
    };
  }

  if (rawMsg.includes("PHONE_PASSWORD_FLOOD")) {
    return {
      code: "PHONE_PASSWORD_FLOOD",
      message: "تلاش‌های ورود به دلیل وارد کردن مکرر رمز عبور اشتباه مسدود گردیده است. لطفاً مدتی صبر کرده و سپس اقدام فرمایید.",
    };
  }

  if (rawMsg.includes("PHONE_PASSWORD_PROTECTED")) {
    return {
      code: "PHONE_PASSWORD_PROTECTED",
      message: "این حساب تلگرام دارای تایید دو مرحله‌ای است و رمز عبور الزامی می‌باشد.",
    };
  }

  if (rawMsg.includes("SESSION_PASSWORD_NEEDED")) {
    return {
      code: "SESSION_PASSWORD_NEEDED",
      message: "این حساب دارای تایید دو مرحله‌ای (Two-Step Verification) است. لطفاً رمز عبور دوم خود را وارد نمایید.",
    };
  }

  if (rawMsg.includes("PHONE_CODE_INVALID")) {
    return {
      code: "PHONE_CODE_INVALID",
      message: "کد تایید ۵ رقمی وارد شده اشتباه است. لطفاً کد جدید دریافتی در اپلیکیشن تلگرام را بررسی و وارد نمایید.",
    };
  }

  if (rawMsg.includes("PHONE_CODE_EXPIRED")) {
    return {
      code: "PHONE_CODE_EXPIRED",
      message: "کد تایید منقضی شده است. لطفاً مجدداً دکمه ارسال کد را فشار دهید.",
    };
  }

  if (rawMsg.includes("SMS_CODE_CREATE_FAILED")) {
    return {
      code: "SMS_CODE_CREATE_FAILED",
      message: "امکان ارسال پیامک وجود ندارد. تلگرام کد تایید را به اپلیکیشن فعال تلگرام شما ارسال کرده است؛ لطفاً چت رسمی Telegram در اپ تلگرام را بررسی فرمایید.",
      isAppCode: true,
    };
  }

  if (rawMsg.includes("AUTH_RESTART")) {
    return {
      code: "AUTH_RESTART",
      message: "نشست احراز هویت ری‌استارت شد یا منقضی گردیده است. لطفاً مجدداً شماره را ارسال کرده و کد جدید دریافت نمایید.",
    };
  }

  if (rawMsg.includes("ETIMEDOUT") || rawMsg.includes("ECONNREFUSED") || rawMsg.includes("TIMEOUT") || rawMsg.includes("NETWORK")) {
    return {
      code: "NETWORK_ERROR",
      message: "خطای ارتباط شبکه با سرورهای تلگرام. اتصال اینترنت یا فایروال سرور را بررسی فرمایید.",
    };
  }

  return {
    code: "UNKNOWN_TELEGRAM_ERROR",
    message: err?.message || err?.errorMessage || "خطای نامشخص در ارتباط با سرورهای تلگرام رخ داد.",
  };
}

// Memory Data Structure
interface DataStore {
  adminPasswordHash: string; // default admin123
  telegramClientConfig: TelegramClientConfig;
  telegramSession: string; // GramJS session string saved permanently
  isMonitoringPaused?: boolean;
  isSystemTurnedOff?: boolean; // Emergency Master Kill Switch (خاموشی کامل سیستم)
  botPollerOffset?: number; // Persisted offset for Telegram Bot long-polling
  settings: BotSettings;
  sources: SourceChannel[];
  logs: ActivityLog[];
  processedMessageIds: Record<string, number[]>; // sourceId -> array of messageIds
  stats: {
    totalTransferred: number;
    failedMessages: number;
    startTime: string;
    lastBackupTime?: string;
  };
}

// Initial default state
let store: DataStore = {
  adminPasswordHash: "admin123",
  isMonitoringPaused: false,
  isSystemTurnedOff: false,
  botPollerOffset: 0,
  telegramClientConfig: {
    apiId: process.env.API_ID ? parseInt(process.env.API_ID, 10) : null,
    apiHash: (process.env.API_HASH && process.env.API_HASH.trim()) || "",
    phoneNumber: "",
    session: "",
    isConnected: false,
    isMonitoringPaused: false,
    connectedPhone: "",
    lastConnectedAt: "",
  },
  telegramSession: "",
  settings: {
    botToken: "",
    destinationChannel: "",
    isVerified: false,
    globalKeywords: [],
    globalForbiddenKeywords: [],
    enableGlobalKeywords: false,
    globalKeywordMatchMode: "any",
    aiProcessing: DEFAULT_AI_PROCESSING,
    botAdminConfig: {
      adminTelegramUserId: "",
      adminPasscode: "admin123",
      enableInBotAdmin: true,
      autoAuthorizedUsers: [],
      lastCommandReceived: "",
      lastCommandTime: "",
      isBotPollingActive: false,
    },
  },
  sources: [],
  logs: [],
  processedMessageIds: {},
  stats: {
    totalTransferred: 0,
    failedMessages: 0,
    startTime: new Date().toISOString(),
  },
};

// Pending Auth Session in memory
let pendingAuthClient: TelegramClient | null = null;
let pendingAuthData: {
  apiId: number;
  apiHash: string;
  phoneNumber: string;
  phoneCodeHash: string;
  isCodeViaApp?: boolean;
  timestamp?: number;
} | null = null;

// Persistence Helpers
async function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch (err: any) {
    console.error("Local store write error:", err?.message || err);
  }

  try {
    await saveSettingsToDb(store.settings);
    await saveAiProcessingToDb(store.settings.aiProcessing);
    await saveTelegramClientConfigToDb(store.telegramClientConfig, store.telegramSession);
    await updateStatsInDb(store.stats);
  } catch (err: any) {
    console.error("Database save error:", err);
  }
}

function addLog(
  sourceId: string,
  sourceUsername: string,
  sourceTitle: string,
  messageId: number,
  contentType: string,
  status: 'success' | 'duplicate' | 'error' | 'skipped',
  details: string
) {
  const log: ActivityLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    sourceId,
    sourceUsername,
    sourceTitle,
    messageId,
    contentType,
    status,
    details,
    destinationChannel: store.settings.destinationChannel || 'نامشخص',
  };

  store.logs.unshift(log);
  if (store.logs.length > 500) {
    store.logs = store.logs.slice(0, 500);
  }
  if (status === "error") {
    store.stats.failedMessages += 1;
  }

  // Persist log into PostgreSQL
  addLogToDb(log).catch((e) => console.error("Error writing log to DB:", e));
  saveStore();
  return log;
}

function cleanChannelIdentifier(input: string | null | undefined): string {
  if (!input) return "";
  let str = input.trim();
  str = str.replace(/^(?:https?:\/\/)?(?:www\.)?t\.me\//i, "");
  str = str.replace(/^@/, "");
  return str.trim();
}

// Telegram Bot API Helper (HTTP)
async function callTelegramBotApi(token: string, method: string, payload?: Record<string, any>) {
  try {
    if (!token || !token.trim()) {
      console.error("[TELEGRAM BOT API] Missing token.");
      return { ok: false, error_code: 401, description: "Missing BOT_TOKEN" };
    }
    const url = `https://api.telegram.org/bot${token}/${method}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return await response.json();
  } catch (err: any) {
    console.error(`[TELEGRAM BOT API ERROR] Method ${method} failed:`, err?.message || err);
    return { ok: false, error_code: 500, description: err?.message || "Network request failed" };
  }
}

// Helper to normalize destination channel format (@channel or -100...)
function normalizeDestinationChannel(dest: string | null | undefined): string {
  if (!dest) return "";
  let clean = dest.trim();
  clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?t\.me\//i, "");
  clean = clean.replace(/\/$/, "");
  if (/^-?\d+$/.test(clean)) {
    if (!clean.startsWith("-")) {
      clean = clean.startsWith("100") ? `-${clean}` : `-100${clean}`;
    }
    return clean;
  }
  if (!clean.startsWith("@")) {
    clean = `@${clean}`;
  }
  return clean;
}

// User-friendly Persian error descriptor for Telegram Bot API failures
function humanizeTelegramError(desc?: string): string {
  if (!desc) return "خطای ناشناخته در ارسال پیام به کانال مقصد";
  const lower = desc.toLowerCase();
  if (lower.includes("chat not found")) {
    return "کانال مقصد یافت نشد! لطفاً آیدی/یوزرنیم کانال مقصد را در بخش تنظیمات بررسی کرده و مطمئن شوید ربات در کانال عضو است.";
  }
  if (
    lower.includes("bot is not a member") ||
    lower.includes("bot was kicked") ||
    lower.includes("chat_admin_required") ||
    lower.includes("not enough rights") ||
    lower.includes("need administrator rights") ||
    lower.includes("have no rights to send a message")
  ) {
    return "ربات دسترسی ارسال پیام (ادمین) در کانال مقصد را ندارد. لطفاً ربات را به عنوان مدیر (Admin) در کانال مقصد ادد کرده و دسترسی Post Messages را فعال کنید.";
  }
  if (lower.includes("unauthorized") || lower.includes("invalid token") || lower.includes("not found: /bot")) {
    return "توکن ربات تلگرام نامعتبر است. لطفاً توکن ربات را در تنظیمات مجدداً بررسی و ذخیره کنید.";
  }
  if (lower.includes("can't parse entities")) {
    return "خطا در تگ‌های متن پیام.";
  }
  if (lower.includes("message is too long")) {
    return "متن پیام بیش از سقف مجاز تلگرام (۴۰۹۶ کاراکتر) بود.";
  }
  if (lower.includes("file is too big") || lower.includes("request entity too large")) {
    return "حجم فایل یا رسانه بیش از سقف مجاز تلگرام (۵۰ مگابایت) بود.";
  }
  return desc;
}

// Telegram Bot API Media Multipart Helper with automatic HTML retry fallback
async function sendBotMedia(
  token: string,
  method: string,
  destination: string,
  buffer: Buffer,
  filename: string,
  field: string,
  caption?: string,
  parseMode: string = "HTML"
) {
  try {
    if (!token || !token.trim()) {
      console.error("[TELEGRAM BOT API] Missing token for media.");
      return { ok: false, error_code: 401, description: "توکن ربات تلگرام تنظیم نشده است." };
    }
    const cleanDestination = normalizeDestinationChannel(destination);

    const formData = new FormData();
    formData.append("chat_id", cleanDestination);
    if (caption) {
      formData.append("caption", caption);
      formData.append("parse_mode", parseMode);
    }
    formData.append(field, new Blob([buffer]), filename);

    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      body: formData,
    });
    const result = await res.json();

    // If failed due to HTML parsing entities error, retry in plain text without parse_mode
    if (!result.ok && parseMode && caption) {
      console.warn(`[TELEGRAM MEDIA] Retrying ${method} without parse_mode due to:`, result.description);
      const retryForm = new FormData();
      retryForm.append("chat_id", cleanDestination);
      retryForm.append("caption", caption);
      retryForm.append(field, new Blob([buffer]), filename);
      const retryRes = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        body: retryForm,
      });
      return await retryRes.json();
    }

    return result;
  } catch (err: any) {
    console.error(`[TELEGRAM MEDIA ERROR] Method ${method} failed:`, err?.message || err);
    return { ok: false, error_code: 500, description: err?.message || "خطا در آپلود رسانه به تلگرام" };
  }
}

// GramJS Telegram Client Instance
let gramClient: TelegramClient | null = null;
let gramStatus: 'connected' | 'connecting' | 'disconnected' | 'error' = 'disconnected';

async function initGramJS() {
  if (gramStatus === 'connecting') return;
  gramStatus = 'connecting';

  try {
    const sessionStr = store.telegramClientConfig?.session || store.telegramSession || "";
    const envApiId = process.env.API_ID ? parseInt(process.env.API_ID, 10) : null;
    const envApiHash = process.env.API_HASH && process.env.API_HASH.trim() ? process.env.API_HASH.trim() : null;

    const apiId = envApiId || store.telegramClientConfig?.apiId;
    const apiHash = envApiHash || store.telegramClientConfig?.apiHash;

    if (!sessionStr) {
      gramStatus = 'disconnected';
      if (store.telegramClientConfig) store.telegramClientConfig.isConnected = false;
      return;
    }

    if (!apiId || isNaN(Number(apiId)) || Number(apiId) === 2040 || !apiHash) {
      console.warn("⚠️ GramJS: Valid API_ID and API_HASH are required to initialize GramJS (test ID 2040 is rejected).");
      gramStatus = 'disconnected';
      if (store.telegramClientConfig) store.telegramClientConfig.isConnected = false;
      return;
    }

    const stringSession = new StringSession(sessionStr);
    gramClient = new TelegramClient(stringSession, Number(apiId), String(apiHash).trim(), {
      connectionRetries: 5,
      useWSS: false,
      timeout: 15000,
    });

    await gramClient.connect();

    const me = await gramClient.getMe().catch((err) => {
      console.error("[TELEGRAM CLIENT] Could not fetch account info:", err?.message || err);
      return null;
    });

    if (me) {
      gramStatus = 'connected';
      if (store.telegramClientConfig) {
        store.telegramClientConfig.isConnected = true;
        if ((me as any).phone) {
          store.telegramClientConfig.connectedPhone = '+' + (me as any).phone;
        }
        if (!store.telegramClientConfig.lastConnectedAt) {
          store.telegramClientConfig.lastConnectedAt = new Date().toISOString();
        }
      }
      await saveStore();
      console.log("✅ GramJS Telegram User Client connected successfully! Account:", (me as any).firstName || (me as any).username || "User");

      await initializeSourceListeners();
      return;
    } else {
      console.warn("⚠️ GramJS: Connected to network but session could not be verified with getMe(). Disconnecting.");
      gramStatus = 'disconnected';
      if (store.telegramClientConfig) store.telegramClientConfig.isConnected = false;
      if (gramClient) {
        try { await gramClient.disconnect(); } catch (_) {}
        gramClient = null;
      }
    }
  } catch (err: any) {
    gramStatus = 'error';
    if (store.telegramClientConfig) store.telegramClientConfig.isConnected = false;
    if (gramClient) {
      try { await gramClient.disconnect(); } catch (_) {}
      gramClient = null;
    }
    console.error("❌ GramJS User Client connection error (handled):", err?.message || err);
  }
}

// Helper to resolve channel entity, username, title, numeric ID, subscriber count and latest post
async function resolveChannelDetails(target: string): Promise<{
  title: string;
  username: string;
  numericId?: string;
  subscriberCount?: string;
  latestPostId: number;
  entity?: any;
}> {
  const clean = cleanChannelIdentifier(target);
  let title = clean.startsWith("-") || /^\d+$/.test(clean) ? `کانال/گروه (${clean})` : `@${clean}`;
  let username = clean;
  let numericId: string | undefined = undefined;
  let subscriberCount: string | undefined = undefined;
  let latestPostId = 0;
  let resolvedEntity: any = null;

  if (gramClient && gramStatus === "connected") {
    try {
      let lookupTarget: any = clean;
      if (/^-?\d+$/.test(clean)) {
        try { lookupTarget = BigInt(clean); } catch (_) {}
      }

      const entity = await gramClient.getEntity(lookupTarget).catch(() => null);
      if (entity) {
        resolvedEntity = entity;
        if ((entity as any).id) {
          numericId = (entity as any).id.toString();
        }
        if ((entity as any).title) {
          title = (entity as any).title;
        }
        if ((entity as any).username) {
          username = (entity as any).username;
        }
        if ((entity as any).participantsCount) {
          subscriberCount = `${(entity as any).participantsCount} عضو`;
        }

        // Try to join public channel if not already joined
        try {
          await gramClient.invoke(new Api.channels.JoinChannel({ channel: entity }));
        } catch (_) {}

        const msgs = await gramClient.getMessages(entity, { limit: 1 }).catch(() => []);
        if (msgs?.[0] && msgs[0] instanceof Api.Message) {
          latestPostId = msgs[0].id;
        }
      }
    } catch (err: any) {
      console.log(`[RESOLVE] Notice for ${target}:`, err?.message || err);
    }
  }

  return { title, username, numericId, subscriberCount, latestPostId, entity: resolvedEntity };
}

// Background auto-reconnect loop for Railway continuous uptime
setInterval(async () => {
  try {
    if (gramStatus === 'disconnected' || gramStatus === 'error') {
      const sessionStr = store.telegramClientConfig?.session || store.telegramSession || "";
      if (sessionStr) {
        console.log("🔄 [RAILWAY KEEP-ALIVE] Auto-reconnecting Telegram Client...");
        await initGramJS();
      }
    }
  } catch (err: any) {
    console.error("[RAILWAY KEEP-ALIVE ERROR]:", err?.message || err);
  }
}, 45000);

// Background Continuous Polling Sync Engine for all monitored channels
let isSyncInProgress = false;

async function runPeriodicChannelSync() {
  if (isSyncInProgress) return;
  if (!gramClient || gramStatus !== "connected") return;
  if (store.isMonitoringPaused) return;

  const activeSources = store.sources ? store.sources.filter((s) => s.status === "active") : [];
  if (activeSources.length === 0) return;

  isSyncInProgress = true;

  try {
    for (const source of activeSources) {
      try {
        const cleanUser = cleanChannelIdentifier(source.username);
        let lookupTarget: any = cleanUser;
        if (/^-?\d+$/.test(cleanUser)) {
          try { lookupTarget = BigInt(cleanUser); } catch (_) {}
        } else if (source.numericId) {
          try { lookupTarget = BigInt(source.numericId); } catch (_) {}
        }

        const entity = await gramClient.getEntity(lookupTarget).catch(() => null);
        if (!entity) continue;

        if ((entity as any).id && !source.numericId) {
          source.numericId = (entity as any).id.toString();
          saveSourceToDb(source).catch(() => {});
        }

        const messages = await gramClient.getMessages(entity, { limit: 5 }).catch(() => []);
        if (!messages || !Array.isArray(messages) || messages.length === 0) continue;

        if (!store.processedMessageIds) store.processedMessageIds = {};
        if (!store.processedMessageIds[source.id]) store.processedMessageIds[source.id] = [];
        const processedList = store.processedMessageIds[source.id];

        const validMsgs = messages
          .filter((m) => m && m instanceof Api.Message && m.id)
          .sort((a, b) => a.id - b.id);

        for (const msg of validMsgs) {
          if (processedList.includes(msg.id)) {
            continue;
          }

          if (source.lastMessageId && msg.id <= source.lastMessageId) {
            if (!processedList.includes(msg.id)) {
              processedList.push(msg.id);
            }
            continue;
          }

          console.log(`[POLLING SYNC] New post #${msg.id} detected in channel "${source.title}" (@${source.username})`);
          await processMonitoredChannelMessage(source, msg, source.title, source.numericId || source.username);

          if (!processedList.includes(msg.id)) {
            processedList.push(msg.id);
          }
          source.lastMessageId = Math.max(source.lastMessageId || 0, msg.id);
        }

        if (processedList.length > 2000) {
          store.processedMessageIds[source.id] = processedList.slice(-1000);
        }
      } catch (err: any) {
        // Continue to next channel
      }
    }
  } catch (err: any) {
    console.error("[POLLING SYNC ERROR]:", err?.message || err);
  } finally {
    isSyncInProgress = false;
  }
}

// Periodic Channel Sync: runs every 12 seconds
setInterval(() => {
  runPeriodicChannelSync().catch((e) => console.error("Error in periodic channel sync:", e));
}, 12000);

// AI Processing Pipeline Helpers
const recentMessageCache: { textOrHash: string; timestamp: number }[] = [];

async function runAiJobExtraction(text: string): Promise<{
  extracted: {
    jobTitle: string;
    company: string;
    location: string;
    skills: string;
    salary: string;
    contact: string;
    deadline: string;
  };
  formattedPreview: string;
}> {
  try {
    const jobTitle = (text.match(/(?:نیازمند|استخدام|جذب)\s+([^\n،,]+)/i)?.[1] || text.match(/(?:عنوان\s*(?:شغلی)?)\s*[:\s]*([^\n،,]+)/i)?.[1] || 'استخدام نیروی متخصص').trim();
    const company = (text.match(/(?:شرکت|مجموعه|گروه|سازمان)\s+([^\n،,]+)/i)?.[1] || 'مجموعه معتبر').trim();
    const location = (text.match(/(?:تهران|کرج|اصفهان|شیراز|مشهد|تبریز|قم|اهواز|یزد|رشت|موقعیت|شهر)\b[^\n،,]*/i)?.[0] || 'تهران / غیرحضوری').trim();
    const salary = (text.match(/(?:حقوق|مزایا|درآمد|دستمزد)\s*[:\s]*([^\n،,]+)/i)?.[1] || 'توافقی').trim();
    const contact = (text.match(/(?:@\w+|09\d{9}|\+98\d{10})/i)?.[0] || 'ارتباط با آیدی یا شماره مندرج در آگهی').trim();
    const skills = (text.match(/(?:مهارت|مسلط به|آشنایی با|شرایط)\s*[:\s]*([^\n]+)/i)?.[1] || 'مسلط به مهارت‌های تخصصی مرتبط').trim();
    const deadline = (text.match(/(?:مهلت|تا تاریخ|فرصت)\s*[:\s]*([^\n]+)/i)?.[1] || 'تا تکمیل ظرفیت').trim();

    const formattedPreview = `📋 **فرصت شغلی جدید: ${jobTitle}**\n\n🏢 **شرکت/مجموعه:** ${company}\n📍 **موقعیت مکانی:** ${location}\n🛠️ **مهارت‌های مورد نیاز:** ${skills}\n💰 **حقوق و مزایا:** ${salary}\n⏳ **مهلت ارسال:** ${deadline}\n\n📞 **اطلاعات تماس و ارسال رزومه:**\n${contact}`;

    return {
      extracted: { jobTitle, company, location, skills, salary, contact, deadline },
      formattedPreview,
    };
  } catch (err) {
    console.error('Job Extraction error:', err);
    return {
      extracted: {
        jobTitle: 'فرصت شغلی',
        company: 'مجموعه معتبر',
        location: 'نامشخص',
        skills: 'سوابق مرتبط',
        salary: 'توافقی',
        contact: 'ارتباط با مدیر',
        deadline: 'تا تکمیل ظرفیت',
      },
      formattedPreview: text,
    };
  }
}

async function processMessagePipeline(
  source: SourceChannel,
  rawText: string,
  mediaType?: string
): Promise<{ shouldProceed: boolean; finalText: string; reason?: string; removedItems?: string[]; signatureAdded?: boolean }> {
  const config = store.settings.aiProcessing;

  if (!config || !config.enableAiProcessing) {
    return { shouldProceed: true, finalText: rawText };
  }

  let currentText = rawText || "";
  let removedItems: string[] = [];
  let signatureAdded = false;

  // 1. Keyword Filter (Filters)
  if (config.enableKeywordFilter) {
    if (config.blockedKeywords && config.blockedKeywords.length > 0) {
      const lower = currentText.toLowerCase();
      const matchedBlocked = config.blockedKeywords.find((kw) => kw.trim() && lower.includes(kw.trim().toLowerCase()));
      if (matchedBlocked) {
        if (typeof config.messagesBlocked === "number") config.messagesBlocked += 1;
        saveStore();
        return {
          shouldProceed: false,
          finalText: currentText,
          reason: `پیام شامل کلمه ممنوعه «${matchedBlocked}» بود و نادیده گرفته شد.`,
        };
      }
    }

    if (config.allowedKeywords && config.allowedKeywords.length > 0) {
      const lower = currentText.toLowerCase();
      const validKws = config.allowedKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
      let passed = false;
      if (config.keywordMatchMode === "all") {
        passed = validKws.every((kw) => lower.includes(kw));
      } else {
        passed = validKws.some((kw) => lower.includes(kw));
      }

      if (!passed) {
        if (typeof config.messagesBlocked === "number") config.messagesBlocked += 1;
        saveStore();
        return {
          shouldProceed: false,
          finalText: currentText,
          reason: `پیام با کلمات کلیدی مجاز مرکز پردازش مطابقت نداشت و رد شد.`,
        };
      }
    }

    if (typeof config.messagesPassed === "number") config.messagesPassed += 1;
    saveStore();
  }

  // 2. Content Cleaner (Cleaning)
  if (config.enableContentCleaning) {
    const cleanRes = cleanMessage(currentText, config);
    currentText = cleanRes.cleanedText;
    removedItems = cleanRes.removedItems;
  }

  // 3. Duplicate Protection (Duplicate Check)
  if (config.enableDuplicateProtection) {
    const timeWindowMs = (config.timeWindowHours || 1) * 3600 * 1000;
    const now = Date.now();
    const sample = currentText.trim().toLowerCase().slice(0, 200);

    for (let i = recentMessageCache.length - 1; i >= 0; i--) {
      if (now - recentMessageCache[i].timestamp > timeWindowMs) {
        recentMessageCache.splice(i, 1);
      }
    }

    if (sample.length > 5) {
      const matchCount = recentMessageCache.filter((m) => m.textOrHash === sample).length;
      if (matchCount >= (config.maxForwardingCount || 2)) {
        return {
          shouldProceed: false,
          finalText: currentText,
          reason: `پیام تکراری تشخیص داده شد (تعداد ارسال بیش از ${config.maxForwardingCount} بار در ${config.timeWindowHours} ساعت گذشته).`,
        };
      }
      recentMessageCache.push({ textOrHash: sample, timestamp: now });
    }
  }

  // 5. AI Job Information Extraction (if enabled)
  if (config.enableJobExtraction && currentText.length > 10) {
    const jobRes = await runAiJobExtraction(currentText);
    if (jobRes.formattedPreview) {
      currentText = jobRes.formattedPreview;
    }
  }

  // 6. Contact Information Manager (if enabled)
  if (config.enableContactManager) {
    const hasPhone = /09\d{9}|\+98\d{10}/.test(currentText);
    const hasHandle = /@\w+/.test(currentText);

    if (!hasPhone && !hasHandle) {
      const note = config.defaultContactNote || "📌 جهت ارتباط با مدیر کانال در ارتباط باشید";
      currentText = currentText.trim() ? `${currentText.trim()}\n\n${note}` : note;
    }
  }

  // 7. Add Message Signature / Footer
  if (config.enableMessageSignature && config.signatureText && config.signatureText.trim()) {
    const sig = config.signatureText.trim();
    currentText = currentText.trim() ? `${currentText.trim()}\n\n${sig}` : sig;
    signatureAdded = true;
  }

  // 8. Media Rules Check
  if (config.enableMediaControl && mediaType) {
    if (mediaType === "photo" && !config.forwardPhotos) {
      return { shouldProceed: false, finalText: currentText, reason: "ارسال تصاویر در تنظیمات رسانه‌ای غیرفعال شده است." };
    }
    if (mediaType === "video" && !config.forwardVideos) {
      return { shouldProceed: false, finalText: currentText, reason: "ارسال ویدیوها در تنظیمات رسانه‌ای غیرفعال شده است." };
    }
    if (mediaType === "audio" && !config.forwardAudios) {
      return { shouldProceed: false, finalText: currentText, reason: "ارسال فایل‌های صوتی غیرفعال است." };
    }
    if (mediaType === "document") {
      const isPdf = currentText.toLowerCase().includes(".pdf");
      if (isPdf && !config.forwardPdfs) {
        return { shouldProceed: false, finalText: currentText, reason: "ارسال PDF غیرفعال است." };
      }
      if (!isPdf && !config.forwardDocuments) {
        return { shouldProceed: false, finalText: currentText, reason: "ارسال اسناد غیرفعال است." };
      }
    }
  }

  return { shouldProceed: true, finalText: currentText, removedItems, signatureAdded };
}

// Forbidden Keyword Matcher Helper
function containsForbiddenKeyword(text: string, forbiddenKeywords: string[] | undefined): string | null {
  if (!forbiddenKeywords || forbiddenKeywords.length === 0) return null;
  const cleanText = (text || "").toLowerCase();
  for (const kw of forbiddenKeywords) {
    const cleanKw = kw.trim().toLowerCase();
    if (cleanKw.length > 0 && cleanText.includes(cleanKw)) {
      return kw;
    }
  }
  return null;
}

// Keyword Matcher Helper
function matchesKeywordFilter(
  text: string,
  keywords: string[] | undefined,
  enabled: boolean | undefined,
  matchMode: 'any' | 'all' = 'any'
): boolean {
  if (!enabled || !keywords || keywords.length === 0) {
    return true; // No filter active for this level -> allow
  }

  const cleanText = (text || "").toLowerCase();
  const validKeywords = keywords
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);

  if (validKeywords.length === 0) return true;

  if (matchMode === 'all') {
    return validKeywords.every((kw) => cleanText.includes(kw));
  } else {
    return validKeywords.some((kw) => cleanText.includes(kw));
  }
}

// Recreate and Send Message to Destination Channel
async function processAndForwardGramMessage(
  source: SourceChannel,
  message: Api.Message
): Promise<{ success: boolean; error?: string }> {
  // Always read latest destination channel directly from PostgreSQL (Requirement 5)
  let rawDestination = await getLatestDestinationChannelFromDb();
  if (!rawDestination || !rawDestination.trim()) {
    rawDestination = store.settings.destinationChannel || "";
  }
  const destination = normalizeDestinationChannel(rawDestination);
  const botToken = (process.env.BOT_TOKEN && process.env.BOT_TOKEN.trim()) || store.settings.botToken;
  const botUsername = store.settings.botInfo?.username ? `@${store.settings.botInfo.username}` : (store.settings.botToken ? "Telegram Bot" : "Not Set");

  if (!botToken || !botToken.trim()) {
    const err = "توکن ربات تلگرام در سیستم ثبت یا تنظیم نشده است.";
    source.errorMessage = err;
    addLog(source.id, source.username, source.title, message.id, "config", "error", `خطا در بازآفرینی پست #${message.id}: ${err}`);
    return { success: false, error: err };
  }

  if (!destination || !destination.trim()) {
    const err = "کانال مقصد در سیستم تنظیم نشده است. لطفاً در بخش تنظیمات کانال مقصد را ثبت کنید.";
    source.errorMessage = err;
    addLog(source.id, source.username, source.title, message.id, "config", "error", `خطا در بازآفرینی پست #${message.id}: ${err}`);
    return { success: false, error: err };
  }

  console.log(`
[FORWARDING PIPELINE]
Source Channel: ${source.username || source.title}
Destination Channel: ${destination}
Bot Username: ${botUsername}
Message ID: #${message.id}
`);

  const rawText = message.message || "";
  
  // Detect media type
  let mediaType = "text";
  if (message.media) {
    if (message.media instanceof Api.MessageMediaPhoto) {
      mediaType = "photo";
    } else if (message.media instanceof Api.MessageMediaDocument) {
      const doc = message.media.document;
      let mime = "application/octet-stream";
      if (doc instanceof Api.Document) mime = doc.mimeType || mime;
      if (mime.startsWith("video/")) mediaType = "video";
      else if (mime.startsWith("audio/")) mediaType = "audio";
      else mediaType = "document";
    }
  }

  // AI Message Processing Center Pipeline Execution
  const pipelineResult = await processMessagePipeline(source, rawText, mediaType);
  if (!pipelineResult.shouldProceed) {
    addLog(
      source.id,
      source.username,
      source.title,
      message.id,
      mediaType,
      "skipped",
      `پست #${message.id} توسط مرکز پردازش هوشمند رد شد: ${pipelineResult.reason}`
    );
    return { success: true };
  }

  const processedText = pipelineResult.finalText;

  // 1. Check Per-Source Keyword Filter
  if (source.enableKeywords) {
    const passedSource = matchesKeywordFilter(
      processedText,
      source.keywords,
      true,
      source.keywordMatchMode || "any"
    );
    if (!passedSource) {
      addLog(
        source.id,
        source.username,
        source.title,
        message.id,
        "text",
        "skipped",
        `پست #${message.id} با فیلتر کلمات کلیدی اختصاصی کانال مطابقت نداشت و نادیده گرفته شد.`
      );
      return { success: true };
    }
  }

  // Format HTML / Caption
  const formattedText = processedText;
  const caption = formattedText.length > 1024 ? formattedText.slice(0, 1020) + "..." : formattedText;

  try {
    let contentType = "text";
    let bufferBase64: string | undefined = undefined;
    let fileName: string | undefined = undefined;

    // Detect media types
    if (message.media) {
      let buffer: Buffer | null = null;
      try {
        const downloaded = await gramClient?.downloadMedia(message, {});
        if (downloaded && downloaded instanceof Buffer) {
          buffer = downloaded;
        }
      } catch (dlErr: any) {
        console.warn(`[MEDIA DOWNLOAD WARNING] Could not download media for #${message.id}:`, dlErr?.message || dlErr);
      }

      if (buffer && buffer instanceof Buffer) {
        bufferBase64 = buffer.toString("base64");
        if (message.media instanceof Api.MessageMediaPhoto) {
          contentType = "photo";
          fileName = "photo.jpg";
        } else if (message.media instanceof Api.MessageMediaDocument) {
          const doc = message.media.document;
          let mime = "application/octet-stream";
          if (doc instanceof Api.Document) {
            mime = doc.mimeType || mime;
          }

          if (mime.startsWith("video/")) {
            contentType = "video";
            fileName = "video.mp4";
          } else if (mime.startsWith("audio/")) {
            contentType = "audio";
            fileName = "audio.mp3";
          } else if (mime.includes("gif") || mime.includes("animation")) {
            contentType = "animation";
            fileName = "animation.gif";
          } else {
            contentType = "document";
            fileName = "file.dat";
          }
        }
      }
    }

    // Enqueue message into the Persistent Queue
    const enqueued = await defaultQueueService.enqueue({
      sourceChannelId: source.id,
      sourceChannelUsername: source.username,
      sourceChannelTitle: source.title,
      destinationChannelId: destination,
      originalMessageId: message.id,
      messageText: processedText,
      formattedText: caption,
      mediaType: contentType,
      mediaMetadata: {
        bufferBase64,
        fileName,
        contentType,
        caption,
        removedItems: pipelineResult.removedItems,
        signatureAdded: pipelineResult.signatureAdded,
      },
    });

    // Mark as processed in source
    source.lastMessageId = Math.max(source.lastMessageId || 0, message.id);
    source.errorMessage = undefined;

    if (!store.processedMessageIds) {
      store.processedMessageIds = {};
    }
    if (!store.processedMessageIds[source.id]) {
      store.processedMessageIds[source.id] = [];
    }
    store.processedMessageIds[source.id].push(message.id);

    let scheduledTimeStr = "";
    try {
      scheduledTimeStr = new Date(enqueued.scheduledTime).toLocaleTimeString("fa-IR", { timeZone: "Asia/Tehran" });
    } catch {
      scheduledTimeStr = enqueued.scheduledTime;
    }

    const logDetails = `پست #${message.id} با موفقیت در صف ارسال هوشمند قرار گرفت (زمانبندی: ${scheduledTimeStr}).` +
      (pipelineResult.removedItems && pipelineResult.removedItems.length > 0 ? ` [موارد پاکسازی‌شده: ${pipelineResult.removedItems.join(', ')}]` : '') +
      (pipelineResult.signatureAdded ? ` [امضای پیام اضافه شد]` : '');

    addLog(
      source.id,
      source.username,
      source.title,
      message.id,
      contentType,
      "success",
      logDetails
    );

    saveStore();
    return { success: true };
  } catch (err: any) {
    const errorMsg = humanizeTelegramError(err?.message || err);
    console.error(`[QUEUE ENQUEUE ERROR] Destination: "${destination}" - Error:`, errorMsg);
    source.errorMessage = errorMsg;
    addLog(
      source.id,
      source.username,
      source.title,
      message.id,
      "unknown",
      "error",
      `خطا در صف‌بندی پست #${message.id}: ${errorMsg}`
    );
    saveStore();
    return { success: false, error: errorMsg };
  }
}

const monitoredSourcesMap = new Map<string, SourceChannel>();
let globalEventHandlerRegistered = false;

// Global Telegram NewMessage Event Handler for ALL incoming messages
async function handleGlobalNewMessage(event: NewMessageEvent) {
  try {
    // 0. Check Master Emergency Power Switch
    if (store.isSystemTurnedOff) {
      // Emergency kill switch active: Completely halt processing any incoming messages
      return;
    }

    const message = event.message;
    if (!message) return;

    // 1. Extract Chat / Channel details safely
    let chatIdRaw = "";
    if (message.chatId) chatIdRaw = message.chatId.toString();
    else if (event.chatId) chatIdRaw = event.chatId.toString();

    let peerChannelId = "";
    if (message.peerId) {
      if ((message.peerId as any).channelId) peerChannelId = (message.peerId as any).channelId.toString();
      else if ((message.peerId as any).chatId) peerChannelId = (message.peerId as any).chatId.toString();
      else if ((message.peerId as any).userId) peerChannelId = (message.peerId as any).userId.toString();
    }

    let chatEntity: any = event.chat;
    if (!chatEntity && gramClient) {
      chatEntity = await event.getChat().catch(() => null);
      if (!chatEntity && message.peerId) {
        chatEntity = await gramClient.getEntity(message.peerId).catch(() => null);
      }
    }

    const chatUsername = chatEntity?.username ? chatEntity.username.toLowerCase().replace(/^@/, "").trim() : "";
    const chatTitle = chatEntity?.title || chatEntity?.firstName || "Telegram Channel";
    const messageId = message.id;
    const rawText = message.message || message.text || "";
    const textPreview = rawText ? rawText.substring(0, 100).replace(/\n/g, " ") : "(رسانه / بدون متن)";

    // Detail Log for EVERY new message received
    console.log(`[EVENT] New Telegram message received`);
    console.log(`[EVENT] Channel: ${chatTitle || (chatUsername ? '@' + chatUsername : 'نامشخص')}`);
    console.log(`[EVENT] Channel ID: ${chatIdRaw || peerChannelId || (chatUsername ? `@${chatUsername}` : 'N/A')}`);
    console.log(`[EVENT] Message ID: #${messageId}`);
    console.log(`[EVENT] Text preview: ${textPreview}`);

    // Generate Candidate Keys for Matching against monitoredSourcesMap
    const candidateKeys = new Set<string>();
    if (chatUsername) {
      candidateKeys.add(chatUsername);
      candidateKeys.add(`@${chatUsername}`);
    }
    if (chatEntity?.id) {
      const eid = chatEntity.id.toString();
      const cleanEid = eid.replace(/^-100/, "").replace(/^-/, "");
      candidateKeys.add(eid);
      candidateKeys.add(cleanEid);
      candidateKeys.add(`-100${cleanEid}`);
      candidateKeys.add(`100${cleanEid}`);
      candidateKeys.add(`-${cleanEid}`);
    }
    if (chatIdRaw) {
      const cleanNum = chatIdRaw.replace(/^-100/, "").replace(/^-/, "");
      candidateKeys.add(chatIdRaw);
      candidateKeys.add(cleanNum);
      candidateKeys.add(`-100${cleanNum}`);
      candidateKeys.add(`100${cleanNum}`);
      candidateKeys.add(`-${cleanNum}`);
    }

    // Prevent infinite loop: Never process messages originating from destination channel or report channel
    const destClean = store.settings.destinationChannel ? cleanChannelIdentifier(store.settings.destinationChannel).toLowerCase() : "";
    const reportClean = store.settings.reportGroupConfig?.chatId ? cleanChannelIdentifier(store.settings.reportGroupConfig.chatId).toLowerCase() : "";
    if (destClean && (chatUsername === destClean || candidateKeys.has(destClean) || candidateKeys.has(`@${destClean}`))) {
      return;
    }
    if (reportClean && (chatUsername === reportClean || candidateKeys.has(reportClean) || candidateKeys.has(`@${reportClean}`))) {
      return;
    }
    if (peerChannelId) {
      const cleanPeer = peerChannelId.replace(/^-100/, "").replace(/^-/, "");
      candidateKeys.add(peerChannelId);
      candidateKeys.add(cleanPeer);
      candidateKeys.add(`-100${cleanPeer}`);
      candidateKeys.add(`100${cleanPeer}`);
      candidateKeys.add(`-${cleanPeer}`);
    }

    let matchedSource: SourceChannel | undefined;
    for (const key of candidateKeys) {
      if (key && monitoredSourcesMap.has(key)) {
        matchedSource = monitoredSourcesMap.get(key);
        if (matchedSource && matchedSource.status === "active") break;
      }
    }

    // Secondary fallback search in store.sources
    if (!matchedSource && store.sources) {
      matchedSource = store.sources.find((s) => {
        if (s.status !== "active") return false;
        const sUser = cleanChannelIdentifier(s.username).toLowerCase();
        if (chatUsername && sUser === chatUsername) return true;
        if (candidateKeys.has(sUser) || candidateKeys.has(`@${sUser}`)) return true;
        if (s.numericId) {
          const sNum = s.numericId.toString().replace(/^-100/, "").replace(/^-/, "");
          if (candidateKeys.has(s.numericId.toString()) || candidateKeys.has(sNum) || candidateKeys.has(`-100${sNum}`)) return true;
        }
        return false;
      });
    }

    // Log if message is received from a channel NOT registered
    if (!matchedSource) {
      console.log(`[MONITOR] Ignored - channel not in active monitoring list`);
      console.log(`[MONITOR] Actual Channel ID: ${chatIdRaw || peerChannelId || 'N/A'}`);
      console.log(`[MONITOR] Actual Channel Name: ${chatTitle || (chatUsername ? `@${chatUsername}` : 'Unknown')}`);
      return;
    }

    // Processing pipeline for matched monitored channel
    await processMonitoredChannelMessage(matchedSource, message, chatTitle || matchedSource.title, chatIdRaw || peerChannelId || matchedSource.numericId || "");

  } catch (err: any) {
    console.error("❌ [MONITOR PIPELINE EXCEPTION] Error handling global Telegram event:", err?.message || err);
  }
}

// Process single matched channel message with explicit keyword logging & error isolation
async function processMonitoredChannelMessage(
  source: SourceChannel,
  message: Api.Message,
  chatTitle: string,
  channelIdStr: string
) {
  const messageId = message.id;
  const rawText = message.message || message.text || "";

  try {
    console.log(`[MONITOR] Match confirmed for channel: ${source.title} (@${source.username})`);

    // 1. Verify source channel active
    if (source.status !== "active") {
      console.log(`[REJECT] Source channel ${source.username} is inactive (status: ${source.status})`);
      addLog(source.id, source.username, source.title, messageId, "unknown", "skipped", `کانال مبدأ در وضعیت ${source.status} قرار دارد.`);
      saveStore();
      return;
    }

    // 2. Verify monitoring not paused globally
    if (store.isMonitoringPaused) {
      console.log(`[REJECT] Monitoring is currently paused globally.`);
      addLog(source.id, source.username, source.title, messageId, "unknown", "skipped", `مانیتورینگ سیستم موقتاً متوقف گردیده است (Paused).`);
      saveStore();
      return;
    }

    // 3. Duplicate check
    if (!store.processedMessageIds) store.processedMessageIds = {};
    if (!store.processedMessageIds[source.id]) store.processedMessageIds[source.id] = [];
    const processedList = store.processedMessageIds[source.id];

    if (processedList.includes(messageId) || (source.lastMessageId && messageId <= source.lastMessageId)) {
      console.log(`[REJECT] Message #${messageId} from @${source.username} already processed or duplicate.`);
      return;
    }

    source.lastCheckedAt = new Date().toISOString();

    // 4. Keyword Checks with Explicit Logs
    let keywordCheckPassed = true;
    let rejectionReason = "";

    // Check Per-Source Keywords
    if (source.enableKeywords && source.keywords && source.keywords.length > 0) {
      const validKeywords = source.keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length > 0);
      console.log(`[KEYWORDS] Loaded: ${validKeywords.length} channel-specific keyword(s)`);
      console.log(`[KEYWORDS] Checking message #${messageId}...`);

      const cleanText = rawText.toLowerCase();
      let matchedKw = "";

      if (source.keywordMatchMode === "all") {
        const allMatch = validKeywords.every((kw) => cleanText.includes(kw));
        if (allMatch) matchedKw = validKeywords.join(" + ");
        else keywordCheckPassed = false;
      } else {
        const found = validKeywords.find((kw) => cleanText.includes(kw));
        if (found) matchedKw = found;
        else keywordCheckPassed = false;
      }

      if (keywordCheckPassed) {
        console.log(`[KEYWORDS] Matched: "${matchedKw}"`);
      } else {
        console.log(`[KEYWORDS] No match`);
        console.log(`[KEYWORDS] Checked keywords: ${validKeywords.join(", ")}`);
        console.log(`[KEYWORDS] Reason for rejection: no configured keyword matched`);
        rejectionReason = `پیام با کلمات کلیدی اختصاصی کانال (${validKeywords.join("، ")}) مطابقت نداشت.`;
      }
    }

    // Check Global Keywords if source check passed
    if (keywordCheckPassed && store.settings.enableGlobalKeywords) {
      const gKw = store.settings.globalKeywords || [];
      const gForbidden = store.settings.globalForbiddenKeywords || [];

      // Check Forbidden
      if (gForbidden.length > 0) {
        const cleanText = rawText.toLowerCase();
        const foundForbidden = gForbidden.find((kw) => cleanText.includes(kw.toLowerCase()));
        if (foundForbidden) {
          keywordCheckPassed = false;
          console.log(`[KEYWORDS] Rejected by Global Forbidden Keyword: "${foundForbidden}"`);
          rejectionReason = `حاوی کلمه کلیدی ممنوعه عمومی (${foundForbidden}) بود.`;
        }
      }

      // Check Allowed Global Keywords
      if (keywordCheckPassed && gKw.length > 0) {
        const validGKw = gKw.map((k) => k.trim().toLowerCase()).filter((k) => k.length > 0);
        console.log(`[KEYWORDS] Loaded: ${validGKw.length} global allowed keyword(s)`);
        console.log(`[KEYWORDS] Checking global keywords...`);

        const cleanText = rawText.toLowerCase();
        let matchedGKw = "";

        if (store.settings.globalKeywordMatchMode === "all") {
          const allMatch = validGKw.every((kw) => cleanText.includes(kw));
          if (allMatch) matchedGKw = validGKw.join(" + ");
          else keywordCheckPassed = false;
        } else {
          const found = validGKw.find((kw) => cleanText.includes(kw));
          if (found) matchedGKw = found;
          else keywordCheckPassed = false;
        }

        if (keywordCheckPassed) {
          console.log(`[KEYWORDS] Matched Global Keyword: "${matchedGKw}"`);
        } else {
          console.log(`[KEYWORDS] No match on global keywords`);
          console.log(`[KEYWORDS] Checked global keywords: ${validGKw.join(", ")}`);
          console.log(`[KEYWORDS] Reason for rejection: no configured keyword matched`);
          if (!rejectionReason) rejectionReason = `پیام با کلمات کلیدی عمومی (${validGKw.join("، ")}) مطابقت نداشت.`;
        }
      }
    }

    // Always create a log entry if not forwarded
    if (!keywordCheckPassed) {
      source.lastMessageId = Math.max(source.lastMessageId || 0, messageId);
      if (!processedList.includes(messageId)) {
        processedList.push(messageId);
        if (processedList.length > 500) processedList.shift();
      }
      addLog(
        source.id,
        source.username,
        source.title,
        messageId,
        "text",
        "skipped",
        `پست #${messageId} نادیده گرفته شد: ${rejectionReason || "هیچ‌یک از کلمات کلیدی تنظیم‌شده مطابقت نداشت."}`
      );
      saveStore();
      return;
    }

    // Forward Message through processing pipeline
    console.log(`[SEND] Forwarding message #${messageId} from @${source.username} to destination...`);
    const result = await processAndForwardGramMessage(source, message);

    if (result && result.success) {
      console.log(`[SEND] Success - Message #${messageId} forwarded successfully.`);
    } else {
      console.error(`[SEND] Failed: ${result?.error || "Unknown send error"}`);
    }

  } catch (err: any) {
    const errMsg = err?.message || err;
    console.error(`❌ [MONITOR ERROR] Exception processing message #${messageId} from @${source.username}:`, errMsg);
    addLog(
      source.id,
      source.username,
      source.title,
      messageId,
      "unknown",
      "error",
      `خطا در پردازش پیام #${messageId}: ${errMsg}`
    );
    saveStore();
  }
}

// Load active channels, build exhaustive lookup map, warm cache & attach global listener
async function initializeSourceListeners() {
  const activeSources = store.sources ? store.sources.filter((s) => s.status === "active") : [];
  console.log(`[MONITOR] Loading ${activeSources.length} active channels for real-time monitoring...`);

  monitoredSourcesMap.clear();

  // If GramJS is connected, warm dialogs cache
  if (gramClient && gramStatus === "connected") {
    try {
      await gramClient.getDialogs({ limit: 100 }).catch(() => []);
    } catch (_) {}
  }

  for (const source of activeSources) {
    const channelName = source.username
      ? (source.username.trim().startsWith("@") ? source.username.trim() : `@${source.username.trim()}`)
      : (source.title || source.id);

    // 1. Register identifier keys into in-memory lookup map
    const cleanUser = cleanChannelIdentifier(source.username).toLowerCase();
    if (source.id) {
      monitoredSourcesMap.set(source.id, source);
    }
    if (cleanUser) {
      monitoredSourcesMap.set(cleanUser, source);
      monitoredSourcesMap.set(`@${cleanUser}`, source);
    }
    if (source.username) {
      const orig = source.username.trim().toLowerCase();
      monitoredSourcesMap.set(orig, source);
      monitoredSourcesMap.set(`@${orig.replace(/^@/, '')}`, source);
    }
    if (source.numericId) {
      const numStr = source.numericId.toString();
      const cleanNum = numStr.replace(/^-100/, "").replace(/^-/, "");
      monitoredSourcesMap.set(numStr, source);
      monitoredSourcesMap.set(cleanNum, source);
      monitoredSourcesMap.set(`-100${cleanNum}`, source);
      monitoredSourcesMap.set(`100${cleanNum}`, source);
      monitoredSourcesMap.set(`-${cleanNum}`, source);
    }

    // 2. Try resolving entity numeric ID if GramJS is connected
    if (gramClient && gramStatus === "connected") {
      try {
        let lookupTarget: any = cleanUser;
        if (/^-?\d+$/.test(cleanUser)) {
          try { lookupTarget = BigInt(cleanUser); } catch (_) {}
        } else if (source.numericId) {
          try { lookupTarget = BigInt(source.numericId); } catch (_) {}
        }

        const entity = await gramClient.getEntity(lookupTarget).catch(() => null);
        if (entity && (entity as any).id) {
          const rawId = (entity as any).id.toString();
          source.numericId = rawId;
          if ((entity as any).title && (!source.title || source.title.startsWith("@") || source.title.startsWith("کانال/گروه"))) {
            source.title = (entity as any).title;
          }
          if ((entity as any).username) {
            source.username = (entity as any).username;
          }

          const cleanNum = rawId.replace(/^-100/, "").replace(/^-/, "");
          monitoredSourcesMap.set(rawId, source);
          monitoredSourcesMap.set(cleanNum, source);
          monitoredSourcesMap.set(`-100${cleanNum}`, source);
          monitoredSourcesMap.set(`100${cleanNum}`, source);
          monitoredSourcesMap.set(`-${cleanNum}`, source);

          // Try to join channel so GramJS receives push events
          try {
            await gramClient.invoke(new Api.channels.JoinChannel({ channel: entity }));
          } catch (_) {}

          saveSourceToDb(source).catch(() => {});
        }
      } catch (err: any) {
        console.warn(`[MONITOR] Notice resolving entity for ${channelName}:`, err?.message || err);
      }
    }

    if (!store.processedMessageIds) store.processedMessageIds = {};
    if (!store.processedMessageIds[source.id]) store.processedMessageIds[source.id] = [];

    console.log(`[MONITOR] Channel ready: ${channelName} (Title: "${source.title}", ID: ${source.numericId || "N/A"})`);
  }

  // Attach single global GramJS NewMessage event listener
  if (gramClient && gramStatus === "connected" && !globalEventHandlerRegistered) {
    try {
      gramClient.addEventHandler(handleGlobalNewMessage, new NewMessage({}));
      globalEventHandlerRegistered = true;
      console.log("✅ [MONITOR] Global Telegram NewMessage Event Listener registered & active.");
    } catch (err: any) {
      console.error("❌ [MONITOR] Error attaching global Telegram event listener:", err?.message || err);
    }
  }

  console.log(`[MONITOR] ✅ All ${activeSources.length} channel(s) fully mapped and ready.`);
}

// Monitoring Health Check
async function runMonitoringHealthCheck() {
  console.log("==========================================");
  console.log("🔍 [MONITORING HEALTH CHECK] Starting check...");
  const activeSources = store.sources ? store.sources.filter((s) => s.status === "active") : [];
  console.log(`[HEALTH] Active monitored channels count: ${activeSources.length}`);

  let okCount = 0;
  let pendingCount = 0;

  for (const source of activeSources) {
    const channelName = source.username ? `@${source.username.replace(/^@/, "")}` : source.title;
    try {
      if (!source.id) {
        console.log(`[HEALTH] ${channelName} Pending: Database record missing ID`);
        pendingCount++;
        continue;
      }

      let resolvedId = source.numericId || "";
      if (gramClient && gramStatus === "connected") {
        const cleanUser = cleanChannelIdentifier(source.username);
        let lookupTarget: any = cleanUser;
        if (/^-?\d+$/.test(cleanUser)) {
          try { lookupTarget = BigInt(cleanUser); } catch (_) {}
        } else if (source.numericId) {
          try { lookupTarget = BigInt(source.numericId); } catch (_) {}
        }

        const entity = await gramClient.getEntity(lookupTarget).catch((err: any) => {
          throw new Error(`Cannot resolve channel - ${err?.message || "Entity not found"}`);
        });

        if (entity) {
          resolvedId = (entity as any).id ? (entity as any).id.toString() : resolvedId;
          source.numericId = resolvedId;
          if ((entity as any).title) source.title = (entity as any).title;
          if ((entity as any).username) source.username = (entity as any).username;
          saveSourceToDb(source).catch(() => {});
        }
      }

      const isCoverageActive = Array.from(monitoredSourcesMap.values()).some((s) => s.id === source.id);

      if (isCoverageActive || (gramClient && gramStatus === "connected")) {
        console.log(`[HEALTH] ${channelName} OK (Resolved ID: ${resolvedId || "N/A"})`);
        okCount++;
      } else {
        console.log(`[HEALTH] ${channelName} Standby: Telegram client offline`);
        okCount++;
      }
    } catch (err: any) {
      console.log(`[HEALTH] ${channelName} Pending: ${err?.message || err}`);
      pendingCount++;
    }
  }

  console.log(`[MONITORING STATUS] Active: ${activeSources.length} | Ready: ${okCount} | Pending: ${pendingCount}`);
  console.log("==========================================");
}

// Telegram Connection Success Notification
async function sendTelegramConnectionSuccessNotification(botUsername: string, destChannel: string, dbInfo: string) {
  if (!store.settings.botToken || !destChannel) return;

  const dateFa = getTehranDateString();
  const timeFa = getTehranTimeString();

  const message =
    `🚀 <b>سامانه هوشمند فورواردر تلگرام با موفقیت متصل و راه‌اندازی شد!</b>\n\n` +
    `🤖 <b>شناسه ربات:</b> @${botUsername}\n` +
    `🎯 <b>کانال/گروه مقصد:</b> <code>${destChannel}</code>\n` +
    `🗄️ <b>وضعیت دیتابیس:</b> ${dbInfo}\n` +
    `⏰ <b>زمان اتصال:</b> <code>${dateFa} ${timeFa}</code>\n` +
    `☁️ <b>محیط اجرا:</b> سرور ابری (Railway / Cloud)\n\n` +
    `🟢 <b>سیستم‌های فعال:</b>\n` +
    `• مانیتورینگ خودکار پیام‌ها و انتقال زنده\n` +
    `• پاکسازی محتوا و فیلتر کلمات کلیدی\n` +
    `• سیستم بک‌آپ‌گیری خودکار ۲۴ ساعته از دیتابیس به تلگرام\n` +
    `• پنل ادمین وب و کنترل درون ربات (دستور <code>/start</code> یا <code>/login</code>)\n\n` +
    `✅ سیستم در وضعیت آماده‌به‌کار قرار گرفت.`;

  try {
    const res = await callTelegramBotApi(store.settings.botToken, "sendMessage", {
      chat_id: normalizeDestinationChannel(destChannel),
      text: message,
      parse_mode: "HTML",
    });
    if (res.ok) {
      console.log(`[TELEGRAM NOTIFICATION] Success message delivered to ${destChannel}`);
    } else {
      console.warn(`[TELEGRAM NOTIFICATION WARNING] Could not send to ${destChannel}: ${res.description}`);
    }
  } catch (err: any) {
    console.warn("[TELEGRAM NOTIFICATION ERROR]:", err?.message || err);
  }
}

// Telegram Database Backup Service (Sends backup_YYYY-MM-DD_HH-mm-ss.sql or .dump document directly to Telegram)
async function performTelegramDatabaseBackup(
  isManualTest: boolean = false,
  customDestination?: string | number,
  preferredFormat: "sql" | "dump" = "sql"
): Promise<{ success: boolean; message: string; filename?: string }> {
  const token = store.settings.botToken;
  const dest = customDestination
    ? String(customDestination)
    : (store.settings.reportGroupConfig?.chatId ||
       store.settings.botAdminConfig?.adminTelegramUserId ||
       (store.settings.botAdminConfig?.autoAuthorizedUsers && store.settings.botAdminConfig.autoAuthorizedUsers[0]));

  if (!token) {
    return { success: false, message: "توکن ربات تلگرام هنوز تنظیم نشده است." };
  }
  if (!dest) {
    return { success: false, message: "شناسه کانال گزارش ادمین جهت دریافت نسخه پشتیبان تنظیم نشده است. لطفاً ابتدا کانال گزارش را تعیین فرمایید." };
  }

  try {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const timeFa = getTehranTimeString(now, true);
    const dateFa = getTehranDateString(now);

    let filename = "";
    let buffer: Buffer;
    let caption = "";

    if (preferredFormat === "sql") {
      filename = `backup_${dateStamp}.sql`;
      const sqlDump = await exportDatabaseSql(true, store);
      buffer = Buffer.from(sqlDump, "utf-8");

      caption = isManualTest
        ? `📦 <b>نسخه پشتیبان دیتابیس ربات (قالب استاندارد SQL)</b>\n\n` +
          `🔒 <b>تضمین امنیت و استقلال:</b> فایل بک‌آپ شامل تمامی کانال‌های مانیتورینگ، فیلترها، تنظیمات کامل AI Rewrite و اکانت‌های متصل به صورت دستورات اجرایی SQL است.\n\n` +
          `📦 نام فایل: <code>${filename}</code>\n` +
          `🕒 زمان استخراج: <code>${dateFa} ساعت ${timeFa} (به وقت تهران +03:30)</code>\n` +
          `🗄️ وضعیت دیتابیس: <b>${isDbConnected ? "PostgreSQL متصل" : "پایگاه داده داخلی"}</b>\n` +
          `📊 کانال‌های ثبت شده: <b>${store.sources.length}</b>\n` +
          `🤖 ماژول‌های فیلترینگ و بازنویسی محلی: <b>تکمیل</b>\n` +
          `📦 حجم فایل: <b>${(buffer.length / 1024).toFixed(1)} KB</b>\n\n` +
          `✅ این فایل استاندارد <code>.sql</code> را می‌توانید مستقیماً در PostgreSQL اجرا کرده یا با ارسال مجدد فایل به همین ربات، تمام تنظیمات را بازنشانی فرمایید.`
        : `📦 <b>پشتیبان‌گیری خودکار ۲۴ ساعته از دیتابیس (قالب استاندارد SQL)</b>\n\n` +
          `📦 نام فایل: <code>${filename}</code>\n` +
          `🕒 تاریخ و زمان: <code>${dateFa} ساعت ${timeFa} (به وقت تهران +03:30)</code>\n` +
          `🗄️ منبع دیتابیس: <b>${isDbConnected ? "PostgreSQL" : "پایگاه داده سامانه"}</b>\n` +
          `📊 کانال‌های فعال: <b>${store.sources.filter((s) => s.status === "active").length}</b>\n` +
          `📝 تعداد لاگ‌ها: <b>${store.logs.length}</b>\n` +
          `🤖 تنظیمات AI Rewrite و قوانین محتوا: <b>کامل</b>\n` +
          `📦 حجم: <b>${(buffer.length / 1024).toFixed(1)} KB</b>`;
    } else {
      filename = `backup_${dateStamp}.dump`;
      const exportedData = await exportDatabaseData(true, store);
      let sqlDump = "";
      try {
        sqlDump = await exportDatabaseSql(true, store);
      } catch (_) {}

      const dumpPayload = {
        app: "TelegramAutoForwarderPro",
        format: "backup.dump",
        version: "2.0.0",
        exportDate: now.toISOString(),
        timestamp: Date.now(),
        timezone: "Asia/Tehran (+03:30)",
        databaseType: isDbConnected ? "postgresql" : "local_store",
        storeData: exportedData,
        sqlDump: sqlDump,
      };

      const backupContent = JSON.stringify(dumpPayload, null, 2);
      buffer = Buffer.from(backupContent, "utf-8");

      caption = isManualTest
        ? `📦 <b>نسخه پشتیبان رسمی دیتابیس ربات (backup.dump)</b>\n\n` +
          `🔒 <b>تضمین امنیت:</b> این نسخه پشتیبان منحصراً در همین چت تلگرام استخراج و تحویل داده شد.\n\n` +
          `📦 فایل: <code>${filename}</code>\n` +
          `🕒 زمان استخراج: <code>${dateFa} ساعت ${timeFa} (به وقت تهران +03:30)</code>\n` +
          `🗄️ منبع دیتابیس: <b>${isDbConnected ? "PostgreSQL متصل" : "پایگاه داده محلی"}</b>\n` +
          `📊 کانال‌های تحت مانیتورینگ: <b>${store.sources.length}</b>\n` +
          `📦 حجم فایل: <b>${(buffer.length / 1024).toFixed(1)} KB</b>\n\n` +
          `✅ این فایل <code>backup.dump</code> را می‌توانید جهت بازنشانی در پنل مدیریت یا ارسال مجدد به همین ربات استفاده فرمایید.`
        : `📦 <b>پشتیبان‌گیری خودکار ۲۴ ساعته از دیتابیس ربات</b>\n\n` +
          `📦 نام فایل: <code>${filename}</code>\n` +
          `🕒 تاریخ و زمان: <code>${dateFa} ساعت ${timeFa} (به وقت تهران +03:30)</code>\n` +
          `🗄️ منبع دیتابیس: <b>${isDbConnected ? "PostgreSQL" : "پایگاه داده سامانه"}</b>\n` +
          `📊 کانال‌های فعال: <b>${store.sources.filter((s) => s.status === "active").length}</b>\n` +
          `📦 حجم فایل بک‌آپ: <b>${(buffer.length / 1024).toFixed(1)} KB</b>`;
    }

    const sendRes = await sendBotMedia(token, "sendDocument", dest, buffer, filename, "document", caption, "HTML");

    if (sendRes.ok) {
      const nowStr = now.toISOString();
      store.stats.lastBackupTime = nowStr;
      if (isDbConnected) {
        updateStatsInDb(store.stats).catch(() => {});
      }
      saveStore();

      addLog(
        "system",
        "system",
        "پشتیبان‌گیری دیتابیس",
        0,
        "backup",
        "success",
        isManualTest
          ? `فایل بک‌آپ (${filename}) با موفقیت ایجاد و به ${dest} ارسال شد.`
          : `بک‌آپ خودکار ۲۴ ساعته (${filename}) به مقصد (${dest}) ارسال شد.`
      );

      return {
        success: true,
        message: `فایل بک‌آپ (${filename}) با موفقیت به تلگرام (${dest}) ارسال گردید.`,
        filename,
      };
    } else {
      const errMsg = humanizeTelegramError(sendRes.description);
      addLog("system", "system", "پشتیبان‌گیری دیتابیس", 0, "backup", "error", `خطا در ارسال بک‌آپ به تلگرام: ${errMsg}`);
      return { success: false, message: `خطا در ارسال به تلگرام: ${errMsg}` };
    }
  } catch (err: any) {
    console.error("[BACKUP TO TELEGRAM ERROR]:", err);
    return { success: false, message: `خطای سیستمی: ${err?.message || err}` };
  }
}

async function startServer() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const configuredVars = ["BOT_TOKEN", "API_ID", "API_HASH", "DATABASE_URL"].filter(
    (key) => !!process.env[key] && process.env[key]!.trim() !== ""
  );

  console.log(`[RAILWAY STARTUP] Web server starting... (Detected ENV variables: ${configuredVars.length ? configuredVars.join(", ") : "None - Setup Wizard will guide configuration in Web UI"})`);
  console.log(`[SERVER] Configured PORT from process.env.PORT: ${process.env.PORT ? process.env.PORT : "not set (defaulting to " + PORT + ")"}`);

  const app = express();
  app.use(express.json());

  // Requirement: Health check routes for Railway / Cloud Run / AI Studio monitoring
  app.get(["/health", "/api/health"], (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/", (req, res, next) => {
    if (req.headers.accept && req.headers.accept.includes("text/html")) {
      return next();
    }
    res.status(200).send("Telegram Forwarder Bot is running");
  });

  // Background Database and Telegram Initialization Worker
  console.log("[WORKER] Telegram worker starting in background...");
  (async () => {
    try {
      console.log("[AI REWRITE] Self-hosted Persian Rewriter Engine initialized ✅");

      // 1. Try to load store from local json file first if it exists
      if (fs.existsSync(STORE_FILE)) {
        try {
          const localData = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
          if (localData && typeof localData === "object") {
            store = {
              ...store,
              ...localData,
              settings: { ...store.settings, ...(localData.settings || {}) },
              stats: { ...store.stats, ...(localData.stats || {}) },
            };
            console.log("[STORE] Loaded saved configuration from local storage");
          }
        } catch (_) {}
      }

      // 2. Try PostgreSQL if DATABASE_URL is set
      if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
        try {
          const dbSuccess = await initDatabase();
          if (dbSuccess) {
            console.log("✓ PostgreSQL connected");
            const loadedStore = await getStoreFromDb();
            if (loadedStore) {
              store = { ...store, ...loadedStore };
            }
          }
        } catch (dbErr: any) {
          console.warn("[DATABASE NOTICE] PostgreSQL connection deferred or failed:", dbErr?.message || dbErr);
        }
      } else {
        console.log("[DATABASE] Running in local/setup mode. PostgreSQL can be attached via Web Setup Wizard.");
      }

      if (!store.processedMessageIds) store.processedMessageIds = {};
      if (!store.sources) store.sources = [];
      if (!store.logs) store.logs = [];
      if (!store.stats) store.stats = { totalTransferred: 0, failedMessages: 0, startTime: new Date().toISOString() };

      // 3. Environment variables override for credentials
      if (process.env.BOT_TOKEN) {
        store.settings.botToken = process.env.BOT_TOKEN.trim();
        store.settings.isVerified = true;
      }
      if (process.env.DESTINATION_CHANNEL) {
        store.settings.destinationChannel = normalizeDestinationChannel(process.env.DESTINATION_CHANNEL.trim());
      }
      if (process.env.API_ID) {
        const parsedId = parseInt(process.env.API_ID, 10);
        if (!isNaN(parsedId)) {
          if (!store.telegramClientConfig) {
            store.telegramClientConfig = { apiId: parsedId, apiHash: "", phoneNumber: "", isConnected: false };
          }
          store.telegramClientConfig.apiId = parsedId;
        }
      }
      if (process.env.API_HASH) {
        if (!store.telegramClientConfig) {
          store.telegramClientConfig = { apiId: null, apiHash: process.env.API_HASH.trim(), phoneNumber: "", isConnected: false };
        }
        store.telegramClientConfig.apiHash = process.env.API_HASH.trim();
      }

      // Check Bot connectivity
      if (store.settings.botToken) {
        try {
          const botMe = await callTelegramBotApi(store.settings.botToken, "getMe");
          if (botMe.ok) {
            store.settings.isVerified = true;
            store.settings.botUsername = botMe.result.username;
            console.log(`✓ Telegram Bot connected (@${botMe.result.username})`);
          }
        } catch (_) {}
      }

      console.log("[WORKER] Telegram worker initialized");

      // Initialize listeners & health checks
      await initializeSourceListeners();
      await runMonitoringHealthCheck();

      // Periodic Monitoring Health Check (Every 5 minutes)
      setInterval(() => {
        runMonitoringHealthCheck().catch((e) => console.error("Error in periodic health check:", e));
      }, 300000);

      // Automated 24-hour recurring backup strictly to Telegram Report Channel (never to destination channel)
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
      setInterval(() => {
        const reportChat = store.settings?.reportGroupConfig?.chatId;
        const autoBackupEnabled = store.settings?.reportGroupConfig?.autoBackupEnabled !== false;
        if (store.settings?.botToken && reportChat && autoBackupEnabled) {
          console.log(`⏰ [AUTO BACKUP] Executing scheduled 24-hour database backup to Report Channel (${reportChat})...`);
          performTelegramDatabaseBackup(false, reportChat, "sql").catch((e) => console.error("Auto backup to report channel error:", e));
        }
      }, TWENTY_FOUR_HOURS_MS);

      // Initialize Admin Report Group Service
      defaultReportGroupService.init(store.settings?.botToken, store.settings?.reportGroupConfig);

      // Initialize Smart Queue Service
      defaultQueueService.init(store.settings?.queueSettings);

      // Start the persistent queue background worker
      defaultQueueService.startWorker(async (item: QueueItem): Promise<{ success: boolean; error?: string }> => {
        const botToken = store.settings?.botToken;
        const destination = item.destinationChannelId || store.settings?.destinationChannel;
        if (!botToken || !destination) {
          return { success: false, error: "توکن ربات یا کانال مقصد تنظیم نشده است." };
        }

        try {
          let sentSuccess = false;
          const mediaMeta = item.mediaMetadata;
          const caption = item.formattedText || item.messageText || "";

          if (mediaMeta?.bufferBase64 && item.mediaType && item.mediaType !== "text") {
            const buffer = Buffer.from(mediaMeta.bufferBase64, "base64");
            const fileName = mediaMeta.fileName || `${item.mediaType}.dat`;

            let botMethod = "sendDocument";
            let fieldName = "document";
            if (item.mediaType === "photo") {
              botMethod = "sendPhoto";
              fieldName = "photo";
            } else if (item.mediaType === "video") {
              botMethod = "sendVideo";
              fieldName = "video";
            } else if (item.mediaType === "audio") {
              botMethod = "sendAudio";
              fieldName = "audio";
            } else if (item.mediaType === "animation") {
              botMethod = "sendAnimation";
              fieldName = "animation";
            }

            const res = await sendBotMedia(botToken, botMethod, destination, buffer, fileName, fieldName, caption);
            if (res.ok) {
              sentSuccess = true;
            } else {
              console.warn(`[QUEUE SENDER] Media send failed (${res.description}), falling back to text`);
            }
          }

          if (!sentSuccess) {
            const textPayload = item.messageText || caption || `پست #${item.originalMessageId} از ${item.sourceChannelTitle || item.sourceChannelUsername}`;
            let res = await callTelegramBotApi(botToken, "sendMessage", {
              chat_id: destination,
              text: textPayload,
              parse_mode: "HTML",
            });
            if (!res.ok) {
              res = await callTelegramBotApi(botToken, "sendMessage", {
                chat_id: destination,
                text: textPayload,
              });
            }
            if (res.ok) {
              sentSuccess = true;
            } else {
              const errDetail = humanizeTelegramError(res.description);
              throw new Error(errDetail);
            }
          }

          // Update stats and source
          const source = store.sources?.find((s) => s.id === item.sourceChannelId || s.username === item.sourceChannelUsername);
          if (source) {
            source.totalTransferred = (source.totalTransferred || 0) + 1;
            source.errorMessage = undefined;
          }
          if (!store.stats) {
            store.stats = { totalTransferred: 0, failedMessages: 0, startTime: new Date().toISOString() };
          }
          store.stats.totalTransferred = (store.stats.totalTransferred || 0) + 1;

          addLog(
            item.sourceChannelId,
            item.sourceChannelUsername || "source",
            item.sourceChannelTitle || "کانال مبدا",
            item.originalMessageId,
            item.mediaType || "text",
            "success",
            `پست #${item.originalMessageId} از صف ارسال هوشمند با موفقیت به ${destination} ارسال شد.`
          );
          saveStore();
          return { success: true };
        } catch (err: any) {
          const errorMsg = humanizeTelegramError(err?.message || err);
          console.error(`[QUEUE WORKER ERROR] Item ${item.id} ->`, errorMsg);
          if (!store.stats) {
            store.stats = { totalTransferred: 0, failedMessages: 0, startTime: new Date().toISOString() };
          }
          store.stats.failedMessages = (store.stats.failedMessages || 0) + 1;
          addLog(
            item.sourceChannelId,
            item.sourceChannelUsername || "source",
            item.sourceChannelTitle || "کانال مبدا",
            item.originalMessageId,
            item.mediaType || "text",
            "error",
            `خطا در ارسال پست #${item.originalMessageId} از صف: ${errorMsg}`
          );
          saveStore();
          return { success: false, error: errorMsg };
        }
      });

      // Scheduled Daily Digest & 24-Hour Database Backup at 00:00 Tehran Time
      let lastDailyDigestSentDate = "";
      let lastDailyBackupSentDate = "";
      setInterval(async () => {
        const repConfig = store.settings?.reportGroupConfig;
        if (!repConfig?.chatId) return;

        const now = new Date();
        let tehranHour = -1;
        let tehranMin = -1;
        let todayKey = "";
        try {
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Tehran",
            hour: "numeric",
            minute: "numeric",
            hour12: false,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
          const parts = formatter.formatToParts(now);
          const map: Record<string, string> = {};
          for (const p of parts) map[p.type] = p.value;
          tehranHour = parseInt(map.hour || "0", 10);
          tehranMin = parseInt(map.minute || "0", 10);
          todayKey = `${map.year}-${map.month}-${map.day}`;
        } catch (_) {
          return;
        }

        // 1. Send Daily Digest if enabled
        if (repConfig.dailyDigestEnabled !== false && tehranHour === 0 && tehranMin <= 2 && lastDailyDigestSentDate !== todayKey) {
          lastDailyDigestSentDate = todayKey;
          console.log(`⏰ [DAILY DIGEST] 00:00 Tehran Time reached. Generating Daily Digest for ${todayKey}...`);

          const qStats = defaultQueueService.getStats();
          const startMs = store.stats?.startTime ? new Date(store.stats.startTime).getTime() : Date.now();
          const uptimeSec = Math.floor((Date.now() - startMs) / 1000);
          const hours = Math.floor(uptimeSec / 3600);
          const mins = Math.floor((uptimeSec % 3600) / 60);

          await defaultReportGroupService.sendDailyDigest({
            persianDate: getTehranDateString(now),
            tehranTime: getTehranTimeString(now, true),
            totalReceived: (store.stats?.totalTransferred || 0) + (store.stats?.failedMessages || 0),
            totalFiltered: (store.settings?.aiProcessing?.messagesBlocked || 0),
            totalSent: store.stats?.totalTransferred || 0,
            totalFailed: store.stats?.failedMessages || 0,
            queuePending: qStats.pendingCount,
            queueScheduled: qStats.scheduledCount,
            queueFailed: qStats.failedCount,
            clientStatus: (gramStatus === "connected" && !!gramClient) ? "🟢 متصل" : "🔴 قطع",
            botStatus: (store.settings?.botToken && store.settings?.isVerified) ? "🟢 متصل" : "🔴 قطع",
            dbStatus: isDbConnected ? "🟢 PostgreSQL" : "🟡 Local Storage",
            uptimeFormatted: `${hours} ساعت و ${mins} دقیقه`,
          }).catch((err) => {
            console.error("[DAILY DIGEST CRON ERROR]:", err);
          });
        }

        // 2. Send 24-Hour Automated Database Backup (.SQL) to Report Channel if enabled
        const autoBackupEnabled = repConfig.autoBackupEnabled !== false;
        if (autoBackupEnabled && tehranHour === 0 && tehranMin <= 2 && lastDailyBackupSentDate !== todayKey) {
          lastDailyBackupSentDate = todayKey;
          console.log(`📦 [AUTO BACKUP] 24-Hour Backup triggered. Exporting and sending SQL backup to ${repConfig.chatId}...`);
          try {
            const backupRes = await performTelegramDatabaseBackup(true, repConfig.chatId, "sql");
            if (backupRes.success) {
              if (store.settings.reportGroupConfig) {
                store.settings.reportGroupConfig.lastBackupAt = new Date().toISOString();
              }
              if (store.stats) {
                store.stats.lastBackupTime = new Date().toISOString();
              }
              saveStore();
              console.log(`✅ [AUTO BACKUP] Daily backup sent successfully: ${backupRes.filename}`);
            } else {
              console.error(`❌ [AUTO BACKUP] Failed to send daily backup:`, backupRes.message);
            }
          } catch (bErr: any) {
            console.error(`❌ [AUTO BACKUP CRON ERROR]:`, bErr);
          }
        }
      }, 30000);

      // Attempt initial GramJS connection
      setTimeout(() => {
        initGramJS();
      }, 1000);
    } catch (err: any) {
      console.error("❌ [BACKGROUND INIT ERROR]:", err?.message || err);
    }
  })();

  // --- API ROUTES ---

  // Auth: Admin Login
  app.post("/api/auth/login", (req, res) => {
    const { password } = req.body;
    if (password === store.adminPasswordHash) {
      res.json({ success: true, message: "احراز هویت موفقیت‌آمیز بود." });
    } else {
      res.status(401).json({ success: false, message: "رمز عبور ادمین اشتباه است." });
    }
  });

  // Auth: Change Admin Password
  app.post("/api/auth/change-password", (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (currentPassword !== store.adminPasswordHash) {
      return res.status(401).json({ success: false, message: "رمز عبور فعلی اشتباه است." });
    }
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ success: false, message: "رمز عبور جدید باید حداقل ۴ کاراکتر باشد." });
    }
    store.adminPasswordHash = newPassword;
    saveStore();
    res.json({ success: true, message: "رمز عبور با موفقیت تغییر یافت." });
  });

  // --- SETUP WIZARD & NO-ENV DEPLOYMENT ROUTES ---

  // Get current Setup & Bot Status (Check if configured or fresh install)
  app.get("/api/setup/status", (req, res) => {
    const isConfigured = !!(store.settings.botToken && store.settings.destinationChannel && store.settings.isVerified);
    res.json({
      isConfigured,
      hasBotToken: !!store.settings.botToken,
      hasDestination: !!store.settings.destinationChannel,
      isBotVerified: !!store.settings.isVerified,
      hasDatabase: isDbConnected,
      databaseType: isDbConnected ? "postgresql" : "local_storage",
      destinationChannel: store.settings.destinationChannel || "",
      botUsername: store.settings.botUsername || "",
      apiId: (process.env.API_ID ? parseInt(process.env.API_ID, 10) : store.telegramClientConfig?.apiId) || null,
      apiHash: (process.env.API_HASH && process.env.API_HASH.trim()) || store.telegramClientConfig?.apiHash || "",
      isTelegramClientConnected: gramStatus === "connected" && !!gramClient,
      lastBackupTime: store.stats?.lastBackupTime || null,
    });
  });

  // Test Database Connection
  app.post("/api/setup/test-db", async (req, res) => {
    const { databaseUrl } = req.body;
    if (!databaseUrl || !String(databaseUrl).trim()) {
      return res.status(400).json({ success: false, message: "آدرس اتصال پایگاه داده (DATABASE_URL) وارد نشده است." });
    }
    try {
      const url = String(databaseUrl).trim();
      const connected = await initDatabase(url);
      if (connected) {
        process.env.DATABASE_URL = url;
        return res.json({ success: true, message: "اتصال به پایگاه داده PostgreSQL با موفقیت برقرار شد و ساختار دیتابیس تایید گردید." });
      } else {
        return res.status(400).json({ success: false, message: "ارتباط با دیتابیس برقرار نشد. لطفاً آدرس اتصال (Connection String) را بررسی فرمایید." });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `خطای اتصال دیتابیس: ${err?.message || err}` });
    }
  });

  // Test Telegram Bot Token
  app.post("/api/setup/test-bot", async (req, res) => {
    const { botToken } = req.body;
    if (!botToken || !String(botToken).trim()) {
      return res.status(400).json({ success: false, message: "توکن ربات تلگرام وارد نشده است." });
    }
    const cleanToken = String(botToken).trim();
    const result = await callTelegramBotApi(cleanToken, "getMe");
    if (result.ok) {
      return res.json({
        success: true,
        message: `اتصال با موفقیت برقرار شد: @${result.result.username} (${result.result.first_name})`,
        bot: result.result,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `توکن ربات نامعتبر است: ${result.description || "عدم دریافت پاسخ از تلگرام"}`,
      });
    }
  });

  // Quick Connect & Save Setup (Configures Bot, Destination, DB, sends success notification to Telegram)
  app.post("/api/setup/quick-connect", async (req, res) => {
    const { botToken, destinationChannel, apiId, apiHash, databaseUrl, adminPassword } = req.body;

    if (!botToken || !destinationChannel) {
      return res.status(400).json({
        success: false,
        message: "لطفاً توکن ربات (@BotFather) و آیدی کانال یا گروه مقصد را وارد کنید.",
      });
    }

    const cleanToken = String(botToken).trim();
    const cleanDest = normalizeDestinationChannel(destinationChannel);

    // 1. Verify Bot Token with Telegram
    const botMe = await callTelegramBotApi(cleanToken, "getMe");
    if (!botMe.ok) {
      return res.status(400).json({
        success: false,
        message: `توکن ربات نامعتبر است: ${humanizeTelegramError(botMe.description)}`,
      });
    }

    // 2. Connect to Database if DATABASE_URL is supplied
    let dbStatusMessage = "دیتابیس محلی سرور";
    if (databaseUrl && String(databaseUrl).trim()) {
      try {
        const url = String(databaseUrl).trim();
        const connected = await initDatabase(url);
        if (connected) {
          process.env.DATABASE_URL = url;
          dbStatusMessage = "PostgreSQL متصل و آماده";
        } else {
          dbStatusMessage = "PostgreSQL متصل نشد (دیتابیس محلی فعال گردید)";
        }
      } catch (dbErr: any) {
        console.warn("Setup database warning:", dbErr?.message || dbErr);
        dbStatusMessage = `خطا در اتصال: ${dbErr?.message || dbErr} (دیتابیس محلی فعال)`;
      }
    }

    // 3. Save Settings
    store.settings.botToken = cleanToken;
    store.settings.destinationChannel = cleanDest;
    store.settings.isVerified = true;
    store.settings.botUsername = botMe.result.username;

    if (adminPassword && String(adminPassword).trim()) {
      store.adminPasswordHash = String(adminPassword).trim();
    }

    if (apiId || apiHash) {
      if (!store.telegramClientConfig) {
        store.telegramClientConfig = {
          apiId: process.env.API_ID ? parseInt(process.env.API_ID, 10) : null,
          apiHash: (process.env.API_HASH && process.env.API_HASH.trim()) || "",
          phoneNumber: "",
          session: "",
          isConnected: false,
          isMonitoringPaused: false,
          connectedPhone: "",
          lastConnectedAt: "",
        };
      }
      if (apiId) store.telegramClientConfig.apiId = Number(apiId);
      if (apiHash) store.telegramClientConfig.apiHash = String(apiHash).trim();
    }

    // Save to store and write to .env for persistence across Railway restarts
    await saveStore();
    try {
      let envContent = "";
      const envPath = path.join(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf-8");
      }
      const updateEnvVar = (key: string, val: string) => {
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}="${val}"`);
        } else {
          envContent += `\n${key}="${val}"`;
        }
      };
      updateEnvVar("BOT_TOKEN", cleanToken);
      updateEnvVar("DESTINATION_CHANNEL", cleanDest);
      if (databaseUrl) updateEnvVar("DATABASE_URL", databaseUrl.trim());
      if (apiId) updateEnvVar("API_ID", String(apiId));
      if (apiHash) updateEnvVar("API_HASH", String(apiHash).trim());
      fs.writeFileSync(envPath, envContent.trim() + "\n");
    } catch (_) {}

    // 4. Send Connection Success Notification directly into the channel/group
    await sendTelegramConnectionSuccessNotification(botMe.result.username, cleanDest, dbStatusMessage);

    addLog(
      "system",
      "system",
      "راه‌اندازی سامانه",
      0,
      "config",
      "success",
      `سامانه با ربات @${botMe.result.username} و کانال مقصد ${cleanDest} متصل و پیام خوش‌آمد ارسال شد.`
    );

    res.json({
      success: true,
      message: `🎉 ربات @${botMe.result.username} با موفقیت متصل شد و پیام تایید به کانال/گروه مقصد (${cleanDest}) ارسال گردید!`,
      botUsername: botMe.result.username,
      destinationChannel: cleanDest,
      databaseConnected: isDbConnected,
      settings: store.settings,
    });
  });

  // Requirement: Manual / Instant backup test sent directly to Telegram group/channel
  app.post("/api/admin/backup-to-telegram", async (req, res) => {
    try {
      const result = await performTelegramDatabaseBackup(true);
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          lastBackupTime: store.stats.lastBackupTime,
        });
      } else {
        res.status(400).json({ success: false, message: result.message });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || err });
    }
  });

  // --- TELEGRAM CLIENT API ROUTES ---

  // Get Telegram Client Connection Status
  app.get("/api/telegram-client/status", (req, res) => {
    const isClientConn = gramStatus === 'connected' && !!gramClient;
    const envApiId = process.env.API_ID ? parseInt(process.env.API_ID, 10) : null;
    const envApiHash = process.env.API_HASH && process.env.API_HASH.trim() ? process.env.API_HASH.trim() : null;
    const isEnvConfigured = !!(envApiId && envApiHash && envApiId !== 2040);

    const resolvedApiId = envApiId || store.telegramClientConfig?.apiId || null;
    const resolvedApiHash = envApiHash || store.telegramClientConfig?.apiHash || "";

    res.json({
      clientConfig: {
        apiId: resolvedApiId && resolvedApiId !== 2040 ? resolvedApiId : null,
        apiHash: resolvedApiHash && resolvedApiId !== 2040 ? resolvedApiHash : "",
        phoneNumber: store.telegramClientConfig?.phoneNumber || "",
        isConnected: isClientConn,
        connectedPhone: store.telegramClientConfig?.connectedPhone || store.telegramClientConfig?.phoneNumber || "",
        lastConnectedAt: store.telegramClientConfig?.lastConnectedAt || "",
        hasSession: !!(store.telegramClientConfig?.session || store.telegramSession),
        isEnvConfigured,
        hasApiCredentials: isEnvConfigured || (!!store.telegramClientConfig?.apiId && !!store.telegramClientConfig?.apiHash && store.telegramClientConfig.apiId !== 2040),
      },
      gramStatus,
    });
  });

  // Step 1: Send Login Code to Telegram
  app.post("/api/telegram-client/send-code", async (req, res) => {
    const { apiId, apiHash, phoneNumber } = req.body;

    const envApiId = process.env.API_ID ? parseInt(process.env.API_ID, 10) : null;
    const envApiHash = process.env.API_HASH && process.env.API_HASH.trim() ? process.env.API_HASH.trim() : null;

    // Prioritize explicit input, then env, then store
    const resolvedApiId = (apiId !== undefined && apiId !== null && String(apiId).trim() !== "")
      ? parseInt(String(apiId).trim(), 10)
      : (envApiId || store.telegramClientConfig?.apiId);

    const resolvedApiHash = (apiHash !== undefined && apiHash !== null && String(apiHash).trim() !== "")
      ? String(apiHash).trim()
      : (envApiHash || store.telegramClientConfig?.apiHash);

    if (!resolvedApiId || isNaN(resolvedApiId) || resolvedApiId <= 0) {
      return res.status(400).json({
        success: false,
        errorCode: "API_ID_INVALID",
        message: "شناسه API ID نامعتبر است. لطفاً یک عدد صحیح معتبر وارد کنید یا در متغیرهای محیطی قرار دهید.",
      });
    }

    if (resolvedApiId === 2040) {
      return res.status(400).json({
        success: false,
        errorCode: "API_ID_PUBLISHED_FLOOD",
        message: "شناسه پیش‌فرض 2040 توسط تلگرام مسدود شده است. لطفاً شناسه اختصاصی خود را از my.telegram.org دریافت و وارد کنید.",
      });
    }

    if (!resolvedApiHash || resolvedApiHash.length < 10) {
      return res.status(400).json({
        success: false,
        errorCode: "API_HASH_INVALID",
        message: "مقدار API HASH نامعتبر است. لطفاً کد ۳۲ حرفی معتبر را از my.telegram.org دریافت و وارد فرمایید.",
      });
    }

    const cleanPhone = normalizeTelegramPhoneNumber(phoneNumber);
    if (!cleanPhone || cleanPhone.length < 8 || !/^\+[1-9]\d{6,14}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        errorCode: "PHONE_NUMBER_INVALID",
        message: "شماره تلفن وارد شده نامعتبر است. شماره را با کد کشور بین‌المللی (مثال: +989123456789) وارد نمایید.",
      });
    }

    try {
      if (pendingAuthClient) {
        try { await pendingAuthClient.disconnect(); } catch (_) {}
        pendingAuthClient = null;
      }

      console.log(`📡 [TELEGRAM CLIENT AUTH] Initiating connection for ${cleanPhone} (API_ID: ${resolvedApiId})...`);
      const session = new StringSession("");
      pendingAuthClient = new TelegramClient(session, resolvedApiId, resolvedApiHash, {
        connectionRetries: 3,
        useWSS: false,
        timeout: 20000,
      });

      await pendingAuthClient.connect();

      const sendRes = await pendingAuthClient.sendCode(
        { apiId: resolvedApiId, apiHash: resolvedApiHash },
        cleanPhone
      );

      const isViaApp = !!(sendRes as any)?.isCodeViaApp;

      pendingAuthData = {
        apiId: resolvedApiId,
        apiHash: resolvedApiHash,
        phoneNumber: cleanPhone,
        phoneCodeHash: sendRes.phoneCodeHash,
        isCodeViaApp: isViaApp,
        timestamp: Date.now(),
      };

      addLog("system", "system", "کلاینت تلگرام", 0, "config", "success", `کد تایید ورود به شماره ${cleanPhone} ارسال گردید (${isViaApp ? "ارسال درون‌برنامه‌ای به تلگرام" : "ارسال پیامکی"}).`);

      res.json({
        success: true,
        message: isViaApp
          ? "کد تایید به اپلیکیشن فعال تلگرام شما ارسال شد. لطفاً چت رسمی Telegram در اپلیکیشن تلگرام را بررسی فرمایید."
          : `کد تایید ورود به تلگرام برای شماره ${cleanPhone} ارسال گردید.`,
        phoneCodeHash: sendRes.phoneCodeHash,
        phoneNumber: cleanPhone,
        isCodeViaApp: isViaApp,
      });
    } catch (err: any) {
      console.error("❌ [TELEGRAM CLIENT sendCode error]:", err);
      if (pendingAuthClient) {
        try { await pendingAuthClient.disconnect(); } catch (_) {}
        pendingAuthClient = null;
      }
      const formatted = formatTelegramRpcError(err);
      res.status(400).json({
        success: false,
        errorCode: formatted.code,
        message: formatted.message,
        isCodeViaApp: formatted.isAppCode,
        floodWaitSeconds: formatted.floodWaitSeconds,
      });
    }
  });

  // Step 2: Verify Login Code
  app.post("/api/telegram-client/verify-code", async (req, res) => {
    const { phoneCode } = req.body;

    if (!phoneCode || !pendingAuthClient || !pendingAuthData) {
      return res.status(400).json({
        success: false,
        errorCode: "AUTH_SESSION_EXPIRED",
        message: "درخواست نامعتبر است یا زمان جلسه منقضی شده است. لطفاً مجدداً شماره را ارسال نمایید.",
      });
    }

    const cleanCode = normalizeTelegramPhoneNumber(phoneCode).replace(/\D/g, "");

    try {
      await pendingAuthClient.invoke(
        new Api.auth.SignIn({
          phoneNumber: pendingAuthData.phoneNumber,
          phoneCodeHash: pendingAuthData.phoneCodeHash,
          phoneCode: cleanCode,
        })
      );

      // Sign-in successful
      const sessionStr = pendingAuthClient.session.save() as unknown as string;
      const me = await pendingAuthClient.getMe().catch(() => null);

      store.telegramClientConfig = {
        apiId: pendingAuthData.apiId,
        apiHash: pendingAuthData.apiHash,
        phoneNumber: pendingAuthData.phoneNumber,
        session: sessionStr,
        isConnected: true,
        connectedPhone: me && (me as any).phone ? '+' + (me as any).phone : pendingAuthData.phoneNumber,
        lastConnectedAt: new Date().toISOString(),
        isMonitoringPaused: false,
      };
      store.telegramSession = sessionStr;
      await saveStore();

      gramClient = pendingAuthClient;
      gramStatus = 'connected';
      pendingAuthClient = null;
      pendingAuthData = null;

      addLog("system", "system", "کلاینت تلگرام", 0, "config", "success", `کلاینت تلگرام با شماره ${store.telegramClientConfig.connectedPhone} با موفقیت متصل شد.`);

      initializeSourceListeners().catch((err) => {
        console.error("Error initializing source listeners after login:", err);
      });

      res.json({
        success: true,
        message: "🟢 ورود و اتصال کلاینت تلگرام با موفقیت انجام شد!",
        clientConfig: {
          ...store.telegramClientConfig,
          isConnected: true,
          hasSession: true,
        },
      });
    } catch (err: any) {
      console.error("verifyCode error:", err);
      const rawMsg = String(err?.message || err?.errorMessage || "");
      if (rawMsg.includes("SESSION_PASSWORD_NEEDED")) {
        return res.json({
          success: false,
          requiresPassword: true,
          errorCode: "SESSION_PASSWORD_NEEDED",
          message: "این حساب تلگرام دارای تایید دو مرحله‌ای (Two-Step Verification) است. لطفاً رمز عبور را وارد نمایید.",
        });
      }

      const formatted = formatTelegramRpcError(err);
      res.status(400).json({
        success: false,
        errorCode: formatted.code,
        message: formatted.message,
      });
    }
  });

  // Step 3: Verify 2FA Password if enabled
  app.post("/api/telegram-client/verify-password", async (req, res) => {
    const { password } = req.body;

    if (!password || !pendingAuthClient || !pendingAuthData) {
      return res.status(400).json({
        success: false,
        errorCode: "AUTH_SESSION_EXPIRED",
        message: "درخواست نامعتبر است یا جلسه احراز هویت منقضی شده است. لطفاً مجدداً شماره را وارد کنید.",
      });
    }

    const cleanPassword = String(password).trim();

    try {
      const passwordInfo = await pendingAuthClient.invoke(new Api.account.GetPassword());
      const checkPassword = await computeCheck(passwordInfo, cleanPassword);
      await pendingAuthClient.invoke(new Api.auth.CheckPassword({ password: checkPassword }));

      const sessionStr = pendingAuthClient.session.save() as unknown as string;
      const me = await pendingAuthClient.getMe().catch(() => null);

      store.telegramClientConfig = {
        apiId: pendingAuthData.apiId,
        apiHash: pendingAuthData.apiHash,
        phoneNumber: pendingAuthData.phoneNumber,
        session: sessionStr,
        isConnected: true,
        connectedPhone: me && (me as any).phone ? '+' + (me as any).phone : pendingAuthData.phoneNumber,
        lastConnectedAt: new Date().toISOString(),
        isMonitoringPaused: false,
      };
      store.telegramSession = sessionStr;
      await saveStore();

      gramClient = pendingAuthClient;
      gramStatus = 'connected';
      pendingAuthClient = null;
      pendingAuthData = null;

      addLog("system", "system", "کلاینت تلگرام", 0, "config", "success", `تایید دو مرحله‌ای انجام شد و کلاینت تلگرام (${store.telegramClientConfig.connectedPhone}) با موفقیت متصل گردید.`);

      initializeSourceListeners().catch((err) => {
        console.error("Error initializing source listeners after 2FA login:", err);
      });

      res.json({
        success: true,
        message: "🟢 تایید دو مرحله‌ای موفقیت‌آمیز بود و کلاینت تلگرام متصل شد!",
        clientConfig: {
          ...store.telegramClientConfig,
          isConnected: true,
          hasSession: true,
        },
      });
    } catch (err: any) {
      console.error("verifyPassword error:", err);
      const formatted = formatTelegramRpcError(err);
      res.status(400).json({
        success: false,
        errorCode: formatted.code,
        message: `رمز عبور دو مرحله‌ای اشتباه است: ${formatted.message}`,
      });
    }
  });

  // Disconnect Telegram Client
  app.post("/api/telegram-client/disconnect", async (req, res) => {
    try {
      if (gramClient) {
        try { await gramClient.disconnect(); } catch (_) {}
        gramClient = null;
      }
      gramStatus = 'disconnected';
      const envApiId = process.env.API_ID ? parseInt(process.env.API_ID, 10) : null;
      const envApiHash = (process.env.API_HASH && process.env.API_HASH.trim()) || "";

      store.telegramClientConfig = {
        apiId: envApiId && envApiId !== 2040 ? envApiId : null,
        apiHash: envApiHash && envApiId !== 2040 ? envApiHash : "",
        phoneNumber: "",
        session: "",
        isConnected: false,
        connectedPhone: "",
        lastConnectedAt: "",
        isMonitoringPaused: false,
      };
      store.telegramSession = "";
      await saveStore();

      addLog("system", "system", "کلاینت تلگرام", 0, "config", "success", "ارتباط کلاینت تلگرام قطع گردید.");

      res.json({
        success: true,
        message: "اتصال کلاینت تلگرام با موفقیت قطع گردید و نشست ذخیره‌شده پاک شد.",
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: `خطا در قطع ارتباط کلاینت: ${err.message}`,
      });
    }
  });

  // Reconnect Telegram Client
  app.post("/api/telegram-client/reconnect", async (req, res) => {
    try {
      await initGramJS();
      if (gramStatus === 'connected' && gramClient) {
        const me = await gramClient.getMe().catch(() => null);
        const name = me ? (me as any).firstName : 'کاربر متصل';
        return res.json({
          success: true,
          message: `اتصال مجدد با موفقیت انجام شد. کلاینت فعال: ${name}`,
          clientConfig: store.telegramClientConfig,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "امکان برقراری ارتباط با کلاینت تلگرام وجود ندارد. نشست منقضی شده یا اطلاعات نامعتبر است.",
        });
      }
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: `خطا در اتصال مجدد کلاینت: ${err.message}`,
      });
    }
  });

  // Test Telegram Client Connection
  app.post("/api/telegram-client/test", async (req, res) => {
    try {
      if (gramClient && gramStatus === 'connected') {
        const me = await gramClient.getMe().catch(() => null);
        if (me) {
          return res.json({
            success: true,
            message: `تست اتصال کلاینت با موفقیت انجام شد! حساب متصل: ${(me as any).firstName || 'کاربر'} (@${(me as any).username || 'بدون آیدی'}) - شماره: +${(me as any).phone || store.telegramClientConfig?.connectedPhone || ''}`,
            user: {
              id: (me as any).id?.toString(),
              firstName: (me as any).firstName,
              username: (me as any).username,
              phone: (me as any).phone,
            },
          });
        }
      }

      // Try reconnecting if session exists
      if (store.telegramClientConfig?.session || store.telegramSession) {
        await initGramJS();
        if (gramClient && gramStatus === 'connected') {
          const me = await gramClient.getMe().catch(() => null);
          return res.json({
            success: true,
            message: `تست اتصال کلاینت با موفقیت انجام شد! حساب متصل: ${me ? (me as any).firstName : 'فعال'}`,
            user: me ? {
              id: (me as any).id?.toString(),
              firstName: (me as any).firstName,
              username: (me as any).username,
              phone: (me as any).phone,
            } : undefined,
          });
        }
      }

      return res.status(400).json({
        success: false,
        message: "کلاینت تلگرام متصل نیست. لطفاً ابتدا «اتصال تلگرام» را انجام دهید.",
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: `خطا در تست اتصال کلاینت: ${err.message}`,
      });
    }
  });

  // Pause Telegram Client Monitoring
  app.post("/api/telegram-client/pause", (req, res) => {
    store.isMonitoringPaused = true;
    if (store.telegramClientConfig) {
      store.telegramClientConfig.isMonitoringPaused = true;
    }
    saveStore();
    addLog("system", "system", "کلاینت تلگرام", 0, "config", "success", "مانیتورینگ تلگرام موقتاً متوقف گردید.");
    res.json({
      success: true,
      message: "🟡 مانیتورینگ متوقف شد (Monitoring Paused)",
      isMonitoringPaused: true,
    });
  });

  // Resume Telegram Client Monitoring
  app.post("/api/telegram-client/resume", (req, res) => {
    store.isMonitoringPaused = false;
    if (store.telegramClientConfig) {
      store.telegramClientConfig.isMonitoringPaused = false;
    }
    saveStore();
    addLog("system", "system", "کلاینت تلگرام", 0, "config", "success", "مانیتورینگ تلگرام مجدداً فعال گردید.");
    res.json({
      success: true,
      message: "🟢 مانیتورینگ فعال گردید (Monitoring Active)",
      isMonitoringPaused: false,
    });
  });

  // Telegram Bot Test Endpoint
  app.post("/api/bot-test", async (req, res) => {
    const { text, mediaUrl } = req.body;

    if (!store.settings.botToken || !store.settings.destinationChannel) {
      return res.status(400).json({
        success: false,
        message: "🔴 Sending failed: ربات تلگرام یا کانال مقصد تنظیم و تایید نشده است.",
        deliveryStatus: {
          botUsername: store.settings.botInfo?.username || "تنظیم‌نشده",
          destinationChannel: store.settings.destinationChannel || "تنظیم‌نشده",
          lastTestTime: new Date().toISOString(),
          preview: text || "پیام خالی",
          success: false,
        },
      });
    }

    const cleanText = text && text.trim() ? text.trim() : "این یک پیام تست از داشبورد مدیریت است 🚀";
    const dest = store.settings.destinationChannel;
    const token = store.settings.botToken;

    try {
      let telegramRes: any;
      if (mediaUrl && mediaUrl.trim()) {
        const cleanMedia = mediaUrl.trim();
        const isVideo = cleanMedia.match(/\.(mp4|mov|avi|mkv)(\?.*)?$/i);
        const method = isVideo ? "sendVideo" : "sendPhoto";
        const paramKey = isVideo ? "video" : "photo";

        telegramRes = await callTelegramBotApi(token, method, {
          chat_id: dest,
          [paramKey]: cleanMedia,
          caption: cleanText,
        });

        if (!telegramRes.ok) {
          telegramRes = await callTelegramBotApi(token, "sendMessage", {
            chat_id: dest,
            text: `${cleanText}\n\n[لینک رسانه: ${cleanMedia}]`,
          });
        }
      } else {
        telegramRes = await callTelegramBotApi(token, "sendMessage", {
          chat_id: dest,
          text: cleanText,
        });
      }

      if (telegramRes.ok) {
        addLog("system", "system", "تست ربات", 0, "test", "success", `پیام تست با موفقیت به ${dest} ارسال شد.`);
        saveStore();

        return res.json({
          success: true,
          message: "🟢 Message sent successfully",
          deliveryStatus: {
            botUsername: store.settings.botInfo?.username || "ربات متصل",
            destinationChannel: dest,
            lastTestTime: new Date().toISOString(),
            preview: cleanText,
            success: true,
          },
        });
      } else {
        const errorDetails = telegramRes.description || "خطای نا مشخص در ارسال به تلگرام";
        addLog("system", "system", "تست ربات", 0, "test", "error", `خطا در ارسال پیام تست: ${errorDetails}`);
        saveStore();

        return res.status(400).json({
          success: false,
          message: `🔴 Sending failed: ${errorDetails}`,
          deliveryStatus: {
            botUsername: store.settings.botInfo?.username || "ربات",
            destinationChannel: dest,
            lastTestTime: new Date().toISOString(),
            preview: cleanText,
            success: false,
          },
        });
      }
    } catch (err: any) {
      const errMsg = err.message || "خطای ارتباط با سرور";
      addLog("system", "system", "تست ربات", 0, "test", "error", `خطا در اجرای تست ربات: ${errMsg}`);
      saveStore();

      return res.status(500).json({
        success: false,
        message: `🔴 Sending failed: ${errMsg}`,
        deliveryStatus: {
          botUsername: store.settings.botInfo?.username || "ربات",
          destinationChannel: dest,
          lastTestTime: new Date().toISOString(),
          preview: cleanText,
          success: false,
        },
      });
    }
  });

  // Settings: Get Settings
  app.get("/api/settings", (req, res) => {
    res.json({
      settings: store.settings,
    });
  });

  // Settings: Quick Update Destination Channel Only
  app.post("/api/settings/destination", async (req, res) => {
    const { destinationChannel } = req.body;

    if (!destinationChannel || !destinationChannel.trim()) {
      return res.status(400).json({
        success: false,
        message: "لطفاً شناسه عددی یا لینک کانال مقصد را وارد کنید.",
      });
    }

    const cleanDest = normalizeDestinationChannel(destinationChannel);
    store.settings.destinationChannel = cleanDest;

    // Persist to PostgreSQL if connected
    try {
      await saveSettingsToDb(store.settings).catch(() => {});
    } catch (_) {}
    saveStore();

    addLog(
      "system",
      "system",
      "تنظیمات کانال مقصد",
      0,
      "config",
      "success",
      `کانال مقصد با موفقیت به «${cleanDest}» تغییر یافت و ذخیره شد.`
    );

    res.json({
      success: true,
      message: `کانال مقصد با موفقیت به ${cleanDest} به‌روزرسانی شد.`,
      settings: store.settings,
    });
  });

  // Settings: Save Bot Token & Destination Channel
  app.post("/api/settings", async (req, res) => {
    const { botToken, destinationChannel } = req.body;
    const tokenToUse = (botToken && botToken.trim()) || store.settings.botToken;

    if (!tokenToUse || !destinationChannel) {
      return res.status(400).json({
        success: false,
        message: "لطفاً هم توکن ربات و هم شناسه عددی یا لینک کانال مقصد را وارد کنید.",
      });
    }

    const cleanToken = tokenToUse.trim();
    const cleanDest = normalizeDestinationChannel(destinationChannel);

    try {
      // 1. Verify Bot Token via Telegram getMe
      const botMe = await callTelegramBotApi(cleanToken, "getMe");
      if (!botMe.ok) {
        return res.status(400).json({
          success: false,
          message: `توکن ربات نامعتبر است: ${botMe.description || "عدم دسترسی به تلگرام"}`,
        });
      }

      // 2. Test destination channel connection (optional check)
      let verifiedDestName = cleanDest;
      try {
        const chatInfo = await callTelegramBotApi(cleanToken, "getChat", { chat_id: cleanDest });
        if (chatInfo.ok && chatInfo.result && chatInfo.result.title) {
          verifiedDestName = `${chatInfo.result.title} (${cleanDest})`;
        }
      } catch (_) {}

      store.settings.botToken = cleanToken;
      store.settings.destinationChannel = cleanDest;
      store.settings.botInfo = {
        id: botMe.result.id,
        username: botMe.result.username,
        first_name: botMe.result.first_name,
        can_join_groups: botMe.result.can_join_groups,
        can_read_all_group_messages: botMe.result.can_read_all_group_messages,
      };
      store.settings.isVerified = true;
      store.settings.lastVerifiedAt = new Date().toISOString();

      try {
        await saveSettingsToDb(store.settings).catch(() => {});
      } catch (_) {}
      saveStore();

      // Trigger GramJS client login
      initGramJS();

      addLog(
        "system",
        "system",
        "تنظیمات سیستم",
        0,
        "config",
        "success",
        `ربات @${botMe.result.username} و کانال مقصد ${verifiedDestName} با موفقیت تایید و ذخیره شدند.`
      );

      res.json({
        success: true,
        message: `ربات @${botMe.result.username} و کانال مقصد با موفقیت متصل گردید!`,
        settings: store.settings,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: `خطا در بررسی اطلاعات تلگرام: ${err.message}`,
      });
    }
  });

  // Global Keyword Filter: Get & Save
  app.get("/api/global-keywords", (req, res) => {
    res.json({
      enableGlobalKeywords: !!store.settings.enableGlobalKeywords,
      globalKeywords: store.settings.globalKeywords || [],
      globalForbiddenKeywords: store.settings.globalForbiddenKeywords || [],
      globalKeywordMatchMode: store.settings.globalKeywordMatchMode || "any",
    });
  });

  app.post("/api/global-keywords", (req, res) => {
    const { enableGlobalKeywords, globalKeywords, globalForbiddenKeywords, globalKeywordMatchMode } = req.body;

    store.settings.enableGlobalKeywords = !!enableGlobalKeywords;
    if (Array.isArray(globalKeywords)) {
      store.settings.globalKeywords = globalKeywords.map((k: string) => k.trim()).filter((k: string) => k.length > 0);
    }
    if (Array.isArray(globalForbiddenKeywords)) {
      store.settings.globalForbiddenKeywords = globalForbiddenKeywords.map((k: string) => k.trim()).filter((k: string) => k.length > 0);
    }
    if (globalKeywordMatchMode === "any" || globalKeywordMatchMode === "all") {
      store.settings.globalKeywordMatchMode = globalKeywordMatchMode;
    }

    saveStore();

    addLog(
      "system",
      "system",
      "فیلتر کلمات کلیدی عمومی",
      0,
      "config",
      "success",
      `تنظیمات فیلتر عمومی کلمات کلیدی به‌روزرسانی شد. (وضعیت: ${store.settings.enableGlobalKeywords ? "فعال" : "غیرفعال"} | کلمات مجاز: ${store.settings.globalKeywords?.length || 0} | کلمات ممنوعه: ${store.settings.globalForbiddenKeywords?.length || 0})`
    );

    res.json({
      success: true,
      message: "تنظیمات فیلتر عمومی کلمات کلیدی با موفقیت ذخیره شد.",
      settings: {
        enableGlobalKeywords: store.settings.enableGlobalKeywords,
        globalKeywords: store.settings.globalKeywords,
        globalForbiddenKeywords: store.settings.globalForbiddenKeywords,
        globalKeywordMatchMode: store.settings.globalKeywordMatchMode,
      },
    });
  });

  // Sources: Validate Source Public Status
  app.post("/api/sources/validate", async (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, message: "شناسه کانال یا گروه الزامی است." });
    }

    const cleanUser = cleanChannelIdentifier(username);

    try {
      const details = await resolveChannelDetails(cleanUser);

      return res.json({
        success: true,
        valid: true,
        title: details.title,
        username: details.username || cleanUser,
        numericId: details.numericId,
        type: "channel",
        subscriberCount: details.subscriberCount,
        status: "connected",
        message: "کانال/گروه معتبر است و آماده مانیتورینگ می‌باشد.",
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        valid: false,
        status: "not_found",
        message: `عدم امکان دسترسی به ${cleanUser}: ${err.message || "کانال یافت نشد"}`,
      });
    }
  });

  // Sources: List Monitored Sources
  app.get("/api/sources", (req, res) => {
    res.json({ sources: store.sources });
  });

  // Sources: Manual Trigger Health Check / Channel Sync on all sources
  app.post("/api/sources/check-all", async (req, res) => {
    try {
      await initializeSourceListeners();
      await runMonitoringHealthCheck();
      await runPeriodicChannelSync();
      res.json({
        success: true,
        message: `بررسی جامع و همگام‌سازی تمامی ${store.sources.length} کانال انجام شد.`,
        sources: store.sources,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: `خطا در بررسی کانال‌ها: ${err?.message || err}`,
      });
    }
  });

  // Sources: Add Monitored Source Channel / Group
  app.post("/api/sources", async (req, res) => {
    const { username, type, keywords, enableKeywords, keywordMatchMode } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: "شناسه یا آیدی عددی کانال/گروه الزامی است." });
    }

    const cleanUsername = cleanChannelIdentifier(username);

    // Check duplicate
    const existing = store.sources.find((s) => s.username.toLowerCase() === cleanUsername.toLowerCase());
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `کانال/گروه ${cleanUsername} قبلاً به لیست مانیتورینگ اضافه شده است.`,
      });
    }

    try {
      const details = await resolveChannelDetails(cleanUsername);

      const newSource: SourceChannel = {
        id: `src_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: details.title,
        username: details.username || cleanUsername,
        numericId: details.numericId,
        type: type === "group" ? "group" : "channel",
        status: "active",
        createdAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        lastMessageId: Math.max(0, details.latestPostId - 1),
        totalTransferred: 0,
        subscriberCount: details.subscriberCount,
        keywords: Array.isArray(keywords) ? keywords : [],
        enableKeywords: !!enableKeywords,
        keywordMatchMode: keywordMatchMode === "all" ? "all" : "any",
      };

      if (!store.processedMessageIds) store.processedMessageIds = {};
      store.processedMessageIds[newSource.id] = [];

      store.sources.push(newSource);
      await saveSourceToDb(newSource);
      await saveStore();
      await initializeSourceListeners();

      addLog(
        newSource.id,
        newSource.username,
        newSource.title,
        0,
        "config",
        "success",
        `کانال/گروه «${details.title}» (${cleanUsername}) با شناسه عددی ${details.numericId || "نامشخص"} با موفقیت به لیست مانیتورینگ اضافه شد.`
      );

      res.status(201).json({
        success: true,
        message: `کانال/گروه «${details.title}» با موفقیت اضافه شد.`,
        source: newSource,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: `خطا در اضافه کردن کانال مبدأ: ${err.message}`,
      });
    }
  });

  // Sources: Bulk Add Monitored Channels / Groups (Multiple items line by line)
  app.post("/api/sources/bulk", async (req, res) => {
    const { items, type } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "لیست آیدی‌ها یا شناسه‌های کانال خالی است." });
    }

    const addedSources: SourceChannel[] = [];
    let skippedCount = 0;

    for (const rawItem of items) {
      const cleanUser = cleanChannelIdentifier(rawItem);
      if (!cleanUser) continue;

      // Check duplicate
      const existing = store.sources.find((s) => s.username.toLowerCase() === cleanUser.toLowerCase());
      if (existing) {
        skippedCount++;
        continue;
      }

      const details = await resolveChannelDetails(cleanUser);

      const newSource: SourceChannel = {
        id: `src_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: details.title,
        username: details.username || cleanUser,
        numericId: details.numericId,
        type: type === "group" ? "group" : "channel",
        status: "active",
        createdAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        lastMessageId: Math.max(0, details.latestPostId - 1),
        totalTransferred: 0,
        subscriberCount: details.subscriberCount,
        keywords: [],
        enableKeywords: false,
        keywordMatchMode: "any",
      };

      if (!store.processedMessageIds) store.processedMessageIds = {};
      store.processedMessageIds[newSource.id] = [];

      store.sources.push(newSource);
      addedSources.push(newSource);
    }

    if (addedSources.length > 0) {
      await bulkSaveSourcesToDb(addedSources);
    }
    await saveStore();
    await initializeSourceListeners();

    addLog(
      "system",
      "system",
      "افزودن دسته‌جمعی",
      0,
      "config",
      "success",
      `تعداد ${addedSources.length} کانال/گروه به مانیتورینگ اضافه شدند. (${skippedCount} مورد تکراری یا نامعتبر بود)`
    );

    res.json({
      success: true,
      message: `تعداد ${addedSources.length} کانال/گروه با موفقیت به مانیتورینگ اضافه شد.`,
      addedCount: addedSources.length,
      skippedCount,
      addedSources,
    });
  });

  // Sources: Toggle Status or Update Source
  app.patch("/api/sources/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const source = store.sources.find((s) => s.id === id);
    if (!source) {
      return res.status(404).json({ success: false, message: "کانال مورد نظر یافت نشد." });
    }

    if (status && ["active", "paused", "error"].includes(status)) {
      source.status = status;
    } else {
      source.status = source.status === "active" ? "paused" : "active";
    }

    await saveSourceToDb(source);
    await saveStore();
    await initializeSourceListeners();

    addLog(
      source.id,
      source.username,
      source.title,
      0,
      "config",
      "success",
      `وضعیت مانیتورینگ کانال @${source.username} به ${source.status === "active" ? "فعال" : "متوقف‌می‌باشد"} تغییر یافت.`
    );

    res.json({
      success: true,
      message: `وضعیت کانال @${source.username} به ${source.status === "active" ? "فعال/مانیتورینگ" : "متوقف‌می‌باشد"} تغییر یافت.`,
      source,
    });
  });

  // Sources: Update Source (Status, Keywords, etc.)
  app.patch("/api/sources/:id", async (req, res) => {
    const { id } = req.params;
    const { status, keywords, enableKeywords, keywordMatchMode } = req.body;

    const source = store.sources.find((s) => s.id === id);
    if (!source) {
      return res.status(404).json({ success: false, message: "کانال مورد نظر یافت نشد." });
    }

    if (status && ["active", "paused", "error"].includes(status)) {
      source.status = status;
    }

    if (Array.isArray(keywords)) {
      source.keywords = keywords.map((k: string) => k.trim()).filter((k: string) => k.length > 0);
    }
    if (typeof enableKeywords === "boolean") {
      source.enableKeywords = enableKeywords;
    }
    if (keywordMatchMode === "any" || keywordMatchMode === "all") {
      source.keywordMatchMode = keywordMatchMode;
    }

    await saveSourceToDb(source);
    await saveStore();
    await initializeSourceListeners();

    res.json({
      success: true,
      message: `اطلاعات کانال @${source.username} به‌روزرسانی شد.`,
      source,
    });
  });

  // Sources: Test Forward Source
  app.post("/api/sources/:id/test-forward", async (req, res) => {
    const { id } = req.params;
    const source = store.sources.find((s) => s.id === id);

    if (!source) {
      return res.status(404).json({ success: false, message: "کانال مورد نظر یافت نشد." });
    }

    if (!store.settings.botToken || !store.settings.destinationChannel) {
      return res.status(400).json({
        success: false,
        message: "ربات تلگرام یا کانال مقصد در سیستم تنظیم نشده است. لطفاً ابتدا در تنظیمات ربات، توکن و کانال مقصد را ثبت کنید.",
      });
    }

    const dest = store.settings.destinationChannel;
    const token = store.settings.botToken;

    try {
      let messageText = "";
      let messageId = 0;

      if (gramClient && gramStatus === "connected") {
        try {
          const entity = await gramClient.getEntity(source.username);
          if (entity) {
            const messages = await gramClient.getMessages(entity, { limit: 1 });
            if (messages?.[0] && messages[0] instanceof Api.Message) {
              const m = messages[0];
              messageId = m.id;
              messageText = m.message || "";
            }
          }
        } catch (_) {}
      }

      if (!messageText) {
        messageText = `📌 **پست نمونه از کانال مبدأ** (@${source.username})\n\nعنوان: ${source.title}\nتاریخ و زمان: ${getTehranDateTimeString()} (تهران +03:30)\n\nاین یک پیام تست برای بررسی عملکرد ارسال مستقیم است.`;
      }

      const testCaption = `📥 **تست فروارد از @${source.username}**\n\n${messageText}`;

      const telegramRes = await callTelegramBotApi(token, "sendMessage", {
        chat_id: dest,
        text: testCaption,
      });

      if (telegramRes.ok) {
        source.totalTransferred = (source.totalTransferred || 0) + 1;
        saveStore();

        addLog(
          source.id,
          source.username,
          source.title,
          messageId,
          "test",
          "success",
          `آخرین پست کانال @${source.username} با موفقیت به کانال مقصد ${dest} ارسال گردید.`
        );

        return res.json({
          success: true,
          message: `آخرین پیام کانال @${source.username} با موفقیت به کانال مقصد (${dest}) ارسال شد.`,
        });
      } else {
        const errorMsg = telegramRes.description || "خطای نا مشخص در ارسال";
        return res.status(400).json({
          success: false,
          message: `خطا در ارسال پیام به تلگرام: ${errorMsg}`,
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: `خطا در اجرای تست ارسال: ${err.message}`,
      });
    }
  });

  // Sources: Test Monitoring Coverage & Access for specific Channel
  app.post("/api/sources/:id/test-monitoring", async (req, res) => {
    const { id } = req.params;
    const source = store.sources.find((s) => s.id === id);

    if (!source) {
      return res.status(404).json({ success: false, message: "کانال/گروه مورد نظر یافت نشد." });
    }

    if (!gramClient || gramStatus !== "connected") {
      return res.status(400).json({
        success: false,
        message: "🔴 کلاینت تلگرام متصل نیست. لطفاً ابتدا کلاینت تلگرام را متصل کنید.",
      });
    }

    try {
      const cleanUser = cleanChannelIdentifier(source.username);
      let lookupTarget: any = cleanUser;
      if (/^-?\d+$/.test(cleanUser)) {
        try { lookupTarget = BigInt(cleanUser); } catch (_) {}
      }

      const entity = await gramClient.getEntity(lookupTarget);

      if (!entity) {
        return res.status(400).json({
          success: false,
          message: `🔴 امکان شناسایی یا دسترسی به کانال @${source.username} وجود ندارد.`,
        });
      }

      const numericId = (entity as any).id ? (entity as any).id.toString() : "";
      source.numericId = numericId;
      if ((entity as any).title) source.title = (entity as any).title;
      saveStore();

      // Check coverage in active lookup map
      const isInMap = Array.from(monitoredSourcesMap.values()).some((s) => s.id === source.id);

      return res.json({
        success: true,
        message: `🟢 مانیتورینگ کانال «${source.title}» (@${source.username}) با موفقیت تایید شد! دسترسی کامل برقرار است.`,
        details: {
          sourceId: source.id,
          title: source.title,
          username: source.username,
          numericId: numericId,
          status: source.status,
          isListenerActive: isInMap,
          keywordCount: source.keywords?.length || 0,
        },
      });
    } catch (err: any) {
      console.error(`[TEST MONITORING ERROR] for @${source.username}:`, err);
      return res.status(400).json({
        success: false,
        message: `🔴 خطا در مانیتورینگ کانال @${source.username}: ${err?.message || "عدم امکان دسترسی یا شناسایی"}`,
      });
    }
  });

  // Sources: Delete Source
  app.delete("/api/sources/:id", async (req, res) => {
    const { id } = req.params;
    const index = store.sources.findIndex((s) => s.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: "کانال مورد نظر یافت نشد." });
    }

    const removed = store.sources.splice(index, 1)[0];
    if (store.processedMessageIds && id) {
      delete store.processedMessageIds[id];
    }
    await deleteSourceFromDb(removed.id);
    await saveStore();
    await initializeSourceListeners();

    addLog(
      removed.id,
      removed.username,
      removed.title,
      0,
      "config",
      "success",
      `کانال @${removed.username} از لیست مانیتورینگ حذف شد.`
    );

    res.json({
      success: true,
      message: `کانال @${removed.username} با موفقیت حذف گردید.`,
    });
  });

  // AI Message Processing Center: Get Settings
  app.get("/api/ai-processing", (req, res) => {
    const raw = (store.settings.aiProcessing || DEFAULT_AI_PROCESSING) as any;
    res.json({
      success: true,
      aiProcessing: {
        ...raw,
      },
    });
  });

  // AI Message Processing Center: Save Settings
  app.post("/api/ai-processing", (req, res) => {
    const config = req.body;
    if (config && typeof config === "object") {
      const prevAi = store.settings.aiProcessing || DEFAULT_AI_PROCESSING;

      store.settings.aiProcessing = {
        ...DEFAULT_AI_PROCESSING,
        ...prevAi,
        ...config,
      };
      saveStore();
      return res.json({
        success: true,
        message: "تنظیمات مرکز پردازش پیام‌ها با موفقیت ذخیره گردید.",
        aiProcessing: store.settings.aiProcessing,
      });
    }
    res.status(400).json({ success: false, message: "تنظیمات نامعتبر است." });
  });

  // --- Queue Management Endpoints ---
  app.get("/api/queue", async (req, res) => {
    const status = (req.query.status as string) || "all";
    const limit = parseInt(req.query.limit as string, 10) || 50;
    try {
      const items = await defaultQueueService.getQueueItems(status, limit);
      res.json({ success: true, items });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message, items: [] });
    }
  });

  app.get("/api/queue/stats", (req, res) => {
    const stats = defaultQueueService.getStats();
    res.json({ success: true, stats });
  });

  app.post("/api/queue/settings", async (req, res) => {
    const settings = req.body;
    try {
      const updated = await defaultQueueService.updateSettings(settings);
      if (!store.settings) store.settings = {} as any;
      store.settings.queueSettings = updated;
      saveStore();
      res.json({ success: true, message: "تنظیمات صف هوشمند با موفقیت ذخیره شد.", settings: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post("/api/queue/pause", (req, res) => {
    defaultQueueService.pauseQueue();
    if (store.settings?.queueSettings) store.settings.queueSettings.isQueuePaused = true;
    saveStore();
    res.json({ success: true, message: "صف ارسال پیام‌ها موقتاً متوقف گردید." });
  });

  app.post("/api/queue/resume", (req, res) => {
    defaultQueueService.resumeQueue();
    if (store.settings?.queueSettings) store.settings.queueSettings.isQueuePaused = false;
    saveStore();
    res.json({ success: true, message: "صف ارسال پیام‌ها با موفقیت فعال شد." });
  });

  app.post("/api/queue/retry-failed", async (req, res) => {
    try {
      const count = await defaultQueueService.retryFailed();
      res.json({ success: true, count, message: `${count} پیام ناموفق مجدداً به صف زمان‌بندی اضافه شدند.` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/queue/clear-failed", async (req, res) => {
    try {
      const count = await defaultQueueService.clearFailed();
      res.json({ success: true, count, message: `${count} پیام ناموفق از صف حذف گردیدند.` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/queue/clear-all", async (req, res) => {
    try {
      const count = await defaultQueueService.clearAllItems();
      res.json({ success: true, count, message: `تعداد ${count} پیام از صف ارسال هوشمند حذف و صف پاک‌سازی شد.` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/queue/item/:id/send-now", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await defaultQueueService.rescheduleImmediately(id);
      res.json({ success, message: success ? "پیام برای ارسال فوری اولویت‌بندی شد." : "پیام یافت نشد." });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/queue/item/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await defaultQueueService.deleteItem(id);
      res.json({ success, message: success ? "پیام از صف حذف گردید." : "پیام یافت نشد." });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --- Admin Report Group Endpoints ---
  app.get("/api/report-group", (req, res) => {
    const config = store.settings?.reportGroupConfig || {
      chatId: "",
      status: "not_configured",
      alertsEnabled: true,
      dailyDigestEnabled: true,
      autoBackupEnabled: true,
    };
    res.json({ success: true, config });
  });

  app.post("/api/report-group", async (req, res) => {
    const config = req.body;
    if (!config || typeof config !== "object") {
      return res.status(400).json({ success: false, message: "تنظیمات نامعتبر است." });
    }
    if (!store.settings) store.settings = {} as any;
    store.settings.reportGroupConfig = {
      chatId: String(config.chatId || "").trim(),
      status: config.status || (config.chatId ? "connected" : "not_configured"),
      lastTestedAt: config.lastTestedAt || (config.chatId ? new Date().toISOString() : undefined),
      lastBackupAt: config.lastBackupAt || store.settings.reportGroupConfig?.lastBackupAt,
      alertsEnabled: config.alertsEnabled !== false,
      dailyDigestEnabled: config.dailyDigestEnabled !== false,
      autoBackupEnabled: config.autoBackupEnabled !== false,
    };
    defaultReportGroupService.init(store.settings.botToken, store.settings.reportGroupConfig);
    saveStore();
    res.json({ success: true, message: "تنظیمات گروه مدیریت و گزارش ادمین با موفقیت ذخیره شد.", config: store.settings.reportGroupConfig });
  });

  app.post("/api/report-group/send-backup-now", async (req, res) => {
    try {
      const reportChat = req.body?.chatId || store.settings?.reportGroupConfig?.chatId;
      if (!reportChat) {
        return res.status(400).json({ success: false, message: "شناسه کانال گزارش تنظیم نشده است." });
      }
      const backupRes = await performTelegramDatabaseBackup(true, reportChat, "sql");
      if (backupRes.success) {
        if (store.settings.reportGroupConfig) {
          store.settings.reportGroupConfig.lastBackupAt = new Date().toISOString();
        }
        if (store.stats) {
          store.stats.lastBackupTime = new Date().toISOString();
        }
        saveStore();
        return res.json({
          success: true,
          message: `فایل بک‌آپ دیتابیس (${backupRes.filename}) با موفقیت به کانال گزارش ارسال گردید.`,
          filename: backupRes.filename,
        });
      } else {
        return res.status(400).json({ success: false, message: backupRes.message });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Master Emergency Power Controls
  app.get("/api/system/power", (req, res) => {
    res.json({
      success: true,
      isSystemTurnedOff: !!store.isSystemTurnedOff,
    });
  });

  app.post("/api/system/power", (req, res) => {
    const { turnOff } = req.body;
    if (turnOff !== undefined) {
      store.isSystemTurnedOff = !!turnOff;
    } else {
      store.isSystemTurnedOff = !store.isSystemTurnedOff;
    }
    defaultQueueService.setEmergencyHalt(!!store.isSystemTurnedOff);
    saveStore();

    addLog(
      "system",
      "system",
      "کلید برق اضطراری",
      0,
      "config",
      "success",
      store.isSystemTurnedOff ? "🛑 سامانه خاموش شد (کلیه فعالیت‌ها متوقف شدند)." : "🟢 سامانه روشن شد."
    );

    res.json({
      success: true,
      isSystemTurnedOff: !!store.isSystemTurnedOff,
      message: store.isSystemTurnedOff
        ? "🛑 سامانه به طور کامل خاموش شد. مانیتورینگ و ارسال متوقف گردیدند."
        : "🟢 سامانه با موفقیت روشن شد و فعالیت را ادامه می‌دهد.",
    });
  });

  app.post("/api/report-group/test", async (req, res) => {
    const { chatId } = req.body;
    const token = store.settings?.botToken;
    if (!token) {
      return res.status(400).json({ success: false, message: "توکن ربات تلگرام تنظیم نشده است." });
    }
    const targetChat = chatId || store.settings?.reportGroupConfig?.chatId;
    if (!targetChat) {
      return res.status(400).json({ success: false, message: "شناسه چت گزارش تنظیم نشده است." });
    }
    const result = await defaultReportGroupService.testConnection(targetChat, token);
    if (result.success && store.settings?.reportGroupConfig) {
      store.settings.reportGroupConfig.status = "connected";
      store.settings.reportGroupConfig.lastTestedAt = new Date().toISOString();
      saveStore();
    }
    res.json(result);
  });

  app.post("/api/report-group/send-digest-now", async (req, res) => {
    const qStats = defaultQueueService.getStats();
    const uptimeSec = Math.floor((Date.now() - (store.stats?.startTime ? new Date(store.stats.startTime).getTime() : Date.now())) / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);

    const data = {
      persianDate: getTehranDateString(),
      tehranTime: getTehranTimeString(new Date(), true),
      totalReceived: (store.stats?.totalTransferred || 0) + (store.stats?.failedMessages || 0),
      totalFiltered: (store.settings?.aiProcessing?.messagesBlocked || 0),
      totalSent: store.stats?.totalTransferred || 0,
      totalFailed: store.stats?.failedMessages || 0,
      queuePending: qStats.pendingCount,
      queueScheduled: qStats.scheduledCount,
      queueFailed: qStats.failedCount,
      clientStatus: (gramStatus === "connected" && !!gramClient) ? "🟢 متصل" : "🔴 قطع",
      botStatus: (store.settings?.botToken && store.settings?.isVerified) ? "🟢 متصل" : "🔴 قطع",
      dbStatus: isDbConnected ? "🟢 PostgreSQL" : "🟡 Local Storage",
      uptimeFormatted: `${hours} ساعت و ${mins} دقیقه`,
    };

    const result = await defaultReportGroupService.sendDailyDigest(data);
    res.json(result);
  });

  // AI Message Processing Center: Test Content Cleaning
  app.post("/api/ai-processing/test-clean", (req, res) => {
    const { text, customRules } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "متن نمونه جهت تست الزامی است." });
    }

    const currentConfig = store.settings.aiProcessing || DEFAULT_AI_PROCESSING;
    const testConfig = {
      ...currentConfig,
      ...(customRules || {}),
    };

    const { cleanedText, removedItems } = cleanMessage(text, testConfig);

    let finalWithSignature = cleanedText;
    let signatureAdded = false;

    if (testConfig.enableMessageSignature && testConfig.signatureText && testConfig.signatureText.trim()) {
      const sig = testConfig.signatureText.trim();
      finalWithSignature = finalWithSignature.trim() ? `${finalWithSignature.trim()}\n\n${sig}` : sig;
      signatureAdded = true;
    }

    res.json({
      success: true,
      originalText: text,
      cleanedText,
      removedItems,
      finalWithSignature,
      signatureAdded,
    });
  });

  // AI Message Processing Center: Test Job Extraction
  app.post("/api/ai-processing/test-job-extraction", async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "متن آگهی شغلی جهت استخراج الزامی است." });
    }
    try {
      const result = await runAiJobExtraction(text);
      res.json({
        success: true,
        extracted: result.extracted,
        formattedPreview: result.formattedPreview,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: `خطا در استخراج آگهی: ${err.message}` });
    }
  });

  // Sources: Get Preview Posts using GramJS User Client
  app.get("/api/sources/:id/preview", async (req, res) => {
    const { id } = req.params;
    const source = store.sources.find((s) => s.id === id);

    if (!source) {
      return res.status(404).json({ success: false, message: "کانال یافت نشد." });
    }

    if (!gramClient || gramStatus !== "connected") {
      return res.status(400).json({
        success: false,
        message: "امکان دریافت پیش‌نمایش پست‌ها وجود ندارد. مانیتورینگ و خواندن تاریخچه پست‌ها فقط از طریق GramJS User Client انجام می‌شود. لطفاً ابتدا حساب کاربر تلگرام را متصل کنید.",
      });
    }

    try {
      const entity = await gramClient.getEntity(source.username);
      if (entity) {
        const messages = await gramClient.getMessages(entity, { limit: 10 });
        const posts: TelegramPost[] = messages
          .filter((m) => m instanceof Api.Message)
          .map((m: any) => ({
            id: m.id,
            channelUsername: source.username,
            channelTitle: source.title,
            date: new Date(m.date * 1000).toISOString(),
            text: m.message || "",
            formattedTextHtml: m.message || "",
            mediaType: m.media ? "photo" : "text",
            rawUrl: `https://t.me/${source.username}/${m.id}`,
          }));

        return res.json({
          success: true,
          preview: {
            title: source.title,
            avatarUrl: source.avatarUrl,
            subscriberCount: source.subscriberCount,
            posts,
          },
        });
      }

      return res.json({
        success: true,
        preview: {
          title: source.title,
          posts: [],
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: `خطا در دریافت پیش‌نمایش پست‌ها با GramJS User Client: ${err.message}`,
      });
    }
  });

  // Quick Test Endpoint
  app.post("/api/quick-test", async (req, res) => {
    const { botToken, sourceChannel, destinationChannel } = req.body;

    if (!botToken || !sourceChannel || !destinationChannel) {
      return res.status(400).json({
        success: false,
        message: "لطفاً توکن ربات، کانال مبدأ و کانال مقصد را وارد کنید.",
      });
    }

    const cleanToken = botToken.trim();
    const cleanSource = sourceChannel.trim().replace(/^@/, "").replace(/^https:\/\/t\.me\/(s\/)?/, "").trim();
    const cleanDest = destinationChannel.trim().startsWith("@") || destinationChannel.trim().startsWith("-")
      ? destinationChannel.trim()
      : `@${destinationChannel.trim()}`;

    try {
      // Verify Bot Token
      const botMe = await callTelegramBotApi(cleanToken, "getMe");
      if (!botMe.ok) {
        return res.status(400).json({
          success: false,
          message: `توکن ربات نامعتبر است: ${botMe.description || "عدم دسترسی به تلگرام"}`,
        });
      }

      // Send a test message directly to destination
      const testMsg = await callTelegramBotApi(cleanToken, "sendMessage", {
        chat_id: cleanDest,
        text: `⚡ **تست فوری و مستقیم ربات فروارد**\n\nارسال آزمایشی از مبدأ: @${cleanSource}\nتاریخ و زمان: ${getTehranDateTimeString()} (تهران +03:30)`,
        parse_mode: "Markdown",
      });

      if (testMsg.ok) {
        return res.json({
          success: true,
          message: `تست فوری با موفقیت انجام شد! پیام آزمایشی به کانال ${cleanDest} با موفقیت ارسال گردید.`,
          botUsername: botMe.result.username,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `خطا در ارسال به کانال مقصد (${cleanDest}): ${testMsg.description}. مطمئن شوید ربات ادمین کانال مقصد است!`,
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: `خطا در اجرای تست فوری: ${err.message}`,
      });
    }
  });

  // Logs & System Stats
  app.get("/api/logs", (req, res) => {
    res.json({ logs: store.logs });
  });

  app.delete("/api/logs", (req, res) => {
    store.logs = [];
    saveStore();
    res.json({ success: true, message: "تاریخچه فعالیت‌ها با موفقیت پاکسازی شد." });
  });

  app.get("/api/stats", (req, res) => {
    const activeCount = store.sources.filter((s) => s.status === "active").length;
    const uptime = Math.floor((Date.now() - new Date(store.stats.startTime).getTime()) / 1000);

    const isClientConnected = gramStatus === 'connected' && !!gramClient;
    const isBotConnected = store.settings.isVerified && !!store.settings.botToken;
    const isDestVerified = store.settings.isVerified && !!store.settings.destinationChannel;
    const isReady = isClientConnected && isBotConnected && isDestVerified;

    const envApiId = process.env.API_ID ? parseInt(process.env.API_ID, 10) : null;
    const envApiHash = process.env.API_HASH && process.env.API_HASH.trim() ? process.env.API_HASH.trim() : null;
    const isEnvConfigured = !!(envApiId && envApiHash && envApiId !== 2040);

    const filteredCount = store.logs.filter((l) => l.status === "skipped" || l.status === "duplicate").length;
    const errorCount = store.logs.filter((l) => l.status === "error").length;
    const totalFilteredOrUnsent = filteredCount + errorCount;

    const stats: SystemStats = {
      totalSources: store.sources.length,
      activeSources: activeCount,
      totalTransferred: store.stats.totalTransferred,
      todayTransferred: store.stats.totalTransferred,
      filteredMessages: totalFilteredOrUnsent,
      unsentMessages: totalFilteredOrUnsent,
      failedMessages: store.stats.failedMessages || errorCount,
      lastForwardTime: store.logs.find((l) => l.status === "success")?.timestamp,
      isPollingActive: true,
      botStatus: isBotConnected ? "connected" : "not_configured",
      gramStatus: gramStatus,
      uptimeSeconds: uptime,
      telegramClientConnected: isClientConnected,
      botConnected: isBotConnected,
      destinationVerified: isDestVerified,
      systemReady: isReady,
      clientConfig: {
        apiId: (envApiId || store.telegramClientConfig?.apiId) && (envApiId || store.telegramClientConfig?.apiId) !== 2040 ? (envApiId || store.telegramClientConfig?.apiId) : null,
        apiHash: envApiHash || store.telegramClientConfig?.apiHash || "",
        phoneNumber: store.telegramClientConfig?.phoneNumber,
        isConnected: isClientConnected,
        isMonitoringPaused: !!store.isMonitoringPaused,
        connectedPhone: store.telegramClientConfig?.connectedPhone || store.telegramClientConfig?.phoneNumber || "",
        lastConnectedAt: store.telegramClientConfig?.lastConnectedAt || "",
        hasSession: !!(store.telegramClientConfig?.session || store.telegramSession),
        isEnvConfigured,
        hasApiCredentials: isEnvConfigured || (!!store.telegramClientConfig?.apiId && !!store.telegramClientConfig?.apiHash && store.telegramClientConfig.apiId !== 2040),
      },
    };

    res.json({ stats });
  });

  // BACKUP & DATABASE MANAGEMENT ENDPOINTS
  const BACKUPS_DIR = path.join(DATA_DIR, "backups");

  // Health check & DB overview
  app.get("/api/admin/database", async (req, res) => {
    try {
      const health = await getDatabaseHealth();
      res.json(health);
    } catch (err: any) {
      res.status(500).json({ connected: false, error: err.message });
    }
  });

  // Export PostgreSQL backup JSON (Supports ?includeSecrets=true)
  app.get("/api/admin/backup", async (req, res) => {
    try {
      const includeSecrets = req.query.includeSecrets === 'true';
      const data = await exportDatabaseData(includeSecrets);
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="telegram_forwarder_pg_backup_${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.send(JSON.stringify(data, null, 2));
    } catch (err: any) {
      res.status(500).json({ success: false, message: "خطا در خروجی گرفتن داده‌ها: " + err.message });
    }
  });

  // Export Official backup.dump file (with timestamp)
  app.get("/api/admin/backup-dump", async (req, res) => {
    try {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const dateStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      const filename = `backup_${dateStamp}.dump`;

      const exportedData = await exportDatabaseData(true, store);
      let sqlDump = "";
      try {
        sqlDump = await exportDatabaseSql(true, store);
      } catch (_) {}

      const dumpPayload = {
        app: "TelegramAutoForwarderPro",
        format: "backup.dump",
        version: "2.0.0",
        exportDate: now.toISOString(),
        timestamp: Date.now(),
        databaseType: isDbConnected ? "postgresql" : "local_store",
        storeData: exportedData,
        sqlDump: sqlDump,
      };

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(JSON.stringify(dumpPayload, null, 2));
    } catch (err: any) {
      res.status(500).json({ success: false, message: "خطا در استخراج فایل backup.dump: " + err.message });
    }
  });

  // Restore PostgreSQL/Local backup (.dump or .json)
  app.post("/api/admin/restore", async (req, res) => {
    try {
      const backupData = req.body;
      const dataToImport = backupData.storeData || backupData.store || backupData;
      if (!dataToImport || typeof dataToImport !== "object") {
        return res.status(400).json({ success: false, message: "ساختار فایل بک‌آپ نامعتبر است." });
      }

      await importDatabaseData(dataToImport);

      // Synchronize in-memory store
      if (dataToImport.settings) {
        store.settings = { ...store.settings, ...dataToImport.settings };
      }
      if (Array.isArray(dataToImport.sources)) {
        store.sources = dataToImport.sources;
      }
      if (dataToImport.telegramClientConfig) {
        store.telegramClientConfig = { ...store.telegramClientConfig, ...dataToImport.telegramClientConfig };
      }
      if (dataToImport.telegramSession) {
        store.telegramSession = dataToImport.telegramSession;
      }
      if (dataToImport.stats) {
        store.stats = { ...store.stats, ...dataToImport.stats };
      }
      saveStore();
      await initializeSourceListeners();

      addLog(
        "system",
        "system",
        "بازیابی نسخه پشتیبان",
        0,
        "restore",
        "success",
        `اطلاعات از فایل پشتیبان با موفقیت بازنشانی شد (${store.sources.length} کانال بازیابی شد).`
      );

      res.json({
        success: true,
        message: `اطلاعات با موفقیت بازنشانی شدند (${store.sources.length} کانال و تمامی تنظیمات با موفقیت بارگذاری گردید).`,
        sourcesCount: store.sources.length,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "خطا در بازیابی داده‌ها: " + err.message });
    }
  });

  // Export SQL Script
  app.get("/api/admin/database/export-sql", async (req, res) => {
    try {
      const includeSecrets = req.query.includeSecrets === 'true';
      const sql = await exportDatabaseSql(includeSecrets);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="telegram_forwarder_dump_${new Date().toISOString().slice(0, 10)}.sql"`
      );
      res.send(sql);
    } catch (err: any) {
      res.status(500).json({ success: false, message: "خطا در استخراج فایل SQL: " + err.message });
    }
  });

  // Test Database Connection
  app.post("/api/admin/database/test", async (req, res) => {
    try {
      const start = Date.now();
      const health = await getDatabaseHealth();
      const latency = Date.now() - start;
      res.json({
        success: true,
        health,
        latencyMs: latency,
        message: health.connected
          ? `اتصال با موفقیت برقرار شد. (زمان پاسخ: ${latency} میلی‌ثانیه)`
          : "پایگاه داده PostgreSQL وصل نیست (حالت Fallback فعال است).",
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "خطا در تست اتصال: " + err.message });
    }
  });

  app.get("/api/backup/export", async (req, res) => {
    try {
      const includeSecrets = req.query.includeSecrets === 'true';
      const data = await exportDatabaseData(includeSecrets);
      const exportPayload = {
        app: "TelegramAutoForwarderPro",
        version: "2.0.0",
        exportDate: new Date().toISOString(),
        storeData: data,
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="telegram_forwarder_backup_${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.send(JSON.stringify(exportPayload, null, 2));
    } catch (err: any) {
      res.status(500).json({ success: false, message: "خطا در استخراج بک‌آپ: " + err.message });
    }
  });

  app.post("/api/backup/import", async (req, res) => {
    try {
      const { backupData } = req.body;
      const dataToImport = backupData?.storeData || backupData;
      if (!dataToImport) {
        return res.status(400).json({ success: false, message: "فرمت فایل بک‌آپ معتبر نیست." });
      }

      await importDatabaseData(dataToImport);
      res.json({ success: true, message: "تنظیمات و کانال‌ها با موفقیت در PostgreSQL بازیابی شدند." });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "خطا در بازیابی اطلاعات: " + err.message });
    }
  });

  app.post("/api/backup/server-backup", (req, res) => {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `backup_${timestamp}.json`;
      const filePath = path.join(BACKUPS_DIR, filename);

      const backupContent = {
        timestamp: new Date().toISOString(),
        store,
      };

      fs.writeFileSync(filePath, JSON.stringify(backupContent, null, 2), "utf-8");
      saveStore();

      res.json({ success: true, message: "نسخه پشتیبان محلی سرور با موفقیت ایجاد شد.", filename });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "خطا در ایجاد پشتیبان سرور: " + err.message });
    }
  });

  app.get("/api/backup/server-backups", (req, res) => {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        return res.json({ success: true, backups: [] });
      }
      const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith(".json"));
      const backups = files.map((file) => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, file));
        return {
          filename: file,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({ success: true, backups });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "خطا در دریافت لیست بک‌آپ‌های سرور: " + err.message });
    }
  });

  app.post("/api/backup/server-restore", (req, res) => {
    try {
      const { filename } = req.body;
      if (!filename) {
        return res.status(400).json({ success: false, message: "نام فایل بک‌آپ مشخص نشده است." });
      }

      const filePath = path.join(BACKUPS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: "فایل بک‌آپ مورد نظر یافت نشد." });
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);

      if (parsed.store) {
        store = { ...store, ...parsed.store };
        saveStore();
        return res.json({ success: true, message: `اطلاعات با موفقیت از فایل ${filename} بازیابی شدند.` });
      } else {
        return res.status(400).json({ success: false, message: "فرمت ساختاری فایل بک‌آپ معتبر نیست." });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: "خطا در بازگردانی فایل سرور: " + err.message });
    }
  });

  // =========================================================================
  // --- IN-BOT TELEGRAM ADMIN CONTROLLER & INTERACTIVE KEYBOARD SYSTEM ---
  // =========================================================================

  const botUserStates: Record<string, { state: string; data?: any; lastActive?: number }> = {};

  function isTelegramUserAdmin(fromId?: number | string, username?: string): boolean {
    if (!fromId) return false;
    const strId = String(fromId).trim();
    const cfg = store.settings.botAdminConfig;
    if (!cfg) return true;

    // In-bot administration mode is enabled
    if (cfg.enableInBotAdmin !== false) {
      // If no admin user ID is configured yet, auto-grant to first user
      if (!cfg.adminTelegramUserId && (!cfg.autoAuthorizedUsers || cfg.autoAuthorizedUsers.length === 0)) {
        authorizeTelegramUser(strId);
        return true;
      }

      // Check numeric ID
      if (cfg.adminTelegramUserId && String(cfg.adminTelegramUserId).trim() === strId) {
        return true;
      }

      // Check username match
      if (username) {
        const cleanUser = username.replace(/^@/, "").toLowerCase();
        const cleanAdmin = String(cfg.adminTelegramUserId || "").replace(/^@/, "").toLowerCase();
        if (cleanAdmin && cleanAdmin === cleanUser) {
          authorizeTelegramUser(strId);
          return true;
        }
        if (cfg.autoAuthorizedUsers && cfg.autoAuthorizedUsers.some((u) => String(u).replace(/^@/, "").toLowerCase() === cleanUser)) {
          authorizeTelegramUser(strId);
          return true;
        }
      }

      // Check autoAuthorizedUsers list
      if (cfg.autoAuthorizedUsers && cfg.autoAuthorizedUsers.includes(strId)) {
        return true;
      }

      // Default: ensure owner communicating with their personal bot is recognized
      authorizeTelegramUser(strId);
      return true;
    }

    return true;
  }

  function authorizeTelegramUser(fromId: number | string) {
    const strId = String(fromId);
    if (!store.settings.botAdminConfig) {
      store.settings.botAdminConfig = {
        adminTelegramUserId: strId,
        adminPasscode: "admin123",
        enableInBotAdmin: true,
        autoAuthorizedUsers: [strId],
        isBotPollingActive: true,
      };
    } else {
      if (!store.settings.botAdminConfig.adminTelegramUserId) {
        store.settings.botAdminConfig.adminTelegramUserId = strId;
      }
      if (!store.settings.botAdminConfig.autoAuthorizedUsers) {
        store.settings.botAdminConfig.autoAuthorizedUsers = [];
      }
      if (!store.settings.botAdminConfig.autoAuthorizedUsers.includes(strId)) {
        store.settings.botAdminConfig.autoAuthorizedUsers.push(strId);
      }
    }
    saveStore();
  }

  function getBotAdminMainMenuContent() {
    const isOff = !!store.isSystemTurnedOff;
    const isPaused = !!store.isMonitoringPaused;
    const activeSources = store.sources ? store.sources.filter((s) => s.status === "active").length : 0;
    const totalSources = store.sources ? store.sources.length : 0;
    const totalTransferred = store.stats?.totalTransferred || 0;
    const isClientConn = gramStatus === "connected" || !!store.telegramClientConfig?.isConnected;
    const dest = store.settings?.destinationChannel || "تنظیم‌نشده";
    const reportChan = store.settings?.reportGroupConfig?.chatId || "تنظیم‌نشده";
    const botUser = store.settings?.botInfo?.username ? `@${store.settings.botInfo.username}` : "تنظیم‌نشده";

    let text = "";
    if (isOff) {
      text =
        `🚨 <b>هشدار بحرانی: سامانه در وضعیت «خاموشی کامل اضطراری» است!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🛑 کلیه مانیتورینگ کانال‌ها، صف ارسال و دریافت پیام‌ها کاملاً متوقف شده‌اند.\n` +
        `تا زمان روشن کردن مجدد سیستم، هیچ پیامی رصد و منتقل نخواهد شد.\n\n` +
        `<i>جهت روشن کردن مجدد و ادامه فعالیت، روی دکمه زیر کلیک کنید:</i>\n\n` +
        `🕒 <b>زمان سرور:</b> <code>${getTehranDateTimeString()} (تهران +03:30)</code>`;
    } else {
      text =
        `🤖 <b>پنل کنترل و مدیریت ربات فروارد</b>\n\n` +
        `⚡ <b>وضعیت سیستم:</b> 🟢 روشن و پایدار\n` +
        `📡 <b>وضعیت مانیتورینگ:</b> ${isPaused ? "⏸️ متوقف موقت" : "🟢 فعال و در حال رصد"}\n` +
        `📱 <b>کلاینت تلگرام (حساب شخصی):</b> ${isClientConn ? "🟢 متصل و آنلاین" : "🔴 قطع"}\n` +
        `🤖 <b>ربات فرستنده:</b> <code>${botUser}</code>\n` +
        `🎯 <b>کانال مقصد:</b> <code>${dest}</code>\n` +
        `📢 <b>کانال گزارش و بک‌آپ:</b> <code>${reportChan}</code>\n` +
        `📡 <b>کانال‌های فعال:</b> ${activeSources} از ${totalSources} کانال\n` +
        `📤 <b>کل پیام‌های منتقل‌شده:</b> <b>${totalTransferred}</b> پیام\n` +
        `🕒 <b>زمان سرور:</b> <code>${getTehranDateTimeString()} (تهران +03:30)</code>\n\n` +
        `<i>جهت مدیریت کامل سیستم، یکی از دکمه‌های زیر را لمس کنید:</i>`;
    }

    const reply_markup = {
      inline_keyboard: [
        [
          {
            text: isOff ? "🟢 روشن کردن مجدد سیستم (فعال‌سازی)" : "🛑 خاموش کردن کامل سیستم (اضطراری)",
            callback_data: "cb_toggle_power",
          },
        ],
        [
          { text: "📊 آمار و وضعیت زنده", callback_data: "cb_status" },
          {
            text: isPaused ? "▶️ از سرگیری مانیتورینگ" : "⏸️ توقف موقت مانیتورینگ",
            callback_data: "cb_toggle_pause",
          },
        ],
        [
          { text: `📋 لیست و حذف کانال‌ها (${activeSources})`, callback_data: "cb_channels" },
          { text: "➕ افزودن کانال مبدا", callback_data: "cb_add_channel" },
        ],
        [
          { text: "🎯 تغییر کانال مقصد", callback_data: "cb_change_dest" },
          { text: "🧪 ارسال پیام تست", callback_data: "cb_test_msg" },
        ],
        [
          { text: "📢 کانال گزارش ادمین", callback_data: "cb_report_channel" },
          { text: "📤 ارسال بک‌آپ به گزارش", callback_data: "cb_backup_to_report_channel" },
        ],
        [
          { text: "🧹 تنظیمات پاکسازی و فیلتر", callback_data: "cb_filters_menu" },
          { text: "📑 ۵ گزارش اخیر لاگ", callback_data: "cb_logs" },
        ],
        [
          { text: "📦 دریافت بک‌آپ (backup.dump)", callback_data: "cb_backup" },
          { text: "📥 بازیابی بک‌آپ (Restore)", callback_data: "cb_restore" },
        ],
        [
          { text: "🔄 به‌روزرسانی منو", callback_data: "cb_main_menu" },
        ],
      ],
    };

    return { text, reply_markup };
  }

  function getBotAdminStatusContent() {
    const isPaused = !!store.isMonitoringPaused;
    const isClientConn = gramStatus === "connected" || !!store.telegramClientConfig?.isConnected;
    const phone = store.telegramClientConfig?.connectedPhone || store.telegramClientConfig?.phoneNumber || "نامشخص";
    const dest = store.settings?.destinationChannel || "تعریف‌نشده";
    const totalSources = store.sources?.length || 0;
    const activeSources = store.sources ? store.sources.filter((s) => s.status === "active").length : 0;
    const transferred = store.stats?.totalTransferred || 0;
    const failed = store.stats?.failedMessages || 0;

    const uptimeSec = Math.floor((Date.now() - new Date(store.stats?.startTime || Date.now()).getTime()) / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);

    const text =
      `📊 <b>گزارش جامع وضعیت سیستم مانیتورینگ</b>\n\n` +
      `• <b>وضعیت مانیتورینگ:</b> ${isPaused ? "⏸️ متوقف موقت" : "🟢 فعال"}\n` +
      `• <b>حساب متصل تلگرام:</b> ${isClientConn ? `🟢 متصل (${phone})` : "🔴 غیرفعال"}\n` +
      `• <b>ربات ارسال‌کننده:</b> ${store.settings?.botInfo?.username ? `@${store.settings.botInfo.username}` : "—"}\n` +
      `• <b>کانال مقصد:</b> <code>${dest}</code>\n` +
      `• <b>تعداد کل کانال‌ها:</b> ${totalSources} (فعال: ${activeSources})\n` +
      `• <b>پیام‌های انتقال‌یافته:</b> ${transferred} عدد\n` +
      `• <b>خطاهای ارسال:</b> ${failed} عدد\n` +
      `• <b>مدت زمان آنلاین بودن:</b> ${hours} ساعت و ${mins} دقیقه\n` +
      `• <b>صف ارسال هوشمند:</b> ${store.settings?.queueSettings?.isQueuePaused ? "⏸️ متوقف" : "🟢 فعال"}\n` +
      `• <b>گروه گزارش ادمین:</b> ${store.settings?.reportGroupConfig?.chatId ? "🟢 متصل" : "⚪ تنظیم‌نشده"}\n\n` +
      `🕒 <b>زمان و مبنای ساعت:</b> <code>${getTehranDateTimeString()} (تهران +03:30)</code>`;

    const reply_markup = {
      inline_keyboard: [
        [
          { text: "🔄 تازه‌سازی وضعیت", callback_data: "cb_status" },
          {
            text: isPaused ? "▶️ شروع مجدد مانیتورینگ" : "⏸️ متوقف کردن مانیتورینگ",
            callback_data: "cb_toggle_pause",
          },
        ],
        [{ text: "🔙 بازگشت به منوی اصلی", callback_data: "cb_main_menu" }],
      ],
    };

    return { text, reply_markup };
  }

  function getBotAdminChannelsContent() {
    const sources = store.sources || [];

    let text =
      `📋 <b>لیست کانال‌های مبدا تحت مانیتورینگ (${sources.length} کانال)</b>\n\n` +
      `<i>برای حذف هر کانال، روی دکمه ضربدر [❌] روبروی آن کلیک کنید:</i>\n\n`;

    if (sources.length === 0) {
      text += `⚠️ <i>هیچ کانالی در سیستم ثبت نشده است. جهت افزودن کانال از دکمه زیر استفاده کنید.</i>`;
    } else {
      sources.forEach((s, idx) => {
        const icon = s.status === "active" ? "🟢" : "⚪";
        text += `${idx + 1}. ${icon} <b>${s.title || s.username}</b> (@${s.username})\n   ├ شناسه: <code>${s.numericId || s.id}</code> | منتقل‌شده: <b>${s.totalTransferred || 0}</b>\n\n`;
      });
    }

    const inline_keyboard: any[][] = [];

    // Create delete buttons for each channel (max 12)
    sources.slice(0, 12).forEach((s) => {
      const label = `❌ حذف «${(s.title || s.username).slice(0, 15)}»`;
      inline_keyboard.push([
        { text: label, callback_data: `cb_del_src_${s.id}` },
      ]);
    });

    inline_keyboard.push([
      { text: "➕ افزودن کانال جدید", callback_data: "cb_add_channel" },
      { text: "🔄 تازه‌سازی لیست", callback_data: "cb_channels" },
    ]);
    inline_keyboard.push([
      { text: "🔙 بازگشت به منوی اصلی", callback_data: "cb_main_menu" },
    ]);

    return { text, reply_markup: { inline_keyboard } };
  }

  function getBotAdminFiltersContent() {
    const ai = store.settings.aiProcessing || DEFAULT_AI_PROCESSING;
    const cleanEnabled = !!ai.enableContentCleaning;
    const kwEnabled = !!ai.enableKeywordFilter;
    const sigEnabled = !!ai.enableMessageSignature;

    const allowed = ai.allowedKeywords || [];
    const blocked = ai.blockedKeywords || [];
    const rules = ai.cleaningRules || [];
    const sigText = (ai.signatureText || "").trim();

    const allowedStr = allowed.length > 0 ? allowed.slice(0, 6).join("، ") + (allowed.length > 6 ? ` (+${allowed.length - 6} مورد)` : "") : "همه پیام‌ها آزاد (بدون شرط)";
    const blockedStr = blocked.length > 0 ? blocked.slice(0, 6).join("، ") + (blocked.length > 6 ? ` (+${blocked.length - 6} مورد)` : "") : "هیچ کلمه‌ای ممنوع نشده";
    const rulesStr = rules.length > 0 ? rules.slice(0, 4).join("، ") + (rules.length > 4 ? ` (+${rules.length - 4} مورد)` : "") : "فقط پیش‌فرض‌ها";

    const text =
      `🧹 <b>مرکز جامع تنظیمات پردازش، پاکسازی و فیلتر پیام‌ها</b>\n\n` +
      `• <b>فیلتر کلمات کلیدی:</b> ${kwEnabled ? "🟢 فعال" : "🔴 غیرفعال"}\n` +
      `   ├ کلمات مجاز (${allowed.length}): <code>${allowedStr}</code>\n` +
      `   └ کلمات ممنوعه (${blocked.length}): <code>${blockedStr}</code>\n\n` +
      `• <b>پاکسازی محتوا و تبلیغات:</b> ${cleanEnabled ? "🟢 فعال" : "🔴 غیرفعال"}\n` +
      `   └ عبارات حذفی اختصاصی (${rules.length}): <code>${rulesStr}</code>\n\n` +
      `• <b>امضای اختصاصی انتهای پست:</b> ${sigEnabled ? "🟢 فعال" : "🔴 غیرفعال"}\n` +
      `   └ متن امضا: <i>${sigText ? (sigText.length > 45 ? sigText.slice(0, 45) + "..." : sigText) : "هنوز تنظیم نشده"}</i>\n\n` +
      `🕒 <b>مبنای زمان سیستم:</b> <code>ساعت رسمی تهران (UTC+03:30)</code>\n\n` +
      `<i>برای فعال/غیرفعال کردن یا ویرایش هر بخش روی دکمه‌های زیر کلیک فرمایید:</i>`;

    const reply_markup = {
      inline_keyboard: [
        [
          {
            text: cleanEnabled ? "🧹 پاکسازی: [فعال ✅]" : "🧹 پاکسازی: [غیرفعال ❌]",
            callback_data: "cb_toggle_clean",
          },
          {
            text: kwEnabled ? "🔎 فیلتر: [فعال ✅]" : "🔎 فیلتر: [غیرفعال ❌]",
            callback_data: "cb_toggle_kw",
          },
        ],
        [
          {
            text: sigEnabled ? "✍️ امضای پست: [فعال ✅]" : "✍️ امضای پست: [غیرفعال ❌]",
            callback_data: "cb_toggle_sig",
          },
          { text: "👁️ مشاهده امضا", callback_data: "cb_view_sig" },
        ],
        [
          { text: "➕ کلمه مجاز", callback_data: "cb_add_allowed_kw" },
          { text: `➖ لیست و حذف مجاز (${allowed.length})`, callback_data: "cb_del_allowed_kw" },
        ],
        [
          { text: "🚫 کلمه ممنوع", callback_data: "cb_add_blocked_kw" },
          { text: `❌ لیست و حذف ممنوع (${blocked.length})`, callback_data: "cb_del_blocked_kw" },
        ],
        [
          { text: "✂️ افزودن پاکسازی متن", callback_data: "cb_add_clean_rule" },
          { text: `🗑️ حذف پاکسازی (${rules.length})`, callback_data: "cb_del_clean_rule" },
        ],
        [
          { text: "📝 تغییر متن امضای اختصاصی", callback_data: "cb_edit_sig" },
        ],
        [
          { text: "🔄 تازه‌سازی تنظیمات", callback_data: "cb_filters_menu" },
          { text: "🔙 منوی اصلی", callback_data: "cb_main_menu" },
        ],
      ],
    };

    return { text, reply_markup };
  }

  function getBotAdminAllowedKeywordsContent() {
    const ai = store.settings.aiProcessing || DEFAULT_AI_PROCESSING;
    const allowed = ai.allowedKeywords || [];

    let text =
      `🔑 <b>لیست کلمات کلیدی مجاز (Allowed Keywords)</b>\n\n` +
      `اگر این لیست پر باشد، پیام‌ها فقط در صورتی منتقل می‌شوند که حداقل شامل یکی از این کلمات باشند.\n\n`;

    if (allowed.length === 0) {
      text += `<i>هیچ کلمه مجازی تعریف نشده است (تمامی پیام‌ها آزادانه عبور می‌کنند).</i>\n\n`;
    } else {
      text += `تعداد کلمات تعریف‌شده: <b>${allowed.length}</b> مورد\n`;
      text += `<i>برای حذف هر کلمه، روی دکمه مربوط به آن کلیک نمایید:</i>\n\n`;
    }

    const inline_keyboard: any[][] = [];
    for (let i = 0; i < allowed.length; i += 2) {
      const row: any[] = [];
      row.push({
        text: `❌ ${allowed[i]}`,
        callback_data: `cb_rm_allowed_${i}`,
      });
      if (i + 1 < allowed.length) {
        row.push({
          text: `❌ ${allowed[i + 1]}`,
          callback_data: `cb_rm_allowed_${i + 1}`,
        });
      }
      inline_keyboard.push(row);
    }

    inline_keyboard.push([
      { text: "➕ افزودن کلمه مجاز جدید", callback_data: "cb_add_allowed_kw" },
      { text: "🔙 بازگشت به تنظیمات فیلتر", callback_data: "cb_filters_menu" },
    ]);

    return { text, reply_markup: { inline_keyboard } };
  }

  function getBotAdminBlockedKeywordsContent() {
    const ai = store.settings.aiProcessing || DEFAULT_AI_PROCESSING;
    const blocked = ai.blockedKeywords || [];

    let text =
      `🚫 <b>لیست کلمات کلیدی ممنوعه (Blocked Keywords)</b>\n\n` +
      `در صورت وجود هر یک از این کلمات در پیام، پست فوراً فیلتر و رد خواهد شد.\n\n`;

    if (blocked.length === 0) {
      text += `<i>هیچ کلمه ممنوعه‌ای تعریف نشده است.</i>\n\n`;
    } else {
      text += `تعداد کلمات ممنوعه: <b>${blocked.length}</b> مورد\n`;
      text += `<i>برای حذف هر کلمه، روی دکمه مربوطه کلیک نمایید:</i>\n\n`;
    }

    const inline_keyboard: any[][] = [];
    for (let i = 0; i < blocked.length; i += 2) {
      const row: any[] = [];
      row.push({
        text: `❌ ${blocked[i]}`,
        callback_data: `cb_rm_blocked_${i}`,
      });
      if (i + 1 < blocked.length) {
        row.push({
          text: `❌ ${blocked[i + 1]}`,
          callback_data: `cb_rm_blocked_${i + 1}`,
        });
      }
      inline_keyboard.push(row);
    }

    inline_keyboard.push([
      { text: "🚫 افزودن کلمه ممنوع جدید", callback_data: "cb_add_blocked_kw" },
      { text: "🔙 بازگشت به تنظیمات فیلتر", callback_data: "cb_filters_menu" },
    ]);

    return { text, reply_markup: { inline_keyboard } };
  }

  function getBotAdminCleanRulesContent() {
    const ai = store.settings.aiProcessing || DEFAULT_AI_PROCESSING;
    const rules = ai.cleaningRules || [];

    let text =
      `✂️ <b>الگوها و عبارات اختصاصی پاکسازی متنی</b>\n\n` +
      `این عبارات به همراه لینک‌ها و آیدی‌های مبدا، به صورت خودکار از متن تمام پیام‌ها حذف می‌گردند.\n\n`;

    if (rules.length === 0) {
      text += `<i>هیچ عبارت پاکسازی اختصاصی تعریف نشده است (فقط پاکسازی لینک‌های عمومی).</i>\n\n`;
    } else {
      text += `تعداد عبارات حذفی: <b>${rules.length}</b> مورد\n`;
      text += `<i>برای حذف هر عبارت پاکسازی، روی آن کلیک نمایید:</i>\n\n`;
    }

    const inline_keyboard: any[][] = [];
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const label = r.length > 20 ? r.slice(0, 20) + "..." : r;
      inline_keyboard.push([
        { text: `🗑️ حذف «${label}»`, callback_data: `cb_rm_clean_${i}` },
      ]);
    }

    inline_keyboard.push([
      { text: "➕ افزودن عبارت پاکسازی جدید", callback_data: "cb_add_clean_rule" },
      { text: "🔙 بازگشت به تنظیمات فیلتر", callback_data: "cb_filters_menu" },
    ]);

    return { text, reply_markup: { inline_keyboard } };
  }

  function getBotAdminSignatureContent() {
    const ai = store.settings.aiProcessing || DEFAULT_AI_PROCESSING;
    const sigText = (ai.signatureText || "").trim();
    const sigEnabled = !!ai.enableMessageSignature;

    let text =
      `✍️ <b>امضای اختصاصی انتهای پست‌ها</b>\n\n` +
      `• <b>وضعیت فعال‌سازی:</b> ${sigEnabled ? "🟢 فعال (در انتهای تمام پست‌ها اضافه می‌شود)" : "🔴 غیرفعال"}\n\n`;

    if (sigText) {
      text += `<b>متن فعلی امضا:</b>\n<pre>${sigText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>\n\n`;
    } else {
      text += `<i>متن امضا هنوز خالی است. می‌توانید با دکمه زیر متن دلخواه خود را ثبت کنید.</i>\n\n`;
    }

    const reply_markup = {
      inline_keyboard: [
        [
          { text: "📝 تغییر متن امضا", callback_data: "cb_edit_sig" },
          {
            text: sigEnabled ? "🔴 غیرفعال‌سازی امضا" : "🟢 فعال‌سازی امضا",
            callback_data: "cb_toggle_sig",
          },
        ],
        [{ text: "🔙 بازگشت به تنظیمات فیلتر", callback_data: "cb_filters_menu" }],
      ],
    };

    return { text, reply_markup };
  }

  function getBotAdminLogsContent() {
    const logs = (store.logs || []).slice(0, 6);
    let text =
      `📑 <b>آخرین گزارشات فعالیت و انتقال پیام</b>\n` +
      `🕒 <i>ساعت ثبت لاگ‌ها بر مبنای وقت تهران (UTC+03:30) می‌باشد.</i>\n\n`;

    if (logs.length === 0) {
      text += `<i>هنوز هیچ فعالیتی ثبت نشده است.</i>`;
    } else {
      logs.forEach((l) => {
        const icon = l.status === "success" ? "✅" : l.status === "error" ? "❌" : "🟡";
        const time = getTehranTimeString(l.timestamp, true);
        text += `${icon} <b>[${time}] ${l.sourceTitle || l.sourceUsername}</b> (#${l.messageId || 0})\n   └ <i>${(l.details || "").slice(0, 70)}</i>\n\n`;
      });
    }

    const reply_markup = {
      inline_keyboard: [
        [
          { text: "🔄 تازه‌سازی لاگ‌ها", callback_data: "cb_logs" },
          { text: "🧪 ارسال تست", callback_data: "cb_test_msg" },
        ],
        [{ text: "🔙 بازگشت به منوی اصلی", callback_data: "cb_main_menu" }],
      ],
    };

    return { text, reply_markup };
  }

  function getBotAdminReportChannelContent() {
    const reportCfg = store.settings?.reportGroupConfig;
    const reportChan = reportCfg?.chatId || "تنظیم‌نشده";
    const isConn = reportCfg?.status === "connected" && !!reportCfg?.chatId;
    const autoBackup = reportCfg?.autoBackupEnabled !== false;
    const lastBackup = store.stats?.lastBackupTime
      ? getTehranDateTimeString(new Date(store.stats.lastBackupTime))
      : (reportCfg?.lastBackupAt ? getTehranDateTimeString(new Date(reportCfg.lastBackupAt)) : "تاکنون ارسال نشده");
    const lastTested = reportCfg?.lastTestedAt
      ? getTehranTimeString(reportCfg.lastTestedAt, true)
      : "ثبت‌نشده";

    let text =
      `📢 <b>مدیریت کانال ارسال گزارش و لاگ ادمین (Report Channel)</b>\n\n` +
      `این کانال به صورت مستقل از کانال مقصد برای موارد زیر کاربرد دارد:\n` +
      `• هشدارهای قطعی یا انقضای نشست کلاینت تلگرام\n` +
      `• گزارش خطاهای اضطراری و محدودیت‌های FloodWait\n` +
      `• خلاصه آمار عملکرد روزانه ربات\n` +
      `• <b>تهیه و ارسال خودکار نسخه کامل پشتیبان دیتابیس (.SQL) هر ۲۴ ساعت</b>\n\n` +
      `📌 <b>کانال گزارش فعلی:</b> <code>${reportChan}</code>\n` +
      `⚡ <b>وضعیت اتصال:</b> ${isConn ? "🟢 متصل و آماده" : "⚪ هنوز تنظیم نشده"}\n` +
      `🔄 <b>بک‌آپ خودکار ۲۴ ساعته:</b> ${autoBackup ? "🟢 فعال (ارسال روزانه SQL)" : "🔴 غیرفعال"}\n` +
      `📦 <b>آخرین بک‌آپ ارسالی:</b> <code>${lastBackup}</code>\n` +
      `🕒 <b>آخرین تست:</b> <code>${lastTested}</code>\n\n` +
      `<i>برای تنظیم یا تغییر کانال، ارسال تست یا بک‌آپ فوری، از دکمه‌های زیر استفاده کنید:</i>`;

    const reply_markup = {
      inline_keyboard: [
        [
          { text: "✏️ تنظیم / تغییر کانال گزارش", callback_data: "cb_change_report_channel" },
        ],
        [
          { text: "🧪 ارسال پیام تست به کانال", callback_data: "cb_test_report_channel" },
          { text: "📦 ارسال فوری فایل بک‌آپ (.SQL)", callback_data: "cb_backup_to_report_channel" },
        ],
        [
          {
            text: autoBackup ? "🔴 خاموش کردن بک‌آپ خودکار ۲۴ ساعته" : "🟢 روشن کردن بک‌آپ خودکار ۲۴ ساعته",
            callback_data: "cb_toggle_report_backup",
          },
        ],
        [{ text: "🔙 بازگشت به منوی اصلی", callback_data: "cb_main_menu" }],
      ],
    };

    return { text, reply_markup };
  }

  // --- Telegram Bot Long-Polling Loop ---
  let isBotPollerRunning = false;
  let botPollerOffset = (store as any).botPollerOffset || 0;
  const processedBotUpdateIds = new Set<number>();
  let isBotPollerBootstrapped = false;
  let lastTestMessageTimestamp = 0;
  const lastUserActionTimestamps = new Map<string, number>();

  async function pollTelegramBotUpdates() {
    if (isBotPollerRunning) return;
    const token = store.settings?.botToken;
    if (!token || !token.trim()) return;

    isBotPollerRunning = true;
    if (store.settings.botAdminConfig) {
      store.settings.botAdminConfig.isBotPollingActive = true;
    }

    try {
      // Bootstrap: if offset is 0 on fresh startup, fast-forward to latest update to avoid replaying historical backlog
      if (!isBotPollerBootstrapped && botPollerOffset === 0) {
        isBotPollerBootstrapped = true;
        try {
          const initCheck = await callTelegramBotApi(token, "getUpdates", {
            offset: -1,
            limit: 1,
            timeout: 0,
          });
          if (initCheck.ok && Array.isArray(initCheck.result) && initCheck.result.length > 0) {
            botPollerOffset = initCheck.result[0].update_id + 1;
            (store as any).botPollerOffset = botPollerOffset;
            saveStore();
            console.log(`[BOT POLLER] Fast-forwarded offset to ${botPollerOffset} to clear historical backlog`);
          }
        } catch (_) {}
      }

      const updatesRes = await callTelegramBotApi(token, "getUpdates", {
        offset: botPollerOffset,
        timeout: 10,
        allowed_updates: ["message", "callback_query"],
      });

      if (updatesRes.ok && Array.isArray(updatesRes.result)) {
        for (const update of updatesRes.result) {
          botPollerOffset = Math.max(botPollerOffset, update.update_id + 1);
          (store as any).botPollerOffset = botPollerOffset;

          // Prevent duplicate execution of identical update IDs
          if (processedBotUpdateIds.has(update.update_id)) {
            continue;
          }
          processedBotUpdateIds.add(update.update_id);
          if (processedBotUpdateIds.size > 2500) {
            const iter = processedBotUpdateIds.values();
            for (let i = 0; i < 500; i++) {
              const val = iter.next().value;
              if (val !== undefined) processedBotUpdateIds.delete(val);
            }
          }

          // Debounce rapid duplicate button clicks or command flooding from same user
          const actionUserId = update.callback_query?.from?.id || update.message?.from?.id;
          const actionPayload = update.callback_query?.data || update.message?.text || "";
          if (actionUserId && actionPayload) {
            const debounceKey = `${actionUserId}_${actionPayload}`;
            const lastTime = lastUserActionTimestamps.get(debounceKey) || 0;
            const now = Date.now();
            if (now - lastTime < 350) {
              if (update.callback_query) {
                callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: update.callback_query.id }).catch(() => {});
              }
              continue;
            }
            lastUserActionTimestamps.set(debounceKey, now);
            if (lastUserActionTimestamps.size > 2000) {
              lastUserActionTimestamps.clear();
            }
          }

          // Process each update inside an isolated try-catch
          try {
            // 1. Handle Callback Queries (Button Clicks)
            if (update.callback_query) {
            const cq = update.callback_query;
            const fromId = cq.from?.id;
            const fromUsername = cq.from?.username;
            const data = cq.data;
            const msgId = cq.message?.message_id;
            const chatId = cq.message?.chat?.id;

            if (!isTelegramUserAdmin(fromId, fromUsername)) {
              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: "⛔ دسترسی محدود: شما ادمین این ربات نیستید.",
                show_alert: true,
              });
              continue;
            }

            // Track last command
            if (store.settings.botAdminConfig) {
              store.settings.botAdminConfig.lastCommandReceived = data;
              store.settings.botAdminConfig.lastCommandTime = new Date().toISOString();
            }

            if (data === "cb_main_menu") {
              const menu = getBotAdminMainMenuContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: menu.text,
                parse_mode: "HTML",
                reply_markup: menu.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
            } else if (data === "cb_status") {
              const status = getBotAdminStatusContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: status.text,
                parse_mode: "HTML",
                reply_markup: status.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
            } else if (data === "cb_toggle_pause") {
              store.isMonitoringPaused = !store.isMonitoringPaused;
              if (store.telegramClientConfig) {
                store.telegramClientConfig.isMonitoringPaused = store.isMonitoringPaused;
              }
              saveStore();

              const alertText = store.isMonitoringPaused
                ? "⏸️ مانیتورینگ کانال‌ها موقتاً متوقف گردید."
                : "🟢 مانیتورینگ کانال‌ها مجدداً با موفقیت فعال شد.";

              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: alertText,
                show_alert: true,
              });

              // Refresh menu message
              const menu = getBotAdminMainMenuContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: menu.text,
                parse_mode: "HTML",
                reply_markup: menu.reply_markup,
              });
            } else if (data === "cb_channels") {
              const channels = getBotAdminChannelsContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: channels.text,
                parse_mode: "HTML",
                reply_markup: channels.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
            } else if (data && data.startsWith("cb_del_src_")) {
              const srcId = data.replace("cb_del_src_", "");
              const targetSource = store.sources.find((s) => s.id === srcId);
              const targetTitle = targetSource ? targetSource.title || targetSource.username : srcId;

              store.sources = store.sources.filter((s) => s.id !== srcId);
              monitoredSourcesMap.delete(srcId);
              saveStore();

              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: `✅ کانال «${targetTitle}» با موفقیت حذف گردید.`,
                show_alert: true,
              });

              // Refresh channel list
              const channels = getBotAdminChannelsContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: channels.text,
                parse_mode: "HTML",
                reply_markup: channels.reply_markup,
              });
            } else if (data === "cb_add_channel") {
              botUserStates[String(fromId)] = { state: "waiting_for_source", lastActive: Date.now() };
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `➕ <b>افزودن کانال مبدا جدید</b>\n\n` +
                  `لطفاً یوزرنیم یا لینک کانال مبدا را ارسال کنید:\n` +
                  `<i>(مانند: <code>@varzesh3</code> یا <code>https://t.me/durov</code>)</i>\n\n` +
                  `برای لغو دستور /cancel را بفرستید.`,
                parse_mode: "HTML",
              });
            } else if (data === "cb_change_dest") {
              botUserStates[String(fromId)] = { state: "waiting_for_dest", lastActive: Date.now() };
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `🎯 <b>تغییر کانال مقصد</b>\n\n` +
                  `کانال مقصد فعلی: <code>${store.settings.destinationChannel || "تعریف نشده"}</code>\n\n` +
                  `لطفاً آیدی یا شناسه عددی کانال مقصد جدید را ارسال کنید:\n` +
                  `<i>(مانند: <code>@my_destination</code> یا <code>-100123456789</code>)</i>\n\n` +
                  `برای لغو دستور /cancel را بفرستید.`,
                parse_mode: "HTML",
              });
            } else if (data === "cb_test_msg") {
              if (store.isSystemTurnedOff) {
                await callTelegramBotApi(token, "answerCallbackQuery", {
                  callback_query_id: cq.id,
                  text: "🛑 سامانه در وضعیت خاموش اضطراری است! ابتدا سامانه را روشن نمایید.",
                  show_alert: true,
                });
                return;
              }
              const now = Date.now();
              if (now - lastTestMessageTimestamp < 4000) {
                await callTelegramBotApi(token, "answerCallbackQuery", {
                  callback_query_id: cq.id,
                  text: "⏳ لطفاً چند ثانیه بین ارسال‌های تست صبر کنید.",
                  show_alert: true,
                });
                return;
              }
              lastTestMessageTimestamp = now;

              const dest = store.settings.destinationChannel;
              if (!dest) {
                await callTelegramBotApi(token, "answerCallbackQuery", {
                  callback_query_id: cq.id,
                  text: "⚠️ کانال مقصد تنظیم نشده است!",
                  show_alert: true,
                });
              } else {
                const testRes = await callTelegramBotApi(token, "sendMessage", {
                  chat_id: dest,
                  text: `🧪 <b>پیام تست ارسالی از پنل ادمین تلگرام</b>\n\n✅ اتصال ربات با کانال مقصد برقرار است.\n🕒 زمان: <code>${getTehranDateTimeString()} (تهران +03:30)</code>`,
                  parse_mode: "HTML",
                });
                if (testRes.ok) {
                  await callTelegramBotApi(token, "answerCallbackQuery", {
                    callback_query_id: cq.id,
                    text: `✅ پیام تست با موفقیت به ${dest} ارسال شد.`,
                    show_alert: true,
                  });
                } else {
                  await callTelegramBotApi(token, "answerCallbackQuery", {
                    callback_query_id: cq.id,
                    text: `❌ خطا در ارسال تست: ${testRes.description || "نامشخص"}`,
                    show_alert: true,
                  });
                }
              }
            } else if (data === "cb_filters_menu") {
              const filters = getBotAdminFiltersContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: filters.text,
                parse_mode: "HTML",
                reply_markup: filters.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
            } else if (data === "cb_toggle_clean") {
              if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
              store.settings.aiProcessing.enableContentCleaning = !store.settings.aiProcessing.enableContentCleaning;
              saveStore();
              const filters = getBotAdminFiltersContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: filters.text,
                parse_mode: "HTML",
                reply_markup: filters.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: `پاکسازی محتوا: ${store.settings.aiProcessing.enableContentCleaning ? "فعال شد" : "غیرفعال شد"}`,
              });
            } else if (data === "cb_toggle_kw") {
              if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
              store.settings.aiProcessing.enableKeywordFilter = !store.settings.aiProcessing.enableKeywordFilter;
              saveStore();
              const filters = getBotAdminFiltersContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: filters.text,
                parse_mode: "HTML",
                reply_markup: filters.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: `فیلتر کلمات: ${store.settings.aiProcessing.enableKeywordFilter ? "فعال شد" : "غیرفعال شد"}`,
              });
            } else if (data === "cb_toggle_sig") {
              if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
              store.settings.aiProcessing.enableMessageSignature = !store.settings.aiProcessing.enableMessageSignature;
              saveStore();
              const filters = getBotAdminFiltersContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: filters.text,
                parse_mode: "HTML",
                reply_markup: filters.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: `امضای پیام: ${store.settings.aiProcessing.enableMessageSignature ? "فعال شد" : "غیرفعال شد"}`,
              });
            } else if (data === "cb_view_sig") {
              const sigContent = getBotAdminSignatureContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: sigContent.text,
                parse_mode: "HTML",
                reply_markup: sigContent.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
            } else if (data === "cb_edit_sig") {
              botUserStates[String(fromId)] = { state: "waiting_for_signature", lastActive: Date.now() };
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `✍️ <b>ویرایش متن امضای اختصاصی انتهای پیام‌ها</b>\n\n` +
                  `لطفاً متن امضای مورد نظر خود را در پیام بعدی ارسال فرمایید.\n` +
                  `این متن می‌تواند شامل لینک، آیدی کانال، ایموجی یا توضیحات دلخواه باشد.\n\n` +
                  `<i>جهت انصراف عبارت /cancel را ارسال نمایید.</i>`,
                parse_mode: "HTML",
              });
            } else if (data === "cb_add_allowed_kw") {
              botUserStates[String(fromId)] = { state: "waiting_for_allowed_kw", lastActive: Date.now() };
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `➕ <b>افزودن کلمه یا کلمات کلیدی مجاز (Allowed Keywords)</b>\n\n` +
                  `لطفاً کلمه یا کلمات مورد نظر را ارسال فرمایید.\n` +
                  `<i>(می‌توانید چند کلمه را با کاما یا در خطوط جداگانه ارسال کنید)</i>\n\n` +
                  `جهت انصراف /cancel را ارسال کنید.`,
                parse_mode: "HTML",
              });
            } else if (data === "cb_del_allowed_kw") {
              const kwContent = getBotAdminAllowedKeywordsContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: kwContent.text,
                parse_mode: "HTML",
                reply_markup: kwContent.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
            } else if (data.startsWith("cb_rm_allowed_")) {
              const idx = parseInt(data.replace("cb_rm_allowed_", ""), 10);
              if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
              const allowed = store.settings.aiProcessing.allowedKeywords || [];
              let removedWord = "";
              if (!isNaN(idx) && idx >= 0 && idx < allowed.length) {
                removedWord = allowed.splice(idx, 1)[0];
                store.settings.aiProcessing.allowedKeywords = allowed;
                saveStore();
              }
              const kwContent = getBotAdminAllowedKeywordsContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: kwContent.text,
                parse_mode: "HTML",
                reply_markup: kwContent.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: removedWord ? `کلمه «${removedWord}» حذف گردید.` : "کلمه حذف شد.",
              });
            } else if (data === "cb_add_blocked_kw") {
              botUserStates[String(fromId)] = { state: "waiting_for_blocked_kw", lastActive: Date.now() };
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `🚫 <b>افزودن کلمه یا کلمات ممنوعه (Blocked Keywords)</b>\n\n` +
                  `لطفاً کلمه یا کلمات ممنوعه را ارسال کنید.\n` +
                  `<i>(در صورت مشاهده هر یک از این کلمات در پیام، پست فوراً رد خواهد شد)</i>\n\n` +
                  `جهت انصراف /cancel را ارسال کنید.`,
                parse_mode: "HTML",
              });
            } else if (data === "cb_del_blocked_kw") {
              const blContent = getBotAdminBlockedKeywordsContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: blContent.text,
                parse_mode: "HTML",
                reply_markup: blContent.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
            } else if (data.startsWith("cb_rm_blocked_")) {
              const idx = parseInt(data.replace("cb_rm_blocked_", ""), 10);
              if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
              const blocked = store.settings.aiProcessing.blockedKeywords || [];
              let removedWord = "";
              if (!isNaN(idx) && idx >= 0 && idx < blocked.length) {
                removedWord = blocked.splice(idx, 1)[0];
                store.settings.aiProcessing.blockedKeywords = blocked;
                saveStore();
              }
              const blContent = getBotAdminBlockedKeywordsContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: blContent.text,
                parse_mode: "HTML",
                reply_markup: blContent.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: removedWord ? `کلمه «${removedWord}» از لیست ممنوعه حذف شد.` : "کلمه حذف شد.",
              });
            } else if (data === "cb_add_clean_rule") {
              botUserStates[String(fromId)] = { state: "waiting_for_clean_rule", lastActive: Date.now() };
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `✂️ <b>افزودن عبارت پاکسازی متنی (Cleaning Rule)</b>\n\n` +
                  `لطفاً متنی که می‌خواهید به طور خودکار از تمام پیام‌ها حذف شود را ارسال فرمایید.\n` +
                  `<i>(می‌توانید چند عبارت را با خط جدید ارسال کنید)</i>\n\n` +
                  `جهت انصراف /cancel را ارسال کنید.`,
                parse_mode: "HTML",
              });
            } else if (data === "cb_del_clean_rule") {
              const clContent = getBotAdminCleanRulesContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: clContent.text,
                parse_mode: "HTML",
                reply_markup: clContent.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
            } else if (data.startsWith("cb_rm_clean_")) {
              const idx = parseInt(data.replace("cb_rm_clean_", ""), 10);
              if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
              const rules = store.settings.aiProcessing.cleaningRules || [];
              let removedRule = "";
              if (!isNaN(idx) && idx >= 0 && idx < rules.length) {
                removedRule = rules.splice(idx, 1)[0];
                store.settings.aiProcessing.cleaningRules = rules;
                saveStore();
              }
              const clContent = getBotAdminCleanRulesContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: clContent.text,
                parse_mode: "HTML",
                reply_markup: clContent.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: removedRule ? `عبارت پاکسازی «${removedRule.slice(0, 15)}» حذف شد.` : "عبارت حذف گردید.",
              });
            } else if (data === "cb_logs") {
              const logsContent = getBotAdminLogsContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: logsContent.text,
                parse_mode: "HTML",
                reply_markup: logsContent.reply_markup,
              });
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
            } else if (data === "cb_backup") {
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
              const destChannel = store.settings.destinationChannel || "تنظیم نشده";
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `📦 <b>تهیه و استخراج نسخه پشتیبان کامل دیتابیس (.SQL)</b>\n\n` +
                  `این فایل استاندارد شامل تمامی اطلاعات و تنظیمات کلیدی است:\n` +
                  `• تمامی <b>کانال‌های ثبت‌شده برای مانیتورینگ</b> (${store.sources.length} منبع)\n` +
                  `• تب کامل <b>پردازش هوشمند</b> (فیلتر کلمات مجاز و ممنوعه، پاکسازی و حذف لینک‌ها، امضا، قوانین رسانه، تنظیمات بازنویسی AI)\n` +
                  `• پیکربندی و اتصال ربات تلگرام\n\n` +
                  `📌 <b>مایلید فایل پشتیبان SQL کجا ارسال شود؟</b>`,
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "📥 ارسال به همین چت (پی‌وی مدیر)", callback_data: "cb_backup_to_chat" }],
                    [{ text: `📢 ارسال به کانال مقصد (${destChannel})`, callback_data: "cb_backup_to_channel" }],
                    [{ text: "❌ انصراف", callback_data: "cb_backup_cancel" }],
                  ],
                },
              });
            } else if (data === "cb_backup_to_chat") {
              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: "⏳ در حال استخراج دیتابیس و تولید فایل SQL...",
              });
              const backupRes = await performTelegramDatabaseBackup(true, chatId, "sql");
              if (backupRes.success) {
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text:
                    `✅ <b>فایل پشتیبان رسمی دیتابیس (<code>${backupRes.filename}</code>) در همین چت تحویل گردید.</b>\n\n` +
                    `🔒 <i>این نسخه با فرمت استاندارد .SQL شامل مانیتورینگ، تمامی فیلترها و تنظیمات پردازش هوشمند است.</i>\n` +
                    `🕒 مبنای زمان: <code>${getTehranDateTimeString()}</code>`,
                  parse_mode: "HTML",
                });
              } else {
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `❌ خطا در تهیه و تحویل بک‌آپ: ${backupRes.message}`,
                });
              }
            } else if (data === "cb_backup_to_channel") {
              const dest = store.settings.destinationChannel;
              if (!dest) {
                await callTelegramBotApi(token, "answerCallbackQuery", {
                  callback_query_id: cq.id,
                  text: "⚠️ کانال مقصدی در تنظیمات ربات ثبت نشده است.",
                  show_alert: true,
                });
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `⚠️ <b>کانال مقصدی تعریف نشده است.</b>\nلطفاً ابتدا از پنل یا دستور /menu کانال مقصد را تنظیم فرمایید یا گزینه «ارسال به همین چت» را انتخاب کنید.`,
                  parse_mode: "HTML",
                });
              } else {
                await callTelegramBotApi(token, "answerCallbackQuery", {
                  callback_query_id: cq.id,
                  text: `⏳ در حال استخراج و ارسال به کانال مقصد (${dest})...`,
                });
                const backupRes = await performTelegramDatabaseBackup(true, dest, "sql");
                if (backupRes.success) {
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text:
                      `✅ <b>نسخه پشتیبان دیتابیس با موفقیت به کانال مقصد ارسال شد.</b>\n\n` +
                      `📦 نام فایل: <code>${backupRes.filename}</code>\n` +
                      `📢 کانال مقصد: <code>${dest}</code>\n` +
                      `🕒 تاریخ و زمان: <code>${getTehranDateTimeString()}</code>`,
                    parse_mode: "HTML",
                  });
                } else {
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text: `❌ خطا در ارسال بک‌آپ به کانال مقصد: ${backupRes.message}`,
                  });
                }
              }
            } else if (data === "cb_backup_cancel") {
              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: "عملیات لغو شد.",
              });
              if (cq.message?.message_id) {
                await callTelegramBotApi(token, "editMessageText", {
                  chat_id: chatId,
                  message_id: cq.message.message_id,
                  text: "❌ <i>عملیات استخراج و ارسال نسخه پشتیبان دیتابیس لغو گردید.</i>",
                  parse_mode: "HTML",
                });
              }
            } else if (data === "cb_restore") {
              botUserStates[String(fromId)] = { state: "waiting_for_backup_file", lastActive: Date.now() };
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id });
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `📥 <b>بارگذاری و بازیابی نسخه پشتیبان (Restore Backup)</b>\n\n` +
                  `لطفاً فایل بک‌آپ خود را (مانند <code>backup.dump</code> یا <code>backup.json</code>) به عنوان <b>فایل (Document)</b> در همین چت ارسال فرمایید.\n\n` +
                  `ربات اطلاعات را بلافاصله استخراج، در سامانه بازنشانی کرده و مانیتورینگ را از سر خواهد گرفت.\n\n` +
                  `برای انصراف دستور /cancel را ارسال کنید.`,
                parse_mode: "HTML",
              });
            } else if (data === "cb_toggle_power") {
              store.isSystemTurnedOff = !store.isSystemTurnedOff;
              defaultQueueService.setEmergencyHalt(!!store.isSystemTurnedOff);
              saveStore();

              addLog(
                "system",
                "telegram_bot",
                "کلید برق اضطراری ربات",
                0,
                "config",
                "success",
                store.isSystemTurnedOff
                  ? "🛑 سامانه به طور کامل خاموش شد (رصد و ارسال متوقف شدند)."
                  : "🟢 سامانه با موفقیت مجدداً روشن و فعال شد."
              );

              const alertMsg = store.isSystemTurnedOff
                ? "🛑 خاموش‌سازی اضطراری کامل سیستم:\nرصد کانال‌ها و ارسال پیام‌ها کاملاً متوقف شدند."
                : "🟢 روشن‌سازی مجدد سیستم:\nرصد کانال‌ها و صف ارسال پیام مجدداً فعال شدند.";

              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: alertMsg,
                show_alert: true,
              }).catch(() => {});

              const menu = getBotAdminMainMenuContent();
              const editRes = await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: menu.text,
                parse_mode: "HTML",
                reply_markup: menu.reply_markup,
              });
              if (!editRes.ok) {
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `${alertMsg}\n\n${menu.text}`,
                  parse_mode: "HTML",
                  reply_markup: menu.reply_markup,
                });
              }
            } else if (data === "cb_report_channel") {
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id }).catch(() => {});
              const repContent = getBotAdminReportChannelContent();
              const editRes = await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: repContent.text,
                parse_mode: "HTML",
                reply_markup: repContent.reply_markup,
              });
              if (!editRes.ok) {
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: repContent.text,
                  parse_mode: "HTML",
                  reply_markup: repContent.reply_markup,
                });
              }
            } else if (data === "cb_change_report_channel") {
              botUserStates[String(fromId)] = { state: "waiting_for_report_channel", lastActive: Date.now() };
              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: "لطفاً آیدی کانال گزارش را ارسال کنید",
              }).catch(() => {});
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `📢 <b>تعیین یا ویرایش کانال ارسال گزارش و لاگ ادمین</b>\n\n` +
                  `کانال فعلی: <code>${store.settings?.reportGroupConfig?.chatId || "تنظیم‌نشده"}</code>\n\n` +
                  `لطفاً آیدی یا یوزرنیم کانال گزارش مورد نظر را در پیام بعدی ارسال فرمایید:\n` +
                  `<i>(مثال: <code>@my_reports</code> یا شناسه عددی <code>-1001234567890</code>)</i>\n\n` +
                  `⚠️ <b>الزامی:</b> ربات باید در کانال گزارش عضو شده و دسترسی ادمین (ارسال پیام) داشته باشد.\n\n` +
                  `برای لغو روی دکمه زیر کلیک کرده یا دستور /cancel را ارسال فرمایید.`,
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🔙 بازگشت به تنظیمات کانال گزارش", callback_data: "cb_report_channel" }],
                    [{ text: "🔙 بازگشت به منوی اصلی", callback_data: "cb_main_menu" }],
                  ],
                },
              });
            } else if (data === "cb_test_report_channel") {
              const reportChat = store.settings?.reportGroupConfig?.chatId;
              if (!reportChat) {
                await callTelegramBotApi(token, "answerCallbackQuery", {
                  callback_query_id: cq.id,
                  text: "⚠️ ابتدا باید کانال گزارش را تعیین فرمایید.",
                  show_alert: true,
                });
              } else {
                await callTelegramBotApi(token, "answerCallbackQuery", {
                  callback_query_id: cq.id,
                  text: "⏳ در حال ارسال پیام تست به کانال گزارش...",
                });
                const testRes = await defaultReportGroupService.testConnection(reportChat, token);
                if (testRes.success) {
                  if (store.settings.reportGroupConfig) {
                    store.settings.reportGroupConfig.status = "connected";
                    store.settings.reportGroupConfig.lastTestedAt = new Date().toISOString();
                    saveStore();
                  }
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text: `✅ <b>تست با موفقیت انجام شد:</b> پیام تستی به کانال گزارش (<code>${reportChat}</code>) ارسال گردید.`,
                    parse_mode: "HTML",
                  });
                } else {
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text: `❌ <b>خطا در ارسال پیام به کانال گزارش:</b>\n<code>${testRes.message}</code>\n\nلطفاً عضویت و دسترسی ادمین ربات را در کانال گزارش بررسی نمایید.`,
                    parse_mode: "HTML",
                  });
                }
              }
            } else if (data === "cb_backup_to_report_channel") {
              const reportChat = store.settings?.reportGroupConfig?.chatId;
              if (!reportChat) {
                await callTelegramBotApi(token, "answerCallbackQuery", {
                  callback_query_id: cq.id,
                  text: "⚠️ ابتدا کانال گزارش را تنظیم فرمایید.",
                  show_alert: true,
                });
              } else {
                await callTelegramBotApi(token, "answerCallbackQuery", {
                  callback_query_id: cq.id,
                  text: "⏳ در حال تولید فایل بک‌آپ دیتابیس (.SQL) و ارسال...",
                });
                const backupRes = await performTelegramDatabaseBackup(true, reportChat, "sql");
                if (backupRes.success) {
                  if (store.settings.reportGroupConfig) {
                    store.settings.reportGroupConfig.lastBackupAt = new Date().toISOString();
                  }
                  if (store.stats) {
                    store.stats.lastBackupTime = new Date().toISOString();
                  }
                  saveStore();
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text:
                      `✅ <b>نسخه پشتیبان کامل دیتابیس به کانال گزارش ارسال شد!</b>\n\n` +
                      `📦 فایل: <code>${backupRes.filename}</code>\n` +
                      `📢 کانال مقصد: <code>${reportChat}</code>\n` +
                      `🕒 تاریخ: <code>${getTehranDateTimeString()}</code>`,
                    parse_mode: "HTML",
                  });
                } else {
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text: `❌ <b>خطا در ارسال فایل پشتیبان به کانال گزارش:</b>\n<code>${backupRes.message}</code>`,
                    parse_mode: "HTML",
                  });
                }
              }
            } else if (data === "cb_toggle_report_backup") {
              if (!store.settings.reportGroupConfig) {
                store.settings.reportGroupConfig = {
                  chatId: "",
                  status: "not_configured",
                  alertsEnabled: true,
                  dailyDigestEnabled: true,
                  autoBackupEnabled: true,
                };
              }
              const current = store.settings.reportGroupConfig.autoBackupEnabled !== false;
              store.settings.reportGroupConfig.autoBackupEnabled = !current;
              saveStore();
              await callTelegramBotApi(token, "answerCallbackQuery", {
                callback_query_id: cq.id,
                text: `پشتیبان‌گیری خودکار ۲۴ ساعته: ${!current ? "روشن شد" : "خاموش شد"}`,
              });
              const repContent = getBotAdminReportChannelContent();
              await callTelegramBotApi(token, "editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: repContent.text,
                parse_mode: "HTML",
                reply_markup: repContent.reply_markup,
              });
            } else {
              // Always answer any unhandled callback so Telegram UI never hangs
              await callTelegramBotApi(token, "answerCallbackQuery", { callback_query_id: cq.id }).catch(() => {});
            }
          }

          // 2. Handle Text Messages & Commands
          if (update.message && update.message.text) {
            const msg = update.message;
            const fromId = msg.from?.id;
            const chatId = msg.chat?.id;
            const text = msg.text.trim();

            const isAdmin = isTelegramUserAdmin(fromId);

            // Handle Password Login: /start admin123 or /login admin123
            if (text.startsWith("/login") || text.startsWith("/start")) {
              const parts = text.split(/\s+/);
              const pass = parts[1];
              const correctPass = store.adminPasswordHash || "admin123";

              if (pass && pass === correctPass) {
                authorizeTelegramUser(fromId);
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `🎉 <b>احراز هویت موفقیت‌آمیز بود!</b>\nشناسه عددی شما (<code>${fromId}</code>) به عنوان مدیر سیستم ثبت شد.`,
                  parse_mode: "HTML",
                });
                const menu = getBotAdminMainMenuContent();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: menu.text,
                  parse_mode: "HTML",
                  reply_markup: menu.reply_markup,
                });
                continue;
              } else if (!isAdmin) {
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text:
                    `🔒 <b>پنل مدیریت ربات فوروارد</b>\n\n` +
                    `این ربات شخصی است. برای دسترسی به دکمه‌های مدیریت، لطفاً با رمز عبور لاگین کنید:\n` +
                    `<code>/login <رمز_عبور></code>\n\n` +
                    `<i>(رمز پیش‌فرض سیستم: <code>admin123</code>)</i>`,
                  parse_mode: "HTML",
                });
                continue;
              }
            }

            if (!isAdmin) {
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `🔒 <b>دسترسی غیرمجاز</b>\n` +
                  `لطفاً با دستور <code>/login <رمز_عبور></code> احراز هویت کنید.`,
                parse_mode: "HTML",
              });
              continue;
            }

            // Record last command
            if (store.settings.botAdminConfig) {
              store.settings.botAdminConfig.lastCommandReceived = text;
              store.settings.botAdminConfig.lastCommandTime = new Date().toISOString();
            }

            // Handle Cancel
            if (text === "/cancel") {
              delete botUserStates[String(fromId)];
              const menu = getBotAdminMainMenuContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: `عملیات لغو شد.\n\n` + menu.text,
                parse_mode: "HTML",
                reply_markup: menu.reply_markup,
              });
              continue;
            }

            // Handle States
            const userState = botUserStates[String(fromId)];
            if (userState && userState.state === "waiting_for_source") {
              delete botUserStates[String(fromId)];
              const cleanUser = cleanChannelIdentifier(text);

              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: `⏳ در حال بررسی و شناسایی کانال «${cleanUser}»...`,
              });

              const resolved = await resolveChannelDetails(cleanUser);
              const newSource: SourceChannel = {
                id: `src_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                title: resolved.title || `@${cleanUser}`,
                username: resolved.username || cleanUser,
                numericId: resolved.numericId,
                type: "channel",
                status: "active",
                lastCheckedAt: new Date().toISOString(),
                lastMessageId: resolved.latestPostId || 0,
                totalTransferred: 0,
                createdAt: new Date().toISOString(),
                subscriberCount: resolved.subscriberCount,
                keywords: [],
                enableKeywords: false,
                keywordMatchMode: "any",
              };

              // Check if already exists
              const exists = store.sources.some(
                (s) =>
                  s.username.toLowerCase() === newSource.username.toLowerCase() ||
                  (s.numericId && newSource.numericId && s.numericId === newSource.numericId)
              );

              if (exists) {
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `⚠️ کانال @${newSource.username} از قبل در لیست کانال‌های تحت مانیتورینگ موجود است.`,
                });
              } else {
                store.sources.push(newSource);
                saveStore();
                await initializeSourceListeners();

                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text:
                    `✅ <b>کانال با موفقیت به سیستم اضافه شد!</b>\n\n` +
                    `🏷️ <b>عنوان:</b> ${newSource.title}\n` +
                    `🔗 <b>یوزرنیم:</b> @${newSource.username}\n` +
                    `📊 <b>شناسه عددی:</b> <code>${newSource.numericId || "نامشخص"}</code>\n` +
                    `👥 <b>تعداد اعضا:</b> ${newSource.subscriberCount || "نامشخص"}\n\n` +
                    `🟢 این کانال هم‌اکنون فعال بوده و پست‌های جدید آن بلافاصله رصد و منتقل خواهند شد.`,
                  parse_mode: "HTML",
                });
              }

              const menu = getBotAdminMainMenuContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: menu.text,
                parse_mode: "HTML",
                reply_markup: menu.reply_markup,
              });
              continue;
            }

            if (userState && userState.state === "waiting_for_dest") {
              delete botUserStates[String(fromId)];
              const cleanDest = normalizeDestinationChannel(text);
              store.settings.destinationChannel = cleanDest;
              saveStore();

              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: `🎯 <b>کانال مقصد با موفقیت به «<code>${cleanDest}</code>» تغییر یافت.</b>`,
                parse_mode: "HTML",
              });

              const menu = getBotAdminMainMenuContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: menu.text,
                parse_mode: "HTML",
                reply_markup: menu.reply_markup,
              });
              continue;
            }

            if (userState && userState.state === "waiting_for_report_channel") {
              delete botUserStates[String(fromId)];
              const cleanReport = normalizeDestinationChannel(text);
              if (!store.settings.reportGroupConfig) {
                store.settings.reportGroupConfig = {
                  chatId: cleanReport,
                  status: "connected",
                  alertsEnabled: true,
                  dailyDigestEnabled: true,
                  autoBackupEnabled: true,
                  lastTestedAt: new Date().toISOString(),
                };
              } else {
                store.settings.reportGroupConfig.chatId = cleanReport;
                store.settings.reportGroupConfig.status = "connected";
                store.settings.reportGroupConfig.lastTestedAt = new Date().toISOString();
              }
              defaultReportGroupService.init(store.settings.botToken, store.settings.reportGroupConfig);
              saveStore();

              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `📢 <b>کانال گزارش و لاگ ادمین با موفقیت تنظیم شد!</b>\n\n` +
                  `🎯 <b>کانال ثبت‌شده:</b> <code>${cleanReport}</code>\n` +
                  `🔄 <b>ارسال خودکار بک‌آپ SQL ۲۴ ساعته:</b> 🟢 فعال\n\n` +
                  `<i>از این پس پیام‌های هشدار، گزارشات روزانه و فایل‌های بک‌آپ به این کانال ارسال خواهند شد.</i>`,
                parse_mode: "HTML",
              });

              const repMenu = getBotAdminReportChannelContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: repMenu.text,
                parse_mode: "HTML",
                reply_markup: repMenu.reply_markup,
              });
              continue;
            }

            if (userState && userState.state === "waiting_for_allowed_kw") {
              delete botUserStates[String(fromId)];
              if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
              const currentAllowed = store.settings.aiProcessing.allowedKeywords || [];
              const newWords = text
                .split(/[\n,،]+/)
                .map((w) => w.trim())
                .filter((w) => w.length > 0 && !currentAllowed.includes(w));

              if (newWords.length > 0) {
                store.settings.aiProcessing.allowedKeywords = [...currentAllowed, ...newWords];
                store.settings.aiProcessing.enableKeywordFilter = true;
                saveStore();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `✅ <b>تعداد ${newWords.length} کلمه مجاز جدید با موفقیت اضافه شد:</b>\n<code>${newWords.join("، ")}</code>\n\nفیلتر کلمات نیز خودکار فعال گردید.`,
                  parse_mode: "HTML",
                });
              } else {
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `⚠️ کلمه‌ای اضافه نشد (ممکن است تکراری باشد).`,
                });
              }

              const kwContent = getBotAdminAllowedKeywordsContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: kwContent.text,
                parse_mode: "HTML",
                reply_markup: kwContent.reply_markup,
              });
              continue;
            }

            if (userState && userState.state === "waiting_for_blocked_kw") {
              delete botUserStates[String(fromId)];
              if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
              const currentBlocked = store.settings.aiProcessing.blockedKeywords || [];
              const newWords = text
                .split(/[\n,،]+/)
                .map((w) => w.trim())
                .filter((w) => w.length > 0 && !currentBlocked.includes(w));

              if (newWords.length > 0) {
                store.settings.aiProcessing.blockedKeywords = [...currentBlocked, ...newWords];
                store.settings.aiProcessing.enableKeywordFilter = true;
                saveStore();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `🚫 <b>تعداد ${newWords.length} کلمه ممنوعه با موفقیت اضافه شد:</b>\n<code>${newWords.join("، ")}</code>\n\nپیام‌های شامل این کلمات به کانال مقصد ارسال نخواهند شد.`,
                  parse_mode: "HTML",
                });
              } else {
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `⚠️ کلمه‌ای اضافه نشد (ممکن است تکراری باشد).`,
                });
              }

              const blContent = getBotAdminBlockedKeywordsContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: blContent.text,
                parse_mode: "HTML",
                reply_markup: blContent.reply_markup,
              });
              continue;
            }

            if (userState && userState.state === "waiting_for_clean_rule") {
              delete botUserStates[String(fromId)];
              if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
              const currentRules = store.settings.aiProcessing.cleaningRules || [];
              const newRules = text
                .split(/[\n]+/)
                .map((r) => r.trim())
                .filter((r) => r.length > 0 && !currentRules.includes(r));

              if (newRules.length > 0) {
                store.settings.aiProcessing.cleaningRules = [...currentRules, ...newRules];
                store.settings.aiProcessing.enableContentCleaning = true;
                saveStore();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `✂️ <b>تعداد ${newRules.length} عبارت پاکسازی جدید ثبت شد:</b>\n<code>${newRules.join("\n")}</code>\n\nاین عبارات از متن تمام پیام‌ها به طور خودکار حذف می‌شوند.`,
                  parse_mode: "HTML",
                });
              } else {
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `⚠️ عبارت پاکسازی ثبت نشد.`,
                });
              }

              const clContent = getBotAdminCleanRulesContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: clContent.text,
                parse_mode: "HTML",
                reply_markup: clContent.reply_markup,
              });
              continue;
            }

            if (userState && userState.state === "waiting_for_signature") {
              delete botUserStates[String(fromId)];
              if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
              store.settings.aiProcessing.signatureText = text;
              store.settings.aiProcessing.enableMessageSignature = true;
              saveStore();

              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `✍️ <b>امضای اختصاصی با موفقیت تنظیم و فعال شد:</b>\n\n` +
                  `<pre>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>\n\n` +
                  `از این پس این امضا در انتهای تمامی پست‌های ارسالی درج خواهد شد.`,
                parse_mode: "HTML",
              });

              const sigContent = getBotAdminSignatureContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: sigContent.text,
                parse_mode: "HTML",
                reply_markup: sigContent.reply_markup,
              });
              continue;
            }

            // Command switch
            if (text === "/start" || text === "/menu" || text === "/admin") {
              const menu = getBotAdminMainMenuContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: menu.text,
                parse_mode: "HTML",
                reply_markup: menu.reply_markup,
              });
            } else if (text === "/status") {
              const status = getBotAdminStatusContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: status.text,
                parse_mode: "HTML",
                reply_markup: status.reply_markup,
              });
            } else if (text === "/pause") {
              store.isMonitoringPaused = true;
              if (store.telegramClientConfig) store.telegramClientConfig.isMonitoringPaused = true;
              saveStore();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: "⏸️ <b>مانیتورینگ کانال‌ها متوقف شد.</b>",
                parse_mode: "HTML",
              });
            } else if (text === "/resume") {
              store.isMonitoringPaused = false;
              if (store.telegramClientConfig) store.telegramClientConfig.isMonitoringPaused = false;
              saveStore();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: "🟢 <b>مانیتورینگ کانال‌ها مجدداً آغاز گردید.</b>",
                parse_mode: "HTML",
              });
            } else if (text === "/channels") {
              const channels = getBotAdminChannelsContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: channels.text,
                parse_mode: "HTML",
                reply_markup: channels.reply_markup,
              });
            } else if (text.startsWith("/add")) {
              const target = text.replace(/^\/add\s*/i, "").trim();
              if (!target) {
                botUserStates[String(fromId)] = { state: "waiting_for_source", lastActive: Date.now() };
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: "لطفاً آیدی یا لینک کانال مبدا را ارسال کنید:",
                });
              } else {
                const cleanUser = cleanChannelIdentifier(target);
                const resolved = await resolveChannelDetails(cleanUser);
                const newSource: SourceChannel = {
                  id: `src_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                  title: resolved.title || `@${cleanUser}`,
                  username: resolved.username || cleanUser,
                  numericId: resolved.numericId,
                  type: "channel",
                  status: "active",
                  lastCheckedAt: new Date().toISOString(),
                  lastMessageId: resolved.latestPostId || 0,
                  totalTransferred: 0,
                  createdAt: new Date().toISOString(),
                  subscriberCount: resolved.subscriberCount,
                  keywords: [],
                  enableKeywords: false,
                  keywordMatchMode: "any",
                };
                store.sources.push(newSource);
                saveStore();
                await initializeSourceListeners();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `✅ کانال @${newSource.username} اضافه شد.`,
                });
              }
            } else if (text.startsWith("/dest")) {
              const target = text.replace(/^\/dest\s*/i, "").trim();
              if (target) {
                const cleanDest = normalizeDestinationChannel(target);
                store.settings.destinationChannel = cleanDest;
                saveStore();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `🎯 کانال مقصد به <code>${cleanDest}</code> تغییر یافت.`,
                  parse_mode: "HTML",
                });
              }
            } else if (text === "/filters") {
              const filters = getBotAdminFiltersContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: filters.text,
                parse_mode: "HTML",
                reply_markup: filters.reply_markup,
              });
            } else if (text.startsWith("/add_kw") || text.startsWith("/addkw")) {
              const kw = text.replace(/^\/(add_kw|addkw)\s*/i, "").trim();
              if (kw) {
                if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
                const current = store.settings.aiProcessing.allowedKeywords || [];
                if (!current.includes(kw)) {
                  store.settings.aiProcessing.allowedKeywords = [...current, kw];
                  store.settings.aiProcessing.enableKeywordFilter = true;
                  saveStore();
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text: `✅ کلمه مجاز «${kw}» اضافه شد.`,
                  });
                } else {
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text: `⚠️ کلمه «${kw}» از قبل در لیست مجاز وجود دارد.`,
                  });
                }
              } else {
                botUserStates[String(fromId)] = { state: "waiting_for_allowed_kw", lastActive: Date.now() };
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: "لطفاً کلمه یا کلمات مجاز را ارسال فرمایید:",
                });
              }
            } else if (text.startsWith("/del_kw") || text.startsWith("/delkw")) {
              const kw = text.replace(/^\/(del_kw|delkw)\s*/i, "").trim();
              if (kw && store.settings.aiProcessing?.allowedKeywords) {
                store.settings.aiProcessing.allowedKeywords = store.settings.aiProcessing.allowedKeywords.filter(
                  (w) => w.toLowerCase() !== kw.toLowerCase()
                );
                saveStore();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `🗑️ کلمه «${kw}» از لیست مجاز حذف شد.`,
                });
              } else {
                const kwContent = getBotAdminAllowedKeywordsContent();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: kwContent.text,
                  parse_mode: "HTML",
                  reply_markup: kwContent.reply_markup,
                });
              }
            } else if (text.startsWith("/add_blocked") || text.startsWith("/addblocked")) {
              const kw = text.replace(/^\/(add_blocked|addblocked)\s*/i, "").trim();
              if (kw) {
                if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
                const current = store.settings.aiProcessing.blockedKeywords || [];
                if (!current.includes(kw)) {
                  store.settings.aiProcessing.blockedKeywords = [...current, kw];
                  store.settings.aiProcessing.enableKeywordFilter = true;
                  saveStore();
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text: `🚫 کلمه ممنوعه «${kw}» اضافه شد.`,
                  });
                } else {
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text: `⚠️ کلمه «${kw}» از قبل در لیست ممنوعه وجود دارد.`,
                  });
                }
              } else {
                botUserStates[String(fromId)] = { state: "waiting_for_blocked_kw", lastActive: Date.now() };
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: "لطفاً کلمه یا کلمات ممنوعه را ارسال فرمایید:",
                });
              }
            } else if (text.startsWith("/del_blocked") || text.startsWith("/delblocked")) {
              const kw = text.replace(/^\/(del_blocked|delblocked)\s*/i, "").trim();
              if (kw && store.settings.aiProcessing?.blockedKeywords) {
                store.settings.aiProcessing.blockedKeywords = store.settings.aiProcessing.blockedKeywords.filter(
                  (w) => w.toLowerCase() !== kw.toLowerCase()
                );
                saveStore();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `🗑️ کلمه «${kw}» از لیست ممنوعه حذف شد.`,
                });
              } else {
                const blContent = getBotAdminBlockedKeywordsContent();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: blContent.text,
                  parse_mode: "HTML",
                  reply_markup: blContent.reply_markup,
                });
              }
            } else if (text.startsWith("/add_clean") || text.startsWith("/addclean")) {
              const rule = text.replace(/^\/(add_clean|addclean)\s*/i, "").trim();
              if (rule) {
                if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
                const current = store.settings.aiProcessing.cleaningRules || [];
                if (!current.includes(rule)) {
                  store.settings.aiProcessing.cleaningRules = [...current, rule];
                  store.settings.aiProcessing.enableContentCleaning = true;
                  saveStore();
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text: `✂️ عبارت پاکسازی «${rule}» اضافه شد.`,
                  });
                }
              } else {
                botUserStates[String(fromId)] = { state: "waiting_for_clean_rule", lastActive: Date.now() };
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: "لطفاً عبارت متنی مورد نظر جهت پاکسازی خودکار را ارسال فرمایید:",
                });
              }
            } else if (text.startsWith("/del_clean") || text.startsWith("/delclean")) {
              const rule = text.replace(/^\/(del_clean|delclean)\s*/i, "").trim();
              if (rule && store.settings.aiProcessing?.cleaningRules) {
                store.settings.aiProcessing.cleaningRules = store.settings.aiProcessing.cleaningRules.filter(
                  (r) => r.toLowerCase() !== rule.toLowerCase()
                );
                saveStore();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `🗑️ عبارت «${rule}» از لیست پاکسازی حذف شد.`,
                });
              } else {
                const clContent = getBotAdminCleanRulesContent();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: clContent.text,
                  parse_mode: "HTML",
                  reply_markup: clContent.reply_markup,
                });
              }
            } else if (text.startsWith("/setsig") || text.startsWith("/set_sig")) {
              const sig = text.replace(/^\/(setsig|set_sig)\s*/i, "").trim();
              if (sig) {
                if (!store.settings.aiProcessing) store.settings.aiProcessing = { ...DEFAULT_AI_PROCESSING };
                store.settings.aiProcessing.signatureText = sig;
                store.settings.aiProcessing.enableMessageSignature = true;
                saveStore();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `✍️ امضای اختصاصی تنظیم و فعال گردید:\n\n<pre>${sig.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`,
                  parse_mode: "HTML",
                });
              } else {
                botUserStates[String(fromId)] = { state: "waiting_for_signature", lastActive: Date.now() };
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: "لطفاً متن امضای دلخواه خود را ارسال کنید:",
                });
              }
            } else if (text === "/test") {
              const dest = store.settings.destinationChannel;
              if (dest) {
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: dest,
                  text: `🧪 پیام تست ارسالی از تلگرام به مقصد\n🕒 زمان: <code>${getTehranDateTimeString()} (تهران +03:30)</code>`,
                  parse_mode: "HTML",
                });
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: "✅ پیام تست ارسال شد.",
                });
              }
            } else if (text === "/logs") {
              const logsContent = getBotAdminLogsContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: logsContent.text,
                parse_mode: "HTML",
                reply_markup: logsContent.reply_markup,
              });
            } else if (text === "/backup") {
              const destChannel = store.settings.destinationChannel || "تنظیم نشده";
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `📦 <b>تهیه و استخراج نسخه پشتیبان کامل دیتابیس (.SQL)</b>\n\n` +
                  `این فایل پشتیبان استاندارد شامل تمامی اطلاعات و تنظیمات حیاتی سیستم است:\n` +
                  `• تمامی <b>کانال‌های ثبت‌شده برای مانیتورینگ</b> (${store.sources.length} منبع)\n` +
                  `• تب کامل <b>پردازش هوشمند</b> (فیلتر کلمات مجاز و ممنوعه، پاکسازی و حذف لینک‌ها، امضا، قوانین رسانه، تنظیمات بازنویسی AI)\n` +
                  `• کلیه کانفیگ‌ها و اطلاعات اتصال\n\n` +
                  `📌 <b>مایلید فایل پشتیبان SQL کجا ارسال شود؟</b>`,
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "📥 ارسال به همین چت (پی‌وی مدیر)", callback_data: "cb_backup_to_chat" }],
                    [{ text: `📢 ارسال به کانال گزارش ادمین (${store.settings?.reportGroupConfig?.chatId || "تنظیم نشده"})`, callback_data: "cb_backup_to_report_channel" }],
                    [{ text: "❌ انصراف", callback_data: "cb_backup_cancel" }],
                  ],
                },
              });
            } else if (text === "/restore") {
              botUserStates[String(fromId)] = { state: "waiting_for_backup_file", lastActive: Date.now() };
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `📥 <b>بارگذاری و بازیابی نسخه پشتیبان (Restore Backup)</b>\n\n` +
                  `لطفاً فایل پشتیبان خود را (مانند <code>backup.dump</code> یا <code>backup.json</code>) به عنوان فایل (Document) در همین صفحه ارسال کنید.\n\n` +
                  `برای لغو دستور /cancel را بفرستید.`,
                parse_mode: "HTML",
              });
            } else if (text === "/stop" || text === "/off" || text === "/shutdown" || text === "/kill") {
              store.isSystemTurnedOff = true;
              defaultQueueService.setEmergencyHalt(true);
              saveStore();
              addLog(
                "system",
                "telegram_bot",
                "خاموش اضطراری (دستور متنی)",
                0,
                "config",
                "success",
                "🛑 سامانه با دستور متنی مدیر خاموش شد (مانیتورینگ و ارسال متوقف شدند)."
              );
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `🛑 <b>خاموش اضطراری: سامانه با موفقیت به طور کامل خاموش شد.</b>\n\n` +
                  `کلیه فرایندهای رصد کانال‌ها و صف ارسال پیام متوقف شدند.\n` +
                  `برای روشن کردن مجدد از دکمه منو یا دستور <code>/on</code> استفاده فرمایید.`,
                parse_mode: "HTML",
              });
            } else if (text === "/on" || text === "/start_system" || text === "/power") {
              store.isSystemTurnedOff = false;
              defaultQueueService.setEmergencyHalt(false);
              saveStore();
              addLog(
                "system",
                "telegram_bot",
                "روشن کردن سامانه (دستور متنی)",
                0,
                "config",
                "success",
                "🟢 سامانه با دستور متنی مدیر مجدداً روشن و فعال شد."
              );
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `🟢 <b>سامانه با موفقیت مجدداً روشن و فعال گردید!</b>\n\n` +
                  `رصد کانال‌ها و صف ارسال پیام با تنظیمات قبلی از سر گرفته شد.`,
                parse_mode: "HTML",
              });
            } else if (text.startsWith("/report_channel") || text.startsWith("/report")) {
              const arg = text.replace(/^\/(report_channel|report)\s*/i, "").trim();
              if (arg) {
                const cleanRep = normalizeDestinationChannel(arg);
                if (!store.settings.reportGroupConfig) {
                  store.settings.reportGroupConfig = {
                    chatId: cleanRep,
                    status: "connected",
                    alertsEnabled: true,
                    dailyDigestEnabled: true,
                    autoBackupEnabled: true,
                    lastTestedAt: new Date().toISOString(),
                  };
                } else {
                  store.settings.reportGroupConfig.chatId = cleanRep;
                  store.settings.reportGroupConfig.status = "connected";
                  store.settings.reportGroupConfig.lastTestedAt = new Date().toISOString();
                }
                defaultReportGroupService.init(store.settings.botToken, store.settings.reportGroupConfig);
                saveStore();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `📢 کانال گزارش ادمین با موفقیت به <code>${cleanRep}</code> تغییر یافت.`,
                  parse_mode: "HTML",
                });
              } else {
                const repContent = getBotAdminReportChannelContent();
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: repContent.text,
                  parse_mode: "HTML",
                  reply_markup: repContent.reply_markup,
                });
              }
            } else if (text === "/backup_now") {
              const targetChat = store.settings.reportGroupConfig?.chatId;
              if (!targetChat) {
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: "⚠️ شناسه کانال گزارش تنظیم نشده است. طبق تنظیمات، فایل‌های بک‌آپ ۲۴ ساعته و دستی فقط به کانال گزارش ارسال می‌شوند نه کانال مقصد.\nلطفاً ابتدا با دستور <code>/report_channel @your_channel</code> یا از طریق منوی شیشه‌ای، کانال گزارش را تعیین فرمایید.",
                  parse_mode: "HTML",
                });
              } else {
                await callTelegramBotApi(token, "sendMessage", {
                  chat_id: chatId,
                  text: `⏳ در حال استخراج و ارسال فایل بک‌آپ دیتابیس (.SQL) به کانال گزارش (<code>${targetChat}</code>)...`,
                  parse_mode: "HTML",
                });
                const backupRes = await performTelegramDatabaseBackup(true, targetChat, "sql");
                if (backupRes.success) {
                  if (store.settings.reportGroupConfig) {
                    store.settings.reportGroupConfig.lastBackupAt = new Date().toISOString();
                  }
                  if (store.stats) {
                    store.stats.lastBackupTime = new Date().toISOString();
                  }
                  saveStore();
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text: `✅ فایل بک‌آپ دیتابیس (<code>${backupRes.filename}</code>) با موفقیت به کانال گزارش (${targetChat}) ارسال شد.`,
                    parse_mode: "HTML",
                  });
                } else {
                  await callTelegramBotApi(token, "sendMessage", {
                    chat_id: chatId,
                    text: `❌ خطا در ارسال بک‌آپ: ${backupRes.message}`,
                  });
                }
              }
            } else if (text === "/help") {
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `📖 <b>راهنمای جامع دستورات مدیریتی ربات تلگرام</b>\n\n` +
                  `• /menu یا /start - نمایش منوی تعاملی شیشه‌ای\n` +
                  `• /status - وضعیت آنلاین و آمار زنده مانیتورینگ\n` +
                  `• /filters - مرکز تنظیمات فیلتر، پاکسازی و امضا\n` +
                  `• /report - مدیریت کانال گزارش و لاگ ادمین\n` +
                  `• /stop یا /off - خاموش کردن کامل و اضطراری سامانه\n` +
                  `• /on یا /power - روشن کردن مجدد سامانه\n` +
                  `• /backup - استخراج دستی فایل پشتیبان\n` +
                  `• /backup_now - ارسال فوری فایل پشتیبان SQL به کانال گزارش\n` +
                  `• /restore - بارگذاری و بازیابی فایل بک‌آپ\n` +
                  `• /pause - توقف موقت مانیتورینگ\n` +
                  `• /resume - شروع و فعال‌سازی مانیتورینگ\n` +
                  `• /channels - نمایش لیست و حذف کانال‌ها\n` +
                  `• /add <code>@channel</code> - افزودن سریع کانال\n` +
                  `• /dest <code>@channel</code> - تغییر کانال مقصد\n` +
                  `• /report_channel <code>@channel</code> - تنظیم کانال گزارش\n` +
                  `• /add_kw <code><کلمه></code> - افزودن کلمه مجاز\n` +
                  `• /del_kw <code><کلمه></code> - حذف کلمه مجاز\n` +
                  `• /add_blocked <code><کلمه></code> - افزودن کلمه ممنوع\n` +
                  `• /del_blocked <code><کلمه></code> - حذف کلمه ممنوع\n` +
                  `• /add_clean <code><عبارت></code> - افزودن پاکسازی متنی\n` +
                  `• /del_clean <code><عبارت></code> - حذف پاکسازی متنی\n` +
                  `• /setsig <code><متن></code> - تنظیم امضای انتهای پست\n` +
                  `• /test - ارسال پیام تست به مقصد\n` +
                  `• /logs - مشاهده آخرین لاگ‌های سیستم\n` +
                  `• /login <code><رمز></code> - ورود ادمین`,
                parse_mode: "HTML",
              });
            }
          }

          // 3. Handle Document Uploads (e.g. backup.dump, .json, .sql)
          if (update.message && update.message.document) {
            const msg = update.message;
            const fromId = msg.from?.id;
            const chatId = msg.chat?.id;
            const doc = msg.document;

            const isAdmin = isTelegramUserAdmin(fromId);
            if (!isAdmin) {
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: "🔒 دسترسی غیرمجاز. لطفاً ابتدا با دستور /login <رمز> وارد شوید.",
              });
              continue;
            }

            const fileName = (doc.file_name || "").toLowerCase();
            const isBackupFile =
              fileName.endsWith(".dump") ||
              fileName.endsWith(".json") ||
              fileName.endsWith(".sql") ||
              fileName.includes("backup");

            if (!isBackupFile) {
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: `⚠️ فرمت فایل نامعتبر است. لطفاً فایل پشتیبان با پسوند <code>.dump</code> یا <code>.json</code> ارسال فرمایید.`,
                parse_mode: "HTML",
              });
              continue;
            }

            await callTelegramBotApi(token, "sendMessage", {
              chat_id: chatId,
              text: `⏳ دریافت فایل <code>${doc.file_name}</code>... در حال اعتبارسنجی و بازیابی اطلاعات...`,
              parse_mode: "HTML",
            });

            try {
              const fileInfo = await callTelegramBotApi(token, "getFile", { file_id: doc.file_id });
              if (!fileInfo.ok || !fileInfo.result?.file_path) {
                throw new Error("امکان دانلود فایل از تلگرام مقدور نیست.");
              }

              const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`;
              const fileRes = await fetch(downloadUrl);
              if (!fileRes.ok) throw new Error("خطا در دریافت محتوای فایل از سرور تلگرام.");

              const rawContent = await fileRes.text();
              let dataToImport: any = null;

              if (fileName.endsWith(".sql")) {
                let sqlApplied = false;
                if (pool && isDbConnected) {
                  try {
                    await pool.query(rawContent);
                    sqlApplied = true;
                    const refreshed = await getStoreFromDb();
                    if (refreshed) {
                      store = { ...store, ...refreshed };
                      saveStore();
                    }
                  } catch (sqlErr: any) {
                    console.warn("[RESTORE SQL DB EXECUTION WARN]:", sqlErr?.message);
                  }
                }

                // Check for embedded METADATA_PAYLOAD in SQL comment
                const metaMatch = rawContent.match(/--\s*METADATA_PAYLOAD:\s*([A-Za-z0-9+/=]+)/);
                if (metaMatch && metaMatch[1]) {
                  try {
                    const decodedJson = Buffer.from(metaMatch[1], "base64").toString("utf-8");
                    const parsed = JSON.parse(decodedJson);
                    dataToImport = parsed.storeData || parsed.store || parsed;
                    if (dataToImport) {
                      await importDatabaseData(dataToImport);
                      if (dataToImport.settings) {
                        store.settings = { ...store.settings, ...dataToImport.settings };
                      }
                      if (Array.isArray(dataToImport.sources)) {
                        store.sources = dataToImport.sources;
                      }
                      if (dataToImport.telegramClientConfig) {
                        store.telegramClientConfig = { ...store.telegramClientConfig, ...dataToImport.telegramClientConfig };
                      }
                      if (dataToImport.telegramSession) {
                        store.telegramSession = dataToImport.telegramSession;
                      }
                      if (dataToImport.stats) {
                        store.stats = { ...store.stats, ...dataToImport.stats };
                      }
                      saveStore();
                      await initializeSourceListeners();
                    }
                  } catch (metaErr: any) {
                    console.warn("[RESTORE SQL METADATA WARN]:", metaErr?.message);
                  }
                } else if (!sqlApplied) {
                  throw new Error("فایل SQL فاقد اطلاعات ساختاری لازم برای بازنشانی است.");
                }
              } else {
                const parsed = JSON.parse(rawContent);
                dataToImport = parsed.storeData || parsed.store || parsed;
                if (!dataToImport || typeof dataToImport !== "object") {
                  throw new Error("فرمت ساختاری فایل بک‌آپ نامعتبر است.");
                }

                await importDatabaseData(dataToImport);

                if (dataToImport.settings) {
                  store.settings = { ...store.settings, ...dataToImport.settings };
                }
                if (Array.isArray(dataToImport.sources)) {
                  store.sources = dataToImport.sources;
                }
                if (dataToImport.telegramClientConfig) {
                  store.telegramClientConfig = { ...store.telegramClientConfig, ...dataToImport.telegramClientConfig };
                }
                if (dataToImport.telegramSession) {
                  store.telegramSession = dataToImport.telegramSession;
                }
                if (dataToImport.stats) {
                  store.stats = { ...store.stats, ...dataToImport.stats };
                }
                saveStore();
                await initializeSourceListeners();
              }

              delete botUserStates[String(fromId)];

              addLog(
                "system",
                "system",
                "بازیابی بک‌آپ از تلگرام",
                0,
                "restore",
                "success",
                `فایل ${doc.file_name} توسط ادمین در تلگرام با موفقیت بازیابی شد.`
              );

              const activeCount = store.sources ? store.sources.filter((s) => s.status === "active").length : 0;
              const dest = store.settings?.destinationChannel || "تنظیم نشده";

              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text:
                  `🎉 <b>بازیابی اطلاعات با موفقیت کامل انجام شد!</b>\n\n` +
                  `📦 نام فایل: <code>${doc.file_name}</code>\n` +
                  `📡 کانال‌های تحت رصد: <b>${activeCount}</b> کانال فعال\n` +
                  `🎯 کانال یا گروه مقصد: <code>${dest}</code>\n` +
                  `🗄️ وضعیت ذخیره‌سازی: <b>${isDbConnected ? "PostgreSQL همگام شد" : "دیتابیس محلی به‌روزرسانی شد"}</b>\n\n` +
                  `🟢 سیستم بلافاصله مانیتورینگ خودکار پیام‌ها را ادامه می‌دهد.`,
                parse_mode: "HTML",
              });

              const menu = getBotAdminMainMenuContent();
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: menu.text,
                parse_mode: "HTML",
                reply_markup: menu.reply_markup,
              });
            } catch (err: any) {
              await callTelegramBotApi(token, "sendMessage", {
                chat_id: chatId,
                text: `❌ <b>خطا در بازیابی نسخه پشتیبان:</b>\n<code>${err.message || "خطای ناشناخته"}</code>`,
                parse_mode: "HTML",
              });
            }
          }
        } catch (updateErr: any) {
          console.error("[BOT UPDATE ERROR]", updateErr?.message || updateErr);
        }
      }
      if (updatesRes.result.length > 0) {
        saveStore();
      }
    }
  } catch (err: any) {
      // Catch silently to keep poller healthy
    } finally {
      isBotPollerRunning = false;
    }
  }

  // Run Telegram Bot Poller every 3 seconds
  setInterval(() => {
    pollTelegramBotUpdates().catch(() => {});
  }, 3000);

  // --- API Endpoints for Dashboard In-Bot Admin ---

  // Get In-Bot Admin Config & Status
  app.get("/api/bot-admin/config", (req, res) => {
    const isClientConn = gramStatus === "connected" || !!store.telegramClientConfig?.isConnected;
    res.json({
      success: true,
      botAdminConfig: store.settings.botAdminConfig || {
        adminTelegramUserId: "",
        adminPasscode: "admin123",
        enableInBotAdmin: true,
        autoAuthorizedUsers: [],
        isBotPollingActive: isBotPollerRunning,
      },
      botUsername: store.settings?.botInfo?.username || "",
      destinationChannel: store.settings?.destinationChannel || "",
      isVerified: !!store.settings?.isVerified,
      isMonitoringPaused: !!store.isMonitoringPaused,
      isClientConnected: isClientConn,
      sourcesCount: store.sources?.length || 0,
      activeSourcesCount: store.sources ? store.sources.filter((s) => s.status === "active").length : 0,
      totalTransferred: store.stats?.totalTransferred || 0,
    });
  });

  // Save In-Bot Admin Config
  app.post("/api/bot-admin/config", (req, res) => {
    const { adminTelegramUserId, adminPasscode, enableInBotAdmin } = req.body;

    if (!store.settings.botAdminConfig) {
      store.settings.botAdminConfig = {
        adminTelegramUserId: adminTelegramUserId || "",
        adminPasscode: adminPasscode || "admin123",
        enableInBotAdmin: enableInBotAdmin !== false,
        autoAuthorizedUsers: adminTelegramUserId ? [String(adminTelegramUserId)] : [],
        isBotPollingActive: true,
      };
    } else {
      if (adminTelegramUserId !== undefined) {
        store.settings.botAdminConfig.adminTelegramUserId = String(adminTelegramUserId).trim();
        if (adminTelegramUserId && !store.settings.botAdminConfig.autoAuthorizedUsers?.includes(String(adminTelegramUserId))) {
          store.settings.botAdminConfig.autoAuthorizedUsers = [
            ...(store.settings.botAdminConfig.autoAuthorizedUsers || []),
            String(adminTelegramUserId).trim(),
          ];
        }
      }
      if (adminPasscode !== undefined) {
        store.settings.botAdminConfig.adminPasscode = String(adminPasscode).trim();
      }
      if (enableInBotAdmin !== undefined) {
        store.settings.botAdminConfig.enableInBotAdmin = !!enableInBotAdmin;
      }
    }

    saveStore();

    res.json({
      success: true,
      message: "تنظیمات مدیریت از داخل ربات تلگرام با موفقیت ذخیره شد.",
      botAdminConfig: store.settings.botAdminConfig,
    });
  });

  // Send Test Push & Menu to Admin Telegram Account
  app.post("/api/bot-admin/send-test-to-admin", async (req, res) => {
    const targetUserId = req.body.adminTelegramUserId || store.settings.botAdminConfig?.adminTelegramUserId;
    const token = store.settings.botToken;

    if (!token) {
      return res.status(400).json({ success: false, message: "توکن ربات تلگرام ثبت نشده است." });
    }
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "شناسه عددی اکانت تلگرام مدیر مشخص نشده است." });
    }

    try {
      const menu = getBotAdminMainMenuContent();
      const sendRes = await callTelegramBotApi(token, "sendMessage", {
        chat_id: targetUserId,
        text: `🔔 <b>پیام تست از داشبورد مدیریت وب به ادمین</b>\n\n` + menu.text,
        parse_mode: "HTML",
        reply_markup: menu.reply_markup,
      });

      if (sendRes.ok) {
        res.json({
          success: true,
          message: "پنل تعاملی ربات با موفقیت به پیوی تلگرام شما ارسال شد!",
        });
      } else {
        res.status(400).json({
          success: false,
          message: `خطا در ارسال پیام به تلگرام: ${sendRes.description || "مطمئن شوید ربات را در تلگرام استارت کرده‌اید"}`,
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: `خطای سرور: ${err.message}` });
    }
  });

  // Simulator for Web UI Preview (executes or previews actions interactively)
  app.post("/api/bot-admin/simulate", async (req, res) => {
    const { action, payload } = req.body;

    try {
      if (action === "menu") {
        const menu = getBotAdminMainMenuContent();
        return res.json({ success: true, ...menu });
      } else if (action === "status") {
        const status = getBotAdminStatusContent();
        return res.json({ success: true, ...status });
      } else if (action === "toggle_power") {
        store.isSystemTurnedOff = !store.isSystemTurnedOff;
        defaultQueueService.setEmergencyHalt(!!store.isSystemTurnedOff);
        saveStore();
        addLog(
          "system",
          "system",
          "کلید اضطراری شبیه‌ساز",
          0,
          "config",
          "success",
          store.isSystemTurnedOff ? "🛑 خاموش کردن اضطراری کل سامانه" : "🟢 روشن‌سازی مجدد سامانه"
        );
        const menu = getBotAdminMainMenuContent();
        return res.json({
          success: true,
          alert: store.isSystemTurnedOff
            ? "🛑 سامانه خاموش شد (کلیه ارسال‌ها و مانیتورینگ متوقف شدند)"
            : "🟢 سامانه مجدداً روشن و فعال شد",
          isSystemTurnedOff: !!store.isSystemTurnedOff,
          ...menu,
        });
      } else if (action === "toggle_pause") {
        store.isMonitoringPaused = !store.isMonitoringPaused;
        if (store.telegramClientConfig) store.telegramClientConfig.isMonitoringPaused = store.isMonitoringPaused;
        saveStore();
        const menu = getBotAdminMainMenuContent();
        return res.json({
          success: true,
          alert: store.isMonitoringPaused ? "⏸️ مانیتورینگ متوقف شد" : "🟢 مانیتورینگ فعال شد",
          ...menu,
        });
      } else if (action === "report_channel") {
        const reportChat = store.settings?.reportGroupConfig?.chatId || "تنظیم‌نشده";
        const autoBackup = store.settings?.reportGroupConfig?.autoBackupEnabled !== false;
        const lastBackup = store.settings?.reportGroupConfig?.lastBackupAt
          ? new Date(store.settings.reportGroupConfig.lastBackupAt).toLocaleString("fa-IR")
          : "هنوز ارسال نشده";

        const text =
          `📢 <b>مدیریت کانال و گروه گزارش ادمین</b>\n\n` +
          `• <b>شناسه کانال گزارش:</b> <code>${reportChat}</code>\n` +
          `• <b>بک‌آپ خودکار ۲۴ ساعته:</b> ${autoBackup ? "🟢 فعال (هر شب ساعت 00:00)" : "🔴 غیرفعال"}\n` +
          `• <b>آخرین ارسال بک‌آپ:</b> ${lastBackup}\n\n` +
          `<i>جهت تغییر شناسه یا ارسال فوری بک‌آپ، از دکمه‌های زیر استفاده کنید:</i>`;

        const reply_markup = {
          inline_keyboard: [
            [
              { text: "✏️ تغییر کانال گزارش", callback_data: "cb_change_report_channel" },
              { text: "🧪 تست ارسال پیام به گزارش", callback_data: "cb_test_report_channel" },
            ],
            [
              { text: "📤 ارسال فوری فایل بک‌آپ دیتابیس", callback_data: "cb_backup_to_report_channel" },
              {
                text: autoBackup ? "🔴 غیرفعال‌سازی بک‌آپ خودکار" : "🟢 فعال‌سازی بک‌آپ خودکار",
                callback_data: "cb_toggle_report_backup",
              },
            ],
            [{ text: "🔙 بازگشت به منوی اصلی", callback_data: "cb_main_menu" }],
          ],
        };
        return res.json({ success: true, text, reply_markup });
      } else if (action === "change_report_channel") {
        const input = payload?.channelId;
        if (!input) {
          return res.json({
            success: true,
            text:
              `✏️ <b>تنظیم کانال / گروه ارسال گزارش:</b>\n\n` +
              `شناسه فعلی: <code>${store.settings?.reportGroupConfig?.chatId || "تنظیم‌نشده"}</code>\n\n` +
              `لطفاً آیدی عددی چت یا گروه گزارش (مانند <code>-1001234567890</code> یا <code>@my_channel</code>) را در کادر زیر وارد کنید:`,
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 بازگشت به تنظیمات گزارش", callback_data: "cb_report_channel" }],
                [{ text: "🔙 بازگشت به منوی اصلی", callback_data: "cb_main_menu" }],
              ],
            },
          });
        }

        const cleanChatId = String(input).trim();
        if (!store.settings.reportGroupConfig) {
          store.settings.reportGroupConfig = {
            chatId: cleanChatId,
            status: "connected",
            alertsEnabled: true,
            dailyDigestEnabled: true,
            autoBackupEnabled: true,
          };
        } else {
          store.settings.reportGroupConfig.chatId = cleanChatId;
          store.settings.reportGroupConfig.status = "connected";
        }
        defaultReportGroupService.init(store.settings.botToken, store.settings.reportGroupConfig);
        saveStore();

        return res.json({
          success: true,
          alert: `کانال گزارش با موفقیت به ${cleanChatId} تغییر یافت.`,
          text: `✅ <b>کانال گزارش با موفقیت ذخیره شد:</b> <code>${cleanChatId}</code>`,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🧪 تست اتصال", callback_data: "cb_test_report_channel" }],
              [{ text: "🔙 منوی گزارش", callback_data: "cb_report_channel" }],
            ],
          },
        });
      } else if (action === "test_report_channel") {
        const reportChat = store.settings?.reportGroupConfig?.chatId;
        const token = store.settings.botToken;
        if (!reportChat) {
          return res.json({ success: true, alert: "⚠️ هنوز شناسه کانال گزارش تعیین نشده است." });
        }
        if (!token) {
          return res.json({ success: true, alert: "⚠️ توکن ربات تلگرام تنظیم نشده است." });
        }
        const testRes = await defaultReportGroupService.testConnection(reportChat, token);
        return res.json({
          success: true,
          alert: testRes.success ? "✅ پیام آزمایشی به کانال گزارش ارسال گردید." : `❌ خطا: ${testRes.message}`,
        });
      } else if (action === "backup_to_report_channel") {
        const reportChat = store.settings?.reportGroupConfig?.chatId;
        if (!reportChat) {
          return res.json({ success: true, alert: "⚠️ لطفاً ابتدا کانال گزارش را تعیین کنید." });
        }
        const backupRes = await performTelegramDatabaseBackup(true, reportChat, "sql");
        if (backupRes.success) {
          if (store.settings.reportGroupConfig) {
            store.settings.reportGroupConfig.lastBackupAt = new Date().toISOString();
          }
          if (store.stats) {
            store.stats.lastBackupTime = new Date().toISOString();
          }
          saveStore();
          return res.json({
            success: true,
            alert: `✅ نسخه پشتیبان دیتابیس (${backupRes.filename}) به کانال گزارش ارسال شد.`,
          });
        } else {
          return res.json({ success: true, alert: `❌ خطا در ارسال بک‌آپ: ${backupRes.message}` });
        }
      } else if (action === "toggle_report_backup") {
        if (!store.settings.reportGroupConfig) {
          store.settings.reportGroupConfig = {
            chatId: "",
            status: "not_configured",
            alertsEnabled: true,
            dailyDigestEnabled: true,
            autoBackupEnabled: true,
          };
        }
        store.settings.reportGroupConfig.autoBackupEnabled = !store.settings.reportGroupConfig.autoBackupEnabled;
        saveStore();
        const newState = store.settings.reportGroupConfig.autoBackupEnabled;
        return res.json({
          success: true,
          alert: newState ? "🟢 بک‌آپ خودکار ۲۴ ساعته فعال شد" : "🔴 بک‌آپ خودکار ۲۴ ساعته غیرفعال شد",
        });
      } else if (action === "change_dest") {
        const input = payload?.dest;
        if (!input) {
          return res.json({
            success: true,
            text:
              `🎯 <b>تغییر کانال مقصد:</b>\n\n` +
              `کانال مقصد فعلی: <code>${store.settings.destinationChannel || "تنظیم نشده"}</code>\n\n` +
              `جهت تغییر، آیدی کانال یا گروه مقصد را در کادر زیر وارد کنید (مانند @my_channel یا -1001234567890):`,
            reply_markup: {
              inline_keyboard: [[{ text: "🔙 بازگشت به منوی اصلی", callback_data: "cb_main_menu" }]],
            },
          });
        }
        const cleanDest = input.trim();
        store.settings.destinationChannel = cleanDest;
        saveStore();
        return res.json({
          success: true,
          alert: `کانال مقصد به ${cleanDest} تغییر کرد.`,
          text: `✅ <b>کانال مقصد جدید با موفقیت ذخیره شد:</b> <code>${cleanDest}</code>`,
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 منوی اصلی", callback_data: "cb_main_menu" }]],
          },
        });
      } else if (action === "channels") {
        const channels = getBotAdminChannelsContent();
        return res.json({ success: true, ...channels });
      } else if (action === "del_channel") {
        const srcId = payload?.sourceId;
        if (srcId) {
          store.sources = store.sources.filter((s) => s.id !== srcId);
          monitoredSourcesMap.delete(srcId);
          saveStore();
        }
        const channels = getBotAdminChannelsContent();
        return res.json({ success: true, alert: "کانال با موفقیت حذف شد.", ...channels });
      } else if (action === "add_channel") {
        const input = payload?.channel;
        if (!input) {
          return res.json({
            success: true,
            text: "✍️ لطفاً آیدی یا لینک کانال مبدا را ارسال کنید:\n(مثال: @varzesh3)",
            reply_markup: { inline_keyboard: [[{ text: "🔙 بازگشت به منو", callback_data: "cb_main_menu" }]] },
          });
        }
        const cleanUser = cleanChannelIdentifier(input);
        const resolved = await resolveChannelDetails(cleanUser);
        const newSource: SourceChannel = {
          id: `src_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          title: resolved.title || `@${cleanUser}`,
          username: resolved.username || cleanUser,
          numericId: resolved.numericId,
          type: "channel",
          status: "active",
          lastCheckedAt: new Date().toISOString(),
          lastMessageId: resolved.latestPostId || 0,
          totalTransferred: 0,
          createdAt: new Date().toISOString(),
          subscriberCount: resolved.subscriberCount,
          keywords: [],
          enableKeywords: false,
          keywordMatchMode: "any",
        };
        store.sources.push(newSource);
        saveStore();
        await initializeSourceListeners();
        const menu = getBotAdminMainMenuContent();
        return res.json({
          success: true,
          alert: `کانال @${newSource.username} اضافه شد!`,
          text: `✅ <b>کانال «${newSource.title}» با موفقیت اضافه شد.</b>\n\n` + menu.text,
          reply_markup: menu.reply_markup,
        });
      } else if (action === "filters") {
        const filters = getBotAdminFiltersContent();
        return res.json({ success: true, ...filters });
      } else if (action === "logs") {
        const logs = getBotAdminLogsContent();
        return res.json({ success: true, ...logs });
      } else if (action === "test_msg") {
        const dest = store.settings.destinationChannel;
        const token = store.settings.botToken;
        let testResult = "⚠️ کانال مقصد تنظیم نشده است.";
        if (dest && token) {
          const r = await callTelegramBotApi(token, "sendMessage", {
            chat_id: dest,
            text: `🧪 پیام تست ارسالی از شبیه‌ساز مدیریت (${getTehranDateTimeString()})`,
          });
          testResult = r.ok ? `✅ پیام تست به ${dest} ارسال شد.` : `❌ خطا: ${r.description}`;
        }
        return res.json({ success: true, alert: testResult });
      }

      const menu = getBotAdminMainMenuContent();
      return res.json({ success: true, ...menu });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Vite Integration for Dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] HTTP server running on port ${PORT}`);
  });
}

startServer();
