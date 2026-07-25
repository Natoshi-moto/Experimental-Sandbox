"""Restart, replay, and events-only-truth tests.

Added by the Anthropic debug seat.  The targets here are the replay fakes:
reducers that secretly read side tables, replay "tested" against the same
in-memory objects, audit events that vanish with the transaction that raised,
and nonce consumption that only lives in process memory.
"""

from __future__ import annotations

import json
from pathlib import Path
import sqlite3
import subprocess
import sys

import pytest

from forge_core import Actor, AuthorizationError, Forge, IntegrityError
from forge_core.reduce import reduce_events


HUMAN = Actor.human("operator")
MODEL = Actor.model("fake-worker")

WORKFLOW = {
    "id": "smoke.council_lite",
    "version": 1,
    "nodes": [{"id": "think", "kind": "fake_model", "lens": None}],
    "gates": {"promote_canon": "human_only"},
}


def _build_hostile_history(data_dir: Path, run_id: str) -> dict[str, object]:
    """Drive the full public path, including denials, and return to_dict()."""

    with Forge(data_dir) as forge:
        forge.create_run(HUMAN, run_id)
        forge.start_run(run_id, HUMAN)
        snapshot = forge.import_sources(run_id, HUMAN, {"claim.txt": b"candidate"})
        forge.grant_capability(
            run_id, HUMAN, MODEL, "source.read", snapshot.snapshot_id
        )
        forge.disclose_source(
            run_id, HUMAN, MODEL, snapshot.snapshot_id, "claim.txt"
        )
        context = forge.compile_context(
            run_id, MODEL, snapshot.snapshot_id, ["claim.txt"]
        )
        attempt = forge.execute_fake(
            run_id, MODEL, forge.compile_workflow(WORKFLOW), context.artifact.digest
        )
        forge.propose_signal(
            run_id, MODEL, attempt.output.digest, "fake adapter produced evidence"
        )

        with pytest.raises(AuthorizationError):
            forge.open_canon_gate(run_id, MODEL, attempt.output.digest)
        with pytest.raises(AuthorizationError):
            forge.promote_canon(
                run_id, MODEL, "model-invented-nonce", attempt.output.digest
            )

        gate = forge.open_canon_gate(run_id, HUMAN, attempt.output.digest)
        forge.promote_canon(run_id, HUMAN, gate.decision_nonce, attempt.output.digest)

        # Nonce replay is deliberately NOT asserted here. It is a separate
        # property with its own test below, so a ledger that gets replay right
        # and nonce consumption wrong fails one test, not four.
        forge.complete_run(run_id, HUMAN)
        return forge.projection(run_id).to_dict()


def test_projections_are_rebuilt_from_events_only(tmp_path) -> None:
    """Kill criterion: no mutable side table may exist, let alone be truth."""

    data_dir = tmp_path / "forge-data"
    expected = _build_hostile_history(data_dir, "run-events-only")

    connection = sqlite3.connect(data_dir / "forge.db")
    try:
        tables = [
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
                " AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
        ]
    finally:
        connection.close()
    assert tables == ["events"]

    with Forge(data_dir) as forge:
        events = list(forge.events("run-events-only"))
        first = reduce_events(events)
        second = reduce_events(events)
        assert first == second
        assert first.to_dict() == expected
        assert forge.projection("run-events-only").to_dict() == expected
    assert json.loads(json.dumps(expected)) == expected


def test_hostile_history_replays_identically_after_restart(tmp_path) -> None:
    data_dir = tmp_path / "forge-data"
    expected = _build_hostile_history(data_dir, "run-restart")

    with Forge(data_dir) as reopened:
        actual = reopened.projection("run-restart").to_dict()

    assert actual == expected
    assert actual["run_status"] == "completed"
    assert actual["canon_head"] is not None
    assert len(actual["denials"]) == 2


