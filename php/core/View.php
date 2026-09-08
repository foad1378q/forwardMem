<?php
/**
 * View & Layout Component Renderer (Core/View.php)
 * -----------------------------------------------
 * تولید سربرگ، نوبار، نوار وظیفه شناور، و فوتر پنل ادمین با طراحی مدرن و راست‌چین (RTL)
 */

namespace Core;

class View {
    public static function renderHeader(string $title = 'داشبورد مدیریت'): void {
        $appName = Database::getSetting('app_name', 'فروارد هوشمند تلگرام');
        ?>
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title><?= htmlspecialchars($title) ?> | <?= htmlspecialchars($appName) ?></title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
            <style>
                body { font-family: Vazirmatn, system-ui, -apple-system, sans-serif; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            </style>
        </head>
        <body class="bg-slate-900 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-cyan-500 selection:text-white pb-24 md:pb-12">
        <?php self::renderNavbar(); ?>
        <main class="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
        <?php
    }

    public static function renderNavbar(): void {
        $isPaused = (bool)Database::getSetting('is_monitoring_paused', false);
        ?>
        <header class="bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-40">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 font-bold">
                        ⚡
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h1 class="text-base font-bold text-white tracking-tight">فروارد هوشمند تلگرام</h1>
                            <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono font-bold">
                                PHP v8.2 + MadelineProto
                            </span>
                        </div>
                        <p class="text-xs text-slate-400">داشبورد مانیتورینگ کانال‌ها و مدیریت ربات</p>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <span class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold <?= $isPaused ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' ?>">
                        <span class="w-2 h-2 rounded-full <?= $isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse' ?>"></span>
                        <?= $isPaused ? 'مانیتورینگ متوقف است' : 'مانیتورینگ فعال است' ?>
                    </span>

                    <a href="logout.php" class="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5">
                        <span>خروج</span>
                    </a>
                </div>
            </div>
        </header>
        <?php
    }

    public static function renderFooter(): void {
        $activePage = basename($_SERVER['PHP_SELF'] ?? 'index.php');
        ?>
        </main>

        <!-- Taskbar Navigation Dock for Mobile & Desktop -->
        <nav class="fixed bottom-3 left-2 right-2 sm:left-auto sm:right-1/2 sm:translate-x-1/2 z-40 max-w-4xl w-auto">
            <div class="bg-slate-950/95 backdrop-blur-xl border border-slate-800 text-white rounded-2xl shadow-2xl p-1.5 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
                <?php
                $navs = [
                    ['url' => 'index.php', 'title' => 'داشبورد', 'icon' => '📊'],
                    ['url' => 'sources.php', 'title' => 'کانال‌ها', 'icon' => '📡'],
                    ['url' => 'inbot.php', 'title' => 'مدیریت ربات', 'icon' => '🤖'],
                    ['url' => 'filters.php', 'title' => 'فیلترها', 'icon' => '🧹'],
                    ['url' => 'settings.php', 'title' => 'تنظیمات', 'icon' => '⚙️'],
                    ['url' => 'logs.php', 'title' => 'لاگ‌ها', 'icon' => '📑'],
                    ['url' => 'backup.php', 'title' => 'پشتیبان‌گیری', 'icon' => '💾'],
                ];

                foreach ($navs as $nav) {
                    $isActive = ($activePage === $nav['url']);
                    ?>
                    <a href="<?= $nav['url'] ?>" class="flex flex-col sm:flex-row items-center gap-1 py-1.5 px-3 rounded-xl text-xs font-bold transition shrink-0 select-none <?= $isActive ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900' ?>">
                        <span><?= $nav['icon'] ?></span>
                        <span class="text-[11px] sm:text-xs"><?= $nav['title'] ?></span>
                    </a>
                    <?php
                }
                ?>
            </div>
        </nav>
        </body>
        </html>
        <?php
    }
}
