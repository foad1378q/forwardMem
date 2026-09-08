<?php
/**
 * Manual Backup & Download (Panel/backup.php)
 * -------------------------------------------
 * ایجاد پشتیبان فوری، دانلود فایل ZIP و ارسال به گروه تلگرام
 */

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/BackupService.php';
require_once __DIR__ . '/../core/View.php';

use Core\Auth;
use Core\Database;
use Core\BackupService;
use Core\View;

Auth::requireLogin();

$msg = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && Auth::validateCsrfToken($_POST['csrf_token'] ?? '')) {
    $sendTg = isset($_POST['send_telegram']);
    $res = BackupService::runBackup($sendTg);
    $msg = $res['message'];
}

$lastBackup = Database::getSetting('last_backup_time', null);
$backups = glob(__DIR__ . '/../backups/*.zip');

View::renderHeader('پشتیبان‌گیری');
?>

<div class="max-w-3xl mx-auto space-y-6">
    <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h2 class="text-base font-bold text-white">💾 پشتیبان‌گیری از پایگاه داده و تنظیمات</h2>
        <p class="text-xs text-slate-400 mt-0.5">ایجاد فایل ZIP حاوی ساختار کامل MySQL و فایل کانفیگ همراه با قابلیت ارسال به تلگرام</p>
    </div>

    <?php if ($msg): ?>
        <div class="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400">
            ✅ <?= htmlspecialchars($msg) ?>
        </div>
    <?php endif; ?>

    <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div class="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
            <span>آخرین زمان پشتیبان‌گیری خودکار:</span>
            <span class="font-mono text-cyan-400"><?= $lastBackup ? date('Y/m/d H:i:s', strtotime($lastBackup)) : 'هنوز انجام نشده' ?></span>
        </div>

        <form method="POST" action="backup.php" class="flex flex-col sm:flex-row gap-2">
            <input type="hidden" name="csrf_token" value="<?= Auth::generateCsrfToken() ?>">
            <button type="submit" class="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30 transition">
                📦 ایجاد پشتیبان فوری
            </button>
            <button type="submit" name="send_telegram" value="1" class="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold transition">
                🚀 ایجاد و ارسال مستقیم به تلگرام
            </button>
        </form>
    </div>

    <!-- Available Backup Files -->
    <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
        <h3 class="text-xs font-bold text-white">فایل‌های پشتیبان موجود روی هاست:</h3>
        <div class="space-y-2 text-xs">
            <?php if (empty($backups)): ?>
                <p class="text-slate-500 text-center py-4">هیچ فایل پشتیبانی وجود ندارد.</p>
            <?php else: ?>
                <?php foreach (array_reverse($backups) as $bf): ?>
                    <?php 
                        $bName = basename($bf); 
                        $bSize = round(filesize($bf) / (1024 * 1024), 2);
                        $bTime = date('Y/m/d H:i:s', filemtime($bf));
                    ?>
                    <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <div class="flex items-center gap-2">
                            <span class="text-cyan-400">📦</span>
                            <span class="font-mono text-slate-300"><?= htmlspecialchars($bName) ?></span>
                            <span class="text-slate-500">(<?= $bSize ?> MB)</span>
                        </div>
                        <span class="text-[11px] text-slate-500 font-mono"><?= $bTime ?></span>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php View::renderFooter(); ?>
