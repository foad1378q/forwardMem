import { BotSettings, SourceChannel, ActivityLog, SystemStats, TelegramPost, TelegramClientConfig } from "../types";

async function safeFetchJson<T>(url: string, options?: RequestInit, fallback?: Partial<T>): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      try {
        const jsonErr = JSON.parse(text);
        if (jsonErr && typeof jsonErr === 'object') {
          return { success: false, message: `HTTP ${res.status}: ${res.statusText}`, ...jsonErr, ...fallback } as T;
        }
      } catch {}
      return { success: false, message: `HTTP ${res.status}: ${res.statusText}`, ...fallback } as unknown as T;
    }
    return await res.json();
  } catch (err: any) {
    console.warn(`[API] safeFetchJson caught error for ${url}:`, err.message || err);
    return { success: false, message: "خطا در برقراری ارتباط با سرور", ...fallback } as unknown as T;
  }
}

export async function loginAdmin(password: string): Promise<{ success: boolean; message: string }> {
  return safeFetchJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  }, { success: false, message: "" });
}

export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  return safeFetchJson("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  }, { success: false, message: "" });
}

// AI Message Processing Center APIs
export async function getAiProcessingSettings(): Promise<{ success: boolean; aiProcessing: any }> {
  return safeFetchJson("/api/ai-processing", undefined, { success: false, aiProcessing: null });
}

export async function saveAiProcessingSettings(config: any): Promise<{ success: boolean; message: string; aiProcessing: any }> {
  return safeFetchJson("/api/ai-processing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  }, { success: false, message: "", aiProcessing: null });
}

export async function testJobExtraction(text: string): Promise<{
  success: boolean;
  extracted?: {
    jobTitle: string;
    company: string;
    location: string;
    skills: string;
    salary: string;
    contact: string;
    deadline: string;
  };
  formattedPreview?: string;
  message?: string;
}> {
  return safeFetchJson("/api/ai-processing/test-job-extraction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }, { success: false });
}

export async function testContentCleaning(text: string, customRules?: any): Promise<{
  success: boolean;
  originalText: string;
  cleanedText: string;
  removedItems: string[];
  finalWithSignature: string;
  signatureAdded: boolean;
  message?: string;
}> {
  return safeFetchJson("/api/ai-processing/test-clean", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, customRules }),
  }, { success: false, originalText: text, cleanedText: text, removedItems: [], finalWithSignature: text, signatureAdded: false });
}

export async function getTelegramClientStatus(): Promise<{ clientConfig: TelegramClientConfig; gramStatus: string }> {
  return safeFetchJson("/api/telegram-client/status", undefined, {
    clientConfig: { apiId: null, apiHash: "", phoneNumber: "", isConnected: false },
    gramStatus: "disconnected",
  });
}

export async function sendTelegramClientCode(apiId: string, apiHash: string, phoneNumber: string): Promise<{ success: boolean; message: string; phoneCodeHash?: string }> {
  return safeFetchJson("/api/telegram-client/send-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiId, apiHash, phoneNumber }),
  }, { success: false, message: "" });
}

export async function verifyTelegramClientCode(phoneCode: string): Promise<{ success: boolean; message: string; requiresPassword?: boolean; clientConfig?: TelegramClientConfig }> {
  return safeFetchJson("/api/telegram-client/verify-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneCode }),
  }, { success: false, message: "" });
}

export async function verifyTelegramClientPassword(password: string): Promise<{ success: boolean; message: string; clientConfig?: TelegramClientConfig }> {
  return safeFetchJson("/api/telegram-client/verify-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  }, { success: false, message: "" });
}

export async function disconnectTelegramClient(): Promise<{ success: boolean; message: string }> {
  return safeFetchJson("/api/telegram-client/disconnect", {
    method: "POST",
  }, { success: false, message: "" });
}

export async function testTelegramClientConnection(): Promise<{ success: boolean; message: string; user?: any }> {
  return safeFetchJson("/api/telegram-client/test", {
    method: "POST",
  }, { success: false, message: "" });
}

export async function reconnectTelegramClient(): Promise<{ success: boolean; message: string; clientConfig?: TelegramClientConfig }> {
  return safeFetchJson("/api/telegram-client/reconnect", {
    method: "POST",
  }, { success: false, message: "" });
}

export async function pauseTelegramMonitoring(): Promise<{ success: boolean; message: string; isMonitoringPaused?: boolean }> {
  return safeFetchJson("/api/telegram-client/pause", {
    method: "POST",
  }, { success: false, message: "" });
}

export async function resumeTelegramMonitoring(): Promise<{ success: boolean; message: string; isMonitoringPaused?: boolean }> {
  return safeFetchJson("/api/telegram-client/resume", {
    method: "POST",
  }, { success: false, message: "" });
}

export async function sendBotTestMessage(text: string, mediaUrl?: string): Promise<{
  success: boolean;
  message: string;
  deliveryStatus?: {
    botUsername: string;
    destinationChannel: string;
    lastTestTime: string;
    preview: string;
    success: boolean;
  };
}> {
  return safeFetchJson("/api/bot-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mediaUrl }),
  }, { success: false, message: "" });
}

