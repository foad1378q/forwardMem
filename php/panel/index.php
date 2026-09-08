<?php
/**
 * Dashboard Main Overview (Panel/index.php)
 * -----------------------------------------
 * خلاصه وضعیت زنده سرور، ضربان ورکر، آمار روزانه و آخرین لاگ‌ها
 */

define('APP_INIT', true);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/View.php';

use Core\Database;
use Core\Auth;
use Core\View;

Auth::requireLogin();

// عملیات سریع تغییر وضعیت مانیتورینگ
if (isset($_GET['action'])) {
    if ($_GET['action'] === 'pause') {
        Database::setSetting('is_monitoring_paused', 1);
        header('Location: index.php');
        exit;
    } elseif ($_GET['action'] === 'resume') {
        Database::setSetting('is_monitoring_paused', 0);
        header('Location: index.php');
        exit;
    }
}

// آمار کلی
$totalSources = (int)Database::fetchColumn("SELECT COUNT(*) FROM `sources`");
$activeSources = (int)Database::fetchColumn("SELECT COUNT(*) FROM `sources` WHERE `status` = 'active'");
$totalTransferred = (int)Database::fetchColumn("SELECT SUM(`total_transferred`) FROM `sources`");
$todayTransferred = (int)Database::fetchColumn("SELECT COUNT(*) FROM `logs` WHERE `status` = 'success' AND `created_at` >= CURDATE()");

// وضعیت ورکر
$lastHeartbeat = Database::getSetting('worker_heartbeat', null);
$isWorkerOnline = false;
$heartbeatDiffSec = 0;

if ($lastHeartbeat) {
    $heartbeatTime = strtotime($lastHeartbeat);
    $heartbeatDiffSec = time() - $heartbeatTime;
    $isWorkerOnline = ($heartbeatDiffSec <= 60); // اگر کمتر از ۶۰ ثانیه قبل پالس زده باشد
}

$isPaused = (bool)Database::getSetting('is_monitoring_paused', false);
$destChannel = Database::getSetting('destination_channel', 'تعیین نشده');

// آخرین لاگ‌ها
$recentLogs = Database::fetchAll("SELECT * FROM `logs` ORDER BY `id` DESC LIMIT 8");

View::renderHeader('داشبورد مدیریت');
?>

<div class="space-y-6">
    <!-- Top Action Banner -->
    <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="space-y-1">
            <div class="flex items-center gap-3">
                <h2 class="text-lg font-bold text-white">کنترل وضعیت مانیتورینگ</h2>
                <span class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold <?= $isWorkerOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30' ?>">
                    <span class="w-2 h-2 rounded-full <?= $isWorkerOnline ? 'bg-emerald-400 animate-ping' : 'bg-rose-400' ?>"></span>
                    <?= $isWorkerOnline ? 'ورکر آنلاین است' : 'ورکر آفلاین / بدون پالس' ?>
                </span>
            </div>
            <p class="text-xs text-slate-400">
                کانال مقصد: <span class="font-mono font-bold text-cyan-400"><?= htmlspecialchars($destChannel) ?></span>
                <?php if ($lastHeartbeat): ?>
                    | آخرین پالس سلامت: <?= htmlspecialchars($lastHeartbeat) ?> (<?= $heartbeatDiffSec ?> ثانیه قبل)
                <?php endif; ?>
            </p>
        </div>

        <div class="flex items-center gap-3 w-full sm:w-auto">
            <?php if ($isPaused): ?>
                <a href="index.php?action=resume" class="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-1.5">
                    <span>▶️</span>
                    <span>ازسرگیری مانیتورینگ</span>
                </a>
            <?php else: ?>
                <a href="index.php?action=pause" class="flex-1 sm:flex-none px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-600/20 transition flex items-center justify-center gap-1.5">
                    <span>⏸️</span>
                    <span>توقف موقت مانیتورینگ</span>
                </a>
            <?php endif; ?>

            <a href="sources.php" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5">
                <span>➕ کانال جدید</span>
            </a>
        </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2">
            <span class="text-xs text-slate-400">کانال‌های مبدا</span>
            <div class="flex items-baseline justify-between">
                <span class="text-2xl font-black text-white font-mono"><?= $totalSources ?></span>
                <span class="text-xs font-bold text-emerald-400"><?= $activeSources ?> فعال</span>
            </div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2">
            <span class="text-xs text-slate-400">انتقال‌های امروز</span>
            <div class="flex items-baseline justify-between">
                <span class="text-2xl font-black text-cyan-400 font-mono"><?= $todayTransferred ?></span>
                <span class="text-xs text-slate-500">پست</span>
            </div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2">
            <span class="text-xs text-slate-400">مجموع پیام‌های منتقل‌شده</span>
            <div class="flex items-baseline justify-between">
                <span class="text-2xl font-black text-emerald-400 font-mono"><?= number_format($totalTransferred) ?></span>
                <span class="text-xs text-slate-500">کل دوره</span>
            </div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2">
            <span class="text-xs text-slate-400">سیستم پشتیبان‌گیری</span>
            <div class="flex items-baseline justify-between">
                <span class="text-sm font-bold text-slate-200">الگوی Faoxima</span>
                <a href="backup.php" class="text-xs text-cyan-400 hover:underline">اجرا ⬅️</a>
            </div>
        </div>
    </div>

    <!-- Recent Logs Table -->
    <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <span>📑</span>
                <span>آخرین وقایع و گزارش‌های پردازش</span>
            </h3>
            <a href="logs.php" class="text-xs text-cyan-400 hover:underline">مشاهده همه لاگ‌ها ⬅️</a>
        </div>

        <div class="overflow-x-auto">
            <table class="w-full text-right text-xs">
                <thead>
                    <tr class="text-slate-400 border-b border-slate-800">
                        <th class="pb-3 pr-2">زمان</th>
                        <th class="pb-3">کانال مبدا</th>
                        <th class="pb-3">وضعیت</th>
                        <th class="pb-3">توضیحات و جزئیات</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60">
                    <?php if (empty($recentLogs)): ?>
                        <tr>
                            <td colspan="4" class="py-6 text-center text-slate-500">هنوز هیچ رویدادی ثبت نشده است.</td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($recentLogs as $log): ?>
                            <tr class="hover:bg-slate-800/30 transition">
                                <td class="py-3 pr-2 font-mono text-slate-400 whitespace-nowrap"><?= htmlspecialchars($log['created_at']) ?></td>
                                <td class="py-3 font-bold text-slate-200"><?= htmlspecialchars($log['source_title']) ?></td>
                                <td class="py-3 whitespace-nowrap">
                                    <?php if ($log['status'] === 'success'): ?>
                                        <span class="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold">ارسال موفق</span>
                                    <?php elseif ($log['status'] === 'skipped'): ?>
                                        <span class="px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">رد شده (فیلتر)</span>
                                    <?php else: ?>
                                        <span class="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 font-bold">خطا</span>
                                    <?php endif; ?>
                                </td>
                                <td class="py-3 text-slate-300 max-w-md truncate"><?= htmlspecialchars($log['details']) ?></td>
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
