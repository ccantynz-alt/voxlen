// Ed25519 license signing for Voxlen.
//
// Payload format matches src-tauri/src/license.rs::LicensePayload exactly.
// Any drift between these files will cause the desktop app to reject
// licenses.

import { createPrivateKey, sign as cryptoSign, generateKeyPairSync } from "node:crypto";
import { randomUUID } from "node:crypto";

export type Tier = "free" | "pro" | "professional" | "lifetime";

export interface LicensePayload {
  tier: Tier;
  email: string;
  issued: number;
  expires: number | null;
  id: string;
}

const PREFIX = "VOXLEN-";

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** Decode a 32-byte hex string into raw Ed25519 seed bytes. */
function seedFromHex(hex: string): Buffer {
  const trimmed = hex.trim().replace(/^0x/, "");
  if (trimmed.length !== 64) {
    throw new Error(
      `Ed25519 private key seed must be 32 bytes (64 hex chars); got ${trimmed.length} chars`,
    );
  }
  return Buffer.from(trimmed, "hex");
}

/**
 * Wrap a 32-byte Ed25519 seed into a PKCS#8 DER structure that Node's
 * crypto module will accept. Saves us a dependency on `tweetnacl` or
 * similar when the Node runtime already supports Ed25519.
 */
function pkcs8FromSeed(seed: Buffer): Buffer {
  // PKCS#8 PrivateKeyInfo for Ed25519:
  // 30 2e                          SEQUENCE, len 46
  //   02 01 00                       INTEGER 0 (version)
  //   30 05                          SEQUENCE, len 5 (AlgorithmIdentifier)
  //     06 03 2b 65 70                 OID 1.3.101.112 (Ed25519)
  //   04 22                          OCTET STRING, len 34
  //     04 20 <32-byte-seed>           OCTET STRING, len 32, seed
  if (seed.length !== 32) throw new Error("seed must be 32 bytes");
  const prefix = Buffer.from(
    "302e020100300506032b657004220420",
    "hex",
  );
  return Buffer.concat([prefix, seed]);
}

/** Sign a LicensePayload and return a `VOXLEN-<b64>.<b64>` string. */
export function signLicense(payload: LicensePayload, privateKeyHex: string): string {
  const json = Buffer.from(JSON.stringify(payload), "utf8");
  const seed = seedFromHex(privateKeyHex);
  const key = createPrivateKey({
    key: pkcs8FromSeed(seed),
    format: "der",
    type: "pkcs8",
  });
  // Node's crypto.sign expects null algorithm for Ed25519.
  const signature = cryptoSign(null, json, key);
  return `${PREFIX}${b64url(json)}.${b64url(signature)}`;
}

export interface CreateLicenseOpts {
  tier: Exclude<Tier, "free">;
  email: string;
  /** ISO string or Date for expiry. Omit for perpetual (Lifetime). */
  expires?: Date | string | null;
}

/** High-level helper: stamp issued/id and sign. */
export function createLicense(opts: CreateLicenseOpts, privateKeyHex: string): {
  payload: LicensePayload;
  key: string;
} {
  const issued = Math.floor(Date.now() / 1000);
  let expires: number | null = null;
  if (opts.expires != null) {
    const d = typeof opts.expires === "string" ? new Date(opts.expires) : opts.expires;
    if (Number.isNaN(d.getTime())) throw new Error("invalid expires date");
    expires = Math.floor(d.getTime() / 1000);
  }
  const payload: LicensePayload = {
    tier: opts.tier,
    email: opts.email,
    issued,
    expires,
    id: randomUUID(),
  };
  return { payload, key: signLicense(payload, privateKeyHex) };
}

/** Generate a fresh Ed25519 keypair and return hex encodings. */
export function generateKeypair(): { privateKeyHex: string; publicKeyHex: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  // DER SubjectPublicKeyInfo for Ed25519 ends with the 32-byte raw key.
  const pubDer = publicKey.export({ format: "der", type: "spki" });
  const pubRaw = pubDer.subarray(pubDer.length - 32);
  const privDer = privateKey.export({ format: "der", type: "pkcs8" });
  const privRaw = privDer.subarray(privDer.length - 32);
  return {
    privateKeyHex: privRaw.toString("hex"),
    publicKeyHex: pubRaw.toString("hex"),
  };
}
