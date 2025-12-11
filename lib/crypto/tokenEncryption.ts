/**
 * Token Encryption Utilities
 *
 * Encrypts and decrypts OAuth tokens for secure storage in the database.
 * Uses AES-256-GCM encryption with a secret key from environment variables.
 */

import crypto from 'crypto'
import { env } from '@/lib/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits
const SALT_LENGTH = 64 // 512 bits

/**
 * Get encryption key from environment variable
 * The key should be a 32-byte (256-bit) hex string
 */
function getEncryptionKey(): Buffer {
  // Use validated env from Zod schema - this ensures TOKEN_ENCRYPTION_KEY
  // is loaded at startup and will prevent silent failures
  const key = env.TOKEN_ENCRYPTION_KEY

  // Convert hex string to buffer (64 hex chars = 32 bytes)
  return Buffer.from(key, 'hex')
}

/**
 * Encrypt a token for storage
 *
 * @param plaintext - The token to encrypt
 * @returns Encrypted token as base64 string (format: iv:authTag:ciphertext)
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
  ciphertext += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  // Return format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext}`
}

/**
 * Decrypt a token from storage
 *
 * @param encrypted - The encrypted token (format: iv:authTag:ciphertext)
 * @returns Decrypted token as plaintext
 */
export function decryptToken(encrypted: string): string {
  const key = getEncryptionKey()

  // Parse the encrypted string
  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format')
  }

  const iv = Buffer.from(parts[0], 'base64')
  const authTag = Buffer.from(parts[1], 'base64')
  const ciphertext = parts[2]

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let plaintext = decipher.update(ciphertext, 'base64', 'utf8')
  plaintext += decipher.final('utf8')

  return plaintext
}

/**
 * Generate a new encryption key for TOKEN_ENCRYPTION_KEY
 * Run this once and store in your .env.local
 *
 * @returns 64-character hex string (32 bytes)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}
