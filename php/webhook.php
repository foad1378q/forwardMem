<?php
/**
 * Telegram Bot Webhook Handler (webhook.php)
 * -------------------------------------------
 * دریافت آپدیت‌ها، دستورات (/status, /pause, /channels, /add, /login) و کلیک روی دکمه‌های شیشه‌ای
 */

define('APP_INIT', true);

require_once __DIR__ . '/core/Database.php';
require_once __DIR__ . '/core/TelegramBot.php';
require_once __DIR__ . '/core/BackupService.php';

use Core\Database;
use Core\TelegramBot;
use Core\BackupService;

$rawInput = file_get_contents('php://input');
if (empty($rawInput)) {
    echo "Telegram Forwarder Webhook is Active.";
    exit;
}

$update = json_decode($rawInput, true);
if (!$update) {
    exit;
}

$bot = new TelegramBot();
$adminUserId   = (string)Database::getSetting('admin_user_id', '');
$adminPasscode = (string)Database::getSetting('admin_passcode', 'admin123');

// بررسی هویت کاربر تلگرام (Admin Check)
function isTelegramAdmin(int|string $userId, string $adminUserId): bool {
    return !empty($adminUserId) && ((string)$userId === (string)$adminUserId);
}

// کیبورد شیشه‌ای منوی اصلی مدیریت
function getMainKeyboard(bool $isPaused): array {
    return [
        'inline_keyboard' => [
            [
                ['text' => '📊 وضعیت و آمار زنده', 'callback_data' => 'cb_status'],
                ['text' => $isPaused ? '▶️ ازسرگیری مانیتورینگ' : '⏸️ توقف موقت مانیتورینگ', 'callback_data' => 'cb_toggle_pause']
            ],
            [
                ['text' => '📡 لیست کانال‌های مبدا', 'callback_data' => 'cb_channels'],
                ['text' => '➕ افزودن کانال جدید', 'callback_data' => 'cb_add_channel']
            ],
            [
                ['text' => '🎯 تغییر کانال مقصد', 'callback_data' => 'cb_set_dest'],
                ['text' => '💾 پشتیبان‌گیری و ارسال', 'callback_data' => 'cb_backup_now']
            ],
            [
                ['text' => '🧪 ارسال پیام تست به مقصد', 'callback_data' => 'cb_test_dest']
            ]
        ]
    ];
}

// ۱. مدیریت پیام‌های متنی
if (isset($update['message'])) {
    $msg    = $update['message'];
    $chatId = $msg['chat']['id'];
    $userId = $msg['from']['id'];
    $text   = trim($msg['text'] ?? '');

    // لاگین با پسورد
    if (str_starts_with($text, '/login')) {
        $enteredPass = trim(substr($text, 6));
        if ($enteredPass === $adminPasscode) {
            Database::setSetting('admin_user_id', (string)$userId);
            $bot->sendMessage($chatId, "✅ <b>احراز هویت با موفقیت انجام شد!</b>\nشناسه کاربری شما به عنوان مدیر ثبت گردید.", [
                'reply_markup' => getMainKeyboard(Database::getSetting('is_monitoring_paused', false))
            ]);
            exit;
        } else {
            $bot->sendMessage($chatId, "❌ رمز عبور وارد شده اشتباه است.");
            exit;
        }
    }

    if (str_starts_with($text, '/start')) {
        $param = trim(substr($text, 6));
        if ($param === $adminPasscode) {
            Database::setSetting('admin_user_id', (string)$userId);
            $bot->sendMessage($chatId, "✅ <b>احراز هویت انجام شد!</b> خوش آمدید.", [
                'reply_markup' => getMainKeyboard(Database::getSetting('is_monitoring_paused', false))
            ]);
            exit;
        }

        if (isTelegramAdmin($userId, $adminUserId)) {
            $bot->sendMessage($chatId, "🤖 <b>سامانه مدیریت و فوروارد هوشمند تلگرام</b>\n\nجهت مدیریت سیستم از کلیدهای زیر استفاده کنید:", [
                'reply_markup' => getMainKeyboard(Database::getSetting('is_monitoring_paused', false))
            ]);
        } else {
            $bot->sendMessage($chatId, "🔒 <b>دسترسی مسدود است.</b>\nجهت ورود به پنل، دستور زیر را ارسال کنید:\n<code>/login رمز_عبور</code>");
        }
        exit;
    }

    // بررسی دسترسی ادمین برای سایر دستورات
    if (!isTelegramAdmin($userId, $adminUserId)) {
        $bot->sendMessage($chatId, "🔒 دسترسی غیرمجاز. ابتدا با <code>/login</code> احراز هویت کنید.");
        exit;
    }

    // دستور /status
    if ($text === '/status') {
        $totalSources = (int)Database::fetchColumn("SELECT COUNT(*) FROM `sources`");
        $activeSources = (int)Database::fetchColumn("SELECT COUNT(*) FROM `sources` WHERE `status` = 'active'");
        $totalTransferred = (int)Database::fetchColumn("SELECT SUM(`total_transferred`) FROM `sources`") ?: 0;
        $isPaused = (bool)Database::getSetting('is_monitoring_paused', false);
        $dest = Database::getSetting('destination_channel', 'تنظیم‌نشده');
        $hb = Database::getSetting('worker_heartbeat', 'هیچ‌وقت');

        $statusMsg = "📊 <b>گزارش وضعیت زنده سیستم:</b>\n\n" .
                     "▫️ <b>وضعیت مانیتورینگ:</b> " . ($isPaused ? "⏸️ متوقف" : "▶️ فعال و در حال رصد") . "\n" .
                     "▫️ <b>کانال‌های فعال:</b> {$activeSources} از {$totalSources}\n" .
                     "▫️ <b>کانال مقصد:</b> <code>{$dest}</code>\n" .
                     "▫️ <b>کل پیام‌های منتقل‌شده:</b> " . number_format($totalTransferred) . "\n" .
                     "▫️ <b>آخرین سیگنال ورکر:</b> <code>{$hb}</code>";

        $bot->sendMessage($chatId, $statusMsg, ['reply_markup' => getMainKeyboard($isPaused)]);
        exit;
    }

    // افزودن مستقیم کانال با ارسال آیدی (@channel)
    if (str_starts_with($text, '@') || str_contains($text, 't.me/')) {
        $clean = ltrim(preg_replace('/^(https?:\/\/)?(t|telegram)\.me\//i', '', $text), '@');
        $id = 'src_' . time() . '_' . substr(md5(uniqid()), 0, 4);

        $exists = Database::fetch("SELECT `id` FROM `sources` WHERE `username` = ?", [$clean]);
        if ($exists) {
            $bot->sendMessage($chatId, "⚠️ کانال @{$clean} از قبل در لیست مانیتورینگ وجود دارد.");
        } else {
            Database::query("INSERT INTO `sources` (`id`, `title`, `username`, `status`, `created_at`) VALUES (?, ?, ?, 'active', NOW())", [
                $id, "@" . $clean, $clean
            ]);
            $bot->sendMessage($chatId, "✅ <b>کانال @{$clean} با موفقیت به لیست مانیتورینگ اضافه شد.</b>", [
                'reply_markup' => getMainKeyboard(Database::getSetting('is_monitoring_paused', false))
            ]);
        }
        exit;
    }
}

