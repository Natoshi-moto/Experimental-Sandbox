# Hermes Prototype — white paper

**status_authority:** `NONE`
**State:** `PROPOSAL_ONLY` — nothing described here has been installed or run.
**Read `VERIFY_FIRST.md` before this document. Read this document before `SPEC.md`.**

## 1. Origin and provenance

This project starts from a pasted transcript the operator brought from a separate AI chat session, describing "Hermes CLI" (Nous Research's Hermes Agent) and a list of MIT-licensed terminal/orchestration tooling to "yoink" ideas from. That transcript was treated as a lead, not a source of truth, per this session's established practice of holding external AI output at arm's length and re-verifying it independently (see `Experimental-Sandbox/board/thoughts/2026-07-23-adversarial-adviser-handoff-corrections.md` for the same discipline applied to an earlier handoff).

Independent verification during this session's research round found the transcript's claims were mostly directionally correct but contained concrete factual errors — most notably a wrong license for Herdr, stated as MIT in the transcript, AGPL-3.0 in this session's own follow-up search, and Apache-2.0 by direct GitHub API query (the only one of the three actually checked against ground truth). See `VERIFY_FIRST.md` for the full list of corrections and the load-bearing facts still unverified.

## 2. Problem statement

The operator runs multiple "vanilla" terminal-native AI coding agents day to day — Claude Code (this agent), Codex, and an xAI terminal agent (exact identity unresolved, see `VERIFY_FIRST.md` #9) — alongside API access to DeepSeek and locally-run models via Ollama. There is currently no single operator layer that:

- persists memory and learned skills across sessions with any of these tools,
- schedules recurring or delegated work without a human re-issuing the same prompt,
- routes reasoning tasks to whichever backend (DeepSeek API, local model) is cheapest or most appropriate for the task, independent of which terminal tool is doing the actual file-editing work.

## 3. Proposed system, in one paragraph

**Hermes Agent** (`NousResearch/hermes-agent`, MIT, confirmed real) becomes the persistent "operator" layer: it holds memory, skills, and scheduled/cron work, and its own reasoning runs against **DeepSeek's API** (`https://api.deepseek.com/v1`) and **locally-run Ollama models**, configured as its main model and auxiliary (per-task) providers respectively — no Anthropic, no OpenAI account, no OpenRouter, per the operator's explicit choice. **Herdr** (`ogulcancelik/herdr`, Apache-2.0, not MIT — see correction in `VERIFY_FIRST.md`) sits alongside as the terminal multiplexer: it natively detects and displays Hermes itself plus the vanilla terminal agents (Claude Code, Codex, the xAI agent) each in its own real PTY pane with live status, giving the operator one control room over all of them without Hermes needing to natively pilot those other CLIs itself.

This is deliberately a thin composition of two existing, independently-maintained open-source projects, not a new framework. Nothing here proposes writing a new orchestration engine.

## 4. Why not the other tools the original transcript listed

The transcript's broader list (Zellij, Bubble Tea, Ratatui, Temporal, Cronicle, BullMQ, pydoit, redis-work-queue, Typer, OpenCastle, SkillClaw, Sandcastle, tokio-prompt-orchestrator, interactive-terminal-mcp) was independently checked; most exist and are correctly licensed MIT (Zellij, Bubble Tea, Ratatui, Temporal, BullMQ, pydoit, redis-work-queue, Typer, OpenCastle, SkillClaw all confirmed MIT via GitHub API). None of them are included in this prototype's actual dependency list, because Hermes Agent and Herdr already cover the operator's stated need (persistent multi-provider orchestration + multi-terminal visibility) without adding them. They remain worth reading as pattern references — SkillClaw's collective skill-evolution design and OpenCastle's specialist-agent decomposition are both genuinely relevant prior art if Hermes's own skill system turns out to be insufficient in practice — but "worth reading" and "worth depending on" are different claims, and this document only makes the second claim about Hermes Agent and Herdr.

Sandcastle and the specific Cronicle repo path cited in the original transcript both 404'd on lookup and are not included pending a real re-search (`VERIFY_FIRST.md`, corrections table).

## 5. Claim

**One falsifiable sentence:** Hermes Agent, configured with DeepSeek as its main model and local Ollama models as auxiliary/task-specific providers, can run as a standalone persistent operator process on this machine, and Herdr can multiplex it alongside at least one vanilla terminal agent (Claude Code) in a single terminal session with correct live status detection for both.

## 6. Falsifier

Any of the following kills the claim as stated:
- Hermes Agent fails to start, or fails `hermes doctor`/equivalent health check, after following the installer and `SPEC.md`'s configuration steps exactly.
- Hermes cannot be configured to use DeepSeek as its main model and a local Ollama model as an auxiliary provider simultaneously (i.e., the config schema doesn't actually support two distinct custom endpoints at once, contradicting what the docs currently say).
- Herdr fails to detect a running Hermes Agent process and/or a running Claude Code session as distinct, correctly-labeled panes with accurate status (blocked/working/done/idle).

## 7. Non-claims

- This does not claim Hermes Agent is production-ready, secure by default, or suitable for anything beyond a local single-operator prototype.
- This does not claim the 219,434 star count, or any other popularity metric quoted in `VERIFY_FIRST.md`, has been independently corroborated beyond a single API query at a single point in time.
- This does not claim Herdr, SkillClaw, or OpenCastle's own documentation/marketing claims (e.g. specific accuracy percentages, "19 coordinated specialist agents") have been verified — those numbers are quoted from the projects' own materials via search, not independently reproduced.
- This does not claim any legal review of Apache-2.0/BSD-2-Clause obligations (attribution, NOTICE files, patent grant terms) has been performed — only that the license identifiers themselves were checked against the GitHub API.
- This does not authorize installation. Installation is a separate, explicit next step gated on `VERIFY_FIRST.md` item 2 (reading the install script in full) and operator go-ahead.

## 8. Adversarial review — open invitation

This document, `SPEC.md`, and `VERIFY_FIRST.md` are written to be attacked, per this sandbox's charter. Specifically worth attacking:
- Whether "thin composition of two existing tools" undersells real integration risk (e.g., does Herdr's process-detection heuristic actually work reliably for a long-running Hermes daemon, versus the short-lived CLI invocations it was probably designed around?).
- Whether DeepSeek-only + local-only is actually sufficient for whatever the operator's real workload turns out to be, once tried.
- Every item in `VERIFY_FIRST.md` that hasn't yet been independently re-checked by a reader other than the AI that wrote it.
