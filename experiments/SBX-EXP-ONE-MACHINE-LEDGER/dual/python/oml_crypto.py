"""OML crypto — domain-separated hashes + Ed25519, matching src/crypto.mjs."""

from __future__ import annotations

import base64
import hashlib
import re

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, load_der_public_key

from oml_canonical import canonicalize

PROTOCOL = "oml/v0"
SIG_DOMAIN = b"OML-SIGNATURE-V0\0"
OBJ_DOMAIN = "OML-OBJECT-V0"
B64_RE = re.compile(r"^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_prefixed(data: bytes) -> str:
    return f"sha256:{sha256_hex(data)}"


def hash_canonical(value, domain: str = OBJ_DOMAIN) -> str:
    payload = f"{domain}\0{canonicalize(value)}".encode("utf-8")
    return sha256_prefixed(payload)


def strict_base64_decode(value: str, expected_length: int | None = None) -> bytes:
    if not isinstance(value, str) or not value:
        raise TypeError("invalid base64")
    if not B64_RE.match(value):
        raise TypeError("non-canonical base64")
    decoded = base64.b64decode(value, validate=True)
    if base64.b64encode(decoded).decode("ascii") != value:
        raise TypeError("non-canonical base64")
    if expected_length is not None and len(decoded) != expected_length:
        raise TypeError(f"expected {expected_length} bytes")
    return decoded


def public_key_id(spki_b64: str) -> str:
    return sha256_prefixed(strict_base64_decode(spki_b64, 44))


def verify_canonical(value, signature_b64: str, public_key_spki_b64: str) -> bool:
    signature = strict_base64_decode(signature_b64, 64)
    spki = strict_base64_decode(public_key_spki_b64, 44)
    key = load_der_public_key(spki)
    if not isinstance(key, Ed25519PublicKey):
        raise TypeError("public key: Ed25519 required")
    message = SIG_DOMAIN + canonicalize(value).encode("utf-8")
    try:
        key.verify(signature, message)
        return True
    except Exception:
        return False
