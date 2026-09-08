import {
  addQueueItemToDb,
  getQueueItemsFromDb,
  updateQueueItemInDb,
  clearFailedQueueItemsFromDb,
  retryFailedQueueItemsInDb,
  deleteQueueItemFromDb,
  getQueueStatsFromDb,
} from "../../../src/db/db";
import { defaultReportGroupService } from "../reporting/reportGroupService";

export interface QueueSettings {
  minDelaySeconds: number; // default 10
  maxDelaySeconds: number; // default 45
  silentHoursEnabled: boolean; // default false
  silentHoursStart: string; // "23:00"
  silentHoursEnd: string; // "07:00"
  minIntervalSeconds: number; // default 5
  maxMessagesPerMinute: number; // default 12
  isQueuePaused: boolean; // default false
}

export type QueueItemStatus = 'pending' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface QueueItem {
  id: string;
  sourceChannelId: string;
  sourceChannelUsername?: string;
  sourceChannelTitle?: string;
  destinationChannelId: string;
  originalMessageId: number;
  messageText?: string;
  formattedText?: string;
  mediaType?: string;
  mediaFileId?: string;
  mediaMetadata?: any;
  status: QueueItemStatus;
  scheduledTime: string; // ISO string
  sentAt?: string;
  attemptsCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_QUEUE_SETTINGS: QueueSettings = {
  minDelaySeconds: 10,
  maxDelaySeconds: 45,
  silentHoursEnabled: false,
  silentHoursStart: "23:00",
  silentHoursEnd: "07:00",
  minIntervalSeconds: 5,
  maxMessagesPerMinute: 12,
  isQueuePaused: false,
};

export class QueueService {
  private settings: QueueSettings = { ...DEFAULT_QUEUE_SETTINGS };
  private inMemoryQueue: Map<string, QueueItem> = new Map();
  private isWorkerRunning: boolean = false;
  private isProcessingItem: boolean = false;
  private isEmergencyHalted: boolean = false;
  private lastSendTimestamp: number = 0;
  private sendTimestampsInLastMinute: number[] = [];
  private floodWaitUntil: number = 0;
  private consecutiveFailuresCount: number = 0;
  private sendWorkerFn: ((item: QueueItem) => Promise<{ success: boolean; error?: string }>) | null = null;
  private onStatsChangeCallback: (() => void) | null = null;

  public setEmergencyHalt(halted: boolean) {
    this.isEmergencyHalted = halted;
  }

  public isHalted(): boolean {
    return this.isEmergencyHalted;
  }

  constructor() {
    // Initial cleanup interval for completed/cancelled items in memory
    setInterval(() => this.pruneInMemoryCache(), 60 * 1000);
  }

  public updateSettings(newSettings: Partial<QueueSettings>): QueueSettings {
    this.settings = {
      ...this.settings,
      ...newSettings,
      minDelaySeconds: Math.max(1, Number(newSettings.minDelaySeconds ?? this.settings.minDelaySeconds)),
      maxDelaySeconds: Math.max(
        Number(newSettings.minDelaySeconds ?? this.settings.minDelaySeconds),
        Number(newSettings.maxDelaySeconds ?? this.settings.maxDelaySeconds)
      ),
      minIntervalSeconds: Math.max(1, Number(newSettings.minIntervalSeconds ?? this.settings.minIntervalSeconds)),
      maxMessagesPerMinute: Math.max(1, Number(newSettings.maxMessagesPerMinute ?? this.settings.maxMessagesPerMinute)),
    };
    return { ...this.settings };
  }

  public init(initialSettings?: Partial<QueueSettings>) {
    if (initialSettings) {
      this.updateSettings(initialSettings);
    }
    this.loadFromDb().catch((e) => console.warn("[QUEUE] loadFromDb error:", e?.message || e));
  }

  public getSettings(): QueueSettings {
    return { ...this.settings };
  }

  public async retryFailed(): Promise<number> {
    return this.retryFailedItems();
  }

  public async clearFailed(): Promise<number> {
    return this.clearFailedItems();
  }

  public async getQueueItems(statusFilter?: string, limit = 50): Promise<QueueItem[]> {
    return this.getItems(statusFilter, limit);
  }

  /**
   * Initializes queue from database on application boot
   */
  public async loadFromDb() {
    try {
      const items = await getQueueItemsFromDb('all', 300);
      for (const item of items) {
        // If an item was left in 'sending' state before server restart, revert to 'scheduled'
        if (item.status === 'sending') {
          item.status = 'scheduled';
          updateQueueItemInDb(item.id, { status: 'scheduled' });
        }
        this.inMemoryQueue.set(item.id, item);
      }
      console.log(`[QUEUE] Loaded ${items.length} items from database.`);
    } catch (err: any) {
      console.warn(`[QUEUE] Failed to load queue from database:`, err.message);
    }
  }

  /**
   * Calculates random jitter delay between minDelaySeconds and maxDelaySeconds
   */
  public calculateRandomDelaySeconds(): number {
    const min = Math.max(1, this.settings.minDelaySeconds || 10);
    const max = Math.max(min, this.settings.maxDelaySeconds || 45);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Checks if current Tehran time is within configured Silent Hours
   */
  public isCurrentlyInSilentHours(date: Date = new Date()): boolean {
    if (!this.settings.silentHoursEnabled) return false;

    try {
      const tehranFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tehran',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = tehranFormatter.formatToParts(date);
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      const currentMinutes = hour * 60 + minute;

      const [startHour, startMin] = (this.settings.silentHoursStart || "23:00").split(':').map(Number);
      const [endHour, endMin] = (this.settings.silentHoursEnd || "07:00").split(':').map(Number);

      const startMinutes = (startHour || 0) * 60 + (startMin || 0);
      const endMinutes = (endHour || 0) * 60 + (endMin || 0);

      if (startMinutes <= endMinutes) {
        // e.g. 01:00 to 06:00
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // e.g. 23:00 to 07:00 (crosses midnight)
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    } catch {
      return false;
    }
  }

  /**
   * Calculates the end time of current silent hours in milliseconds UTC
   */
  public calculateNextSilentHoursEnd(date: Date = new Date()): number {
    try {
      const tehranFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = tehranFormatter.formatToParts(date);
      const year = parseInt(parts.find(p => p.type === 'year')?.value || '2026', 10);
      const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10) - 1;
      const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);

      const [endHour, endMin] = (this.settings.silentHoursEnd || "07:00").split(':').map(Number);

      // Construct target date for end of silent hours in Tehran
      // Tehran is UTC+3:30
      const targetUtc = Date.UTC(year, month, day, (endHour || 7) - 3, (endMin || 0) - 30);
      if (targetUtc <= date.getTime()) {
        // Add 24 hours if already passed today
        return targetUtc + 24 * 60 * 60 * 1000;
      }
      return targetUtc;
    } catch {
      // Fallback: 6 hours from now
      return Date.now() + 6 * 3600 * 1000;
    }
  }

  /**
   * Adds a new incoming message to the persistent queue
   */
  public async enqueue(itemData: {
    sourceChannelId: string;
    sourceChannelUsername?: string;
    sourceChannelTitle?: string;
    destinationChannelId: string;
    originalMessageId: number;
    messageText?: string;
    formattedText?: string;
    mediaType?: string;
    mediaFileId?: string;
    mediaMetadata?: any;
  }): Promise<QueueItem> {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();
    const delaySeconds = this.calculateRandomDelaySeconds();

    let targetScheduledMs = now.getTime() + delaySeconds * 1000;

    // Check if received during Silent Hours
    if (this.isCurrentlyInSilentHours(now)) {
      const silentEndMs = this.calculateNextSilentHoursEnd(now);
      // Postpone to end of silent hours + random jitter so messages don't collide
      targetScheduledMs = silentEndMs + delaySeconds * 1000;
    }

    const scheduledTime = new Date(targetScheduledMs).toISOString();

    const queueItem: QueueItem = {
      id,
      sourceChannelId: itemData.sourceChannelId,
      sourceChannelUsername: itemData.sourceChannelUsername,
      sourceChannelTitle: itemData.sourceChannelTitle,
      destinationChannelId: itemData.destinationChannelId,
      originalMessageId: itemData.originalMessageId,
      messageText: itemData.messageText,
      formattedText: itemData.formattedText,
      mediaType: itemData.mediaType || 'text',
      mediaFileId: itemData.mediaFileId,
      mediaMetadata: itemData.mediaMetadata,
      status: 'scheduled',
      scheduledTime,
      attemptsCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.inMemoryQueue.set(id, queueItem);
    await addQueueItemToDb(queueItem);

    if (this.onStatsChangeCallback) {
      this.onStatsChangeCallback();
    }

    return queueItem;
  }

  /**
   * Starts the background sequential queue processing worker
   */
  public startWorker(sendFn: (item: QueueItem) => Promise<{ success: boolean; error?: string }>) {
    this.sendWorkerFn = sendFn;
    if (this.isWorkerRunning) return;
    this.isWorkerRunning = true;

    // Run tick every 1000ms
    setInterval(() => this.processNextQueueTick(), 1000);
    console.log('[QUEUE] Smart Queue scheduler and rate-limiter worker started.');
  }

  public setOnStatsChange(cb: () => void) {
    this.onStatsChangeCallback = cb;
  }

  /**
   * Main Queue Tick Loop (Single-threaded Concurrency = 1)
   */
  private async processNextQueueTick() {
    if (!this.sendWorkerFn || this.isProcessingItem) return;

    // 0. Check Master Emergency Shutdown
    if (this.isEmergencyHalted) return;

    // 1. Check if queue is paused
    if (this.settings.isQueuePaused) return;

    // 2. Check FloodWait cooldown
    const now = Date.now();
    if (now < this.floodWaitUntil) {
      return;
    }

    // 3. Check Silent Hours
    if (this.isCurrentlyInSilentHours()) {
      return;
    }

    // 4. Check Rate Limits (Min interval between sends)
    const minIntervalMs = (this.settings.minIntervalSeconds || 5) * 1000;
    if (now - this.lastSendTimestamp < minIntervalMs) {
      return;
    }

    // 5. Check Rate Limits (Max messages per minute)
    const oneMinuteAgo = now - 60 * 1000;
    this.sendTimestampsInLastMinute = this.sendTimestampsInLastMinute.filter(ts => ts > oneMinuteAgo);
    const maxPerMin = this.settings.maxMessagesPerMinute || 12;
    if (this.sendTimestampsInLastMinute.length >= maxPerMin) {
      return;
    }

    // 6. Find next scheduled item ready to send
    const readyItem = this.findNextReadyItem(now);
    if (!readyItem) return;

    // Process item with concurrency = 1
    this.isProcessingItem = true;
    readyItem.status = 'sending';
    readyItem.attemptsCount = (readyItem.attemptsCount || 0) + 1;
    readyItem.updatedAt = new Date().toISOString();
    updateQueueItemInDb(readyItem.id, {
      status: 'sending',
      attemptsCount: readyItem.attemptsCount,
    });

    try {
      const result = await this.sendWorkerFn(readyItem);
      this.lastSendTimestamp = Date.now();
      this.sendTimestampsInLastMinute.push(this.lastSendTimestamp);

      if (result.success) {
        readyItem.status = 'sent';
        readyItem.sentAt = new Date().toISOString();
        readyItem.lastError = undefined;
        readyItem.updatedAt = new Date().toISOString();
        this.consecutiveFailuresCount = 0;

        await updateQueueItemInDb(readyItem.id, {
          status: 'sent',
          sentAt: readyItem.sentAt,
          lastError: null,
        });
      } else {
        await this.handleItemFailure(readyItem, result.error || 'Unknown send error');
      }
    } catch (err: any) {
      await this.handleItemFailure(readyItem, err.message || 'Exception during sending');
    } finally {
      this.isProcessingItem = false;
      if (this.onStatsChangeCallback) {
        this.onStatsChangeCallback();
      }
    }
  }

  /**
   * Handles failure and possible FloodWait
   */
  private async handleItemFailure(item: QueueItem, errorMessage: string) {
    item.lastError = errorMessage;
    item.updatedAt = new Date().toISOString();

    // Check for FloodWait
    const floodMatch = errorMessage.match(/FLOOD_WAIT_?(\d+)/i) || errorMessage.match(/retry after (\d+)/i);
    if (floodMatch && floodMatch[1]) {
      const waitSeconds = parseInt(floodMatch[1], 10);
      const totalCooldownSeconds = waitSeconds + 5;
      this.floodWaitUntil = Date.now() + totalCooldownSeconds * 1000;

      // Reschedule current item after FloodWait ends + jitter
      const nextTime = new Date(this.floodWaitUntil + this.calculateRandomDelaySeconds() * 1000).toISOString();
      item.status = 'scheduled';
      item.scheduledTime = nextTime;

      await updateQueueItemInDb(item.id, {
        status: 'scheduled',
        scheduledTime: nextTime,
        lastError: `FloodWait: ${waitSeconds}s`,
      });

      console.warn(`[QUEUE] Telegram FloodWait detected: pausing queue for ${totalCooldownSeconds}s.`);

      // Alert Admin Report Group
      defaultReportGroupService.sendAlert({
        type: 'flood_wait',
        title: 'وقوع محدودیت FloodWait در تلگرام',
        details: `سیستم با محدودیت ارسال از سوی تلگرام مواجه شد.\nمدت توقف صف: ${waitSeconds} ثانیه (+5 ثانیه احتیاطی).\nهیچ پیامی حذف نخواهد شد و ارسال‌ها پس از رفع محدودیت به صورت خودکار از سر گرفته می‌شوند.`,
        level: 'warning',
        extraFields: {
          'ثانیه‌های وقفه': waitSeconds,
          'زمان پایان وقفه': new Date(this.floodWaitUntil).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran' }),
        },
      });
      return;
    }

    // Regular failure: retry up to 3 times with exponential backoff
    if (item.attemptsCount < 3) {
      const backoffSeconds = item.attemptsCount * 30 + this.calculateRandomDelaySeconds();
      const nextScheduledTime = new Date(Date.now() + backoffSeconds * 1000).toISOString();
      item.status = 'scheduled';
      item.scheduledTime = nextScheduledTime;

      await updateQueueItemInDb(item.id, {
        status: 'scheduled',
        scheduledTime: nextScheduledTime,
        lastError: errorMessage,
      });
    } else {
      // Marked as permanently failed
      item.status = 'failed';
      this.consecutiveFailuresCount++;

      await updateQueueItemInDb(item.id, {
        status: 'failed',
        lastError: errorMessage,
      });

      // If item failed 3 consecutive times, alert Admin Report Group
      defaultReportGroupService.sendAlert({
        type: 'queue_error',
        title: 'خطای متوالی در ارسال پیام از صف',
        details: `ارسال پیام با شناسه ${item.originalMessageId} از کانال ${item.sourceChannelTitle || item.sourceChannelUsername || item.sourceChannelId} پس از ۳ بار تلاش با شکست مواجه شد.\nمتن خطا:\n${errorMessage}`,
        level: 'warning',
        extraFields: {
          'شناسه پیام': item.originalMessageId,
          'تعداد تلاش': item.attemptsCount,
          'نوع رسانه': item.mediaType || 'text',
        },
      });
    }
  }

  private findNextReadyItem(nowMs: number): QueueItem | null {
    let earliestItem: QueueItem | null = null;
    let earliestTimeMs = Infinity;

    for (const item of this.inMemoryQueue.values()) {
      if (item.status === 'scheduled') {
        const itemScheduledMs = new Date(item.scheduledTime).getTime();
        if (itemScheduledMs <= nowMs && itemScheduledMs < earliestTimeMs) {
          earliestTimeMs = itemScheduledMs;
          earliestItem = item;
        }
      }
    }

    return earliestItem;
  }

  /**
   * Queue Operations
   */
  public pauseQueue(): boolean {
    this.settings.isQueuePaused = true;
    return true;
  }

  public resumeQueue(): boolean {
    this.settings.isQueuePaused = false;
    return true;
  }

  public async retryFailedItems(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const item of this.inMemoryQueue.values()) {
      if (item.status === 'failed') {
        const delay = this.calculateRandomDelaySeconds();
        item.status = 'scheduled';
        item.scheduledTime = new Date(now.getTime() + delay * 1000).toISOString();
        item.attemptsCount = 0;
        item.lastError = undefined;
        item.updatedAt = now.toISOString();
        count++;
      }
    }

    const dbCount = await retryFailedQueueItemsInDb(new Date(now.getTime() + 10 * 1000).toISOString());
    return Math.max(count, dbCount);
  }

  public async clearFailedItems(): Promise<number> {
    let count = 0;
    for (const [id, item] of this.inMemoryQueue.entries()) {
      if (item.status === 'failed') {
        this.inMemoryQueue.delete(id);
        count++;
      }
    }
    const dbCount = await clearFailedQueueItemsFromDb();
    return Math.max(count, dbCount);
  }

  public async deleteItem(id: string): Promise<boolean> {
    this.inMemoryQueue.delete(id);
    await deleteQueueItemFromDb(id);
    return true;
  }

  public getItems(statusFilter?: string, limit = 50): QueueItem[] {
    const items = Array.from(this.inMemoryQueue.values());
    let filtered = items;
    if (statusFilter && statusFilter !== 'all') {
      filtered = items.filter(i => i.status === statusFilter);
    }
    // Sort by scheduled time ascending
    filtered.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
    return filtered.slice(0, limit);
  }

  public getStats() {
    let pendingCount = 0;
    let scheduledCount = 0;
    let sendingCount = 0;
    let sentCount = 0;
    let failedCount = 0;
    let nextScheduledItemTime: string | undefined = undefined;
    let nextScheduledTimeMs = Infinity;

    const now = Date.now();
    for (const item of this.inMemoryQueue.values()) {
      if (item.status === 'pending') pendingCount++;
      else if (item.status === 'scheduled') {
        scheduledCount++;
        const itemMs = new Date(item.scheduledTime).getTime();
        if (itemMs < nextScheduledTimeMs) {
          nextScheduledTimeMs = itemMs;
          nextScheduledItemTime = item.scheduledTime;
        }
      }
      else if (item.status === 'sending') sendingCount++;
      else if (item.status === 'sent') sentCount++;
      else if (item.status === 'failed') failedCount++;
    }

    const oneMinuteAgo = now - 60 * 1000;
    const currentRatePerMinute = this.sendTimestampsInLastMinute.filter(ts => ts > oneMinuteAgo).length;

    return {
      pendingCount,
      scheduledCount,
      sendingCount,
      sentCount,
      failedCount,
      totalQueued: pendingCount + scheduledCount + sendingCount,
      isQueuePaused: this.settings.isQueuePaused,
      nextScheduledItemTime,
      floodWaitActiveUntil: this.floodWaitUntil > now ? new Date(this.floodWaitUntil).toISOString() : undefined,
      currentRatePerMinute,
    };
  }

  private pruneInMemoryCache() {
    // Keep max 200 sent/cancelled items in memory to prevent memory leaks
    let sentItems: QueueItem[] = [];
    for (const item of this.inMemoryQueue.values()) {
      if (item.status === 'sent' || item.status === 'cancelled') {
        sentItems.push(item);
      }
    }
    if (sentItems.length > 200) {
      sentItems.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      const toRemove = sentItems.slice(0, sentItems.length - 200);
      for (const item of toRemove) {
        this.inMemoryQueue.delete(item.id);
      }
    }
  }
}

export const defaultQueueService = new QueueService();
