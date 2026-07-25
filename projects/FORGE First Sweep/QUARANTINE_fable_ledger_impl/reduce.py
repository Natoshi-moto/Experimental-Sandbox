"""Deterministic projections rebuilt from domain events only.

``reduce_events`` is a pure function of an ordered event list: no database
handle, no clock, no randomness, no mutable module state.  Given the same
events it returns the same projection, which is what makes replay after a
restart independently checkable.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Iterable

from .types import Event, ValidationError


PROJECTION_SCHEMA_VERSION = 1

_RUN_STATUS_BY_TYPE = {
    "run.created": "created",
    "run.started": "started",
    "run.completed": "completed",
    "run.failed": "failed",
}


@dataclass(frozen=True, slots=True)
class Projection:
    """Immutable snapshot of everything Phase 0 treats as derived truth."""

    schema_version: int
    domain_id: str | None
    run_status: str | None
    signals: tuple[dict[str, Any], ...]
    canon_head: str | None
    denials: tuple[dict[str, Any], ...]
    event_count: int

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-native form that survives a dumps/loads round trip."""

        return {
            "schema_version": self.schema_version,
            "domain_id": self.domain_id,
            "run_status": self.run_status,
            "signals": [deepcopy(signal) for signal in self.signals],
            "canon_head": self.canon_head,
            "denials": [deepcopy(denial) for denial in self.denials],
            "event_count": self.event_count,
        }


def reduce_events(events: Iterable[Event]) -> Projection:
    """Fold an ordered domain event list into a :class:`Projection`."""

    ordered = list(events)
    domain_id: str | None = None
    run_status: str | None = None
    signals: list[dict[str, Any]] = []
    canon_head: str | None = None
    denials: list[dict[str, Any]] = []

    for index, event in enumerate(ordered):
        if not isinstance(event, Event):
            raise ValidationError("reduce_events accepts Event values only")
        if event.seq != index + 1:
            raise ValidationError(
                f"event list is not a contiguous domain history at seq {event.seq}"
            )
        if domain_id is None:
            domain_id = event.domain_id
        elif event.domain_id != domain_id:
            raise ValidationError("reduce_events accepts a single domain only")

        payload = event.payload
        try:
            if event.type in _RUN_STATUS_BY_TYPE:
                run_status = _RUN_STATUS_BY_TYPE[event.type]
            elif event.type == "signal.proposed":
                signals.append(
                    {
                        "signal_id": payload["signal_id"],
                        "artifact_hash": payload["artifact_hash"],
                        "summary": payload["summary"],
                        "actor_kind": event.actor.kind,
                        "actor_id": event.actor.actor_id,
                    }
                )
            elif event.type == "canon.revision_created":
                canon_head = payload["revision_id"]
            elif event.type == "permission.denied":
                denials.append(
                    {
                        "operation": payload["operation"],
                        "reason": payload["reason"],
                        "subject_kind": payload["subject_kind"],
                        "subject_id": payload["subject_id"],
                    }
                )
        except KeyError as exc:
            raise ValidationError(
                f"event {event.domain_id}/{event.seq} payload lacks {exc.args[0]!r}"
            ) from exc

    return Projection(
        schema_version=PROJECTION_SCHEMA_VERSION,
        domain_id=domain_id,
        run_status=run_status,
        signals=tuple(signals),
        canon_head=canon_head,
        denials=tuple(denials),
        event_count=len(ordered),
    )
