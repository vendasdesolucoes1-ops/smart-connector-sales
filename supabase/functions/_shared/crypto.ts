// AES-256-GCM encryption utilities using Web Crypto API (Deno-native)

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  const rawKey = hexToBytes(keyHex);
  return crypto.subtle.importKey("raw", rawKey.buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encrypt(text: string, keyHex: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await importKey(keyHex);
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded);
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ciphertext))}`;
}

export async function decrypt(encryptedText: string, keyHex: string): Promise<string> {
  const [ivHex, ciphertextHex] = encryptedText.split(":");
  if (!ivHex || !ciphertextHex) throw new Error("Invalid encrypted format");
  const iv = hexToBytes(ivHex);
  const ciphertext = hexToBytes(ciphertextHex);
  const cryptoKey = await importKey(keyHex);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, cryptoKey, ciphertext.buffer as ArrayBuffer);
  return new TextDecoder().decode(decrypted);
}
