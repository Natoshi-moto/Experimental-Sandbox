"""Ledger hash-chain tests — contract level.

Written by the debug seat (Fable, Anthropic) to judge **any** ledger written
to `LEDGER_SPEC_FOR_GROK.md`.  Everything here tests a property the spec
pins, and assertions match on exception *type* rather than message text, so a
different implementation is not penalised for different wording.

Properties beyond the spec — an actor-kind event catalog, run-lifecycle
guards, storage-level append-only triggers — live in
`test_ledger_beyond_contract.py`, which skips when they are absent.

Targets the fakes in HANDOFF_FABLE_DEBUG §3: chain written but never verified
(1), append-only by convention (4), non-canonical JSON (6).
"""

from __future__ import annotations

import sqlite3

import pytest

from forge_core.hashutil import canonical_json_hash
from forge_core.ledger import EventLedger
from forge_core.types import (
    SCHEMA_VERSION,
    Actor,
    Event,
    IntegrityError,
    ValidationError,
)


HUMAN = Actor.human("operator")


def _seed(ledger: EventLedger, domain_id: str = "run-chain") -> str:
    """Three appends using only the 4-argument contract signature."""

    ledger.append(domain_id, "run.created", HUMAN, {"run_id": domain_id})
    ledger.append(domain_id, "run.started", HUMAN, {"run_id": domain_id})
    ledger.append(
        domain_id, "run.failed", HUMAN, {"run_id": domain_id, "reason": "seeded"}
    )
    return domain_id


def _attack(db_path, *statements: tuple[str, tuple[object, ...]]) -> None:
    """Run raw SQL as an attacker who owns the database file.

    Triggers are dropped defensively so these tests exercise *verification*
    even against a ledger that has no storage-level triggers to begin with.
    """

    connection = sqlite3.connect(db_path)
    try:
        for name in ("events_append_only_update", "events_append_only_delete"):
            connection.execute(f"DROP TRIGGER IF EXISTS {name}")
        for statement, parameters in statements:
            connection.execute(statement, parameters)
        connection.commit()
    finally:
        connection.close()


def test_chain_links_and_verifies(tmp_path) -> None:
    """Spec §3.2 and §3.3: linked chain plus a verifier that walks it."""

    ledger = EventLedger(tmp_path / "forge-data")
    domain_id = _seed(ledger)

    events = list(ledger.events(domain_id))
    assert [event.seq for event in events] == [1, 2, 3]
    assert events[0].prev_hash is None
    assert events[1].prev_hash == events[0].event_hash
    assert events[2].prev_hash == events[1].event_hash
    ledger.close()


def test_event_hash_commits_to_to_hash_dict(tmp_path) -> None:
    """Spec §2: the hash surface is `Event.to_hash_dict` via canonical JSON.

    This pins the hashing scheme itself, so an implementation that invents a
    second scheme is caught even if its own chain is internally consistent.
    """

    ledger = EventLedger(tmp_path / "forge-data")
    domain_id = _seed(ledger)
    for event in ledger.events(domain_id):
        assert event.event_hash == canonical_json_hash(event.to_hash_dict())
    ledger.close()


def test_equal_events_hash_identically_regardless_of_key_order() -> None:
    """Fake 6: canonical JSON must not leak dict insertion order.

    Built directly from `types.Event` so the property is tested independent of
    any ledger implementation.
    """

    def event(payload: dict[str, object]) -> Event:
        return Event(
            event_id="evt-1",
            domain_id="run-hash",
            seq=1,
            type="run.failed",
            schema_version=SCHEMA_VERSION,
            actor=HUMAN,
            payload=payload,
            prev_hash=None,
            event_hash="0" * 64,
        )

    first = event({"run_id": "run-hash", "reason": "same failure"})
    second = event({"reason": "same failure", "run_id": "run-hash"})
    assert canonical_json_hash(first.to_hash_dict()) == canonical_json_hash(
        second.to_hash_dict()
    )


