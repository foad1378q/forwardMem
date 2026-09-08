<?php
/**
 * AI Processing Service (Core/AiService.php)
 * ------------------------------------------
 * بازنویسی متن با موتور محلی خودمیزبان (Self-Hosted AI Engine)
 */

namespace Core;

class AiService {
    /**
     * بازنویسی هوشمند متن با موتور محلی بدون وابستگی ابری
     */
    public static function rewriteText(string $text, string $promptInstructions = ''): string {
        $aiConfig = Database::getSetting('ai_config', []);
        if (empty($aiConfig['enabled'])) {
            return $text;
        }

        // Call local self-hosted rewrite service endpoint
        $localEndpoint = getenv('LOCAL_AI_ENDPOINT') ?: 'http://127.0.0.1:3000/api/ai/test-rewrite';
        
        $body = [
            'text' => $text,
            'style' => $aiConfig['style'] ?? 'formal_news',
            'intensity' => $aiConfig['intensity'] ?? 'medium',
            'customPrompt' => $promptInstructions,
        ];

        $ch = curl_init($localEndpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($body),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);

        $response = curl_exec($ch);
        curl_close($ch);

        if (!$response) return $text;

        $json = json_decode($response, true);
        return $json['rewrittenText'] ?? $text;
    }
}
