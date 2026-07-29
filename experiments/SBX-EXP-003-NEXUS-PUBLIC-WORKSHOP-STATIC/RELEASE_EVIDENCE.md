# Static successor release evidence

Date: `2026-07-29`

## Source and deployment

- Source commit: `941deed827981831709c2109ff0fe38a167f04bf`
- Public URL:
  <https://nexus-public-workshop.everythingbitesized.chatgpt.site>
- Access: public, read-only documentary prototype
- Hold: `SBX-SOH-001` remains `ACTIVE`

## Verified build result

- `16` tests passed; `0` failed.
- Static artifact validation passed.
- All internal pages, fragments, CSS assets, fonts, image paths, and configured
  GitHub Pages paths resolved.
- The public receipt covered every emitted public file except the receipt
  itself and verified each byte length and SHA-256.
- The complete publication source hash is displayed on its article page.
- `npm audit --omit=dev` reported `0` vulnerabilities.
- `package.json` contains `0` runtime and `0` development dependencies.
- A dedicated path-scoped GitHub Actions job verifies `MANIFEST.sha256`,
  installs the exact zero-dependency lockfile with package scripts disabled,
  and runs this same production gate on pull requests and `main`.

## Browser artifact boundary

The emitted public directory contains generated HTML, CSS, WOFF2, WebP, SVG,
text, JSON receipt, `_headers`, and `.nojekyll`.

It contains no JavaScript, JSX, TypeScript, WebAssembly, source map, framework
hydration marker, form, inline event handler, inline style, remote browser
subresource, cookie, analytics code, or write surface.

The CSP includes `default-src 'none'` and `script-src 'none'`. The mirror-safe
meta CSP is emitted before browser resource links. The Sites edge response
adds the full framing, feature, referrer, MIME, transport, cross-origin, and
cache envelope.

## Independent review

The adversarial review first returned a narrow `HOLD`:

1. receipt wording said “deployment” even though the public receipt covered the
   public static files, not provider metadata; and
2. root-relative paths would have broken an ordinary GitHub project Pages
   mirror.

Both were repaired. The wording now scopes the receipt to the public static
artifact. `SITE_URL` and `SITE_BASE_PATH` are validated and applied to every
local route, asset, favicon, navigation link, and canonical URL. A regression
test covers `/nexus-public-workshop` project Pages output.

The final independent verdict was `PASS`.

## Honest boundary

No cloud-browser visual inspection is claimed for this checkpoint. The visual
system preserves the selected all-dark stylesheet and semantic HTML structure,
and the zero-script native navigation was statically and independently
reviewed. The public URL is the Human Operator's inspection surface.

The current Sites host still requires a minimal edge Worker. The independent
Cloudflare configuration omits a Worker `main`; that provider cutover,
dedicated repository, account hardening, native Pages mirror, and durable
off-provider backups remain separate controlled operations.
