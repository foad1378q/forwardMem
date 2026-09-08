-- =========================================================================
-- Telegram Forwarder Database Schema for MySQL / MariaDB (cPanel Compatible)
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- 1. جدول ادمین‌های پنل وب
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(64) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login` DATETIME NULL,
  `last_ip` VARCHAR(45) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. جدول تنظیمات کلید/مقدار سیستم
CREATE TABLE IF NOT EXISTS `settings` (
  `key_name` VARCHAR(128) NOT NULL PRIMARY KEY,
  `value` LONGTEXT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. جدول کانال‌های مبدا مانیتورینگ
CREATE TABLE IF NOT EXISTS `sources` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `username` VARCHAR(128) NOT NULL,
  `numeric_id` VARCHAR(64) NULL,
  `type` ENUM('channel', 'group', 'user') NOT NULL DEFAULT 'channel',
  `status` ENUM('active', 'paused', 'error') NOT NULL DEFAULT 'active',
  `last_message_id` BIGINT NOT NULL DEFAULT 0,
  `total_transferred` INT NOT NULL DEFAULT 0,
  `keywords_json` TEXT NULL,
  `enable_keywords` TINYINT(1) NOT NULL DEFAULT 0,
  `keyword_match_mode` ENUM('any', 'all') NOT NULL DEFAULT 'any',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_checked_at` DATETIME NULL,
  INDEX `idx_username` (`username`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. جدول تاریخچه فعالیت‌ها و لاگ‌ها
CREATE TABLE IF NOT EXISTS `logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `source_title` VARCHAR(255) NOT NULL,
  `message_id` BIGINT NULL,
  `status` ENUM('success', 'error', 'skipped') NOT NULL DEFAULT 'success',
  `details` TEXT NOT NULL,
  `raw_text` MEDIUMTEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. جدول جلوگیری از پیام‌های تکراری با هش
CREATE TABLE IF NOT EXISTS `processed_hashes` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `content_hash` CHAR(32) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hash_time` (`content_hash`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. جدول مدیریت و زمان‌بندی وظایف کرون‌جاب متمرکز (Faoxima Pattern)
CREATE TABLE IF NOT EXISTS `cron_tasks` (
  `task_name` VARCHAR(64) NOT NULL PRIMARY KEY,
  `interval_minutes` INT NOT NULL DEFAULT 5,
  `last_run_at` DATETIME NULL,
  `status` ENUM('idle', 'running', 'failed') NOT NULL DEFAULT 'idle',
  `last_result` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- درج مقادیر پیش‌فرض کرون‌ها
INSERT INTO `cron_tasks` (`task_name`, `interval_minutes`, `last_run_at`) VALUES
('backup_database', 360, NULL),
('healthcheck_worker', 5, NULL),
('clean_old_logs', 1440, NULL)
ON DUPLICATE KEY UPDATE `interval_minutes` = VALUES(`interval_minutes`);

SET FOREIGN_KEY_CHECKS = 1;
