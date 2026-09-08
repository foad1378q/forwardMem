<?php
/**
 * Clean Old Logs & Cache (cron/clean_logs.php)
 */

require_once __DIR__ . '/../core/Database.php';

use Core\Database;

Database::query("DELETE FROM `logs` WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 30 DAY)");
Database::query("DELETE FROM `processed_hashes` WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 7 DAY)");

echo "[" . date('Y-m-d H:i:s') . "] Old logs (>30d) and hashes (>7d) cleaned successfully.\n";
