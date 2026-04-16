// Manually sign a license — useful for founder comps, test customers,
// team licenses, or replacing a lost key without Stripe.
//
// Usage:
//   VOXLEN_LICENSE_PRIVKEY=<hex> \
//     npm run sign -- --tier pro --email user@example.com --expires 2026-12-31
//
//   VOXLEN_LICENSE_PRIVKEY=<hex> \
//     npm run sign -- --tier lifetime --email user@example.com

import { createLicense, type Tier } from "./license.js";

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  const v = process.argv[i + 1];
  return v ?? null;
}

const tier = arg("--tier") as Tier | null;
const email = arg("--email");
const expiresStr = arg("--expires");

if (!tier || !email) {
  console.error("Usage: npm run sign -- --tier <pro|professional|lifetime> --email <addr> [--expires YYYY-MM-DD]");
  process.exit(1);
}

if (tier === "free") {
  console.error("Cannot sign a Free-tier license — Free is the default.");
  process.exit(1);
}

const privateKeyHex = process.env.VOXLEN_LICENSE_PRIVKEY;
if (!privateKeyHex) {
  console.error("VOXLEN_LICENSE_PRIVKEY env var is required.");
  process.exit(1);
}

const expires: Date | null = expiresStr ? new Date(expiresStr) : null;
if (expires && Number.isNaN(expires.getTime())) {
  console.error(`Invalid --expires value: ${expiresStr}`);
  process.exit(1);
}

const { payload, key } = createLicense(
  { tier, email, expires },
  privateKeyHex,
);

console.log("Issued license:");
console.log(JSON.stringify(payload, null, 2));
console.log();
console.log("License key (give this to the customer):");
console.log(key);
