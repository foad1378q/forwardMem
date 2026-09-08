import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY || 'default_secret_encryption_key_32bytes_pad';
  // Always derive a 32-byte key using SHA-256
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Encrypts a plain string using AES-256-GCM.
 * Returns formatted string: enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptValue(plainText: string): string {
  if (!plainText) return '';
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    const ivHex = iv.toString('hex');

    return `enc:${ivHex}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Encryption error:', err);
    return plainText; // Fallback
  }
}

/**
 * Decrypts an encrypted string produced by encryptValue.
 * If the value is not encrypted (doesn't start with 'enc:'), returns as-is.
 */
export function decryptValue(cipherText: string): string {
  if (!cipherText) return '';
  if (!cipherText.startsWith('enc:')) {
    return cipherText; // Unencrypted or legacy string
  }

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 4) return cipherText;

    const [, ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('Decryption error or key mismatch:', err);
    return cipherText;
  }
}
