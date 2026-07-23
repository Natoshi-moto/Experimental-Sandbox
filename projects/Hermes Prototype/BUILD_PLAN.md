# Hermes Prototype — build plan

**status_authority:** `NONE`
**State:** `READY_PENDING_ONE_BLOCKER` — see step 0.
**This is the execution runbook. `SPEC.md` is the reference; this is the order of operations.**

## What we're actually doing, in plain terms

Installing one program (Hermes Agent) that remembers things across sessions and can be told to do work on a schedule. Pointing its "brain" at two places: DeepSeek's cloud API for anything that needs real reasoning power, and a model already sitting on this machine (`Huihui-gemma-4-12B`, benchmarked at ~23 words/sec, which is fast enough not to be annoying) for smaller, cheaper tasks. Then installing a second small program (Herdr) that puts Hermes and your regular Claude Code terminal side by side in one window so you can see both at a glance instead of alt-tabbing between them.

Nothing here talks to Anthropic, OpenAI, or OpenRouter. Nothing here costs anything except DeepSeek API usage (pay-per-use) and electricity for the local model.

## Step 0 — the one actual blocker

**Do you have a DeepSeek API key yet?** Everything below except steps 1-2 depends on it. If not, get one at DeepSeek's platform before continuing past step 4. Nothing about steps 1-2 (reading the installer, installing) needs it.

## Step 1 — read the installer (I do this, you don't have to watch)

Fetch `https://hermes-agent.nousresearch.com/install.sh`, read every line. If it does anything beyond "install this one program" — touches other config files, phones home somewhere unexpected, asks for sudo without explaining why — I stop and tell you before running it, not after.

## Step 2 — install

Run the installer only after step 1 comes back clean. Confirm it worked with `hermes config check`.

## Step 3 — tell it about DeepSeek

One command sets the model, one sets the key (stored in `~/.hermes/.env`, never anywhere near this git repo):

```bash
hermes config set model.provider custom
hermes config set model.base_url https://api.deepseek.com
hermes config set model.default deepseek-v4-flash
hermes config set DEEPSEEK_API_KEY <your key>
```

## Step 4 — tell it about the local model

```bash
hermes config set auxiliary.compression.provider custom
hermes config set auxiliary.compression.base_url http://localhost:11434/v1
hermes config set auxiliary.compression.model "hf.co/KakTakOne/Huihui-gemma-4-12B-coder-fable5-composer2.5-v1-abliterated-GGUF:Q4_K_M"
```

(Exact `hermes config set` key paths for nested YAML — confirm against `hermes config get model` output after step 3, since the docs show the CLI form but not every nested-path example. If the dotted-path form above doesn't take, fall back to `hermes config edit` and hand-edit the YAML block from `SPEC.md` §2 directly.)

## Step 5 — the actual smoke test

One real question, run twice — once forced to DeepSeek, once forced to the local model — to confirm both paths genuinely work rather than one silently falling back to the other:

```bash
hermes chat --provider custom --model deepseek-v4-flash -q "What model are you and who made you?"
hermes chat --provider custom --model "hf.co/KakTakOne/Huihui-gemma-4-12B-coder-fable5-composer2.5-v1-abliterated-GGUF:Q4_K_M" -q "What model are you and who made you?"
```

Both answers should be self-consistent with what they actually are. If either claims to be the other, or errors out, stop — that's a kill criterion (`SPEC.md` §5), not something to route around.

## Step 6 — Herdr (only after step 5 passes)

Install per Herdr's own current README (not from this document — install methods drift). Open one pane running `hermes`, one running your current Claude Code session, confirm both show up correctly labeled with live status.

## Step 7 — write down what actually happened

A dated results file in this same folder — what passed, what didn't, real numbers where there are numbers. Not a rewrite of this plan to make it look like it went perfectly if it didn't.

## What I will not do without asking again

- Enable `--yolo` / `HERMES_YOLO_MODE`.
- Install Grok Build/CLI or wire Herdr's `grok` detection until the exact tool is confirmed (`VERIFY_FIRST.md` #9).
- Touch anything in `Natoshi-moto/Lab`.
- Push this repo's `main` directly, or merge any of the open PRs myself.
