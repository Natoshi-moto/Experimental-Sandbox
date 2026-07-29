# NEXUS Public Workshop

A dark, read-only public workshop for DDMS's writing, working demonstrations,
evidence, positions, and clearly labelled experiments.

This is a public documentary prototype. Material concerning NEX or the
Reasoning Market is classified `ALLOWED_RESEARCH_ONLY` under the active
[`SBX-SOH-001`](https://github.com/Natoshi-moto/Experimental-Sandbox/blob/main/EMERGENCY_CURRENT_STATUS.md)
operator hold. Publication does not authorise implementation, live transfers,
participant recruitment, or the purchase of AI work.

## What the build emits

The generated public artifact contains:

- generated HTML;
- one generated CSS file;
- two local fonts;
- one local hero image;
- a favicon and plain-text public records.

It contains no JavaScript, framework runtime, source map, analytics, remote
resource, application cookie, form, login, database connection, or write route.
The Content Security Policy includes `script-src 'none'`.

The current ChatGPT Sites deployment retains one deliberately tiny edge gate
because that platform requires a Worker entry. It serves only known static
files, admits only `GET` and `HEAD`, attaches the security envelope, and returns
the static 404 page. It does not render pages, hold state, contact another
service, or execute code in the browser.

That source boundary is not the same as the live hosting boundary. A
2026-07-29 raw-response check found that the shared Sites edge can append a
Cloudflare browser-detection snippet and `__cf_bm` cookie after deployment, and
does not preserve the complete intended HTTP-header envelope on static
responses. The early meta CSP appears before all page resources and refuses
script execution, but the current shared hostname is therefore not claimed as
an end-to-end zero-script or zero-cookie transport.

The final independent host must pass `npm run verify:live -- https://HOST`
before cutover. That gate rejects any script tag, provider challenge, cookie,
missing security header, or mismatch from the receipted static HTML.

## Add a publication

There is no public editor by design.

1. Copy `content/_template.md`.
2. Put it in one category folder described in `content/README.md`.
3. Name it `YYYY-MM-DD--short-lowercase-slug.md`.
4. Write one H1 title, one short summary paragraph, and the body.
5. Run the normal build gate.
6. Review the resulting page, then publish the source commit.

The homepage finds the newest note automatically. Every publication receives a
stable `/work/<slug>` route and displays its complete SHA-256 source receipt.

## Verify

`npm run build` performs the complete gate:

1. checks every build source with Node;
2. compiles restricted Markdown;
3. generates static pages and fingerprinted local assets;
4. generates the provider `_headers` file and public build receipt;
5. rejects browser code, active HTML, remote subresources, unexpected output,
   route drift, weak headers, and receipt mismatches;
6. exercises the deployed Worker contract for pages, articles, assets, 404s,
   `GET`, `HEAD`, and refused mutation methods.

`npm run verify:live -- https://HOST` separately tests the raw public response.
It is intentionally not folded into a deterministic source build.

There are no runtime or development package dependencies.

## Records

- Security boundary: `SECURITY.md`
- Publishing, hosting and recovery: `HOSTING_AND_RECOVERY.md`
- Restricted-content rules: `content/README.md`
