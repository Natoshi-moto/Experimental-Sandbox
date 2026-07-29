# Cheap, hardened hosting and recovery

Date checked: 2026-07-29.

## Decision

For the independent release, use:

1. **Cloudflare Workers Static Assets** as the production host;
2. a dedicated **GitHub repository** as the canonical source and publishing
   record;
3. **GitHub Pages** as an independent emergency mirror;
4. two offline or independently stored Git backups.

Expected hosting cost: **£0**, plus the ordinary annual domain renewal.

The current public Sites deployment is a documentary prototype. Its reviewed
source and hold classification are preserved in Experimental Sandbox as a
provenance snapshot; that snapshot is not yet the dedicated canonical
publishing repository described here.

Cloudflare documents static asset requests and storage as free and unlimited.
Its free build allowance is 3,000 minutes per month. GitHub Pages is available
for public repositories on GitHub Free and is far inside its published limits
for this site.

Primary references:

- <https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/>
- <https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/>
- <https://developers.cloudflare.com/workers/static-assets/>
- <https://developers.cloudflare.com/ddos-protection/about/>
- <https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/>
- <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>

## Why this shape

The production host should serve generated HTML, CSS, fonts, images, and no
runtime application server. There is then no database, login endpoint, content
API, or origin server worth attacking or maintaining.

Cloudflare provides the primary edge, TLS, DDoS handling, deployment history,
and domain controls. GitHub provides human-readable source history. GitHub
Pages provides a second-provider URL if Cloudflare or the domain path fails.

The mirror is intentionally manual failover, not active-active infrastructure.
Automatic DNS failover would add cost and failure modes to a static publication
without solving a proportionate problem.

## One-sentence publishing workflow

Tell the site editor: **“Add this as a note”**, review the generated draft, then
say **“publish it.”**

Underneath, that performs a deliberately boring sequence:

1. Create one file in `content/_drafts`.
2. Move the reviewed file into its public category.
3. Compile restricted Markdown.
4. Run content, architecture, type, lint, build, route, and header gates.
5. Commit one inspectable publication change.
6. Merge to the protected production branch.
7. Let Cloudflare and the GitHub Pages mirror build the same source.

There is no website password or admin URL to steal.

## Account and domain setup

- Use a dedicated repository and grant the Cloudflare GitHub App access to that
  repository only.
- Require passkeys on GitHub, Cloudflare, and the registrar.
- Store at least two recovery methods separately; keep recovery codes offline.
- Enable registrar transfer lock and domain-expiry auto-renewal.
- Enable DNSSEC.
- Publish restrictive CAA records after choosing the certificate authorities.
- Use one canonical hostname and redirect the other form.
- Do not use wildcard DNS.
- Start HSTS without `includeSubDomains` or preload. Expand only after every
  intended subdomain is permanently HTTPS.
- Enable Cloudflare's maintained baseline protections. Do not stack aggressive
  rules merely to look secure; monitor false positives.

WAF guidance:

<https://developers.cloudflare.com/waf/get-started/>

## Backup layers

### 1. Deployment rollback

Keep Cloudflare's recent immutable deployments. This is the fastest rollback,
but it is not an independent backup.

### 2. Canonical Git history

Every publication is a small commit. Reverting that commit reconstructs the
previous site.

### 3. Independent repository mirror

Mirror the complete repository, including all refs, to a second provider or
offline disk. GitHub's own backup guidance recommends a mirror clone:

<https://docs.github.com/en/repositories/archiving-a-github-repository/backing-up-a-repository>

### 4. Portable offline bundle

Create a full `git bundle` and keep two encrypted copies in separate locations.
The bundle is useful only after a restore test proves it can recreate the
repository.

### 5. Emergency public mirror

Build the same static output on GitHub Pages and keep its permanent URL
documented offline. It is the “Cloudflare is unavailable” address, not an
automatic replica of the custom domain.

## Restore drill

Perform this before the independent hosted release and every six months:

1. Create an empty temporary directory.
2. Restore from the offline bundle, not from the live GitHub repository.
3. Run the full build gate without production credentials.
4. Compare the generated publication hashes with the last known-good receipt.
5. Deploy to a disposable recovery target.
6. Record the elapsed time and every manual step.
7. Destroy the disposable target.

Target recovery time: under 30 minutes for source loss; under 10 minutes for a
bad deployment rollback.

## Migration from the current public prototype

The current Sites deployment is the public documentary prototype. It keeps a
runtime framework and therefore does not claim the final static security
posture. Migration to the independent canonical release should happen only
after:

- the visual and content system is stable;
- the output is converted to genuinely static files;
- `script-src 'none'` works;
- the dedicated repository and protected branch exist;
- all three owner accounts are passkey-protected;
- the mirror and offline bundle have passed one restore drill.
