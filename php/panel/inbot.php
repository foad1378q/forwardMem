<?php
/**
 * In-Bot Telegram Control Helper (Panel/inbot.php)
 * ------------------------------------------------
 * راهنمای اتصال و ارسال دستورات و منوی شیشه‌ای داخل پیوی ربات
 */

define('APP_INIT', true);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/View.php';
require_once __DIR__ . '/../core/TelegramBot.php';

use Core\Database;
use Core\Auth;
use Core\View;
use Core\TelegramBot;

Auth::requireLogin();

$msg = null;
$error = null;

$adminUserId   = Database::getSetting('admin_user_id', '');
$adminPasscode = Database::getSetting('admin_passcode', 'admin123');

if (isset($_POST['send_menu'])) {
    if (empty($adminUserId)) {
        $error = 'شناسه عددی تلگرام مدیر در تنظیمات وارد نشده است.';
    } else {
        $bot = new TelegramBot();
        $text = "⚡ <b>پنل کنترل سریع ربات تلگرام</b>\n\nبرای مدیریت آسان سیستم از دکمه‌های زیر استفاده کنید:";
        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => '📊 وضعیت سیستم', 'callback_data' => 'btn_status'],
                    ['text' => '📡 لیست کانال‌ها', 'callback_data' => 'btn_sources']
                ],
                [
                    ['text' => '⏸️/▶️ توقف یا فعال‌سازی', 'callback_data' => 'btn_toggle_monitor'],
                    ['text' => '💾 پشتیبان‌گیری دیتابیس', 'callback_data' => 'btn_backup']
                ],
                [
                    ['text' => '🧪 تست ارسال به مقصد', 'callback_data' => 'btn_test_forward']
                ]
            ]
        ];

        $res = $bot->sendMessage($adminUserId, $text, ['reply_markup' => $keyboard]);
        if ($res['ok']) {
            $msg = 'منوی شیشه‌ای کنترل با موفقیت به پیوی تلگرام شما ارسال شد.';
        } else {
            $error = 'خطا در ارسال به تلگرام: ' . ($res['description'] ?? '');
        }
    }
}

View::renderHeader('مدیریت از داخل تلگرام (In-Bot)');
?>

<div class="space-y-6">
    <?php if ($msg): ?>
        <div class="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 font-bold">
            ✅ <?= htmlspecialchars($msg) ?>
        </div>
    <?php endif; ?>

    <?php if ($error): ?>
        <div class="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-400 font-bold">
            ❌ <?= htmlspecialchars($error) ?>
        </div>
    <?php endif; ?>

    <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <span>🤖</span>
                <span>کنترل و نظارت مستقیم از داخل تلگرام</span>
            </h3>
            <form method="POST">
                <button type="submit" name="send_menu" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20 transition">
                    📲 ارسال منوی شیشه‌ای به پیوی من
                </button>
            </form>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">
            شما می‌توانید بدون نیاز به باز کردن پنل وب، تمامی قابلیت‌های سامانه را از طریق ربات تلگرام در پیوی شخصی خود مدیریت کنید.
        </p>

        <!-- Command Guide Table -->
        <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 class="text-xs font-bold text-slate-200">راهنمای دستورات تلگرامی:</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span class="font-mono font-bold text-cyan-400">/login <?= htmlspecialchars($adminPasscode) ?></span>
                    <p class="text-slate-400">احراز هویت و دسترسی به قابلیت‌های مدیریتی در ربات</p>
                </div>
                <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span class="font-mono font-bold text-cyan-400">/status</span>
                    <p class="text-slate-400">مشاهده آمار آنلاین، وضعیت ورکر و تعداد پیام‌های فورواردشده</p>
                </div>
                <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span class="font-mono font-bold text-cyan-400">ارسال @channel_username</span>
                    <p class="text-slate-400">با ارسال مستقیم آیدی یک کانال، رصد آن بلافاصله آغاز می‌شود</p>
                </div>
                <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span class="font-mono font-bold text-cyan-400">/backup</span>
                    <p class="text-slate-400">ایجاد فوری نسخه پشتیبان دیتابیس و ارسال به تاپیک تلگرام</p>
                </div>
            </div>
        </div>
    </div>
</div>

<?php
View::renderFooter();
