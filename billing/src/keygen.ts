// Generate a fresh Ed25519 keypair for Voxlen license signing.
//
// Run once. Store the private key in your billing host's secret manager
// as VOXLEN_LICENSE_PRIVKEY. Embed the public key into the desktop build
// via VOXLEN_LICENSE_PUBKEY at `cargo tauri build` time.
//
//   npm run keygen

import { generateKeypair } from "./license.js";

const { privateKeyHex, publicKeyHex } = generateKeypair();

console.log("Voxlen license keypair generated.");
console.log();
console.log("Private key (store in billing host secrets as VOXLEN_LICENSE_PRIVKEY):");
console.log(`  ${privateKeyHex}`);
console.log();
console.log("Public key (embed in desktop build via VOXLEN_LICENSE_PUBKEY):");
console.log(`  ${publicKeyHex}`);
console.log();
console.log(
  "Copy the public key into the VOXLEN_LICENSE_PUBKEY env var used by",
);
console.log(
  "`cargo tauri build`. The private key MUST stay on your server only —",
);
console.log(
  "anyone who obtains it can mint licenses.",
);
