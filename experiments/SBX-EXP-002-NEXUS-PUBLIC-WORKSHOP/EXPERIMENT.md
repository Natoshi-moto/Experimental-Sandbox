# SBX-EXP-002 — NEXUS Public Workshop prototype

**status_authority:** `NONE`
**State:** `OPERATOR_HOLD_RESEARCH_ONLY`
**Classification:** `ALLOWED_RESEARCH_ONLY`
**Operator hold:** [`SBX-SOH-001`](../../EMERGENCY_CURRENT_STATUS.md) — `ACTIVE`
**Nexus Lab impact:** `NONE`
**Public prototype:** <https://nexus-public-workshop.everythingbitesized.chatgpt.site>
**Sites source checkpoint:** `b69c60bc9f65655ce31da6c5926f103983bf64ac`

## Active process boundary

This experiment publishes a read-only documentary surface for writing,
demonstrations, evidence, principles, security posture, and explicitly
unresolved research.

It does **not** issue NEX, provide a participant-facing wallet, enable live
transfers, recruit participants into a credit economy, purchase real AI work,
financialise a mechanism, promote anything to Nexus Lab, or lift or narrow
[`SBX-SOH-001`](../../operations/operator-holds/SBX-SOH-001/ORDER.md).

The public entry point and every direct publication route state that boundary
before presenting the material.

## Object-level result

[`prototype/`](prototype/) is the reviewed, deployable source snapshot for the
public NEXUS Public Workshop prototype. It includes:

- an all-dark public workshop and restricted source-only publication flow;
- no public editor, form, upload, account, database, object store, or write API;
- GET/HEAD-only request handling with framework action surfaces rejected;
- self-hosted browser assets and no analytics or third-party browser scripts;
- restricted Markdown compilation with hash receipts; and
- architecture, content, rendered-route, and response-security regression
  gates.

## Falsifier

The publication claim fails if the reviewed snapshot:

1. admits a browser-accessible mutation or credential surface;
2. activates or presents a held economic mechanism as approved;
3. omits the active hold from a public entry route;
4. loads an unreviewed remote browser script, stylesheet, image, or font;
5. renders raw HTML or executable publication content;
6. cannot reproduce its declared route and security checks; or
7. is presented as the final independent static-host architecture.

## Evidence

- Sites source checkpoint:
  `b69c60bc9f65655ce31da6c5926f103983bf64ac`
- Full production gate: `12` tests passed, `0` failed.
- Production dependency audit: `0` vulnerabilities from
  `npm audit --omit=dev`.
- Hold review verdict: release is permitted only after this snapshot and its
  classification land on Sandbox `main`, before public access is widened.
- The cloud visual-inspection bridge failed at its environment boundary. The
  production build, artifact validator, rendered HTML tests, and security tests
  passed; no claim of visual-browser verification is made for this checkpoint.

## Reproduce

From [`prototype/`](prototype/), use Node `>=22.13.0 <25`:

1. `npm run install:ci`
2. `npm run build`

The second command compiles restricted content, lints, type-checks, builds the
worker, validates the deployable artifact, and runs the regression suite.

## Non-claims

This experiment does not claim that:

- any website is untouchable;
- the current Vinext/Next runtime is the final static architecture;
- the visual design proves security;
- the held Reasoning Market is approved, implemented, or ready for users;
- NEX exists or has been issued;
- Experimental Sandbox material is Nexus Lab accepted state; or
- publication changes `status_authority: NONE`.