@pytest.mark.parametrize(
    ("column", "value"),
    [
        ("payload", '{"reason":"rewritten","run_id":"run-chain"}'),
        ("event_hash", "f" * 64),
        ("prev_hash", "f" * 64),
        ("actor_id", "forged-operator"),
        ("type", "run.completed"),
    ],
)
def test_corrupted_row_fails_verification_after_reopen(
    tmp_path, column: str, value: str
) -> None:
    """THREAT_NOTES abuse case 5 / fake 1: corrupt a row, verification must fail."""

    data_dir = tmp_path / "forge-data"
    ledger = EventLedger(data_dir)
    domain_id = _seed(ledger)
    ledger.close()

    _attack(
        ledger.db_path,
        (
            f"UPDATE events SET {column} = ? WHERE domain_id = ? AND seq = 3",
            (value, domain_id),
        ),
    )

    reopened = EventLedger(data_dir)
    with pytest.raises(IntegrityError):
        list(reopened.events(domain_id))
    reopened.close()


def test_deleting_a_middle_row_is_detected(tmp_path) -> None:
    data_dir = tmp_path / "forge-data"
    ledger = EventLedger(data_dir)
    domain_id = _seed(ledger)
    ledger.close()

    _attack(
        ledger.db_path,
        ("DELETE FROM events WHERE domain_id = ? AND seq = 2", (domain_id,)),
    )

    reopened = EventLedger(data_dir)
    with pytest.raises(IntegrityError):
        list(reopened.events(domain_id))
    reopened.close()


def test_spliced_event_from_a_divergent_chain_is_rejected(tmp_path) -> None:
    """Isolates the prev_hash link check.

    The spliced row was minted by a real ledger, so its own hash verifies and
    its seq is correct.  Only the link to its actual predecessor exposes it —
    a verifier that recomputes hashes but never compares links will miss this.
    """

    def build(root, reason: str):
        ledger = EventLedger(root)
        ledger.append("run-splice", "run.created", HUMAN, {"run_id": "run-splice"})
        ledger.append("run-splice", "run.started", HUMAN, {"run_id": "run-splice"})
        ledger.append(
            "run-splice",
            "run.failed",
            HUMAN,
            {"run_id": "run-splice", "reason": reason},
        )
        ledger.close()
        return ledger.db_path

    original = build(tmp_path / "a", "alpha")
    divergent = build(tmp_path / "b", "beta")

    donor = sqlite3.connect(divergent)
    try:
        row = donor.execute(
            "SELECT event_id, type, schema_version, actor_kind, actor_id,"
            " payload, prev_hash, event_hash FROM events"
            " WHERE domain_id = 'run-splice' AND seq = 3"
        ).fetchone()
    finally:
        donor.close()

    _attack(
        original,
        (
            "UPDATE events SET event_id = ?, type = ?, schema_version = ?,"
            " actor_kind = ?, actor_id = ?, payload = ?, prev_hash = ?,"
            " event_hash = ? WHERE domain_id = 'run-splice' AND seq = 3",
            row,
        ),
    )

    reopened = EventLedger(tmp_path / "a")
    with pytest.raises(IntegrityError):
        list(reopened.events("run-splice"))
    reopened.close()


def test_tail_truncation_is_not_detected_known_limitation(tmp_path) -> None:
    """Documents a real limit rather than asserting a defense that isn't there.

    Deleting the newest events leaves a shorter chain in which every link and
    hash is intact.  No in-file hash chain can detect this without an external
    tip anchor.  Pinned so the limitation stays visible and so a future anchor
    shows up here as a behavior change.
    """

    data_dir = tmp_path / "forge-data"
    ledger = EventLedger(data_dir)
    domain_id = _seed(ledger)
    ledger.close()

    _attack(
        ledger.db_path,
        ("DELETE FROM events WHERE domain_id = ? AND seq = 3", (domain_id,)),
    )

    reopened = EventLedger(data_dir)
    assert len(list(reopened.events(domain_id))) == 2
    reopened.close()


