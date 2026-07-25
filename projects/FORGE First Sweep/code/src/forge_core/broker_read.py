from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Mapping
from uuid import uuid4

from .artifacts import ArtifactStore
from .capability import CapabilityEngine
from .hashutil import canonical_json_bytes
from .ledger import EventLedger
from .types import Actor, ArtifactRef, AuthorizationError, ValidationError


@dataclass(frozen=True, slots=True)
class SnapshotRef:
    schema_version: int
    snapshot_id: str
    manifest: ArtifactRef


def _validate_source_path(path: str) -> None:
    if not isinstance(path, str) or not path or "\x00" in path or "\\" in path:
        raise ValidationError("source path must be a non-empty POSIX path")
    parsed = PurePosixPath(path)
    if parsed.is_absolute() or any(part in {"", ".", ".."} for part in parsed.parts):
        raise ValidationError(f"unsafe source path: {path!r}")


@dataclass(slots=True)
class ReadBroker:
    store: ArtifactStore
    ledger: EventLedger
    capabilities: CapabilityEngine

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

    def import_snapshot(
        self,
        domain_id: str,
        actor: Actor,
        sources: Mapping[str, bytes],
    ) -> SnapshotRef:
        if not isinstance(actor, Actor):
            raise ValidationError("actor must be an Actor")
        if actor.kind not in {"human", "system"}:
            self._deny(
                domain_id,
                actor,
                "source.import",
                "only a human or system actor may import a source snapshot",
            )
        if not isinstance(sources, Mapping) or not sources:
            raise ValidationError("sources must be a non-empty mapping")

        entries: list[dict[str, object]] = []
        for path in sorted(sources):
            _validate_source_path(path)
            content = sources[path]
            if not isinstance(content, bytes):
                raise ValidationError(f"source {path!r} must contain bytes")
            artifact = self.store.put(content)
            entries.append(
                {
                    "path": path,
                    "content_hash": artifact.digest,
                    "size": artifact.size,
                }
            )

        manifest = self.store.put(
            canonical_json_bytes({"schema_version": 1, "entries": entries})
        )
        snapshot_id = f"snapshot-{uuid4()}"
        self.ledger.append(
            domain_id,
            "source.imported",
            actor,
            {
                "snapshot_id": snapshot_id,
                "manifest_hash": manifest.digest,
                "entries": entries,
            },
        )
        return SnapshotRef(1, snapshot_id, manifest)

    def _entry(self, domain_id: str, snapshot_id: str, path: str) -> dict[str, object]:
        for event in self.ledger.events(domain_id):
            if (
                event.type == "source.imported"
                and event.payload["snapshot_id"] == snapshot_id
            ):
                for entry in event.payload["entries"]:
                    if entry["path"] == path:
                        return dict(entry)
                raise ValidationError(f"path {path!r} is not in snapshot {snapshot_id}")
        raise ValidationError(f"unknown snapshot: {snapshot_id}")

    def disclose(
        self,
        domain_id: str,
        actor: Actor,
        subject: Actor,
        snapshot_id: str,
        path: str,
    ) -> str:
        if not isinstance(actor, Actor) or not isinstance(subject, Actor):
            raise ValidationError("actor and subject must be Actor values")
        if actor.kind != "human":
            self._deny(
                domain_id,
                actor,
                "source.disclose",
                "only a human actor may disclose source bytes",
            )
        entry = self._entry(domain_id, snapshot_id, path)
        disclosure_id = f"disclosure-{uuid4()}"
        self.ledger.append(
            domain_id,
            "source.exposed",
            actor,
            {
                "disclosure_id": disclosure_id,
                "snapshot_id": snapshot_id,
                "path": path,
                "content_hash": entry["content_hash"],
                "subject_kind": subject.kind,
                "subject_id": subject.actor_id,
            },
        )
        return disclosure_id

    def _is_disclosed(
        self,
        domain_id: str,
        subject: Actor,
        snapshot_id: str,
        path: str,
        content_hash: str,
    ) -> bool:
        return any(
            event.type == "source.exposed"
            and event.payload["snapshot_id"] == snapshot_id
            and event.payload["path"] == path
            and event.payload["content_hash"] == content_hash
            and event.payload["subject_kind"] == subject.kind
            and event.payload["subject_id"] == subject.actor_id
            for event in self.ledger.events(domain_id)
        )

    def read(
        self,
        domain_id: str,
        subject: Actor,
        snapshot_id: str,
        path: str,
    ) -> bytes:
        entry = self._entry(domain_id, snapshot_id, path)
        self.capabilities.require(domain_id, subject, "source.read", snapshot_id)
        content_hash = str(entry["content_hash"])
        if not self._is_disclosed(
            domain_id, subject, snapshot_id, path, content_hash
        ):
            self._deny(
                domain_id,
                subject,
                "source.read",
                f"source {snapshot_id}:{path} has not been disclosed to the subject",
            )
        return self.store._read_verified(content_hash)

