import { base64ToBytes, bytesToBase64 } from "../encoding/base64";

type EncryptedPayload = {
  v: 1;
  alg: "AES-GCM";
  kdf: "PBKDF2";
  iter: number;
  saltB64: string;
  ivB64: string;
  ctB64: string;
};

const PBKDF2_ITER = 250_000;

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(password: string, value: unknown): Promise<EncryptedPayload> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await deriveKey(password, salt, PBKDF2_ITER);
  const pt = new TextEncoder().encode(JSON.stringify(value));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt));

  return {
    v: 1,
    alg: "AES-GCM",
    kdf: "PBKDF2",
    iter: PBKDF2_ITER,
    saltB64: bytesToBase64(salt),
    ivB64: bytesToBase64(iv),
    ctB64: bytesToBase64(ct),
  };
}

export async function decryptJson<T>(password: string, payload: EncryptedPayload): Promise<T> {
  if (payload.v !== 1 || payload.alg !== "AES-GCM" || payload.kdf !== "PBKDF2") {
    throw new Error("Unsupported vault format");
  }
  const salt = base64ToBytes(payload.saltB64);
  const iv = base64ToBytes(payload.ivB64);
  const ct = base64ToBytes(payload.ctB64);
  const key = await deriveKey(password, salt, payload.iter);
  const pt = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      key,
      ct as unknown as BufferSource,
    ),
  );
  const json = new TextDecoder().decode(pt);
  return JSON.parse(json) as T;
}

export async function mnemonicFingerprint(mnemonic: string): Promise<string> {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, " ");
  return sha256Hex(normalized);
}

export type { EncryptedPayload };

