<?php
/**
 * Telegram MTProto User Account Worker (worker.php)
 * --------------------------------------------------
 * گوش دادن دائمی به کانال‌های مبدا با اکانت تلگرام (MTProto) با استفاده از کتابخانه danog/madelineproto
 *
 * راهنمای استقرار:
 * ۱) سرور مجازی (VPS) با سرویس systemd (بهترین و مطمئن‌ترین حالت)
 * ۲) اتصال مستقیم به دیتابیس cPanel از طریق Remote MySQL
 */

// افزایش حداکثر زمان و حافظه برای پروسه پایدار
set_time_limit(0);
ini_set('memory_limit', '512M');
ini_set('display_errors', '1');

define('APP_INIT', true);

// بارگذاری فایل‌های کمکی
require_once __DIR__ . '/core/Database.php';
require_once __DIR__ . '/core/TelegramBot.php';
require_once __DIR__ . '/core/FilterEngine.php';
require_once __DIR__ . '/core/AiService.php';

use Core\Database;
use Core\TelegramBot;
use Core\FilterEngine;
use Core\AiService;

echo "========================================================\n";
echo "   Telegram MTProto Forwarder Worker (PHP + Madeline)   \n";
echo "========================================================\n";

// بررسی وجود فایل autoload مادلین‌پروتو
$composerAutoload = __DIR__ . '/vendor/autoload.php';
$madelinePhp      = __DIR__ . '/madeline.php';

if (file_exists($composerAutoload)) {
    require_once $composerAutoload;
} elseif (file_exists($madelinePhp)) {
    require_once $madelinePhp;
} else {
    echo "[!] MadelineProto not found. Downloading madeline.php...\n";
    file_put_contents($madelinePhp, file_get_contents('https://phar.madelineproto.xyz/madeline.php'));
    require_once $madelinePhp;
}

$bot = new TelegramBot();

// تنظیمات سشن مادلین‌پروتو
$sessionDir = __DIR__ . '/session';
if (!is_dir($sessionDir)) {
    mkdir($sessionDir, 0755, true);
}
$sessionFile = $sessionDir . '/telegram_user.madeline';

$settings = [
    'app_info' => [
        'api_id'   => (int)Database::getSetting('telegram_api_id', 123456),
        'api_hash' => (string)Database::getSetting('telegram_api_hash', '0123456789abcdef0123456789abcdef'),
    ],
    'logger' => [
        'logger' => \danog\MadelineProto\Logger::FILE_LOGGER,
        'logger_level' => \danog\MadelineProto\Logger::LEVEL_WARNING,
    ]
];

$MadelineProto = new \danog\MadelineProto\API($sessionFile, $settings);
$MadelineProto->start();

$me = $MadelineProto->getSelf();
echo "[✓] Logged in as: " . ($me['first_name'] ?? 'User') . " (@" . ($me['username'] ?? 'no_username') . ") [ID: {$me['id']}]\n";
echo "[✓] Listening to channel messages...\n";

// حلقه اصلی گوش دادن و به‌روزرسانی پالس سلامت
$lastHeartbeat = 0;

while (true) {
    try {
        // به‌روزرسانی ضربان قلب (Heartbeat) هر ۲۰ ثانیه در دیتابیس
        if (time() - $lastHeartbeat >= 20) {
            Database::setSetting('worker_heartbeat', date('Y-m-d H:i:s'));
            $lastHeartbeat = time();
        }

        // بررسی آیا مانیتورینگ متوقف شده است؟
        $isPaused = (bool)Database::getSetting('is_monitoring_paused', false);
        if ($isPaused) {
            sleep(5);
            continue;
        }

        // دریافت به‌روزرسانی‌های جدید کانال‌ها از مادلین‌پروتو
        $updates = $MadelineProto->getUpdates(['offset' => 0, 'limit' => 20, 'timeout' => 5]);

        foreach ($updates as $update) {
            if (!isset($update['update']['message'])) {
                continue;
            }

            $message = $update['update']['message'];
            $msgId   = $message['id'] ?? 0;
            $chatId  = $message['peer_id']['channel_id'] ?? ($message['peer_id']['chat_id'] ?? null);
            $rawText = $message['message'] ?? '';

            if (!$chatId) continue;

            // بررسی آیا این چت در لیست کانال‌های مبدا فعال ما هست؟
            $source = Database::fetch(
                "SELECT * FROM `sources` WHERE (`numeric_id` = ? OR `username` = ?) AND `status` = 'active' LIMIT 1",
                [(string)$chatId, (string)$chatId]
            );

            if (!$source) {
                continue;
            }

            // ۱. بررسی جلوگیری از ارسال تکراری (Duplicate Check)
            $mediaId = $message['media']['document']['id'] ?? ($message['media']['photo']['id'] ?? null);
            if (FilterEngine::isDuplicate($rawText, (string)$mediaId, 120)) {
                Database::log($source['title'], $msgId, 'skipped', 'پیام تکراری در بازه ۱۲۰ دقیقه گذشته شناسایی و رد شد.');
                continue;
            }

            // ۲. بررسی فیلتر کلمات مجاز و ممنوع
            $channelKeywords = !empty($source['keywords_json']) ? json_decode($source['keywords_json'], true) : [];
            $kwCheck = FilterEngine::shouldProcessMessage($rawText, $channelKeywords, $source['keyword_match_mode'] ?? 'any');

            if (!$kwCheck['allowed']) {
                Database::log($source['title'], $msgId, 'skipped', $kwCheck['reason'], $rawText);
                continue;
            }

            // ۳. پاکسازی محتوا
            $processedText = FilterEngine::cleanText($rawText);

            // ۴. بازنویسی با هوش مصنوعی (در صورت فعال بودن)
            $processedText = AiService::rewriteText($processedText);

            // ۵. درج امضای اختصاصی
            $finalText = FilterEngine::appendSignature($processedText);

            // ۶. فوروارد / ارسال به کانال مقصد
            $destChannel = Database::getSetting('destination_channel', '');
            if (empty($destChannel)) {
                Database::log($source['title'], $msgId, 'error', 'کانال مقصد در تنظیمات تعیین نشده است.');
                continue;
            }

            $sendRes = $bot->sendMessage($destChannel, $finalText);

            if ($sendRes['ok']) {
                // افزایش آمار انتقال کانال
                Database::query("UPDATE `sources` SET `total_transferred` = `total_transferred` + 1, `last_message_id` = ? WHERE `id` = ?", [
                    $msgId, $source['id']
                ]);
                Database::log($source['title'], $msgId, 'success', 'پیام با موفقیت فیلتر، پردازش و به کانال مقصد منتقل شد.', $finalText);
                echo "[+] Message #{$msgId} from {$source['title']} forwarded to {$destChannel}\n";
            } else {
                Database::log($source['title'], $msgId, 'error', 'خطا در ارسال ربات: ' . ($sendRes['description'] ?? ''));
                echo "[-] Failed to forward message #{$msgId}: " . ($sendRes['description'] ?? '') . "\n";
            }
        }

        // وقفه کوتاه برای کنترل مصرف CPU
        usleep(300000); // 0.3 ثانیه

    } catch (\Throwable $e) {
        echo "[!] Worker Loop Exception: " . $e->getMessage() . "\n";
        Database::log('Worker System', null, 'error', 'خطای لوپ کلاینت تلگرام: ' . $e->getMessage());
        sleep(5);
    }
}
