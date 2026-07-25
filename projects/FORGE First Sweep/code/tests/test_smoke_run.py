from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys

import pytest

from forge_core import Actor, AuthorizationError, Forge


WORKFLOW = {
    "id": "smoke.council_lite",
    "version": 1,
    "nodes": [{"id": "think", "kind": "fake_model", "lens": None}],
    "gates": {"promote_canon": "human_only"},
}


def _build_smoke(data_dir: Path, run_id: str) -> dict[str, object]:
    human = Actor.human("operator")
    model = Actor.model("fake-worker")
    with Forge(data_dir) as forge:
        forge.create_run(human, run_id)
        forge.start_run(run_id, human)
        snapshot = forge.import_sources(
            run_id,
            human,
            {
                "README.md": b"FORGE source\n",
                "src/example.py": b"VALUE = 1\n",
            },
        )
        forge.grant_capability(
            run_id, human, model, "source.read", snapshot.snapshot_id
        )
        for path in ("README.md", "src/example.py"):
            forge.disclose_source(
                run_id, human, model, snapshot.snapshot_id, path
            )
        context = forge.compile_context(
            run_id,
            model,
            snapshot.snapshot_id,
            ["README.md", "src/example.py"],
        )
        attempt = forge.execute_fake(
            run_id,
            model,
            forge.compile_workflow(WORKFLOW),
            context.artifact.digest,
        )
        forge.propose_signal(
            run_id, model, attempt.output.digest, "fake adapter produced evidence"
        )

        with pytest.raises(AuthorizationError):
            forge.promote_canon(
                run_id, model, "model-cannot-authorize", attempt.output.digest
            )
        gate = forge.open_canon_gate(
            run_id, human, attempt.output.digest
        )
        forge.promote_canon(
            run_id, human, gate.decision_nonce, attempt.output.digest
        )
        forge.complete_run(run_id, human)
        return forge.projection(run_id).to_dict()


def test_full_smoke_path_replays_after_reopen(tmp_path) -> None:
    data_dir = tmp_path / "forge-data"
    expected = _build_smoke(data_dir, "run-smoke")

    with Forge(data_dir) as reopened:
        actual = reopened.projection("run-smoke").to_dict()

    assert actual == expected
    assert actual["run_status"] == "completed"
    assert len(actual["signals"]) == 1
    assert actual["canon_head"] is not None


def test_replay_matches_in_a_new_python_process(tmp_path) -> None:
    data_dir = tmp_path / "forge-data"
    expected = _build_smoke(data_dir, "run-subprocess-replay")
    src_dir = Path(__file__).resolve().parents[1] / "src"
    script = (
        "import json,sys;"
        "from forge_core import Forge;"
        "f=Forge(sys.argv[1]);"
        "print(json.dumps(f.projection(sys.argv[2]).to_dict(),"
        "sort_keys=True,separators=(',',':')));"
        "f.close()"
    )
    environment = {
        "PYTHONPATH": str(src_dir),
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    completed = subprocess.run(
        [
            sys.executable,
            "-c",
            script,
            str(data_dir),
            "run-subprocess-replay",
        ],
        check=True,
        capture_output=True,
        text=True,
        env=environment,
    )
    actual = json.loads(completed.stdout)
    assert actual == expected


def test_runtime_writes_stay_below_configured_data_dir(tmp_path) -> None:
    data_dir = tmp_path / "forge-data"
    outside = tmp_path / "outside"
    outside.mkdir()
    before = set(outside.rglob("*"))
    _build_smoke(data_dir, "run-contained")
    after = set(outside.rglob("*"))

    assert after == before
    assert {path.name for path in data_dir.iterdir()} <= {
        "forge.db",
        "forge.db-shm",
        "forge.db-wal",
        "objects",
    }
