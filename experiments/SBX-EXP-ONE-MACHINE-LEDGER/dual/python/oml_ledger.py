"""OML ledger replay — independent Python kernel matching src/ledger.mjs."""

from __future__ import annotations

import re
from typing import Any

from oml_crypto import PROTOCOL, hash_canonical, public_key_id, verify_canonical

UNIT = "OML_UNIT"
MAX_TX_PER_BLOCK = 64
MAX_OUTPUTS_PER_TX = 16
MAX_INPUTS_PER_TX = 16
MAX_HEIGHT = 10_000
HASH_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


class LedgerError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def fail(code: str, message: str):
    raise LedgerError(code, message)


def require(cond: bool, code: str, message: str):
    if not cond:
        fail(code, message)


def require_hash(v, label: str):
    require(isinstance(v, str) and bool(HASH_RE.match(v)), "BAD_HASH", f"{label}: invalid hash")


def require_id(v, label: str):
    require(isinstance(v, str) and bool(ID_RE.match(v)), "BAD_ID", f"{label}: invalid id")


def require_exact_keys(obj, keys: list[str], label: str):
    require(isinstance(obj, dict), "BAD_OBJECT", f"{label}: object")
    actual = list(obj.keys())
    require(
        len(actual) == len(keys) and all(isinstance(k, str) and k in keys for k in actual),
        "BAD_FIELDS",
        f"{label}: exact fields required",
    )


def require_dense_array(arr, label: str, max_len: int):
    require(isinstance(arr, list), "BAD_ARRAY", f"{label}: array")
    require(len(arr) <= max_len, "BAD_ARRAY", f"{label}: too long")


def outpoint_key(txid: str, index: int) -> str:
    return f"{txid}:{index}"


def state_root(height: int, tip_hash: str, utxo: dict) -> str:
    utxo_list = [
        {
            "amount": out["amount"],
            "outpoint": key,
            "owner_key_id": out["owner_key_id"],
            "public_key_spki_b64": out["public_key_spki_b64"],
        }
        for key, out in sorted(utxo.items(), key=lambda kv: kv[0])
    ]
    return hash_canonical(
        {
            "height": height,
            "protocol": PROTOCOL,
            "tip_hash": tip_hash,
            "unit": UNIT,
            "utxo": utxo_list,
        }
    )


def build_genesis(allocations: list[dict], note: str = "oml-genesis") -> dict:
    require_dense_array(allocations, "allocations", 64)
    require(len(allocations) >= 1, "GENESIS", "need at least one allocation")
    body_allocs = []
    for i, a in enumerate(allocations):
        require_exact_keys(a, ["amount", "owner_label", "public_key_spki_b64"], f"allocations[{i}]")
        require(
            isinstance(a["amount"], int) and not isinstance(a["amount"], bool) and a["amount"] > 0,
            "GENESIS",
            "amount must be positive safe int",
        )
        require_id(a["owner_label"], "owner_label")
        key_id = public_key_id(a["public_key_spki_b64"])
        body_allocs.append(
            {
                "amount": a["amount"],
                "owner_key_id": key_id,
                "owner_label": a["owner_label"],
                "public_key_spki_b64": a["public_key_spki_b64"],
            }
        )
    body_allocs.sort(key=lambda x: x["owner_key_id"])
    body = {
        "allocations": body_allocs,
        "note": note,
        "protocol": PROTOCOL,
        "unit": UNIT,
    }
    genesis_hash = hash_canonical(body, "OML-GENESIS-V0")
    utxo: dict[str, dict] = {}
    for index, a in enumerate(body_allocs):
        utxo[outpoint_key(genesis_hash, index)] = {
            "amount": a["amount"],
            "owner_key_id": a["owner_key_id"],
            "public_key_spki_b64": a["public_key_spki_b64"],
        }
    height = 0
    tip = genesis_hash
    return {
        "genesis": body,
        "genesis_hash": genesis_hash,
        "height": height,
        "tip_hash": tip,
        "utxo": utxo,
        "state_root": state_root(height, tip, utxo),
        "blocks": [],
    }


