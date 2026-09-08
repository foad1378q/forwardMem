<?php
/**
 * Content Cleaning & Keyword Filters (Panel/filters.php)
 * ------------------------------------------------------
 * تنظیمات پاکسازی لینک‌ها، شماره‌ها، منشن‌ها، کلمات ممنوعه و امضای اختصاصی
 */

define('APP_INIT', true);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/View.php';

use Core\Database;
use Core\Auth;
use Core\View;

Auth::requireLogin();

$msg = null;
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = $_POST['csrf_token'] ?? '';
    if (!Auth::validateCsrfToken($token)) {
        $error = 'توکن امنیتی منقضی شده است.';
    } else {
        $aiProcessing = [
            'enableContentCleaning'  => isset($_POST['enableContentCleaning']),
            'removeTelegramLinks'    => isset($_POST['removeTelegramLinks']),
            'removeWebLinks'         => isset($_POST['removeWebLinks']),
            'removeUsernames'        => isset($_POST['removeUsernames']),
            'removeHashtags'         => isset($_POST['removeHashtags']),
            'removePhoneNumbers'     => isset($_POST['removePhoneNumbers']),
            'enableMessageSignature' => isset($_POST['enableMessageSignature']),
            'customSignatureText'    => trim($_POST['customSignatureText'] ?? ''),
            'blockedWords'           => array_filter(array_map('trim', explode("\n", $_POST['blockedWords'] ?? ''))),
        ];

        Database::setSetting('ai_processing', $aiProcessing);

        // کلمات کلیدی سراسری
        $enableGlobalKw = isset($_POST['enable_global_keywords']);
        $globalMode     = in_array($_POST['global_keyword_match_mode'] ?? 'any', ['any', 'all']) ? $_POST['global_keyword_match_mode'] : 'any';
        $globalKwList   = array_filter(array_map('trim', explode("\n", $_POST['global_keywords'] ?? '')));

        Database::setSetting('enable_global_keywords', $enableGlobalKw ? 1 : 0);
        Database::setSetting('global_keyword_match_mode', $globalMode);
        Database::setSetting('global_keywords', $globalKwList);

        $msg = 'تنظیمات فیلترها و پاکسازی با موفقیت ذخیره گردید.';
    }
}

$ai = Database::getSetting('ai_processing', []);
$enableGlobalKw = (bool)Database::getSetting('enable_global_keywords', false);
$globalMode     = Database::getSetting('global_keyword_match_mode', 'any');
$globalKwList   = Database::getSetting('global_keywords', []);

$csrfToken = Auth::generateCsrfToken();

View::renderHeader('تنظیمات فیلترها و پاکسازی');
?>

