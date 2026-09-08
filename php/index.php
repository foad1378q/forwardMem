<?php
/**
 * Root Router & Entrypoint (index.php)
 * -------------------------------------
 * هدایت خودکار کاربر:
 * ۱. اگر پروژه هنوز نصب نشده -> هدایت به /installer/
 * ۲. اگر پروژه نصب شده -> هدایت به /panel/
 */

if (!file_exists(__DIR__ . '/config/installed.lock') && !file_exists(__DIR__ . '/config/config.php')) {
    header('Location: installer/index.php');
    exit;
}

header('Location: panel/index.php');
exit;
