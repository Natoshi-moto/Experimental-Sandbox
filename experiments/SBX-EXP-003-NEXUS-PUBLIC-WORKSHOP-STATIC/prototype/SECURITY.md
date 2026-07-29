# Security posture

NEXUS Public Workshop is a read-only publication, not an online application
with a public control plane.

No website is untouchable. The narrower, testable target is:

- minimise executable and writable surface;
- make silent alteration detectable;
- keep browser data valueless;
- make every publication reproducible from reviewed source;
- restore a known-good version quickly.

## Report privately

Use the repository's private vulnerability-reporting flow:

<https://github.com/Natoshi-moto/Quantum-Nexus/security/advisories/new>

Do not include credentials, private personal data, or destructive proof in an
initial report.

The deployed copy also publishes `/.well-known/security.txt`.

## Browser boundary

The generated public artifact has:

- zero browser JavaScript or WebAssembly;
- no public sign-in, admin panel, CMS, form, upload, comment, or write API;
- no database, object store, analytics, ads, tracking pixel, or application
  cookie;
- no third-party browser scripts, fonts, styles, images, or other subresources;
- no raw HTML or executable MDX in publications;
- no framework hydration, React Server Components, image processor, Server
  Action, source map, or browser package dependency;
- fingerprinted CSS, fonts, and imagery;
- a strict CSP meta policy inside every page for reduced-envelope mirrors.

The HTTP Content Security Policy says:

- `default-src 'none'`
- `script-src 'none'`
- `style-src 'self'`
- `img-src 'self'`
- `font-src 'self'`
- `connect-src 'none'`
- `worker-src 'none'`
- no forms, frames, objects, base override, or mixed-content downgrade

The build fails if a future change introduces executable browser output, a
form, inline handler, inline style, active URL scheme, embedded content, remote
subresource, framework marker, unexpected public file, symbolic link, or
receipt mismatch.

## Edge boundary

The current Sites host requires an ESM Worker entry. The edge gate:

- admits `GET` and `HEAD` only;
- maps a strict allowlist of public paths to already-built static files;
- removes query strings before asset lookup;
- refuses encoded, doubled, backslash, unknown, framework, and API paths;
- adds the complete header envelope to HTML, assets, errors, and refused
  methods;
- performs no rendering, persistence, outbound fetch, authentication, or
  mutation.

The independent Cloudflare release is designed to omit the Worker `main`
entirely and deploy only the static asset directory.

## Content boundary

Published writing lives under `content/` as one restricted Markdown file per
record. Folder and filename determine its public label, date, and slug.

The compiler rejects:

- raw HTML, MDX imports/exports, images, and symbolic links;
- unsafe link protocols;
- duplicate or malformed slugs;
- invalid dates;
- missing titles, summaries, or bodies;
- oversized source files.

The renderer escapes every value before generating HTML. Allowed Markdown
tokens are converted by fixed templates, never by raw-HTML insertion.

## Response policy

Every host response receives:

- the full Content Security Policy;
- `Cross-Origin-Opener-Policy: same-origin`;
- `Cross-Origin-Resource-Policy: same-origin`;
- `Origin-Agent-Cluster: ?1`;
- a restrictive `Permissions-Policy`;
- `Referrer-Policy: no-referrer`;
- one-year HSTS without premature subdomain or preload commitment;
- MIME-sniffing, framing, DNS-prefetch and cross-domain-policy restrictions.

HTML requires revalidation. Fingerprinted assets are immutable for one year.
The build also emits `_headers` for a compatible assets-only host. GitHub Pages
does not provide the same HTTP-header envelope; its early meta CSP is a useful
fallback, not an equivalent control.

## Integrity and recovery

Each publication page shows the complete SHA-256 of its restricted Markdown
source. Every build publishes `/.well-known/site-receipt.json`, which lists the
architecture, source receipts, byte lengths and SHA-256 hash of every other
public file. The build verifies the receipt before deployment.

The same clean build is reproducible. Canonical Git history, independent
bundles, exact-output archives, deployment rollback, and a provider-independent
mirror form the recovery design in `HOSTING_AND_RECOVERY.md`.

## Hold boundary

Keep `SBX-SOH-001` visible at every public content entry point. This publication
does not activate NEX issuance, wallets, transfers, participant recruitment,
AI-work purchasing, financialisation, or a Lab promotion. Only dated Human
Operator writing can change that hold.
