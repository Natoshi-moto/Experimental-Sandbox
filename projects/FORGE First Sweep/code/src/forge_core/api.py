from __future__ import annotations

import base64
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence
from uuid import uuid4

from .adapter_fake import AttemptRef, FakeAdapter
from .artifacts import ArtifactStore
from .broker_read import ReadBroker, SnapshotRef
from .canon import CanonAuthority, GateRef
from .capability import CapabilityEngine
from .hashutil import canonical_json_bytes
from .ledger import EventLedger
from .reduce import Projection, reduce_events
from .types import (
    Actor,
    ArtifactRef,
    AuthorizationError,
    Event,
    ValidationError,
)
from .workflow import WorkflowIR, compile_workflow


@dataclass(frozen=True, slots=True)
class ContextRef:
    context_id: str
    artifact: ArtifactRef


class Forge:
    """Supported public façade for the Phase 0 spine."""

    def __init__(self, data_dir: str | Path) -> None:
        if not isinstance(data_dir, (str, Path)):
            raise ValidationError("data_dir must be a filesystem path")
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir = self.data_dir.resolve(strict=True)

        self._store = ArtifactStore(self.data_dir)
        self._ledger = EventLedger(self.data_dir)
        self._capabilities = CapabilityEngine(self._ledger)
        self._broker = ReadBroker(self._store, self._ledger, self._capabilities)
        self._canon = CanonAuthority(self._ledger)
        self._adapter = FakeAdapter(self._store, self._ledger)

    def close(self) -> None:
        close = getattr(self._ledger, "close", None)
        if close is not None:
            close()

    def __enter__(self) -> Forge:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    @staticmethod
    def _require_actor(actor: Actor) -> None:
        if not isinstance(actor, Actor):
            raise ValidationError("actor must be an Actor")

    def _require_host_actor(
        self, domain_id: str, actor: Actor, operation: str
    ) -> None:
        self._require_actor(actor)
        if actor.kind in {"human", "system"}:
            return
        self._ledger.append(
            domain_id,
            "permission.denied",
            actor,
            {
                "operation": operation,
                "reason": "operation requires a human or system actor",
                "subject_kind": actor.kind,
                "subject_id": actor.actor_id,
            },
        )
        raise AuthorizationError("operation requires a human or system actor")

    def create_run(self, actor: Actor, run_id: str | None = None) -> str:
        run_id = run_id or f"run-{uuid4()}"
        self._require_host_actor(run_id, actor, "run.create")
        self._ledger.append(
            run_id,
            "run.created",
            actor,
            {"run_id": run_id},
        )
        return run_id

    def start_run(self, run_id: str, actor: Actor) -> None:
        self._require_host_actor(run_id, actor, "run.start")
        self._ledger.append(
            run_id,
            "run.started",
            actor,
            {"run_id": run_id},
        )

    def complete_run(self, run_id: str, actor: Actor) -> None:
        self._require_host_actor(run_id, actor, "run.complete")
        self._ledger.append(
            run_id,
            "run.completed",
            actor,
            {"run_id": run_id},
        )

    def fail_run(self, run_id: str, actor: Actor, reason: str) -> None:
        self._require_host_actor(run_id, actor, "run.fail")
        self._ledger.append(
            run_id,
            "run.failed",
            actor,
            {"run_id": run_id, "reason": reason},
        )

    def import_sources(
        self,
        run_id: str,
        actor: Actor,
        sources: Mapping[str, bytes],
    ) -> SnapshotRef:
        return self._broker.import_snapshot(run_id, actor, sources)

    def grant_capability(
        self,
        run_id: str,
        actor: Actor,
        subject: Actor,
        capability: str,
        resource: str = "*",
    ) -> str:
        return self._capabilities.grant(
            run_id, actor, subject, capability, resource
        )

    def disclose_source(
        self,
        run_id: str,
        actor: Actor,
        subject: Actor,
        snapshot_id: str,
        path: str,
    ) -> str:
        return self._broker.disclose(
            run_id, actor, subject, snapshot_id, path
        )

    def read_source(
        self,
        run_id: str,
        subject: Actor,
        snapshot_id: str,
        path: str,
    ) -> bytes:
        return self._broker.read(run_id, subject, snapshot_id, path)

    def compile_context(
        self,
        run_id: str,
        subject: Actor,
        snapshot_id: str,
        paths: Sequence[str],
    ) -> ContextRef:
        self._require_actor(subject)
        if (
            not isinstance(paths, Sequence)
            or isinstance(paths, (str, bytes))
            or not paths
        ):
            raise ValidationError("paths must be a non-empty sequence")
        sources: list[dict[str, str]] = []
        seen_paths: set[str] = set()
        for path in paths:
            if not isinstance(path, str):
                raise ValidationError("context paths must be strings")
            if path in seen_paths:
                raise ValidationError("context paths must be unique")
            seen_paths.add(path)
            content = self._broker.read(run_id, subject, snapshot_id, path)
            sources.append(
                {
                    "path": path,
                    "content_base64": base64.b64encode(content).decode("ascii"),
                }
            )

        artifact = self._store.put(
            canonical_json_bytes(
                {
                    "schema_version": 1,
                    "snapshot_id": snapshot_id,
                    "sources": sources,
                }
            )
        )
        context_id = f"context-{uuid4()}"
        self._ledger.append(
            run_id,
            "context.compiled",
            subject,
            {
                "context_id": context_id,
                "snapshot_id": snapshot_id,
                "paths": list(paths),
                "artifact_hash": artifact.digest,
            },
        )
        return ContextRef(context_id, artifact)

    @staticmethod
    def compile_workflow(document: dict[object, object]) -> WorkflowIR:
        return compile_workflow(document)

    def execute_fake(
        self,
        run_id: str,
        actor: Actor,
        workflow: WorkflowIR,
        context_hash: str,
    ) -> AttemptRef:
        if not isinstance(workflow, WorkflowIR):
            raise ValidationError("workflow must be a compiled WorkflowIR")
        if len(workflow.nodes) != 1:
            raise ValidationError("Phase 0 execution accepts one workflow node")
        return self._adapter.execute(
            run_id, actor, workflow.nodes[0], context_hash
        )

    def propose_signal(
        self,
        run_id: str,
        actor: Actor,
        artifact_hash: str,
        summary: str,
    ) -> str:
        self._require_actor(actor)
        if actor.kind not in {"model", "human"}:
            raise AuthorizationError("only model or human actors may propose signals")
        if not isinstance(summary, str) or not summary:
            raise ValidationError("summary must be a non-empty string")
        self._store.verify(artifact_hash)
        signal_id = f"signal-{uuid4()}"
        self._ledger.append(
            run_id,
            "signal.proposed",
            actor,
            {
                "signal_id": signal_id,
                "artifact_hash": artifact_hash,
                "summary": summary,
            },
        )
        return signal_id

    def open_canon_gate(
        self,
        run_id: str,
        actor: Actor,
        artifact_hash: str,
    ) -> GateRef:
        self._store.verify(artifact_hash)
        return self._canon.open_gate(run_id, actor, artifact_hash)

    def promote_canon(
        self,
        run_id: str,
        actor: Actor,
        decision_nonce: str,
        artifact_hash: str,
    ) -> str:
        self._store.verify(artifact_hash)
        return self._canon.promote(
            run_id, actor, decision_nonce, artifact_hash
        )

    def change_policy(
        self,
        run_id: str,
        actor: Actor,
        policy: str,
        value: Any,
    ) -> None:
        self._capabilities.change_policy(run_id, actor, policy, value)

    def events(self, run_id: str) -> tuple[Event, ...]:
        return tuple(self._ledger.events(run_id))

    def projection(self, run_id: str) -> Projection:
        return reduce_events(self._ledger.events(run_id))
