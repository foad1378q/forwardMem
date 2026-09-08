export type RewriteStyle =
  | 'formal_news'       // رسمی و خبری
  | 'news_engaging'      // خبری و جذاب
  | 'concise'            // کوتاه و خلاصه
  | 'friendly'           // دوستانه
  | 'promotional'        // تبلیغاتی
  | 'sports'             // ورزشی
  | 'professional'       // حرفه‌ای
  | 'custom';            // سفارشی

export type RewriteIntensity = 'low' | 'medium' | 'high';

export interface RewritePromptOptions {
  style: RewriteStyle;
  intensity: RewriteIntensity;
  customInstruction?: string;
  customPrompt?: string;
  maxLength?: number;
  preserveEmojis?: boolean;
}

export type RewriteOptions = RewritePromptOptions;

export interface RewriteResult {
  text: string;
  rewrittenText: string;
  originalText: string;
  style: RewriteStyle;
  intensity: RewriteIntensity;
  isModified: boolean;
  provider: string;
  providerUsed: string;
  processingTimeMs: number;
  stats?: {
    originalLength: number;
    rewrittenLength: number;
    wordsModifiedRatio: number;
  };
  preservedEntities: {
    numbersCount: number;
    usernames: string[];
    links: string[];
    hashtags: string[];
    phones: string[];
    scores: string[];
  };
}

export interface ILlmProvider {
  readonly id: string;
  readonly name: string;
  rewrite(text: string, options: RewritePromptOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
}
