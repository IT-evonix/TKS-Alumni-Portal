import crypto from 'crypto';

/**
 * Token Encryption Utility
 * Encrypts and decrypts sensitive tokens (LinkedIn access tokens, refresh tokens, etc.)
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM mode
const _AUTH_TAG_LENGTH = 16;
const _SALT_LENGTH = 64;

/**
 * Get encryption key from environment variable
 * In production, this should be a strong, randomly generated key stored securely
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    console.warn('⚠️ WARNING: ENCRYPTION_KEY not set in environment variables!');
    console.warn('Using a default key for development. DO NOT use in production!');
    // Default key for development only - NEVER use in production
    return crypto.scryptSync('default-dev-key-change-in-production', 'salt', 32);
  }
  
  // Derive a 32-byte key from the environment variable
  return crypto.scryptSync(key, 'tks-alumni-portal-salt', 32);
}

/**
 * Encrypt a token string
 * @param token - The plaintext token to encrypt
 * @returns Encrypted token in format: iv:authTag:encryptedData (all base64 encoded)
 */
export function encryptToken(token: string): string {
  if (!token) return '';
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encryptedData
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('❌ Token encryption error:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt a token string
 * @param encryptedToken - The encrypted token in format: iv:authTag:encryptedData
 * @returns Decrypted plaintext token
 */
export function decryptToken(encryptedToken: string): string {
  if (!encryptedToken) return '';
  
  try {
    const key = getEncryptionKey();
    const parts = encryptedToken.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encryptedData = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ Token decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Check if a token is encrypted (has the expected format)
 * @param token - Token to check
 * @returns true if token appears to be encrypted
 */
export function isTokenEncrypted(token: string): boolean {
  if (!token) return false;
  const parts = token.split(':');
  return parts.length === 3;
}

/**
 * Safely encrypt a token, handling already-encrypted tokens
 * @param token - Token to encrypt (may already be encrypted)
 * @returns Encrypted token
 */
export function safeEncryptToken(token: string): string {
  if (!token) return '';
  if (isTokenEncrypted(token)) {
    return token; // Already encrypted
  }
  return encryptToken(token);
}
