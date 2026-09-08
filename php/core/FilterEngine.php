<?php
/**
 * Message Processing and Filtering Engine (Core/FilterEngine.php)
 * ---------------------------------------------------------------
 * فیلتر کلمات مجاز/ممنوع، پاکسازی لینک‌ها و یوزرنیم‌ها، افزودن امضا و تشخیص تکراری
 */

namespace Core;

class FilterEngine {
    /**
     * بررسی آیا پیام مجاز به فوروارد است یا خیر (Keyword Filters)
     */
    public static function shouldProcessMessage(string $text, array $channelKeywords = [], string $matchMode = 'any'): array {
        $enableGlobalKw = Database::getSetting('enable_global_keywords', false);
        $globalKwList   = Database::getSetting('global_keywords', []);
        $globalMode     = Database::getSetting('global_keyword_match_mode', 'any');

        $aiSettings     = Database::getSetting('ai_processing', []);
        $blockedWords   = $aiSettings['blockedWords'] ?? [];

        // 1. بررسی کلمات ممنوعه (Blacklist)
        if (!empty($blockedWords)) {
            foreach ($blockedWords as $badWord) {
                $badWord = trim($badWord);
                if (!empty($badWord) && mb_stripos($text, $badWord) !== false) {
                    return ['allowed' => false, 'reason' => "حاوی کلمه ممنوعه: {$badWord}"];
                }
            }
        }

        // 2. بررسی کلمات کلیدی اختصاصی کانال
        if (!empty($channelKeywords)) {
            $matchedCount = 0;
            foreach ($channelKeywords as $kw) {
                $kw = trim($kw);
                if (!empty($kw) && mb_stripos($text, $kw) !== false) {
                    $matchedCount++;
                    if ($matchMode === 'any') break;
                }
            }

            if ($matchMode === 'all' && $matchedCount < count($channelKeywords)) {
                return ['allowed' => false, 'reason' => 'شامل تمام کلمات کلیدی الزامی کانال نیست.'];
            }
            if ($matchMode === 'any' && $matchedCount === 0) {
                return ['allowed' => false, 'reason' => 'شامل هیچ‌یک از کلمات کلیدی کانال نیست.'];
            }
        }

        // 3. بررسی کلمات کلیدی سراسری
        if ($enableGlobalKw && !empty($globalKwList)) {
            $matchedGlobal = 0;
            foreach ($globalKwList as $gkw) {
                $gkw = trim($gkw);
                if (!empty($gkw) && mb_stripos($text, $gkw) !== false) {
                    $matchedGlobal++;
                    if ($globalMode === 'any') break;
                }
            }

            if ($globalMode === 'all' && $matchedGlobal < count($globalKwList)) {
                return ['allowed' => false, 'reason' => 'شامل تمام کلمات کلیدی سراسری الزامی نیست.'];
            }
            if ($globalMode === 'any' && $matchedGlobal === 0) {
                return ['allowed' => false, 'reason' => 'شامل کلمات کلیدی سراسری نیست.'];
            }
        }

        return ['allowed' => true, 'reason' => 'مجاز برای ارسال'];
    }

    /**
     * پاکسازی محتوای پیام (حذف آیدی، لینک، منشن و کاراکترهای اضافه)
     */
    public static function cleanText(string $text): string {
        $ai = Database::getSetting('ai_processing', []);
        if (empty($ai['enableContentCleaning'])) {
            return $text;
        }

        // حذف لینک‌های تلگرام (t.me/... یا telegram.me/...)
        if (!empty($ai['removeTelegramLinks'])) {
            $text = preg_replace('/https?:\/\/(t|telegram)\.me\/[a-zA-Z0-9_+/]+/i', '', $text);
        }

        // حذف لینک‌های وب معمولی (http:// یا https://)
        if (!empty($ai['removeWebLinks'])) {
            $text = preg_replace('/https?:\/\/[^\s]+/i', '', $text);
        }

        // حذف آیدی‌های تلگرام (@username)
        if (!empty($ai['removeUsernames'])) {
            $text = preg_replace('/@[a-zA-Z0-9_]{4,32}/i', '', $text);
        }

        // حذف هشتگ‌ها (#hashtag)
        if (!empty($ai['removeHashtags'])) {
            $text = preg_replace('/#[\w\x{0600}-\x{06FF}]+/u', '', $text);
        }

        // حذف شماره تماس‌ها
        if (!empty($ai['removePhoneNumbers'])) {
            $text = preg_replace('/(\+?98|0)?9\d{9}/', '', $text);
        }

        // تمیزکاری خطوط خالی بیش از حد
        $text = preg_replace("/\n{3,}/", "\n\n", trim($text));

        return $text;
    }

    /**
     * الحاق امضای اختصاصی کانال به انتهای پست
     */
    public static function appendSignature(string $text): string {
        $ai = Database::getSetting('ai_processing', []);
        if (!empty($ai['enableMessageSignature']) && !empty($ai['customSignatureText'])) {
            $sig = trim($ai['customSignatureText']);
            return rtrim($text) . "\n\n" . $sig;
        }
        return $text;
    }

    /**
     * بررسی و جلوگیری از ارسال پیام‌های تکراری با پنجره زمانی
     */
    public static function isDuplicate(string $text, ?string $mediaId = null, int $windowMinutes = 120): bool {
        $content = trim($text) . ($mediaId ? "_{$mediaId}" : "");
        if (empty($content)) return false;

        $hash = md5($content);

        // بررسی آیا در جدول هشدارهای پردازش‌شده وجود دارد
        $existing = Database::fetch(
            "SELECT `id` FROM `processed_hashes` 
             WHERE `content_hash` = ? AND `created_at` >= DATE_SUB(NOW(), INTERVAL ? MINUTE) 
             LIMIT 1",
            [$hash, $windowMinutes]
        );

        if ($existing) {
            return true;
        }

        // ذخیره هش جدید
        Database::query(
            "INSERT INTO `processed_hashes` (`content_hash`, `created_at`) VALUES (?, NOW())",
            [$hash]
        );

        return false;
    }
}
