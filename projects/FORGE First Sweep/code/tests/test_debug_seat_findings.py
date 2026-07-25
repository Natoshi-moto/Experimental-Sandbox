"""Findings from the Anthropic debug seat against the nine Codex modules.

These tests pin defects and declared-vs-enforced gaps found while attacking
the existing build.  They are written to stay green so the suite reports the
true state of the code, while `xfail(strict=True)` makes a silent behavior
change impossible: if a gap is fixed, the test reports XPASS and demands that
this file and RESULTS be updated.
"""

from __future__ import annotations

import pytest

from forge_core import Actor, AuthorizationError, Forge


HUMAN = Actor.human("operator")
MODEL = Actor.model("fake-worker")
SYSTEM = Actor.system("forge")


def _run_with_artifact(forge: Forge, run_id: str) -> str:
    forge.create_run(HUMAN, run_id)
    forge.start_run(run_id, HUMAN)
    snapshot = forge.import_sources(run_id, HUMAN, {"claim.txt": b"candidate"})
    return snapshot.manifest.digest


@pytest.mark.xfail(
    strict=True,
    reason=(
        "FINDING 1: api.propose_signal raises AuthorizationError without "
        "appending permission.denied, unlike every other denial path. A "
        "rejected system actor leaves no audit trail."
    ),
)
def test_finding_1_rejected_signal_proposal_should_be_audited(tmp_path) -> None:
    with Forge(tmp_path / "forge-data") as forge:
        run_id = "run-signal-audit"
        artifact_hash = _run_with_artifact(forge, run_id)

        with pytest.raises(AuthorizationError):
            forge.propose_signal(run_id, SYSTEM, artifact_hash, "sneak")

        denials = [
            event
            for event in forge.events(run_id)
            if event.type == "permission.denied"
        ]
        assert [event.payload["operation"] for event in denials] == ["signal.propose"]


def test_finding_1_current_behavior_denial_is_silent(tmp_path) -> None:
    """Pins the defect as it stands so the gap is visible in a green suite."""

    with Forge(tmp_path / "forge-data") as forge:
        run_id = "run-signal-silent"
        artifact_hash = _run_with_artifact(forge, run_id)
        before = len(forge.events(run_id))

        with pytest.raises(AuthorizationError, match="only model or human"):
            forge.propose_signal(run_id, SYSTEM, artifact_hash, "sneak")

        after = forge.events(run_id)
        assert len(after) == before
        assert not any(event.type == "permission.denied" for event in after)


def test_finding_2_canon_wall_holds_without_any_workflow_gate(tmp_path) -> None:
    """FINDING 2: ``workflow.gates.promote_canon`` is declared, not consulted.

    The canon wall is real, but it is enforced by the actor-kind check in
    ``canon.py``, not by the compiled gate.  Promotion never receives a
    ``WorkflowIR``, so the same outcome holds when no workflow exists at all.
    The compiler pins the gate to the single literal ``human_only``, which
    makes it a validated constant rather than a policy input.
    """

    with Forge(tmp_path / "forge-data") as forge:
        run_id = "run-no-workflow"
        artifact_hash = _run_with_artifact(forge, run_id)

        # No workflow is ever compiled in this run.
        with pytest.raises(AuthorizationError, match="human actor"):
            forge.promote_canon(run_id, MODEL, "model-nonce", artifact_hash)

        gate = forge.open_canon_gate(run_id, HUMAN, artifact_hash)
        revision_id = forge.promote_canon(
            run_id, HUMAN, gate.decision_nonce, artifact_hash
        )
        assert forge.projection(run_id).canon_head == revision_id


def test_finding_3_policy_changes_are_recorded_but_never_consulted(tmp_path) -> None:
    """FINDING 3: ``policy.changed`` is write-only in Phase 0.

    A human may record any policy value and no code path reads it back, so
    the policy surface is an audit record, not an enforcement mechanism.
    Setting a permissive-sounding policy changes nothing — which is the safe
    direction, but the surface should not be read as configurable authority.
    """

    with Forge(tmp_path / "forge-data") as forge:
        run_id = "run-policy"
        artifact_hash = _run_with_artifact(forge, run_id)

        forge.change_policy(run_id, HUMAN, "canon.mode", "model_allowed")

        # The recorded policy has no effect: the model is still refused.
        with pytest.raises(AuthorizationError, match="human actor"):
            forge.promote_canon(run_id, MODEL, "model-nonce", artifact_hash)
        assert forge.projection(run_id).canon_head is None


def test_finding_4_capability_grants_cannot_be_revoked(tmp_path) -> None:
    """FINDING 4: there is no revocation path in Phase 0.

    ``capability.has`` scans for a matching ``capability.granted`` event and
    stops at the first hit.  No event type can withdraw a grant, so a
    disclosure of read access is permanent for the life of the domain.
    """

    with Forge(tmp_path / "forge-data") as forge:
        run_id = "run-revoke"
        forge.create_run(HUMAN, run_id)
        forge.start_run(run_id, HUMAN)
        snapshot = forge.import_sources(run_id, HUMAN, {"claim.txt": b"secret"})
        forge.grant_capability(
            run_id, HUMAN, MODEL, "source.read", snapshot.snapshot_id
        )
        forge.disclose_source(
            run_id, HUMAN, MODEL, snapshot.snapshot_id, "claim.txt"
        )
        assert forge.read_source(
            run_id, MODEL, snapshot.snapshot_id, "claim.txt"
        ) == b"secret"

        # No public API exists to withdraw the grant.
        assert not any(
            hasattr(forge, name)
            for name in ("revoke_capability", "revoke", "undisclose_source")
        )
        assert not any(
            event.type in {"capability.revoked", "source.revoked"}
            for event in forge.events(run_id)
        )


def test_finding_5_public_boundary_is_declared_not_enforced() -> None:
    """FINDING 5: the public boundary is a declaration, not a mechanism.

    ``THREAT_MODEL.md`` names ``forge_core.Forge`` as the supported boundary
    and ``__init__.__all__`` exports only the façade — but Python still
    imports the internals on request, so nothing stops a caller reaching past
    it.  Whether a second wall catches that caller depends on the installed
    ledger; that is measured in ``test_ledger_beyond_contract.py``, which
    skips when the ledger does not bind actor kind.
    """

    import forge_core
    from forge_core.ledger import EventLedger
    from forge_core.artifacts import ArtifactStore
    from forge_core.capability import CapabilityEngine

    assert "EventLedger" not in forge_core.__all__
    assert "ArtifactStore" not in forge_core.__all__
    assert "CapabilityEngine" not in forge_core.__all__
    # Declared out of the public API, yet all three imported successfully.
    assert all(
        callable(primitive)
        for primitive in (EventLedger, ArtifactStore, CapabilityEngine)
    )