<div class="space-y-6">
    <?php if ($msg): ?>
        <div class="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 font-bold">
            ✅ <?= htmlspecialchars($msg) ?>
        </div>
    <?php endif; ?>

    <form method="POST" class="space-y-6">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">

        <!-- Content Cleaning Settings -->
        <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <span>🧹</span>
                <span>پاکسازی خودکار تبلیغات، لینک‌ها و متون اضافه</span>
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <label class="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                    <input type="checkbox" name="enableContentCleaning" <?= !empty($ai['enableContentCleaning']) ? 'checked' : '' ?> class="w-4 h-4 text-cyan-600 rounded bg-slate-900 border-slate-700">
                    <span class="font-bold text-slate-200">فعال‌سازی کلی پاکسازی محتوا</span>
                </label>

                <label class="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                    <input type="checkbox" name="removeTelegramLinks" <?= !empty($ai['removeTelegramLinks']) ? 'checked' : '' ?> class="w-4 h-4 text-cyan-600 rounded bg-slate-900 border-slate-700">
                    <span class="text-slate-300">حذف لینک‌های تلگرام (t.me و telegram.me)</span>
                </label>

                <label class="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                    <input type="checkbox" name="removeWebLinks" <?= !empty($ai['removeWebLinks']) ? 'checked' : '' ?> class="w-4 h-4 text-cyan-600 rounded bg-slate-900 border-slate-700">
                    <span class="text-slate-300">حذف لینک‌های وب (http و https)</span>
                </label>

                <label class="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                    <input type="checkbox" name="removeUsernames" <?= !empty($ai['removeUsernames']) ? 'checked' : '' ?> class="w-4 h-4 text-cyan-600 rounded bg-slate-900 border-slate-700">
                    <span class="text-slate-300">حذف آیدی و منشن‌ها (@username)</span>
                </label>

                <label class="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                    <input type="checkbox" name="removeHashtags" <?= !empty($ai['removeHashtags']) ? 'checked' : '' ?> class="w-4 h-4 text-cyan-600 rounded bg-slate-900 border-slate-700">
                    <span class="text-slate-300">حذف هشتگ‌ها (#hashtag)</span>
                </label>

                <label class="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                    <input type="checkbox" name="removePhoneNumbers" <?= !empty($ai['removePhoneNumbers']) ? 'checked' : '' ?> class="w-4 h-4 text-cyan-600 rounded bg-slate-900 border-slate-700">
                    <span class="text-slate-300">حذف شماره‌های تماس و موبایل</span>
                </label>
            </div>
        </div>

        <!-- Custom Signature -->
        <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <span>✍️</span>
                <span>امضای اختصاصی در انتهای پیام‌های فورواردشده</span>
            </h3>

            <div class="space-y-3 text-xs">
                <label class="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" name="enableMessageSignature" <?= !empty($ai['enableMessageSignature']) ? 'checked' : '' ?> class="w-4 h-4 text-cyan-600 rounded bg-slate-900 border-slate-700">
                    <span class="font-bold text-slate-200">افزودن خودکار متن امضا به انتهای تمام پست‌ها</span>
                </label>

                <textarea name="customSignatureText" rows="3" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-cyan-500 focus:outline-none" placeholder="🚀 عضویت در کانال ما:&#10;@my_destination_channel"><?= htmlspecialchars($ai['customSignatureText'] ?? '') ?></textarea>
            </div>
        </div>

        <!-- Blacklist & Global Keywords -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <h3 class="text-sm font-bold text-rose-400 flex items-center gap-2">
                    <span>⛔</span>
                    <span>لیست سیاه کلمات ممنوعه (Blacklist)</span>
                </h3>
                <p class="text-xs text-slate-400">اگر پیامی حاوی هر یک از این کلمات باشد، فوروارد نخواهد شد (هر خط یک کلمه):</p>
                <textarea name="blockedWords" rows="5" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs font-mono focus:border-rose-500 focus:outline-none" placeholder="تبلیغ&#10;قمار&#10;شرط بندی"><?= htmlspecialchars(implode("\n", $ai['blockedWords'] ?? [])) ?></textarea>
            </div>

            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <h3 class="text-sm font-bold text-cyan-400 flex items-center gap-2">
                    <span>🌐</span>
                    <span>کلمات کلیدی سراسری (Global Keywords)</span>
                </h3>
                <label class="flex items-center gap-2 cursor-pointer text-xs">
                    <input type="checkbox" name="enable_global_keywords" <?= $enableGlobalKw ? 'checked' : '' ?> class="w-4 h-4 text-cyan-600 rounded bg-slate-900 border-slate-700">
                    <span class="text-slate-200">فیلتر اجباری سراسری برای تمام کانال‌ها</span>
                </label>
                <textarea name="global_keywords" rows="3" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none" placeholder="هوش مصنوعی&#10;فناوری"><?= htmlspecialchars(implode("\n", $globalKwList)) ?></textarea>
            </div>
        </div>

        <button type="submit" class="py-3 px-8 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30 transition">
            💾 ذخیره تغییرات فیلترها
        </button>
    </form>
</div>

<?php
View::renderFooter();
