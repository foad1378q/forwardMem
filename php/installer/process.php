<?php
/**
 * Installer Processor (Installer/process.php)
 * -------------------------------------------
 * اتصال به دیتابیس، اجرای schema.sql و تولید فایل config/config.php
 */

define('APP_INIT', true);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php');
    exit;
}

$dbHost  = trim($_POST['db_host'] ?? 'localhost');
$dbPort  = (int)($_POST['db_port'] ?? 3306);
$dbName  = trim($_POST['db_name'] ?? '');
$dbUser  = trim($_POST['db_user'] ?? '');
$dbPass  = $_POST['db_pass'] ?? '';

$botToken    = trim($_POST['bot_token'] ?? '');
$destChannel = trim($_POST['destination_channel'] ?? '');
$adminUser   = trim($_POST['admin_username'] ?? 'admin');
$adminPass   = $_POST['admin_password'] ?? 'admin123';

try {
    // ۱. تست اتصال به دیتابیس
    $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, $dbUser, $dbPass, $options);

    // ۲. اجرای schema.sql
    $schemaSql = file_get_contents(__DIR__ . '/schema.sql');
    $pdo->exec($schemaSql);

    // ۳. درج یا به‌روزرسانی ادمین
    $passHash = password_hash($adminPass, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("INSERT INTO `admin_users` (`username`, `password_hash`, `created_at`) 
                          VALUES (?, ?, NOW()) 
                          ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`)");
    $stmt->execute([$adminUser, $passHash]);

    // ۴. درج تنظیمات اولیه در جدول settings
    $settings = [
        'bot_token'           => $botToken,
        'destination_channel' => $destChannel,
        'app_name'            => 'سامانه فوروارد هوشمند تلگرام',
        'is_monitoring_paused'=> '0',
        'enable_global_keywords' => '0',
        'global_keyword_match_mode' => 'any',
        'global_keywords'     => json_encode([]),
        'ai_processing'       => json_encode([
            'enableContentCleaning'  => true,
            'removeTelegramLinks'    => true,
            'removeWebLinks'         => false,
            'removeUsernames'        => true,
            'removeHashtags'         => false,
            'removePhoneNumbers'     => true,
            'enableMessageSignature' => false,
            'customSignatureText'    => "🚀 عضویت در کانال ما:\n{$destChannel}",
            'blockedWords'           => []
        ], JSON_UNESCAPED_UNICODE),
        'ai_config'           => json_encode([
            'provider'  => 'self-hosted',
            'style'     => 'formal_news',
            'intensity' => 'medium',
            'enabled'   => false
        ], JSON_UNESCAPED_UNICODE),
        'installed_at'        => date('Y-m-d H:i:s')
    ];

    $setStmt = $pdo->prepare("INSERT INTO `settings` (`key_name`, `value`, `updated_at`) 
                             VALUES (?, ?, NOW()) 
                             ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()");
    foreach ($settings as $k => $v) {
        $setStmt->execute([$k, $v]);
    }

    // ۵. تولید فایل اصلی config/config.php
    $secretKey = bin2hex(random_bytes(32));
    $configContent = "<?php\n" .
                     "defined('APP_INIT') or define('APP_INIT', true);\n\n" .
                     "return [\n" .
                     "    'db' => [\n" .
                     "        'host'     => '{$dbHost}',\n" .
                     "        'port'     => {$dbPort},\n" .
                     "        'dbname'   => '{$dbName}',\n" .
                     "        'username' => '{$dbUser}',\n" .
                     "        'password' => " . var_export($dbPass, true) . ",\n" .
                     "        'charset'  => 'utf8mb4',\n" .
                     "    ],\n" .
                     "    'telegram' => [\n" .
                     "        'bot_token'           => '{$botToken}',\n" .
                     "        'destination_channel' => '{$destChannel}',\n" .
                     "    ],\n" .
                     "    'app' => [\n" .
                     "        'secret_key' => '{$secretKey}',\n" .
                     "        'timezone'   => 'Asia/Tehran',\n" .
                     "    ],\n" .
                     "];\n";

    $configDir = __DIR__ . '/../config';
    if (!is_dir($configDir)) {
        mkdir($configDir, 0755, true);
    }
    file_put_contents($configDir . '/config.php', $configContent);

    // هدایت به صفحه ورود پنل
    header('Location: ../panel/login.php?installed=1');
    exit;

} catch (\Exception $e) {
    die("<div style='direction:rtl;text-align:right;font-family:tahoma;padding:25px;background:#fee;border:1px solid #fcc;margin:30px auto;max-width:600px;border-radius:12px;'>
        <h3 style='color:#c00;'>❌ خطا در فرآیند نصب</h3>
        <p>" . htmlspecialchars($e->getMessage()) . "</p>
        <p><a href='index.php' style='color:#007bff;text-decoration:none;font-weight:bold;'>⬅️ بازگشت و اصلاح اطلاعات</a></p>
    </div>");
}
