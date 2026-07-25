"""Compile a strict, finite Phase 0 workflow document.

The compiler accepts an already-decoded ``dict``.  It deliberately has no YAML
dependency: a future caller may parse another format outside this trust
boundary, then pass the resulting dictionary here for the same validation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Mapping

from .types import ValidationError


WORKFLOW_SCHEMA_VERSION = 1
_SUPPORTED_NODE_KIND = "fake_model"
_TOP_LEVEL_FIELDS = frozenset({"id", "version", "nodes", "gates"})
_REQUIRED_NODE_FIELDS = frozenset({"id", "kind"})
_NODE_FIELDS = frozenset({"id", "kind", "lens", "depends_on"})
_GATE_FIELDS = frozenset({"promote_canon"})
_UNBOUNDED_LOOP_FIELDS = frozenset(
    {"forever", "loop", "loops", "repeat", "until", "while"}
)


@dataclass(frozen=True, slots=True)
class Node:
    """Immutable, versioned node in the compiled workflow IR."""

    id: str
    kind: str
    lens: str | None
    depends_on: tuple[str, ...]
    schema_version: int = field(default=WORKFLOW_SCHEMA_VERSION, init=False)


@dataclass(frozen=True, slots=True)
class WorkflowIR:
    """Immutable workflow intermediate representation."""

    id: str
    version: int
    nodes: tuple[Node, ...]
    gates: Mapping[str, str]


def _field_names(value: dict[object, object], location: str) -> set[str]:
    """Return string field names, rejecting non-string keys."""

    non_string = [key for key in value if type(key) is not str]
    if non_string:
        raise ValidationError(f"{location} field names must be strings")
    return set(value)  # type: ignore[arg-type]


def _reject_unbounded_loop_fields(fields: set[str], location: str) -> None:
    loop_fields = sorted(fields & _UNBOUNDED_LOOP_FIELDS)
    if loop_fields:
        joined = ", ".join(loop_fields)
        raise ValidationError(
            f"{location} contains unsupported unbounded-loop field(s): {joined}"
        )


def _require_exact_fields(
    value: dict[object, object],
    *,
    allowed: frozenset[str],
    required: frozenset[str],
    location: str,
) -> None:
    fields = _field_names(value, location)
    _reject_unbounded_loop_fields(fields, location)

    missing = sorted(required - fields)
    if missing:
        raise ValidationError(
            f"{location} is missing required field(s): {', '.join(missing)}"
        )

    extra = sorted(fields - allowed)
    if extra:
        raise ValidationError(
            f"{location} has unknown field(s): {', '.join(extra)}"
        )


def _nonempty_string(value: object, location: str) -> str:
    if type(value) is not str or not value.strip():
        raise ValidationError(f"{location} must be a non-empty string")
    return value


def _compile_node(raw_node: object, index: int) -> Node:
    location = f"workflow.nodes[{index}]"
    if type(raw_node) is not dict:
        raise ValidationError(f"{location} must be a dict")

    _require_exact_fields(
        raw_node,
        allowed=_NODE_FIELDS,
        required=_REQUIRED_NODE_FIELDS,
        location=location,
    )

    node_id = _nonempty_string(raw_node["id"], f"{location}.id")

    kind = raw_node["kind"]
    if type(kind) is not str:
        raise ValidationError(f"{location}.kind must be a string")
    if kind != _SUPPORTED_NODE_KIND:
        raise ValidationError(
            f"{location}.kind must be {_SUPPORTED_NODE_KIND!r}"
        )

    lens = raw_node.get("lens")
    if lens is not None:
        lens = _nonempty_string(lens, f"{location}.lens")

    raw_dependencies = raw_node.get("depends_on", [])
    if type(raw_dependencies) is not list:
        raise ValidationError(f"{location}.depends_on must be a list")

    dependencies: list[str] = []
    seen_dependencies: set[str] = set()
    for dependency_index, raw_dependency in enumerate(raw_dependencies):
        dependency = _nonempty_string(
            raw_dependency,
            f"{location}.depends_on[{dependency_index}]",
        )
        if dependency in seen_dependencies:
            raise ValidationError(
                f"{location}.depends_on contains duplicate node {dependency!r}"
            )
        seen_dependencies.add(dependency)
        dependencies.append(dependency)

    return Node(
        id=node_id,
        kind=kind,
        lens=lens,
        depends_on=tuple(dependencies),
    )


def _reject_missing_dependencies(nodes: tuple[Node, ...]) -> None:
    node_ids = {node.id for node in nodes}
    for node in nodes:
        for dependency in node.depends_on:
            if dependency not in node_ids:
                raise ValidationError(
                    f"workflow node {node.id!r} depends on missing node "
                    f"{dependency!r}"
                )


def _reject_cycles(nodes: tuple[Node, ...]) -> None:
    """Reject dependency cycles using a deterministic depth-first traversal."""

    dependencies_by_id = {node.id: node.depends_on for node in nodes}
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node_id: str) -> None:
        if node_id in visiting:
            raise ValidationError(
                f"workflow dependency graph contains a cycle at {node_id!r}"
            )
        if node_id in visited:
            return

        visiting.add(node_id)
        for dependency in dependencies_by_id[node_id]:
            visit(dependency)
        visiting.remove(node_id)
        visited.add(node_id)

    for node in nodes:
        visit(node.id)


def compile_workflow(document: dict[object, object]) -> WorkflowIR:
    """Validate ``document`` and return an immutable finite workflow IR.

    Only the Phase 0 schema is accepted:

    * top level: ``id``, ``version``, ``nodes``, and ``gates``;
    * node: ``id``, ``kind``, optional ``lens``, optional ``depends_on``;
    * gate: ``promote_canon`` fixed to ``human_only``.

    The sole supported node kind is ``fake_model``.  Unknown fields, missing
    dependencies, cycles, and loop constructs all fail closed.
    """

    if type(document) is not dict:
        raise ValidationError("workflow document must be a dict")

    _require_exact_fields(
        document,
        allowed=_TOP_LEVEL_FIELDS,
        required=_TOP_LEVEL_FIELDS,
        location="workflow",
    )

    workflow_id = _nonempty_string(document["id"], "workflow.id")

    version = document["version"]
    if type(version) is not int or version != WORKFLOW_SCHEMA_VERSION:
        raise ValidationError(
            f"workflow.version must be integer {WORKFLOW_SCHEMA_VERSION}"
        )

    raw_nodes = document["nodes"]
    if type(raw_nodes) is not list or not raw_nodes:
        raise ValidationError("workflow.nodes must be a non-empty list")

    nodes = tuple(
        _compile_node(raw_node, index) for index, raw_node in enumerate(raw_nodes)
    )
    node_ids: set[str] = set()
    for node in nodes:
        if node.id in node_ids:
            raise ValidationError(f"workflow has duplicate node id {node.id!r}")
        node_ids.add(node.id)

    _reject_missing_dependencies(nodes)
    _reject_cycles(nodes)

    raw_gates = document["gates"]
    if type(raw_gates) is not dict:
        raise ValidationError("workflow.gates must be a dict")
    _require_exact_fields(
        raw_gates,
        allowed=_GATE_FIELDS,
        required=_GATE_FIELDS,
        location="workflow.gates",
    )
    promote_canon = raw_gates["promote_canon"]
    if type(promote_canon) is not str or promote_canon != "human_only":
        raise ValidationError(
            "workflow.gates.promote_canon must be 'human_only'"
        )

    gates = MappingProxyType({"promote_canon": "human_only"})
    return WorkflowIR(
        id=workflow_id,
        version=version,
        nodes=nodes,
        gates=gates,
    )
