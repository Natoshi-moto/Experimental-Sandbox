from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from .ledger import EventLedger
from .types import (
    Actor,
    AuthorizationError,
    StateTransitionError,
    ValidationError,
)


@dataclass(frozen=True, slots=True)
class GateRef:
    gate_id: str
    decision_nonce: str
    artifact_hash: str


@dataclass(slots=True)
class CanonAuthority:
    ledger: EventLedger

    def _deny(
        self,
        domain_id: str,
        actor: Actor,
        operation: str,
        reason: str,
    ) -> None:
        self.ledger.append(
            domain_id,
            "permission.denied",
            actor,
            {
                "operation": operation,
                "reason": reason,
                "subject_kind": actor.kind,
                "subject_id": actor.actor_id,
            },
        )
        raise AuthorizationError(reason)

    def open_gate(
        self,
        domain_id: str,
        actor: Actor,
        artifact_hash: str,
    ) -> GateRef:
        if not isinstance(actor, Actor):
            raise ValidationError("actor must be an Actor")
        if actor.kind != "human":
            self._deny(
                domain_id,
                actor,
                "human.gate_open",
                "only a human actor may open a human gate",
            )
        gate = GateRef(
            gate_id=f"gate-{uuid4()}",
            decision_nonce=f"nonce-{uuid4().hex}",
            artifact_hash=artifact_hash,
        )
        self.ledger.append(
            domain_id,
            "human.gate_opened",
            actor,
            {
                "gate_id": gate.gate_id,
                "decision_nonce": gate.decision_nonce,
                "artifact_hash": gate.artifact_hash,
            },
        )
        return gate

    def promote(
        self,
        domain_id: str,
        actor: Actor,
        decision_nonce: str,
        artifact_hash: str,
    ) -> str:
        if not isinstance(actor, Actor):
            raise ValidationError("actor must be an Actor")
        if actor.kind != "human":
            self._deny(
                domain_id,
                actor,
                "canon.promote",
                "only a human actor may create a canon revision",
            )

        gate_event = next(
            (
                event
                for event in self.ledger.events(domain_id)
                if event.type == "human.gate_opened"
                and event.payload["decision_nonce"] == decision_nonce
            ),
            None,
        )
        if gate_event is None:
            self._deny(
                domain_id,
                actor,
                "canon.promote",
                "decision nonce does not identify an open human gate",
            )

        decision_id = f"decision-{uuid4()}"
        revision_id = f"revision-{uuid4()}"
        try:
            self.ledger.append_batch(
                domain_id,
                [
                    (
                        "human.decision_recorded",
                        actor,
                        {
                            "decision_id": decision_id,
                            "gate_id": gate_event.payload["gate_id"],
                            "decision_nonce": decision_nonce,
                            "approved": True,
                            "artifact_hash": artifact_hash,
                        },
                        None,
                    ),
                    (
                        "canon.revision_created",
                        actor,
                        {
                            "revision_id": revision_id,
                            "artifact_hash": artifact_hash,
                            "decision_nonce": decision_nonce,
                        },
                        None,
                    ),
                ],
            )
        except (StateTransitionError, ValidationError) as exc:
            self._deny(domain_id, actor, "canon.promote", str(exc))
        return revision_id

