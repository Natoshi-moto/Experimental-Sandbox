"""Immutable, content-addressed artifact storage under one data directory."""

from __future__ import annotations

import os
from pathlib import Path
import re
import stat
import tempfile
from typing import Final

from .hashutil import sha256_hex
from .types import (
    SCHEMA_VERSION,
    ArtifactRef,
    IntegrityError,
    ValidationError,
)


_SHA256_RE: Final = re.compile(r"[0-9a-f]{64}\Z")


class ArtifactStore:
    """A write-once sha256 object store.

    Objects are installed with an atomic hard-link create.  Existing paths are
    always read and re-hashed; a corrupt object is evidence of an integrity
    failure and is not silently overwritten with new bytes.
    """

    def __init__(self, data_dir: str | os.PathLike[str]) -> None:
        if isinstance(data_dir, (str, os.PathLike)):
            raw_data_dir = Path(data_dir)
        else:
            raise ValidationError("data_dir must be a filesystem path")

        try:
            raw_data_dir.mkdir(parents=True, exist_ok=True)
            self.data_dir = raw_data_dir.resolve(strict=True)
        except (OSError, RuntimeError) as exc:
            raise ValidationError(f"cannot initialize data_dir: {exc}") from exc
        if not self.data_dir.is_dir():
            raise ValidationError("data_dir must be a directory")

        # Refuse symlinked store components.  Besides making containment
        # inspectable, checking each component before creating its child keeps
        # initialization from following a hostile ``objects`` symlink.
        objects = self._safe_child_dir(self.data_dir, "objects")
        self._object_root = self._safe_child_dir(objects, "sha256")

    def _safe_child_dir(self, parent: Path, name: str) -> Path:
        child = parent / name
        self._assert_within_data_dir(parent)
        try:
            if child.is_symlink():
                raise IntegrityError(f"store directory may not be a symlink: {child}")
            if child.exists():
                if not child.is_dir():
                    raise IntegrityError(f"store path is not a directory: {child}")
            else:
                child.mkdir(mode=0o700)
        except IntegrityError:
            raise
        except OSError as exc:
            raise IntegrityError(f"cannot create store directory {child}: {exc}") from exc
        self._assert_within_data_dir(child)
        return child

    def _assert_within_data_dir(self, path: Path) -> None:
        try:
            resolved = path.resolve(strict=False)
            resolved.relative_to(self.data_dir)
        except (OSError, RuntimeError, ValueError) as exc:
            raise IntegrityError(f"artifact path escapes data_dir: {path}") from exc

    def _path_for(self, digest: str) -> Path:
        """Return the canonical object path for a validated sha256 digest."""

        if not isinstance(digest, str) or _SHA256_RE.fullmatch(digest) is None:
            raise ValidationError("digest must be a lowercase sha256 hex digest")
        path = self._object_root / digest[:2] / digest[2:]
        # This is defense in depth around any future path layout change.
        try:
            path.relative_to(self.data_dir)
        except ValueError as exc:  # pragma: no cover - layout is constant
            raise IntegrityError("derived artifact path escapes data_dir") from exc
        return path

    def _parent_for(self, digest: str) -> Path:
        path = self._path_for(digest)
        # Re-check fixed components on every write in case in-process code
        # replaced one after construction.
        objects = self._safe_child_dir(self.data_dir, "objects")
        object_root = self._safe_child_dir(objects, "sha256")
        if object_root != self._object_root:
            raise IntegrityError("artifact object root changed")
        return self._safe_child_dir(object_root, digest[:2])

    @staticmethod
    def _coerce_ref(ref_or_digest: ArtifactRef | str) -> tuple[str, int | None]:
        if isinstance(ref_or_digest, ArtifactRef):
            return ref_or_digest.digest, ref_or_digest.size
        if isinstance(ref_or_digest, str):
            if _SHA256_RE.fullmatch(ref_or_digest) is None:
                raise ValidationError("digest must be a lowercase sha256 hex digest")
            return ref_or_digest, None
        raise ValidationError("artifact reference must be an ArtifactRef or digest")

    def put(self, data: bytes | bytearray | memoryview) -> ArtifactRef:
        """Store bytes once and return their versioned content reference."""

        if not isinstance(data, (bytes, bytearray, memoryview)):
            raise ValidationError("artifact data must be bytes-like")
        content = bytes(data)
        digest = sha256_hex(content)
        ref = ArtifactRef(
            schema_version=SCHEMA_VERSION,
            algorithm="sha256",
            digest=digest,
            size=len(content),
        )
        path = self._path_for(digest)
        parent = self._parent_for(digest)
        self._assert_within_data_dir(path)

        if path.exists() or path.is_symlink():
            self._read_verified(ref)
            return ref

        fd = -1
        temporary_name = ""
        try:
            fd, temporary_name = tempfile.mkstemp(prefix=".forge-", dir=parent)
            temporary = Path(temporary_name)
            self._assert_within_data_dir(temporary)
            with os.fdopen(fd, "wb") as stream:
                fd = -1
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())

            # A hard-link create is atomic and, unlike replace(), cannot
            # overwrite a destination installed by a concurrent writer.
            try:
                os.link(temporary, path, follow_symlinks=False)
            except FileExistsError:
                self._read_verified(ref)
            else:
                self._read_verified(ref)
                self._fsync_directory(parent)
        except IntegrityError:
            raise
        except OSError as exc:
            raise IntegrityError(f"cannot store artifact {digest}: {exc}") from exc
        finally:
            if fd >= 0:
                os.close(fd)
            if temporary_name:
                try:
                    Path(temporary_name).unlink(missing_ok=True)
                except OSError:
                    # The object, if linked, is already durable and verified.
                    # A leftover in-data-dir temp is preferable to masking the
                    # result or trying a broader destructive cleanup.
                    pass
        return ref

    @staticmethod
    def _fsync_directory(path: Path) -> None:
        flags = os.O_RDONLY
        if hasattr(os, "O_DIRECTORY"):
            flags |= os.O_DIRECTORY
        if hasattr(os, "O_CLOEXEC"):
            flags |= os.O_CLOEXEC
        descriptor = os.open(path, flags)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)

    def _read_verified(self, ref_or_digest: ArtifactRef | str) -> bytes:
        """Read an object and verify its path digest (and reference size)."""

        digest, expected_size = self._coerce_ref(ref_or_digest)
        path = self._path_for(digest)
        self._assert_within_data_dir(path)
        try:
            path_stat = path.lstat()
        except FileNotFoundError as exc:
            raise IntegrityError(f"artifact is missing: {digest}") from exc
        except OSError as exc:
            raise IntegrityError(f"cannot inspect artifact {digest}: {exc}") from exc
        if stat.S_ISLNK(path_stat.st_mode):
            raise IntegrityError(f"artifact path is a symlink: {digest}")
        if not stat.S_ISREG(path_stat.st_mode):
            raise IntegrityError(f"artifact path is not a regular file: {digest}")

        flags = os.O_RDONLY
        if hasattr(os, "O_CLOEXEC"):
            flags |= os.O_CLOEXEC
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        try:
            descriptor = os.open(path, flags)
            try:
                opened_stat = os.fstat(descriptor)
                if not stat.S_ISREG(opened_stat.st_mode):
                    raise IntegrityError(
                        f"artifact path is not a regular file: {digest}"
                    )
                with os.fdopen(descriptor, "rb") as stream:
                    descriptor = -1
                    content = stream.read()
            finally:
                if descriptor >= 0:
                    os.close(descriptor)
        except IntegrityError:
            raise
        except OSError as exc:
            raise IntegrityError(f"cannot read artifact {digest}: {exc}") from exc

        actual_digest = sha256_hex(content)
        if actual_digest != digest:
            raise IntegrityError(
                f"artifact digest mismatch: expected {digest}, got {actual_digest}"
            )
        if expected_size is not None and len(content) != expected_size:
            raise IntegrityError(
                f"artifact size mismatch: expected {expected_size}, got {len(content)}"
            )
        return content

    def get(self, ref_or_digest: ArtifactRef | str) -> bytes:
        """Return verified artifact bytes or fail closed."""

        return self._read_verified(ref_or_digest)

    def verify(self, ref_or_digest: ArtifactRef | str) -> bool:
        """Return true for a valid object; raise on missing or corrupt content."""

        self._read_verified(ref_or_digest)
        return True
