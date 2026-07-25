import { createHash, generateKeyPairSync, sign, verify, createPrivateKey, createPublicKey } from 'node:crypto';
import { canonicalize } from './canonical.mjs';

export const PROTOCOL = 'oml/v0';
const SIG_DOMAIN = Buffer.from('OML-SIGNATURE-V0\0', 'utf8');
const OBJ_DOMAIN = 'OML-OBJECT-V0';

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256Prefixed(bytes) {
  return `sha256:${sha256Hex(bytes)}`;
}

export function hashCanonical(value, domain = OBJ_DOMAIN) {
  return sha256Prefixed(Buffer.from(`${domain}\0${canonicalize(value)}`, 'utf8'));
}

export function strictBase64Decode(value, expectedLength = null) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError('invalid base64');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new TypeError('non-canonical base64');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) throw new TypeError('non-canonical base64');
  if (expectedLength !== null && decoded.length !== expectedLength) {
    throw new TypeError(`expected ${expectedLength} bytes`);
  }
  return decoded;
}

function assertEd25519(key, label) {
  if (key.asymmetricKeyType !== 'ed25519') throw new TypeError(`${label}: Ed25519 required`);
  return key;
}

export function generateIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  return {
    public_key_spki_b64: spki,
    private_key_pkcs8_b64: pkcs8,
    key_id: sha256Prefixed(Buffer.from(spki, 'base64')),
  };
}

/** Deterministic Ed25519 identity from any string label (fixture / demo stability). */
export function identityFromLabel(label) {
  if (typeof label !== 'string' || label.length === 0) throw new TypeError('label required');
  const seed = createHash('sha256').update(`OML-SEED-V0\0${label}`, 'utf8').digest();
  // PKCS#8 wrapper for a 32-byte Ed25519 seed (RFC 8410)
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
  const privateKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey(privateKey);
  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const pkcs8B64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  return {
    public_key_spki_b64: spki,
    private_key_pkcs8_b64: pkcs8B64,
    key_id: sha256Prefixed(Buffer.from(spki, 'base64')),
    label,
  };
}

export function publicKeyId(spkiB64) {
  return sha256Prefixed(strictBase64Decode(spkiB64, 44));
}

function signedBytes(value) {
  return Buffer.concat([SIG_DOMAIN, Buffer.from(canonicalize(value), 'utf8')]);
}

export function signCanonical(value, privateKeyPkcs8B64) {
  const key = assertEd25519(
    createPrivateKey({ key: strictBase64Decode(privateKeyPkcs8B64), type: 'pkcs8', format: 'der' }),
    'private key',
  );
  return sign(null, signedBytes(value), key).toString('base64');
}

export function verifyCanonical(value, signatureB64, publicKeySpkiB64) {
  const signature = strictBase64Decode(signatureB64, 64);
  const key = assertEd25519(
    createPublicKey({ key: strictBase64Decode(publicKeySpkiB64, 44), type: 'spki', format: 'der' }),
    'public key',
  );
  return verify(null, signedBytes(value), key, signature);
}
