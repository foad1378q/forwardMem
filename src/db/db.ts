import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import fs from 'fs';
import path from 'path';
import * as schema from './schema.js';
import { encryptValue, decryptValue } from './encryption.js';

const { Pool } = pg;

// Database Connection String
const DATABASE_URL = process.env.DATABASE_URL || '';

export let pool: pg.Pool | null = null;
export let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
export let isDbConnected = false;

/**
 * Initializes PostgreSQL Pool and Drizzle ORM instance.
 * Automatically creates all tables and indexes if they do not exist.
 * Supports optional override URL (e.g. from Web Setup Wizard).
 * If no URL is set or connection fails, gracefully falls back to setup mode without crashing.
 */
export async function initDatabase(overrideUrl?: string): Promise<boolean> {
  const urlToUse = overrideUrl || process.env.DATABASE_URL || '';
  if (!urlToUse || urlToUse.trim() === '') {
    console.log('[DATABASE] No DATABASE_URL provided yet. Application running in local fallback / setup wizard mode.');
    isDbConnected = false;
    return false;
  }

  try {
    if (pool) {
      try {
        await pool.end();
      } catch (_) {}
      pool = null;
    }

    pool = new Pool({
      connectionString: urlToUse,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 7000,
      ssl: urlToUse.includes('localhost') || urlToUse.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    console.log('[DATABASE] Connected to PostgreSQL successfully.');
    client.release();

    db = drizzle(pool, { schema });
    isDbConnected = true;

    // Auto-create/migrate required tables and indexes
    await createTablesIfNotExist();

    // Auto-migrate legacy JSON file if present
    await checkAndPerformMigration();

    // Initialize default records ONLY if they do not already exist (Requirement 6)
    await initializeDefaultRecordsInPostgres();

    console.log('[DATABASE] Database initialization completed successfully.');
    return true;
  } catch (err: any) {
    console.warn(`[DATABASE NOTICE] PostgreSQL connection not established: ${err.message}. Operating in setup mode.`);
    isDbConnected = false;
    return false;
  }
}

/**
 * Automatically creates all tables, columns, primary keys, and indexes using DDL.
 */
async function createTablesIfNotExist() {
  if (!pool) throw new Error('[DATABASE ERROR] Pool is null');

  const createTablesSQL = `
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      bot_token TEXT,
      destination_channel TEXT,
      admin_password_hash TEXT DEFAULT 'admin123',
      is_monitoring_paused BOOLEAN DEFAULT FALSE,
      is_verified BOOLEAN DEFAULT FALSE,
      global_keywords JSONB,
      global_forbidden_keywords JSONB,
      enable_global_keywords BOOLEAN DEFAULT FALSE,
      global_keyword_match_mode TEXT DEFAULT 'any',
      rate_limits JSONB,
      panel_config JSONB,
      forwarding_settings JSONB,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE settings ADD COLUMN IF NOT EXISTS global_keywords JSONB;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS global_forbidden_keywords JSONB;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS enable_global_keywords BOOLEAN DEFAULT FALSE;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS global_keyword_match_mode TEXT DEFAULT 'any';
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS rate_limits JSONB;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS panel_config JSONB;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS forwarding_settings JSONB;

    CREATE TABLE IF NOT EXISTS telegram_client (
      id TEXT PRIMARY KEY DEFAULT 'default',
      api_id INTEGER,
      api_hash TEXT,
      phone_number TEXT,
      connected_phone TEXT,
      telegram_session TEXT,
      is_client_connected BOOLEAN DEFAULT FALSE,
      is_monitoring_paused BOOLEAN DEFAULT FALSE,
      last_connected_at TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE telegram_client ADD COLUMN IF NOT EXISTS connected_phone TEXT;
    ALTER TABLE telegram_client ADD COLUMN IF NOT EXISTS is_monitoring_paused BOOLEAN DEFAULT FALSE;
    ALTER TABLE telegram_client ADD COLUMN IF NOT EXISTS last_connected_at TEXT;

    CREATE TABLE IF NOT EXISTS telegram_accounts (
      id TEXT PRIMARY KEY,
      phone_number TEXT,
      telegram_session TEXT,
      is_connected BOOLEAN DEFAULT FALSE,
      account_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      name TEXT,
      username TEXT,
      type TEXT DEFAULT 'channel',
      status TEXT DEFAULT 'active',
      is_channel BOOLEAN DEFAULT TRUE,
      is_active BOOLEAN DEFAULT TRUE,
      last_checked_at TEXT,
      last_message_id INTEGER DEFAULT 0,
      total_transferred INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT,
      avatar_url TEXT,
      subscriber_count TEXT,
      numeric_id TEXT,
      keywords JSONB,
      enable_keywords BOOLEAN DEFAULT FALSE,
      keyword_match_mode TEXT DEFAULT 'any',
      keyword_filter JSONB,
      content_cleaner JSONB,
      signature TEXT,
      cleaning_rules JSONB,
      footer_text TEXT,
      contact_settings JSONB,
      media_settings JSONB,
      ai_settings JSONB,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE sources ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'channel';
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_checked_at TEXT;
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_message_id INTEGER DEFAULT 0;
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS total_transferred INTEGER DEFAULT 0;
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS error_message TEXT;
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS subscriber_count TEXT;
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS numeric_id TEXT;
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS keywords JSONB;
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS enable_keywords BOOLEAN DEFAULT FALSE;
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS keyword_match_mode TEXT DEFAULT 'any';

    CREATE TABLE IF NOT EXISTS statistics (
      id TEXT PRIMARY KEY DEFAULT 'default',
      total_transferred INTEGER DEFAULT 0,
      failed_messages INTEGER DEFAULT 0,
      start_time TEXT,
      last_backup_time TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      text TEXT DEFAULT '',
      source_id TEXT,
      source_username TEXT,
      source_title TEXT,
      channel_name TEXT,
      message_id INTEGER DEFAULT 0,
      content_type TEXT DEFAULT 'text',
      media_type TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'success',
      details TEXT DEFAULT '',
      destination_channel TEXT,
      is_filtered BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE logs ADD COLUMN IF NOT EXISTS source_id TEXT;
    ALTER TABLE logs ADD COLUMN IF NOT EXISTS source_username TEXT;
    ALTER TABLE logs ADD COLUMN IF NOT EXISTS source_title TEXT;
    ALTER TABLE logs ADD COLUMN IF NOT EXISTS message_id INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text';
    ALTER TABLE logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';
    ALTER TABLE logs ADD COLUMN IF NOT EXISTS details TEXT DEFAULT '';
    ALTER TABLE logs ADD COLUMN IF NOT EXISTS destination_channel TEXT;

    CREATE TABLE IF NOT EXISTS ai_processing (
      id TEXT PRIMARY KEY DEFAULT 'default',
      enable_ai_processing BOOLEAN DEFAULT TRUE,
      enabled BOOLEAN DEFAULT TRUE,
      api_key TEXT,
      model TEXT DEFAULT 'self-hosted',
      custom_prompt TEXT,
      translate_to_persian BOOLEAN DEFAULT FALSE,
      sanitize_text BOOLEAN DEFAULT TRUE,
      summarize BOOLEAN DEFAULT FALSE,
      extract_keywords BOOLEAN DEFAULT FALSE,
      format_markdown BOOLEAN DEFAULT TRUE,
      style TEXT DEFAULT 'default',
      target_language TEXT DEFAULT 'fa',
      enable_keyword_filter BOOLEAN DEFAULT FALSE,
      allowed_keywords JSONB,
      blocked_keywords JSONB,
      keyword_match_mode TEXT DEFAULT 'any',
      messages_passed INTEGER DEFAULT 0,
      messages_blocked INTEGER DEFAULT 0,
      enable_content_cleaning BOOLEAN DEFAULT FALSE,
      cleaning_rules JSONB,
      remove_telegram_links BOOLEAN DEFAULT TRUE,
      remove_instagram_links BOOLEAN DEFAULT TRUE,
      remove_all_urls BOOLEAN DEFAULT FALSE,
      remove_usernames BOOLEAN DEFAULT TRUE,
      remove_hashtags BOOLEAN DEFAULT TRUE,
      remove_emojis BOOLEAN DEFAULT FALSE,
      ai_rewrite_enabled BOOLEAN DEFAULT FALSE,
      enable_ai_rewrite BOOLEAN DEFAULT FALSE,
      rewrite_style TEXT DEFAULT 'formal',
      writing_style TEXT DEFAULT 'formal',
      custom_writing_style TEXT,
      enable_contact_manager BOOLEAN DEFAULT FALSE,
      default_contact_note TEXT,
      enable_media_control BOOLEAN DEFAULT FALSE,
      forward_photos BOOLEAN DEFAULT TRUE,
      forward_videos BOOLEAN DEFAULT TRUE,
      forward_pdfs BOOLEAN DEFAULT TRUE,
      forward_documents BOOLEAN DEFAULT TRUE,
      forward_audios BOOLEAN DEFAULT TRUE,
      media_order TEXT DEFAULT 'media_first',
      enable_duplicate_protection BOOLEAN DEFAULT FALSE,
      duplicate_detection_type TEXT DEFAULT 'both',
      time_window_hours INTEGER DEFAULT 1,
      max_forwarding_count INTEGER DEFAULT 2,
      enable_job_extraction BOOLEAN DEFAULT FALSE,
      enable_message_signature BOOLEAN DEFAULT FALSE,
      signature_text TEXT,
      add_signature_after_every_message BOOLEAN DEFAULT TRUE,
      prompt_templates JSONB,
      word_filters JSONB,
      replace_words JSONB,
      blacklist JSONB,
      whitelist JSONB,
      contact_settings JSONB,
      forwarding_settings JSONB,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS enable_ai_processing BOOLEAN DEFAULT TRUE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS enable_keyword_filter BOOLEAN DEFAULT FALSE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS allowed_keywords JSONB;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS blocked_keywords JSONB;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS keyword_match_mode TEXT DEFAULT 'any';
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS messages_passed INTEGER DEFAULT 0;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS messages_blocked INTEGER DEFAULT 0;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS enable_content_cleaning BOOLEAN DEFAULT FALSE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS cleaning_rules JSONB;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS remove_telegram_links BOOLEAN DEFAULT TRUE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS remove_instagram_links BOOLEAN DEFAULT TRUE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS remove_all_urls BOOLEAN DEFAULT FALSE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS remove_usernames BOOLEAN DEFAULT TRUE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS remove_hashtags BOOLEAN DEFAULT TRUE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS remove_emojis BOOLEAN DEFAULT FALSE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS ai_rewrite_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS enable_ai_rewrite BOOLEAN DEFAULT FALSE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS ai_rewrite_style TEXT DEFAULT 'formal_news';
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS ai_rewrite_intensity TEXT DEFAULT 'medium';
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS ai_rewrite_custom_prompt TEXT;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS ai_rewrite_max_length INTEGER DEFAULT 2000;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS rewrite_style TEXT DEFAULT 'formal';
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS writing_style TEXT DEFAULT 'formal';
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS custom_writing_style TEXT;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS enable_contact_manager BOOLEAN DEFAULT FALSE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS default_contact_note TEXT;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS enable_media_control BOOLEAN DEFAULT FALSE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS forward_photos BOOLEAN DEFAULT TRUE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS forward_videos BOOLEAN DEFAULT TRUE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS forward_pdfs BOOLEAN DEFAULT TRUE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS forward_documents BOOLEAN DEFAULT TRUE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS forward_audios BOOLEAN DEFAULT TRUE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS media_order TEXT DEFAULT 'media_first';
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS enable_duplicate_protection BOOLEAN DEFAULT FALSE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS duplicate_detection_type TEXT DEFAULT 'both';
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS time_window_hours INTEGER DEFAULT 1;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS max_forwarding_count INTEGER DEFAULT 2;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS enable_job_extraction BOOLEAN DEFAULT FALSE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS enable_message_signature BOOLEAN DEFAULT FALSE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS signature_text TEXT;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS add_signature_after_every_message BOOLEAN DEFAULT TRUE;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS prompt_templates JSONB;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS word_filters JSONB;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS replace_words JSONB;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS blacklist JSONB;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS whitelist JSONB;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS contact_settings JSONB;
    ALTER TABLE ai_processing ADD COLUMN IF NOT EXISTS forwarding_settings JSONB;

    CREATE TABLE IF NOT EXISTS duplicate_cache (
      id TEXT PRIMARY KEY,
      source_id TEXT,
      message_id INTEGER,
      message_hash TEXT NOT NULL,
      channel_id TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE duplicate_cache ADD COLUMN IF NOT EXISTS source_id TEXT;
    ALTER TABLE duplicate_cache ADD COLUMN IF NOT EXISTS message_id INTEGER;

    CREATE TABLE IF NOT EXISTS cleaning_rules (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      replace_with TEXT DEFAULT '',
      type TEXT DEFAULT 'remove',
      is_active BOOLEAN DEFAULT TRUE,
      scope TEXT DEFAULT 'global',
      channel_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS message_signature (
      id TEXT PRIMARY KEY DEFAULT 'default',
      enabled BOOLEAN DEFAULT FALSE,
      signature_text TEXT,
      position TEXT DEFAULT 'bottom',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contact_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      remove_usernames BOOLEAN DEFAULT TRUE,
      remove_links BOOLEAN DEFAULT TRUE,
      remove_phones BOOLEAN DEFAULT TRUE,
      custom_replacements JSONB,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_logs_source_id ON logs(source_id);
    CREATE INDEX IF NOT EXISTS idx_sources_active ON sources(is_active);
    CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(status);
    CREATE INDEX IF NOT EXISTS idx_duplicate_hash ON duplicate_cache(message_hash);
    CREATE INDEX IF NOT EXISTS idx_duplicate_source_msg ON duplicate_cache(source_id, message_id);
  `;

  await pool.query(createTablesSQL);
  console.log('[DATABASE] Tables and indexes created or verified in PostgreSQL.');
}

/**
 * Requirement 6: Initialize default values ONLY if records do NOT already exist in PostgreSQL.
 * Never overwrite existing rows with defaults.
 */
async function initializeDefaultRecordsInPostgres() {
  if (!pool) return;

  // 1. settings
  await pool.query(`
    INSERT INTO settings (id, bot_token, destination_channel, admin_password_hash, is_monitoring_paused, is_verified)
    VALUES ('default', '', '', 'admin123', false, false)
    ON CONFLICT (id) DO NOTHING;
  `);

  // 2. telegram_client
  await pool.query(`
    INSERT INTO telegram_client (id, api_id, api_hash, phone_number, connected_phone, telegram_session, is_client_connected, is_monitoring_paused)
    VALUES ('default', 2040, 'b18441a1ed60741557078c33d425e276', '', '', '', false, false)
    ON CONFLICT (id) DO NOTHING;
  `);

  // 3. statistics
  await pool.query(`
    INSERT INTO statistics (id, total_transferred, failed_messages, start_time)
    VALUES ('default', 0, 0, '${new Date().toISOString()}')
    ON CONFLICT (id) DO NOTHING;
  `);

  // 4. ai_processing
  const defaultSig = `━━━━━━━━━━━━━━\\n📢 کانال رسمی اطلاع‌رسانی\\n@YourChannelID\\n━━━━━━━━━━━━━━`;
  await pool.query(`
    INSERT INTO ai_processing (
      id, enable_ai_processing, enabled, model, custom_prompt, translate_to_persian, sanitize_text, summarize,
      extract_keywords, format_markdown, style, target_language, enable_keyword_filter, keyword_match_mode,
      messages_passed, messages_blocked, enable_content_cleaning, remove_telegram_links, remove_instagram_links,
      remove_all_urls, remove_usernames, remove_hashtags, remove_emojis, enable_ai_rewrite, writing_style,
      custom_writing_style, enable_contact_manager, default_contact_note, enable_media_control, forward_photos,
      forward_videos, forward_pdfs, forward_documents, forward_audios, media_order, enable_duplicate_protection,
      duplicate_detection_type, time_window_hours, max_forwarding_count, enable_job_extraction, enable_message_signature,
      signature_text, add_signature_after_every_message
    )
    VALUES (
      'default', true, true, 'self-hosted', '', false, true, false,
      false, true, 'default', 'fa', false, 'any',
      0, 0, false, true, true,
      false, true, true, false, false, 'professional',
      '', false, '📌 جهت ارتباط با مدیر کانال در ارتباط باشید', false, true,
      true, true, true, true, 'media_first', false,
      'both', 1, 2, false, false,
      '${defaultSig}', true
    )
    ON CONFLICT (id) DO NOTHING;
  `);

  console.log('[DATABASE] Verified default singleton records in PostgreSQL.');
}

/**
 * Migration routine for legacy forwarder_store.json file.
 */
async function checkAndPerformMigration() {
  const jsonFilePath = path.join(process.cwd(), 'data', 'forwarder_store.json');
  const migratedFilePath = path.join(process.cwd(), 'data', 'forwarder_store.migrated.json');

  if (!fs.existsSync(jsonFilePath)) {
    return;
  }

  console.log('[MIGRATION] Found legacy forwarder_store.json. Migrating into PostgreSQL...');

  try {
    const rawData = fs.readFileSync(jsonFilePath, 'utf-8');
    const store = JSON.parse(rawData);

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Settings
        const encryptedBotToken = store.settings?.botToken ? encryptValue(store.settings.botToken) : '';
        await client.query(
          `INSERT INTO settings (id, bot_token, destination_channel, admin_password_hash, is_monitoring_paused)
           VALUES ('default', $1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
           bot_token = EXCLUDED.bot_token,
           destination_channel = EXCLUDED.destination_channel,
           admin_password_hash = EXCLUDED.admin_password_hash,
           is_monitoring_paused = EXCLUDED.is_monitoring_paused`,
          [
            encryptedBotToken,
            store.settings?.destinationChannel || '',
            store.adminPasswordHash || 'admin123',
            !!store.isMonitoringPaused,
          ]
        );

        // 2. Telegram Client
        const encryptedApiHash = store.telegramClientConfig?.apiHash ? encryptValue(store.telegramClientConfig.apiHash) : '';
        const encryptedPhone = store.telegramClientConfig?.phoneNumber ? encryptValue(store.telegramClientConfig.phoneNumber) : '';
        const encryptedSession = store.telegramSession ? encryptValue(store.telegramSession) : '';

        await client.query(
          `INSERT INTO telegram_client (id, api_id, api_hash, phone_number, connected_phone, telegram_session, is_client_connected)
           VALUES ('default', $1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
           api_id = EXCLUDED.api_id,
           api_hash = EXCLUDED.api_hash,
           phone_number = EXCLUDED.phone_number,
           connected_phone = EXCLUDED.connected_phone,
           telegram_session = EXCLUDED.telegram_session,
           is_client_connected = EXCLUDED.is_client_connected`,
          [
            store.telegramClientConfig?.apiId || 2040,
            encryptedApiHash,
            encryptedPhone,
            store.telegramClientConfig?.connectedPhone || encryptedPhone,
            encryptedSession,
            !!store.telegramClientConfig?.isClientConnected,
          ]
        );

        // 3. Statistics
        await client.query(
          `INSERT INTO statistics (id, total_transferred, failed_messages, start_time)
           VALUES ('default', $1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET
           total_transferred = EXCLUDED.total_transferred,
           failed_messages = EXCLUDED.failed_messages,
           start_time = EXCLUDED.start_time`,
          [
            store.stats?.totalTransferred || 0,
            store.stats?.failedMessages || 0,
            store.stats?.startTime || new Date().toISOString(),
          ]
        );

        // 4. Sources
        if (Array.isArray(store.sources)) {
          for (const src of store.sources) {
            await client.query(
              `INSERT INTO sources (id, title, name, username, type, status, is_channel, is_active, keyword_filter, content_cleaner, signature, cleaning_rules, footer_text, contact_settings, media_settings, ai_settings)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
               ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               name = EXCLUDED.name,
               username = EXCLUDED.username,
               type = EXCLUDED.type,
               status = EXCLUDED.status,
               is_channel = EXCLUDED.is_channel,
               is_active = EXCLUDED.is_active,
               keyword_filter = EXCLUDED.keyword_filter,
               content_cleaner = EXCLUDED.content_cleaner,
               signature = EXCLUDED.signature,
               cleaning_rules = EXCLUDED.cleaning_rules,
               footer_text = EXCLUDED.footer_text,
               contact_settings = EXCLUDED.contact_settings,
               media_settings = EXCLUDED.media_settings,
               ai_settings = EXCLUDED.ai_settings`,
              [
                src.id,
                src.title || src.name || 'Unnamed Channel',
                src.name || src.title || 'Unnamed Channel',
                src.username || '',
                src.type || 'channel',
                src.status || 'active',
                src.isChannel !== false,
                src.isActive !== false,
                JSON.stringify(src.keywordFilter || null),
                JSON.stringify(src.contentCleaner || null),
                src.signature || '',
                JSON.stringify(src.cleaningRules || null),
                src.footerText || '',
                JSON.stringify(src.contactSettings || null),
                JSON.stringify(src.mediaSettings || null),
                JSON.stringify(src.aiSettings || null),
              ]
            );
          }
        }

        await client.query('COMMIT');
        console.log('Saved to PostgreSQL successfully.');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    fs.renameSync(jsonFilePath, migratedFilePath);
    console.log('[MIGRATION] Migration finished. Renamed forwarder_store.json.');
  } catch (err: any) {
    console.error('[MIGRATION] Migration error:', err);
  }
}

/**
 * Requirement 4 & 5: Load full application state directly from PostgreSQL.
 */
export async function getStoreFromDb(): Promise<any> {
  if (!pool || !isDbConnected) {
    return null;
  }

  // 1. Settings
  const settingsRes = await pool.query(`SELECT * FROM settings WHERE id = 'default'`);
  const settingsRow = settingsRes.rows[0] || {};
  const botToken = settingsRow.bot_token ? decryptValue(settingsRow.bot_token) : '';

  // 2. Telegram Client
  const clientRes = await pool.query(`SELECT * FROM telegram_client WHERE id = 'default'`);
  const clientRow = clientRes.rows[0] || {};
  const apiHash = clientRow.api_hash ? decryptValue(clientRow.api_hash) : '';
  const phoneNumber = clientRow.phone_number ? decryptValue(clientRow.phone_number) : '';
  const session = clientRow.telegram_session ? decryptValue(clientRow.telegram_session) : '';

  // 3. AI Processing
  const aiRes = await pool.query(`SELECT * FROM ai_processing WHERE id = 'default'`);
  const aiRow = aiRes.rows[0] || {};
  const aiApiKey = aiRow.api_key ? decryptValue(aiRow.api_key) : '';

  // 4. Statistics
  const statsRes = await pool.query(`SELECT * FROM statistics WHERE id = 'default'`);
  const statsRow = statsRes.rows[0] || {};

  // 5. Sources
  const sourcesRes = await pool.query(`SELECT * FROM sources ORDER BY created_at ASC`);
  const sources = sourcesRes.rows.map((row) => ({
    id: row.id,
    title: row.title || row.name || 'نامشخص',
    name: row.name || row.title || 'نامشخص',
    username: row.username || '',
    type: row.type || 'channel',
    status: row.status || 'active',
    isChannel: row.is_channel !== false,
    isActive: row.is_active !== false,
    lastCheckedAt: row.last_checked_at || undefined,
    lastMessageId: row.last_message_id || 0,
    totalTransferred: row.total_transferred || 0,
    errorMessage: row.error_message || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    avatarUrl: row.avatar_url || undefined,
    subscriberCount: row.subscriber_count || undefined,
    numericId: row.numeric_id || undefined,
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    enableKeywords: !!row.enable_keywords,
    keywordMatchMode: row.keyword_match_mode || 'any',
    keywordFilter: row.keyword_filter || null,
    contentCleaner: row.content_cleaner || null,
    signature: row.signature || '',
    cleaningRules: Array.isArray(row.cleaning_rules) ? row.cleaning_rules : null,
    footerText: row.footer_text || '',
    contactSettings: row.contact_settings || null,
    mediaSettings: row.media_settings || null,
    aiSettings: row.ai_settings || null,
  }));

  // 6. Logs (Limit to last 500)
  const logsRes = await pool.query(`SELECT * FROM logs ORDER BY created_at DESC LIMIT 500`);
  const logs = logsRes.rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    sourceId: row.source_id || '',
    sourceUsername: row.source_username || '',
    sourceTitle: row.source_title || row.channel_name || '',
    messageId: row.message_id || 0,
    contentType: row.content_type || 'text',
    status: row.status || 'success',
    details: row.details || '',
    destinationChannel: row.destination_channel || '',
    channelName: row.channel_name || '',
    mediaType: row.media_type || '',
    isFiltered: !!row.is_filtered,
  }));

  const aiProcessingConfig = {
    enableAiProcessing: aiRow.enable_ai_processing !== false,
    enabled: aiRow.enabled !== false,
    apiKey: aiApiKey,
    model: aiRow.model || 'self-hosted',
    customPrompt: aiRow.custom_prompt || '',
    translateToPersian: !!aiRow.translate_to_persian,
    sanitizeText: aiRow.sanitize_text !== false,
    summarize: !!aiRow.summarize,
    extractKeywords: !!aiRow.extract_keywords,
    formatMarkdown: aiRow.format_markdown !== false,
    style: aiRow.style || 'default',
    targetLanguage: aiRow.target_language || 'fa',
    enableKeywordFilter: !!aiRow.enable_keyword_filter,
    allowedKeywords: Array.isArray(aiRow.allowed_keywords) ? aiRow.allowed_keywords : [],
    blockedKeywords: Array.isArray(aiRow.blocked_keywords) ? aiRow.blocked_keywords : [],
    keywordMatchMode: aiRow.keyword_match_mode || 'any',
    messagesPassed: aiRow.messages_passed || 0,
    messagesBlocked: aiRow.messages_blocked || 0,
    enableContentCleaning: !!aiRow.enable_content_cleaning,
    cleaningRules: Array.isArray(aiRow.cleaning_rules) ? aiRow.cleaning_rules : ['https://', 'http://', '@', '#'],
    removeTelegramLinks: aiRow.remove_telegram_links !== false,
    removeInstagramLinks: aiRow.remove_instagram_links !== false,
    removeAllUrls: !!aiRow.remove_all_urls,
    removeUsernames: aiRow.remove_usernames !== false,
    removeHashtags: aiRow.remove_hashtags !== false,
    removeEmojis: !!aiRow.remove_emojis,
    ai_rewrite_enabled: aiRow.ai_rewrite_enabled !== undefined ? !!aiRow.ai_rewrite_enabled : !!aiRow.enable_ai_rewrite,
    aiRewriteEnabled: aiRow.ai_rewrite_enabled !== undefined ? !!aiRow.ai_rewrite_enabled : !!aiRow.enable_ai_rewrite,
    enableAiRewrite: aiRow.ai_rewrite_enabled !== undefined ? !!aiRow.ai_rewrite_enabled : !!aiRow.enable_ai_rewrite,
    ai_rewrite_style: aiRow.ai_rewrite_style || 'formal_news',
    ai_rewrite_intensity: aiRow.ai_rewrite_intensity || 'medium',
    ai_rewrite_custom_prompt: aiRow.ai_rewrite_custom_prompt || '',
    ai_rewrite_max_length: aiRow.ai_rewrite_max_length || 2000,
    rewrite_style: aiRow.rewrite_style || aiRow.writing_style || 'formal_news',
    rewriteStyle: aiRow.rewrite_style || aiRow.writing_style || 'formal_news',
    writingStyle: aiRow.rewrite_style || aiRow.writing_style || 'formal',
    customWritingStyle: aiRow.custom_writing_style || '',
    enableContactManager: !!aiRow.enable_contact_manager,
    defaultContactNote: aiRow.default_contact_note || '📌 جهت ارتباط با مدیر کانال در ارتباط باشید',
    enableMediaControl: !!aiRow.enable_media_control,
    forwardPhotos: aiRow.forward_photos !== false,
    forwardVideos: aiRow.forward_videos !== false,
    forwardPdfs: aiRow.forward_pdfs !== false,
    forwardDocuments: aiRow.forward_documents !== false,
    forwardAudios: aiRow.forward_audios !== false,
    mediaOrder: aiRow.media_order || 'media_first',
    enableDuplicateProtection: !!aiRow.enable_duplicate_protection,
    duplicateDetectionType: aiRow.duplicate_detection_type || 'both',
    timeWindowHours: aiRow.time_window_hours || 1,
    maxForwardingCount: aiRow.max_forwarding_count || 2,
    enableJobExtraction: !!aiRow.enable_job_extraction,
    enableMessageSignature: !!aiRow.enable_message_signature,
    signatureText: aiRow.signature_text || `━━━━━━━━━━━━━━\n📢 کانال رسمی اطلاع‌رسانی\n@YourChannelID\n━━━━━━━━━━━━━━`,
    addSignatureAfterEveryMessage: aiRow.add_signature_after_every_message !== false,
    promptTemplates: aiRow.prompt_templates || null,
    wordFilters: aiRow.word_filters || null,
    replaceWords: aiRow.replace_words || null,
    blacklist: aiRow.blacklist || null,
    whitelist: aiRow.whitelist || null,
    contactSettings: aiRow.contact_settings || null,
    forwardingSettings: aiRow.forwarding_settings || null,
  };

  return {
    adminPasswordHash: settingsRow.admin_password_hash || 'admin123',
    telegramClientConfig: {
      apiId: clientRow.api_id || 2040,
      apiHash,
      phoneNumber,
      session,
      isConnected: !!clientRow.is_client_connected,
      isMonitoringPaused: !!clientRow.is_monitoring_paused,
      connectedPhone: clientRow.connected_phone || phoneNumber,
      lastConnectedAt: clientRow.last_connected_at || '',
    },
    telegramSession: session,
    isMonitoringPaused: !!settingsRow.is_monitoring_paused,
    settings: {
      botToken,
      destinationChannel: settingsRow.destination_channel || '',
      isVerified: !!settingsRow.is_verified,
      globalKeywords: Array.isArray(settingsRow.global_keywords) ? settingsRow.global_keywords : [],
      globalForbiddenKeywords: Array.isArray(settingsRow.global_forbidden_keywords) ? settingsRow.global_forbidden_keywords : [],
      enableGlobalKeywords: !!settingsRow.enable_global_keywords,
      globalKeywordMatchMode: settingsRow.global_keyword_match_mode || 'any',
      rateLimits: settingsRow.rate_limits || null,
      panelConfig: settingsRow.panel_config || null,
      forwardingSettings: settingsRow.forwarding_settings || null,
      aiProcessing: aiProcessingConfig,
    },
    sources,
    logs,
    processedMessageIds: {},
    stats: {
      totalTransferred: statsRow.total_transferred || 0,
      failedMessages: statsRow.failed_messages || 0,
      startTime: statsRow.start_time || new Date().toISOString(),
      lastBackupTime: statsRow.last_backup_time || null,
    },
  };
}

