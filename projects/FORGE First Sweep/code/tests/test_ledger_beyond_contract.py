"""Ledger properties that go BEYOND `LEDGER_SPEC_FOR_GROK.md`.

Nothing in this file is a contract requirement. Each test probes whether the
installed ledger implements an optional hardening and **skips** when it does
not, so a spec-minimal ledger reports skips rather than failures.

Read the skips as a feature inventory, not as defects. The one exception is
nonce consumption, which the spec addendum (§8) promotes to a hard
requirement because `canon.py` depends on it and `test_canon_hostile.py`
fails without it — that one is tested at the public-API level in
`test_replay.py`, where it belongs.
"""

from __future__ import annotations

import sqlite3
import tempfile

import pytest

from forge_core.ledger import EventLedger
from forge_core.types import Actor, ForgeError


HUMAN = Actor.human("operator")
MODEL = Actor.model("fake-worker")


def _probe(append_call) -> bool:
    """Return True when the ledger refuses the given append."""

    with tempfile.TemporaryDirectory() as directory:
        ledger = EventLedger(directory)
        try:
            append_call(ledger)
        except ForgeError:
            return True
        except Exception:
            return True
        else:
            return False
        finally:
            ledger.close()


BINDS_ACTOR_KIND = _probe(
    lambda ledger: ledger.append(
        "run-probe",
        "canon.revision_created",
        MODEL,
        {
            "revision_id": "revision-probe",
            "artifact_hash": "a" * 64,
            "decision_nonce": "nonce-probe",
        },
    )
)

GUARDS_RUN_LIFECYCLE = _probe(
    lambda ledger: ledger.append(
        "run-probe", "run.completed", HUMAN, {"run_id": "run-probe"}
    )
)

VALIDATES_PAYLOAD_SHAPE = _probe(
    lambda ledger: ledger.append(
        "run-probe", "run.created", HUMAN, {"run_id": "run-probe", "admin": True}
    )
)


needs_actor_binding = pytest.mark.skipif(
    not BINDS_ACTOR_KIND,
    reason="ledger does not bind actor kind per event type (beyond spec)",
)
needs_lifecycle = pytest.mark.skipif(
    not GUARDS_RUN_LIFECYCLE,
    reason="ledger does not enforce run lifecycle order (beyond spec)",
)
needs_payload_shape = pytest.mark.skipif(
    not VALIDATES_PAYLOAD_SHAPE,
    reason="ledger does not validate exact payload shape (beyond spec)",
)


@needs_actor_binding
def test_second_wall_blocks_a_model_bypassing_the_facade(tmp_path) -> None:
    """A model importing `EventLedger` directly still cannot write authority.

    THREAT_NOTES lists "capability bypass via internal helpers exposed
    publicly" as in scope. `THREAT_MODEL.md` answers it by declaring `Forge`
    the supported boundary — a declaration Python does not enforce. When the
    ledger binds actor kind, the wall holds on this path too.
    """

    ledger = EventLedger(tmp_path / "forge-data")
    try:
        for event_type, payload in (
            (
                "canon.revision_created",
                {
                    "revision_id": "revision-sneak",
                    "artifact_hash": "a" * 64,
                    "decision_nonce": "nonce-sneak",
                },
            ),
            (
                "capability.granted",
                {
                    "grant_id": "grant-sneak",
                    "subject_kind": "model",
                    "subject_id": "fake-worker",
                    "capability": "cap.canon.write",
                    "resource": "*",
                },
            ),
            ("policy.changed", {"policy": "canon.mode", "value": "model_allowed"}),
            (
                "human.gate_opened",
                {
                    "gate_id": "gate-sneak",
                    "decision_nonce": "nonce-sneak",
                    "artifact_hash": "a" * 64,
                },
            ),
        ):
            with pytest.raises(ForgeError):
                ledger.append("run-bypass", event_type, MODEL, payload)
        assert list(ledger.events("run-bypass")) == []
    finally:
        ledger.close()


@needs_lifecycle
def test_run_lifecycle_order_is_enforced(tmp_path) -> None:
    ledger = EventLedger(tmp_path / "forge-data")
    domain_id = "run-lifecycle"
    try:
        with pytest.raises(ForgeError):
            ledger.append(domain_id, "run.started", HUMAN, {"run_id": domain_id})

        ledger.append(domain_id, "run.created", HUMAN, {"run_id": domain_id})
        with pytest.raises(ForgeError):
            ledger.append(domain_id, "run.created", HUMAN, {"run_id": domain_id})

        ledger.append(domain_id, "run.started", HUMAN, {"run_id": domain_id})
        ledger.append(domain_id, "run.completed", HUMAN, {"run_id": domain_id})
        with pytest.raises(ForgeError):
            ledger.append(
                domain_id, "run.failed", HUMAN, {"run_id": domain_id, "reason": "late"}
            )
    finally:
        ledger.close()


@needs_payload_shape
def test_unknown_event_types_and_payload_fields_are_rejected(tmp_path) -> None:
    ledger = EventLedger(tmp_path / "forge-data")
    domain_id = "run-catalog"
    try:
        with pytest.raises(ForgeError):
            ledger.append(domain_id, "canon.sneak_write", HUMAN, {})
        with pytest.raises(ForgeError):
            ledger.append(domain_id, "run.created", HUMAN, {})
        with pytest.raises(ForgeError):
            ledger.append(
                domain_id, "run.created", HUMAN, {"run_id": domain_id, "admin": True}
            )
        assert list(ledger.events(domain_id)) == []
    finally:
        ledger.close()


def test_storage_level_append_only_triggers(tmp_path) -> None:
    """Optional hardening: append-only enforced for any SQL writer.

    The spec asks only that the *normal API* not update or delete. A ledger
    that also installs triggers resists a writer that bypasses Python
    entirely. Skipped when no triggers are installed.
    """

    data_dir = tmp_path / "forge-data"
    ledger = EventLedger(data_dir)
    domain_id = "run-triggers"
    ledger.append(domain_id, "run.created", HUMAN, {"run_id": domain_id})
    ledger.close()

    connection = sqlite3.connect(ledger.db_path)
    try:
        triggers = [
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'trigger'"
            )
        ]
        if not triggers:
            pytest.skip("ledger installs no append-only triggers (beyond spec)")

        with pytest.raises(sqlite3.DatabaseError):
            connection.execute(
                "UPDATE events SET payload = '{}' WHERE domain_id = ?", (domain_id,)
            )
        with pytest.raises(sqlite3.DatabaseError):
            connection.execute(
                "DELETE FROM events WHERE domain_id = ?", (domain_id,)
            )
    finally:
        connection.close()

    reopened = EventLedger(data_dir)
    assert len(list(reopened.events(domain_id))) == 1
    reopened.close()
