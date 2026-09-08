<?php
/**
 * Panel Logout (Panel/logout.php)
 */

define('APP_INIT', true);

require_once __DIR__ . '/../core/Auth.php';

use Core\Auth;

Auth::logout();
header('Location: login.php');
exit;
