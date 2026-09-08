<?php
/**
 * Professional Web-Based Setup Wizard (installer/index.php)
 * ---------------------------------------------------------
 * سامانه نصب گرافیکی و خودکار مرحله‌به‌مرحله سازگار با cPanel و هاست‌های اشتراکی
 * (طراحی‌شده بر اساس استانداردهای مدرن شبیه به پروژه Faoxima)
 */

define('APP_INIT', true);

$lockFile = __DIR__ . '/../config/installed.lock';
$isLocked = file_exists($lockFile);

// بررسی پیش‌نیازهای سرور
$requirements = [
    'نسخه PHP (حداقل 8.1)'    => [
        'passed' => version_compare(PHP_VERSION, '8.1.0', '>='),
        'desc'   => 'نسخه فعلی: PHP ' . PHP_VERSION,
        'help'   => 'در صورت عدم تایید، در بخش Select PHP Version سیپنل، نسخه را روی 8.1 یا بالاتر بگذارید.'
    ],
    'اکستنشن PDO'             => [
        'passed' => extension_loaded('pdo'),
        'desc'   => extension_loaded('pdo') ? 'فعال است' : 'غیرفعال',
        'help'   => 'اکستنشن pdo را در بخش PHP Extensions سیپنل فعال نمایید.'
    ],
    'اکستنشن PDO MySQL'       => [
        'passed' => extension_loaded('pdo_mysql'),
        'desc'   => extension_loaded('pdo_mysql') ? 'فعال است' : 'غیرفعال',
        'help'   => 'اکستنشن pdo_mysql را برای اتصال به پایگاه داده فعال کنید.'
    ],
    'اکستنشن cURL و SSL'      => [
        'passed' => extension_loaded('curl'),
        'desc'   => extension_loaded('curl') ? 'فعال است' : 'غیرفعال',
        'help'   => 'برای ارتباط با API تلگرام و هوش مصنوعی الزامی است.'
    ],
    'اکستنشن ZipArchive'      => [
        'passed' => extension_loaded('zip'),
        'desc'   => extension_loaded('zip') ? 'فعال است' : 'غیرفعال',
        'help'   => 'برای سیستم پشتیبان‌گیری خودکار ZIP مورد نیاز است.'
    ],
    'اکستنشن mbstring'        => [
        'passed' => extension_loaded('mbstring'),
        'desc'   => extension_loaded('mbstring') ? 'فعال است' : 'غیرفعال',
        'help'   => 'برای پردازش متون و اموجی‌های فارسی و یونیکد الزامی است.'
    ],
    'اکستنشن OpenSSL'         => [
        'passed' => extension_loaded('openssl'),
        'desc'   => extension_loaded('openssl') ? 'فعال است' : 'غیرفعال',
        'help'   => 'برای برقراری ارتباط امن و رمزنگاری داده‌ها لازم است.'
    ],
    'دسترسی نوشتن فایل‌ها (Write)' => [
        'passed' => is_writable(__DIR__ . '/..') || is_writable(__DIR__ . '/../config'),
        'desc'   => 'دسترسی پوشه اصلی مجاز است',
        'help'   => 'مطمئن شوید پرمیشن پوشه‌های config و session روی 755 باشد.'
    ],
];

$allRequirementsPassed = true;
foreach ($requirements as $r) {
    if (!$r['passed']) {
        $allRequirementsPassed = false;
        break;
    }
}

// تشخیص آدرس خودکار وب‌هوک
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$scriptDir = dirname(dirname($_SERVER['SCRIPT_NAME']));
$scriptDir = rtrim($scriptDir, '/\\');
$autoWebhookUrl = "https://" . $host . ($scriptDir ? $scriptDir : '') . "/webhook.php";

