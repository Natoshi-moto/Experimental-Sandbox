from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from .artifacts import ArtifactStore
from .hashutil import canonical_json_bytes
from .ledger import EventLedger
from .types import Actor, ArtifactRef, ValidationError
from .workflow import Node


@dataclass(frozen=True, slots=True)
class AttemptRef:
    attempt_id: str
    output: ArtifactRef


@dataclass(slots=True)
class FakeAdapter:
    store: ArtifactStore
    ledger: EventLedger

    def execute(
        self,
        domain_id: str,
        actor: Actor,
        node: Node,
        context_hash: str,
    ) -> AttemptRef:
        if not isinstance(actor, Actor) or actor.kind != "model":
            raise ValidationError("the fake adapter requires a model actor")
        if node.kind != "fake_model":
            raise ValidationError("the fake adapter only executes fake_model nodes")
        self.store.verify(context_hash)

        attempt_id = f"attempt-{uuid4()}"
        output = self.store.put(
            canonical_json_bytes(
                {
                    "schema_version": 1,
                    "adapter": "fake",
                    "node_id": node.id,
                    "lens": node.lens,
                    "context_hash": context_hash,
                    "message": "deterministic fake response",
                }
            )
        )
        self.ledger.append_batch(
            domain_id,
            [
                (
                    "attempt.started",
                    actor,
                    {
                        "attempt_id": attempt_id,
                        "node_id": node.id,
                        "context_hash": context_hash,
                    },
                    None,
                ),
                (
                    "attempt.output_received",
                    actor,
                    {"attempt_id": attempt_id, "artifact_hash": output.digest},
                    None,
                ),
                (
                    "attempt.succeeded",
                    actor,
                    {"attempt_id": attempt_id},
                    None,
                ),
            ],
        )
        return AttemptRef(attempt_id, output)
