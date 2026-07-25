from __future__ import annotations

import hashlib

import pytest

from forge_core.artifacts import ArtifactStore
from forge_core.types import ArtifactRef, IntegrityError, ValidationError


def test_put_uses_content_addressed_layout_and_is_idempotent(tmp_path) -> None:
    store = ArtifactStore(tmp_path / "forge-data")
    content = "immutable café".encode()

    first = store.put(content)
    second = store.put(content)

    assert first == second
    assert first.digest == hashlib.sha256(content).hexdigest()
    assert first.size == len(content)
    assert store._path_for(first.digest) == (
        tmp_path
        / "forge-data"
        / "objects"
        / "sha256"
        / first.digest[:2]
        / first.digest[2:]
    )
    assert store.get(first) == content
    assert store.get(first.digest) == content
    assert store.verify(first) is True


def test_direct_on_disk_overwrite_is_detected_and_not_repaired(tmp_path) -> None:
    store = ArtifactStore(tmp_path / "forge-data")
    original = b"trusted artifact"
    ref = store.put(original)
    object_path = store._path_for(ref.digest)

    object_path.write_bytes(b"hostile mutation")

    with pytest.raises(IntegrityError, match="digest mismatch"):
        store.get(ref)
    with pytest.raises(IntegrityError, match="digest mismatch"):
        store.verify(ref)
    with pytest.raises(IntegrityError, match="digest mismatch"):
        store.put(original)
    assert object_path.read_bytes() == b"hostile mutation"


def test_reference_size_is_verified_as_well_as_digest(tmp_path) -> None:
    store = ArtifactStore(tmp_path)
    ref = store.put(b"content")
    dishonest_ref = ArtifactRef(
        schema_version=ref.schema_version,
        algorithm=ref.algorithm,
        digest=ref.digest,
        size=ref.size + 1,
    )

    with pytest.raises(IntegrityError, match="size mismatch"):
        store.get(dishonest_ref)


def test_missing_and_invalid_digests_fail_closed(tmp_path) -> None:
    store = ArtifactStore(tmp_path)

    with pytest.raises(IntegrityError, match="missing"):
        store.get("0" * 64)
    with pytest.raises(ValidationError):
        store.get("../../outside")
    with pytest.raises(ValidationError):
        store._path_for("A" * 64)


def test_symlinked_shard_cannot_redirect_a_write_outside_data_dir(tmp_path) -> None:
    data_dir = tmp_path / "forge-data"
    outside = tmp_path / "outside"
    outside.mkdir()
    store = ArtifactStore(data_dir)
    content = b"must remain in forge data"
    digest = hashlib.sha256(content).hexdigest()
    shard = store._object_root / digest[:2]
    shard.symlink_to(outside, target_is_directory=True)

    with pytest.raises(IntegrityError, match="symlink"):
        store.put(content)
    assert list(outside.iterdir()) == []
