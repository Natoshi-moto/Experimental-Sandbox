// SBX-EXP-001 adversarial probe harness — round 001.
//
// Run:  node experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/adversarial/PROBE_ROUND_001.mjs
//
// This is an AUDIT harness, not a test suite. It is deliberately NOT wired into
// scripts/verify.sh: a probe that starts passing is a signal to investigate, not
// a build failure. Each probe prints EXPLOITABLE / blocked(CODE) / THREW(Type).
// See reports/SECURITY_AUDIT_ROUND_001.md for the findings these produced.
import assert from "node:assert/strict";
import { createFixtureState, findPrincipalByAlias } from "../prototype/core/state.mjs";
import { createRuntime, applyEvent, currentRoot, snapshotRuntime } from "../prototype/core/reducer.mjs";
import { buildEvent, verifyNewEvent } from "../prototype/core/auth.mjs";
import { ProtocolError } from "../prototype/core/errors.mjs";

function fixture() {
  const state = createFixtureState({
    projectPoolAlias: "project-pool",
    principals: [
      { alias: "project-pool", balance: 100, scopes: ["*"] },
      { alias: "requester", balance: 1000, scopes: ["*"] },
      { alias: "worker", balance: 0, scopes: ["*"] },
      { alias: "clock", balance: 0, scopes: ["ADVANCE_TICK", "CLOCK_ADVANCER"] },
    ],
  });
  return createRuntime(state);
}
const out = [];
function probe(name, fn) {
  try { out.push(["EXPLOITABLE", name, fn()]); }
  catch (e) { out.push([e instanceof ProtocolError ? `blocked(${e.code})` : `THREW(${e.constructor.name})`, name, e.message.slice(0, 130)]); }
}

// P1 (corrected): the auth layer itself accepts an event forged by an adversary
// who holds only a public read-only snapshot and no key material.
probe("P1 verifyNewEvent accepts a forged event built from public state only", () => {
  const runtime = fixture();
  const snap = snapshotRuntime(runtime);           // read-only; contains no secrets
  const victim = findPrincipalByAlias(snap.state, "requester");
  const forged = buildEvent(snap.state, {
    eventType: "CANCEL_JOB",
    actorId: victim.principal_id,                   // adversary claims the victim
    payload: { job_id: "JOB-target" },
    nonce: "forged-1",
  });
  verifyNewEvent(snap.state, forged);               // full signature + authority check
  return `verifyNewEvent PASSED for actor ${victim.principal_id.slice(0, 20)}… with sig ${forged.auth.signature.slice(0, 16)}…`;
});

// P1c: forged event with real economic intent reaches the business layer.
probe("P1c forged CONTRIBUTE as victim clears every authority gate", () => {
  const runtime = fixture();
  const snap = snapshotRuntime(runtime);
  const victim = findPrincipalByAlias(snap.state, "requester");
  const forged = buildEvent(snap.state, {
    eventType: "CONTRIBUTE",
    actorId: victim.principal_id,
    payload: {
      job_id: "JOB-target", amount: 500, kind: "SPONSOR",
      sponsor_account_id: "ACCOUNT-x", disclosure_acknowledgement_root: "a".repeat(64),
      attribution: null, contribution_nonce: "c1",
    },
    nonce: "forged-contribute",
  });
  try { applyEvent(runtime, forged); }
  catch (e) {
    if (e.code === "ERR_AUTHORITY") throw e;
    return `passed authentication+authority as the victim; stopped only by business rule ${e.code}`;
  }
  return "applied";
});

// P2b (corrected): size ceiling cannot catch deep nesting.
probe("P2b deep payload stays under MAX_EVENT_PAYLOAD_BYTES", () => {
  const depth = 60000;
  const bytes = depth * 2 + Buffer.byteLength('{"job_id":}', "utf8");
  assert.ok(bytes <= 262144, `payload is ${bytes} bytes`);
  throw new ProtocolError("SIZE_OK", `depth ${depth} canonicalizes to ~${bytes} B, under the 262144 B ceiling — ERR_SIZE_LIMIT can never fire before the recursion does`);
});

// P4 (corrected): global idempotency namespace, squatted by any actor that can
// land any successful event.
probe("P4 cross-actor idempotency-key squatting", () => {
  const runtime = fixture();
  const s1 = snapshotRuntime(runtime);
  const clock = findPrincipalByAlias(s1.state, "clock");
  applyEvent(runtime, buildEvent(s1.state, {
    eventType: "ADVANCE_TICK", actorId: clock.principal_id, payload: {}, nonce: "settle-job-1",
  }));
  const s2 = snapshotRuntime(runtime);
  const victim = findPrincipalByAlias(s2.state, "requester");
  const legit = buildEvent(s2.state, {
    eventType: "CANCEL_JOB", actorId: victim.principal_id,
    payload: { job_id: "JOB-real" }, nonce: "settle-job-1",
  });
  try { applyEvent(runtime, legit); }
  catch (e) {
    if (e.code === "ERR_IDEMPOTENCY_CONFLICT") {
      return "an unrelated actor's key permanently blocks the victim's distinct event (ERR_IDEMPOTENCY_CONFLICT)";
    }
    throw e;
  }
  return "no conflict";
});

// P6: does a RangeError leave the runtime usable, or wedge it?
probe("P6 runtime survives a recursion abort with state intact", () => {
  const runtime = fixture();
  const before = currentRoot(runtime);
  let nested = []; for (let i = 0; i < 60000; i += 1) nested = [nested];
  const snap = snapshotRuntime(runtime);
  const victim = findPrincipalByAlias(snap.state, "requester");
  try {
    applyEvent(runtime, {
      schema: "nexus-event-v1", event_type: "CANCEL_JOB", actor_id: victim.principal_id,
      authority_root: "0".repeat(64), policy_root: snap.state.policy_root,
      expected_predecessor_root: before, tick: 0, nonce: "deep", idempotency_key: "deep",
      payload: { job_id: nested }, event_id: "EVT-" + "0".repeat(64),
      auth: { scheme: "SIM_AUTH_UNSAFE", key_id: "K", controller_id: "C",
        signed_domain: "NEXUS_EVENT_AUTH_V1", signed_payload_root: "0".repeat(64), signature: "0".repeat(64) },
    });
  } catch (e) {
    const after = currentRoot(runtime);
    throw new ProtocolError("FAIL_CLOSED", `${e.constructor.name} escaped as a non-ProtocolError, but state root is unchanged (${after === before}); reason taxonomy degrades to ERR_INTERNAL`);
  }
  return "applied";
});

for (const [v, n, note] of out) console.log(`${v.padEnd(26)} ${n}\n${" ".repeat(28)}${note}\n`);
