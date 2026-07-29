# Publication exclusions

The exact tracked source is preserved under `prototype/`.

The following generated or local-only material is intentionally excluded:

- `.git/`
- `node_modules/`
- `dist/`
- `.generated/`
- `.sites-runtime/`
- `.wrangler/`
- temporary restore-drill directories
- provider credentials and connection state

These exclusions remove reproducible build output, caches, source-control
internals, and credentials. They do not remove any tracked source required to
rebuild or audit the checkpoint.

The temporary restore bundle is represented by its SHA-256 and drill result,
not published as a repository binary. It is a verification object, not the
durable off-provider backup.
