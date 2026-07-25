"""Deterministic JSON encoding and sha256 helpers."""

from __future__ import annotations

from collections.abc import Mapping
import hashlib
import json
import math
from typing import Any

from .types import ValidationError


def _normalize_json(value: Any, path: str = "$") -> Any:
    """Validate the JSON subset and detach it from caller-owned containers."""

    if value is None or isinstance(value, (str, bool)):
        return value
    if type(value) is int:
        return value
    if type(value) is float:
        if not math.isfinite(value):
            raise ValidationError(f"{path} contains NaN or infinity")
        return value
    if isinstance(value, Mapping):
        normalized: dict[str, Any] = {}
        for key, child in value.items():
            if not isinstance(key, str):
                raise ValidationError(f"{path} contains a non-string object key")
            normalized[key] = _normalize_json(child, f"{path}.{key}")
        return normalized
    if isinstance(value, (list, tuple)):
        return [
            _normalize_json(child, f"{path}[{index}]")
            for index, child in enumerate(value)
        ]
    raise ValidationError(
        f"{path} contains unsupported JSON value {type(value).__name__}"
    )


def canonical_json_bytes(value: Any) -> bytes:
    """Encode a JSON value with sorted keys, compact separators, and UTF-8.

    Non-finite numbers, non-string object keys, and non-JSON Python values are
    rejected instead of being silently coerced.
    """

    try:
        normalized = _normalize_json(value)
        text = json.dumps(
            normalized,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        return text.encode("utf-8")
    except ValidationError:
        raise
    except (RecursionError, TypeError, ValueError, UnicodeError) as exc:
        raise ValidationError(f"value cannot be encoded as canonical JSON: {exc}") from exc


def sha256_hex(data: bytes | bytearray | memoryview) -> str:
    """Return the lowercase sha256 digest of raw bytes."""

    if not isinstance(data, (bytes, bytearray, memoryview)):
        raise ValidationError("sha256 input must be bytes-like")
    return hashlib.sha256(bytes(data)).hexdigest()


def hash_bytes(data: bytes | bytearray | memoryview) -> str:
    """Alias with a domain-readable name for content hashing."""

    return sha256_hex(data)


def canonical_json_hash(value: Any) -> str:
    """Hash the canonical JSON encoding of ``value``."""

    return sha256_hex(canonical_json_bytes(value))


# A short alias is useful at ledger call sites and retains one implementation.
hash_json = canonical_json_hash
