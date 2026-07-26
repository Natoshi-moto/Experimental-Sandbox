# Nexus Sentinel and dual-kernel review v0.1

**status_authority:** `NONE`

## Verdict

Nexus Sentinel is load-bearing for the agent economy **as an authority
containment protocol**. It is not load-bearing as proof that a compromised
host, browser, provider, runner, or remote worker behaved.

The dual kernel strengthens proactive defense when creative/adversarial work is
kept outside deterministic settlement authority. It does not become “two
secure kernels” merely because two components have different names.

## What Sentinel contributes

### 1. Capabilities instead of ambient trust

An agent should receive a signed, narrow lease such as:

```json
{
  "audience": "worker-seat-7",
  "job_id": "JOB-...",
  "actions": ["READ_REDACTED_INPUT", "WRITE_CANDIDATE_OUTPUT"],
  "data_class": "REDACTED",
  "max_bytes": 1048576,
  "max_compute_units": 50,
  "not_before_tick": 120,
  "expires_at_tick": 180,
  "nonce": "...",
  "policy_root": "..."
}
```

It should not receive a generic API key, wallet, GitHub token, filesystem,
shell, or parent process environment.

### 2. Tunnels and audience binding

Every route should bind:

- caller and audience;
- message type and schema version;
- job, attempt, and contract version;
- permitted source and destination;
- sequence, nonce, expiry, and predecessor;
- byte and cost ceilings;
- data class and disclosure policy.

This directly addresses confused-deputy and cross-window routing failures.

### 3. Keyless workers

Signing belongs in a separate lane. A worker returns canonical bytes and a
request to sign; policy and human authority decide whether the signer acts.
This is essential for provider keys, GitHub write credentials, controller
rotation, recovery, and terminal settlement.

### 4. Receipts and fail-closed behavior

Missing, malformed, expired, replayed, wrongly addressed, over-budget, or
policy-mismatched actions reject with stable reason codes. A rejection is
receipted but has no state effect. Missing review is `HOLD`, not inferred
approval.

## Where Sentinel stops

A userland Sentinel cannot fully prove:

- its own code was the code that ran;
- the browser/OS/hypervisor/firmware was uncompromised;
- no alternate network, storage, IPC, covert, or side channel existed;
- a remote worker used the claimed model/hardware;
- the provider retained or deleted data;
- an allowed destination was benign;
- an attested image had no vulnerability;
- a human, operator, or provider did not intervene.

A compromised lower layer can forge UI, logs, clocks, process lists, network
views, and Sentinel reports. Stronger boundaries relocate trust; they do not
remove it.

## Sentinel and the agent economy

Sentinel should mediate:

- job creation and immutable contract freeze;
- bid commit/reveal and revocation;
- contract acceptance;
- agent allowance reservation/spend/revocation;
- worker input/output routes;
- review assignment and clearance;
- GitHub witness publication;
- signer and recovery requests.

Sentinel must not:

- rank semantic truth;
- mint, burn, debit, credit, settle, or recover by itself;
- decide a winning bid through hidden AI judgment;
- treat payment, stake, reputation, popularity, or model confidence as proof;
- release proprietary data because a worker claims a trusted model;
- clear a deterministic red;
- become a covert all-seeing surveillance service.

## Does “offense as the best defense” help?

The useful version is **adversarial anticipation**:

```text
breaker agents propose hostile inputs
        │
        ▼
private/agent kernel mutates candidates and schedules probes
        │ typed candidate events only
        ▼
router validates capability and shape
        │
        ▼
deterministic kernel accepts or rejects by frozen rules
```

Benefits:

- frontier models can invent race and abuse cases;
- smaller models can cheaply inspect every bounded packet;
- fuzzers can explore far more schedules than humans;
- canaries and honeypots can expose unexpected access;
- a compromised breaker still cannot settle if capabilities hold.

Limits:

- all breakers sharing one host/provider can share one blind spot;
- an attacker who compromises router or deterministic verifier may bypass the
  separation;
- aggressive probing can itself leak data or exhaust resources;
- “defense” never authorizes attacking, persisting on, or retaliating against
  third-party systems.

## Required implementation tests

1. Wrong audience, caller, job, action, data class, nonce, sequence, expiry,
   policy root, or predecessor rejects without mutation.
2. Worker environment contains no signer/provider/GitHub secret.
3. Capability revocation prevents future actions but cannot rewrite an already
   committed transition.
4. Allowance spend and revocation are tested in both serial orders.
5. Router cannot emit a ledger mutation that the Nexus Sim kernel accepts
   without a valid event and authority proof.
6. Breaker output is always a candidate; never direct authority.
7. Host-compromise and remote-deletion claims remain visibly `UNPROVEN`.

## Final assessment

**Why load-bearing:** Sentinel gives the system a precise vocabulary and
mechanism for least authority across agents, iframes, tools, providers, and
signers.

**Why insufficient alone:** its enforcement inherits the integrity of the
browser, process, kernel, policy source, signer, and hardware beneath it.

The correct design is Sentinel inside a layered compartment model, with Nexus
Sim below it as deterministic state authority and an independent recovery
bundle outside the routine path.
