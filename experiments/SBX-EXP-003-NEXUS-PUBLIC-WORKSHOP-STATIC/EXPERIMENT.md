# SBX-EXP-003 — NEXUS Public Workshop scriptless static successor

**status_authority:** `NONE`
**State:** `OPERATOR_HOLD_RESEARCH_ONLY`
**Classification:** `ALLOWED_RESEARCH_ONLY`
**Operator hold:** [`SBX-SOH-001`](../../EMERGENCY_CURRENT_STATUS.md) — `ACTIVE`
**Nexus Lab impact:** `NONE`
**Public checkpoint:** <https://nexus-public-workshop.everythingbitesized.chatgpt.site>
**Sites source checkpoint:** `ed8c281d14914e20e1f2a5762fa11436edf06da0`

## Active process boundary

This experiment records a read-only documentary website and its publication
machinery. It may publish writing, evidence, clearly bounded demonstrations,
security posture, and explicitly unresolved research.

It does **not** issue NEX, provide a participant-facing wallet, enable live
transfers, recruit participants into a credit economy, purchase real AI work,
financialise a mechanism, promote anything to Nexus Lab, or lift or narrow
[`SBX-SOH-001`](../../operations/operator-holds/SBX-SOH-001/ORDER.md).

The active hold is visible at the public entry point and every direct
publication route.

## Object-level result

[`prototype/`](prototype/) is the exact tracked source of the deployed static
successor. Its generated public artifact contains:

- generated HTML;
- one fingerprinted stylesheet;
- fingerprinted local fonts and hero media;
- a favicon, security contact, robots file, and public SHA-256 receipt; and
- zero JavaScript, WebAssembly, source maps, remote browser resources, forms,
  cookies, analytics, or framework hydration.

The current Sites package requires a small edge Worker. It maps a strict
allowlist to already-built static files, admits only `GET` and `HEAD`, attaches
security headers, and returns the static 404 when requests reach that gate. It
performs no rendering, persistence, authentication, mutation, or outbound
fetch.

A raw-response audit found that the shared Sites edge can append a Cloudflare
browser-detection script and `__cf_bm` cookie and omit the intended complete
HTTP-header envelope on static responses. The early meta CSP precedes page
resources and says `script-src 'none'`, but the current hostname is therefore
not claimed as an end-to-end script-free or cookie-free transport. A
local-receipt-anchored live acceptance gate now makes that boundary executable.

An assets-only Cloudflare configuration with no Worker `main` is included for
the planned independent cutover. GitHub project Pages base-path and canonical
URL generation is also tested.

## Falsifier

The static-successor claim fails if the reviewed source or generated artifact:

1. ships executable browser code or active HTML;
2. admits a browser-accessible mutation, credential, account, upload, or
   persistence surface;
3. loads a remote browser subresource;
4. omits the active hold from a public content entry route;
5. renders raw or unescaped publication HTML;
6. permits an unsafe content link, malformed route, or unreceipted output file;
7. cannot rebuild from the recorded source with byte-identical public receipt;
8. breaks its configured GitHub Pages base path; or
9. is presented as an economic launch, final independent-provider cutover, or
   Nexus Lab accepted state.

## Evidence

- Sites source checkpoint:
  `ed8c281d14914e20e1f2a5762fa11436edf06da0`
- Production gate: `16` tests passed, `0` failed.
- Package surface: `0` runtime dependencies and `0` development dependencies.
- Dependency audit: `0` vulnerabilities from `npm audit --omit=dev`.
- Public browser artifact: no `.js`, `.mjs`, `.cjs`, `.wasm`, source map, or
  TypeScript/JSX output.
- Independent adversarial review: initial narrow `HOLD`, both issues repaired,
  final `PASS`.
- Live-wire audit: the current shared host correctly fails the final-host gate
  on provider injection, cookie, missing headers, and changed bytes.
- Live verifier review: two trust/envelope gaps repaired; final independent
  verdict `PASS`.
- Clean bundle restore drill: valid complete bundle, clean clone, successful
  build, `16/16` tests, and byte-identical public receipt.
- Dedicated path-scoped GitHub Actions gate: verifies the preserved-source
  manifest, installs the zero-dependency lockfile with scripts disabled, and
  runs the complete production build for this successor.

See `RELEASE_EVIDENCE.md` and `RESTORE_DRILL.md`.

## Reproduce

From [`prototype/`](prototype/), use Node `>=22.13.0 <25`:

1. `npm ci --ignore-scripts`
2. `npm run build`

The build uses Node core only. It compiles restricted Markdown, generates the
static artifact, validates every allowed output, verifies receipts and links,
and exercises the edge request contract.

## Non-claims

This experiment does not claim that:

- any website is literally untouchable;
- the current Sites edge layer is the final independent assets-only host;
- the visual design proves security;
- a GitHub Pages availability mirror is an independent source backup;
- the held Reasoning Market is approved or implemented;
- NEX exists or has been issued;
- Experimental Sandbox material is Nexus Lab accepted state; or
- publication changes `status_authority: NONE`.
