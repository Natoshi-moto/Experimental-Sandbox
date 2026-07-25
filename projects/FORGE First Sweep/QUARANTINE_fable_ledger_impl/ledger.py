"""Append-only, hash-chained SQLite event ledger.

The ledger is the transaction boundary for every authority claim in Phase 0:
chain verification, run lifecycle rejection, and one-time human decisions are
enforced here, inside a serialized SQLite write transaction, so no caller can
race or replay its way around them.

Design commitments:

* Append is the only public write.  UPDATE and DELETE are additionally blocked
  by SQLite triggers so append-only is storage-enforced, not convention.
* Every read re-verifies the chain: each event's hash is recomputed from its
  stored fields and its ``prev_hash`` must equal the previous event's hash.
  Corrupt history fails closed everywhere, not only in an audit command.
* Event types form a closed catalog with exact payload keys and per-type
  allowed actor kinds, mirroring the public-facade checks as defense in depth.
* A decision nonce is minted by one ``human.gate_opened``, consumed by at most
  one ``human.decision_recorded``, and authorizes at most one
  ``canon.revision_created`` for the same artifact hash.

Non-claims (see THREAT_MODEL.md): an attacker with direct write access to the
database file can drop the triggers and rewrite rows; the chain makes that
detectable on read, except for truncation of the newest events, which a pure
in-file hash chain cannot detect without an external tip anchor.
"""

from __future__ import annotations

from dataclasses import replace
import json
import os
from pathlib import Path
import sqlite3
from typing import Any, Iterable, Sequence
from uuid import uuid4

from .hashutil import canonical_json_bytes, canonical_json_hash
from .types import (
    SCHEMA_VERSION,
    Actor,
    AuthorizationError,
    Event,
    IntegrityError,
    StateTransitionError,
    ValidationError,
)


_DB_FILENAME = "forge.db"
_DB_USER_VERSION = 1
_PLACEHOLDER_HASH = "0" * 64

# Closed Phase 0 event catalog: type -> (allowed actor kinds, exact payload
# keys).  ``None`` for actor kinds means any kind may emit the type.
_EVENT_CATALOG: dict[str, tuple[frozenset[str] | None, frozenset[str]]] = {
    "run.created": (frozenset({"human", "system"}), frozenset({"run_id"})),
    "run.started": (frozenset({"human", "system"}), frozenset({"run_id"})),
    "run.completed": (frozenset({"human", "system"}), frozenset({"run_id"})),
    "run.failed": (frozenset({"human", "system"}), frozenset({"run_id", "reason"})),
    "source.imported": (
        frozenset({"human", "system"}),
        frozenset({"snapshot_id", "manifest_hash", "entries"}),
    ),
    "source.exposed": (
        frozenset({"human"}),
        frozenset(
            {
                "disclosure_id",
                "snapshot_id",
                "path",
                "content_hash",
                "subject_kind",
                "subject_id",
            }
        ),
    ),
    "context.compiled": (
        None,
        frozenset({"context_id", "snapshot_id", "paths", "artifact_hash"}),
    ),
    "attempt.started": (
        frozenset({"model"}),
        frozenset({"attempt_id", "node_id", "context_hash"}),
    ),
    "attempt.output_received": (
        frozenset({"model"}),
        frozenset({"attempt_id", "artifact_hash"}),
    ),
    "attempt.succeeded": (frozenset({"model"}), frozenset({"attempt_id"})),
    "attempt.failed": (frozenset({"model"}), frozenset({"attempt_id", "reason"})),
    "signal.proposed": (
        frozenset({"model", "human"}),
        frozenset({"signal_id", "artifact_hash", "summary"}),
    ),
    "human.gate_opened": (
        frozenset({"human"}),
        frozenset({"gate_id", "decision_nonce", "artifact_hash"}),
    ),
    "human.decision_recorded": (
        frozenset({"human"}),
        frozenset(
            {"decision_id", "gate_id", "decision_nonce", "approved", "artifact_hash"}
        ),
    ),
    "canon.revision_created": (
        frozenset({"human"}),
        frozenset({"revision_id", "artifact_hash", "decision_nonce"}),
    ),
    "capability.granted": (
        frozenset({"human"}),
        frozenset({"grant_id", "subject_kind", "subject_id", "capability", "resource"}),
    ),
    "policy.changed": (frozenset({"human"}), frozenset({"policy", "value"})),
    "permission.denied": (
        None,
        frozenset({"operation", "reason", "subject_kind", "subject_id"}),
    ),
}

