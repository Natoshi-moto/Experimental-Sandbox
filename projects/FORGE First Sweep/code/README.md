# FORGE Core — First Sweep

**status_authority:** `NONE`

This directory contains only the executable Phase 0 slice described by the
parent `CLAIM.md` and `SPEC_SLICE.md`: an event ledger, content-addressed
artifacts, deterministic reducers, a read broker, policy gates, a finite
workflow compiler, and a fake adapter.

It is not Core 0.1, FORGE 1.0, a daemon, a TUI, a real model adapter, or a
production security boundary.

## Run the suite

The test harness blocks Python socket connection and DNS entry points for every
test. No provider credentials or network services are used.

```bash
cd "projects/FORGE First Sweep/code"
python3 -m pytest -q
```

All runtime state is written below the data directory passed to `Forge`.
Tests use pytest temporary directories. Python bytecode and pytest's own cache
may be written inside this `code/` directory.

