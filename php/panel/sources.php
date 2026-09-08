<?php
/**
 * Source Channels Management (Panel/sources.php)
 * -----------------------------------------------
 * افزودن، ویرایش کلمات کلیدی، مکث و حذف کانال‌های مبدا مانیتورینگ
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

// ۱. افزودن کانال جدید
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'add') {
    $token = $_POST['csrf_token'] ?? '';
    if (!Auth::validateCsrfToken($token)) {
        $error = 'توکن امنیتی نامعتبر است.';
    } else {
        $title    = trim($_POST['title'] ?? '');
        $username = trim($_POST['username'] ?? '');
        $keywords = trim($_POST['keywords'] ?? '');
        $matchMode = in_array($_POST['keyword_match_mode'] ?? 'any', ['any', 'all']) ? $_POST['keyword_match_mode'] : 'any';

        // پاکسازی یوزرنیم
        $username = ltrim($username, '@');
        $username = preg_replace('/^https?:\/\/t\.me\//', '', $username);

        if (empty($title) || empty($username)) {
            $error = 'عنوان کانال و آیدی/لینک الزامی است.';
        } else {
            $kwArray = array_filter(array_map('trim', explode("\n", $keywords)));
            $kwJson = !empty($kwArray) ? json_encode(array_values($kwArray), JSON_UNESCAPED_UNICODE) : null;
            $enableKw = !empty($kwArray) ? 1 : 0;
            $id = 'src_' . bin2hex(random_bytes(4));

            try {
                Database::query(
                    "INSERT INTO `sources` (`id`, `title`, `username`, `keywords_json`, `enable_keywords`, `keyword_match_mode`, `created_at`) 
                     VALUES (?, ?, ?, ?, ?, ?, NOW())",
                    [$id, $title, $username, $kwJson, $enableKw, $matchMode]
                );
                $msg = "کانال «{$title}» با موفقیت اضافه شد.";
            } catch (\Exception $e) {
                $error = "خطا در ثبت کانال: " . $e->getMessage();
            }
        }
    }
}

// ۲. عملیات تغییر وضعیت یا حذف
if (isset($_GET['action']) && isset($_GET['id'])) {
    $srcId = $_GET['id'];
    if ($_GET['action'] === 'toggle') {
        $src = Database::fetch("SELECT `status` FROM `sources` WHERE `id` = ?", [$srcId]);
        if ($src) {
            $newStatus = ($src['status'] === 'active') ? 'paused' : 'active';
            Database::query("UPDATE `sources` SET `status` = ? WHERE `id` = ?", [$newStatus, $srcId]);
            $msg = 'وضعیت کانال تغییر یافت.';
        }
    } elseif ($_GET['action'] === 'delete') {
        Database::query("DELETE FROM `sources` WHERE `id` = ?", [$srcId]);
        $msg = 'کانال مورد نظر حذف گردید.';
    }
}

$sources = Database::fetchAll("SELECT * FROM `sources` ORDER BY `created_at` DESC");
$csrfToken = Auth::generateCsrfToken();

View::renderHeader('مدیریت کانال‌های مبدا');
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

    <!-- Add Channel Form -->
    <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <span>➕</span>
            <span>افزودن کانال مبدا برای مانیتورینگ</span>
        </h3>

        <form method="POST" class="space-y-4">
            <input type="hidden" name="action" value="add">
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                    <label class="block font-medium text-slate-300 mb-1">نام یا عنوان کانال:</label>
                    <input type="text" name="title" required class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:outline-none" placeholder="مثال: کانال اخبار فناوری">
                </div>
                <div>
                    <label class="block font-medium text-slate-300 mb-1">یوزرنیم یا لینک کانال:</label>
                    <input type="text" name="username" required class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:outline-none" placeholder="مثال: tech_news یا https://t.me/tech_news">
                </div>
                <div class="sm:col-span-2">
                    <label class="block font-medium text-slate-300 mb-1">کلمات کلیدی اختصاصی کانال (هر خط یک کلمه - اختیاری):</label>
                    <textarea name="keywords" rows="3" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-cyan-500 focus:outline-none" placeholder="هوش مصنوعی&#10;تکنولوژی&#10;تخفیف"></textarea>
                </div>
                <div>
                    <label class="block font-medium text-slate-300 mb-1">حالت تطبیق کلمات کلیدی:</label>
                    <select name="keyword_match_mode" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 focus:outline-none">
                        <option value="any">حداقل یکی از کلمات وجود داشته باشد (OR)</option>
                        <option value="all">تمام کلمات باید در متن وجود داشته باشند (AND)</option>
                    </select>
                </div>
            </div>

            <button type="submit" class="py-2.5 px-6 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30 transition">
                ثبت و شروع رصد کانال
            </button>
        </form>
    </div>

    <!-- Channels List -->
    <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <span>📡</span>
            <span>لیست کانال‌های تحت نظر (<?= count($sources) ?> کانال)</span>
        </h3>

        <div class="overflow-x-auto">
            <table class="w-full text-right text-xs">
                <thead>
                    <tr class="text-slate-400 border-b border-slate-800">
                        <th class="pb-3 pr-2">عنوان</th>
                        <th class="pb-3">یوزرنیم</th>
                        <th class="pb-3">وضعیت</th>
                        <th class="pb-3">تعداد ارسال</th>
                        <th class="pb-3">کلمات اختصاصی</th>
                        <th class="pb-3 text-left pl-2">عملیات</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60">
                    <?php if (empty($sources)): ?>
                        <tr>
                            <td colspan="6" class="py-8 text-center text-slate-500">هیچ کانالی اضافه نشده است.</td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($sources as $s): ?>
                            <tr class="hover:bg-slate-800/30 transition">
                                <td class="py-3.5 pr-2 font-bold text-white"><?= htmlspecialchars($s['title']) ?></td>
                                <td class="py-3.5 font-mono text-cyan-400">@<?= htmlspecialchars($s['username']) ?></td>
                                <td class="py-3.5">
                                    <span class="px-2 py-0.5 rounded-md text-[11px] font-bold <?= $s['status'] === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400' ?>">
                                        <?= $s['status'] === 'active' ? 'در حال رصد' : 'متوقف' ?>
                                    </span>
                                </td>
                                <td class="py-3.5 font-mono font-bold text-slate-300"><?= $s['total_transferred'] ?></td>
                                <td class="py-3.5 text-slate-400">
                                    <?php
                                    $kws = !empty($s['keywords_json']) ? json_decode($s['keywords_json'], true) : [];
                                    echo !empty($kws) ? count($kws) . ' کلمه' : '<span class="text-slate-600">-</span>';
                                    ?>
                                </td>
                                <td class="py-3.5 text-left pl-2 space-x-2 space-x-reverse whitespace-nowrap">
                                    <a href="sources.php?action=toggle&id=<?= $s['id'] ?>" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition">
                                        <?= $s['status'] === 'active' ? '⏸️ توقف' : '▶️ فعال' ?>
                                    </a>
                                    <a href="sources.php?action=delete&id=<?= $s['id'] ?>" onclick="return confirm('آیا از حذف این کانال اطمینان دارید؟')" class="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition">
                                        🗑️ حذف
                                    </a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<?php
View::renderFooter();
