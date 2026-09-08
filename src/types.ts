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

  // Tab: AI Rewrite (Self-Hosted Local Engine)
  ai_rewrite_enabled?: boolean;
  aiRewriteEnabled?: boolean;
  enableAiRewrite: boolean;
  ai_rewrite_style?: 'formal_news' | 'friendly' | 'academic' | 'bullet_summary' | 'clickbait' | 'short_alert' | string;
  ai_rewrite_intensity?: 'low' | 'medium' | 'high';
  ai_rewrite_custom_prompt?: string;
  ai_rewrite_max_length?: number;
  rewrite_style?: string;
  rewriteStyle?: string;
  writingStyle: 'formal' | 'professional' | 'friendly' | 'simple' | 'news' | 'custom';
  customWritingStyle?: string;

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

  // Tab 6: Duplicate Protection
  enableDuplicateProtection: boolean;
  duplicateDetectionType: 'text_similarity' | 'media_hash' | 'both';
  timeWindowHours: number;
  maxForwardingCount: number;

  // AI Job Extractor
  enableJobExtraction: boolean;

  // Tab 4: Message Signature / Footer
  enableMessageSignature?: boolean;
  signatureText?: string;
  addSignatureAfterEveryMessage?: boolean;
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
  // Global Keyword Filter Settings
  globalKeywords?: string[];
  globalForbiddenKeywords?: string[];
  enableGlobalKeywords?: boolean;
  globalKeywordMatchMode?: 'any' | 'all';
  // Advanced AI Message Processing Center
  aiProcessing?: AiProcessingConfig;
  // In-Bot Admin Management
  botAdminConfig?: BotAdminConfig;
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
  telegramClientConnected?: boolean;
  botConnected?: boolean;
  destinationVerified?: boolean;
  systemReady?: boolean;
  clientConfig?: TelegramClientConfig;
}
