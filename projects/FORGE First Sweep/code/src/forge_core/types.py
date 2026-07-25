"""Small, versioned value types shared by the Phase 0 spine."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
import re
from typing import Any, ClassVar, Mapping


SCHEMA_VERSION = 1

_ACTOR_KINDS = frozenset({"human", "model", "system"})
_SHA256_RE = re.compile(r"[0-9a-f]{64}\Z")


class ForgeError(Exception):
    """Base class for expected FORGE failures."""


class ValidationError(ForgeError):
    """Input does not satisfy a public FORGE contract."""


class IntegrityError(ForgeError):
    """Stored content or history failed an integrity check."""


class AuthorizationError(ForgeError):
    """An actor is not authorized to perform an operation."""


class StateTransitionError(ForgeError):
    """A requested transition is invalid for the current state."""


def _nonempty_string(value: object, field: str) -> str:
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be a string")
    if not value or value != value.strip():
        raise ValidationError(f"{field} must be non-empty with no surrounding whitespace")
    return value


def _schema_version(value: object) -> int:
    if type(value) is not int or value != SCHEMA_VERSION:
        raise ValidationError(f"schema_version must be {SCHEMA_VERSION}")
    return value


def _sha256_digest(value: object, field: str) -> str:
    if not isinstance(value, str) or _SHA256_RE.fullmatch(value) is None:
        raise ValidationError(f"{field} must be a lowercase sha256 hex digest")
    return value


def _exact_keys(value: Mapping[str, Any], expected: set[str], name: str) -> None:
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        details: list[str] = []
        if missing:
            details.append(f"missing={missing}")
        if extra:
            details.append(f"extra={extra}")
        raise ValidationError(f"invalid {name} fields ({', '.join(details)})")


@dataclass(frozen=True, slots=True)
class Actor:
    """An explicitly typed authority principal.

    Actor kind is data, not something inferred from an identifier or model
    output.  The three constructors make call sites state that kind visibly.
    """

    kind: str
    actor_id: str

    ALLOWED_KINDS: ClassVar[frozenset[str]] = _ACTOR_KINDS

    def __post_init__(self) -> None:
        if not isinstance(self.kind, str) or self.kind not in self.ALLOWED_KINDS:
            raise ValidationError(
                f"actor kind must be one of {sorted(self.ALLOWED_KINDS)}"
            )
        _nonempty_string(self.actor_id, "actor_id")

    @classmethod
    def human(cls, actor_id: str) -> Actor:
        return cls("human", actor_id)

    @classmethod
    def model(cls, actor_id: str) -> Actor:
        return cls("model", actor_id)

    @classmethod
    def system(cls, actor_id: str) -> Actor:
        return cls("system", actor_id)

    def to_dict(self) -> dict[str, str]:
        return {"kind": self.kind, "actor_id": self.actor_id}

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> Actor:
        if not isinstance(value, Mapping):
            raise ValidationError("actor must be an object")
        _exact_keys(value, {"kind", "actor_id"}, "actor")
        return cls(kind=value["kind"], actor_id=value["actor_id"])


@dataclass(frozen=True, slots=True)
class ArtifactRef:
    """Versioned reference to one immutable sha256-addressed blob."""

    schema_version: int
    digest: str
    size: int
    algorithm: str = "sha256"

    def __post_init__(self) -> None:
        _schema_version(self.schema_version)
        if self.algorithm != "sha256":
            raise ValidationError("artifact algorithm must be 'sha256'")
        _sha256_digest(self.digest, "artifact digest")
        if type(self.size) is not int or self.size < 0:
            raise ValidationError("artifact size must be a non-negative integer")

    @property
    def content_hash(self) -> str:
        """Readable alias for payload schemas that describe a content hash."""

        return self.digest

    def to_dict(self) -> dict[str, str | int]:
        return {
            "schema_version": self.schema_version,
            "algorithm": self.algorithm,
            "digest": self.digest,
            "size": self.size,
        }

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> ArtifactRef:
        if not isinstance(value, Mapping):
            raise ValidationError("artifact ref must be an object")
        _exact_keys(
            value,
            {"schema_version", "algorithm", "digest", "size"},
            "artifact ref",
        )
        return cls(
            schema_version=value["schema_version"],
            algorithm=value["algorithm"],
            digest=value["digest"],
            size=value["size"],
        )


@dataclass(frozen=True, slots=True)
class Event:
    """A complete immutable-ledger event value.

    ``payload`` is defensively deep-copied at construction and when serialized
    so mutations to caller-owned dictionaries cannot silently alter a pending
    event or a returned wire representation.
    """

    event_id: str
    domain_id: str
    seq: int
    type: str
    schema_version: int
    actor: Actor
    payload: dict[str, Any]
    prev_hash: str | None
    event_hash: str

    def __post_init__(self) -> None:
        _nonempty_string(self.event_id, "event_id")
        _nonempty_string(self.domain_id, "domain_id")
        if type(self.seq) is not int or self.seq < 1:
            raise ValidationError("seq must be a positive integer")
        _nonempty_string(self.type, "event type")
        _schema_version(self.schema_version)
        if not isinstance(self.actor, Actor):
            raise ValidationError("actor must be an Actor")
        if type(self.payload) is not dict:
            raise ValidationError("payload must be a dict")
        if any(not isinstance(key, str) for key in self.payload):
            raise ValidationError("payload keys must be strings")
        if self.prev_hash is not None:
            _sha256_digest(self.prev_hash, "prev_hash")
        _sha256_digest(self.event_hash, "event_hash")
        object.__setattr__(self, "payload", deepcopy(self.payload))

    def to_hash_dict(self) -> dict[str, Any]:
        """Return exactly the fields committed to by ``event_hash``."""

        return {
            "event_id": self.event_id,
            "domain_id": self.domain_id,
            "seq": self.seq,
            "type": self.type,
            "schema_version": self.schema_version,
            "actor": self.actor.to_dict(),
            "payload": deepcopy(self.payload),
            "prev_hash": self.prev_hash,
        }

    def to_dict(self) -> dict[str, Any]:
        value = self.to_hash_dict()
        value["event_hash"] = self.event_hash
        return value

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> Event:
        if not isinstance(value, Mapping):
            raise ValidationError("event must be an object")
        _exact_keys(
            value,
            {
                "event_id",
                "domain_id",
                "seq",
                "type",
                "schema_version",
                "actor",
                "payload",
                "prev_hash",
                "event_hash",
            },
            "event",
        )
        actor = value["actor"]
        return cls(
            event_id=value["event_id"],
            domain_id=value["domain_id"],
            seq=value["seq"],
            type=value["type"],
            schema_version=value["schema_version"],
            actor=actor if isinstance(actor, Actor) else Actor.from_dict(actor),
            payload=value["payload"],
            prev_hash=value["prev_hash"],
            event_hash=value["event_hash"],
        )
