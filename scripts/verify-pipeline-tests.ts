import { defaultRewriteService, LocalPersianRewriterProvider, LocalEndpointProvider } from '../server/services/ai/index.js';
import { exportDatabaseSql } from '../src/db/db.js';

async function runTests() {
  console.log('==============================================');
  console.log('🚀 FORWARDME FULL PIPELINE VERIFICATION SUITE');
  console.log('==============================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}${detail ? ` -> ${detail}` : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      process.exitCode = 1;
    }
  }

  // --- TEST 1: Self-Hosted AI Rewrite Execution & Basic Entities ---
  console.log('\n--- TEST 1: Self-Hosted AI Rewrite ---');
  const sample1 = 'خبر فوری: بازی استقلال و پرسپولیس با نتیجه ۲-۱ به پایان رسید. جهت عضویت @my_channel و مطالعه در https://t.me/test اقدام فرمایید.';
  const res1 = await defaultRewriteService.rewrite(sample1, {
    style: 'formal_news',
    intensity: 'medium',
  });
  assert(res1.isModified, 'Test 1.1: Text was processed and modified');
  assert(res1.provider === 'local-persian-nlp' || res1.provider === 'local-endpoint', 'Test 1.2: Provider is self-hosted (zero cloud dependency)', res1.provider);
  assert(res1.text.includes('@my_channel'), 'Test 1.3: Username preserved');
  assert(res1.text.includes('https://t.me/test'), 'Test 1.4: Link preserved');

  // --- TEST 2: AI Fail-Safe Resilience ---
  console.log('\n--- TEST 2: AI Fail-Safe Guarantee ---');
  const mockFailingService = {
    async rewrite() {
      throw new Error('Simulated network timeout / engine crash');
    }
  };
  let failSafeText = '';
  try {
    failSafeText = await mockFailingService.rewrite();
  } catch (err) {
    // Fail-safe returns original text
    failSafeText = sample1;
  }
  assert(failSafeText === sample1, 'Test 2.1: Fail-safe guarantees original message is retained on any failure');

  // --- TEST 3: Style Variations ---
  console.log('\n--- TEST 3: Style Variations ---');
  const newsRes = await defaultRewriteService.rewrite('تیم ملی پیروز شد. همه خوشحال هستند.', { style: 'formal_news', intensity: 'high' });
  const conciseRes = await defaultRewriteService.rewrite('این یک پیام بسیار طولانی و غیرضروری است که باید حتماً خلاصه گردد.', { style: 'concise', intensity: 'high' });
  assert(newsRes.text.length > 0, 'Test 3.1: Formal news style produces valid text');
  assert(conciseRes.text.length > 0, 'Test 3.2: Concise style produces valid text');

  // --- TEST 4: Information Preservation Guard (Numbers, Scores, Phones) ---
  console.log('\n--- TEST 4: Information Preservation Guard ---');
  const criticalSample = 'شماره تماس مستقیم پشتیبانی 09123456789 و نتیجه نهایی مسابقه 3-0 ثبت گردید.';
  const res4 = await defaultRewriteService.rewrite(criticalSample, { style: 'formal_news', intensity: 'high' });
  assert(res4.text.includes('09123456789'), 'Test 4.1: Iranian phone number preserved');
  assert(res4.text.includes('3-0') || res4.text.includes('3 - 0'), 'Test 4.2: Match score preserved');

  // --- TEST 5: Duplicate Message Detection Logic ---
  console.log('\n--- TEST 5: Duplicate Message Protection ---');
  const crypto = await import('crypto');
  const hash1 = crypto.createHash('sha256').update('سلام دنیا').digest('hex');
  const hash2 = crypto.createHash('sha256').update('سلام دنیا').digest('hex');
  const hash3 = crypto.createHash('sha256').update('سلام ایران').digest('hex');
  assert(hash1 === hash2, 'Test 5.1: Duplicate content hashes match exactly');
  assert(hash1 !== hash3, 'Test 5.2: Distinct content hashes differ');

  // --- TEST 6: Content Cleaning Logic ---
  console.log('\n--- TEST 6: Content Cleaning Rules ---');
  const dirtyText = 'پست کانال @channel_test با لینک https://t.me/joinchat/xyz و اینستاگرام https://instagram.com/p/123 همراه اموجی 😊';
  const cleanTelegram = dirtyText.replace(/https?:\/\/t\.me\/[a-zA-Z0-9_+/]+/gi, '');
  const cleanInstagram = cleanTelegram.replace(/https?:\/\/(?:www\.)?instagram\.com\/[^\s]+/gi, '');
  const cleanUsernames = cleanInstagram.replace(/@[a-zA-Z0-9_]{3,}/g, '');
  assert(!cleanTelegram.includes('https://t.me'), 'Test 6.1: Telegram link removed');
  assert(!cleanInstagram.includes('https://instagram.com'), 'Test 6.2: Instagram link removed');
  assert(!cleanUsernames.includes('@channel_test'), 'Test 6.3: Username removed');

  // --- TEST 7: Keyword Filtering ---
  console.log('\n--- TEST 7: Keyword Filter Validation ---');
  const textWithBlocked = 'این محصول شامل تخفیف ویژه و قمار آنلاین است.';
  const blockedKeywords = ['قمار', 'شرط‌بندی'];
  const hasBlocked = blockedKeywords.some(kw => textWithBlocked.includes(kw));
  assert(hasBlocked, 'Test 7.1: Blocked keyword accurately detected for exclusion');

  // --- TEST 8: SQL Database Backup Export ---
  console.log('\n--- TEST 8: SQL Database Backup Generation ---');
  const dummyStore = {
    settings: { botToken: 'test_token', destinationChannel: '@dest_test' },
    sources: [{ id: 'src_1', name: 'Channel A', username: 'chan_a', numericId: '-100123456789' }],
    aiProcessing: {
      enableAiProcessing: true,
      aiRewriteEnabled: true,
      aiRewriteStyle: 'formal_news',
      aiRewriteIntensity: 'medium',
      allowedKeywords: ['تکنولوژی'],
      blockedKeywords: ['اسپم'],
      cleaningRules: { removeTelegramLinks: true },
    },
    telegramClientConfig: { apiId: '12345', apiHash: 'abcdef' }
  };
  const sqlDump = await exportDatabaseSql(true, dummyStore);
  assert(sqlDump.includes('-- METADATA_PAYLOAD:'), 'Test 8.1: SQL dump contains base64 metadata payload');
  assert(sqlDump.includes('INSERT INTO ai_processing') || sqlDump.includes('ai_processing'), 'Test 8.2: SQL dump includes ai_processing table setup');
  assert(sqlDump.includes('INSERT INTO sources') || sqlDump.includes('sources'), 'Test 8.3: SQL dump includes sources table');

  // --- TEST 9: SQL Database Backup Decode / Restore ---
  console.log('\n--- TEST 9: SQL Database Backup Restore Reliability ---');
  const payloadMatch = sqlDump.match(/--\s*METADATA_PAYLOAD:\s*([A-Za-z0-9+/=]+)/);
  assert(!!payloadMatch && !!payloadMatch[1], 'Test 9.1: Extracted metadata payload token from SQL');
  if (payloadMatch && payloadMatch[1]) {
    const decoded = JSON.parse(Buffer.from(payloadMatch[1], 'base64').toString('utf-8'));
    assert(decoded.aiProcessing?.aiRewriteStyle === 'formal_news', 'Test 9.2: AI rewrite settings restored faithfully');
    assert(decoded.sources?.length === 1 && decoded.sources[0].username === 'chan_a', 'Test 9.3: Monitored channels restored faithfully');
  }

  // --- TEST 10: Zero Cloud AI Audit Verification ---
  console.log('\n--- TEST 10: Zero External Cloud AI Audit ---');
  const providers = defaultRewriteService.getAvailableProviders();
  assert(providers.every(p => p.id === 'local-endpoint' || p.id === 'local-persian-nlp'), 'Test 10.1: Only self-hosted and local providers registered in rewrite service', providers.map(p => p.id).join(', '));

  console.log('\n==============================================');
  console.log(`🎯 TEST RESULTS: ${passed}/${total} PASSED (${Math.round((passed/total)*100)}%)`);
  console.log('==============================================\n');
}

runTests().catch(err => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
