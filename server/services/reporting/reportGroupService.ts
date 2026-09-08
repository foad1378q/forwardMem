import fetch from "node-fetch";

export interface ReportAlertOptions {
  type: 'client_disconnect' | 'session_expired' | 'flood_wait' | 'queue_error' | 'database_error' | 'info' | 'warning';
  title: string;
  details: string;
  level?: 'info' | 'warning' | 'critical';
  extraFields?: Record<string, string | number>;
}

export interface DailyDigestData {
  persianDate: string;
  tehranTime: string;
  totalReceived: number;
  totalFiltered: number;
  totalSent: number;
  totalFailed: number;
  queuePending: number;
  queueScheduled: number;
  queueFailed: number;
  clientStatus: string;
  botStatus: string;
  dbStatus: string;
  uptimeFormatted: string;
}

// Security Masking: never allow tokens, api hashes, session strings, or passwords to leak in messages
export function maskSensitiveData(input: string): string {
  if (!input) return '';
  return input
    .replace(/(?:bot)?([0-9]{8,10}:[a-zA-Z0-9_-]{35})/gi, 'BOT_TOKEN_PROTECTED')
    .replace(/([a-f0-9]{32})/gi, (match) => {
      // If it looks like an md5 / api_hash, mask middle characters
      return match.length === 32 ? `${match.slice(0, 4)}••••••••${match.slice(-4)}` : match;
    })
    .replace(/(?:postgres(?:ql)?:\/\/[^:]+:)([^@]+)(?:@)/gi, 'postgres://user:••••••••@')
    .replace(/(?:1[A-Za-z0-9+/=]{100,})/g, 'SESSION_STRING_PROTECTED');
}