// مسیر فیزیکی هاست برای کرون‌جاب
$cronPath = realpath(__DIR__ . '/../cron/dispatcher.php');
if (!$cronPath) {
    $cronPath = '/home/username/public_html/cron/dispatcher.php';
}
?>
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>نصب و راه‌اندازی سامانه فوروارد هوشمند تلگرام | Faoxima Installer</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
    <style>
        body { font-family: Vazirmatn, sans-serif; }
        .step-content { display: none; }
        .step-content.active { display: block; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #06b6d4; }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen py-6 sm:py-10 px-3 sm:px-4 flex items-center justify-center selection:bg-cyan-500 selection:text-white">

<div class="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">

    <!-- Top Glow Header -->
    <div class="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"></div>

    <?php if ($isLocked && !isset($_GET['force_unlock'])): ?>
    <!-- Locked State Notification -->
    <div class="text-center py-8 space-y-5">
        <div class="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl mx-auto flex items-center justify-center text-3xl">
            🔒
        </div>
        <div class="space-y-2">
            <h2 class="text-2xl font-black text-white">سامانه قبلاً با موفقیت نصب شده است</h2>
            <p class="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                فایل قفل نصاب (<code class="text-cyan-400 font-mono">config/installed.lock</code>) فعال است و جهت حفظ امنیت، نصاب قفل گردیده است.
            </p>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
            <a href="../panel/login.php" class="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/20 transition">
                🚀 ورود به پنل مدیریت وب
            </a>
            <a href="index.php?force_unlock=1" class="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition">
                ⚙️ مشاهده وضعیت یا نصب مجدد
            </a>
        </div>
    </div>
    <?php else: ?>

    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/20 font-bold">
                ⚡
            </div>
            <div>
                <h1 class="text-lg sm:text-xl font-black text-white">نصاب خودکار هوشمند تلگرام</h1>
                <p class="text-xs text-slate-400">راهنمای قدم‌به‌قدم راه‌اندازی ربات روی cPanel و هاست اشتراکی</p>
            </div>
        </div>
        <div class="text-xs bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700 text-slate-300 font-mono">
            Faoxima Installer v2.5
        </div>
    </div>

    <!-- Stepper Navigation -->
    <div class="grid grid-cols-6 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs">
        <div id="step-nav-1" class="step-nav-btn py-2 px-1 rounded-xl bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 font-bold">
            ۱. سرور
        </div>
        <div id="step-nav-2" class="step-nav-btn py-2 px-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
            ۲. ربات
        </div>
        <div id="step-nav-3" class="step-nav-btn py-2 px-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
            ۳. دیتابیس
        </div>
        <div id="step-nav-4" class="step-nav-btn py-2 px-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
            ۴. نصب
        </div>
        <div id="step-nav-5" class="step-nav-btn py-2 px-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
            ۵. وب‌هوک
        </div>
        <div id="step-nav-6" class="step-nav-btn py-2 px-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
            ۶. کرون و اتمام
        </div>
    </div>

    <!-- MAIN FORM & STEPS CONTAINER -->
    <form id="installerForm" class="space-y-6" onsubmit="return false;">

        <!-- STEP 1: Server Requirements -->
        <div id="step-1" class="step-content active space-y-4">
            <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div class="flex items-center justify-between">
                    <h2 class="text-sm font-bold text-slate-200 flex items-center gap-2">
                        <span>🔍</span>
                        <span>مرحله ۱ از ۶ — بررسی وضعیت سرور و پیش‌نیازهای cPanel</span>
                    </h2>
                    <span class="text-[11px] <?= $allRequirementsPassed ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10' ?> px-2.5 py-1 rounded-full font-bold">
                        <?= $allRequirementsPassed ? '✓ پیش‌نیازها تایید شد' : '⚠️ نیاز به بررسی' ?>
                    </span>
                </div>

                <div class="space-y-2 pt-2">
                    <?php foreach ($requirements as $reqName => $reqData): ?>
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border <?= $reqData['passed'] ? 'border-slate-800' : 'border-rose-500/30 bg-rose-500/5' ?> text-xs gap-2">
                        <div class="flex items-center gap-2">
                            <span class="<?= $reqData['passed'] ? 'text-emerald-400' : 'text-rose-400' ?> font-bold">
                                <?= $reqData['passed'] ? '✓' : '✗' ?>
                            </span>
                            <span class="text-slate-200 font-medium"><?= $reqName ?></span>
                            <span class="text-slate-400 text-[11px]">(<?= $reqData['desc'] ?>)</span>
                        </div>
                        <?php if (!$reqData['passed']): ?>
                            <span class="text-rose-300 text-[11px]"><?= $reqData['help'] ?></span>
                        <?php else: ?>
                            <span class="text-emerald-400 font-bold text-[11px]">تایید شد</span>
                        <?php endif; ?>
                    </div>
                    <?php endforeach; ?>
                </div>

                <?php if (!$allRequirementsPassed): ?>
                <div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 space-y-1">
                    <p class="font-bold">راهنمای فعال‌سازی در cPanel:</p>
                    <p>وارد سیپنل شوید، به بخش <strong>Select PHP Version</strong> یا <strong>MultiPHP INI Editor</strong> رفته و ماژول‌های ناقص فوق را فعال نمایید.</p>
                </div>
                <?php endif; ?>
            </div>

            <div class="flex justify-end pt-2">
                <button type="button" onclick="goToStep(2)" <?= !$allRequirementsPassed ? 'disabled' : '' ?> class="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2">
                    <span>مرحله بعد: تنظیمات ربات</span>
                    <span>←</span>
                </button>
            </div>
        </div>

        <!-- STEP 2: Telegram Bot and Admin -->
        <div id="step-2" class="step-content space-y-4">
            <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <h2 class="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <span>🤖</span>
                    <span>مرحله ۲ از ۶ — اطلاعات ربات تلگرام و حساب کاربری مدیر</span>
                </h2>

                <div class="space-y-4 text-xs">
                    <!-- Bot Token & Test -->
                    <div>
                        <label class="block font-medium text-slate-300 mb-1">
                            توکن ربات تلگرام (Bot Token): <span class="text-rose-400">*</span>
                        </label>
                        <div class="flex gap-2">
                            <input type="text" id="bot_token" name="bot_token" required placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" class="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono placeholder:text-slate-600 text-xs">
                            <button type="button" onclick="testBotToken()" id="btnTestBot" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap">
                                <span>🔍</span>
                                <span>تست توکن</span>
                            </button>
                        </div>
                        <div id="botTokenFeedback" class="mt-1.5 hidden text-[11px] p-2 rounded-lg"></div>
                        <p class="text-[11px] text-slate-500 mt-1">توکن اختصاصی ساخته شده از طریق <a href="https://t.me/BotFather" target="_blank" class="text-cyan-400 underline">@BotFather</a></p>
                    </div>

                    <!-- Destination Channel & Admin User ID -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block font-medium text-slate-300 mb-1">
                                کانال مقصد پیش‌فرض (Destination Channel): <span class="text-rose-400">*</span>
                            </label>
                            <input type="text" id="destination_channel" name="destination_channel" required placeholder="@my_destination_channel" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono placeholder:text-slate-600 text-xs">
                            <p class="text-[11px] text-slate-500 mt-1">یوزرنیم کانال مقصد یا شناسه عددی با -100 (ربات باید در کانال ادمین باشد).</p>
                        </div>

                        <div>
                            <label class="block font-medium text-slate-300 mb-1">
                                شناسه عددی تلگرام مدیر (Telegram Admin ID):
                            </label>
                            <input type="text" id="admin_user_id" name="admin_user_id" placeholder="123456789" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono placeholder:text-slate-600 text-xs">
                            <p class="text-[11px] text-slate-500 mt-1">شناسه عددی اکانت شما برای دسترسی به منوهای شیشه‌ای ربات (دریافت از <a href="https://t.me/userinfobot" target="_blank" class="text-cyan-400 underline">@userinfobot</a>).</p>
                        </div>
                    </div>

                    <!-- Web Panel Login Credentials -->
                    <div class="border-t border-slate-800/80 pt-3">
                        <h3 class="text-xs font-bold text-cyan-400 mb-2">اطلاعات ورود به پنل مدیریت وب</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label class="block font-medium text-slate-300 mb-1">نام کاربری پنل:</label>
                                <input type="text" id="admin_username" name="admin_username" value="admin" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono text-xs">
                            </div>
                            <div>
                                <label class="block font-medium text-slate-300 mb-1">کلمه عبور پنل وب:</label>
                                <input type="password" id="admin_password" name="admin_password" value="admin123" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono text-xs">
                            </div>
                            <div>
                                <label class="block font-medium text-slate-300 mb-1">رمز دستوری درون ربات:</label>
                                <input type="text" id="admin_passcode" name="admin_passcode" value="admin123" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono text-xs" title="جهت لاگین در پیوی ربات با /login admin123">
                            </div>
                        </div>
                    </div>

                    <!-- Optional MTProto / User Client Accordion -->
                    <details class="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                        <summary class="cursor-pointer font-bold text-slate-300 text-xs flex items-center justify-between">
                            <span>📡 تنظیمات کلاینت اکانت تلگرام (MTProto / اختیاری)</span>
                            <span class="text-slate-500 text-[10px]">کلیک برای باز کردن ▾</span>
                        </summary>
                        <div class="pt-3 space-y-3 border-t border-slate-800 mt-2 text-xs">
                            <p class="text-[11px] text-slate-400">اگر می‌خواهید پیام‌ها را مستقیماً با اکانت واقعی تلگرام (MTProto) از کانال‌های مبدا بخوانید، مقادیر زیر را از <a href="https://my.telegram.org" target="_blank" class="text-cyan-400 underline">my.telegram.org</a> وارد کنید:</p>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-slate-400 mb-1">Telegram API ID:</label>
                                    <input type="number" id="telegram_api_id" name="telegram_api_id" placeholder="مثلاً: 1234567" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs">
                                </div>
                                <div>
                                    <label class="block text-slate-400 mb-1">Telegram API Hash:</label>
                                    <input type="text" id="telegram_api_hash" name="telegram_api_hash" placeholder="مثلاً: 0123456789abcdef..." class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs">
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            </div>

            <div class="flex justify-between pt-2">
                <button type="button" onclick="goToStep(1)" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition">
                    → مرحله قبل
                </button>
                <button type="button" onclick="validateStep2AndProceed()" class="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2">
                    <span>مرحله بعد: پایگاه داده</span>
                    <span>←</span>
                </button>
            </div>
        </div>

        <!-- STEP 3: MySQL Database Configuration & Test -->
        <div id="step-3" class="step-content space-y-4">
            <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <h2 class="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <span>🗄️</span>
                    <span>مرحله ۳ از ۶ — اطلاعات پایگاه داده MySQL (پشتیبانی از cPanel و Remote MySQL)</span>
                </h2>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                        <label class="block font-medium text-slate-300 mb-1">هاست پایگاه داده (Host):</label>
                        <input type="text" id="db_host" name="db_host" value="localhost" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs" placeholder="localhost یا IP سرور cPanel">
                        <p class="text-[11px] text-slate-500 mt-1">برای دیتابیس لوکال cPanel مقدار <code class="text-cyan-400 font-mono">localhost</code> را بگذارید.</p>
                    </div>

                    <div>
                        <label class="block font-medium text-slate-300 mb-1">پورت پایگاه داده (Port):</label>
                        <input type="number" id="db_port" name="db_port" value="3306" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs">
                    </div>

                    <div>
                        <label class="block font-medium text-slate-300 mb-1">نام پایگاه داده (Database Name):</label>
                        <input type="text" id="db_name" name="db_name" required placeholder="cpaneluser_tgforwarder" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs">
                        <p class="text-[11px] text-slate-500 mt-1">شامل پیشوند کاربری هاست (مثلاً: username_dbname)</p>
                    </div>

                    <div>
                        <label class="block font-medium text-slate-300 mb-1">نام کاربری پایگاه داده (User):</label>
                        <input type="text" id="db_user" name="db_user" required placeholder="cpaneluser_dbuser" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs">
                    </div>

                    <div class="sm:col-span-2">
                        <label class="block font-medium text-slate-300 mb-1">کلمه عبور پایگاه داده (Password):</label>
                        <input type="password" id="db_pass" name="db_pass" required placeholder="کلمه عبور امن دیتابیس در cPanel" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs">
                    </div>
                </div>

                <!-- Live Test Connection Button & Result -->
                <div class="pt-2">
                    <button type="button" onclick="testDatabaseConnection()" id="btnTestDb" class="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow">
                        <span>🧪</span>
                        <span>تست اتصال به دیتابیس MySQL</span>
                    </button>
                    <div id="dbTestFeedback" class="mt-2 hidden text-xs p-3 rounded-xl border"></div>
                </div>
            </div>

            <div class="flex justify-between pt-2">
                <button type="button" onclick="goToStep(2)" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition">
                    → مرحله قبل
                </button>
                <button type="button" onclick="validateStep3AndProceed()" class="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2">
                    <span>مرحله بعد: ساخت جداول و نصب</span>
                    <span>←</span>
                </button>
            </div>
        </div>

        <!-- STEP 4: Database Schema Execution & Auto-Install -->
        <div id="step-4" class="step-content space-y-4">
            <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <h2 class="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <span>⚡</span>
                    <span>مرحله ۴ از ۶ — ساخت خودکار دیتابیس و تولید فایل‌های پیکربندی</span>
                </h2>

                <div class="space-y-3 text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <p class="font-bold text-cyan-300">در این مرحله عملیات زیر به صورت کاملاً خودکار انجام خواهد شد:</p>
                    <ul class="space-y-1.5 list-disc list-inside text-slate-400 text-[11px]">
                        <li>بررسی و اجرای ساختار پایگاه داده (<code class="text-slate-300">schema.sql</code>) با دستورات ایمن <code class="text-slate-300">IF NOT EXISTS</code> بدون آسیب به اطلاعات قبلی.</li>
                        <li>ایجاد ۶ جدول اصلی: <code class="text-cyan-400">admin_users</code>, <code class="text-cyan-400">settings</code>, <code class="text-cyan-400">sources</code>, <code class="text-cyan-400">logs</code>, <code class="text-cyan-400">processed_hashes</code>, <code class="text-cyan-400">cron_tasks</code></li>
                        <li>هش امن کلمه عبور ادمین با الگوریتم BCRYPT و ثبت در پایگاه داده.</li>
                        <li>تولید فایل‌های پیکربندی سیستم: <code class="text-cyan-400">config/config.php</code> و <code class="text-cyan-400">.env</code></li>
                        <li>ایجاد فایل قفل امنیتی نصاب (<code class="text-cyan-400">config/installed.lock</code>) جهت جلوگیری از اجرای مجدد.</li>
                    </ul>
                </div>

                <div id="installProgressFeedback" class="hidden text-xs p-3 rounded-xl border"></div>

                <button type="button" onclick="executeFullInstallation()" id="btnStartInstall" class="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 transition active:scale-[0.99] flex items-center justify-center gap-2">
                    <span>🚀</span>
                    <span>شروع نصب خودکار و ساخت جداول</span>
                </button>
            </div>

            <div class="flex justify-between pt-2">
                <button type="button" onclick="goToStep(3)" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition">
                    → مرحله قبل
                </button>
                <button type="button" id="btnNextToStep5" disabled onclick="goToStep(5)" class="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-2">
                    <span>مرحله بعد: وب‌هوک</span>
                    <span>←</span>
                </button>
            </div>
        </div>

        <!-- STEP 5: Telegram Webhook Setup -->
        <div id="step-5" class="step-content space-y-4">
            <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <h2 class="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <span>🔗</span>
                    <span>مرحله ۵ از ۶ — تنظیم خودکار وب‌هوک تلگرام (Telegram Webhook)</span>
                </h2>

                <div class="space-y-3 text-xs">
                    <p class="text-slate-400 text-[11px]">
                        برای دریافت فوری دستورات و رویدادهای ربات در cPanel، آدرس زیر به عنوان Webhook در سرورهای رسمی تلگرام ست می‌شود:
                    </p>

                    <div>
                        <label class="block font-medium text-slate-300 mb-1">آدرس کامل Webhook (باید دارای HTTPS باشد):</label>
                        <input type="url" id="webhook_url" name="webhook_url" value="<?= htmlspecialchars($autoWebhookUrl) ?>" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-cyan-300 font-mono text-xs">
                    </div>

                    <div class="pt-2 flex flex-col sm:flex-row gap-2">
                        <button type="button" onclick="setAndTestWebhook()" id="btnSetWebhook" class="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2">
                            <span>📡</span>
                            <span>تنظیم و بررسی وب‌هوک در تلگرام</span>
                        </button>
                    </div>

                    <div id="webhookFeedback" class="mt-2 hidden text-xs p-3 rounded-xl border"></div>
                </div>
            </div>

            <div class="flex justify-between pt-2">
                <button type="button" onclick="goToStep(4)" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition">
                    → مرحله قبل
                </button>
                <button type="button" onclick="goToStep(6)" class="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2">
                    <span>مرحله بعد: تنظیم کرون‌جاب</span>
                    <span>←</span>
                </button>
            </div>
        </div>

        <!-- STEP 6: Cron Dispatcher Setup & Final Verification -->
        <div id="step-6" class="step-content space-y-4">
            <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-5">
                <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h2 class="text-sm font-bold text-slate-200 flex items-center gap-2">
                        <span>⏰</span>
                        <span>مرحله ۶ از ۶ — تنظیم کرون‌جاب متمرکز cPanel و بررسی نهایی</span>
                    </h2>
                    <span class="text-[11px] text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full font-bold">
                        الگوی Faoxima
                    </span>
                </div>

                <!-- Cron Command Box -->
                <div class="space-y-3 text-xs bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-slate-200">دستور آماده کپی کرون‌جاب در cPanel:</span>
                        <button type="button" onclick="copyCronCommand()" class="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                            <span id="copyIcon">📋</span>
                            <span id="copyText">کپی دستور</span>
                        </button>
                    </div>

                    <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-cyan-300 text-[11px] break-all select-all text-left" dir="ltr" id="cronCommandText">
* * * * * php <?= htmlspecialchars($cronPath) ?> >/dev/null 2>&1
                    </div>

                    <p class="text-[11px] text-slate-400 leading-relaxed">
                        💡 <strong>نحوه ثبت در cPanel:</strong> وارد سیپنل شوید، به بخش <strong>Cron Jobs</strong> بروید. در قسمت Common Settings گزینه <strong>Once Per Minute (* * * * *)</strong> را انتخاب کنید و دستور فوق را در فیلد Command قرار داده و روی Add New Cron Job کلیک کنید.
                    </p>
                </div>

                <!-- Final Verification Diagnostics Checklist -->
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xs font-bold text-slate-200">آزمون خودکار سلامت سامانه (Health Check):</h3>
                        <button type="button" onclick="runDiagnosticsCheck()" class="text-[11px] text-slate-400 hover:text-white underline">
                            🔄 بررسی مجدد
                        </button>
                    </div>

                    <div id="diagnosticsList" class="space-y-1.5 text-xs">
                        <div class="text-center py-4 text-slate-500 text-xs">
                            در حال بارگذاری وضعیت اجزای سیستم...
                        </div>
                    </div>
                </div>

                <!-- Final Completion Actions -->
                <div class="border-t border-slate-800 pt-4 flex flex-col sm:flex-row gap-3">
                    <a href="../panel/login.php?installed=1" class="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30 transition text-center flex items-center justify-center gap-2">
                        <span>🚀</span>
                        <span>ورود به پنل مدیریت وب</span>
                    </a>
                    <a href="https://t.me/" target="_blank" id="btnOpenBotTelegram" class="sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-bold border border-slate-700 transition text-center flex items-center justify-center gap-2">
                        <span>💬</span>
                        <span>ارسال استارت به ربات</span>
                    </a>
                </div>
            </div>

            <div class="flex justify-start pt-2">
                <button type="button" onclick="goToStep(5)" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition">
                    → مرحله قبل
                </button>
            </div>
        </div>

    </form>
    <?php endif; ?>

</div>

<script>
let currentStep = 1;
let isDbVerified = false;
let isBotVerified = false;
let isInstallFinished = false;

function goToStep(stepNum) {
    // Hide all steps
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.step-nav-btn').forEach(el => {
        el.classList.remove('bg-cyan-600/20', 'border-cyan-500/40', 'text-cyan-300', 'font-bold');
        el.classList.add('bg-slate-950', 'border-slate-800', 'text-slate-400');
    });

    const targetStep = document.getElementById(`step-${stepNum}`);
    const targetNav = document.getElementById(`step-nav-${stepNum}`);

    if (targetStep) targetStep.classList.add('active');
    if (targetNav) {
        targetNav.classList.remove('bg-slate-950', 'border-slate-800', 'text-slate-400');
        targetNav.classList.add('bg-cyan-600/20', 'border-cyan-500/40', 'text-cyan-300', 'font-bold');
    }

    currentStep = stepNum;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (stepNum === 6) {
        runDiagnosticsCheck();
    }
}

