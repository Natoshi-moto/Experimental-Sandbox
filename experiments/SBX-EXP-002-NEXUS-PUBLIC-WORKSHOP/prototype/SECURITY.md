# Security posture

NEXUS Public Workshop is designed as a read-only publication, not as an online
application with a public control plane.

The current deployment is a public documentary prototype. It is not the final
independent static-host architecture described below, and it does not activate
any NEX or Reasoning Market mechanism.

No website is untouchable. The target is narrower and testable:

- minimise executable and writable surface;
- make silent alteration difficult;
- keep browser data valueless;
- make every publication reproducible from reviewed source;
- restore a known-good version in minutes.

## Report privately

Use the repository's private vulnerability reporting flow:

<https://github.com/Natoshi-moto/Quantum-Nexus/security/advisories/new>

Do not include credentials, private personal data, or destructive proof in an
initial report.

The deployed copy also publishes `/.well-known/security.txt`.

## Application boundary

The workshop currently has:

- no public sign-in, admin panel, CMS, form, upload, comment, or write API;
- no database, object store, analytics, ads, tracking pixel, or application
  cookie;
- no third-party browser scripts or remote browser assets;
- no raw HTML or executable MDX in publications;
- no image transformation endpoint;
- no Server Action request surface;
- only `GET` and `HEAD` methods admitted to the application;
- explicit framing, referrer, MIME-sniffing, browser-feature, cross-origin, and
  transport headers.

Future interactive demonstrations must live on a separate origin with no shared
cookies. Agent-generated code must never execute under the publication origin.

## Publishing boundary

Published writing lives under `content/` as one restricted Markdown file per
record. Folder and filename determine its public label, date, and slug.

The compiler rejects:

- raw HTML, MDX imports/exports, images, and symbolic links;
- unsafe link protocols;
- duplicate or malformed slugs;
- invalid dates;
- missing titles, summaries, or bodies;
- oversized source files.

The renderer turns validated tokens into React elements. It never uses
`dangerouslySetInnerHTML`.

The build fails if a future change introduces a database binding, API route,
form, client component, raw-HTML escape hatch, runtime remote fetch, or the
removed image processor without an explicit architecture change.

## Response policy

Every response receives:

- `Content-Security-Policy` for base, object, form, frame, and upgrade controls;
- `Cross-Origin-Opener-Policy: same-origin`;
- `Cross-Origin-Resource-Policy: same-origin`;
- `Origin-Agent-Cluster: ?1`;
- a restrictive `Permissions-Policy`;
- `Referrer-Policy: no-referrer`;
- one-year HSTS without preload or subdomain commitment;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `X-Permitted-Cross-Domain-Policies: none`.

HTML is marked `no-store` while the current framework runtime remains. Hashed
static assets may be cached immutably.

The present Vinext/Next build emits inline framework scripts. The policy does
not hide that fact behind an `unsafe-inline` claim. The independent static-host
release should remove the framework runtime and enforce `script-src 'none'`.

## Operational controls for the public prototype

- Keep the active `SBX-SOH-001` hold visible at the public entry point.
- Treat this deployment as a documentary prototype, not an economic,
  participant-facing, or final security launch.
- Keep access read-only and retain the fail-closed request boundary.
- Publish the reviewed source snapshot and hold classification in Experimental
  Sandbox.

## Controls before the independent hosted release

- Put the canonical source in a dedicated GitHub repository.
- Require passkeys and retain offline recovery codes for GitHub, Cloudflare, and
  the domain registrar.
- Protect the production branch and keep deployment credentials out of pull
  request builds.
- Enable DNSSEC, registrar transfer lock, CAA, and certificate-transparency
  monitoring.
- Review dependency advisories on a schedule; never run a forced automatic
  dependency rewrite.
- Keep an independent repository mirror and offline `git bundle`.
- Perform a restore drill before calling the backup real.

The complete hosting and recovery design is in
`HOSTING_AND_RECOVERY.md`.
