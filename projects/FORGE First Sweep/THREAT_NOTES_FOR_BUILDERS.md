# Threat notes (builders) — Phase 0

**status_authority:** `NONE`  
Claude should expand this into `code/THREAT_MODEL.md` during the sweep. This is the minimum stance.

## In scope for Phase 0 defenses

- Confused deputy: model text treated as authority  
- Silent canon promotion  
- Mutable “history” (UPDATE/DELETE events; rewriting blobs)  
- Capability bypass via internal helpers exposed publicly  
- Projection drift (UI/API showing non-event state as truth)  

## Out of scope (do not claim)

- OS sandbox escape by a real third-party CLI  
- Attacker with full disk + root  
- Network attacker MITM on future providers  
- Multi-user hostility on one machine  
- Prompt injection against a real Meta-Executive (no real ME yet)  

## Abuse cases tests must cover

1. Model proposes “set canon to X” via any API → deny.  
2. Model grants self `cap.canon.write` → deny.  
3. Human decision nonce replay → deny.  
4. Blob file overwritten on disk → detect or fail verify.  
5. Event row corrupted → fail chain verify.
