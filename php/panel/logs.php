<?php
/**
 * Activity & Transfer Logs (Panel/logs.php)
 * ------------------------------------------
 * مشاهده لاگ‌های ارسال موفق، رد شده با فیلترها و خطاهای سیستمی همراه با فیلتر
 */

define('APP_INIT', true);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/View.php';

use Core\Database;
use Core\Auth;
use Core\View;

Auth::requireLogin();

$statusFilter = $_GET['status'] ?? 'all';
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 25;
$offset = ($page - 1) * $perPage;

$whereClause = "";
$params = [];

if (in_array($statusFilter, ['success', 'skipped', 'error'])) {
    $whereClause = "WHERE `status` = ?";
    $params[] = $statusFilter;
}

$totalCount = (int)Database::fetchColumn("SELECT COUNT(*) FROM `logs` {$whereClause}", $params);
$totalPages = max(1, ceil($totalCount / $perPage));

$logs = Database::fetchAll("SELECT * FROM `logs` {$whereClause} ORDER BY `id` DESC LIMIT {$perPage} OFFSET {$offset}", $params);

// پاکسازی دستی لاگ‌ها
if (isset($_POST['clear_logs'])) {
    Database::query("TRUNCATE TABLE `logs`");
    header('Location: logs.php');
    exit;
}

View::renderHeader('گزارشات و لاگ‌های سیستم');
?>

<div class="space-y-6">
    <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2">
                <a href="logs.php?status=all" class="px-3 py-1.5 rounded-xl text-xs font-bold transition <?= $statusFilter === 'all' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700' ?>">همه (<?= $totalCount ?>)</a>
                <a href="logs.php?status=success" class="px-3 py-1.5 rounded-xl text-xs font-bold transition <?= $statusFilter === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700' ?>">ارسال موفق</a>
                <a href="logs.php?status=skipped" class="px-3 py-1.5 rounded-xl text-xs font-bold transition <?= $statusFilter === 'skipped' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700' ?>">فیلتر شده</a>
                <a href="logs.php?status=error" class="px-3 py-1.5 rounded-xl text-xs font-bold transition <?= $statusFilter === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700' ?>">خطاها</a>
            </div>

            <form method="POST" onsubmit="return confirm('آیا از حذف تمام تاریخچه لاگ‌ها مطمئن هستید؟')">
                <button type="submit" name="clear_logs" class="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition">
                    🗑️ پاکسازی لاگ‌ها
                </button>
            </form>
        </div>

        <div class="overflow-x-auto">
            <table class="w-full text-right text-xs">
                <thead>
                    <tr class="text-slate-400 border-b border-slate-800">
                        <th class="pb-3 pr-2">شناسه</th>
                        <th class="pb-3">زمان</th>
                        <th class="pb-3">کانال مبدا</th>
                        <th class="pb-3">شناسه پیام</th>
                        <th class="pb-3">وضعیت</th>
                        <th class="pb-3">جزئیات رویداد</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60">
                    <?php if (empty($logs)): ?>
                        <tr>
                            <td colspan="6" class="py-8 text-center text-slate-500">هیچ لاگی با این فیلتر یافت نشد.</td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($logs as $log): ?>
                            <tr class="hover:bg-slate-800/30 transition">
                                <td class="py-3.5 pr-2 font-mono text-slate-500">#<?= $log['id'] ?></td>
                                <td class="py-3.5 font-mono text-slate-400 whitespace-nowrap"><?= htmlspecialchars($log['created_at']) ?></td>
                                <td class="py-3.5 font-bold text-white"><?= htmlspecialchars($log['source_title']) ?></td>
                                <td class="py-3.5 font-mono text-slate-400"><?= $log['message_id'] ? '#' . $log['message_id'] : '-' ?></td>
                                <td class="py-3.5 whitespace-nowrap">
                                    <?php if ($log['status'] === 'success'): ?>
                                        <span class="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold">ارسال موفق</span>
                                    <?php elseif ($log['status'] === 'skipped'): ?>
                                        <span class="px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">رد شده (فیلتر)</span>
                                    <?php else: ?>
                                        <span class="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 font-bold">خطا</span>
                                    <?php endif; ?>
                                </td>
                                <td class="py-3.5 text-slate-300 max-w-lg leading-relaxed"><?= htmlspecialchars($log['details']) ?></td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <?php if ($totalPages > 1): ?>
            <div class="flex items-center justify-center gap-2 pt-4 border-t border-slate-800 text-xs">
                <?php for ($p = 1; $p <= $totalPages; $p++): ?>
                    <a href="logs.php?status=<?= $statusFilter ?>&page=<?= $p ?>" class="w-8 h-8 flex items-center justify-center rounded-lg font-mono font-bold <?= $p === $page ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700' ?>">
                        <?= $p ?>
                    </a>
                <?php endfor; ?>
            </div>
        <?php endif; ?>
    </div>
</div>

<?php
View::renderFooter();