def test_hostile_history_replays_identically_in_a_new_process(tmp_path) -> None:
    data_dir = tmp_path / "forge-data"
    expected = _build_hostile_history(data_dir, "run-subprocess")
    src_dir = Path(__file__).resolve().parents[1] / "src"
    script = (
        "import json,sys;"
        "from forge_core import Forge;"
        "f=Forge(sys.argv[1]);"
        "print(json.dumps(f.projection(sys.argv[2]).to_dict(),"
        "sort_keys=True,separators=(',',':')));"
        "f.close()"
    )
    completed = subprocess.run(
        [sys.executable, "-c", script, str(data_dir), "run-subprocess"],
        check=True,
        capture_output=True,
        text=True,
        env={"PYTHONPATH": str(src_dir), "PYTHONDONTWRITEBYTECODE": "1"},
    )
    assert json.loads(completed.stdout) == expected


def test_denial_events_survive_the_raise_and_a_restart(tmp_path) -> None:
    """The audit trail must not unwind with the transaction that raised.

    ``permission.denied`` is appended immediately before the authorization
    error propagates; if both lived in one uncommitted transaction the trail
    would vanish exactly when it matters most.
    """

    data_dir = tmp_path / "forge-data"
    run_id = "run-denial-durability"
    with Forge(data_dir) as forge:
        forge.create_run(HUMAN, run_id)
        forge.start_run(run_id, HUMAN)
        snapshot = forge.import_sources(run_id, HUMAN, {"claim.txt": b"candidate"})
        manifest_hash = snapshot.manifest.digest
        with pytest.raises(AuthorizationError):
            forge.open_canon_gate(run_id, MODEL, manifest_hash)
        with pytest.raises(AuthorizationError):
            forge.grant_capability(run_id, MODEL, MODEL, "source.read", "*")

    with Forge(data_dir) as reopened:
        denials = [
            event
            for event in reopened.events(run_id)
            if event.type == "permission.denied"
        ]
        assert [event.payload["operation"] for event in denials] == [
            "human.gate_open",
            "capability.grant",
        ]
        assert all(event.actor.kind == "model" for event in denials)
        assert len(reopened.projection(run_id).to_dict()["denials"]) == 2

    connection = sqlite3.connect(data_dir / "forge.db")
    try:
        (count,) = connection.execute(
            "SELECT COUNT(*) FROM events WHERE domain_id = ? AND type = ?",
            (run_id, "permission.denied"),
        ).fetchone()
    finally:
        connection.close()
    assert count == 2


def test_nonce_consumption_persists_across_restart(tmp_path) -> None:
    """A consumed decision nonce must stay consumed in a fresh process state."""

    data_dir = tmp_path / "forge-data"
    run_id = "run-nonce-durability"
    with Forge(data_dir) as forge:
        forge.create_run(HUMAN, run_id)
        forge.start_run(run_id, HUMAN)
        snapshot = forge.import_sources(run_id, HUMAN, {"claim.txt": b"candidate"})
        artifact_hash = snapshot.manifest.digest
        gate = forge.open_canon_gate(run_id, HUMAN, artifact_hash)
        nonce = gate.decision_nonce
        revision_id = forge.promote_canon(run_id, HUMAN, nonce, artifact_hash)

    with Forge(data_dir) as reopened:
        with pytest.raises(AuthorizationError):
            reopened.promote_canon(run_id, HUMAN, nonce, artifact_hash)
        assert reopened.projection(run_id).canon_head == revision_id
        assert (
            sum(
                event.type == "canon.revision_created"
                for event in reopened.events(run_id)
            )
            == 1
        )


def test_corrupted_history_fails_projection_through_the_public_api(tmp_path) -> None:
    data_dir = tmp_path / "forge-data"
    run_id = "run-corrupt-projection"
    with Forge(data_dir) as forge:
        forge.create_run(HUMAN, run_id)
        forge.start_run(run_id, HUMAN)

    connection = sqlite3.connect(data_dir / "forge.db")
    try:
        connection.execute("DROP TRIGGER IF EXISTS events_append_only_update")
        connection.execute(
            "UPDATE events SET payload = ? WHERE domain_id = ? AND seq = 1",
            ('{"run_id":"run-corrupt-projection","admin":true}', run_id),
        )
        connection.commit()
    finally:
        connection.close()

    with Forge(data_dir) as reopened:
        with pytest.raises(IntegrityError):
            reopened.projection(run_id)
        with pytest.raises(IntegrityError):
            reopened.events(run_id)
