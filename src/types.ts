export interface AdminConfig {
  isAuthenticated: boolean;
  hasPasswordSet: boolean;
}

export interface TelegramClientConfig {
  apiId?: number | null;
  apiHash?: string;
  phoneNumber?: string;
  session?: string;
  isConnected: boolean;
  isMonitoringPaused?: boolean;
  connectedPhone?: string;
  lastConnectedAt?: string;
  hasSession?: boolean;
  isEnvConfigured?: boolean;
  hasApiCredentials?: boolean;
}

export interface AiProcessingConfig {
  enableAiProcessing: boolean; // Master switch

  // Tab 1: Keyword Filter
  enableKeywordFilter: boolean;
  allowedKeywords: string[];
  blockedKeywords: string[];
  keywordMatchMode: 'any' | 'all';
  messagesPassed?: number;
  messagesBlocked?: number;

  // Tab 2: Content Cleaner
  enableContentCleaning: boolean;
  cleaningRules: string[]; // custom words, usernames, links, hashtags to clean
  removeTelegramLinks?: boolean;
  removeInstagramLinks?: boolean;
  removeAllUrls?: boolean;
  removeUsernames?: boolean;
  removeHashtags?: boolean;
  removeEmojis?: boolean;

  // Contact Information
  enableContactManager: boolean;
  defaultContactNote: string;

  // Tab 3: Media Rules
  enableMediaControl: boolean;
  forwardPhotos: boolean;
  forwardVideos: boolean;
  forwardPdfs: boolean;
  forwardDocuments: boolean;
  forwardAudios: boolean;
  mediaOrder: 'media_first' | 'text_first';

  // Tab 5: Duplicate Protection
  enableDuplicateProtection: boolean;
  duplicateDetectionType: 'text_similarity' | 'media_hash' | 'both';
  timeWindowHours: number;
  maxForwardingCount: number;

  // Job Extractor
  enableJobExtraction: boolean;

  // Tab 4: Message Signature / Footer
  enableMessageSignature?: boolean;
  signatureText?: string;
  addSignatureAfterEveryMessage?: boolean;
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

export interface QueueStats {
  pendingCount: number;
  scheduledCount: number;
  sendingCount: number;
  sentCount: number;
  failedCount: number;
  totalQueued: number;
  isQueuePaused: boolean;
  isEmergencyHalted?: boolean;
  nextScheduledItemTime?: string;
  floodWaitActiveUntil?: string;
  currentRatePerMinute: number;
}

export interface ReportGroupConfig {
  chatId: string; // Channel username (@channel) or Channel ID (-100...)
  status: 'connected' | 'disconnected' | 'not_configured';
  lastTestedAt?: string;
  alertsEnabled: boolean;
  dailyDigestEnabled: boolean;
  autoBackupEnabled?: boolean;
  lastBackupAt?: string;
}

export interface BotAdminConfig {
  adminTelegramUserId?: string; // Telegram numeric ID of admin (e.g. 12345678)
  adminPasscode?: string; // Passcode to unlock bot in Telegram
  enableInBotAdmin: boolean; // Enable/disable in-bot management
  autoAuthorizedUsers?: string[]; // list of authorized telegram user IDs
  lastCommandReceived?: string;
  lastCommandTime?: string;
  isBotPollingActive?: boolean;
}

export interface BotSettings {
  botToken: string;
  destinationChannel: string; // e.g. @my_dest_channel or -100123456789
  botUsername?: string;
  botInfo?: {
    id: number;
    username: string;
    first_name: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
  };
  isVerified: boolean;
  lastVerifiedAt?: string;
  isSystemTurnedOff?: boolean; // Emergency Master Kill Switch
  // Global Keyword Filter Settings
  globalKeywords?: string[];
  globalForbiddenKeywords?: string[];
  enableGlobalKeywords?: boolean;
  globalKeywordMatchMode?: 'any' | 'all';
  // Advanced Message Processing Center
  aiProcessing?: AiProcessingConfig;
  // In-Bot Admin Management
  botAdminConfig?: BotAdminConfig;
  // Smart Queue Configuration
  queueSettings?: QueueSettings;
  // Dedicated Admin Report Group
  reportGroupConfig?: ReportGroupConfig;
}

export interface SourceChannel {
  id: string;
  title: string;
  username: string; // e.g. durov or telegram
  numericId?: string;
  type: 'channel' | 'group';
  status: 'active' | 'paused' | 'error';
  lastCheckedAt?: string;
  lastMessageId?: number;
  totalTransferred: number;
  errorMessage?: string;
  createdAt: string;
  avatarUrl?: string;
  subscriberCount?: string;
  // Per-Source Keyword Filter
  keywords?: string[];
  enableKeywords?: boolean;
  keywordMatchMode?: 'any' | 'all';
}

export interface TelegramMediaItem {
  type: 'photo' | 'video' | 'document' | 'audio' | 'voice' | 'animation' | 'sticker';
  url: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
}

export interface TelegramPost {
  id: number;
  channelUsername: string;
  channelTitle?: string;
  date: string;
  text?: string;
  formattedTextHtml?: string;
  mediaType: 'text' | 'photo' | 'video' | 'document' | 'voice' | 'audio' | 'gif' | 'sticker' | 'media_group';
  mediaUrls?: string[];
  mediaGroup?: TelegramMediaItem[];
  views?: string;
  rawUrl?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  sourceId: string;
  sourceUsername: string;
  sourceTitle: string;
  messageId: number;
  contentType: string;
  status: 'success' | 'duplicate' | 'error' | 'skipped';
  details: string;
  destinationChannel: string;
}

export interface DataStore {
  adminPasswordHash: string;
  telegramClientConfig: TelegramClientConfig;
  telegramSession: string;
  isMonitoringPaused: boolean;
  isSystemTurnedOff?: boolean;
  settings: BotSettings;
  sources: SourceChannel[];
  logs: ActivityLog[];
  processedMessageIds: Record<string, number[]>;
  stats: {
    totalTransferred: number;
    failedMessages: number;
    startTime: string;
    lastBackupTime?: string;
  };
}

export interface SystemStats {
  totalSources: number;
  activeSources: number;
  totalTransferred: number;
  todayTransferred?: number;
  filteredMessages?: number;
  unsentMessages?: number;
  failedMessages?: number;
  lastForwardTime?: string;
  lastBackupTime?: string;
  isPollingActive: boolean;
  botStatus: 'connected' | 'disconnected' | 'not_configured';
  gramStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
  uptimeSeconds: number;
  isSystemTurnedOff?: boolean;
  telegramClientConnected?: boolean;
  botConnected?: boolean;
  destinationVerified?: boolean;
  systemReady?: boolean;
  clientConfig?: TelegramClientConfig;
  queueStats?: QueueStats;
  reportGroupConfig?: ReportGroupConfig;
  dbStatus?: 'connected' | 'local_fallback' | 'error';
  lastReceivedTime?: string;
  currentSendingRate?: number;
}
