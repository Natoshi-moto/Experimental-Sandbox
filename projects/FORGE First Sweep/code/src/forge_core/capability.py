from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from .ledger import EventLedger
from .types import Actor, AuthorizationError, ValidationError


def _require_actor(actor: Actor) -> None:
    if not isinstance(actor, Actor):
        raise ValidationError("actor must be an Actor")


@dataclass(slots=True)
class CapabilityEngine:
    """Event-backed capability and policy checks.

    This class is an internal service. ``Forge`` is the supported public
    authority boundary.
    """

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

    def grant(
        self,
        domain_id: str,
        actor: Actor,
        subject: Actor,
        capability: str,
        resource: str = "*",
    ) -> str:
        _require_actor(actor)
        _require_actor(subject)
        if actor.kind != "human":
            self._deny(
                domain_id,
                actor,
                "capability.grant",
                "only a human actor may grant capabilities",
            )
        if not capability or not isinstance(capability, str):
            raise ValidationError("capability must be a non-empty string")
        if not resource or not isinstance(resource, str):
            raise ValidationError("resource must be a non-empty string")
        grant_id = f"grant-{uuid4()}"
        self.ledger.append(
            domain_id,
            "capability.granted",
            actor,
            {
                "grant_id": grant_id,
                "subject_kind": subject.kind,
                "subject_id": subject.actor_id,
                "capability": capability,
                "resource": resource,
            },
        )
        return grant_id

    def has(
        self,
        domain_id: str,
        subject: Actor,
        capability: str,
        resource: str,
    ) -> bool:
        _require_actor(subject)
        for event in self.ledger.events(domain_id):
            if event.type != "capability.granted":
                continue
            payload = event.payload
            if (
                payload["subject_kind"] == subject.kind
                and payload["subject_id"] == subject.actor_id
                and payload["capability"] == capability
                and payload["resource"] in {"*", resource}
            ):
                return True
        return False

    def require(
        self,
        domain_id: str,
        subject: Actor,
        capability: str,
        resource: str,
    ) -> None:
        if not self.has(domain_id, subject, capability, resource):
            self._deny(
                domain_id,
                subject,
                capability,
                f"{subject.kind}:{subject.actor_id} lacks {capability} for {resource}",
            )

    def change_policy(
        self,
        domain_id: str,
        actor: Actor,
        policy: str,
        value: Any,
    ) -> None:
        _require_actor(actor)
        if actor.kind != "human":
            self._deny(
                domain_id,
                actor,
                "policy.change",
                "only a human actor may change policy",
            )
        if not policy or not isinstance(policy, str):
            raise ValidationError("policy must be a non-empty string")
        self.ledger.append(
            domain_id,
            "policy.changed",
            actor,
            {"policy": policy, "value": value},
        )

