<?php
/**
 * Telegram Worker Health Check Script (cron/healthcheck.php)
 * -----------------------------------------------------------
 * بررسی سیگنال پالس کلاینت تلگرام (Heartbeat) و ارسال هشدار در صورت قطعی پروسه
 */

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/TelegramBot.php';

use Core\Database;
use Core\TelegramBot;

$lastHeartbeat = Database::getSetting('worker_heartbeat', null);
$isMonitoringPaused = (bool)Database::getSetting('is_monitoring_paused', false);

// اگر مانیتورینگ متوقف نشده باشد و ورکر بیش از ۳ دقیقه پاسخی نداده باشد
if (!$isMonitoringPaused) {
    $isDown = false;
    if ($lastHeartbeat === null) {
        $isDown = true;
    } else {
        $diffSeconds = time() - strtotime($lastHeartbeat);
        if ($diffSeconds > 180) { // بیش از ۳ دقیقه
            $isDown = true;
        }
    }

    if ($isDown) {
        $adminId = Database::getSetting('admin_user_id', '');
        $lastAlert = Database::getSetting('last_worker_down_alert', 0);

        // ارسال هشدار به ادمین (حداکثر هر ۱ ساعت یکبار برای جلوگیری از اسپم)
        if (!empty($adminId) && (time() - $lastAlert > 3600)) {
            $bot = new TelegramBot();
            $alertMsg = "⚠️ <b>هشدار توقف ورکر تلگرام (Worker Offline)</b>\n\n" .
                        "ورکر مانیتورینگ کانال‌ها (MTProto Client) بیش از ۳ دقیقه است که سیگنال فعالیتی ارسال نکرده است.\n\n" .
                        "▫️ <b>آخرین سیگنال:</b> " . ($lastHeartbeat ?: 'هیچ‌وقت') . "\n" .
                        "▫️ <b>اقدام پیشنهادی:</b> وضعیت پروسه <code>worker.php</code> را روی سرور بررسی نمایید.";

            $bot->sendMessage($adminId, $alertMsg);
            Database::setSetting('last_worker_down_alert', time());
        }
    }
}
