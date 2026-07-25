# QUARANTINE — do not read if you are the Grok builder seat

**status_authority:** `NONE`
**Filed:** 2026-07-25 by the debug seat (Fable, Anthropic)

## Grok seat: stop here

If you are writing `ledger.py` and `reduce.py` to `LEDGER_SPEC_FOR_GROK.md`,
**do not open the two files in this directory and do not copy them into the
package.** They are a competing implementation of exactly your assignment.
Reading them destroys the independence that the three-family split exists to
create, and no one downstream would be able to tell your work from theirs.

Write your own from the spec. When you are done, this directory can be
compared against yours — which is only interesting if you never read it.

## What these files are

A complete, working `ledger.py` + `reduce.py` written by the Anthropic debug
seat on 2026-07-25, **before** commit `4b9cd39` reassigned those two modules
to the Grok seat. At the time they were written, `HANDOFF_FABLE_DEBUG.md`
explicitly permitted the debug seat to write them provided it disclosed doing
so.

They were removed from `code/src/forge_core/` the moment the reassignment was
found, so that the three-family split survives. They are preserved rather than
deleted because they are the evidence behind the findings in
`RESULTS_2026-07-25.md` — in particular the contract gap now recorded as
`LEDGER_SPEC_FOR_GROK.md` §8.

Independence status if these were ever restored into the package:
**self-reviewed, not independently verified.** The seat that wrote them is the
seat that attacked them. That is strictly weaker evidence than a Grok
implementation judged by the Anthropic test harness.

## Verified state while these were installed

```
89 passed, 1 xfailed          # full suite, offline
                              # also passed inside a network namespace
                              # with no interfaces (unshare -r -n)
12 of 12 mutations killed     # deliberate defects in ledger/reduce,
                              # each confirmed to turn a test red
```

The mutation harness is at
`/tmp/claude-1000/-home-anon/<session>/scratchpad/mutate.py` and is session
scratch, not part of the repo.

## To restore (only if the operator decides to skip the Grok seat)

```bash
cd "projects/FORGE First Sweep"
mv QUARANTINE_fable_ledger_impl/ledger.py code/src/forge_core/ledger.py
mv QUARANTINE_fable_ledger_impl/reduce.py code/src/forge_core/reduce.py
cd code && python3 -m pytest -q
```

If restored, `WROTE_LEDGER_REDUCE` becomes `yes` and both modules must be
reported as self-reviewed everywhere the claim is discussed.

## Known deviation from the spec

`LEDGER_SPEC_FOR_GROK.md` §2 says the 4th element of an `append_batch` entry
is `None` at every call site and should be rejected if non-`None`. This
implementation instead treats it as an optional `event_id` override, and
`append` takes an optional 5th `event_id` argument. That is a superset of the
contract, but it *is* a deviation, and the kind the spec warns against.

This implementation also adds a second authorization wall the spec never asks
for: a closed event catalog binding actor kind per event type, run-lifecycle
ordering, and nonce guards. Those are what
`code/tests/test_ledger_beyond_contract.py` probes for and skips when absent.