def test_no_public_api_rewrites_history(tmp_path) -> None:
    """Fake 4: append must be the only public write path."""

    ledger = EventLedger(tmp_path / "forge-data")
    domain_id = _seed(ledger)

    for forbidden in ("update", "delete", "remove", "rewrite", "truncate", "purge"):
        assert not any(
            name == forbidden or name.startswith(f"{forbidden}_")
            for name in dir(ledger)
            if not name.startswith("_")
        ), f"ledger exposes a public {forbidden} path"

    assert len(list(ledger.events(domain_id))) == 3
    ledger.close()


def test_append_batch_is_atomic(tmp_path) -> None:
    """Spec §2: all entries land or none do.

    Uses a payload the ledger must reject (non-finite float is rejected by
    `hashutil`, which the spec mandates for hashing) as the failing entry, so
    the test does not depend on any beyond-spec guard.
    """

    ledger = EventLedger(tmp_path / "forge-data")
    domain_id = "run-batch"
    ledger.append(domain_id, "run.created", HUMAN, {"run_id": domain_id})
    before = len(list(ledger.events(domain_id)))

    with pytest.raises((ValidationError, IntegrityError)):
        ledger.append_batch(
            domain_id,
            [
                ("run.started", HUMAN, {"run_id": domain_id}, None),
                (
                    "run.failed",
                    HUMAN,
                    {"run_id": domain_id, "reason": float("nan")},
                    None,
                ),
            ],
        )

    after = list(ledger.events(domain_id))
    assert len(after) == before, "partial batch landed; append_batch is not atomic"
    assert [event.type for event in after] == ["run.created"]
    ledger.close()


def test_non_finite_payload_numbers_are_rejected(tmp_path) -> None:
    """Spec §4 trap 4: NaN/Inf must not reach the hash."""

    ledger = EventLedger(tmp_path / "forge-data")
    domain_id = "run-nan"
    # A valid lifecycle prefix, so a ledger that also enforces run ordering
    # rejects the payload for the reason under test rather than for its state.
    ledger.append(domain_id, "run.created", HUMAN, {"run_id": domain_id})
    ledger.append(domain_id, "run.started", HUMAN, {"run_id": domain_id})

    for bad in (float("nan"), float("inf"), float("-inf")):
        with pytest.raises(ValidationError):
            ledger.append(
                domain_id, "run.failed", HUMAN, {"run_id": domain_id, "reason": bad}
            )
    assert len(list(ledger.events(domain_id))) == 2
    ledger.close()


def test_chain_survives_close_and_reopen(tmp_path) -> None:
    """Spec §3.5: a fresh connection sees the same sequence and still verifies."""

    data_dir = tmp_path / "forge-data"
    ledger = EventLedger(data_dir)
    domain_id = _seed(ledger)
    original = [
        (event.seq, event.event_hash) for event in ledger.events(domain_id)
    ]
    ledger.close()

    reopened = EventLedger(data_dir)
    assert [
        (event.seq, event.event_hash) for event in reopened.events(domain_id)
    ] == original
    reopened.close()


def test_sequence_allocation_does_not_fork_across_connections(tmp_path) -> None:
    """Spec §3.4: two writers must not produce a duplicate seq or a fork."""

    data_dir = tmp_path / "forge-data"
    first = EventLedger(data_dir)
    second = EventLedger(data_dir)
    domain_id = "run-concurrent"
    try:
        first.append(domain_id, "run.created", HUMAN, {"run_id": domain_id})
        second.append(domain_id, "run.started", HUMAN, {"run_id": domain_id})
        events = list(first.events(domain_id))
    finally:
        first.close()
        second.close()

    assert [event.seq for event in events] == [1, 2]
    assert events[1].prev_hash == events[0].event_hash
