# Handoff — side-by-side Claude Code / Hermes terminal with a work-swap pipeline

**For:** any AI seat picking up this design discussion, zero prior context assumed
**From:** Claude (this session), 2026-07-23
**status_authority:** `NONE` — this is a design conversation starter, not a spec

## The ask

Operator wants a side-by-side terminal experience — like two windows snapped side by side, one running Claude Code, one running Hermes Agent — where the two can **swap work with each other through a pipeline backend**, not just sit next to each other visually.

## What already exists on this machine — check this before designing anything from scratch

Both halves of "side by side" and both candidate pipeline mechanisms are already installed, configured, and working as of tonight. Read `README.md` → `VERIFY_FIRST.md` → `WHITEPAPER.md` → `SPEC.md` → `RESULTS_2026-07-23.md` in this same folder for the full trail (install process, real bugs hit and fixed, licensing corrections, benchmarks). Short version:

- **Hermes Agent** (`NousResearch/hermes-agent`, MIT) installed at `~/.hermes/hermes-agent`, configured with DeepSeek (`deepseek-v4-flash`) as main model and a local Ollama model (`obliterated-gemma-65k`, a Modelfile-derived 64K-context build) as auxiliary. `SOUL.md` and a source patch (`agent/system_prompt.py`) were edited to strip Hermes's own injected persona — operator wanted the agent identity to be honest/neutral, not a "Hermes Agent by Nous Research" claim baked into every response regardless of underlying model.
- **Herdr** (`ogulcancelik/herdr`, Apache-2.0, v0.7.5) installed and confirmed working: split-pane terminal multiplexer with live agent-state detection. Already tested live, side by side, `hermes` in one pane and `claude` (this exact CLI) in another, both correctly labeled with live status in the sidebar. This is the "side by side" half, already solved.

## The two real candidate mechanisms for "swap work," both verified to exist tonight (not assumed from docs — pulled from `--help` on the actual installed binaries)

### 1. Herdr's own socket-backed pane/agent control API

```
herdr agent prompt    — submit a prompt to a running agent pane
herdr agent read       — read an agent pane's terminal output
herdr agent wait       — block until an agent reaches a given state (idle/done/blocked/working)
herdr agent list/get   — enumerate and inspect running agents
herdr pane send-text / send-keys / run / wait-output / read
herdr api snapshot     — live session state
herdr api schema       — the bundled API schema (this is the thing to read first — it's self-documenting)
```

This is already how Herdr's own Claude Code integration works under the hood — the hook we installed tonight (`~/.claude/hooks/herdr-agent-state.sh`) talks to Herdr's local Unix socket via a `pane.report_agent_session` JSON-RPC-shaped call. That's a real, working, minimal example of an agent talking to Herdr's backend already sitting on this machine — read it before designing something new.

**Naive pipeline shape this enables**: something (a script, a third pane, a cron job) calls `herdr agent prompt --agent hermes "<task>"`, polls `herdr agent wait`, then `herdr agent read` the result, and feeds it to Claude Code's pane the same way. Imperative, pane-shaped, works today with zero new code — worth prototyping first as the cheap baseline before building anything fancier.

### 2. Hermes as an MCP server

```
hermes mcp serve — "Run Hermes as an MCP server (expose conversations to other agents)"
```

This is a real subcommand, not aspirational — Hermes can expose itself over the Model Context Protocol, which Claude Code already speaks natively as an MCP *client*. If this works as documented, Claude Code could add Hermes as an MCP tool server directly (`claude mcp add` on the Claude Code side, need to verify exact syntax) and call into Hermes's conversation/tool surface as a first-class tool call, no pane-scraping involved.

**This is probably the architecturally cleaner path** if it actually works end to end — standard protocol both sides already speak, versus Herdr's imperative pane control which is more of a remote-control-a-terminal approach. Untested tonight — this is the first thing to actually verify, not assume.

### Also present, probably not the right fit but worth knowing about

`hermes acp` — Agent Client Protocol mode, built for editor integration (VS Code/Zed/JetBrains), not agent-to-agent. Mentioned for completeness; likely a dead end for this specific ask.

## Open design questions — for the discussion, not decided yet

1. **Does `hermes mcp serve` → Claude Code as MCP client actually work?** First thing to test empirically, same discipline as everything else tonight — don't trust the `--help` description, run it.
2. **What does "swap work" concretely mean?** A one-shot handoff (Claude Code finishes a subtask, hands the result to Hermes to continue) vs. a persistent shared queue vs. live bidirectional tool-calling. These have very different architectures.
3. **Which side initiates?** Does the operator drive both from Claude Code (Hermes as a tool it calls), both from Hermes (Claude Code as a tool it calls, maybe via Herdr's `agent prompt`), or is it meant to be symmetric?
4. **Does Claude Code expose anything Hermes could call back into**, or is the relationship necessarily one-directional (Hermes/Herdr can drive Claude Code via pane control + hooks; the reverse — Claude Code driving Hermes — would go through MCP if that path works)?
5. **State/context sharing**: does "swapped work" need to carry conversation context/memory across, or is it fire-and-forget task handoff? Hermes has its own persistent memory (`~/.hermes/memories/`); Claude Code has its own session model. Reconciling these is a real design question, not a plumbing detail.

## Ground rules carried over from tonight's session

- Verify against the actual installed binary/source, not documentation summaries — this whole project has a running list of corrections found exactly that way (see `VERIFY_FIRST.md`).
- Read scripts/config before running anything with real system effects.
- This all lives in `Natoshi-moto/Experimental-Sandbox` (`sandbox/experiment/hermes-prototype` branch, PR #3) — `status_authority: NONE`, nothing here can affect `Natoshi-moto/Lab`.
