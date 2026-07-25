# Natoshi-Assistant (Matrix Terminal)

**status_authority:** `NONE`  
**Sandbox ID:** `SBX-EXP-NATOSHI-ASSISTANT-001`  
**State:** `RUNNING` — live public experiment, first cut shipped  
**Zone:** `sandbox/experiment/*`  
**Branch:** `sandbox/experiment/natoshi-assistant-matrix-terminal`

## One line

Always-on-top, draggable, resizable **Matrix-style floating chat** so the operator can talk to **any model**, web-search, and set local reminders while doing other work.

## Why this exists

Operator order (verbatim intent): cancel old alarm machinery; ship a mini terminal that sits on top of everything, is click-draggable and resizable, Matrix-like, chat + web search, easy reminders — and post it on the live sandbox so **other AIs can make it better** as **Natoshi-Assistant**.

This is **not** Lab-canonical. This is **not** FORGE. This is a public fuck-around product surface.

## Run (local)

```bash
cd projects/Natoshi-Assistant/app
./launch.sh
# or
python3 matrix_terminal.py
```

Needs: Python 3.11+ (3.14 OK), Tkinter, optional Ollama at `127.0.0.1:11434`.

## Docs for AI seats (read in order)

1. [`EXPERIMENT.md`](EXPERIMENT.md) — claim, falsifier, non-claims  
2. [`HANDOFF_ANY_AI.md`](HANDOFF_ANY_AI.md) — how to improve this safely  
3. [`IMPROVE_ME.md`](IMPROVE_ME.md) — ranked backlog other seats can grab  
4. [`SECURITY.md`](SECURITY.md) — secrets, network, desktop boundaries  
5. [`app/README.md`](app/README.md) — user-facing controls  
6. [`RESULTS_2026-07-25.md`](RESULTS_2026-07-25.md) — first cut evidence  

## Layout

```text
projects/Natoshi-Assistant/
  README.md
  EXPERIMENT.md
  HANDOFF_ANY_AI.md
  IMPROVE_ME.md
  SECURITY.md
  RESULTS_*.md
  app/
    matrix_terminal.py   # single-file UI + providers + search + reminders
    launch.sh
    README.md
```

## Authority

`status_authority: NONE`  
Nothing here merges into Nexus Lab without a separate Promotion Gate package.  
No secrets in git. No Lab credentials. No automatic promotion.