def apply_tx(utxo: dict, signed_tx: dict) -> dict:
    require_exact_keys(
        signed_tx,
        ["core", "public_key_spki_b64", "signature_b64", "signer_key_id", "txid"],
        "tx",
    )
    core = signed_tx["core"]
    require_exact_keys(core, ["inputs", "memo", "outputs", "protocol", "txid_preimage", "unit"], "core")
    require(core["protocol"] == PROTOCOL, "TX", "protocol")
    require(core["unit"] == UNIT, "TX", "unit")
    core_hash = hash_canonical(
        {
            "inputs": core["inputs"],
            "memo": core["memo"],
            "outputs": core["outputs"],
            "protocol": core["protocol"],
            "unit": core["unit"],
        },
        "OML-TX-CORE-V0",
    )
    require(core["txid_preimage"] == core_hash, "TX", "core hash mismatch")
    require(
        verify_canonical(core, signed_tx["signature_b64"], signed_tx["public_key_spki_b64"]),
        "BAD_SIG",
        "signature verification failed",
    )
    require(
        signed_tx["signer_key_id"] == public_key_id(signed_tx["public_key_spki_b64"]),
        "TX",
        "signer key id mismatch",
    )
    require(
        signed_tx["txid"]
        == hash_canonical(
            {
                "core_hash": core["txid_preimage"],
                "public_key_spki_b64": signed_tx["public_key_spki_b64"],
                "signature_b64": signed_tx["signature_b64"],
            },
            "OML-TX-V0",
        ),
        "TX",
        "txid mismatch",
    )

    next_utxo = dict(utxo)
    input_sum = 0
    for inp in core["inputs"]:
        k = outpoint_key(inp["txid"], inp["index"])
        coin = next_utxo.get(k)
        require(coin is not None, "MISSING_UTXO", f"missing {k}")
        require(coin["owner_key_id"] == signed_tx["signer_key_id"], "NOT_OWNER", f"not owner of {k}")
        input_sum += coin["amount"]
        del next_utxo[k]

    output_sum = 0
    for index, out in enumerate(core["outputs"]):
        output_sum += out["amount"]
        k = outpoint_key(signed_tx["txid"], index)
        require(k not in next_utxo, "UTXO_COLLISION", k)
        next_utxo[k] = {
            "amount": out["amount"],
            "owner_key_id": out["owner_key_id"],
            "public_key_spki_b64": out["public_key_spki_b64"],
        }

    require(input_sum == output_sum, "CONSERVATION", f"in {input_sum} != out {output_sum}")
    require(input_sum > 0, "TX", "zero value")
    return next_utxo


def apply_block(state: dict, block: dict) -> dict:
    require(block["prev_hash"] == state["tip_hash"], "CHAIN", "prev_hash mismatch")
    require(block["height"] == state["height"] + 1, "CHAIN", "height mismatch")
    require(block["protocol"] == PROTOCOL, "BLOCK", "protocol")
    require(block["unit"] == UNIT, "BLOCK", "unit")
    expected = hash_canonical(
        {
            "height": block["height"],
            "prev_hash": block["prev_hash"],
            "protocol": block["protocol"],
            "transactions": block["transactions"],
            "unit": block["unit"],
        },
        "OML-BLOCK-V0",
    )
    require(block["block_hash"] == expected, "BLOCK", "block hash mismatch")

    utxo = dict(state["utxo"])
    seen_tx: set[str] = set()
    for tx in block["transactions"]:
        require(tx["txid"] not in seen_tx, "DUP_TX", tx["txid"])
        seen_tx.add(tx["txid"])
        utxo = apply_tx(utxo, tx)

    return {
        "genesis": state["genesis"],
        "genesis_hash": state["genesis_hash"],
        "height": block["height"],
        "tip_hash": block["block_hash"],
        "utxo": utxo,
        "state_root": state_root(block["height"], block["block_hash"], utxo),
        "blocks": [*state["blocks"], block],
    }


def replay(genesis_result: dict, blocks: list[dict]) -> dict:
    rebuilt = build_genesis(
        [
            {
                "amount": a["amount"],
                "owner_label": a["owner_label"],
                "public_key_spki_b64": a["public_key_spki_b64"],
            }
            for a in genesis_result["genesis"]["allocations"]
        ],
        note=genesis_result["genesis"]["note"],
    )
    require(
        rebuilt["genesis_hash"] == genesis_result["genesis_hash"],
        "GENESIS",
        "genesis replay mismatch",
    )
    state = {
        "genesis": rebuilt["genesis"],
        "genesis_hash": rebuilt["genesis_hash"],
        "height": 0,
        "tip_hash": rebuilt["genesis_hash"],
        "utxo": rebuilt["utxo"],
        "state_root": rebuilt["state_root"],
        "blocks": [],
    }
    for block in blocks:
        state = apply_block(state, block)
    return state
