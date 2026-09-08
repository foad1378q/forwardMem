<?php
/**
 * Standalone Backup Script (cron/backup.php)
 * ------------------------------------------
 * قابل فراخوانی مجزا از خط فرمان یا کرون‌جاب اختصاصی
 */

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/BackupService.php';

use Core\BackupService;

$res = BackupService::runBackup(true);
echo "[" . date('Y-m-d H:i:s') . "] " . $res['message'] . PHP_EOL;
