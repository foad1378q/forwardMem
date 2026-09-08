<?php
/**
 * Central Cron Dispatcher & Orchestrator (cron/dispatcher.php)
 * -----------------------------------------------------------
 * بر اساس الگوی پروژه Faoxima:
 * کاربر در cPanel تنها یک کرون‌جاب ۱ دقیقه‌ای تعریف می‌کند:
 * * * * * * php /home/username/public_html/cron/dispatcher.php >/dev/null 2>&1
 *
 * این فایل جدول cron_tasks را بررسی کرده و جاب‌هایی که زمان اجرای آنها فرا رسیده را به صورت مدیریت‌شده اجرا می‌کند.
 */

if (php_sapi_name() !== 'cli' && (!isset($_GET['secret']) || $_GET['secret'] !== 'forwarder_cron_key')) {
    // جلوگیری از اجرای غیرمجاز از طریق وب
    http_response_code(403);
    die("Access Denied");
}

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/TelegramBot.php';
require_once __DIR__ . '/../core/BackupService.php';

use Core\Database;
use Core\BackupService;
use Core\TelegramBot;

$now = new DateTime();
$tasks = Database::fetchAll("SELECT * FROM `cron_tasks`");

foreach ($tasks as $task) {
    $taskName = $task['task_name'];
    $interval = (int)$task['interval_minutes'];
    $lastRun  = $task['last_run_at'] ? new DateTime($task['last_run_at']) : null;

    $shouldRun = false;
    if ($lastRun === null) {
        $shouldRun = true;
    } else {
        $diffMinutes = ($now->getTimestamp() - $lastRun->getTimestamp()) / 60;
        if ($diffMinutes >= $interval) {
            $shouldRun = true;
        }
    }

    if ($shouldRun) {
        echo "[" . date('Y-m-d H:i:s') . "] Running task: {$taskName}...\n";

        // علامت‌گذاری تسک در حال اجرا
        Database::query("UPDATE `cron_tasks` SET `status` = 'running' WHERE `task_name` = ?", [$taskName]);

        $resultMsg = "Completed successfully";

        try {
            switch ($taskName) {
                case 'backup_database':
                    $res = BackupService::runBackup(true);
                    $resultMsg = $res['message'];
                    break;

                case 'healthcheck_worker':
                    require_once __DIR__ . '/healthcheck.php';
                    break;

                case 'clean_old_logs':
                    Database::query("DELETE FROM `logs` WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 30 DAY)");
                    Database::query("DELETE FROM `processed_hashes` WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 7 DAY)");
                    $resultMsg = "Old logs and hashes cleaned.";
                    break;

                default:
                    $resultMsg = "Unknown task name.";
                    break;
            }

            Database::query(
                "UPDATE `cron_tasks` SET `status` = 'idle', `last_run_at` = NOW(), `last_result` = ? WHERE `task_name` = ?",
                [$resultMsg, $taskName]
            );

        } catch (\Throwable $e) {
            $err = "Error: " . $e->getMessage();
            echo "Task {$taskName} failed: {$err}\n";
            Database::query(
                "UPDATE `cron_tasks` SET `status` = 'failed', `last_run_at` = NOW(), `last_result` = ? WHERE `task_name` = ?",
                [$err, $taskName]
            );
        }
    }
}

echo "All scheduled cron checks completed.\n";
