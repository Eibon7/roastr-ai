import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { decryptPersona } from "../src/shared/persona-decrypt.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SECRET = "test-secret-32-characters-long!!";

function encrypt(plaintext: string): Buffer {
  const key = scryptSync(SECRET, "roastr-token-salt", KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

describe("decryptPersona", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv, TOKEN_ENCRYPTION_KEY: SECRET };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("retorna null si el ciphertext es null", () => {
    expect(decryptPersona(null)).toBeNull();
  });

  it("retorna null si el ciphertext es undefined", () => {
    expect(decryptPersona(undefined)).toBeNull();
  });

  it("retorna null si el ciphertext está vacío", () => {
    expect(decryptPersona(Buffer.alloc(0))).toBeNull();
  });

  it("desencripta y parsea un PersonaProfile válido", () => {
    const profile = { identities: ["dev"], redLines: ["insultos"], tolerances: ["sarcasmo"] };
    const cipher = encrypt(JSON.stringify(profile));
    expect(decryptPersona(cipher)).toEqual(profile);
  });

  it("acepta un Uint8Array además de Buffer", () => {
    const profile = { identities: [], redLines: [], tolerances: [] };
    const cipher = encrypt(JSON.stringify(profile));
    const view = new Uint8Array(cipher);
    expect(decryptPersona(view)).toEqual(profile);
  });

  it("retorna null si el desencriptado falla (ciphertext corrupto)", () => {
    const cipher = encrypt(JSON.stringify({ identities: [], redLines: [], tolerances: [] }));
    // Corromper el auth tag para que falle la verificación GCM
    cipher[IV_LENGTH] ^= 0xff;
    expect(decryptPersona(cipher)).toBeNull();
  });

  it("retorna null si el JSON desencriptado es inválido", () => {
    const cipher = encrypt("{not valid json");
    expect(decryptPersona(cipher)).toBeNull();
  });

  it("retorna null si el objeto parseado no tiene la forma de PersonaProfile (campos faltantes)", () => {
    const cipher = encrypt(JSON.stringify({ identities: ["dev"] }));
    expect(decryptPersona(cipher)).toBeNull();
  });

  it("retorna null si algún campo no es un array de strings", () => {
    const cipher = encrypt(JSON.stringify({ identities: "dev", redLines: [], tolerances: [] }));
    expect(decryptPersona(cipher)).toBeNull();
  });

  it("retorna null si el JSON parsea a un valor no-objeto (ej. un número)", () => {
    const cipher = encrypt("42");
    expect(decryptPersona(cipher)).toBeNull();
  });
});
