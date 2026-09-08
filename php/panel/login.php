<?php
/**
 * Panel Login Page (Panel/login.php)
 * -----------------------------------
 * صفحه ورود امن ادمین با محافظت CSRF و Brute-force
 */

define('APP_INIT', true);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Auth.php';

use Core\Auth;

Auth::startSession();

// اگر قبلاً وارد شده، هدایت به داشبورد
if (Auth::check()) {
    header('Location: index.php');
    exit;
}

$error = null;
$installed = isset($_GET['installed']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = $_POST['csrf_token'] ?? '';
    if (!Auth::validateCsrfToken($token)) {
        $error = 'اعتبار توکن امنیتی منقضی شده است. لطفاً صفحه را مجدداً بارگذاری کنید.';
    } else {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';

        $loginRes = Auth::login($username, $password);
        if ($loginRes['success']) {
            header('Location: index.php');
            exit;
        } else {
            $error = $loginRes['message'];
        }
    }
}

$csrfToken = Auth::generateCsrfToken();
?>
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ورود به پنل مدیریت | فروارد هوشمند تلگرام</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
    <style>body { font-family: Vazirmatn, sans-serif; }</style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4 selection:bg-cyan-500">

<div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
    <div class="text-center space-y-2">
        <div class="w-14 h-14 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/20 font-bold">
            ⚡
        </div>
        <h1 class="text-xl font-black text-white">ورود به پنل مدیریت</h1>
        <p class="text-xs text-slate-400">سامانه فوروارد و مانیتورینگ کانال‌های تلگرام</p>
    </div>

    <?php if ($installed): ?>
        <div class="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 text-center font-bold">
            ✅ نصب با موفقیت انجام شد. اکنون با مشخصات ادمین وارد شوید.
        </div>
    <?php endif; ?>

    <?php if ($error): ?>
        <div class="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 text-center font-bold">
            <?= htmlspecialchars($error) ?>
        </div>
    <?php endif; ?>

    <form method="POST" class="space-y-4">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">

        <div class="space-y-1">
            <label class="block text-xs font-medium text-slate-300">نام کاربری:</label>
            <input type="text" name="username" required autofocus class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-cyan-500 focus:outline-none transition">
        </div>

        <div class="space-y-1">
            <label class="block text-xs font-medium text-slate-300">کلمه عبور:</label>
            <input type="password" name="password" required class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-cyan-500 focus:outline-none transition">
        </div>

        <button type="submit" class="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-cyan-600/30 transition active:scale-[0.98]">
            ورود به داشبورد
        </button>
    </form>
</div>

</body>
</html>