_SCHEMA_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS events (
        domain_id TEXT NOT NULL,
        seq INTEGER NOT NULL CHECK (seq >= 1),
        event_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        actor_kind TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        prev_hash TEXT,
        event_hash TEXT NOT NULL,
        PRIMARY KEY (domain_id, seq)
    ) WITHOUT ROWID
    """,
    """
    CREATE TRIGGER IF NOT EXISTS events_append_only_update
    BEFORE UPDATE ON events
    BEGIN
        SELECT RAISE(ABORT, 'ledger events are append-only');
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS events_append_only_delete
    BEFORE DELETE ON events
    BEGIN
        SELECT RAISE(ABORT, 'ledger events are append-only');
    END
    """,
)


def _nonempty_string(value: object, field: str) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise ValidationError(f"{field} must be a non-empty string")
    return value


class EventLedger:
    """Append-only event history under one data directory."""

    def __init__(self, data_dir: str | os.PathLike[str]) -> None:
        if not isinstance(data_dir, (str, os.PathLike)):
            raise ValidationError("data_dir must be a filesystem path")
        root = Path(data_dir)
        try:
            root.mkdir(parents=True, exist_ok=True)
            root = root.resolve(strict=True)
        except (OSError, RuntimeError) as exc:
            raise ValidationError(f"cannot initialize data_dir: {exc}") from exc
        self.data_dir = root
        self.db_path = root / _DB_FILENAME

        try:
            self._conn = sqlite3.connect(self.db_path, isolation_level=None)
        except sqlite3.Error as exc:
            raise IntegrityError(f"cannot open ledger database: {exc}") from exc
        self._closed = False
        try:
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA synchronous=FULL")
            self._conn.execute("PRAGMA busy_timeout=5000")
            self._initialize_schema()
        except BaseException:
            self._conn.close()
            self._closed = True
            raise

    def _initialize_schema(self) -> None:
        row = self._conn.execute("PRAGMA user_version").fetchone()
        user_version = int(row[0])
        if user_version not in (0, _DB_USER_VERSION):
            raise IntegrityError(
                f"unsupported ledger schema version {user_version}"
            )
        try:
            self._conn.execute("BEGIN IMMEDIATE")
        except sqlite3.Error as exc:
            raise IntegrityError(f"cannot lock ledger for schema setup: {exc}") from exc
        try:
            for statement in _SCHEMA_STATEMENTS:
                self._conn.execute(statement)
            self._conn.execute(f"PRAGMA user_version={_DB_USER_VERSION}")
            self._conn.execute("COMMIT")
        except sqlite3.Error as exc:
            self._rollback_quietly()
            raise IntegrityError(f"cannot initialize ledger schema: {exc}") from exc

    def close(self) -> None:
        if not self._closed:
            self._closed = True
            self._conn.close()

    def _require_open(self) -> None:
        if self._closed:
            raise ValidationError("ledger is closed")

    # -- validation -------------------------------------------------------

    @staticmethod
    def _validate_entry(
        event_type: object, actor: object, payload: object, event_id: object
    ) -> tuple[str, Actor, dict[str, Any], str]:
        type_name = _nonempty_string(event_type, "event type")
        if type_name not in _EVENT_CATALOG:
            raise ValidationError(f"unknown event type: {type_name}")
        if not isinstance(actor, Actor):
            raise ValidationError("actor must be an Actor")
        allowed_kinds, required_keys = _EVENT_CATALOG[type_name]
        if allowed_kinds is not None and actor.kind not in allowed_kinds:
            raise AuthorizationError(
                f"a {actor.kind} actor may not append {type_name}"
            )
        if type(payload) is not dict:
            raise ValidationError("payload must be a dict")
        actual_keys = set(payload)
        if actual_keys != required_keys:
            missing = sorted(required_keys - actual_keys)
            extra = sorted(actual_keys - required_keys)
            details: list[str] = []
            if missing:
                details.append(f"missing={missing}")
            if extra:
                details.append(f"extra={extra}")
            raise ValidationError(
                f"invalid {type_name} payload fields ({', '.join(details)})"
            )
        if event_id is None:
            event_id = f"evt-{uuid4()}"
        return type_name, actor, payload, _nonempty_string(event_id, "event_id")

    # -- append-time guards ----------------------------------------------

    def _payload_query(
        self, domain_id: str, event_type: str, json_path: str, value: str
    ) -> sqlite3.Row | None:
        return self._conn.execute(
            "SELECT payload FROM events"
            " WHERE domain_id = ? AND type = ? AND json_extract(payload, ?) = ?"
            " ORDER BY seq LIMIT 1",
            (domain_id, event_type, json_path, value),
        ).fetchone()

    def _run_state(self, domain_id: str) -> str | None:
        rows = self._conn.execute(
            "SELECT type FROM events WHERE domain_id = ? AND type IN"
            " ('run.created', 'run.started', 'run.completed', 'run.failed')"
            " ORDER BY seq",
            (domain_id,),
        ).fetchall()
        return rows[-1][0] if rows else None

    def _guard_run_lifecycle(
        self, domain_id: str, type_name: str, payload: dict[str, Any]
    ) -> None:
        if payload["run_id"] != domain_id:
            raise StateTransitionError(
                "run events must carry run_id equal to their domain_id"
            )
        state = self._run_state(domain_id)
        if type_name == "run.created":
            if state is not None:
                raise StateTransitionError(f"run {domain_id} already exists")
        elif type_name == "run.started":
            if state is None:
                raise StateTransitionError(f"run {domain_id} has not been created")
            if state != "run.created":
                raise StateTransitionError(
                    f"run {domain_id} cannot start from state {state}"
                )
        else:  # run.completed | run.failed
            if state != "run.started":
                raise StateTransitionError(
                    f"run {domain_id} cannot finish from state {state}"
                )

    def _guard_gate_opened(self, domain_id: str, payload: dict[str, Any]) -> None:
        nonce = _nonempty_string(payload["decision_nonce"], "decision_nonce")
        if self._payload_query(
            domain_id, "human.gate_opened", "$.decision_nonce", nonce
        ):
            raise StateTransitionError("decision nonce already minted by a gate")

    def _guard_decision_recorded(
        self, domain_id: str, payload: dict[str, Any]
    ) -> None:
        nonce = _nonempty_string(payload["decision_nonce"], "decision_nonce")
        if type(payload["approved"]) is not bool:
            raise ValidationError("decision approved flag must be a boolean")
        gate_row = self._payload_query(
            domain_id, "human.gate_opened", "$.decision_nonce", nonce
        )
        if gate_row is None:
            raise StateTransitionError(
                "decision nonce does not identify an open human gate"
            )
        gate_payload = json.loads(gate_row[0])
        if gate_payload["gate_id"] != payload["gate_id"]:
            raise StateTransitionError("decision gate_id does not match the gate")
        if gate_payload["artifact_hash"] != payload["artifact_hash"]:
            raise StateTransitionError(
                "decision artifact_hash does not match the gated artifact"
            )
        if self._payload_query(
            domain_id, "human.decision_recorded", "$.decision_nonce", nonce
        ):
            raise StateTransitionError("decision nonce already consumed")

    def _guard_revision_created(
        self, domain_id: str, payload: dict[str, Any]
    ) -> None:
        nonce = _nonempty_string(payload["decision_nonce"], "decision_nonce")
        decision_row = self._payload_query(
            domain_id, "human.decision_recorded", "$.decision_nonce", nonce
        )
        if decision_row is None:
            raise StateTransitionError(
                "canon revision requires a recorded human decision"
            )
        decision_payload = json.loads(decision_row[0])
        if decision_payload["approved"] is not True:
            raise StateTransitionError(
                "canon revision requires an approving human decision"
            )
        if decision_payload["artifact_hash"] != payload["artifact_hash"]:
            raise StateTransitionError(
                "canon revision artifact_hash does not match the decided artifact"
            )
        if self._payload_query(
            domain_id, "canon.revision_created", "$.decision_nonce", nonce
        ):
            raise StateTransitionError(
                "decision nonce already used for a canon revision"
            )

    def _guard(self, domain_id: str, type_name: str, payload: dict[str, Any]) -> None:
        if type_name.startswith("run."):
            self._guard_run_lifecycle(domain_id, type_name, payload)
        elif type_name == "human.gate_opened":
            self._guard_gate_opened(domain_id, payload)
        elif type_name == "human.decision_recorded":
            self._guard_decision_recorded(domain_id, payload)
        elif type_name == "canon.revision_created":
            self._guard_revision_created(domain_id, payload)

    # -- writes -----------------------------------------------------------

    def _chain_tip(self, domain_id: str) -> tuple[int, str | None]:
        row = self._conn.execute(
            "SELECT seq, event_hash FROM events WHERE domain_id = ?"
            " ORDER BY seq DESC LIMIT 1",
            (domain_id,),
        ).fetchone()
        if row is None:
            return 0, None
        return int(row[0]), str(row[1])

    def _insert_within_transaction(
        self,
        domain_id: str,
        type_name: str,
        actor: Actor,
        payload: dict[str, Any],
        event_id: str,
        seq: int,
        prev_hash: str | None,
    ) -> Event:
        self._guard(domain_id, type_name, payload)
        provisional = Event(
            event_id=event_id,
            domain_id=domain_id,
            seq=seq,
            type=type_name,
            schema_version=SCHEMA_VERSION,
            actor=actor,
            payload=payload,
            prev_hash=prev_hash,
            event_hash=_PLACEHOLDER_HASH,
        )
        # The hash is computed from the event's own wire form so the stored
        # chain and any later recomputation cannot drift apart.
        event = replace(
            provisional,
            event_hash=canonical_json_hash(provisional.to_hash_dict()),
        )
        try:
            self._conn.execute(
                "INSERT INTO events (domain_id, seq, event_id, type,"
                " schema_version, actor_kind, actor_id, payload, prev_hash,"
                " event_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    event.domain_id,
                    event.seq,
                    event.event_id,
                    event.type,
                    event.schema_version,
                    event.actor.kind,
                    event.actor.actor_id,
                    canonical_json_bytes(event.payload).decode("utf-8"),
                    event.prev_hash,
                    event.event_hash,
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ValidationError(f"ledger rejected event insert: {exc}") from exc
        return event

    def _append_entries(
        self,
        domain_id: str,
        entries: Sequence[tuple[str, Actor, dict[str, Any], str | None]],
    ) -> list[Event]:
        self._require_open()
        _nonempty_string(domain_id, "domain_id")
        if not isinstance(entries, Sequence) or not entries:
            raise ValidationError("entries must be a non-empty sequence")
        validated = []
        for entry in entries:
            if not isinstance(entry, tuple) or len(entry) != 4:
                raise ValidationError(
                    "each entry must be a (type, actor, payload, event_id) tuple"
                )
            validated.append(self._validate_entry(*entry))

        try:
            self._conn.execute("BEGIN IMMEDIATE")
        except sqlite3.Error as exc:
            raise IntegrityError(f"cannot start ledger transaction: {exc}") from exc
        try:
            seq, prev_hash = self._chain_tip(domain_id)
            events: list[Event] = []
            for type_name, actor, payload, event_id in validated:
                seq += 1
                event = self._insert_within_transaction(
                    domain_id, type_name, actor, payload, event_id, seq, prev_hash
                )
                prev_hash = event.event_hash
                events.append(event)
            self._conn.execute("COMMIT")
        except BaseException:
            self._rollback_quietly()
            raise
        return events

    def _rollback_quietly(self) -> None:
        try:
            self._conn.execute("ROLLBACK")
        except sqlite3.Error:
            # Never mask the original failure with a rollback failure; with
            # no transaction open there is nothing left to roll back.
            pass

    def append(
        self,
        domain_id: str,
        event_type: str,
        actor: Actor,
        payload: dict[str, Any],
        event_id: str | None = None,
    ) -> Event:
        """Append one event in its own committed transaction.

        The commit happens before this method returns, so an audit event (for
        example ``permission.denied``) survives any exception the caller
        raises immediately afterwards.
        """

        return self._append_entries(
            domain_id, [(event_type, actor, payload, event_id)]
        )[0]

    def append_batch(
        self,
        domain_id: str,
        entries: Sequence[tuple[str, Actor, dict[str, Any], str | None]],
    ) -> list[Event]:
        """Append several events atomically: all committed or none."""

        return self._append_entries(domain_id, entries)

    # -- verified reads ---------------------------------------------------

    def events(self, domain_id: str) -> list[Event]:
        """Return the domain's events after re-verifying the full chain."""

        self._require_open()
        _nonempty_string(domain_id, "domain_id")
        try:
            rows = self._conn.execute(
                "SELECT seq, event_id, type, schema_version, actor_kind,"
                " actor_id, payload, prev_hash, event_hash FROM events"
                " WHERE domain_id = ? ORDER BY seq",
                (domain_id,),
            ).fetchall()
        except sqlite3.Error as exc:
            raise IntegrityError(f"cannot read ledger events: {exc}") from exc

        events: list[Event] = []
        expected_prev: str | None = None
        for index, row in enumerate(rows):
            (
                seq,
                event_id,
                type_name,
                schema_version,
                actor_kind,
                actor_id,
                payload_text,
                prev_hash,
                event_hash,
            ) = row
            if seq != index + 1:
                raise IntegrityError(
                    f"ledger chain for {domain_id} has a sequence gap at {seq}"
                )
            try:
                payload = json.loads(payload_text)
            except ValueError as exc:
                raise IntegrityError(
                    f"ledger event {domain_id}/{seq} payload is not valid JSON"
                ) from exc
            try:
                event = Event(
                    event_id=event_id,
                    domain_id=domain_id,
                    seq=seq,
                    type=type_name,
                    schema_version=schema_version,
                    actor=Actor(kind=actor_kind, actor_id=actor_id),
                    payload=payload,
                    prev_hash=prev_hash,
                    event_hash=event_hash,
                )
            except ValidationError as exc:
                raise IntegrityError(
                    f"ledger event {domain_id}/{seq} is malformed: {exc}"
                ) from exc
            if event.prev_hash != expected_prev:
                raise IntegrityError(
                    f"ledger chain for {domain_id} is broken at seq {seq}"
                )
            recomputed = canonical_json_hash(event.to_hash_dict())
            if recomputed != event.event_hash:
                raise IntegrityError(
                    f"ledger event {domain_id}/{seq} failed hash verification"
                )
            expected_prev = event.event_hash
            events.append(event)
        return events

    def verify_chain(self, domain_id: str) -> int:
        """Verify the whole domain chain and return the verified event count."""

        return len(self.events(domain_id))

    def domains(self) -> list[str]:
        """Return every domain id present in the ledger, sorted."""

        self._require_open()
        rows = self._conn.execute(
            "SELECT DISTINCT domain_id FROM events ORDER BY domain_id"
        ).fetchall()
        return [str(row[0]) for row in rows]