/**
 * Requirement 3, 8, 9, 13: Save main settings into PostgreSQL in a transaction.
 */
export async function saveSettingsToDb(settingsData: any): Promise<void> {
  if (!pool || !isDbConnected) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const encryptedBotToken = settingsData.botToken ? encryptValue(settingsData.botToken) : '';
    await client.query(
      `INSERT INTO settings (
        id, bot_token, destination_channel, admin_password_hash, is_monitoring_paused, is_verified,
        global_keywords, global_forbidden_keywords, enable_global_keywords, global_keyword_match_mode,
        rate_limits, panel_config, forwarding_settings, updated_at
      )
      VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (id) DO UPDATE SET
      bot_token = COALESCE(NULLIF(EXCLUDED.bot_token, ''), settings.bot_token),
      destination_channel = EXCLUDED.destination_channel,
      admin_password_hash = EXCLUDED.admin_password_hash,
      is_monitoring_paused = EXCLUDED.is_monitoring_paused,
      is_verified = EXCLUDED.is_verified,
      global_keywords = EXCLUDED.global_keywords,
      global_forbidden_keywords = EXCLUDED.global_forbidden_keywords,
      enable_global_keywords = EXCLUDED.enable_global_keywords,
      global_keyword_match_mode = EXCLUDED.global_keyword_match_mode,
      rate_limits = EXCLUDED.rate_limits,
      panel_config = EXCLUDED.panel_config,
      forwarding_settings = EXCLUDED.forwarding_settings,
      updated_at = NOW()`,
      [
        encryptedBotToken,
        settingsData.destinationChannel || '',
        settingsData.adminPasswordHash || 'admin123',
        !!settingsData.isMonitoringPaused,
        !!settingsData.isVerified,
        JSON.stringify(settingsData.globalKeywords || []),
        JSON.stringify(settingsData.globalForbiddenKeywords || []),
        !!settingsData.enableGlobalKeywords,
        settingsData.globalKeywordMatchMode || 'any',
        JSON.stringify(settingsData.rateLimits || null),
        JSON.stringify(settingsData.panelConfig || null),
        JSON.stringify(settingsData.forwardingSettings || null),
      ]
    );

    await client.query('COMMIT');
    console.log('Saved to PostgreSQL successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DATABASE ERROR] Failed to save settings:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Requirement 3, 8, 9, 13: Save AI Processing settings into PostgreSQL in a transaction.
 */
export async function saveAiProcessingToDb(ai: any): Promise<void> {
  if (!pool || !isDbConnected) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const encryptedAiKey = ai.apiKey ? encryptValue(ai.apiKey) : '';
    await client.query(
      `INSERT INTO ai_processing (
        id, enable_ai_processing, enabled, api_key, model, custom_prompt, translate_to_persian, sanitize_text, summarize,
        extract_keywords, format_markdown, style, target_language, enable_keyword_filter, allowed_keywords, blocked_keywords,
        keyword_match_mode, messages_passed, messages_blocked, enable_content_cleaning, cleaning_rules, remove_telegram_links,
        remove_instagram_links, remove_all_urls, remove_usernames, remove_hashtags, remove_emojis, ai_rewrite_enabled, enable_ai_rewrite,
        ai_rewrite_style, ai_rewrite_intensity, ai_rewrite_custom_prompt, ai_rewrite_max_length,
        rewrite_style, writing_style, custom_writing_style, enable_contact_manager, default_contact_note, enable_media_control, forward_photos,
        forward_videos, forward_pdfs, forward_documents, forward_audios, media_order, enable_duplicate_protection,
        duplicate_detection_type, time_window_hours, max_forwarding_count, enable_job_extraction, enable_message_signature,
        signature_text, add_signature_after_every_message, prompt_templates, word_filters, replace_words, blacklist, whitelist,
        contact_settings, forwarding_settings, updated_at
      )
      VALUES (
        'default', $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32, $33,
        $34, $35, $36, $37, $38, $39,
        $40, $41, $42, $43, $44,
        $45, $46, $47, $48, $49, $50, $51,
        $52, $53, $54, $55, $56, $57, $58, $59, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
      enable_ai_processing = EXCLUDED.enable_ai_processing,
      enabled = EXCLUDED.enabled,
      api_key = COALESCE(NULLIF(EXCLUDED.api_key, ''), ai_processing.api_key),
      model = EXCLUDED.model,
      custom_prompt = EXCLUDED.custom_prompt,
      translate_to_persian = EXCLUDED.translate_to_persian,
      sanitize_text = EXCLUDED.sanitize_text,
      summarize = EXCLUDED.summarize,
      extract_keywords = EXCLUDED.extract_keywords,
      format_markdown = EXCLUDED.format_markdown,
      style = EXCLUDED.style,
      target_language = EXCLUDED.target_language,
      enable_keyword_filter = EXCLUDED.enable_keyword_filter,
      allowed_keywords = EXCLUDED.allowed_keywords,
      blocked_keywords = EXCLUDED.blocked_keywords,
      keyword_match_mode = EXCLUDED.keyword_match_mode,
      messages_passed = EXCLUDED.messages_passed,
      messages_blocked = EXCLUDED.messages_blocked,
      enable_content_cleaning = EXCLUDED.enable_content_cleaning,
      cleaning_rules = EXCLUDED.cleaning_rules,
      remove_telegram_links = EXCLUDED.remove_telegram_links,
      remove_instagram_links = EXCLUDED.remove_instagram_links,
      remove_all_urls = EXCLUDED.remove_all_urls,
      remove_usernames = EXCLUDED.remove_usernames,
      remove_hashtags = EXCLUDED.remove_hashtags,
      remove_emojis = EXCLUDED.remove_emojis,
      ai_rewrite_enabled = EXCLUDED.ai_rewrite_enabled,
      enable_ai_rewrite = EXCLUDED.enable_ai_rewrite,
      ai_rewrite_style = EXCLUDED.ai_rewrite_style,
      ai_rewrite_intensity = EXCLUDED.ai_rewrite_intensity,
      ai_rewrite_custom_prompt = EXCLUDED.ai_rewrite_custom_prompt,
      ai_rewrite_max_length = EXCLUDED.ai_rewrite_max_length,
      rewrite_style = EXCLUDED.rewrite_style,
      writing_style = EXCLUDED.writing_style,
      custom_writing_style = EXCLUDED.custom_writing_style,
      enable_contact_manager = EXCLUDED.enable_contact_manager,
      default_contact_note = EXCLUDED.default_contact_note,
      enable_media_control = EXCLUDED.enable_media_control,
      forward_photos = EXCLUDED.forward_photos,
      forward_videos = EXCLUDED.forward_videos,
      forward_pdfs = EXCLUDED.forward_pdfs,
      forward_documents = EXCLUDED.forward_documents,
      forward_audios = EXCLUDED.forward_audios,
      media_order = EXCLUDED.media_order,
      enable_duplicate_protection = EXCLUDED.enable_duplicate_protection,
      duplicate_detection_type = EXCLUDED.duplicate_detection_type,
      time_window_hours = EXCLUDED.time_window_hours,
      max_forwarding_count = EXCLUDED.max_forwarding_count,
      enable_job_extraction = EXCLUDED.enable_job_extraction,
      enable_message_signature = EXCLUDED.enable_message_signature,
      signature_text = EXCLUDED.signature_text,
      add_signature_after_every_message = EXCLUDED.add_signature_after_every_message,
      prompt_templates = EXCLUDED.prompt_templates,
      word_filters = EXCLUDED.word_filters,
      replace_words = EXCLUDED.replace_words,
      blacklist = EXCLUDED.blacklist,
      whitelist = EXCLUDED.whitelist,
      contact_settings = EXCLUDED.contact_settings,
      forwarding_settings = EXCLUDED.forwarding_settings,
      updated_at = NOW()`,
      [
        ai.enableAiProcessing !== false,
        ai.enabled !== false,
        encryptedAiKey,
        ai.model || 'self-hosted',
        ai.customPrompt || '',
        !!ai.translateToPersian,
        ai.sanitizeText !== false,
        !!ai.summarize,
        !!ai.extractKeywords,
        ai.formatMarkdown !== false,
        ai.style || 'default',
        ai.targetLanguage || 'fa',
        !!ai.enableKeywordFilter,
        JSON.stringify(ai.allowedKeywords || []),
        JSON.stringify(ai.blockedKeywords || []),
        ai.keywordMatchMode || 'any',
        ai.messagesPassed || 0,
        ai.messagesBlocked || 0,
        !!ai.enableContentCleaning,
        JSON.stringify(ai.cleaningRules || ['https://', 'http://', '@', '#']),
        ai.removeTelegramLinks !== false,
        ai.removeInstagramLinks !== false,
        !!ai.removeAllUrls,
        ai.removeUsernames !== false,
        ai.removeHashtags !== false,
        !!ai.removeEmojis,
        !!(ai.ai_rewrite_enabled ?? ai.aiRewriteEnabled ?? ai.enableAiRewrite),
        !!(ai.ai_rewrite_enabled ?? ai.aiRewriteEnabled ?? ai.enableAiRewrite),
        ai.ai_rewrite_style || ai.rewrite_style || 'formal_news',
        ai.ai_rewrite_intensity || 'medium',
        ai.ai_rewrite_custom_prompt || '',
        ai.ai_rewrite_max_length || 2000,
        ai.rewrite_style || ai.rewriteStyle || ai.writingStyle || 'formal_news',
        ai.rewrite_style || ai.rewriteStyle || ai.writingStyle || 'formal',
        ai.customWritingStyle || '',
        !!ai.enableContactManager,
        ai.defaultContactNote || '📌 جهت ارتباط با مدیر کانال در ارتباط باشید',
        !!ai.enableMediaControl,
        ai.forwardPhotos !== false,
        ai.forwardVideos !== false,
        ai.forwardPdfs !== false,
        ai.forwardDocuments !== false,
        ai.forwardAudios !== false,
        ai.mediaOrder || 'media_first',
        !!ai.enableDuplicateProtection,
        ai.duplicateDetectionType || 'both',
        ai.timeWindowHours || 1,
        ai.maxForwardingCount || 2,
        !!ai.enableJobExtraction,
        !!ai.enableMessageSignature,
        ai.signatureText || '',
        ai.addSignatureAfterEveryMessage !== false,
        JSON.stringify(ai.promptTemplates || null),
        JSON.stringify(ai.wordFilters || null),
        JSON.stringify(ai.replaceWords || null),
        JSON.stringify(ai.blacklist || null),
        JSON.stringify(ai.whitelist || null),
        JSON.stringify(ai.contactSettings || null),
        JSON.stringify(ai.forwardingSettings || null),
      ]
    );

    await client.query('COMMIT');
    console.log('Saved to PostgreSQL successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DATABASE ERROR] Failed to save AI processing:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Requirement 3, 8, 9, 13: Save Telegram Client configuration into PostgreSQL in a transaction.
 */
export async function saveTelegramClientConfigToDb(clientConfig: any, sessionStr?: string): Promise<void> {
  if (!pool || !isDbConnected) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const encryptedApiHash = clientConfig.apiHash ? encryptValue(clientConfig.apiHash) : '';
    const encryptedPhone = clientConfig.phoneNumber ? encryptValue(clientConfig.phoneNumber) : '';
    const finalSession = sessionStr || clientConfig.session || '';
    const encryptedSession = finalSession ? encryptValue(finalSession) : '';

    await client.query(
      `INSERT INTO telegram_client (
        id, api_id, api_hash, phone_number, connected_phone, telegram_session, is_client_connected, is_monitoring_paused, last_connected_at, updated_at
      )
      VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO UPDATE SET
      api_id = EXCLUDED.api_id,
      api_hash = COALESCE(NULLIF(EXCLUDED.api_hash, ''), telegram_client.api_hash),
      phone_number = EXCLUDED.phone_number,
      connected_phone = EXCLUDED.connected_phone,
      telegram_session = COALESCE(NULLIF(EXCLUDED.telegram_session, ''), telegram_client.telegram_session),
      is_client_connected = EXCLUDED.is_client_connected,
      is_monitoring_paused = EXCLUDED.is_monitoring_paused,
      last_connected_at = EXCLUDED.last_connected_at,
      updated_at = NOW()`,
      [
        clientConfig.apiId || 2040,
        encryptedApiHash,
        encryptedPhone,
        clientConfig.connectedPhone || encryptedPhone,
        encryptedSession,
        !!clientConfig.isConnected,
        !!clientConfig.isMonitoringPaused,
        clientConfig.lastConnectedAt || new Date().toISOString(),
      ]
    );

    await client.query('COMMIT');
    console.log('Saved to PostgreSQL successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DATABASE ERROR] Failed to save Telegram client config:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Requirement 3, 9, 13: Save a single monitoring source into PostgreSQL in a transaction.
 */
export async function saveSourceToDb(src: any): Promise<void> {
  if (!pool || !isDbConnected) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO sources (
        id, title, name, username, type, status, is_channel, is_active, last_checked_at, last_message_id,
        total_transferred, error_message, created_at, avatar_url, subscriber_count, numeric_id, keywords, enable_keywords,
        keyword_match_mode, keyword_filter, content_cleaner, signature, cleaning_rules, footer_text, contact_settings,
        media_settings, ai_settings, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW())
      ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      name = EXCLUDED.name,
      username = EXCLUDED.username,
      type = EXCLUDED.type,
      status = EXCLUDED.status,
      is_channel = EXCLUDED.is_channel,
      is_active = EXCLUDED.is_active,
      last_checked_at = EXCLUDED.last_checked_at,
      last_message_id = EXCLUDED.last_message_id,
      total_transferred = EXCLUDED.total_transferred,
      error_message = EXCLUDED.error_message,
      avatar_url = EXCLUDED.avatar_url,
      subscriber_count = EXCLUDED.subscriber_count,
      numeric_id = COALESCE(EXCLUDED.numeric_id, sources.numeric_id),
      keywords = EXCLUDED.keywords,
      enable_keywords = EXCLUDED.enable_keywords,
      keyword_match_mode = EXCLUDED.keyword_match_mode,
      keyword_filter = EXCLUDED.keyword_filter,
      content_cleaner = EXCLUDED.content_cleaner,
      signature = EXCLUDED.signature,
      cleaning_rules = EXCLUDED.cleaning_rules,
      footer_text = EXCLUDED.footer_text,
      contact_settings = EXCLUDED.contact_settings,
      media_settings = EXCLUDED.media_settings,
      ai_settings = EXCLUDED.ai_settings,
      updated_at = NOW()`,
      [
        src.id,
        src.title || src.name || 'Unnamed Channel',
        src.name || src.title || 'Unnamed Channel',
        src.username || '',
        src.type || 'channel',
        src.status || 'active',
        src.isChannel !== false,
        src.isActive !== false,
        src.lastCheckedAt || new Date().toISOString(),
        src.lastMessageId || 0,
        src.totalTransferred || 0,
        src.errorMessage || null,
        src.createdAt || new Date().toISOString(),
        src.avatarUrl || null,
        src.subscriberCount || null,
        src.numericId || null,
        JSON.stringify(src.keywords || []),
        !!src.enableKeywords,
        src.keywordMatchMode || 'any',
        JSON.stringify(src.keywordFilter || null),
        JSON.stringify(src.contentCleaner || null),
        src.signature || '',
        JSON.stringify(src.cleaningRules || null),
        src.footerText || '',
        JSON.stringify(src.contactSettings || null),
        JSON.stringify(src.mediaSettings || null),
        JSON.stringify(src.aiSettings || null),
      ]
    );

    await client.query('COMMIT');
    console.log('Saved to PostgreSQL successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DATABASE ERROR] Failed to save source:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Requirement 3, 9, 13: Bulk save multiple sources in a single PostgreSQL transaction.
 */
export async function bulkSaveSourcesToDb(sources: any[]): Promise<void> {
  if (!pool || !isDbConnected) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const src of sources) {
      await client.query(
        `INSERT INTO sources (
          id, title, name, username, type, status, is_channel, is_active, last_checked_at, last_message_id,
          total_transferred, error_message, created_at, avatar_url, subscriber_count, numeric_id, keywords, enable_keywords,
          keyword_match_mode, keyword_filter, content_cleaner, signature, cleaning_rules, footer_text, contact_settings,
          media_settings, ai_settings, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW())
        ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        name = EXCLUDED.name,
        username = EXCLUDED.username,
        type = EXCLUDED.type,
        status = EXCLUDED.status,
        is_channel = EXCLUDED.is_channel,
        is_active = EXCLUDED.is_active,
        last_checked_at = EXCLUDED.last_checked_at,
        last_message_id = EXCLUDED.last_message_id,
        total_transferred = EXCLUDED.total_transferred,
        error_message = EXCLUDED.error_message,
        avatar_url = EXCLUDED.avatar_url,
        subscriber_count = EXCLUDED.subscriber_count,
        numeric_id = COALESCE(EXCLUDED.numeric_id, sources.numeric_id),
        keywords = EXCLUDED.keywords,
        enable_keywords = EXCLUDED.enable_keywords,
        keyword_match_mode = EXCLUDED.keyword_match_mode,
        keyword_filter = EXCLUDED.keyword_filter,
        content_cleaner = EXCLUDED.content_cleaner,
        signature = EXCLUDED.signature,
        cleaning_rules = EXCLUDED.cleaning_rules,
        footer_text = EXCLUDED.footer_text,
        contact_settings = EXCLUDED.contact_settings,
        media_settings = EXCLUDED.media_settings,
        ai_settings = EXCLUDED.ai_settings,
        updated_at = NOW()`,
        [
          src.id,
          src.title || src.name || 'Unnamed Channel',
          src.name || src.title || 'Unnamed Channel',
          src.username || '',
          src.type || 'channel',
          src.status || 'active',
          src.isChannel !== false,
          src.isActive !== false,
          src.lastCheckedAt || new Date().toISOString(),
          src.lastMessageId || 0,
          src.totalTransferred || 0,
          src.errorMessage || null,
          src.createdAt || new Date().toISOString(),
          src.avatarUrl || null,
          src.subscriberCount || null,
          src.numericId || null,
          JSON.stringify(src.keywords || []),
          !!src.enableKeywords,
          src.keywordMatchMode || 'any',
          JSON.stringify(src.keywordFilter || null),
          JSON.stringify(src.contentCleaner || null),
          src.signature || '',
          JSON.stringify(src.cleaningRules || null),
          src.footerText || '',
          JSON.stringify(src.contactSettings || null),
          JSON.stringify(src.mediaSettings || null),
          JSON.stringify(src.aiSettings || null),
        ]
      );
    }

    await client.query('COMMIT');
    console.log('Saved to PostgreSQL successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DATABASE ERROR] Failed to bulk save sources:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Requirement 3, 9, 13: Delete source from PostgreSQL in a transaction.
 */
export async function deleteSourceFromDb(id: string): Promise<void> {
  if (!pool || !isDbConnected) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM sources WHERE id = $1`, [id]);
    await client.query(`DELETE FROM duplicate_cache WHERE source_id = $1`, [id]);
    await client.query('COMMIT');
    console.log('Saved to PostgreSQL successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DATABASE ERROR] Error deleting source:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Requirement 3, 9, 13: Add an activity log into PostgreSQL in a transaction.
 */
export async function addLogToDb(log: any): Promise<void> {
  if (!pool || !isDbConnected) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO logs (
        id, timestamp, type, text, source_id, source_username, source_title, channel_name, message_id,
        content_type, media_type, status, details, destination_channel, is_filtered
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO NOTHING`,
      [
        log.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        log.timestamp || new Date().toISOString(),
        log.type || 'info',
        log.text || log.details || '',
        log.sourceId || '',
        log.sourceUsername || '',
        log.sourceTitle || log.channelName || '',
        log.sourceTitle || log.channelName || '',
        log.messageId || 0,
        log.contentType || 'text',
        log.mediaType || '',
        log.status || 'success',
        log.details || '',
        log.destinationChannel || '',
        !!log.isFiltered,
      ]
    );
    await client.query('COMMIT');
    console.log('Saved to PostgreSQL successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DATABASE ERROR] Error adding log:', err);
  } finally {
    client.release();
  }
}

/**
 * Requirement 3, 9, 13: Clear all activity logs from PostgreSQL in a transaction.
 */
export async function clearLogsInDb(): Promise<void> {
  if (!pool || !isDbConnected) throw new Error('[DATABASE ERROR] PostgreSQL is not connected.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`TRUNCATE TABLE logs`);
    await client.query('COMMIT');
    console.log('Saved to PostgreSQL successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DATABASE ERROR] Error clearing logs:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Requirement 3, 9, 13: Update statistics table in PostgreSQL.
 */
export async function updateStatsInDb(stats: any): Promise<void> {
  if (!pool || !isDbConnected) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO statistics (id, total_transferred, failed_messages, start_time, last_backup_time, updated_at)
       VALUES ('default', $1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
       total_transferred = EXCLUDED.total_transferred,
       failed_messages = EXCLUDED.failed_messages,
       start_time = EXCLUDED.start_time,
       last_backup_time = EXCLUDED.last_backup_time,
       updated_at = NOW()`,
      [
        stats.totalTransferred || 0,
        stats.failedMessages || 0,
        stats.startTime || new Date().toISOString(),
        stats.lastBackupTime || null,
      ]
    );
    await client.query('COMMIT');
    console.log('Saved to PostgreSQL successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DATABASE ERROR] Error updating stats:', err);
  } finally {
    client.release();
  }
}

/**
 * Requirement 3, 9: Duplicate cache protection with PostgreSQL.
 */
export async function isDuplicateMessageInDb(sourceId: string, messageId: number, messageHash?: string): Promise<boolean> {
  if (!pool || !isDbConnected) return false;

  try {
    if (messageHash) {
      const res = await pool.query(
        `SELECT id FROM duplicate_cache WHERE message_hash = $1 OR (source_id = $2 AND message_id = $3) LIMIT 1`,
        [messageHash, sourceId, messageId]
      );
      return res.rows.length > 0;
    } else {
      const res = await pool.query(
        `SELECT id FROM duplicate_cache WHERE source_id = $1 AND message_id = $2 LIMIT 1`,
        [sourceId, messageId]
      );
      return res.rows.length > 0;
    }
  } catch (err) {
    console.error('[DATABASE ERROR] Error checking duplicate cache:', err);
    return false;
  }
}

export async function addDuplicateMessageToDb(sourceId: string, messageId: number, messageHash?: string): Promise<void> {
  if (!pool || !isDbConnected) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = `dup_${sourceId}_${messageId}_${Date.now()}`;
    const hash = messageHash || `${sourceId}_${messageId}`;

    await client.query(
      `INSERT INTO duplicate_cache (id, source_id, message_id, message_hash, timestamp)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [id, sourceId, messageId, hash]
    );
    await client.query('COMMIT');
    console.log('Saved to PostgreSQL successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DATABASE ERROR] Error adding duplicate cache record:', err);
  } finally {
    client.release();
  }
}

/**
 * Requirement 4: Directly queries PostgreSQL for the latest destination channel setting.
 */
export async function getLatestDestinationChannelFromDb(): Promise<string> {
  if (pool && isDbConnected) {
    try {
      const res = await pool.query(`SELECT destination_channel FROM settings WHERE id = 'default'`);
      if (res.rows.length > 0 && res.rows[0].destination_channel) {
        return res.rows[0].destination_channel.trim();
      }
    } catch (err) {
      console.error('[DATABASE ERROR] Error reading latest destination channel:', err);
    }
  }
  return '';
}

/**
 * Fetches database health check, version, size, and table row statistics.
 */
export async function getDatabaseHealth() {
  if (!pool || !isDbConnected) {
    throw new Error('[DATABASE ERROR] PostgreSQL is not connected.');
  }

  try {
    const versionRes = await pool.query(`SELECT version()`);
    const version = versionRes.rows[0]?.version || 'PostgreSQL';

    const sizeRes = await pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
    const databaseSize = sizeRes.rows[0]?.size || '0 MB';

    const tablesRes = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const tables = tablesRes.rows.map((r) => r.table_name);

    const sourcesCountRes = await pool.query(`SELECT COUNT(*) FROM sources`);
    const logsCountRes = await pool.query(`SELECT COUNT(*) FROM logs`);
    const statsRes = await pool.query(`SELECT * FROM statistics WHERE id = 'default'`);
    const clientRes = await pool.query(`SELECT phone_number FROM telegram_client WHERE id = 'default'`);

    let cleanerRulesCount = 0;
    const rulesRes = await pool.query(`SELECT cleaning_rules FROM sources WHERE cleaning_rules IS NOT NULL`);
    for (const r of rulesRes.rows) {
      if (Array.isArray(r.cleaning_rules)) {
        cleanerRulesCount += r.cleaning_rules.length;
      }
    }

    return {
      connected: true,
      version,
      databaseSize,
      tables,
      monitoredChannels: parseInt(sourcesCountRes.rows[0].count, 10),
      telegramAccounts: clientRes.rows[0]?.phone_number ? 1 : 0,
      cleanerRulesCount,
      lastBackupTime: statsRes.rows[0]?.last_backup_time || 'ثبت نشده',
      tableCounts: {
        sources: parseInt(sourcesCountRes.rows[0].count, 10),
        logs: parseInt(logsCountRes.rows[0].count, 10),
        settings: 1,
      },
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message,
      version: 'Error',
      databaseSize: 'N/A',
      tables: [],
      monitoredChannels: 0,
      telegramAccounts: 0,
      cleanerRulesCount: 0,
      lastBackupTime: 'ثبت نشده',
      tableCounts: {},
    };
  }
}

/**
 * Exports complete database content directly from PostgreSQL as JSON.
 */
export async function exportDatabaseData(includeSecrets = false, fallbackStore?: any) {
  let store = await getStoreFromDb();

  if (!store) {
    if (fallbackStore) {
      store = JSON.parse(JSON.stringify(fallbackStore));
    } else {
      const jsonFilePath = path.join(process.cwd(), 'data', 'forwarder_store.json');
      if (fs.existsSync(jsonFilePath)) {
        try {
          store = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
        } catch (_) {}
      }
    }
  }

  if (!store) {
    store = {
      settings: {},
      sources: [],
      logs: [],
      stats: { totalTransferred: 0, failedMessages: 0, startTime: new Date().toISOString() },
    };
  }

  if (!includeSecrets) {
    if (store.settings) {
      store.settings = {
        ...store.settings,
        botToken: store.settings.botToken ? '[REDACTED_SECRET]' : '',
      };
    }
    if (store.telegramClientConfig) {
      store.telegramClientConfig = {
        ...store.telegramClientConfig,
        apiHash: store.telegramClientConfig.apiHash ? '[REDACTED_SECRET]' : '',
      };
    }
    store.telegramSession = store.telegramSession ? '[REDACTED_SECRET]' : '';
    if (store.settings?.aiProcessing) {
      store.settings.aiProcessing = {
        ...store.settings.aiProcessing,
        apiKey: store.settings.aiProcessing.apiKey ? '[REDACTED_SECRET]' : '',
      };
    }
  }

  const now = new Date().toISOString();
  if (!store.stats) {
    store.stats = { totalTransferred: 0, failedMessages: 0, startTime: now };
  }
  store.stats.lastBackupTime = now;

  if (pool && isDbConnected) {
    await updateStatsInDb(store.stats);
  }

  return store;
}

/**
 * Imports JSON data directly into PostgreSQL tables in transactions.
 */
export async function importDatabaseData(data: any) {
  if (!data || typeof data !== 'object') {
    throw new Error('فایل پشتیبان وارد شده معتبر نمی‌باشد.');
  }

  const currentStore = await getStoreFromDb();

  // Preserve existing secrets if redacted in backup
  if (data.settings?.botToken === '[REDACTED_SECRET]') {
    data.settings.botToken = currentStore.settings?.botToken || '';
  }
  if (data.telegramClientConfig?.apiHash === '[REDACTED_SECRET]') {
    data.telegramClientConfig.apiHash = currentStore.telegramClientConfig?.apiHash || '';
  }
  if (data.telegramSession === '[REDACTED_SECRET]') {
    data.telegramSession = currentStore.telegramSession || '';
  }
  if (data.settings?.aiProcessing?.apiKey === '[REDACTED_SECRET]') {
    data.settings.aiProcessing.apiKey = currentStore.settings?.aiProcessing?.apiKey || '';
  }

  const mergedSettings = { ...currentStore.settings, ...(data.settings || {}) };
  const mergedAi = { ...currentStore.settings?.aiProcessing, ...(data.settings?.aiProcessing || {}) };
  const mergedClient = { ...currentStore.telegramClientConfig, ...(data.telegramClientConfig || {}) };

  await saveSettingsToDb(mergedSettings);
  await saveAiProcessingToDb(mergedAi);
  await saveTelegramClientConfigToDb(mergedClient, data.telegramSession);

  if (Array.isArray(data.sources)) {
    await bulkSaveSourcesToDb(data.sources);
  }

  return true;
}

/**
 * Generates SQL script containing CREATE TABLE and INSERT statements for PostgreSQL dump.
 */
export async function exportDatabaseSql(includeSecrets = false, fallbackStore?: any) {
  const data = await exportDatabaseData(includeSecrets, fallbackStore);
  const jsonPayloadBase64 = Buffer.from(JSON.stringify(data)).toString('base64');

  let sql = `-- PostgreSQL Database Dump for Telegram Forwarder Bot\n`;
  sql += `-- Export Date: ${new Date().toISOString()}\n`;
  sql += `-- METADATA_PAYLOAD: ${jsonPayloadBase64}\n\n`;
  sql += `BEGIN;\n\n`;

  // Settings
  sql += `-- Settings\n`;
  sql += `INSERT INTO settings (id, bot_token, destination_channel, admin_password_hash, is_monitoring_paused)
VALUES ('default', '${data.settings?.botToken || ''}', '${data.settings?.destinationChannel || ''}', '${data.adminPasswordHash || ''}', ${!!data.isMonitoringPaused})
ON CONFLICT (id) DO UPDATE SET bot_token = EXCLUDED.bot_token, destination_channel = EXCLUDED.destination_channel, admin_password_hash = EXCLUDED.admin_password_hash, is_monitoring_paused = EXCLUDED.is_monitoring_paused;\n\n`;

  // Sources
  sql += `-- Monitored Channels & Sources (${data.sources?.length || 0} items)\n`;
  if (Array.isArray(data.sources)) {
    for (const src of data.sources) {
      sql += `INSERT INTO sources (id, title, name, username, type, status, is_channel, is_active, keyword_filter, content_cleaner, signature, cleaning_rules, footer_text)
VALUES ('${src.id}', '${(src.title || '').replace(/'/g, "''")}', '${(src.name || '').replace(/'/g, "''")}', '${src.username || ''}', '${src.type || 'channel'}', '${src.status || 'active'}', ${src.isChannel !== false}, ${src.isActive !== false}, '${JSON.stringify(src.keywordFilter || null).replace(/'/g, "''")}', '${JSON.stringify(src.contentCleaner || null).replace(/'/g, "''")}', '${(src.signature || '').replace(/'/g, "''")}', '${JSON.stringify(src.cleaningRules || null).replace(/'/g, "''")}', '${(src.footerText || '').replace(/'/g, "''")}')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, name = EXCLUDED.name, username = EXCLUDED.username, status = EXCLUDED.status, is_active = EXCLUDED.is_active, keyword_filter = EXCLUDED.keyword_filter, content_cleaner = EXCLUDED.content_cleaner, signature = EXCLUDED.signature, cleaning_rules = EXCLUDED.cleaning_rules, footer_text = EXCLUDED.footer_text;\n`;
    }
  }

  // AI Processing, Filters, Cleaning & Rewriting
  const ai = data.aiProcessing || data.settings?.aiProcessing;
  if (ai) {
    sql += `\n-- AI Processing, Keyword Filters, Cleaning Rules & Rewriter\n`;
    sql += `INSERT INTO ai_processing (
  id, enable_ai_processing, enable_keyword_filter, allowed_keywords, blocked_keywords, keyword_match_mode,
  enable_content_cleaning, cleaning_rules, remove_telegram_links, remove_instagram_links, remove_all_urls,
  remove_usernames, remove_hashtags, remove_emojis, ai_rewrite_enabled, enable_ai_rewrite,
  ai_rewrite_style, ai_rewrite_intensity, ai_rewrite_custom_prompt, ai_rewrite_max_length,
  enable_message_signature, signature_text, add_signature_after_every_message,
  enable_duplicate_protection, duplicate_detection_type, time_window_hours, max_forwarding_count,
  enable_contact_manager, default_contact_note, enable_media_control, forward_photos, forward_videos, forward_pdfs, forward_documents, forward_audios
) VALUES (
  'default', ${ai.enableAiProcessing !== false}, ${!!ai.enableKeywordFilter}, '${JSON.stringify(ai.allowedKeywords || []).replace(/'/g, "''")}', '${JSON.stringify(ai.blockedKeywords || []).replace(/'/g, "''")}', '${ai.keywordMatchMode || 'any'}',
  ${!!ai.enableContentCleaning}, '${JSON.stringify(ai.cleaningRules || ['https://', 'http://', '@', '#']).replace(/'/g, "''")}', ${ai.removeTelegramLinks !== false}, ${ai.removeInstagramLinks !== false}, ${!!ai.removeAllUrls},
  ${ai.removeUsernames !== false}, ${ai.removeHashtags !== false}, ${!!ai.removeEmojis}, ${!!(ai.ai_rewrite_enabled ?? ai.aiRewriteEnabled ?? ai.enableAiRewrite)}, ${!!(ai.ai_rewrite_enabled ?? ai.aiRewriteEnabled ?? ai.enableAiRewrite)},
  '${ai.ai_rewrite_style || 'formal_news'}', '${ai.ai_rewrite_intensity || 'medium'}', '${(ai.ai_rewrite_custom_prompt || '').replace(/'/g, "''")}', ${ai.ai_rewrite_max_length || 2000},
  ${!!ai.enableMessageSignature}, '${(ai.signatureText || '').replace(/'/g, "''")}', ${ai.addSignatureAfterEveryMessage !== false},
  ${!!ai.enableDuplicateProtection}, '${ai.duplicateDetectionType || 'both'}', ${ai.timeWindowHours || 1}, ${ai.maxForwardingCount || 2},
  ${!!ai.enableContactManager}, '${(ai.defaultContactNote || '').replace(/'/g, "''")}', ${!!ai.enableMediaControl}, ${ai.forwardPhotos !== false}, ${ai.forwardVideos !== false}, ${ai.forwardPdfs !== false}, ${ai.forwardDocuments !== false}, ${ai.forwardAudios !== false}
) ON CONFLICT (id) DO UPDATE SET
  enable_ai_processing = EXCLUDED.enable_ai_processing,
  enable_keyword_filter = EXCLUDED.enable_keyword_filter,
  allowed_keywords = EXCLUDED.allowed_keywords,
  blocked_keywords = EXCLUDED.blocked_keywords,
  keyword_match_mode = EXCLUDED.keyword_match_mode,
  enable_content_cleaning = EXCLUDED.enable_content_cleaning,
  cleaning_rules = EXCLUDED.cleaning_rules,
  remove_telegram_links = EXCLUDED.remove_telegram_links,
  remove_instagram_links = EXCLUDED.remove_instagram_links,
  remove_all_urls = EXCLUDED.remove_all_urls,
  remove_usernames = EXCLUDED.remove_usernames,
  remove_hashtags = EXCLUDED.remove_hashtags,
  remove_emojis = EXCLUDED.remove_emojis,
  ai_rewrite_enabled = EXCLUDED.ai_rewrite_enabled,
  enable_ai_rewrite = EXCLUDED.enable_ai_rewrite,
  ai_rewrite_style = EXCLUDED.ai_rewrite_style,
  ai_rewrite_intensity = EXCLUDED.ai_rewrite_intensity,
  ai_rewrite_custom_prompt = EXCLUDED.ai_rewrite_custom_prompt,
  ai_rewrite_max_length = EXCLUDED.ai_rewrite_max_length,
  enable_message_signature = EXCLUDED.enable_message_signature,
  signature_text = EXCLUDED.signature_text,
  add_signature_after_every_message = EXCLUDED.add_signature_after_every_message,
  enable_duplicate_protection = EXCLUDED.enable_duplicate_protection,
  duplicate_detection_type = EXCLUDED.duplicate_detection_type,
  time_window_hours = EXCLUDED.time_window_hours,
  max_forwarding_count = EXCLUDED.max_forwarding_count,
  enable_contact_manager = EXCLUDED.enable_contact_manager,
  default_contact_note = EXCLUDED.default_contact_note,
  enable_media_control = EXCLUDED.enable_media_control,
  forward_photos = EXCLUDED.forward_photos,
  forward_videos = EXCLUDED.forward_videos,
  forward_pdfs = EXCLUDED.forward_pdfs,
  forward_documents = EXCLUDED.forward_documents,
  forward_audios = EXCLUDED.forward_audios;\n`;
  }

  sql += `\nCOMMIT;\n`;
  return sql;
}
