<?php
/**
 * Telegram Bot API Client (Core/TelegramBot.php)
 * ----------------------------------------------
 * ارسال پیام، عکس، ویدیو، آلبوم و مدیریت منوهای شیشه‌ای اینلاین
 */

namespace Core;

class TelegramBot {
    private string $token;
    private string $apiUrl;

    public function __construct(?string $token = null) {
        if ($token) {
            $this->token = $token;
        } else {
            $this->token = Database::getSetting('bot_token', '');
        }
        $this->apiUrl = "https://api.telegram.org/bot{$this->token}/";
    }

    /**
     * ارسال درخواست cURL به Telegram Bot API
     */
    public function request(string $method, array $params = []): array {
        if (empty($this->token)) {
            return ['ok' => false, 'description' => 'Bot token is empty'];
        }

        $url = $this->apiUrl . $method;
        $ch = curl_init();

        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $params,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT        => 30,
        ]);

        $response = curl_exec($ch);
        $error    = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($error) {
            return ['ok' => false, 'description' => "cURL Error: " . $error];
        }

        $result = json_decode($response, true);
        return is_array($result) ? $result : ['ok' => false, 'description' => 'Invalid JSON response from Telegram'];
    }

    /**
     * ارسال پیام متنی
     */
    public function sendMessage(string|int $chatId, string $text, array $extra = []): array {
        $params = array_merge([
            'chat_id'    => $chatId,
            'text'       => $text,
            'parse_mode' => 'HTML',
        ], $extra);

        if (isset($params['reply_markup']) && is_array($params['reply_markup'])) {
            $params['reply_markup'] = json_encode($params['reply_markup']);
        }

        return $this->request('sendMessage', $params);
    }

    /**
     * ارسال فایل/سند (برای ارسال بکاپ دیتابیس)
     */
    public function sendDocument(string|int $chatId, string $filePath, string $caption = '', ?int $threadId = null): array {
        if (!file_exists($filePath)) {
            return ['ok' => false, 'description' => 'File does not exist: ' . $filePath];
        }

        $cfile = new \CURLFile(realpath($filePath));
        $params = [
            'chat_id'    => $chatId,
            'document'   => $cfile,
            'caption'    => $caption,
            'parse_mode' => 'HTML',
        ];

        if ($threadId) {
            $params['message_thread_id'] = $threadId;
        }

        return $this->request('sendDocument', $params);
    }

    /**
     * ویرایش متن پیام
     */
    public function editMessageText(string|int $chatId, int $messageId, string $text, array $replyMarkup = []): array {
        $params = [
            'chat_id'    => $chatId,
            'message_id' => $messageId,
            'text'       => $text,
            'parse_mode' => 'HTML',
        ];

        if (!empty($replyMarkup)) {
            $params['reply_markup'] = json_encode($replyMarkup);
        }

        return $this->request('editMessageText', $params);
    }

    /**
     * پاسخ به Callback Query دکمه‌های شیشه‌ای
     */
    public function answerCallbackQuery(string $callbackQueryId, string $text = '', bool $showAlert = false): array {
        return $this->request('answerCallbackQuery', [
            'callback_query_id' => $callbackQueryId,
            'text'              => $text,
            'show_alert'        => $showAlert,
        ]);
    }

    /**
     * دریافت اطلاعات ربات
     */
    public function getMe(): array {
        return $this->request('getMe');
    }

    /**
     * تنظیم وبهوک
     */
    public function setWebhook(string $url): array {
        return $this->request('setWebhook', ['url' => $url]);
    }

    /**
     * دریافت به‌روزرسانی‌ها به روش لانگ‌پولینگ (در صورت عدم استفاده از وبهوک)
     */
    public function getUpdates(int $offset = 0, int $limit = 20, int $timeout = 5): array {
        return $this->request('getUpdates', [
            'offset'          => $offset,
            'limit'           => $limit,
            'timeout'         => $timeout,
            'allowed_updates' => json_encode(['message', 'callback_query'])
        ]);
    }
}
