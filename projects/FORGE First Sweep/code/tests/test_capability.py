from __future__ import annotations

import pytest

from forge_core import Actor, AuthorizationError, Forge


def test_read_requires_capability_and_recorded_disclosure(tmp_path) -> None:
    human = Actor.human("operator")
    model = Actor.model("fake-worker")
    other_model = Actor.model("other-worker")

    with Forge(tmp_path / "forge-data") as forge:
        run_id = forge.create_run(human, "run-read-controls")
        forge.start_run(run_id, human)
        snapshot = forge.import_sources(
            run_id, human, {"src/main.py": b"print('hello')\n"}
        )

        with pytest.raises(AuthorizationError, match="lacks source.read"):
            forge.read_source(run_id, model, snapshot.snapshot_id, "src/main.py")

        forge.grant_capability(
            run_id, human, model, "source.read", snapshot.snapshot_id
        )
        with pytest.raises(AuthorizationError, match="has not been disclosed"):
            forge.read_source(run_id, model, snapshot.snapshot_id, "src/main.py")

        forge.disclose_source(
            run_id, human, model, snapshot.snapshot_id, "src/main.py"
        )
        assert (
            forge.read_source(run_id, model, snapshot.snapshot_id, "src/main.py")
            == b"print('hello')\n"
        )

        with pytest.raises(AuthorizationError, match="lacks source.read"):
            forge.read_source(
                run_id, other_model, snapshot.snapshot_id, "src/main.py"
            )

        denials = [
            event for event in forge.events(run_id) if event.type == "permission.denied"
        ]
        assert len(denials) == 3


def test_model_cannot_grant_capability_or_change_policy(tmp_path) -> None:
    human = Actor.human("operator")
    model = Actor.model("fake-worker")

    with Forge(tmp_path / "forge-data") as forge:
        run_id = forge.create_run(human, "run-authority-controls")

        with pytest.raises(AuthorizationError, match="human actor"):
            forge.grant_capability(
                run_id, model, model, "source.read", "snapshot-any"
            )
        with pytest.raises(AuthorizationError, match="human actor"):
            forge.change_policy(run_id, model, "canon.mode", "model_allowed")

        event_types = [event.type for event in forge.events(run_id)]
        assert "capability.granted" not in event_types
        assert "policy.changed" not in event_types
        assert event_types.count("permission.denied") == 2

        forge.change_policy(run_id, human, "canon.mode", "human_only")
        assert [
            event.payload
            for event in forge.events(run_id)
            if event.type == "policy.changed"
        ] == [{"policy": "canon.mode", "value": "human_only"}]


def test_model_cannot_import_or_self_disclose_sources(tmp_path) -> None:
    human = Actor.human("operator")
    model = Actor.model("fake-worker")

    with Forge(tmp_path / "forge-data") as forge:
        run_id = forge.create_run(human, "run-source-authority")
        snapshot = forge.import_sources(run_id, human, {"README.md": b"source"})

        with pytest.raises(AuthorizationError, match="human or system"):
            forge.import_sources(run_id, model, {"model.txt": b"not allowed"})
        with pytest.raises(AuthorizationError, match="human actor"):
            forge.disclose_source(
                run_id, model, model, snapshot.snapshot_id, "README.md"
            )

        assert not any(
            event.type == "source.imported"
            and event.actor.kind == "model"
            for event in forge.events(run_id)
        )
        assert not any(
            event.type == "source.exposed"
            and event.actor.kind == "model"
            for event in forge.events(run_id)
        )

