# GO finish report — OML max push

**Date:** 2026-07-25  
**Seat:** Grok  
**status_authority:** NONE  
**Lab touched:** no  

## What shipped

1. Python dual kernel (`dual/python/`) — matches fixture state_root  
2. Multi-process file-bus toy net (`scripts/toynet-bus.mjs`) + poison reject  
3. Adversarial max tests E08–E14  
4. Max `npm run verify` (4 gates)  
5. Drop payload rider + adversarial paste fixtures  
6. Packet helper, FABLE_MAX_PUSH + Desktop paste card  
7. PAPER §8b (money theater vs local proof)  
8. NEXUS-UX-Playground `OML.md` soft link  

## Public?

Local Experimental-Sandbox tree only until operator pushes branch.  
Not Lab. Not a release.

## Verify

```bash
cd ~/Projects/Experimental-Sandbox/experiments/SBX-EXP-ONE-MACHINE-LEDGER
npm run verify
```

## Failures

None on max verify at finish.

## Next (≤3)

1. Paste `PASTE_ME_TO_FABLE.txt` to Fable for cockpit polish / more adversarial fixtures  
2. Optional public push of `sandbox/experiment/one-machine-ledger`  
3. Optional third implementation (Rust) same anchors  