// Helper to normalize destination channel format (@channel or -100...)
export function normalizeReportChannelId(dest: string | null | undefined): string {
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

export class ReportGroupService {
  private reportChatId: string = '';
  private botToken: string = '';
  private alertsEnabled: boolean = true;
  private lastAlertTimestamp: Record<string, number> = {};
  private alertThrottleSeconds: number = 30; // Debounce duplicate alerts

  public configure(reportChatId: string, botToken: string, alertsEnabled = true) {
    this.reportChatId = normalizeReportChannelId(reportChatId);
    this.botToken = (botToken || '').trim();
    this.alertsEnabled = alertsEnabled;
  }

  public init(botToken?: string, config?: { chatId?: string; alertsEnabled?: boolean }) {
    if (config?.chatId && botToken) {
      this.configure(config.chatId, botToken, config.alertsEnabled !== false);
    }
  }

  public getReportChatId(): string {
    return this.reportChatId;
  }

  public isConfigured(): boolean {
    return Boolean(this.reportChatId && this.botToken);
  }

  /**
   * Sends an alert to the Admin Report Channel.
   * Strictly isolated: never sends to destination or source channels!
   */
  public async sendAlert(options: ReportAlertOptions): Promise<{ success: boolean; message?: string }> {
    if (!this.isConfigured() || !this.alertsEnabled) {
      return { success: false, message: 'Report channel is not configured or alerts are disabled.' };
    }

    // Rate-limit identical alerts within throttle window
    const now = Date.now();
    const alertKey = `${options.type}:${options.title}`;
    const lastSent = this.lastAlertTimestamp[alertKey] || 0;
    if (now - lastSent < this.alertThrottleSeconds * 1000) {
      return { success: false, message: 'Alert throttled' };
    }
    this.lastAlertTimestamp[alertKey] = now;

    const emojiHeader =
      options.level === 'critical' ? '🚨' :
      options.level === 'warning' ? '⚠️' : 'ℹ️';

    const levelText =
      options.level === 'critical' ? 'بحرانی' :
      options.level === 'warning' ? 'اخطار' : 'اطلاعیه';

    const safeTitle = maskSensitiveData(options.title);
    const safeDetails = maskSensitiveData(options.details);

    let tehranTimeStr = '';
    try {
      tehranTimeStr = new Date().toLocaleString('fa-IR', {
        timeZone: 'Asia/Tehran',
        dateStyle: 'short',
        timeStyle: 'medium',
      });
    } catch {
      tehranTimeStr = new Date().toISOString();
    }

    let messageText = `${emojiHeader} <b>هشدار سامانه — ${levelText}</b>\n`;
    messageText += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    messageText += `📌 <b>موضوع:</b> ${safeTitle}\n`;
    messageText += `🕒 <b>زمان (تهران):</b> <code>${tehranTimeStr}</code>\n\n`;
    messageText += `📋 <b>جزئیات:</b>\n${safeDetails}\n`;

    if (options.extraFields && Object.keys(options.extraFields).length > 0) {
      messageText += `\n📊 <b>اطلاعات تکمیلی:</b>\n`;
      for (const [k, v] of Object.entries(options.extraFields)) {
        messageText += `• <b>${k}:</b> <code>${maskSensitiveData(String(v))}</code>\n`;
      }
    }

    messageText += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    messageText += `🤖 <i>کانال اختصاصی گزارش و لاگ ادمین</i>`;

    return await this.sendTelegramHtml(this.reportChatId, messageText);
  }

  /**
   * Sends the Daily Digest summary at 00:00 Tehran Time
   */
  public async sendDailyDigest(data: DailyDigestData): Promise<{ success: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'Report channel is not configured.' };
    }

    let text = `📊 <b>گزارش تجمیعی روزانه سامانه (Daily Digest)</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📅 <b>تاریخ:</b> ${data.persianDate}\n`;
    text += `🕒 <b>زمان ارسال:</b> ${data.tehranTime}\n`;
    text += `⏱ <b>مدت زمان آنلاین (Uptime):</b> ${data.uptimeFormatted}\n\n`;

    text += `📈 <b>آمار پیام‌های ۲۴ ساعت گذشته:</b>\n`;
    text += `• 📥 دریافتی از سورس‌ها: <b>${data.totalReceived.toLocaleString('fa-IR')}</b>\n`;
    text += `• 🔍 فیلتر و مسدود شده: <b>${data.totalFiltered.toLocaleString('fa-IR')}</b>\n`;
    text += `• ✅ ارسال شده به مقصد: <b>${data.totalSent.toLocaleString('fa-IR')}</b>\n`;
    text += `• ❌ ناموفق / خطا: <b>${data.totalFailed.toLocaleString('fa-IR')}</b>\n\n`;

    text += `📋 <b>وضعیت لحظه‌ای صف پیام‌ها:</b>\n`;
    text += `• ⏳ در انتظار زمان‌بندی: <b>${data.queuePending.toLocaleString('fa-IR')}</b>\n`;
    text += `• 🕒 زمان‌بندی شده: <b>${data.queueScheduled.toLocaleString('fa-IR')}</b>\n`;
    text += `• ⚠️ خطادار در صف: <b>${data.queueFailed.toLocaleString('fa-IR')}</b>\n\n`;

    text += `🩺 <b>وضعیت سلامت زیرساخت:</b>\n`;
    text += `• Telegram Client (حساب شخصی): ${data.clientStatus}\n`;
    text += `• Telegram Bot (ربات ناشر): ${data.botStatus}\n`;
    text += `• پایگاه داده (Database): ${data.dbStatus}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🛡 <i>کانال گزارش و مانیتورینگ ادمین</i>`;

    return await this.sendTelegramHtml(this.reportChatId, text);
  }

  /**
   * Sends database backup document directly to the Admin Report Channel
   */
  public async sendBackupDocument(
    buffer: Buffer,
    filename: string,
    caption?: string
  ): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'کانال گزارش ادمین تنظیم نشده است.' };
    }

    try {
      const formData = new FormData();
      formData.append('chat_id', this.reportChatId);
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }
      formData.append('document', new Blob([buffer]), filename);

      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      const data: any = await res.json();
      if (data.ok) {
        return { success: true, message: '✅ فایل پشتیبان با موفقیت به کانال گزارش ارسال شد.' };
      } else {
        const desc = data.description || 'خطا در ارسال فایل به تلگرام';
        return { success: false, message: `❌ ارسال فایل ناموفق بود: ${desc}` };
      }
    } catch (err: any) {
      return { success: false, message: `❌ خطای شبکه در آپلود بک‌آپ: ${err.message}` };
    }
  }

  /**
   * Tests connection to the Admin Report Channel
   */
  public async testConnection(chatId: string, customBotToken?: string): Promise<{ success: boolean; message: string }> {
    const token = (customBotToken || this.botToken || '').trim();
    const targetChat = normalizeReportChannelId(chatId || this.reportChatId);

    if (!token) {
      return { success: false, message: 'توکن ربات تلگرام تنظیم نشده است.' };
    }
    if (!targetChat) {
      return { success: false, message: 'شناسه یا یوزرنیم کانال گزارش وارد نشده است.' };
    }

    let tehranTime = '';
    try {
      tehranTime = new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' });
    } catch {
      tehranTime = new Date().toISOString();
    }

    const testMsg = `📢 <b>تست اتصال کانال گزارش و لاگ ادمین</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ ارتباط ربات با کانال گزارش با موفقیت برقرار است.\n` +
      `🕒 تاریخ و ساعت: <code>${tehranTime}</code>\n` +
      `🛡 تمام گزارش‌های قطعی، خطاها، FloodWait، آمار روزانه و فایل‌های بک‌آپ خودکار ۲۴ ساعته به این کانال ارسال خواهند شد.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━`;

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChat,
          text: testMsg,
          parse_mode: 'HTML',
        }),
      });

      const data: any = await res.json();
      if (data.ok) {
        this.reportChatId = targetChat;
        return { success: true, message: '✅ پیام تستی با موفقیت به کانال گزارش ارسال گردید.' };
      } else {
        const desc = data.description || 'خطای نامشخص از تلگرام';
        if (desc.includes('chat not found')) {
          return { success: false, message: '❌ کانال یافت نشد. اطمینان حاصل کنید آیدی/یوزرنیم کانال صحیح است و ربات در کانال عضو شده است.' };
        }
        if (desc.includes('bot is not a member') || desc.includes('chat_admin_required') || desc.includes('have no rights to send a message')) {
          return { success: false, message: '❌ ربات به عنوان مدیر (Admin) در کانال گزارش عضو نیست یا دسترسی ارسال پیام (Post Messages) را ندارد.' };
        }
        return { success: false, message: `❌ خطای تلگرام: ${desc}` };
      }
    } catch (err: any) {
      return { success: false, message: `❌ خطای شبکه در ارسال پیام: ${err.message}` };
    }
  }

  private async sendTelegramHtml(chatId: string, text: string): Promise<{ success: boolean; message?: string }> {
    if (!this.botToken || !chatId) {
      return { success: false, message: 'Bot token or Chat ID is missing' };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const result: any = await res.json();
      if (!result.ok) {
        console.warn(`[REPORT GROUP] Failed to send alert:`, result.description);
        return { success: false, message: result.description };
      }
      return { success: true };
    } catch (err: any) {
      console.warn(`[REPORT GROUP] Exception sending alert:`, err.message);
      return { success: false, message: err.message };
    }
  }
}

export const defaultReportGroupService = new ReportGroupService();
