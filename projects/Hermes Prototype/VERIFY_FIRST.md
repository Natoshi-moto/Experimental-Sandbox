# Verify these before reading SPEC.md or any code

**status_authority:** `NONE`
**Read this file first. It is deliberately shorter than the spec.**

Every fact below passed through at least one AI summarization layer before landing in this document — some through two or three (a third-party AI chat transcript, then this session's own web-search tool, which itself summarizes results through a small model, then in some cases a direct API call as ground truth). Layered AI summarization is exactly how the errors in the "already found and corrected" table below got introduced. Assume more exist. This list is what to re-check with your own eyes — not this document's word — before trusting SPEC.md or WHITEPAPER.md, and certainly before running any installer.

## Already found wrong once — re-check again before relying on them

These were actively contradicted between sources during this project's own research. Each was checked against the GitHub API directly, which is why a specific value is given — but APIs get stale too, so re-run the command yourself.

| Claim | Turned out to be | Check it yourself |
|---|---|---|
| Herdr's license | Three sources disagreed: MIT (original transcript), AGPL-3.0 (this session's own web search), **Apache-2.0** (GitHub API — the one to trust) | `gh api repos/ogulcancelik/herdr --jq .license.spdx_id` |
| Invoke (pyinvoke)'s license | Claimed MIT ("implied"), actually **BSD-2-Clause** | `gh api repos/pyinvoke/invoke --jq .license.spdx_id` |
| interactive-terminal-mcp's license | Implied reusable, actually **no license file at all** — default all-rights-reserved | `gh api repos/WangYihang/interactive-terminal-mcp --jq .license` |
| Cronicle, Sandcastle repo paths | Both guessed paths **404'd** — don't assume either exists at the location cited anywhere upstream of this doc | Re-search from scratch, don't reuse the path in WHITEPAPER.md |

## Load-bearing facts this whole prototype depends on — verify before writing code

If any of these are wrong, the architecture in SPEC.md doesn't hold and shouldn't be implemented as written.

1. **`NousResearch/hermes-agent` is the real, official repo, and `hermes-agent.nousresearch.com` is the real, official install source — not a lookalike/typosquat domain.**
   Check: confirm the domain is linked from the GitHub repo's own README/website field, not just that it resolves. `gh api repos/NousResearch/hermes-agent --jq .homepage,.license.spdx_id`

2. **The install script actually installs what the docs describe, and does nothing else.**
   Not yet fetched or read in this session. Must be fetched and read in full — every line — before it is ever piped into a shell. Do not run `curl | bash` on it blind. This is the single highest-consequence unverified item in the whole prototype: it runs with the operator's real system permissions.

3. **The claimed star count (219,434 at last check) is real and not an API/caching artifact.**
   This number is unusually high for a project whose earliest mentions found here date to Feb 2026. Not disqualifying, but surprising enough to double-check before quoting it anywhere public (e.g. in a promotion package). `gh api repos/NousResearch/hermes-agent --jq .stargazers_count` again, and compare against the number the repo's own README/site claims.

4. **Hermes Agent has no native Anthropic/Claude API provider support** — documented as OpenAI-compatible-endpoint-only (Nous Portal, OpenRouter, OpenAI, or "any endpoint"). This project doesn't need Anthropic support (operator confirmed DeepSeek + local only), but if that decision ever changes, re-verify this hasn't changed in a newer Hermes release before assuming an OpenRouter bridge is still required.

5. **The `config.yaml` schema shown in SPEC.md** (`model:`, `auxiliary:`, `provider: custom`, `base_url`, `credential_pool_strategies`) **matches the current shipped version, not a stale doc snapshot.** Docs sites and READMEs drift from code. Before writing a real config file: `hermes --version` after install, then check `website/docs/user-guide/configuration.md` in the exact tag/commit installed, not just the live docs site.

6. ~~`https://api.deepseek.com/v1` is DeepSeek's current, correct, official base URL~~ — **checked directly against `api-docs.deepseek.com`, and this is now urgent, not just a nice-to-verify:**

   - Base URL confirmed: `https://api.deepseek.com` (no account/key from OpenAI needed — confirmed, you apply for a DeepSeek key directly).
   - **`deepseek-chat` and `deepseek-reasoner` — the model names in this project's original config skeleton — are documented as deprecated on 2026/07/24.** Today, at time of writing, is 2026-07-23. This deprecation lands within roughly a day of this document being written. Current replacement names per the same docs: `deepseek-v4-flash` and `deepseek-v4-pro`. **Re-check this again at actual install time, not from this document** — if it's now past 2026-07-24, confirm the old names are actually gone (not just "deprecated but still working"), and confirm `deepseek-v4-flash`/`deepseek-v4-pro` are still the current names and haven't themselves been superseded.

