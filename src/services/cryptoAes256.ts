/**
 * AES-256-GCM Authenticated Encryption Engine (WebCrypto + AAD Context Binding & 64KB Chunked Streaming)
 *
 * Implements:
 * - 256-bit (32-byte) AES-GCM keys via WebCrypto (`crypto.subtle`)
 * - 12-byte (96-bit) CSPRNG initialization vector (`crypto.getRandomValues(new Uint8Array(12))`)
 * - 128-bit (16-byte) authentication tag (`tagLength: 128`)
 * - Associated Authenticated Data (AAD) context binding (`user_id:<uid>|record_id:<id>`)
 * - Canonical packed layout: `[12-byte IV | 16-byte AuthTag | Ciphertext]` encoded as URL-safe Base64
 * - 64 KB sequential chunked streaming encryption/decryption with chunk-index AAD binding to prevent OOM
 */

export const AES_KEY_BITS = 256;
export const GCM_IV_BYTE_LENGTH = 12; // 96-bit NIST recommended nonce
export const GCM_TAG_BIT_LENGTH = 128; // 16-byte authentication tag
export const GCM_TAG_BYTE_LENGTH = 16;
export const STREAM_CHUNK_SIZE_BYTES = 64 * 1024; // 64 KB chunked streaming

export interface AesGcmInspectionEnvelope {
  packedBase64Url: string;
  ivHex: string;
  authTagHex: string;
  ciphertextByteLength: number;
  totalPackedByteLength: number;
  aadContext: string;
  algorithm: 'AES-256-GCM (12B IV + 16B Tag)';
  timestampIso: string;
}

export interface ChunkedStreamEncryptionResult {
  chunkCount: number;
  chunkSizeBytes: number;
  totalPlaintextBytes: number;
  baseAadContext: string;
  chunksBase64Url: string[];
}

function getWebCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  throw new Error('WebCrypto API (crypto.subtle) is required for AES-256-GCM operations.');
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function base64UrlToBytes(base64Url: string): Uint8Array {
  const normalized = base64Url
    .trim()
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * Formats canonical Associated Authenticated Data (AAD) string binding ciphertext
 * to a specific user and record context so ciphertext cannot be transplanted across records.
 */
export function buildCanonicalAadContext(userId: string, recordId: string): string {
  const cleanUser = (userId || 'anonymous').trim();
  const cleanRecord = (recordId || 'default_record').trim();
  return `user_id:${cleanUser}|record_id:${cleanRecord}`;
}

/**
 * Derives a deterministic 256-bit AES-GCM CryptoKey from a passphrase or raw secret.
 */
export async function deriveAes256GcmKey(secretOrPassphrase: string): Promise<CryptoKey> {
  const wc = getWebCrypto();
  const enc = new TextEncoder();
  const digest = await wc.subtle.digest('SHA-256', enc.encode(secretOrPassphrase));
  return wc.subtle.importKey(
    'raw',
    digest,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a fresh hardware-backed/WebCrypto 256-bit AES-GCM key.
 */
export async function generateAes256GcmKey(): Promise<CryptoKey> {
  const wc = getWebCrypto();
  return wc.subtle.generateKey(
    { name: 'AES-GCM', length: AES_KEY_BITS },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext using AES-256-GCM with a unique 12-byte CSPRNG IV and mandatory AAD context binding.
 *
 * WebCrypto returns `[Ciphertext | 16-byte AuthTag]`.
 * We pack into canonical `[12-byte IV | 16-byte AuthTag | Ciphertext]` and encode as URL-safe Base64.
 */
export async function encryptAes256GcmWithAad(
  plaintext: string,
  secretOrKey: string | CryptoKey,
  aadContext: string
): Promise<AesGcmInspectionEnvelope> {
  const wc = getWebCrypto();
  const key =
    typeof secretOrKey === 'string'
      ? await deriveAes256GcmKey(secretOrKey)
      : secretOrKey;

  const iv = wc.getRandomValues(new Uint8Array(GCM_IV_BYTE_LENGTH));
  const enc = new TextEncoder();
  const plainBytes = enc.encode(plaintext);
  const aadBytes = enc.encode(aadContext);

  const encryptedBuffer = await wc.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aadBytes,
      tagLength: GCM_TAG_BIT_LENGTH,
    },
    key,
    plainBytes
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  if (encryptedBytes.byteLength < GCM_TAG_BYTE_LENGTH) {
    throw new Error('AES-256-GCM encryption output shorter than 16-byte authentication tag.');
  }

  const ciphertextLength = encryptedBytes.byteLength - GCM_TAG_BYTE_LENGTH;
  const ciphertextPart = encryptedBytes.slice(0, ciphertextLength);
  const authTagPart = encryptedBytes.slice(ciphertextLength);

  // Pack as [12-byte IV | 16-byte AuthTag | Ciphertext]
  const packed = new Uint8Array(
    GCM_IV_BYTE_LENGTH + GCM_TAG_BYTE_LENGTH + ciphertextPart.byteLength
  );
  packed.set(iv, 0);
  packed.set(authTagPart, GCM_IV_BYTE_LENGTH);
  packed.set(ciphertextPart, GCM_IV_BYTE_LENGTH + GCM_TAG_BYTE_LENGTH);

  return {
    packedBase64Url: bytesToBase64Url(packed),
    ivHex: bytesToHex(iv),
    authTagHex: bytesToHex(authTagPart),
    ciphertextByteLength: ciphertextPart.byteLength,
    totalPackedByteLength: packed.byteLength,
    aadContext,
    algorithm: 'AES-256-GCM (12B IV + 16B Tag)',
    timestampIso: new Date().toISOString(),
  };
}

/**
 * Decrypts a packed `[12-byte IV | 16-byte AuthTag | Ciphertext]` URL-safe Base64 payload
 * and verifies both the 128-bit authentication tag and the Associated Authenticated Data (AAD).
 * Throws an explicit authentication error if the ciphertext, IV, AuthTag, or AAD was tampered with.
 */
export async function decryptAes256GcmWithAad(
  packedBase64Url: string,
  secretOrKey: string | CryptoKey,
  expectedAadContext: string
): Promise<string> {
  const wc = getWebCrypto();
  const packed = base64UrlToBytes(packedBase64Url);
  const minLength = GCM_IV_BYTE_LENGTH + GCM_TAG_BYTE_LENGTH;
  if (packed.byteLength < minLength) {
    throw new Error(
      `AEADBadTagException: Packed payload (${packed.byteLength}B) is shorter than minimum 28B header (12B IV + 16B Tag).`
    );
  }

  const key =
    typeof secretOrKey === 'string'
      ? await deriveAes256GcmKey(secretOrKey)
      : secretOrKey;

  const iv = packed.slice(0, GCM_IV_BYTE_LENGTH);
  const authTag = packed.slice(GCM_IV_BYTE_LENGTH, GCM_IV_BYTE_LENGTH + GCM_TAG_BYTE_LENGTH);
  const ciphertext = packed.slice(GCM_IV_BYTE_LENGTH + GCM_TAG_BYTE_LENGTH);

  // Reconstruct WebCrypto expected order: [Ciphertext | 16-byte AuthTag]
  const webCryptoCipher = new Uint8Array(ciphertext.byteLength + authTag.byteLength);
  webCryptoCipher.set(ciphertext, 0);
  webCryptoCipher.set(authTag, ciphertext.byteLength);

  const enc = new TextEncoder();
  const aadBytes = enc.encode(expectedAadContext);

  try {
    const decryptedBuffer = await wc.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aadBytes,
        tagLength: GCM_TAG_BIT_LENGTH,
      },
      key,
      webCryptoCipher
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error(
      'AEADBadTagException: AES-256-GCM authentication tag or AAD context verification failed. Tampering detected.'
    );
  }
}

/**
 * 64 KB Sequential Chunked Stream Encryption:
 * Splits large payloads into 64 KB (or configurable) chunks, encrypting each chunk with a fresh
 * 12-byte IV and binding the chunk index + total chunks into the per-chunk AAD (`<baseAad>|chunk:<i>/<total>`)
 * so chunks cannot be reordered, dropped, or spliced.
 */
export async function encryptChunkedStreamAes256Gcm(
  plaintext: string,
  secretOrKey: string | CryptoKey,
  baseAadContext: string,
  chunkSizeBytes: number = STREAM_CHUNK_SIZE_BYTES
): Promise<ChunkedStreamEncryptionResult> {
  const safeChunkSize = Math.max(64, chunkSizeBytes);
  const plainBytes = new TextEncoder().encode(plaintext);
  const totalBytes = plainBytes.byteLength;
  const totalChunks = Math.max(1, Math.ceil(totalBytes / safeChunkSize));
  const chunksBase64Url: string[] = [];

  const key =
    typeof secretOrKey === 'string'
      ? await deriveAes256GcmKey(secretOrKey)
      : secretOrKey;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * safeChunkSize;
    const end = Math.min(totalBytes, start + safeChunkSize);
    const slice = plainBytes.slice(start, end);
    const chunkText = new TextDecoder().decode(slice);
    const chunkAad = `${baseAadContext}|chunk:${i + 1}/${totalChunks}`;
    const env = await encryptAes256GcmWithAad(chunkText, key, chunkAad);
    chunksBase64Url.push(env.packedBase64Url);
  }

  return {
    chunkCount: totalChunks,
    chunkSizeBytes: safeChunkSize,
    totalPlaintextBytes: totalBytes,
    baseAadContext,
    chunksBase64Url,
  };
}

/**
 * Decrypts and reassembles a 64 KB sequential chunked stream, verifying each chunk's
 * sequence counter in the AAD context.
 */
export async function decryptChunkedStreamAes256Gcm(
  streamPayload: ChunkedStreamEncryptionResult,
  secretOrKey: string | CryptoKey,
  expectedBaseAadContext: string
): Promise<string> {
  const key =
    typeof secretOrKey === 'string'
      ? await deriveAes256GcmKey(secretOrKey)
      : secretOrKey;

  const totalChunks = streamPayload.chunksBase64Url.length;
  if (totalChunks !== streamPayload.chunkCount) {
    throw new Error('StreamIntegrityException: Chunk count mismatch in encrypted stream.');
  }

  const parts: string[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunkAad = `${expectedBaseAadContext}|chunk:${i + 1}/${totalChunks}`;
    const part = await decryptAes256GcmWithAad(
      streamPayload.chunksBase64Url[i],
      key,
      chunkAad
    );
    parts.push(part);
  }
  return parts.join('');
}
