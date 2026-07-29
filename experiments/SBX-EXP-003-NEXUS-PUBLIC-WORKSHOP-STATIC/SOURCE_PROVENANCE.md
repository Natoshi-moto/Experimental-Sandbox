# Source provenance

[`prototype/`](prototype/) is an exact tracked-source snapshot of NEXUS Public
Workshop Sites commit:

`ed8c281d14914e20e1f2a5762fa11436edf06da0`

The checkpoint was created from a clean Sites checkout after the complete
static build and security gate passed. It was deployed to:

<https://nexus-public-workshop.everythingbitesized.chatgpt.site>

The snapshot includes all `30` tracked source files. It excludes the source
repository's `.git` directory and all ignored dependencies, caches, compiled
catalogue data, runtime state, and generated build output.

The tracked `.openai/hosting.json` is included because it is part of the tested
Sites source and artifact contract. Its project ID identifies the existing
Site. It is not a credential and grants no deployment authority.

The source manifest is `MANIFEST.sha256`. The generated public artifact carries
its own `/.well-known/site-receipt.json` at build time.

Until the dedicated canonical website repository and independent assets-only
host exist:

- the Sites source checkpoint remains the deployment source;
- this Sandbox directory is the public provenance snapshot;
- `SBX-EXP-002` remains the immutable historical framework prototype;
- changes must not silently rewrite either prior record; and
- none of these records has Nexus Lab authority.

`status_authority: NONE`
