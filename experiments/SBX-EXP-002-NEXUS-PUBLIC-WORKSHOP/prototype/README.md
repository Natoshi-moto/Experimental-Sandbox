# NEXUS Public Workshop

A dark, read-only public workshop for DDMS's writing, working demonstrations,
evidence, positions, and clearly labelled experiments.

This deployment is a **public documentary prototype**. Material concerning NEX
or the Reasoning Market is classified `ALLOWED_RESEARCH_ONLY` under the active
[`SBX-SOH-001`](https://github.com/Natoshi-moto/Experimental-Sandbox/blob/main/EMERGENCY_CURRENT_STATUS.md)
operator hold. Publication does not authorise implementation, live transfers,
participant recruitment, or the purchase of AI work.

## Add a publication

The site has no public editor by design.

1. Copy `content/_template.md`.
2. Put it in one of the category folders described in `content/README.md`.
3. Name it `YYYY-MM-DD--short-lowercase-slug.md`.
4. Write one H1 title, one short summary paragraph, and the body.
5. Run the normal build gate.

The homepage finds the newest note automatically. Every publication receives a
stable `/work/<slug>` route and source hash.

## Security model

- GET and HEAD only
- no database or object storage
- no form, upload, account, admin page, API route, or Server Action
- no analytics, ads, tracking, or third-party browser scripts
- restricted Markdown compiled before deployment
- no raw HTML or MDX
- response hardening and architecture regression gates
- public prototype access, clearly separated from the planned independent
  static-host release

See `SECURITY.md`.

## Hosting and backup

The planned independent static-host release is backed by canonical Git history,
a GitHub Pages emergency mirror, and restore-tested offline bundles.

See `HOSTING_AND_RECOVERY.md`.

## Local gates

`npm run build` compiles and validates content, lints, type-checks, builds the
deployable worker, validates the artifact, and runs rendered-route and security
regression tests.
