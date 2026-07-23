# Hermes Prototype — spec

**status_authority:** `NONE`
**State:** `PROPOSAL_ONLY`
**Read `VERIFY_FIRST.md` and `WHITEPAPER.md` first.**

## 1. Components

| Component | Repo | License (API-verified) | Role |
|---|---|---|---|
| Hermes Agent | `NousResearch/hermes-agent` | MIT | Persistent operator: memory, skills, scheduling, main reasoning loop |
| Herdr | `ogulcancelik/herdr` | Apache-2.0 | Terminal multiplexer / control room across Hermes + vanilla agent panes |
| Ollama | (already installed locally, `/usr/local/bin/ollama`) | MIT (Ollama itself) | Local model runner, OpenAI-compatible endpoint |
| DeepSeek API | `api.deepseek.com` | N/A (hosted service, not open-source code) | Remote main-model provider |

Nothing else from the original transcript's list is a dependency of this prototype (see WHITEPAPER.md §4).

## 2. Provider wiring

Hermes's own model backend only accepts OpenAI-compatible custom endpoints (plus Nous Portal / OpenRouter, both explicitly out of scope per operator decision — no Anthropic routing needed, no OpenAI account needed). Two endpoints, both already OpenAI-API-shaped:

```yaml
# ~/.hermes/config.yaml — SKELETON, not yet verified against the installed version's actual schema (VERIFY_FIRST.md #5)

model:
  provider: custom
  base_url: https://api.deepseek.com/v1
  api_key: ${DEEPSEEK_API_KEY}
  default: deepseek-chat        # confirm current model name at install time

auxiliary:
  compression:
    provider: custom
    base_url: http://localhost:11434/v1
    model: <model already pulled via `ollama list`>
  # add more auxiliary task overrides (vision, title, session search) only as needed —
  # don't pre-configure tasks that won't be used
```

`DEEPSEEK_API_KEY` is an environment variable, never written into the file directly or committed anywhere. No key of any kind belongs in this repo.

## 3. Terminal layer

Herdr multiplexes:
- one pane running `hermes` (the persistent operator),
- one pane running the operator's active Claude Code session,
- additional panes for Codex / the xAI agent as the operator brings them in.

Herdr's own agent-detection registry (per its docs, not yet independently fetched — `VERIFY_FIRST.md` #8) already includes `hermes`, `claude`, `codex`, and `grok` as recognized process names. No custom Herdr configuration should be needed for basic detection; if a pane shows as unrecognized, that's a signal something in this table is stale, not a cue to fork Herdr.

## 4. Install sequence (not yet executed)

1. Fetch `https://hermes-agent.nousresearch.com/install.sh` with `WebFetch` or `curl -o` (download only, no pipe-to-shell) and read it in full.
2. Confirm it only does what the docs claim (installs a single binary / clones the repo + sets up a venv or similar — whatever it actually does, read, don't assume).
3. Run it only after that read, and only after explicit operator go-ahead separate from this document's creation.
4. Run whatever health-check command Hermes ships (`hermes doctor` or equivalent — confirm exact command from `--help` after install, don't assume the name).
5. Configure `~/.hermes/config.yaml` per §2, using a real DeepSeek key supplied by the operator out-of-band (never pasted into a file this session writes to a public repo).
6. Confirm `ollama list` shows at least one usable model; pull one if not, with operator confirmation of which model (size/resource tradeoff is the operator's call, not mine to default silently).
7. Install Herdr (`ogulcancelik/herdr` — confirm current recommended install method from its own README at install time, not from this document).
8. Start Hermes in one Herdr pane, a Claude Code session in another, confirm both are detected and correctly labeled.
9. Record actual results — pass/fail per §5 kill criteria below — as a dated entry in this same `projects/Hermes Prototype/` folder. Do not edit this spec to make a failed step look passed; add a results file instead.

## 5. Kill criteria

Stop and record a defect (don't quietly patch around it) if:
- The install script does anything not described in Hermes's own docs (network calls to undocumented hosts, writes outside its own directory, sudo requests not mentioned anywhere).
- `hermes doctor` (or equivalent) fails after a clean install with no obvious operator-side misconfiguration.
- The DeepSeek or Ollama endpoint returns auth/connection errors that aren't resolved by a correct, verified key/model name.
- Herdr fails to detect Hermes or Claude Code as running agents (falls back to plain-terminal display, no status).

## 6. What this spec deliberately does not cover

- Multi-machine / SSH / Docker / cloud terminal backends (Hermes documents six backends; this prototype only targets `local`).
- Anthropic/Claude routing into Hermes's own reasoning loop (explicitly out of scope, operator decision).
- Any of Hermes's messaging-platform integrations (Telegram/Discord/Slack/etc.) — not part of the stated workflow.
- MCP server integration — real and relevant long-term, but a separate round once the base loop above is confirmed working.
