<?php
/**
 * Web Installer AJAX Backend Handler (installer/ajax.php)
 * -------------------------------------------------------
 * پردازش درخواست‌های ناهمگام مرحله‌به‌مرحله نصاب:
 * - تست زنده اتصال دیتابیس MySQL
 * - تست زنده توکن ربات تلگرام
 * - اجرای اسکیما و ساخت دیتابیس و کانفیگ
 * - ثبت و بررسی وب‌هوک
 * - بررسی جامع تشخیصی (Health Diagnostics)
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

define('APP_INIT', true);

// تابع تبدیل خطاهای دیتابیس به زبان ساده و فارسی
function translateDbError(string $error): string {
    $errLower = strtolower($error);
    if (str_contains($errLower, 'access denied for user')) {
        return 'نام کاربری یا کلمه عبور دیتابیس اشتباه است. لطفاً مشخصات کاربر دیتابیس را در cPanel بررسی فرمایید.';
    }
    if (str_contains($errLower, 'unknown database')) {
        return 'پایگاه داده با این نام یافت نشد. لطفاً ابتدا دیتابیس را در بخش MySQL Databases سیپنل بسازید و نام آن را با پیشوند کاربری وارد کنید.';
    }
    if (str_contains($errLower, 'connection refused') || str_contains($errLower, "can't connect to mysql")) {
        return 'امکان برقراری ارتباط با هاست دیتابیس وجود ندارد. اگر دیتابیس روی همین هاست است مقدار localhost را قرار دهید.';
    }
    if (str_contains($errLower, 'timed out')) {
        return 'مهلت زمان اتصال به سرور دیتابیس به پایان رسید (Timeout). پورت یا دسترسی فایروال را بررسی نمایید.';
    }
    return 'خطای دیتابیس: ' . $error;
}

// دریافت اکشن
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

$lockFile = __DIR__ . '/../config/installed.lock';
$isLocked = file_exists($lockFile);

// اگر سیستم قفل شده باشد، فقط اکشن diagnostics و info مجاز است مگر اینکه قفل برداشته شود
if ($isLocked && in_array($action, ['install', 'install_all'], true)) {
    echo json_encode([
        'success' => false,
        'message' => 'سامانه قبلاً نصب و قفل شده است. جهت نصب مجدد ابتدا فایل config/installed.lock را از هاست حذف کنید.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

switch ($action) {
    // -------------------------------------------------------------------------
    // ۱. تست اتصال دیتابیس
    // -------------------------------------------------------------------------
    case 'test_db':
        $host = trim($_POST['db_host'] ?? 'localhost');
        $port = (int)($_POST['db_port'] ?? 3306);
        $dbname = trim($_POST['db_name'] ?? '');
        $user = trim($_POST['db_user'] ?? '');
        $pass = $_POST['db_pass'] ?? '';

        if (empty($host) || empty($user) || empty($dbname)) {
            echo json_encode([
                'success' => false,
                'message' => 'لطفاً تمامی فیلدهای الزامی دیتابیس (هاست، نام دیتابیس و نام کاربری) را وارد نمایید.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 5,
            ];
            $pdo = new PDO($dsn, $user, $pass, $options);
            $version = $pdo->query("SELECT VERSION()")->fetchColumn();

            echo json_encode([
                'success' => true,
                'message' => 'اتصال به پایگاه داده MySQL با موفقیت برقرار شد.',
                'server_version' => $version ?: 'MySQL 8+'
            ], JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            echo json_encode([
                'success' => false,
                'message' => translateDbError($e->getMessage()),
                'raw_error' => $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
        break;

    // -------------------------------------------------------------------------
    // ۲. تست توکن ربات تلگرام
    // -------------------------------------------------------------------------
    case 'test_bot_token':
        $token = trim($_POST['bot_token'] ?? '');
        if (empty($token)) {
            echo json_encode([
                'success' => false,
                'message' => 'لطفاً توکن ربات تلگرام را وارد کنید.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (!preg_match('/^\d+:[A-Za-z0-9_-]{30,}$/', $token)) {
            echo json_encode([
                'success' => false,
                'message' => 'فرمت توکن ربات تلگرام نامعتبر است. نمونه صحیح: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $url = "https://api.telegram.org/bot{$token}/getMe";
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT => 10,
        ]);
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            echo json_encode([
                'success' => false,
                'message' => 'خطا در ارتباط با سرورهای تلگرام: ' . $curlError . ' (بررسی کنید سرور هاست به api.telegram.org دسترسی داشته باشد).'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $data = json_decode($response, true);
        if ($data && !empty($data['ok'])) {
            $bot = $data['result'];
            echo json_encode([
                'success' => true,
                'message' => "ربات «{$bot['first_name']}» (@{$bot['username']}) تایید شد.",
                'bot' => [
                    'id' => $bot['id'],
                    'first_name' => $bot['first_name'],
                    'username' => $bot['username'] ?? '',
                ]
            ], JSON_UNESCAPED_UNICODE);
        } else {
            $desc = $data['description'] ?? 'توکن ارائه‌شده معتبر نمی‌باشد.';
            echo json_encode([
                'success' => false,
                'message' => 'خطای تلگرام: ' . $desc
            ], JSON_UNESCAPED_UNICODE);
        }
        break;

    // -------------------------------------------------------------------------
    // ۳. نصب کامل (ایجاد دیتابیس، ثبت ادمین، ایجاد کانفیگ و قفل)
    // -------------------------------------------------------------------------
    case 'install':
    case 'install_all':
        $dbHost  = trim($_POST['db_host'] ?? 'localhost');
        $dbPort  = (int)($_POST['db_port'] ?? 3306);
        $dbName  = trim($_POST['db_name'] ?? '');
        $dbUser  = trim($_POST['db_user'] ?? '');
        $dbPass  = $_POST['db_pass'] ?? '';

        $botToken        = trim($_POST['bot_token'] ?? '');
        $destChannel     = trim($_POST['destination_channel'] ?? '');
        $adminUserId     = trim($_POST['admin_user_id'] ?? '');
        $adminUsername   = trim($_POST['admin_username'] ?? 'admin');
        $adminPassword   = $_POST['admin_password'] ?? 'admin123';
        $adminPasscode   = trim($_POST['admin_passcode'] ?? 'admin123');
        $webhookUrl      = trim($_POST['webhook_url'] ?? '');

        // پارامترهای اختیاری کلاینت اکانت MTProto (MadelineProto)
        $telegramApiId   = (int)($_POST['telegram_api_id'] ?? 0);
        $telegramApiHash = trim($_POST['telegram_api_hash'] ?? '');

        // اعتبارسنجی مقادیر پایه
        if (empty($dbHost) || empty($dbName) || empty($dbUser)) {
            echo json_encode(['success' => false, 'message' => 'اطلاعات دیتابیس ناقص است.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        if (empty($botToken)) {
            echo json_encode(['success' => false, 'message' => 'توکن ربات تلگرام الزامی است.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        if (empty($adminUsername) || empty($adminPassword)) {
            echo json_encode(['success' => false, 'message' => 'نام کاربری و رمز پنل مدیریت الزامی است.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            // ۱. اتصال به پایگاه داده
            $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];
            $pdo = new PDO($dsn, $dbUser, $dbPass, $options);

            // ۲. اجرای schema.sql
            $schemaFile = __DIR__ . '/schema.sql';
            if (file_exists($schemaFile)) {
                $schemaSql = file_get_contents($schemaFile);
                $pdo->exec($schemaSql);
            }

            // ۳. ایجاد حساب کاربری ادمین
            $passHash = password_hash($adminPassword, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("INSERT INTO `admin_users` (`username`, `password_hash`, `created_at`) 
                                  VALUES (?, ?, NOW()) 
                                  ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`)");
            $stmt->execute([$adminUsername, $passHash]);

            // ۴. ذخیره تنظیمات در جدول settings
            $initialSettings = [
                'bot_token'                 => $botToken,
                'destination_channel'       => $destChannel,
                'admin_user_id'             => $adminUserId,
                'admin_passcode'            => $adminPasscode,
                'app_name'                  => 'سامانه فوروارد هوشمند تلگرام',
                'is_monitoring_paused'      => '0',
                'enable_global_keywords'    => '0',
                'global_keyword_match_mode' => 'any',
                'global_keywords'           => json_encode([]),
                'telegram_api_id'           => (string)$telegramApiId,
                'telegram_api_hash'         => $telegramApiHash,
                'ai_processing'             => json_encode([
                    'enableContentCleaning'  => true,
                    'removeTelegramLinks'    => true,
                    'removeWebLinks'         => false,
                    'removeUsernames'        => true,
                    'removeHashtags'         => false,
                    'removePhoneNumbers'     => true,
                    'enableMessageSignature' => !empty($destChannel),
                    'customSignatureText'    => "🚀 عضویت در کانال ما:\n{$destChannel}",
                    'blockedWords'           => []
                ], JSON_UNESCAPED_UNICODE),
                'ai_config'                 => json_encode([
                    'provider'  => 'self-hosted',
                    'style'     => 'formal_news',
                    'intensity' => 'medium',
                    'enabled'   => false
                ], JSON_UNESCAPED_UNICODE),
                'installed_at'              => date('Y-m-d H:i:s')
            ];

            $setStmt = $pdo->prepare("INSERT INTO `settings` (`key_name`, `value`, `updated_at`) 
                                     VALUES (?, ?, NOW()) 
                                     ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()");
            foreach ($initialSettings as $k => $v) {
                $setStmt->execute([$k, $v]);
            }

            // ۵. ایجاد پوشه‌های موردنیاز
            $configDir = __DIR__ . '/../config';
            $sessionDir = __DIR__ . '/../session';
            $backupsDir = __DIR__ . '/../backups';

            foreach ([$configDir, $sessionDir, $backupsDir] as $dir) {
                if (!is_dir($dir)) {
                    mkdir($dir, 0755, true);
                }
            }

            // ۶. تولید فایل config/config.php
            $secretKey = bin2hex(random_bytes(32));
            $configContent = "<?php\n" .
                "/**\n" .
                " * Auto-Generated Configuration File\n" .
                " * Created: " . date('Y-m-d H:i:s') . "\n" .
                " */\n\n" .
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
                "        'admin_user_id'       => '{$adminUserId}',\n" .
                "        'admin_passcode'      => '{$adminPasscode}',\n" .
                "    ],\n" .
                "    'madeline' => [\n" .
                "        'api_id'       => {$telegramApiId},\n" .
                "        'api_hash'     => '{$telegramApiHash}',\n" .
                "        'session_file' => __DIR__ . '/../session/tg_session.madeline',\n" .
                "    ],\n" .
                "    'app' => [\n" .
                "        'secret_key' => '{$secretKey}',\n" .
                "        'timezone'   => 'Asia/Tehran',\n" .
                "    ],\n" .
                "];\n";

            file_put_contents($configDir . '/config.php', $configContent);

            // ۷. تولید فایل .env برای سازگاری کامل
            $envContent = "# Auto-Generated Environment File\n" .
                "BOT_TOKEN={$botToken}\n" .
                "DESTINATION_CHANNEL={$destChannel}\n" .
                "DB_HOST={$dbHost}\n" .
                "DB_PORT={$dbPort}\n" .
                "DB_NAME={$dbName}\n" .
                "DB_USER={$dbUser}\n" .
                "DB_PASS=" . addcslashes($dbPass, "\"\$\n\r\\") . "\n" .
                "API_ID={$telegramApiId}\n" .
                "API_HASH={$telegramApiHash}\n";
            file_put_contents(__DIR__ . '/../.env', $envContent);

            // ۸. ایجاد فایل قفل امنیتی (installed.lock)
            file_put_contents($configDir . '/installed.lock', json_encode([
                'installed_at' => date('Y-m-d H:i:s'),
                'version' => '2.5.0',
                'admin_user' => $adminUsername
            ], JSON_PRETTY_PRINT));

            // ۹. تنظیم وب‌هوک در صورت وجود آدرس
            $webhookResult = null;
            if (!empty($webhookUrl)) {
                $whRes = setTelegramWebhook($botToken, $webhookUrl);
                $webhookResult = $whRes;
            }

            echo json_encode([
                'success' => true,
                'message' => 'پروژه با موفقیت نصب و پیکربندی شد.',
                'webhook' => $webhookResult
            ], JSON_UNESCAPED_UNICODE);

        } catch (\Exception $e) {
            echo json_encode([
                'success' => false,
                'message' => 'خطا در فرآیند نصب: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
        break;

    // -------------------------------------------------------------------------
    // ۴. تنظیم و اعتبارسنجی وب‌هوک تلگرام
    // -------------------------------------------------------------------------
    case 'set_webhook':
        $token = trim($_POST['bot_token'] ?? '');
        $url   = trim($_POST['webhook_url'] ?? '');

        if (empty($token) || empty($url)) {
            echo json_encode(['success' => false, 'message' => 'توکن ربات و آدرس وب‌هوک الزامی است.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (!str_starts_with($url, 'https://')) {
            echo json_encode(['success' => false, 'message' => 'تلگرام تنها از پروتکل امن HTTPS پشتیبانی می‌کند. لطفاً آدرس را با https:// وارد نمایید.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $res = setTelegramWebhook($token, $url);
        echo json_encode($res, JSON_UNESCAPED_UNICODE);
        break;

    // -------------------------------------------------------------------------
    // ۵. دریافت اطلاعات وضعیت فعلی وب‌هوک
    // -------------------------------------------------------------------------
    case 'get_webhook_info':
        $token = trim($_POST['bot_token'] ?? '');
        if (empty($token)) {
            // تلاش برای خواندن از کانفیگ
            $cfgFile = __DIR__ . '/../config/config.php';
            if (file_exists($cfgFile)) {
                $cfg = require $cfgFile;
                $token = $cfg['telegram']['bot_token'] ?? '';
            }
        }

        if (empty($token)) {
            echo json_encode(['success' => false, 'message' => 'توکن ربات یافت نشد.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $url = "https://api.telegram.org/bot{$token}/getWebhookInfo";
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT => 10,
        ]);
        $response = curl_exec($ch);
        curl_close($ch);
        $data = json_decode($response, true);

        if ($data && !empty($data['ok'])) {
            echo json_encode(['success' => true, 'info' => $data['result']], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode(['success' => false, 'message' => $data['description'] ?? 'عدم دریافت اطلاعات وب‌هوک'], JSON_UNESCAPED_UNICODE);
        }
        break;

    // -------------------------------------------------------------------------
    // ۶. اجرای تست جامع تشخیصی (Health Diagnostics)
    // -------------------------------------------------------------------------
    case 'diagnostics':
        $results = [];

        // 1. PHP Version
        $phpOk = version_compare(PHP_VERSION, '8.1.0', '>=');
        $results[] = [
            'name' => 'نسخه PHP',
            'status' => $phpOk,
            'details' => 'نسخه فعلی: PHP ' . PHP_VERSION . ($phpOk ? ' (تایید)' : ' (نیاز به نسخه 8.1 یا بالاتر)')
        ];

        // 2. Database Connection
        $dbOk = false;
        $dbDetails = 'فایل کانفیگ یا اتصال ناموجود است.';
        $cfgFile = __DIR__ . '/../config/config.php';
        if (file_exists($cfgFile)) {
            try {
                $cfg = require $cfgFile;
                $db = $cfg['db'] ?? [];
                $dsn = "mysql:host={$db['host']};port={$db['port']};dbname={$db['dbname']};charset=utf8mb4";
                $pdo = new PDO($dsn, $db['username'], $db['password'], [PDO::ATTR_TIMEOUT => 3]);
                $dbOk = true;
                $dbDetails = "اتصال برقرار شد ({$db['dbname']} @ {$db['host']})";
            } catch (\Exception $e) {
                $dbDetails = 'خطا در اتصال: ' . $e->getMessage();
            }
        }
        $results[] = [
            'name' => 'اتصال دیتابیس MySQL',
            'status' => $dbOk,
            'details' => $dbDetails
        ];

        // 3. Database Tables
        $tablesOk = false;
        $tablesDetails = 'بررسی نشد.';
        if ($dbOk && isset($pdo)) {
            try {
                $requiredTables = ['admin_users', 'settings', 'sources', 'logs', 'processed_hashes', 'cron_tasks'];
                $existing = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
                $missing = array_diff($requiredTables, $existing);
                if (empty($missing)) {
                    $tablesOk = true;
                    $tablesDetails = 'همه ' . count($requiredTables) . ' جدول مورد نیاز موجود هستند.';
                } else {
                    $tablesDetails = 'جداول ناموجود: ' . implode(', ', $missing);
                }
            } catch (\Exception $e) {
                $tablesDetails = 'خطا در شمارش جداول: ' . $e->getMessage();
            }
        }
        $results[] = [
            'name' => 'جداول پایگاه داده',
            'status' => $tablesOk,
            'details' => $tablesDetails
        ];

        // 4. Config File
        $configExists = file_exists($cfgFile);
        $results[] = [
            'name' => 'فایل پیکربندی (config.php)',
            'status' => $configExists,
            'details' => $configExists ? 'فایل config/config.php ساخته شده و معتبر است.' : 'فایل config.php یافت نشد.'
        ];

        // 5. Telegram Bot Token
        $botOk = false;
        $botDetails = 'توکن تنظیم نشده است.';
        if (isset($cfg['telegram']['bot_token']) && !empty($cfg['telegram']['bot_token'])) {
            $token = $cfg['telegram']['bot_token'];
            $res = @file_get_contents("https://api.telegram.org/bot{$token}/getMe");
            if ($res) {
                $botData = json_decode($res, true);
                if (!empty($botData['ok'])) {
                    $botOk = true;
                    $botDetails = "ربات فعال: @" . ($botData['result']['username'] ?? 'نامشخص');
                } else {
                    $botDetails = 'خطای اعتبارسنجی توکن از سمت تلگرام: ' . ($botData['description'] ?? '');
                }
            } else {
                $botDetails = 'عدم دریافت پاسخ از سرورهای تلگرام';
            }
        }
        $results[] = [
            'name' => 'توکن و اتصال Bot API تلگرام',
            'status' => $botOk,
            'details' => $botDetails
        ];

        // 6. Webhook
        $whOk = false;
        $whDetails = 'وب‌هوک ثبت نشده یا توکن نامعتبر است.';
        if ($botOk && isset($token)) {
            $res = @file_get_contents("https://api.telegram.org/bot{$token}/getWebhookInfo");
            if ($res) {
                $whData = json_decode($res, true);
                if (!empty($whData['ok']) && !empty($whData['result']['url'])) {
                    $whOk = true;
                    $whDetails = "فعال روی آدرس: " . $whData['result']['url'];
                } else {
                    $whDetails = 'وب‌هوک تنظیم نشده است (URL خالی است).';
                }
            }
        }
        $results[] = [
            'name' => 'وضعیت Webhook تلگرام',
            'status' => $whOk,
            'details' => $whDetails
        ];

        // 7. Cron Dispatcher File
        $cronFile = __DIR__ . '/../cron/dispatcher.php';
        $cronOk = file_exists($cronFile);
        $results[] = [
            'name' => 'فایل مرکزی زمان‌بندی کرون (cron/dispatcher.php)',
            'status' => $cronOk,
            'details' => $cronOk ? 'موجود و آماده برای فراخوانی توسط cPanel Cron Jobs' : 'فایل cron/dispatcher.php یافت نشد.'
        ];

        // 8. SSL / HTTPS
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
                   (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) ||
                   (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
        $results[] = [
            'name' => 'پروتکل امن SSL / HTTPS',
            'status' => $isHttps,
            'details' => $isHttps ? 'دامنه از پروتکل امن HTTPS استفاده می‌کند.' : 'هشدار: دامنه روی HTTP است. تلگرام برای وب‌هوک به SSL معتبر نیاز دارد.'
        ];

        // 9. Write Permissions (config, session, backups)
        $permOk = is_writable(__DIR__ . '/../config') &&
                  is_writable(__DIR__ . '/../session') &&
                  is_writable(__DIR__ . '/../backups');
        $results[] = [
            'name' => 'دسترسی نوشتن دایرکتوری‌ها',
            'status' => $permOk,
            'details' => $permOk ? 'پوشه‌های config، session و backups قابل نوشتن هستند.' : 'دسترسی نوشتن برخی پوشه‌ها بررسی شود (مجوز 755).'
        ];

        // 10. Installer Security Lock
        $lockOk = file_exists($lockFile);
        $results[] = [
            'name' => 'قفل امنیتی نصاب (installed.lock)',
            'status' => $lockOk,
            'details' => $lockOk ? 'قفل نصاب فعال است و از دسترسی غیرمجاز جلوگیری می‌کند.' : 'فایل قفل نصاب وجود ندارد.'
        ];

        echo json_encode([
            'success' => true,
            'diagnostics' => $results
        ], JSON_UNESCAPED_UNICODE);
        break;

    default:
        echo json_encode([
            'success' => false,
            'message' => 'اکشن درخواستی نامعتبر است.'
        ], JSON_UNESCAPED_UNICODE);
        break;
}

// تابع کمکی تنظیم وب‌هوک
function setTelegramWebhook(string $token, string $url): array {
    $apiUrl = "https://api.telegram.org/bot{$token}/setWebhook";
    $params = [
        'url' => $url,
        'drop_pending_updates' => false,
        'max_connections' => 40,
        'allowed_updates' => json_encode(['message', 'callback_query', 'channel_post'])
    ];

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $apiUrl,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $params,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 15,
    ]);

    $response = curl_exec($ch);
    $error    = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['success' => false, 'message' => 'خطای ارتباط cURL: ' . $error];
    }

    $result = json_decode($response, true);
    if ($result && !empty($result['ok'])) {
        return [
            'success' => true,
            'message' => 'وب‌هوک با موفقیت در تلگرام فعال و ست شد.',
            'description' => $result['description'] ?? 'Webhook was set'
        ];
    }

    return [
        'success' => false,
        'message' => 'خطا در ثبت وب‌هوک: ' . ($result['description'] ?? 'پاسخ نامعتبر از تلگرام')
    ];
}
