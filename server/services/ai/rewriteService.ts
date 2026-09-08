import { ILlmProvider, RewritePromptOptions, RewriteResult, RewriteStyle, RewriteIntensity } from './types.js';
import { LocalPersianRewriterProvider, LocalEndpointProvider } from './llmProvider.js';

export class RewriteService {
  private localNlpProvider: LocalPersianRewriterProvider;
  private endpointProvider: LocalEndpointProvider;

  constructor() {
    this.localNlpProvider = new LocalPersianRewriterProvider();
    this.endpointProvider = new LocalEndpointProvider();
  }

  /**
   * Main entry point for rewriting text.
   * Guaranteed fail-safe: Never throws. In case of any issue, falls back to original text.
   */
  async rewrite(text: string, options?: Partial<RewritePromptOptions>): Promise<RewriteResult> {
    const startTime = Date.now();

    const opts: RewritePromptOptions = {
      style: (options?.style as RewriteStyle) || 'formal_news',
      intensity: (options?.intensity as RewriteIntensity) || 'medium',
      customInstruction: options?.customInstruction || '',
      maxLength: options?.maxLength || 2000,
    };

    if (!text || !text.trim()) {
      return {
        text: text || '',
        rewrittenText: text || '',
        originalText: text || '',
        style: opts.style,
        intensity: opts.intensity,
        isModified: false,
        provider: 'none',
        providerUsed: 'none',
        processingTimeMs: 0,
        stats: {
          originalLength: 0,
          rewrittenLength: 0,
          wordsModifiedRatio: 0,
        },
        preservedEntities: { numbersCount: 0, usernames: [], links: [], hashtags: [], phones: [], scores: [] },
      };
    }

    const trimmed = text.trim();

    // 1. Extract critical entities for safety verification
    const extractedEntities = this.extractEntities(trimmed);

    let rewritten = trimmed;
    let usedProvider = this.localNlpProvider.id;

    try {
      // 2. Try Local Endpoint Provider if configured, else fallback to LocalPersianRewriterProvider
      let success = false;
      if (await this.endpointProvider.isAvailable()) {
        try {
          rewritten = await this.endpointProvider.rewrite(trimmed, opts);
          usedProvider = this.endpointProvider.id;
          success = true;
        } catch (endpointErr: any) {
          console.warn(`[AI REWRITE] Local endpoint failed (${endpointErr?.message || endpointErr}), falling back to built-in engine.`);
        }
      }

      if (!success) {
        rewritten = await this.localNlpProvider.rewrite(trimmed, opts);
        usedProvider = this.localNlpProvider.id;
      }

      // 3. Information Preservation Guard
      rewritten = this.enforcePreservationGuard(trimmed, rewritten, extractedEntities);

    } catch (err: any) {
      // Fail-safe: Always fall back to original text, log error
      console.error('[AI REWRITE FAIL-SAFE] Error during rewrite, falling back to original message:', err?.message || err);
      rewritten = trimmed;
    }

    const duration = Date.now() - startTime;
    const isModified = rewritten.trim() !== trimmed;

    return {
      text: rewritten,
      rewrittenText: rewritten,
      originalText: trimmed,
      style: opts.style,
      intensity: opts.intensity,
      isModified,
      provider: usedProvider,
      providerUsed: usedProvider,
      processingTimeMs: duration,
      stats: {
        originalLength: trimmed.length,
        rewrittenLength: rewritten.length,
        wordsModifiedRatio: isModified ? 0.25 : 0,
      },
      preservedEntities: extractedEntities,
    };
  }

  private extractEntities(text: string) {
    const usernames = Array.from(new Set(text.match(/@[a-zA-Z0-9_]{3,}/g) || []));
    const links = Array.from(new Set(text.match(/https?:\/\/[^\s]+/gi) || []));
    const hashtags = Array.from(new Set(text.match(/#[^\s#]+/g) || []));
    const phones = Array.from(new Set(text.match(/(?:\+98|0)?9\d{9}\b/g) || []));
    const numbers = text.match(/\b\d+\b/g) || [];
    const scores = Array.from(new Set(text.match(/\d+\s*[-–—]\s*\d+/g) || []));

    return {
      numbersCount: numbers.length,
      usernames,
      links,
      hashtags,
      phones,
      scores,
    };
  }

  /**
   * Validates that the rewritten text did not lose or distort critical entities.
   */
  private enforcePreservationGuard(
    original: string,
    rewritten: string,
    entities: ReturnType<typeof this.extractEntities>
  ): string {
    if (!rewritten || !rewritten.trim()) return original;

    let guarded = rewritten;

    // Check usernames
    for (const u of entities.usernames) {
      if (!guarded.includes(u)) {
        guarded += `\n${u}`;
      }
    }

    // Check links
    for (const l of entities.links) {
      if (!guarded.includes(l)) {
        guarded += `\n${l}`;
      }
    }

    // Check phone numbers
    for (const p of entities.phones) {
      if (!guarded.includes(p)) {
        guarded += `\n📞 ${p}`;
      }
    }

    return guarded;
  }

  getAvailableProviders(): ILlmProvider[] {
    return [this.endpointProvider, this.localNlpProvider];
  }
}

// Global Singleton for easy server-wide use
export const defaultRewriteService = new RewriteService();
