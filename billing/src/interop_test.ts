// Interop self-check. Runs in pure Node — no Rust required — and also
// writes a fixture file that a Rust-side integration test can load to
// confirm byte-for-byte compatibility with src-tauri/src/license.rs.

import {
  verify as cryptoVerify,
  createPublicKey,
} from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLicense, generateKeypair, signLicense } from "./license.js";

function pubKeyFromRawHex(hex: string) {
  const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
  const full = Buffer.concat([spkiPrefix, Buffer.from(hex, "hex")]);
  return createPublicKey({ key: full, format: "der", type: "spki" });
}

function verify(license: string, publicKeyHex: string): boolean {
  if (!license.startsWith("VOXLEN-")) return false;
  const body = license.slice("VOXLEN-".length);
  const dot = body.indexOf(".");
  if (dot < 0) return false;
  const payload = Buffer.from(body.slice(0, dot), "base64url");
  const signature = Buffer.from(body.slice(dot + 1), "base64url");
  const key = pubKeyFromRawHex(publicKeyHex);
  return cryptoVerify(null, payload, key, signature);
}

function main() {
  console.log("== Voxlen license interop self-check ==");

  const { privateKeyHex, publicKeyHex } = generateKeypair();
  console.log(`pub : ${publicKeyHex}`);

  const { payload, key } = createLicense(
    { tier: "pro", email: "ceo@example.com", expires: null },
    privateKeyHex,
  );
  console.log(`key : ${key}`);
  console.log(`len : ${key.length} bytes`);

  const ok = verify(key, publicKeyHex);
  if (!ok) {
    console.error("FAIL: Node-side self-verify failed");
    process.exit(1);
  }
  console.log("Node-side self-verify: OK");

  // Tamper with payload → must fail.
  const tampered = key.replace("pro", "pro").replace(/.$/, (c) => (c === "A" ? "B" : "A"));
  if (verify(tampered, publicKeyHex)) {
    console.error("FAIL: tampered license verified as valid");
    process.exit(1);
  }
  console.log("Tamper detection: OK");

  // Write a fixture file the Rust test can read.
  const here = dirname(fileURLToPath(import.meta.url));
  const fixtureDir = join(here, "..", "..", "src-tauri", "tests", "fixtures");
  mkdirSync(fixtureDir, { recursive: true });
  const fixturePath = join(fixtureDir, "license_fixture.json");
  writeFileSync(
    fixturePath,
    JSON.stringify({ publicKeyHex, license: key, payload }, null, 2),
  );
  console.log(`Wrote fixture: ${fixturePath}`);

  // Also a bad signature so the Rust side can confirm it rejects forgeries.
  const forgedKey = signLicense(
    { ...payload, tier: "lifetime" },
    generateKeypair().privateKeyHex, // different key
  );
  writeFileSync(
    join(fixtureDir, "license_forged_fixture.json"),
    JSON.stringify({ publicKeyHex, license: forgedKey }, null, 2),
  );
  console.log("Wrote forged-license fixture.");
  console.log("All checks passed.");
}

main();
