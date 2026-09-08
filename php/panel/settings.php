<?php
/**
 * System and AI Settings (Panel/settings.php)
 * --------------------------------------------
 * تنظیمات توکن ربات، کانال مقصد، شناسه ادمین، کلید API جمینای و اوپن‌روتر
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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = $_POST['csrf_token'] ?? '';
    if (!Auth::validateCsrfToken($token)) {
        $error = 'توکن امنیتی منقضی شده است.';
    } else {
        $botToken       = trim($_POST['bot_token'] ?? '');
        $destChannel    = trim($_POST['destination_channel'] ?? '');
        $adminUserId    = trim($_POST['admin_user_id'] ?? '');
        $adminPasscode  = trim($_POST['admin_passcode'] ?? 'admin123');
        $reportChatId   = trim($_POST['report_chat_id'] ?? '');
        $reportThreadId = !empty($_POST['report_thread_id']) ? (int)$_POST['report_thread_id'] : null;

        Database::setSetting('bot_token', $botToken);
        Database::setSetting('destination_channel', $destChannel);
        Database::setSetting('admin_user_id', $adminUserId);
        Database::setSetting('admin_passcode', $adminPasscode);
        Database::setSetting('report_chat_id', $reportChatId);
        Database::setSetting('report_thread_id', $reportThreadId);

        // تنظیمات هوش مصنوعی
        $aiConfig = [
            'enabled'   => isset($_POST['ai_enabled']),
            'provider'  => 'self-hosted',
            'style'     => $_POST['ai_style'] ?? 'formal_news',
            'intensity' => $_POST['ai_intensity'] ?? 'medium',
        ];
        Database::setSetting('ai_config', $aiConfig);

        $msg = 'تنظیمات با موفقیت ذخیره گردید.';
    }
}

// تست اتصال ربات
$botTestResult = null;
if (isset($_GET['test_bot'])) {
    $bot = new TelegramBot();
    $me = $bot->getMe();
    if ($me['ok']) {
        $botTestResult = "ربات با موفقیت متصل شد: @" . ($me['result']['username'] ?? '');
    } else {
        $error = "خطا در اتصال به ربات: " . ($me['description'] ?? '');
    }
}

$botToken       = Database::getSetting('bot_token', '');
$destChannel    = Database::getSetting('destination_channel', '');
$adminUserId    = Database::getSetting('admin_user_id', '');
$adminPasscode  = Database::getSetting('admin_passcode', 'admin123');
$reportChatId   = Database::getSetting('report_chat_id', '');
$reportThreadId = Database::getSetting('report_thread_id', '');
$aiConfig       = Database::getSetting('ai_config', []);

$csrfToken = Auth::generateCsrfToken();

View::renderHeader('تنظیمات سیستم و ربات');
?>

<div class="space-y-6">
    <?php if ($msg || $botTestResult): ?>
        <div class="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 font-bold">
            ✅ <?= htmlspecialchars($msg ?? $botTestResult) ?>
        </div>
    <?php endif; ?>

    <?php if ($error): ?>
        <div class="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-400 font-bold">
            ❌ <?= htmlspecialchars($error) ?>
        </div>
    <?php endif; ?>

    <form method="POST" class="space-y-6">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">

        <!-- Telegram Bot Settings -->
        <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    <span>🤖</span>
                    <span>تنظیمات ربات تلگرام و کانال مقصد</span>
                </h3>
                <a href="settings.php?test_bot=1" class="text-xs text-cyan-400 hover:underline">🧪 تست اتصال ربات</a>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div class="sm:col-span-2">
                    <label class="block font-medium text-slate-300 mb-1">توکن ربات تلگرام (Bot Token):</label>
                    <input type="text" name="bot_token" value="<?= htmlspecialchars($botToken) ?>" required class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none">
                </div>
                <div>
                    <label class="block font-medium text-slate-300 mb-1">کانال مقصد پیش‌فرض (Destination Channel):</label>
                    <input type="text" name="destination_channel" value="<?= htmlspecialchars($destChannel) ?>" required class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:outline-none" placeholder="@my_destination_channel">
                </div>
                <div>
                    <label class="block font-medium text-slate-300 mb-1">شناسه عددی تلگرام مدیر (Admin User ID):</label>
                    <input type="text" name="admin_user_id" value="<?= htmlspecialchars($adminUserId) ?>" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none" placeholder="123456789">
                </div>
                <div>
                    <label class="block font-medium text-slate-300 mb-1">رمز ورود مدیر به ربات (/login):</label>
                    <input type="text" name="admin_passcode" value="<?= htmlspecialchars($adminPasscode) ?>" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none">
                </div>
                <div>
                    <label class="block font-medium text-slate-300 mb-1">شناسه گروه/کانال دریافت گزارش و بکاپ:</label>
                    <input type="text" name="report_chat_id" value="<?= htmlspecialchars($reportChatId) ?>" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none" placeholder="-100123456789">
                </div>
                <div>
                    <label class="block font-medium text-slate-300 mb-1">شناسه تاپیک تلگرام (Thread ID - اختیاری):</label>
                    <input type="number" name="report_thread_id" value="<?= htmlspecialchars((string)$reportThreadId) ?>" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none" placeholder="12">
                </div>
            </div>
        </div>

        <!-- AI Settings -->
        <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <span>✨</span>
                <span>هوش مصنوعی بازنویسی متون (AI Content Rewriting)</span>
            </h3>

            <div class="space-y-4 text-xs">
                <label class="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" name="ai_enabled" <?= !empty($aiConfig['enabled']) ? 'checked' : '' ?> class="w-4 h-4 text-cyan-600 rounded bg-slate-900 border-slate-700">
                    <span class="font-bold text-slate-200">فعال‌سازی بازنویسی هوشمند متن با موتور محلی (Self-Hosted)</span>
                </label>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block font-medium text-slate-300 mb-1">سبک بازنویسی (Style):</label>
                        <select name="ai_style" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:outline-none">
                            <option value="formal_news" <?= ($aiConfig['style'] ?? '') === 'formal_news' ? 'selected' : '' ?>>رسمی و خبری</option>
                            <option value="news_engaging" <?= ($aiConfig['style'] ?? '') === 'news_engaging' ? 'selected' : '' ?>>خبری و جذاب</option>
                            <option value="concise" <?= ($aiConfig['style'] ?? '') === 'concise' ? 'selected' : '' ?>>کوتاه و خلاصه</option>
                            <option value="friendly" <?= ($aiConfig['style'] ?? '') === 'friendly' ? 'selected' : '' ?>>دوستانه</option>
                            <option value="sports" <?= ($aiConfig['style'] ?? '') === 'sports' ? 'selected' : '' ?>>ورزشی</option>
                            <option value="professional" <?= ($aiConfig['style'] ?? '') === 'professional' ? 'selected' : '' ?>>حرفه‌ای</option>
                        </select>
                    </div>
                    <div>
                        <label class="block font-medium text-slate-300 mb-1">شدت بازنویسی (Intensity):</label>
                        <select name="ai_intensity" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:outline-none">
                            <option value="low" <?= ($aiConfig['intensity'] ?? '') === 'low' ? 'selected' : '' ?>>کم (تغییرات جزئی)</option>
                            <option value="medium" <?= ($aiConfig['intensity'] ?? '') === 'medium' ? 'selected' : '' ?>>متوسط (استاندارد)</option>
                            <option value="high" <?= ($aiConfig['intensity'] ?? '') === 'high' ? 'selected' : '' ?>>زیاد (بازآفرینی کامل)</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <button type="submit" class="py-3 px-8 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30 transition">
            💾 ذخیره تنظیمات سیستم
        </button>
    </form>
</div>

<?php
View::renderFooter();
