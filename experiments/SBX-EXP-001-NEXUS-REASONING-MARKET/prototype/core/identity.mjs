import {
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";

import { canonicalBytes } from "./canonical.mjs";
import { fail, invariant } from "./errors.mjs";
import { hash } from "./hash.mjs";
import {
  assertCanonicalToken,
  assertExactObjectKeys,
} from "./schema.mjs";

export const HYBRID_AUTH_SCHEME = "HYBRID_ED25519_ML_DSA_65_V1";
export const HYBRID_SIGNED_MESSAGE_SCHEMA =
  "nexus-hybrid-auth-signed-message-v2";
export const ML_DSA_65_NODE_CONTEXT =
  "NEXUS_HYBRID_AUTH_ML_DSA_65_CONTEXT_V1";

export const HYBRID_AUTH_FIELDS = Object.freeze([
  "scheme",
  "key_id",
  "controller_id",
  "signed_domain",
  "signed_payload_root",
  "ed25519_signature_base64url",
  "ml_dsa_65_signature_base64url",
]);

const VERIFIED_AUTH_REFERENCE_FIELDS = Object.freeze([
  "schema",
  "scheme",
  "key_id",
  "controller_id",
  "signed_domain",
  "signed_payload_root",
]);

const ED25519_SPKI_BYTES = 44;
const ED25519_SIGNATURE_BYTES = 64;
const ED25519_SPKI_PREFIX = Buffer.from(
  "302a300506032b6570032100",
  "hex",
);
const ML_DSA_65_SPKI_BYTES = 1974;
const ML_DSA_65_SIGNATURE_BYTES = 3309;
const ML_DSA_65_SPKI_PREFIX = Buffer.from(
  "308207b2300b0609608648016503040312038207a100",
  "hex",
);
const ROOT_PATTERN = /^[0-9a-f]{64}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function assertNodeVersion() {
  const [major, minor] = process.versions.node
    .split(".")
    .map((part) => Number(part));
  invariant(
    major > 24 || (major === 24 && minor >= 8),
    "ERR_AUTHORITY",
    "hybrid identity requires Node.js 24.8 or newer",
  );
}

function decodeBase64url(value, label, expectedBytes = null) {
  invariant(
    typeof value === "string" &&
      value.length > 0 &&
      BASE64URL_PATTERN.test(value) &&
      !value.includes("="),
    "ERR_SCHEMA",
    `${label} must be canonical unpadded base64url`,
  );
  const decoded = Buffer.from(value, "base64url");
  invariant(
    decoded.toString("base64url") === value,
    "ERR_SCHEMA",
    `${label} is not canonical base64url`,
  );
  invariant(
    expectedBytes === null || decoded.length === expectedBytes,
    "ERR_SCHEMA",
    `${label} has the wrong byte length`,
  );
  return decoded;
}

function publicKeyFromEncoding(
  value,
  {
    label,
    expectedBytes,
    expectedPrefix,
    expectedType,
  },
) {
  const der = decodeBase64url(value, label, expectedBytes);
  invariant(
    der.subarray(0, expectedPrefix.length).equals(expectedPrefix),
    "ERR_AUTHORITY",
    `${label} has the wrong SPKI algorithm OID`,
  );
  let key;
  try {
    key = createPublicKey({
      key: der,
      format: "der",
      type: "spki",
    });
  } catch {
    fail("ERR_AUTHORITY", `${label} is not a valid SPKI DER public key`);
  }
  invariant(
    key.asymmetricKeyType === expectedType &&
      key.export({ format: "der", type: "spki" }).equals(der),
    "ERR_AUTHORITY",
    `${label} has the wrong key type or non-exact encoding`,
  );
  return key;
}

function publicKeyPair(value) {
  invariant(
    value !== null && typeof value === "object",
    "ERR_SCHEMA",
    "hybrid public key pair is required",
  );
  invariant(
    value.scheme === HYBRID_AUTH_SCHEME,
    "ERR_AUTHORITY",
    "authoritative identity requires the mandatory hybrid scheme",
  );
  const ed25519PublicKey = publicKeyFromEncoding(
    value.ed25519_public_key_spki_der_base64url,
    {
      label: "Ed25519 public key",
      expectedBytes: ED25519_SPKI_BYTES,
      expectedPrefix: ED25519_SPKI_PREFIX,
      expectedType: "ed25519",
    },
  );
  const mlDsa65PublicKey = publicKeyFromEncoding(
    value.ml_dsa_65_public_key_spki_der_base64url,
    {
      label: "ML-DSA-65 public key",
      expectedBytes: ML_DSA_65_SPKI_BYTES,
      expectedPrefix: ML_DSA_65_SPKI_PREFIX,
      expectedType: "ml-dsa-65",
    },
  );
  return { ed25519PublicKey, mlDsa65PublicKey };
}

export function deriveHybridKeyId({
  scheme,
  ed25519_public_key_spki_der_base64url,
  ml_dsa_65_public_key_spki_der_base64url,
}) {
  assertNodeVersion();
  publicKeyPair({
    scheme,
    ed25519_public_key_spki_der_base64url,
    ml_dsa_65_public_key_spki_der_base64url,
  });
  return `HYBRIDKEY-${hash("NEXUS_HYBRID_AUTH_KEY_ID_V1", {
    schema: "nexus-hybrid-auth-public-key-pair-v1",
    scheme,
    ed25519_public_key_spki_der_base64url,
    ml_dsa_65_public_key_spki_der_base64url,
  })}`;
}

export function assertHybridControllerPublicIdentity(controller) {
  invariant(
    controller !== null && typeof controller === "object",
    "ERR_AUTHORITY",
    "hybrid controller is missing",
  );
  assertCanonicalToken(controller.controller_id, "controller ID", 128);
  assertCanonicalToken(controller.key_id, "hybrid key ID", 128);
  publicKeyPair(controller);
  invariant(
    controller.key_id === deriveHybridKeyId(controller),
    "ERR_AUTHORITY",
    "hybrid key ID does not bind the exact public-key pair",
  );
  return controller;
}

export function hybridSignedMessage({
  signedDomain,
  controllerId,
  keyId,
  signedPayloadRoot,
}) {
  assertCanonicalToken(signedDomain, "hybrid signed domain", 256);
  assertCanonicalToken(controllerId, "hybrid controller ID", 128);
  assertCanonicalToken(keyId, "hybrid key ID", 128);
  invariant(
    typeof signedPayloadRoot === "string" &&
      ROOT_PATTERN.test(signedPayloadRoot),
    "ERR_SCHEMA",
    "hybrid signed payload root must be a lowercase SHA-256 root",
  );
  return {
    schema: HYBRID_SIGNED_MESSAGE_SCHEMA,
    scheme: HYBRID_AUTH_SCHEME,
    signed_domain: signedDomain,
    controller_id: controllerId,
    key_id: keyId,
    signed_payload_root: signedPayloadRoot,
  };
}

export function hybridSignedMessageBytes(request) {
  return canonicalBytes(hybridSignedMessage(request));
}

export function assertHybridAuthenticationShape(authentication) {
  assertExactObjectKeys(
    authentication,
    HYBRID_AUTH_FIELDS,
    [],
    "hybrid authentication",
  );
  invariant(
    authentication.scheme === HYBRID_AUTH_SCHEME,
    "ERR_AUTHORITY",
    "legacy, single-algorithm, and unknown authentication schemes are forbidden",
  );
  assertCanonicalToken(
    authentication.key_id,
    "hybrid authentication key ID",
    128,
  );
  assertCanonicalToken(
    authentication.controller_id,
    "hybrid authentication controller ID",
    128,
  );
  assertCanonicalToken(
    authentication.signed_domain,
    "hybrid authentication signed domain",
    256,
  );
  invariant(
    typeof authentication.signed_payload_root === "string" &&
      ROOT_PATTERN.test(authentication.signed_payload_root),
    "ERR_SCHEMA",
    "hybrid authentication payload root is invalid",
  );
  decodeBase64url(
    authentication.ed25519_signature_base64url,
    "Ed25519 signature",
    ED25519_SIGNATURE_BYTES,
  );
  decodeBase64url(
    authentication.ml_dsa_65_signature_base64url,
    "ML-DSA-65 signature",
    ML_DSA_65_SIGNATURE_BYTES,
  );
  return authentication;
}

export function verifiedHybridAuthenticationReference(authentication) {
  assertHybridAuthenticationShape(authentication);
  return {
    schema: "nexus-verified-hybrid-auth-reference-v1",
    scheme: authentication.scheme,
    key_id: authentication.key_id,
    controller_id: authentication.controller_id,
    signed_domain: authentication.signed_domain,
    signed_payload_root: authentication.signed_payload_root,
  };
}

export function assertVerifiedHybridAuthenticationReference(reference) {
  assertExactObjectKeys(
    reference,
    VERIFIED_AUTH_REFERENCE_FIELDS,
    [],
    "verified hybrid authentication reference",
  );
  invariant(
    reference.schema === "nexus-verified-hybrid-auth-reference-v1" &&
      reference.scheme === HYBRID_AUTH_SCHEME,
    "ERR_AUTHORITY",
    "verified authentication reference is not the mandatory hybrid profile",
  );
  assertCanonicalToken(reference.key_id, "verified hybrid key ID", 128);
  assertCanonicalToken(
    reference.controller_id,
    "verified hybrid controller ID",
    128,
  );
  assertCanonicalToken(
    reference.signed_domain,
    "verified hybrid signed domain",
    256,
  );
  invariant(
    typeof reference.signed_payload_root === "string" &&
      ROOT_PATTERN.test(reference.signed_payload_root),
    "ERR_SCHEMA",
    "verified hybrid signed payload root is invalid",
  );
  return reference;
}

function privateKeyFromEncoding(value, label, expectedType) {
  const der = decodeBase64url(value, label);
  let key;
  try {
    key = createPrivateKey({
      key: der,
      format: "der",
      type: "pkcs8",
    });
  } catch {
    fail("ERR_AUTHORITY", `${label} is not a valid PKCS8 DER private key`);
  }
  invariant(
    key.asymmetricKeyType === expectedType,
    "ERR_AUTHORITY",
    `${label} has the wrong key type`,
  );
  return key;
}

export function signHybridAuthentication({
  controller,
  signedDomain,
  signedPayloadRoot,
  privateKeyPair,
  mlDsaContext = ML_DSA_65_NODE_CONTEXT,
}) {
  assertNodeVersion();
  assertHybridControllerPublicIdentity(controller);
  assertExactObjectKeys(
    privateKeyPair,
    [
      "ed25519_private_key_pkcs8_der_base64url",
      "ml_dsa_65_private_key_pkcs8_der_base64url",
    ],
    [],
    "hybrid private key pair",
  );
  invariant(
    mlDsaContext === ML_DSA_65_NODE_CONTEXT,
    "ERR_AUTHORITY",
    "ML-DSA-65 signing context is not the fixed hybrid profile context",
  );
  const ed25519PrivateKey = privateKeyFromEncoding(
    privateKeyPair.ed25519_private_key_pkcs8_der_base64url,
    "Ed25519 private key",
    "ed25519",
  );
  const mlDsa65PrivateKey = privateKeyFromEncoding(
    privateKeyPair.ml_dsa_65_private_key_pkcs8_der_base64url,
    "ML-DSA-65 private key",
    "ml-dsa-65",
  );
  const ed25519PublicEncoding = createPublicKey(ed25519PrivateKey)
    .export({ format: "der", type: "spki" })
    .toString("base64url");
  const mlDsa65PublicEncoding = createPublicKey(mlDsa65PrivateKey)
    .export({ format: "der", type: "spki" })
    .toString("base64url");
  invariant(
    ed25519PublicEncoding ===
      controller.ed25519_public_key_spki_der_base64url &&
      mlDsa65PublicEncoding ===
        controller.ml_dsa_65_public_key_spki_der_base64url,
    "ERR_AUTHORITY",
    "private signing pair does not match the controller public pair",
  );
  const message = hybridSignedMessageBytes({
    signedDomain,
    controllerId: controller.controller_id,
    keyId: controller.key_id,
    signedPayloadRoot,
  });
  return {
    scheme: HYBRID_AUTH_SCHEME,
    key_id: controller.key_id,
    controller_id: controller.controller_id,
    signed_domain: signedDomain,
    signed_payload_root: signedPayloadRoot,
    ed25519_signature_base64url: sign(
      null,
      message,
      ed25519PrivateKey,
    ).toString("base64url"),
    ml_dsa_65_signature_base64url: sign(null, message, {
      key: mlDsa65PrivateKey,
      context: Buffer.from(ML_DSA_65_NODE_CONTEXT, "ascii"),
    }).toString("base64url"),
  };
}

export function verifyHybridAuthentication({
  controller,
  authentication,
  signedDomain,
  signedPayloadRoot,
}) {
  assertNodeVersion();
  assertHybridControllerPublicIdentity(controller);
  assertHybridAuthenticationShape(authentication);
  invariant(
    authentication.controller_id === controller.controller_id &&
      authentication.key_id === controller.key_id &&
      authentication.signed_domain === signedDomain &&
      authentication.signed_payload_root === signedPayloadRoot,
    "ERR_AUTHORITY",
    "hybrid authentication references or signed preimage are not exact",
  );
  const { ed25519PublicKey, mlDsa65PublicKey } = publicKeyPair(controller);
  const message = hybridSignedMessageBytes({
    signedDomain,
    controllerId: controller.controller_id,
    keyId: controller.key_id,
    signedPayloadRoot,
  });
  const ed25519Signature = decodeBase64url(
    authentication.ed25519_signature_base64url,
    "Ed25519 signature",
    ED25519_SIGNATURE_BYTES,
  );
  const mlDsa65Signature = decodeBase64url(
    authentication.ml_dsa_65_signature_base64url,
    "ML-DSA-65 signature",
    ML_DSA_65_SIGNATURE_BYTES,
  );
  let ed25519Valid = false;
  let mlDsa65Valid = false;
  try {
    ed25519Valid = verify(
      null,
      message,
      ed25519PublicKey,
      ed25519Signature,
    );
    mlDsa65Valid = verify(
      null,
      message,
      {
        key: mlDsa65PublicKey,
        context: Buffer.from(ML_DSA_65_NODE_CONTEXT, "ascii"),
      },
      mlDsa65Signature,
    );
  } catch {
    fail("ERR_AUTHORITY", "hybrid signature verification failed");
  }
  invariant(
    ed25519Valid && mlDsa65Valid,
    "ERR_AUTHORITY",
    "both Ed25519 and ML-DSA-65 signatures must verify",
  );
  return authentication;
}
