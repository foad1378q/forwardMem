<?php
/**
 * Database Connection Helper (PDO Layer)
 * ---------------------------------------
 * برقراری اتصال امن و یکپارچه به دیتابیس MySQL / MariaDB با PDO
 */

if (!defined('APP_INIT')) {
    define('APP_INIT', true);
}

// بررسی وجود فایل کانفیگ
$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    // اگر در مسیر نصب نیستیم، به اینستالر هدایت شود
    if (php_sapi_name() !== 'cli' && !str_contains($_SERVER['REQUEST_URI'] ?? '', 'installer')) {
        header('Location: ../installer/index.php');
        exit;
    }
    return null;
}

$config = require $configFile;

try {
    $dbConfig = $config['db'];
    $dsn = sprintf(
        "mysql:host=%s;port=%d;dbname=%s;charset=%s",
        $dbConfig['host'],
        $dbConfig['port'] ?? 3306,
        $dbConfig['dbname'],
        $dbConfig['charset'] ?? 'utf8mb4'
    );

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . ($dbConfig['charset'] ?? 'utf8mb4') . " COLLATE utf8mb4_unicode_ci"
    ];

    $pdo = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], $options);
    return $pdo;

} catch (PDOException $e) {
    if (php_sapi_name() === 'cli') {
        fwrite(STDERR, "Database Connection Error: " . $e->getMessage() . PHP_EOL);
        exit(1);
    } else {
        die("<div style='direction:rtl;text-align:right;font-family:tahoma;padding:20px;background:#fee;border:1px solid #fcc;margin:20px;border-radius:8px;'>
            <h3>خطای اتصال به پایگاه داده</h3>
            <p>امکان برقراری ارتباط با پایگاه داده MySQL وجود ندارد: <b>" . htmlspecialchars($e->getMessage()) . "</b></p>
            <p>لطفاً تنظیمات فایل <code>config/config.php</code> یا دسترسی‌های Remote MySQL را بررسی کنید.</p>
        </div>");
    }
}