export async function getSettings(): Promise<{ settings: BotSettings }> {
  return safeFetchJson("/api/settings", undefined, {
    settings: { botToken: "", destinationChannel: "", isVerified: false },
  });
}

export async function saveSettings(botToken: string, destinationChannel: string): Promise<{ success: boolean; message: string; settings?: BotSettings }> {
  return safeFetchJson("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ botToken, destinationChannel }),
  }, { success: false, message: "" });
}

export async function updateDestinationChannel(destinationChannel: string): Promise<{ success: boolean; message: string; settings?: BotSettings }> {
  return safeFetchJson("/api/settings/destination", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destinationChannel }),
  }, { success: false, message: "" });
}

export async function getSources(): Promise<{ sources: SourceChannel[] }> {
  return safeFetchJson("/api/sources", undefined, { sources: [] });
}

export async function addSource(username: string, type: 'channel' | 'group' = 'channel'): Promise<{ success: boolean; message: string; source?: SourceChannel }> {
  return safeFetchJson("/api/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, type }),
  }, { success: false, message: "" });
}

export async function toggleSourceStatus(id: string, status: 'active' | 'paused'): Promise<{ success: boolean; message: string; source?: SourceChannel }> {
  return safeFetchJson(`/api/sources/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }, { success: false, message: "" });
}

export async function deleteSource(id: string): Promise<{ success: boolean; message: string }> {
  return safeFetchJson(`/api/sources/${id}`, {
    method: "DELETE",
  }, { success: false, message: "" });
}

export async function testForwardSource(id: string): Promise<{ success: boolean; message: string; post?: TelegramPost }> {
  return safeFetchJson(`/api/sources/${id}/test-forward`, {
    method: "POST",
  }, { success: false, message: "" });
}

export async function testMonitoringSource(id: string): Promise<{ success: boolean; message: string; details?: any }> {
  return safeFetchJson(`/api/sources/${id}/test-monitoring`, {
    method: "POST",
  }, { success: false, message: "" });
}

export async function quickTestForward(
  botToken: string,
  sourceChannel: string,
  destinationChannel: string
): Promise<{
  success: boolean;
  message: string;
  post?: TelegramPost;
  botUsername?: string;
  channelTitle?: string;
}> {
  return safeFetchJson("/api/quick-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ botToken, sourceChannel, destinationChannel }),
  }, { success: false, message: "" });
}

export async function getChannelPreview(id: string): Promise<{ success: boolean; message?: string; preview?: { title: string; avatarUrl?: string; subscriberCount?: string; posts: TelegramPost[] } }> {
  return safeFetchJson(`/api/sources/${id}/preview`, undefined, { success: false });
}

export async function getLogs(): Promise<{ logs: ActivityLog[] }> {
  return safeFetchJson("/api/logs", undefined, { logs: [] });
}

export async function clearLogs(): Promise<{ success: boolean; message: string }> {
  return safeFetchJson("/api/logs", {
    method: "DELETE",
  }, { success: false, message: "" });
}

export async function getStats(): Promise<{ stats: SystemStats }> {
  return safeFetchJson("/api/stats", undefined, {
    stats: {
      totalSources: 0,
      activeSources: 0,
      totalTransferred: 0,
      isPollingActive: false,
      botStatus: 'not_configured',
      uptimeSeconds: 0,
    },
  });
}

// Backup & Restore APIs
export async function exportBackupData(): Promise<any> {
  return safeFetchJson("/api/backup/export", undefined, {});
}

export async function importBackupData(backupData: any): Promise<{ success: boolean; message: string }> {
  return safeFetchJson("/api/backup/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ backupData }),
  }, { success: false, message: "" });
}

export async function createServerBackup(): Promise<{ success: boolean; message: string; filename?: string }> {
  return safeFetchJson("/api/backup/server-backup", {
    method: "POST",
  }, { success: false, message: "" });
}

export async function getServerBackupsList(): Promise<{ success: boolean; backups: { filename: string; size: number; createdAt: string }[] }> {
  return safeFetchJson("/api/backup/server-backups", undefined, { success: false, backups: [] });
}

export async function restoreServerBackup(filename: string): Promise<{ success: boolean; message: string }> {
  return safeFetchJson("/api/backup/server-restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  }, { success: false, message: "" });
}

// Self-Hosted AI Message Rewrite Test API
export async function testAiRewrite(
  text: string,
  options?: {
    style?: string;
    intensity?: string;
    customPrompt?: string;
    maxLength?: number;
  }
): Promise<{
  success: boolean;
  rewrittenText: string;
  originalText: string;
  processingTimeMs: number;
  preservedEntities?: any;
  message?: string;
}> {
  return safeFetchJson("/api/ai-processing/test-rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...options }),
  }, {
    success: false,
    rewrittenText: text,
    originalText: text,
    processingTimeMs: 0,
    preservedEntities: {},
  });
}



