# Cheap, hardened hosting and recovery

Date checked: 2026-07-29.

## Decision

Use four deliberately independent layers:

1. a dedicated public GitHub repository as canonical source and publication
   history;
2. Cloudflare Workers Static Assets as the primary host, with no Worker `main`;
3. GitHub Pages at its native `github.io` address as the emergency public
   mirror;
4. verified Git bundles and exact built-output archives stored offline and
   off-provider.

Expected hosting cost is £0 plus the ordinary annual domain renewal. The first
10 GB of Backblaze B2 storage is also currently free, if an encrypted immutable
off-provider copy is wanted.

Official references:

- <https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/>
- <https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/>
- <https://developers.cloudflare.com/workers/static-assets/>
- <https://developers.cloudflare.com/workers/versions-and-deployments/>
- <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>
- <https://www.backblaze.com/cloud-storage/pricing>

## Present checkpoint

The ChatGPT Sites source now builds generated HTML, CSS and local media with
zero application JavaScript. Sites still requires a tiny edge Worker for static
path mapping and its shared edge can alter the final response.

A 2026-07-29 raw-response check found a provider-appended Cloudflare
browser-detection script, an `__cf_bm` cookie, and omission of the intended
complete HTTP-header envelope on the static response. The early meta CSP
refuses script execution, but this means the current shared hostname is not
claimed as end-to-end script-free or cookie-free. It remains the public
prototype, not the final independent-provider cutover.

## One-sentence publishing workflow

Tell the site editor: **“Add this as a note.”** Review the generated draft, then
say: **“Publish it.”**

Underneath, that means:

1. create one restricted Markdown file;
2. compile it into static HTML;
3. run all content, architecture, output, route, header and receipt gates;
4. review the real page;
5. merge one inspectable source commit;
6. let both hosts publish the same approved artifact.

There is no website password or admin URL to steal.

## Canonical host

Cloudflare Workers Static Assets should deploy `dist/client` only.

- Omit a Worker `main`.
- Disable `workers.dev` and public preview URLs.
- Scope Cloudflare's GitHub App to the dedicated site repository only.
- Require pull requests and passing static-site checks on the production
  branch.
- Keep deployment credentials out of pull-request jobs.
- Pin third-party GitHub Actions to complete commit SHAs.
- Retain the provider `_headers` file and verify every live response after
  cutover.
- Do not enable a browser-challenge or bot feature that rewrites HTML or sets a
  browser-detection cookie on this static publication.
- Require `npm run verify:live -- https://HOST` to pass before changing the
  canonical domain.

Cloudflare's current static-site guidance:

- <https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/>
- <https://developers.cloudflare.com/workers/static-assets/headers/>
- <https://developers.cloudflare.com/workers/configuration/routing/workers-dev/>
- <https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/>

## Emergency mirror

GitHub Pages should keep its native `github.io` address. That address remains
shareable if the custom domain or Cloudflare control plane is unavailable and
avoids abandoned custom-domain DNS takeover risk.

For an ordinary project Pages repository named `nexus-public-workshop`, build
the mirror with:

```sh
SITE_URL=https://natoshi-moto.github.io SITE_BASE_PATH=/nexus-public-workshop npm run build
```

The generator validates both values and prefixes every local route, asset,
favicon and canonical URL. The primary custom-domain and Sites builds leave
`SITE_BASE_PATH` empty.

The mirror is an availability copy, not a backup. If the same GitHub account or
malicious commit controls the canonical source and Pages build, both can be
altered together.

## Account and domain controls

Keep the registrar separate from Cloudflare if maximum administrative
separation matters.

At all owner accounts:

- use two phishing-resistant security keys or passkeys;
- keep recovery codes offline in separate locations;
- use a dedicated recovery address;
- review active sessions and application grants.

At the registrar:

- enable transfer lock and auto-renewal;
- retain a backup payment method and independent renewal reminder;
- do not use wildcard DNS.

At Cloudflare:

- enable DNSSEC and install the DS record at the registrar;
- export the DNS zone before material changes;
- add CAA only after deliberately auditing certificate issuance;
- begin HSTS without `includeSubDomains` or preload.

References:

- <https://developers.cloudflare.com/fundamentals/user-profiles/2fa/>
- <https://developers.cloudflare.com/dns/dnssec/>
- <https://developers.cloudflare.com/ssl/edge-certificates/caa-records/>
- <https://www.icann.org/en/blogs/details/do-you-have-a-domain-name-heres-what-you-need-to-know-26-3-2018-en>

## Backups that are actually backups

After every publication, or at least daily, preserve:

- a mirror clone containing every Git ref;
- a `git bundle` created with `--all`;
- successful `git bundle verify` output;
- a SHA-256 manifest;
- an archive of the exact generated static artifact;
- the DNS zone export, deployment configuration and this recovery runbook.

Store them in separate failure domains:

- the normal working repository;
- one unplugged encrypted drive;
- one rotated off-site copy;
- optionally one encrypted immutable object at an independent provider.

A Git bundle does not preserve GitHub issues, pull requests, repository rules,
secrets, recovery codes, domain ownership, or provider configuration. Preserve
those administrative records separately.

GitHub and Git references:

- <https://docs.github.com/en/repositories/archiving-a-github-repository/backing-up-a-repository>
- <https://git-scm.com/docs/git-bundle>
- <https://www.backblaze.com/docs/cloud-storage-object-lock>

## Restore drill

Run this before independent cutover and every quarter:

1. start with an empty temporary directory;
2. restore from the offline bundle, not GitHub;
3. run the complete zero-dependency build;
4. compare the public receipt with the archived exact-output receipt;
5. serve the restored static directory locally;
6. inspect the home page, one article, the 404 and the mobile menu;
7. deploy to a disposable recovery target;
8. record elapsed time and every manual correction;
9. destroy the disposable target.

Target: under 30 minutes for source loss and under 10 minutes for a bad
deployment rollback.

## Failure model

| Failure | Recovery |
| --- | --- |
| Bad publication | Roll back the Cloudflare version, then revert the source commit. |
| Cloudflare or DNS outage | Share the stable `github.io` mirror directly. |
| GitHub outage | Existing deployments keep serving; publishing pauses. |
| GitHub compromise | Freeze deploys, revoke access, compare receipts, restore a verified bundle, rebuild both hosts. |
| Cloudflare compromise | Registrar separation prevents domain transfer; use the Pages address and offline source while DNS is recovered. |
| Repository deletion | Restore the verified bundle; provider recovery is a bonus, not the plan. |
| Registry or dependency outage | The site builds using Node core only and preserves exact built artifacts. |
| Stale backup | Creation-time verification plus quarterly clean-room restore. |
| Convenience creep | The build refuses browser code, forms, remote resources, unexpected files and write surfaces. |

Nothing online is literally untouchable. This architecture is exemplary because
there is almost nothing mutable to attack, releases are attributable, provider
failures are separated, and recovery is rehearsed rather than assumed.
