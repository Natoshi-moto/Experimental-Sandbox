# Source provenance

[`prototype/`](prototype/) is an exact tracked-source snapshot of the NEXUS
Public Workshop Sites commit:

`b69c60bc9f65655ce31da6c5926f103983bf64ac`

The snapshot was copied from the clean Sites checkout after the full production
gate passed. It excludes the source repository's `.git` directory and all
ignored dependencies, caches, generated content, runtime state, and build
output.

The tracked `.openai/hosting.json` is included because it is part of the tested
deployable source and artifact validation. Its project ID identifies the
existing Site; it is not a credential and grants no deployment authority.
Deployment still requires an authorised Sites connection and an explicit
operator publication instruction.

Until the planned independent static-host repository exists:

- the Sites checkout remains the deployment source;
- this Sandbox directory is the public provenance snapshot;
- changes must not silently diverge between those two records; and
- neither record has Nexus Lab authority.

`status_authority: NONE`
