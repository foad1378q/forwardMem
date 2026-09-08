<?php
/**
 * Database Helper Class (Core/Database.php)
 * -----------------------------------------
 * کلاس تک‌نمونه‌ای (Singleton) برای اجرای کوئری‌های آماده‌شده امن و ضد SQL Injection
 */

namespace Core;

use PDO;
use PDOException;

class Database {
    private static ?PDO $instance = null;
    private static ?array $config = null;

    public static function init(array $config): void {
        self::$config = $config;
    }

    public static function getInstance(): PDO {
        if (self::$instance === null) {
            if (self::$config === null) {
                $configFile = __DIR__ . '/../config/config.php';
                if (file_exists($configFile)) {
                    $appConfig = require $configFile;
                    self::$config = $appConfig['db'] ?? [];
                } else {
                    throw new PDOException("Configuration file config/config.php not found.");
                }
            }

            $db = self::$config;
            $dsn = sprintf(
                "mysql:host=%s;port=%d;dbname=%s;charset=%s",
                $db['host'] ?? 'localhost',
                $db['port'] ?? 3306,
                $db['dbname'],
                $db['charset'] ?? 'utf8mb4'
            );

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            self::$instance = new PDO($dsn, $db['username'], $db['password'], $options);
        }

        return self::$instance;
    }

    /**
     * اجرای یک کوئری با پارامترهای Prepared Statement
     */
    public static function query(string $sql, array $params = []): \PDOStatement {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /**
     * دریافت یک سطر
     */
    public static function fetch(string $sql, array $params = []): ?array {
        $stmt = self::query($sql, $params);
        $result = $stmt->fetch();
        return $result !== false ? $result : null;
    }

    /**
     * دریافت تمام سطرها
     */
    public static function fetchAll(string $sql, array $params = []): array {
        $stmt = self::query($sql, $params);
        return $stmt->fetchAll();
    }

    /**
     * دریافت مقدار یک ستون تکی
     */
    public static function fetchColumn(string $sql, array $params = [], int $column = 0) {
        $stmt = self::query($sql, $params);
        return $stmt->fetchColumn($column);
    }

    /**
     * دریافت یا درج تنظیمات کلید-مقدار در جدول settings
     */
    public static function getSetting(string $key, $default = null) {
        $row = self::fetch("SELECT `value` FROM `settings` WHERE `key_name` = ?", [$key]);
        if (!$row) return $default;
        $val = $row['value'];
        $decoded = json_decode($val, true);
        return (json_last_error() === JSON_ERROR_NONE) ? $decoded : $val;
    }

    public static function setSetting(string $key, $value): bool {
        $val = is_array($value) || is_object($value) ? json_encode($value, JSON_UNESCAPED_UNICODE) : (string)$value;
        $stmt = self::query(
            "INSERT INTO `settings` (`key_name`, `value`, `updated_at`) 
             VALUES (?, ?, NOW()) 
             ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()",
            [$key, $val]
        );
        return $stmt->rowCount() > 0;
    }

    /**
     * ثبت لاگ در جدول logs
     */
    public static function log(string $sourceTitle, ?int $msgId, string $status, string $details, ?string $rawText = null): void {
        try {
            self::query(
                "INSERT INTO `logs` (`source_title`, `message_id`, `status`, `details`, `raw_text`, `created_at`) 
                 VALUES (?, ?, ?, ?, ?, NOW())",
                [$sourceTitle, $msgId, $status, $details, $rawText]
            );
        } catch (\Exception $e) {
            // جلوگیری از خطای توقف اسکریپت هنگام لاگ‌گیری
            error_log("Failed to insert log: " . $e->getMessage());
        }
    }

    /**
     * آخرین شناسه درج‌شده
     */
    public static function lastInsertId(): string {
        return self::getInstance()->lastInsertId();
    }
}