// ۲. مدیریت کلیک روی دکمه‌های شیشه‌ای (Callback Queries)
if (isset($update['callback_query'])) {
    $cb        = $update['callback_query'];
    $cbId      = $cb['id'];
    $userId    = $cb['from']['id'];
    $chatId    = $cb['message']['chat']['id'];
    $messageId = $cb['message']['message_id'];
    $data      = $cb['data'];

    if (!isTelegramAdmin($userId, $adminUserId)) {
        $bot->answerCallbackQuery($cbId, "🔒 دسترسی شما تایید نشده است.", true);
        exit;
    }

    if ($data === 'cb_status') {
        $totalSources = (int)Database::fetchColumn("SELECT COUNT(*) FROM `sources`");
        $activeSources = (int)Database::fetchColumn("SELECT COUNT(*) FROM `sources` WHERE `status` = 'active'");
        $totalTransferred = (int)Database::fetchColumn("SELECT SUM(`total_transferred`) FROM `sources`") ?: 0;
        $isPaused = (bool)Database::getSetting('is_monitoring_paused', false);
        $dest = Database::getSetting('destination_channel', 'تنظیم‌نشده');
        $hb = Database::getSetting('worker_heartbeat', 'هیچ‌وقت');

        $statusMsg = "📊 <b>گزارش وضعیت زنده سیستم:</b>\n\n" .
                     "▫️ <b>وضعیت مانیتورینگ:</b> " . ($isPaused ? "⏸️ متوقف" : "▶️ فعال و در حال رصد") . "\n" .
                     "▫️ <b>کانال‌های فعال:</b> {$activeSources} از {$totalSources}\n" .
                     "▫️ <b>کانال مقصد:</b> <code>{$dest}</code>\n" .
                     "▫️ <b>کل پیام‌های منتقل‌شده:</b> " . number_format($totalTransferred) . "\n" .
                     "▫️ <b>آخرین پالس ورکر:</b> <code>{$hb}</code>";

        $bot->answerCallbackQuery($cbId, "آمار به‌روز شد");
        $bot->editMessageText($chatId, $messageId, $statusMsg, getMainKeyboard($isPaused));
        exit;
    }

    if ($data === 'cb_toggle_pause') {
        $current = (bool)Database::getSetting('is_monitoring_paused', false);
        $newVal = !$current;
        Database::setSetting('is_monitoring_paused', $newVal);

        $alertText = $newVal ? "⏸️ رصد کانال‌ها موقتاً متوقف شد." : "▶️ رصد کانال‌ها با موفقیت فعال گردید.";
        $bot->answerCallbackQuery($cbId, $alertText, true);

        $statusMsg = "🤖 <b>منوی مدیریت و مانیتورینگ تلگرام</b>\n\n" .
                     ($newVal ? "⚠️ مانیتورینگ اکنون <b>متوقف</b> است." : "🟢 مانیتورینگ اکنون <b>فعال</b> است.");

        $bot->editMessageText($chatId, $messageId, $statusMsg, getMainKeyboard($newVal));
        exit;
    }

    if ($data === 'cb_channels') {
        $sources = Database::fetchAll("SELECT * FROM `sources` ORDER BY `created_at` DESC LIMIT 15");
        $markup = ['inline_keyboard' => []];

        if (empty($sources)) {
            $text = "📡 هیچ کانال مبدایی ثبت نشده است.";
        } else {
            $text = "📡 <b>لیست کانال‌های مبدا مانیتورینگ:</b>\nبرای حذف هر کانال، روی دکمه حذف مربوط به آن بزنید:\n";
            foreach ($sources as $s) {
                $markup['inline_keyboard'][] = [
                    ['text' => "📢 {$s['title']} (" . number_format($s['total_transferred']) . ")", 'url' => "https://t.me/{$s['username']}"],
                    ['text' => "❌ حذف", 'callback_data' => "del_src_{$s['id']}"]
                ];
            }
        }

        $markup['inline_keyboard'][] = [
            ['text' => '➕ افزودن کانال جدید', 'callback_data' => 'cb_add_channel'],
            ['text' => '🔙 بازگشت به منو', 'callback_data' => 'cb_main_menu']
        ];

        $bot->answerCallbackQuery($cbId);
        $bot->editMessageText($chatId, $messageId, $text, $markup);
        exit;
    }

    if (str_starts_with($data, 'del_src_')) {
        $delId = substr($data, 8);
        Database::query("DELETE FROM `sources` WHERE `id` = ?", [$delId]);
        $bot->answerCallbackQuery($cbId, "✅ کانال با موفقیت حذف گردید.", true);

        // بازگشت به لیست
        $sources = Database::fetchAll("SELECT * FROM `sources` ORDER BY `created_at` DESC LIMIT 15");
        $markup = ['inline_keyboard' => []];
        $text = "📡 <b>لیست کانال‌های مبدا مانیتورینگ:</b>\n";
        foreach ($sources as $s) {
            $markup['inline_keyboard'][] = [
                ['text' => "📢 {$s['title']}", 'url' => "https://t.me/{$s['username']}"],
                ['text' => "❌ حذف", 'callback_data' => "del_src_{$s['id']}"]
            ];
        }
        $markup['inline_keyboard'][] = [['text' => '🔙 بازگشت به منو', 'callback_data' => 'cb_main_menu']];
        $bot->editMessageText($chatId, $messageId, $text, $markup);
        exit;
    }

    if ($data === 'cb_add_channel') {
        $bot->answerCallbackQuery($cbId);
        $bot->sendMessage($chatId, "➕ <b>جهت افزودن کانال مبدا جدید:</b>\n\nکافیست آیدی کانال را با علامت @ یا لینک کامل آن را در همین چت ارسال نمایید.\nمثال:\n<code>@durov</code> یا <code>https://t.me/telegram</code>");
        exit;
    }

    if ($data === 'cb_backup_now') {
        $bot->answerCallbackQuery($cbId, "در حال ایجاد فایل پشتیبان دیتابیس...", false);
        $res = BackupService::runBackup(true);
        $bot->sendMessage($chatId, "📦 <b>نتیجه پشتیبان‌گیری:</b>\n" . $res['message']);
        exit;
    }

    if ($data === 'cb_test_dest') {
        $dest = Database::getSetting('destination_channel', '');
        if (empty($dest)) {
            $bot->answerCallbackQuery($cbId, "❌ کانال مقصد تنظیم نشده است!", true);
        } else {
            $testRes = $bot->sendMessage($dest, "🧪 <b>پیام آزمایش و سلامت فورواردر تلگرام</b>\n\n✅ اتصال ربات با موفقیت برقرار است.\n📅 زمان: " . date('Y/m/d H:i:s'));
            if ($testRes['ok']) {
                $bot->answerCallbackQuery($cbId, "✅ پیام تست با موفقیت به کانال مقصد ارسال شد.", true);
            } else {
                $bot->answerCallbackQuery($cbId, "❌ خطا در ارسال: " . ($testRes['description'] ?? ''), true);
            }
        }
        exit;
    }

    if ($data === 'cb_main_menu') {
        $bot->answerCallbackQuery($cbId);
        $isPaused = (bool)Database::getSetting('is_monitoring_paused', false);
        $bot->editMessageText($chatId, $messageId, "🤖 <b>منوی اصلی مدیریت ربات:</b>", getMainKeyboard($isPaused));
        exit;
    }
}