7. ~~The locally installed `ollama` binary actually serves an OpenAI-compatible endpoint~~ — **checked, fully confirmed, better than expected:**

   - `ollama --version` → `0.30.7`.
   - `curl localhost:11434/v1/models` → responds correctly, OpenAI-compatible shape confirmed live, not just assumed from Ollama's own docs.
   - `ollama list` already shows 12 models pulled, including **three local DeepSeek-R1 variants already present** (`deepseek-r1-14b-24k`, `deepseek-r1-14b-abliterated`, `deepseek-r1-32b`) plus several Qwen/Gemma variants. **No model needs to be pulled before this prototype can be tried** — this removes an entire install step. Still the operator's call which model to actually assign to the `auxiliary` config in SPEC.md; don't default silently.

8. **Herdr's exact agent-detection registry could not be confirmed from its own official docs page** (`herdr.dev/docs/agents/`, fetched directly this session) — the page lists supported agents in prose ("Hermes Agent," "Claude Code," "Codex," "Grok CLI") but does not expose the literal process-name strings it matches on, and states that adding a new agent "still requires a Herdr binary update for process detection." **This downgrades confidence from the earlier round**, which had cited a specific 16-item list (`claude, codex, gemini, cursor, ...`) sourced only from web-search summaries of third-party blog posts about Herdr, not Herdr's own docs or source. Treat that specific list as a lead, not a fact, until read directly from Herdr's source (`ogulcancelik/herdr`, e.g. its agent-registry config file) rather than any secondary description of it.

9. **Which "Grok" tool is meant is still unresolved.** Two different real projects exist: `xai-org/grok-build` (Apache-2.0, xAI's official terminal coding agent, up to 8 parallel agents) and `superagent-ai/grok-cli` (a separate, unofficial wrapper around the Grok API). Herdr's `grok` trigger matches whichever process name one of these actually launches as — not verified which. Confirm with the operator which tool they mean, and confirm the binary name Herdr actually looks for, before assuming Herdr will detect it out of the box.

10. ~~**No supply-chain collision**~~ — **checked this session, real collisions confirmed, do not `pip install` or `npm install` by habit:**

    | Registry | Name | What it actually is |
    |---|---|---|
    | PyPI | `hermes-agent` | Author field says "Nous Research" — plausibly the real package, but PyPI author fields are self-declared and not independently confirmed here. If installing via pip at all, still confirm against the official installer's own instructions first. |
    | PyPI | `hermes-cli` | Unrelated — author "Dmitry Gordienko," an unrelated personal tool |
    | PyPI | `hermes` | Unrelated — "Workflow to publish research software with rich metadata" (`softwarepub/hermes`) |
    | npm | `hermes-agent` | Explicitly labeled **"Unofficial npm bridge for Hermes Agent"** by a third-party maintainer (`wyrtensi`) — not the real project, don't install this expecting the official tool |
    | npm | `hermes-cli` | Unrelated — a travel-agency search tool |
    | npm | `hermes` | Unrelated — Segment's old email-templating library (`segmentio/hermes`) |

    Use the official installer (`hermes-agent.nousresearch.com/install.sh`, read first per item 2) or the confirmed GitHub repo directly. Do not `pip install hermes` / `npm install hermes-agent` on autopilot — every one of those names already resolves to something else.

    Bonus finding: the unofficial npm bridge's own description references "Hermes Agent 0.19.0," one minor version ahead of the "v0.18.0" the original pasted transcript claimed — another small sign that transcript was slightly stale even where directionally correct.

## What "verified" means in this document, precisely

- **Directly confirmed, live, this session** (Ollama version/model list/endpoint reachability; PyPI/npm package ownership; DeepSeek's docs page fetched directly): the strongest tier available to an AI session without physical access — still worth a human glance, but not secondhand.
- **API-checked** (Herdr license, Invoke license, star counts, `.license.spdx_id` fields): queried directly against `api.github.com` this session. Trustworthy as of the query time; can go stale.
- **Search-summarized** (Herdr's agent registry contents, Hermes's provider list, DeepSeek's compatibility claim): came from this session's `WebSearch` tool, which itself runs the raw results through a small summarization model before returning them. Treated as a lead, not a fact, until independently re-fetched.
- **Transcript-only** (anything in WHITEPAPER.md attributed to "the original pasted transcript" and not independently re-checked): the least trustworthy tier. Assume unverified until it appears in this file with a check command next to it.

Nothing in this project has `status_authority` above `NONE`. Nothing here has been run.