// STEP 2: Test Bot Token
async function testBotToken() {
    const token = document.getElementById('bot_token').value.trim();
    const fb = document.getElementById('botTokenFeedback');
    const btn = document.getElementById('btnTestBot');

    if (!token) {
        fb.className = 'mt-1.5 text-[11px] p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 block';
        fb.innerHTML = '❌ لطفاً ابتدا توکن ربات را وارد کنید.';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '⏳ بررسی...';
    fb.className = 'mt-1.5 text-[11px] p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 block';
    fb.innerHTML = 'در حال ارتباط با سرورهای تلگرام...';

    try {
        const formData = new FormData();
        formData.append('action', 'test_bot_token');
        formData.append('bot_token', token);

        const res = await fetch('ajax.php', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            isBotVerified = true;
            fb.className = 'mt-1.5 text-[11px] p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 block';
            fb.innerHTML = `✓ ${data.message}`;
            if (data.bot && data.bot.username) {
                const tgBtn = document.getElementById('btnOpenBotTelegram');
                if (tgBtn) tgBtn.href = `https://t.me/${data.bot.username}`;
            }
        } else {
            isBotVerified = false;
            fb.className = 'mt-1.5 text-[11px] p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 block';
            fb.innerHTML = `✗ ${data.message}`;
        }
    } catch (e) {
        fb.className = 'mt-1.5 text-[11px] p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 block';
        fb.innerHTML = `✗ خطای ارتباط: ${e.message}`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🔍</span><span>تست توکن</span>';
    }
}

function validateStep2AndProceed() {
    const token = document.getElementById('bot_token').value.trim();
    const dest = document.getElementById('destination_channel').value.trim();
    const username = document.getElementById('admin_username').value.trim();
    const password = document.getElementById('admin_password').value.trim();

    if (!token || !dest || !username || !password) {
        alert('لطفاً فیلدهای ستاره‌دار الزامی (توکن ربات، کانال مقصد و اطلاعات ادمین) را تکمیل کنید.');
        return;
    }
    goToStep(3);
}

// STEP 3: Test Database Connection
async function testDatabaseConnection() {
    const host = document.getElementById('db_host').value.trim();
    const port = document.getElementById('db_port').value.trim();
    const name = document.getElementById('db_name').value.trim();
    const user = document.getElementById('db_user').value.trim();
    const pass = document.getElementById('db_pass').value;

    const fb = document.getElementById('dbTestFeedback');
    const btn = document.getElementById('btnTestDb');

    if (!host || !name || !user) {
        fb.className = 'mt-2 text-xs p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 block';
        fb.innerHTML = '❌ لطفاً تمامی اطلاعات دیتابیس را وارد نمایید.';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '⏳ در حال تست اتصال...';
    fb.className = 'mt-2 text-xs p-3 rounded-xl border bg-cyan-500/10 border-cyan-500/30 text-cyan-300 block';
    fb.innerHTML = 'در حال تلاش برای برقراری اتصال با پایگاه داده MySQL...';

    try {
        const formData = new FormData();
        formData.append('action', 'test_db');
        formData.append('db_host', host);
        formData.append('db_port', port);
        formData.append('db_name', name);
        formData.append('db_user', user);
        formData.append('db_pass', pass);

        const res = await fetch('ajax.php', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            isDbVerified = true;
            fb.className = 'mt-2 text-xs p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 block';
            fb.innerHTML = `<strong>✓ اتصال موفق است:</strong> ${data.message} <span class="text-slate-400 font-mono">(${data.server_version})</span>`;
        } else {
            isDbVerified = false;
            fb.className = 'mt-2 text-xs p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 block';
            fb.innerHTML = `<strong>✗ اتصال برقرار نشد:</strong> ${data.message}`;
        }
    } catch (e) {
        fb.className = 'mt-2 text-xs p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 block';
        fb.innerHTML = `✗ خطای ناشناخته در ارتباط: ${e.message}`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🧪</span><span>تست اتصال به دیتابیس MySQL</span>';
    }
}

function validateStep3AndProceed() {
    const name = document.getElementById('db_name').value.trim();
    const user = document.getElementById('db_user').value.trim();
    if (!name || !user) {
        alert('لطفاً نام دیتابیس و نام کاربری را وارد کنید.');
        return;
    }
    goToStep(4);
}

// STEP 4: Full Auto Installation
async function executeFullInstallation() {
    const btn = document.getElementById('btnStartInstall');
    const fb = document.getElementById('installProgressFeedback');
    const nextBtn = document.getElementById('btnNextToStep5');

    btn.disabled = true;
    btn.innerHTML = '⏳ در حال ساخت جداول و ذخیره تنظیمات...';
    fb.className = 'text-xs p-3 rounded-xl border bg-cyan-500/10 border-cyan-500/30 text-cyan-300 block';
    fb.innerHTML = 'در حال برقراری اتصال به MySQL، اجرای اسکیما و ساخت فایل config/config.php...';

    const form = document.getElementById('installerForm');
    const formData = new FormData(form);
    formData.append('action', 'install_all');

    try {
        const res = await fetch('ajax.php', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            isInstallFinished = true;
            fb.className = 'text-xs p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 block';
            fb.innerHTML = `<strong>✓ نصب با موفقیت انجام شد:</strong> ${data.message} (فایل تنظیمات و قفل نصاب تولید شد).`;
            btn.innerHTML = '✓ فرآیند نصب با موفقیت پایان یافت';
            btn.className = 'w-full py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-bold opacity-80 cursor-not-allowed';
            nextBtn.disabled = false;
            // رفتن خودکار به مرحله بعد پس از ۱ ثانیه
            setTimeout(() => goToStep(5), 1200);
        } else {
            fb.className = 'text-xs p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 block';
            fb.innerHTML = `<strong>✗ خطا در فرآیند نصب:</strong> ${data.message}`;
            btn.disabled = false;
            btn.innerHTML = '<span>🚀</span><span>تلاش مجدد برای نصب</span>';
        }
    } catch (e) {
        fb.className = 'text-xs p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 block';
        fb.innerHTML = `✗ خطای اتصال: ${e.message}`;
        btn.disabled = false;
        btn.innerHTML = '<span>🚀</span><span>تلاش مجدد برای نصب</span>';
    }
}

// STEP 5: Set Webhook
async function setAndTestWebhook() {
    const token = document.getElementById('bot_token').value.trim();
    const url = document.getElementById('webhook_url').value.trim();
    const fb = document.getElementById('webhookFeedback');
    const btn = document.getElementById('btnSetWebhook');

    if (!url.startsWith('https://')) {
        fb.className = 'mt-2 text-xs p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 block';
        fb.innerHTML = '❌ آدرس وب‌هوک باید حتماً با https:// آغاز شود و دارای SSL معتبر باشد.';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '⏳ در حال تنظیم Webhook در تلگرام...';
    fb.className = 'mt-2 text-xs p-3 rounded-xl border bg-cyan-500/10 border-cyan-500/30 text-cyan-300 block';
    fb.innerHTML = 'در حال ارسال درخواست setWebhook به api.telegram.org...';

    try {
        const formData = new FormData();
        formData.append('action', 'set_webhook');
        formData.append('bot_token', token);
        formData.append('webhook_url', url);

        const res = await fetch('ajax.php', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            fb.className = 'mt-2 text-xs p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 block';
            fb.innerHTML = `<strong>✓ وب‌هوک فعال شد:</strong> ${data.message} (${data.description || 'Webhook is active'})`;
        } else {
            fb.className = 'mt-2 text-xs p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 block';
            fb.innerHTML = `<strong>✗ خطا در وب‌هوک:</strong> ${data.message}`;
        }
    } catch (e) {
        fb.className = 'mt-2 text-xs p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 block';
        fb.innerHTML = `✗ خطای اتصال: ${e.message}`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>📡</span><span>تنظیم و بررسی وب‌هوک در تلگرام</span>';
    }
}

// Copy Cron Command
function copyCronCommand() {
    const text = document.getElementById('cronCommandText').innerText.trim();
    navigator.clipboard.writeText(text).then(() => {
        document.getElementById('copyText').innerText = 'کپی شد!';
        document.getElementById('copyIcon').innerText = '✓';
        setTimeout(() => {
            document.getElementById('copyText').innerText = 'کپی دستور';
            document.getElementById('copyIcon').innerText = '📋';
        }, 3000);
    });
}

// STEP 6: Run Diagnostics
async function runDiagnosticsCheck() {
    const container = document.getElementById('diagnosticsList');
    container.innerHTML = '<div class="text-center py-3 text-cyan-300 text-xs">⏳ در حال انجام آزمون‌های تشخیصی ۱۰ گانه سیستم...</div>';

    try {
        const res = await fetch('ajax.php?action=diagnostics');
        const data = await res.json();

        if (data.success && Array.isArray(data.diagnostics)) {
            let html = '';
            data.diagnostics.forEach(item => {
                const isPass = item.status;
                html += `
                <div class="flex items-center justify-between p-2 rounded-xl bg-slate-950 border ${isPass ? 'border-slate-800' : 'border-rose-500/30 bg-rose-500/5'}">
                    <div class="flex items-center gap-2">
                        <span class="${isPass ? 'text-emerald-400' : 'text-rose-400'} font-bold">${isPass ? '✓' : '✗'}</span>
                        <span class="text-slate-200 font-medium">${item.name}</span>
                    </div>
                    <span class="text-[11px] ${isPass ? 'text-slate-400' : 'text-rose-300 font-bold'}">${item.details}</span>
                </div>
                `;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="text-rose-400 text-xs">خطا در دریافت نتایج ارزیابی</div>';
        }
    } catch (e) {
        container.innerHTML = `<div class="text-rose-400 text-xs">خطا در اتصال به ماژول تشخیصی: ${e.message}</div>`;
    }
}
</script>

</body>
</html>
