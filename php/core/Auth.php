<?php
/**
 * Authentication and Security Helper (Core/Auth.php)
 * --------------------------------------------------
 * مدیریت سشن‌های امن، اعتبارسنجی لاگین، توکن CSRF و جلوگیری از Brute Force
 */

namespace Core;

class Auth {
    private const MAX_LOGIN_ATTEMPTS = 5;
    private const LOCKOUT_TIME = 900; // 15 دقیقه

    public static function startSession(): void {
        if (session_status() === PHP_SESSION_NONE) {
            ini_set('session.cookie_httponly', '1');
            ini_set('session.use_only_cookies', '1');
            if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
                ini_set('session.cookie_secure', '1');
            }
            session_start();
        }
    }

    public static function check(): bool {
        self::startSession();
        return isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
    }

    public static function requireLogin(): void {
        if (!self::check()) {
            header('Location: login.php');
            exit;
        }
    }

    public static function login(string $username, string $password): array {
        self::startSession();
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

        // بررسی قفل موقت به دلیل تلاش‌های ناموفق
        $attemptsKey = "login_attempts_{$ip}";
        $lockoutKey  = "login_lockout_{$ip}";

        if (isset($_SESSION[$lockoutKey]) && time() < $_SESSION[$lockoutKey]) {
            $remaining = ceil(($_SESSION[$lockoutKey] - time()) / 60);
            return [
                'success' => false,
                'message' => "به دلیل تلاش‌های ناموفق مکرر، ورود تا {$remaining} دقیقه مسدود شده است."
            ];
        }

        $user = Database::fetch("SELECT * FROM `admin_users` WHERE `username` = ? LIMIT 1", [$username]);

        if ($user && password_verify($password, $user['password_hash'])) {
            // ریست تلاش‌های ناموفق
            unset($_SESSION[$attemptsKey], $_SESSION[$lockoutKey]);
            session_regenerate_id(true);

            $_SESSION['admin_logged_in'] = true;
            $_SESSION['admin_id']        = $user['id'];
            $_SESSION['admin_username']  = $user['username'];
            $_SESSION['login_time']      = time();

            Database::query("UPDATE `admin_users` SET `last_login` = NOW(), `last_ip` = ? WHERE `id` = ?", [$ip, $user['id']]);

            return ['success' => true, 'message' => 'ورود با موفقیت انجام شد.'];
        }

        // افزایش شمارنده تلاش‌های ناموفق
        $_SESSION[$attemptsKey] = ($_SESSION[$attemptsKey] ?? 0) + 1;
        if ($_SESSION[$attemptsKey] >= self::MAX_LOGIN_ATTEMPTS) {
            $_SESSION[$lockoutKey] = time() + self::LOCKOUT_TIME;
            return [
                'success' => false,
                'message' => 'حساب کاربری شما به مدت ۱۵ دقیقه به دلیل تلاش‌های ناموفق موقتاً مسدود گردید.'
            ];
        }

        $rem = self::MAX_LOGIN_ATTEMPTS - $_SESSION[$attemptsKey];
        return [
            'success' => false,
            'message' => "نام کاربری یا رمز عبور اشتباه است. ({$rem} تلاش باقی‌مانده)"
        ];
    }

    public static function logout(): void {
        self::startSession();
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
    }

    public static function generateCsrfToken(): string {
        self::startSession();
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }

    public static function validateCsrfToken(?string $token): bool {
        self::startSession();
        if (empty($_SESSION['csrf_token']) || empty($token)) {
            return false;
        }
        return hash_equals($_SESSION['csrf_token'], $token);
    }
}
