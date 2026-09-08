<?php
/**
 * Telegram Forwarder - Main Configuration Sample File
 * ----------------------------------------------------
 * این فایل نمونه پیکربندی پروژه است. هنگام اجرای Installer،
 * فایل اصلی config.php به صورت خودکار از روی این مقادیر تولید می‌شود.
 */

defined('APP_INIT') or define('APP_INIT', true);

return [
    // --- تنظیمات پایگاه داده MySQL (پشتیبانی کامل از Localhost و Remote MySQL) ---
    'db' => [
        'host'     => 'localhost',       // برای سرور محلی localhost یا IP سرور cPanel برای Remote MySQL
        'port'     => 3306,
        'dbname'   => 'cpaneluser_tgforwarder',
        'username' => 'cpaneluser_dbuser',
        'password' => 'Strong_DB_Password_Here',
        'charset'  => 'utf8mb4',
    ],

    // --- تنظیمات ربات تلگرام و کانال مقصد ---
    'telegram' => [
        'bot_token'           => '123456789:ABCdefGHIjklMNOpqrsTUVwxyz', // توکن ربات از BotFather
        'destination_channel' => '@my_destination_channel',             // یوزرنیم یا شناسه عددی کانال مقصد
        'admin_user_id'       => '123456789',                            // شناسه عددی تلگرام مدیر برای دریافت اعلان‌ها و دسترسی منو
        'admin_passcode'      => 'admin123',                             // رمز ورود به ربات در تلگرام (/login admin123)
        'report_chat_id'      => '',                                     // شناسه گروه/کانال برای ارسال بکاپ خودکار
        'report_thread_id'    => null,                                   // شناسه تاپیک/موضوع در صورت سوپرگروه بودن (message_thread_id)
    ],

    // --- تنظیمات کلاینت اکانت تلگرام (MadelineProto MTProto Client) ---
    'madeline' => [
        'api_id'       => 1234567,                     // دریافت از my.telegram.org
        'api_hash'     => '0123456789abcdef0123456789abcdef', // دریافت از my.telegram.org
        'phone_number' => '+989123456789',             // شماره تلفن اکانت
        'session_file' => __DIR__ . '/../session/tg_session.madeline', // مسیر ذخیره نشست لاگین
    ],

    // --- تنظیمات پنل وب و امنیت ---
    'app' => [
        'app_name'     => 'سامانه مانیتورینگ و فوروارد هوشمند تلگرام',
        'base_url'     => 'https://example.com/forwarder',
        'secret_key'   => 'CHANGE_THIS_RANDOM_SECRET_KEY_FOR_SECURITY_64_CHARS',
        'timezone'     => 'Asia/Tehran',
        'debug'        => false,
    ],

    // --- تنظیمات هوش مصنوعی و بازنویسی متن (Self-Hosted AI Engine) ---
    'ai' => [
        'provider'   => 'self-hosted', // خودمیزبان بدون نیاز به API خارجی
        'endpoint'   => 'http://127.0.0.1:3000/api/ai/test-rewrite',
        'enabled'    => false,
        'style'      => 'formal_news',
        'intensity'  => 'medium',
    ],
];
