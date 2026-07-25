from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from forge_core.types import ValidationError
from forge_core.workflow import Node, WorkflowIR, compile_workflow


def workflow_document() -> dict[str, object]:
    return {
        "id": "smoke.council_lite",
        "version": 1,
        "nodes": [
            {
                "id": "think",
                "kind": "fake_model",
                "lens": None,
            }
        ],
        "gates": {"promote_canon": "human_only"},
    }


def test_compile_valid_one_node_workflow_to_immutable_versioned_ir() -> None:
    ir = compile_workflow(workflow_document())

    assert isinstance(ir, WorkflowIR)
    assert ir.id == "smoke.council_lite"
    assert ir.version == 1
    assert ir.nodes == (
        Node(id="think", kind="fake_model", lens=None, depends_on=()),
    )
    assert ir.nodes[0].schema_version == 1
    assert dict(ir.gates) == {"promote_canon": "human_only"}

    with pytest.raises(FrozenInstanceError):
        ir.id = "changed"  # type: ignore[misc]
    with pytest.raises(FrozenInstanceError):
        ir.nodes[0].kind = "changed"  # type: ignore[misc]
    with pytest.raises(TypeError):
        ir.gates["promote_canon"] = "model_allowed"  # type: ignore[index]


def test_compile_accepts_finite_dependencies() -> None:
    document = workflow_document()
    document["nodes"] = [
        {"id": "first", "kind": "fake_model"},
        {
            "id": "second",
            "kind": "fake_model",
            "lens": "critic",
            "depends_on": ["first"],
        },
    ]

    ir = compile_workflow(document)

    assert ir.nodes[1].depends_on == ("first",)


@pytest.mark.parametrize(
    "nodes",
    [
        [
            {
                "id": "self",
                "kind": "fake_model",
                "depends_on": ["self"],
            }
        ],
        [
            {"id": "a", "kind": "fake_model", "depends_on": ["b"]},
            {"id": "b", "kind": "fake_model", "depends_on": ["a"]},
        ],
    ],
)
def test_compile_rejects_cycles(nodes: list[dict[str, object]]) -> None:
    document = workflow_document()
    document["nodes"] = nodes

    with pytest.raises(ValidationError, match="cycle"):
        compile_workflow(document)


def test_compile_rejects_missing_dependency() -> None:
    document = workflow_document()
    document["nodes"] = [
        {
            "id": "think",
            "kind": "fake_model",
            "depends_on": ["not_declared"],
        }
    ]

    with pytest.raises(ValidationError, match="missing node"):
        compile_workflow(document)


def test_compile_rejects_duplicate_node_ids() -> None:
    document = workflow_document()
    document["nodes"] = [
        {"id": "same", "kind": "fake_model"},
        {"id": "same", "kind": "fake_model"},
    ]

    with pytest.raises(ValidationError, match="duplicate node id"):
        compile_workflow(document)


@pytest.mark.parametrize(
    ("mutate", "match"),
    [
        (lambda document: document.update(version="1"), "version"),
        (lambda document: document.update(version=True), "version"),
        (lambda document: document.update(nodes=[]), "non-empty list"),
        (lambda document: document.update(nodes={}), "non-empty list"),
        (lambda document: document.update(gates=[]), "gates must be a dict"),
        (lambda document: document.update(id=1), "id must be a non-empty string"),
        (
            lambda document: document["nodes"][0].update(id=1),
            r"nodes\[0\]\.id must be a non-empty string",
        ),
        (
            lambda document: document["nodes"][0].update(lens=7),
            r"nodes\[0\]\.lens must be a non-empty string",
        ),
        (
            lambda document: document["nodes"][0].update(depends_on="think"),
            "depends_on must be a list",
        ),
    ],
)
def test_compile_rejects_wrong_types(mutate: object, match: str) -> None:
    document = workflow_document()
    mutate(document)  # type: ignore[operator]

    with pytest.raises(ValidationError, match=match):
        compile_workflow(document)


@pytest.mark.parametrize("version", [0, 2, -1])
def test_compile_rejects_wrong_version(version: int) -> None:
    document = workflow_document()
    document["version"] = version

    with pytest.raises(ValidationError, match="version"):
        compile_workflow(document)


@pytest.mark.parametrize("kind", ["model", "human", "loop", "fake-model"])
def test_compile_rejects_unsupported_kind(kind: str) -> None:
    document = workflow_document()
    document["nodes"][0]["kind"] = kind

    with pytest.raises(ValidationError, match="fake_model"):
        compile_workflow(document)


@pytest.mark.parametrize(
    "mutate",
    [
        lambda document: document.update(extra=True),
        lambda document: document["nodes"][0].update(extra=True),
        lambda document: document["gates"].update(extra=True),
    ],
)
def test_compile_rejects_extra_fields(mutate: object) -> None:
    document = workflow_document()
    mutate(document)  # type: ignore[operator]

    with pytest.raises(ValidationError, match="unknown field"):
        compile_workflow(document)


@pytest.mark.parametrize(
    "mutate",
    [
        lambda document: document.__setitem__("while", True),
        lambda document: document["nodes"][0].update(repeat=True),
    ],
)
def test_compile_rejects_unbounded_loop_constructs(mutate: object) -> None:
    document = workflow_document()
    mutate(document)  # type: ignore[operator]

    with pytest.raises(ValidationError):
        compile_workflow(document)


@pytest.mark.parametrize(
    "document",
    [
        "id: smoke",
        [],
        None,
    ],
)
def test_compile_accepts_dict_input_only(document: object) -> None:
    with pytest.raises(ValidationError, match="must be a dict"):
        compile_workflow(document)  # type: ignore[arg-type]


@pytest.mark.parametrize("promote_canon", ["model_allowed", "auto", None, 1])
def test_compile_requires_human_only_canon_gate(promote_canon: object) -> None:
    document = workflow_document()
    document["gates"]["promote_canon"] = promote_canon

    with pytest.raises(ValidationError, match="human_only"):
        compile_workflow(document)
