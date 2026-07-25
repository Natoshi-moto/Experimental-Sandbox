"""OML CF-CJSON-0 style canonical JSON — must match src/canonical.mjs byte-for-byte."""

from __future__ import annotations

DEFAULT_LIMITS = {
    "max_depth": 32,
    "max_nodes": 50_000,
    "max_collection_length": 4096,
    "max_string_code_units": 100_000,
}


class CanonicalError(TypeError):
    pass


def _has_unpaired_surrogate(value: str) -> bool:
    i = 0
    while i < len(value):
        c = ord(value[i])
        if 0xD800 <= c <= 0xDBFF:
            if i + 1 >= len(value):
                return True
            n = ord(value[i + 1])
            if not (0xDC00 <= n <= 0xDFFF):
                return True
            i += 2
        elif 0xDC00 <= c <= 0xDFFF:
            return True
        else:
            i += 1
    return False


def _encode(value, path: str, depth: int, state: dict, limits: dict) -> str:
    state["nodes"] += 1
    if state["nodes"] > limits["max_nodes"]:
        raise CanonicalError("$: node limit exceeded")
    if depth > limits["max_depth"]:
        raise CanonicalError(f"{path}: depth exceeded")

    if value is None or isinstance(value, bool):
        return "true" if value is True else "false" if value is False else "null"

    if isinstance(value, str):
        if len(value) > limits["max_string_code_units"]:
            raise CanonicalError(f"{path}: string too long")
        if _has_unpaired_surrogate(value):
            raise CanonicalError(f"{path}: unpaired surrogate")
        # JSON string encoding compatible with JSON.stringify for BMP-safe text
        import json

        return json.dumps(value, ensure_ascii=False)

    if isinstance(value, int) and not isinstance(value, bool):
        if abs(value) > 9007199254740991:  # Number.MAX_SAFE_INTEGER
            raise CanonicalError(f"{path}: only safe integers (not -0)")
        # Python has no -0 int; reject float -0 separately if ever passed as float
        return str(value)

    if isinstance(value, float):
        raise CanonicalError(f"{path}: only safe integers (not -0)")

    if isinstance(value, list):
        if id(value) in state["seen"]:
            raise CanonicalError(f"{path}: cycle")
        state["seen"].add(id(value))
        if len(value) > limits["max_collection_length"]:
            raise CanonicalError(f"{path}: array too long")
        parts = [
            _encode(value[i], f"{path}[{i}]", depth + 1, state, limits) for i in range(len(value))
        ]
        return "[" + ",".join(parts) + "]"

    if isinstance(value, dict):
        if id(value) in state["seen"]:
            raise CanonicalError(f"{path}: cycle")
        state["seen"].add(id(value))
        keys = list(value.keys())
        if any(not isinstance(k, str) for k in keys):
            raise CanonicalError(f"{path}: symbol keys forbidden")
        if len(keys) > limits["max_collection_length"]:
            raise CanonicalError(f"{path}: too many keys")
        sorted_keys = sorted(keys)
        import json

        parts = [
            f"{json.dumps(k, ensure_ascii=False)}:{_encode(value[k], f'{path}.{k}', depth + 1, state, limits)}"
            for k in sorted_keys
        ]
        return "{" + ",".join(parts) + "}"

    raise CanonicalError(f"{path}: unsupported type")


def canonicalize(value, limits: dict | None = None) -> str:
    lim = {**DEFAULT_LIMITS, **(limits or {})}
    return _encode(value, "$", 0, {"nodes": 0, "seen": set()}, lim)
