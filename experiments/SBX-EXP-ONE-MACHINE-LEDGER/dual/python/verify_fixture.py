#!/usr/bin/env python3
"""Independent Python dual-check: replay fixtures/chain-v0.json → match anchors.

Exit 0 only if state_root, tip, height, and supply match the Node fixture.
status_authority: NONE — not money, not consensus, not Lab canon.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from oml_ledger import LedgerError, replay

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "fixtures" / "chain-v0.json"


def main() -> int:
    if not FIXTURE.is_file():
        print("DUAL FAIL: missing fixtures/chain-v0.json", file=sys.stderr)
        return 1
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    try:
        state = replay(
            {"genesis": data["genesis"], "genesis_hash": data["genesis_hash"]},
            data.get("blocks") or [],
        )
    except LedgerError as e:
        print(f"DUAL FAIL: {e.code}: {e.message}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"DUAL FAIL: {type(e).__name__}: {e}", file=sys.stderr)
        return 1

    supply = sum(o["amount"] for o in state["utxo"].values())
    errors = []
    if state["state_root"] != data["expected_state_root"]:
        errors.append(f"state_root got {state['state_root']} want {data['expected_state_root']}")
    if state["tip_hash"] != data["expected_tip_hash"]:
        errors.append(f"tip got {state['tip_hash']} want {data['expected_tip_hash']}")
    if state["height"] != data["expected_height"]:
        errors.append(f"height got {state['height']} want {data['expected_height']}")
    if supply != data["expected_supply"]:
        errors.append(f"supply got {supply} want {data['expected_supply']}")

    if errors:
        print("DUAL FAIL:", file=sys.stderr)
        for line in errors:
            print(" ", line, file=sys.stderr)
        return 1

    print("=== OML Python dual-check: PASS ===")
    print(f"impl=python3 state_root={state['state_root']}")
    print(f"height={state['height']} tip={state['tip_hash']} supply={supply} OML_UNIT")
    print("cross_impl_agreement=true")
    return 0


if __name__ == "__main__":
    sys.exit(main())
