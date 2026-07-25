from __future__ import annotations

import pytest

from forge_core import Actor, AuthorizationError, Forge


def _attempt_output(forge: Forge, run_id: str, human: Actor, model: Actor) -> str:
    snapshot = forge.import_sources(run_id, human, {"claim.txt": b"candidate"})
    forge.grant_capability(
        run_id, human, model, "source.read", snapshot.snapshot_id
    )
    forge.disclose_source(
        run_id, human, model, snapshot.snapshot_id, "claim.txt"
    )
    context = forge.compile_context(
        run_id, model, snapshot.snapshot_id, ["claim.txt"]
    )
    workflow = forge.compile_workflow(
        {
            "id": "smoke.council_lite",
            "version": 1,
            "nodes": [{"id": "think", "kind": "fake_model", "lens": None}],
            "gates": {"promote_canon": "human_only"},
        }
    )
    return forge.execute_fake(
        run_id, model, workflow, context.artifact.digest
    ).output.digest


def test_model_cannot_open_gate_or_create_canon(tmp_path) -> None:
    human = Actor.human("operator")
    model = Actor.model("fake-worker")

    with Forge(tmp_path / "forge-data") as forge:
        run_id = forge.create_run(human, "run-model-canon")
        forge.start_run(run_id, human)
        artifact_hash = _attempt_output(forge, run_id, human, model)

        with pytest.raises(AuthorizationError, match="human actor"):
            forge.open_canon_gate(run_id, model, artifact_hash)
        with pytest.raises(AuthorizationError, match="human actor"):
            forge.promote_canon(
                run_id, model, "model-invented-nonce", artifact_hash
            )

        assert forge.projection(run_id).canon_head is None
        assert not any(
            event.type in {"human.gate_opened", "canon.revision_created"}
            and event.actor.kind == "model"
            for event in forge.events(run_id)
        )


def test_human_promotion_consumes_nonce_once(tmp_path) -> None:
    human = Actor.human("operator")
    model = Actor.model("fake-worker")

    with Forge(tmp_path / "forge-data") as forge:
        run_id = forge.create_run(human, "run-human-canon")
        forge.start_run(run_id, human)
        artifact_hash = _attempt_output(forge, run_id, human, model)
        gate = forge.open_canon_gate(run_id, human, artifact_hash)
        revision_id = forge.promote_canon(
            run_id, human, gate.decision_nonce, artifact_hash
        )
        assert forge.projection(run_id).canon_head == revision_id

        with pytest.raises(AuthorizationError):
            forge.promote_canon(
                run_id, human, gate.decision_nonce, artifact_hash
            )
        assert forge.projection(run_id).canon_head == revision_id
        assert sum(
            event.type == "canon.revision_created"
            for event in forge.events(run_id)
        ) == 1

