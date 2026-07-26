import { createHash } from "node:crypto";
import { canonicalBytes } from "./canonical.mjs";
import { invariant } from "./errors.mjs";

export function hash(domain, value) {
  invariant(
    typeof domain === "string" && domain.length > 0,
    "ERR_DOMAIN_REGISTRY",
    "hash domain must be a non-empty string",
  );
  return createHash("sha256")
    .update(Buffer.from(domain, "utf8"))
    .update(Buffer.from([0]))
    .update(canonicalBytes(value))
    .digest("hex");
}

export function rootId(prefix, domain, value) {
  invariant(
    /^[A-Z][A-Z0-9-]*$/.test(prefix),
    "ERR_ID_PREIMAGE",
    `invalid ID prefix ${prefix}`,
  );
  return `${prefix}-${hash(domain, value)}`;
}
