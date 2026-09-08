<?php
/**
 * Automated Database & Configuration Backup Service (Core/BackupService.php)
 * --------------------------------------------------------------------------
 * الگوبرداری‌شده از سبک پشتیبان‌گیری پروژه Faoxima:
 * دامپ دیتابیس (mysqldump با fallback به PDO) + فشرده‌سازی ZIP با config.php + ارسال خودکار به تاپیک تلگرام
 */

namespace Core;

use ZipArchive;
use PDO;

class BackupService {
    private const LOCK_FILE = __DIR__ . '/../cron/backup.lock';

    public static function runBackup(bool $sendToTelegram = true): array {
        // ۱. قفل فایل برای جلوگیری از اجرای همزمان (Faoxima Pattern)
        if (file_exists(self::LOCK_FILE)) {
            $lockTime = filemtime(self::LOCK_FILE);
            if (time() - $lockTime < 600) { // اگر کمتر از ۱۰ دقیقه گذشته
                return ['success' => false, 'message' => 'فرآیند پشتیبان‌گیری در حال حاضر توسط پروسه دیگری در حال اجراست.'];
            }
        }
        file_put_contents(self::LOCK_FILE, (string)time());

        try {
            $backupDir = __DIR__ . '/../backups';
            if (!is_dir($backupDir)) {
                mkdir($backupDir, 0755, true);
            }

            $dateStr = date('Y-m-d_H-i-s');
            $sqlFile = "{$backupDir}/db_dump_{$dateStr}.sql";
            $zipFile = "{$backupDir}/backup_{$dateStr}.zip";

            // ۲. خروجی SQL از دیتابیس
            $sqlContent = self::dumpDatabase();
            file_put_contents($sqlFile, $sqlContent);

            // ۳. ایجاد فایل فشرده ZIP
            $zip = new ZipArchive();
            if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new \Exception("امکان ایجاد فایل فشرده ZIP در مسیر {$zipFile} وجود ندارد.");
            }

            $zip->addFile($sqlFile, "database_dump.sql");

            $configFile = __DIR__ . '/../config/config.php';
            if (file_exists($configFile)) {
                $zip->addFile($configFile, "config.php");
            }

            $zip->close();

            // حذف فایل موقت SQL
            if (file_exists($sqlFile)) {
                unlink($sqlFile);
            }

            $fileSizeMb = round(filesize($zipFile) / (1024 * 1024), 2);
            $resultMsg  = "پشتیبان با موفقیت ایجاد شد (حجم: {$fileSizeMb} مگابایت).";

            // ۴. ارسال به گروه یا تاپیک تلگرام (در صورت فعال بودن)
            if ($sendToTelegram) {
                $reportChatId = Database::getSetting('report_chat_id', '');
                $threadId     = Database::getSetting('report_thread_id', null);

                if (!empty($reportChatId)) {
                    $bot = new TelegramBot();
                    $caption = "📦 <b>پشتیبان خودکار پایگاه داده و تنظیمات</b>\n\n" .
                               "📅 <b>تاریخ:</b> " . date('Y/m/d H:i:s') . "\n" .
                               "💾 <b>حجم فایل:</b> {$fileSizeMb} MB\n" .
                               "🌐 <b>سرور:</b> " . ($_SERVER['SERVER_NAME'] ?? 'cPanel');

                    $sendRes = $bot->sendDocument($reportChatId, $zipFile, $caption, $threadId ? (int)$threadId : null);
                    if ($sendRes['ok']) {
                        $resultMsg .= " و به تلگرام ارسال گردید.";
                    } else {
                        $resultMsg .= " اما در ارسال به تلگرام خطا رخ داد: " . ($sendRes['description'] ?? '');
                    }
                }
            }

            // ذخیره تاریخ آخرین بکاپ
            Database::setSetting('last_backup_time', date('Y-m-d H:i:s'));

            // ۵. پاکسازی بکاپ‌های قدیمی‌تر از ۷ روز
            self::cleanOldBackups($backupDir, 7);

            return [
                'success'  => true,
                'message'  => $resultMsg,
                'zip_file' => $zipFile
            ];

        } catch (\Exception $e) {
            return ['success' => false, 'message' => "خطا در پشتیبان‌گیری: " . $e->getMessage()];
        } finally {
            if (file_exists(self::LOCK_FILE)) {
                unlink(self::LOCK_FILE);
            }
        }
    }

    /**
     * استخراج پایگاه داده (Fallback امن به PDO در صورت نبود دسترسی به mysqldump در هاست اشتراکی)
     */
    private static function dumpDatabase(): string {
        $pdo = Database::getInstance();
        $tables = [];
        $stmt = $pdo->query("SHOW TABLES");
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $tables[] = $row[0];
        }

        $sql = "-- Telegram Forwarder SQL Database Backup\n";
        $sql .= "-- Generation Time: " . date('Y-m-d H:i:s') . "\n";
        $sql .= "SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n";

        foreach ($tables as $table) {
            // ساختار جدول
            $createStmt = $pdo->query("SHOW CREATE TABLE `{$table}`")->fetch(PDO::FETCH_NUM);
            $sql .= "DROP TABLE IF EXISTS `{$table}`;\n";
            $sql .= $createStmt[1] . ";\n\n";

            // داده‌های جدول
            $rows = $pdo->query("SELECT * FROM `{$table}`")->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($rows)) {
                $columns = array_keys($rows[0]);
                $colList = implode("`, `", $columns);

                $sql .= "INSERT INTO `{$table}` (`{$colList}`) VALUES\n";
                $rowStrings = [];

                foreach ($rows as $row) {
                    $vals = array_map(function ($v) use ($pdo) {
                        return $v === null ? 'NULL' : $pdo->quote($v);
                    }, array_values($row));
                    $rowStrings[] = "(" . implode(", ", $vals) . ")";
                }

                $sql .= implode(",\n", $rowStrings) . ";\n\n";
            }
        }

        $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";
        return $sql;
    }

    private static function cleanOldBackups(string $dir, int $days): void {
        $files = glob("{$dir}/*.zip");
        $expireTime = time() - ($days * 86400);

        foreach ($files as $f) {
            if (filemtime($f) < $expireTime) {
                unlink($f);
            }
        }
    }
}
