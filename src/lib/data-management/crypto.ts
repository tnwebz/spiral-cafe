/**
 * Spiral Cafe Cryptography Engine for Portable Data Archives (.scarchive)
 * Uses standard Web Crypto API (PBKDF2-SHA256 + AES-GCM-256)
 * Fully compatible with browsers, Next.js, and Cloudflare Workers.
 */

import { ArchivePayloadData, EncryptedArchiveFile, ArchiveManifest } from "./types";

// Convert Uint8Array to Base64
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

// Convert Base64 to Uint8Array
export function base64ToUint8(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, "base64"));
}

/**
 * Compute SHA-256 Hex string for cryptographic verification
 */
export async function computeSha256Hex(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Derive AES-GCM 256-bit Key from User Passphrase using PBKDF2
 */
async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt archive payload into a self-contained, authenticated .scarchive structure
 */
export async function encryptArchiveFile(
  payload: ArchivePayloadData,
  passphrase: string
): Promise<EncryptedArchiveFile> {
  if (!passphrase || passphrase.trim().length < 6) {
    throw new Error("Archive passphrase must be at least 6 characters long.");
  }

  // 1. Serialize records payload
  const rawPayloadJson = JSON.stringify(payload);

  // 2. Generate random 16-byte Salt and 12-byte IV
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // 3. Derive Key & Encrypt via AES-GCM
  const key = await deriveAesKey(passphrase, salt);
  const encoder = new TextEncoder();
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as any },
    key,
    encoder.encode(rawPayloadJson)
  );

  const ciphertextBase64 = uint8ToBase64(new Uint8Array(encryptedBuffer));

  return {
    magic: "SCARCHIVE",
    version: 1,
    salt: uint8ToBase64(salt),
    iv: uint8ToBase64(iv),
    manifestPreview: payload.manifest,
    ciphertext: ciphertextBase64,
  };
}

/**
 * Decrypt and verify .scarchive file using the passphrase
 */
export async function decryptArchiveFile(
  archiveFile: EncryptedArchiveFile,
  passphrase: string
): Promise<ArchivePayloadData> {
  if (archiveFile.magic !== "SCARCHIVE") {
    throw new Error("Invalid archive file format. File does not start with SCARCHIVE header.");
  }

  if (archiveFile.version !== 1) {
    throw new Error(`Unsupported archive format version: ${archiveFile.version}. Supported version is 1.`);
  }

  const salt = base64ToUint8(archiveFile.salt);
  const iv = base64ToUint8(archiveFile.iv);
  const ciphertext = base64ToUint8(archiveFile.ciphertext);

  const key = await deriveAesKey(passphrase, salt);

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as any },
      key,
      ciphertext as any
    );
  } catch (err) {
    throw new Error("Incorrect archive passphrase or corrupted archive file. Decryption failed.");
  }

  const decoder = new TextDecoder();
  const decryptedJson = decoder.decode(decryptedBuffer);

  const payload: ArchivePayloadData = JSON.parse(decryptedJson);

  // Integrity Check: Verify manifest checksum matches decrypted records
  const contentForChecksum = JSON.stringify({
    orders: payload.orders,
    orderItems: payload.orderItems,
    invoices: payload.invoices,
    settlements: payload.settlements,
  });

  const verifiedChecksum = await computeSha256Hex(contentForChecksum);
  if (verifiedChecksum !== payload.manifest.checksumSha256) {
    throw new Error(
      "Cryptographic integrity check failed. The archive contents do not match the signed manifest checksum."
    );
  }

  return payload;
}
