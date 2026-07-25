from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from forge_core.hashutil import (
    canonical_json_bytes,
    canonical_json_hash,
    sha256_hex,
)
from forge_core.types import (
    SCHEMA_VERSION,
    Actor,
    ArtifactRef,
    Event,
    ValidationError,
)


def test_canonical_json_is_sorted_compact_and_utf8() -> None:
    left = {"z": [True, None], "a": "café"}
    right = {"a": "café", "z": [True, None]}

    expected = '{"a":"café","z":[true,null]}'.encode()
    assert canonical_json_bytes(left) == expected
    assert canonical_json_bytes(right) == expected
    assert canonical_json_hash(left) == sha256_hex(expected)


@pytest.mark.parametrize("number", [float("nan"), float("inf"), float("-inf")])
def test_canonical_json_rejects_non_finite_numbers(number: float) -> None:
    with pytest.raises(ValidationError):
        canonical_json_bytes({"nested": [number]})


@pytest.mark.parametrize(
    "value",
    [
        {1: "coercion would be ambiguous"},
        {"bytes": b"not JSON"},
        {"set": {"not", "JSON"}},
    ],
)
def test_canonical_json_rejects_non_json_values(value: object) -> None:
    with pytest.raises(ValidationError):
        canonical_json_bytes(value)


def test_actor_is_strict_frozen_and_round_trips() -> None:
    actor = Actor.model("worker-1")
    assert actor.to_dict() == {"kind": "model", "actor_id": "worker-1"}
    assert Actor.from_dict(actor.to_dict()) == actor

    with pytest.raises(FrozenInstanceError):
        actor.kind = "human"  # type: ignore[misc]
    with pytest.raises(ValidationError):
        Actor("administrator", "worker-1")
    with pytest.raises(ValidationError):
        Actor.human(" ")
    with pytest.raises(ValidationError):
        Actor.from_dict({"kind": "human", "actor_id": "h", "admin": True})


def test_artifact_ref_is_versioned_and_strict() -> None:
    ref = ArtifactRef(
        schema_version=SCHEMA_VERSION,
        algorithm="sha256",
        digest="a" * 64,
        size=12,
    )
    assert ArtifactRef.from_dict(ref.to_dict()) == ref
    assert ref.content_hash == "a" * 64

    with pytest.raises(ValidationError):
        ArtifactRef(2, "a" * 64, 12)
    with pytest.raises(ValidationError):
        ArtifactRef(SCHEMA_VERSION, "../escape", 12)
    with pytest.raises(ValidationError):
        ArtifactRef(SCHEMA_VERSION, "a" * 64, True)


def test_event_defensively_copies_payload_and_has_stable_wire_shape() -> None:
    payload = {"nested": {"answer": 1}}
    event = Event(
        event_id="evt-1",
        domain_id="run-1",
        seq=1,
        type="run.created",
        schema_version=SCHEMA_VERSION,
        actor=Actor.system("forge"),
        payload=payload,
        prev_hash=None,
        event_hash="0" * 64,
    )
    payload["nested"]["answer"] = 2

    assert event.payload["nested"]["answer"] == 1
    assert "event_hash" not in event.to_hash_dict()
    assert Event.from_dict(event.to_dict()) == event
