import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

import { canonicalize } from "../core/canonical.mjs";
import {
  capabilityOfferContentRoot,
  capabilityOfferTermsRoot,
  derivedCarrierId,
  donatedCapacityConsentBodyRoot,
  donatedCapacityConsentRecordRoot,
  recoverRuntime,
  snapshotRuntime,
} from "../core/reducer.mjs";
import { createAcceptedRecordResolver } from "../core/resolver.mjs";
import {
  createDonatedCapacityFixture,
  createPostAssignmentReviewFixture,
  createPostReviewFixture,
  createPreAssignmentReviewFixture,
  createReplacementReviewFixture,
  createRevokedOfferFixture,
} from "./core-economy.mjs";
import {
  bidRevealHash,
  rankEligibleBids,
  selectWinningBid,
} from "../work/broker.mjs";
import {
  capabilityOfferBindingRoot,
  capabilityOfferRoot,
  capabilityProbeRoot,
  donatedCapacityConsentRoot,
  evaluateOfferEligibility,
} from "../work/prober.mjs";
import { scheduleReadyTasks, taskOrderKey } from "../work/scheduler.mjs";
import {
  buildDiversityVector,
  checkResultId,
  computeDeterministicEvidenceRoot,
  computeThreeReviewOutcome,
  diversityLabels,
  requiredCheckManifestRoot,
  requiredDiversityReasonCodes,
  reviewFindingsVetoClearance,
  reviewPacketRoot,
} from "../review/clearance.mjs";
import {
  evaluateReviewerEligibility,
  modelReviewHash,
  modelReviewId,
  selectReviewAssignments,
  selectReviewReplacement,
  validateReviewPacketBinding,
} from "../review/reviews.mjs";

const TESTS = [];
const FIXTURES = new Map();

function test(name, body) {
  TESTS.push({ name, body });
}

function cachedFixture(name, factory) {
  if (!FIXTURES.has(name)) FIXTURES.set(name, factory());
  return FIXTURES.get(name);
}

function acceptedRef(recordType, recordId, recordRoot) {
  return Object.freeze({
    record_type: recordType,
    record_id: recordId,
    record_root: recordRoot,
  });
}

function exactRef(reference) {
  return acceptedRef(
    reference.record_type,
    reference.record_id,
    reference.record_root,
  );
}

function fixtureView(raw, runtime = raw.context.runtime) {
  const snapshot = snapshotRuntime(runtime);
  const state = snapshot.state;
  const resolver = createAcceptedRecordResolver(runtime);
  const job = state.jobs[raw.jobId];
  const packet = job.review_packet;
  const packetRoot = reviewPacketRoot(packet);
  const packetRef = acceptedRef("REVIEW_PACKET", packetRoot, packetRoot);
  const jobRef = acceptedRef("JOB", job.job_id, job.record_root);
  const contractRef = acceptedRef(
    "JOB_CONTRACT",
    `CONTRACT-${job.accepted_contract_root}`,
    job.accepted_contract_root,
  );
  const conflictPolicyRef = acceptedRef(
    "CONFLICT_POLICY",
    `CONFLICT-${job.accepted_contract.conflict_policy_root}`,
    job.accepted_contract.conflict_policy_root,
  );
  const eligibilities = Object.values(state.reviewer_eligibilities)
    .filter((record) => record.facts.packet_root === packetRoot)
    .sort((left, right) =>
      left.facts.reviewer_seat_id.localeCompare(
        right.facts.reviewer_seat_id,
      ),
    );
  const candidates = eligibilities.map((record) => {
    const offer = state.capability_offers[record.facts.capability_offer_id];
    return Object.freeze({
      capability_offer_ref: acceptedRef(
        "CAPABILITY_OFFER",
        offer.offer_id,
        capabilityOfferRoot(offer),
      ),
      reviewer_eligibility_ref: acceptedRef(
        "REVIEWER_ELIGIBILITY",
        record.eligibility_id,
        record.eligibility_root,
      ),
    });
  });
  const assignments = Object.values(state.review_assignments)
    .filter((record) => record.packet_root === packetRoot)
    .sort(
      (left, right) =>
        left.slot - right.slot ||
        left.attempt - right.attempt ||
        left.review_assignment_id.localeCompare(
          right.review_assignment_id,
        ),
    );
  const reviews = Object.values(state.reviews)
    .filter((record) => record.packet_root === packetRoot)
    .sort((left, right) =>
      left.review_assignment_id.localeCompare(
        right.review_assignment_id,
      ),
    );
  const reviewerOffers = eligibilities.map(
    (record) =>
      state.capability_offers[record.facts.capability_offer_id],
  );
  return {
    raw,
    runtime,
    resolver,
    snapshot,
    state,
    job,
    packet,
    packetRoot,
    packetRef,
    jobRef,
    contractRef,
    conflictPolicyRef,
    eligibilities,
    candidates,
    assignments,
    reviews,
    reviewerOffers,
    reviewRefs: reviews.map((review) =>
      acceptedRef(
        "MODEL_REVIEW",
        review.review_id,
        modelReviewHash(review),
      ),
    ),
  };
}

function preAssignmentView() {
  return fixtureView(
    cachedFixture("pre-assignment", createPreAssignmentReviewFixture),
  );
}

function postAssignmentView() {
  return fixtureView(
    cachedFixture("post-assignment", createPostAssignmentReviewFixture),
  );
}

function postReviewView() {
  return fixtureView(
    cachedFixture("post-review", createPostReviewFixture),
  );
}

function donatedFixture() {
  const fixture = cachedFixture("donated", createDonatedCapacityFixture);
  return {
    ...fixture,
    donatedOffer: fixture.resolver.resolveAcceptedRecord(
      fixture.capabilityOfferRef,
    ).record,
    acceptedConsent: fixture.resolver.resolveAcceptedRecord(
      fixture.donatedCapacityConsentRef,
    ).record,
  };
}

function replacementFixture() {
  const fixture = cachedFixture(
    "replacement",
    createReplacementReviewFixture,
  );
  return {
    ...fixture,
    expired: fixture.resolver.resolveAcceptedRecord(
      exactRef(fixture.expired_assignment_ref),
    ).record,
    replacement: fixture.resolver.resolveAcceptedRecord(
      exactRef(fixture.replacement_assignment_ref),
    ).record,
  };
}

function selectionInput(view, overrides = {}) {
  const evaluatedTick = view.eligibilities[0].facts.evaluated_tick;
  return {
    resolver: view.resolver,
    jobRef: view.jobRef,
    packetRef: view.packetRef,
    jobAttempt: view.job.attempt,
    candidates: view.candidates,
    amount: 10,
    notBeforeTick: evaluatedTick,
    expiryTick: Math.min(
      view.packet.expiry_tick,
      ...view.eligibilities.map((entry) => entry.facts.expiry_tick),
    ),
    ...overrides,
  };
}

function candidateInput(view, index = 0, overrides = {}) {
  return {
    resolver: view.resolver,
    candidate: view.candidates[index],
    jobRef: view.jobRef,
    packetRef: view.packetRef,
    ...overrides,
  };
}

function evidenceInput(view, checks = view.job.deterministic_evidence_manifest.checks) {
  const manifest = view.job.required_check_manifest;
  const firstCheck = checks[0] ??
    view.job.deterministic_evidence_manifest.checks[0];
  return {
    jobId: view.job.job_id,
    contractRoot: view.packet.contract_root,
    artifactRoot: view.packet.artifact_root,
    manifestRoot: view.packet.manifest_root,
    verifierRoot: manifest.verifier_root,
    policyRoot: view.packet.policy_root,
    environmentRoot: manifest.environment_root,
    requiredCheckManifest: manifest,
    expectedRequiredCheckManifestRoot:
      requiredCheckManifestRoot(manifest),
    verifierAuthorityRoot: firstCheck.verifier_authority_root,
    executionReceiptAnchorRoot:
      firstCheck.execution_receipt_anchor_root,
    checks,
  };
}

function outcomeInput(view, overrides = {}) {
  return {
    resolver: view.resolver,
    jobRef: view.jobRef,
    packetRef: view.packetRef,
    reviewRefs: view.reviewRefs,
    deterministicChecks:
      view.job.deterministic_evidence_manifest.checks,
    deterministicEvidenceRoot:
      view.packet.deterministic_evidence_root,
    requiredCheckManifest: view.job.required_check_manifest,
    ...overrides,
  };
}

function donatedEligibilityInput(fixture, overrides = {}) {
  const snapshot = snapshotRuntime(fixture.context.runtime);
  const job = snapshot.state.jobs[fixture.jobId];
  const task = snapshot.state.tasks[
    fixture.eligibility_input.task.task_id
  ];
  return {
    resolver: fixture.resolver,
    evaluationKind: "TASK",
    capabilityOfferRef: fixture.capabilityOfferRef,
    donatedCapacityConsentRef:
      fixture.donatedCapacityConsentRef,
    jobRef: acceptedRef("JOB", job.job_id, job.record_root),
    jobContractRef: acceptedRef(
      "JOB_CONTRACT",
      `CONTRACT-${job.accepted_contract_root}`,
      job.accepted_contract_root,
    ),
    conflictPolicyRef: acceptedRef(
      "CONFLICT_POLICY",
      `CONFLICT-${job.accepted_contract.conflict_policy_root}`,
      job.accepted_contract.conflict_policy_root,
    ),
    taskRef: acceptedRef("TASK", task.task_id, task.record_root),
    bidRef: null,
    probe: fixture.probe,
    ...overrides,
  };
}

function reviewBody(view = postReviewView(), index = 0) {
  const body = { ...view.reviews[index] };
  delete body.review_id;
  return body;
}

function finding({
  id = "finding-1",
  severity = "LOW",
  material = false,
  resolved = true,
  evidenceRefIds = [],
} = {}) {
  return {
    schema: "nexus-review-finding-v1",
    finding_id: id,
    severity,
    material,
    resolved,
    description: `${severity} finding ${id}`,
    evidence_ref_ids: evidenceRefIds,
  };
}

function recoverBeforeEvent(raw, eventType) {
  const eventIndex = raw.context.events.findIndex(
    (event) => event.event_type === eventType,
  );
  assert(eventIndex > 0, `missing ${eventType} event`);
  const terminalSnapshot = snapshotRuntime(raw.context.runtime);
  const events = raw.context.events.slice(0, eventIndex);
  const receipts = terminalSnapshot.receipts.slice(0, eventIndex);
  return recoverRuntime({
    genesisState: raw.context.genesisState,
    events,
    receipts,
    expectedFinalRoot: receipts.at(-1).next_state_root,
  });
}

function makeTask(taskId, overrides = {}) {
  return {
    task_id: taskId,
    job_id: "JOB-test",
    attempt: 1,
    kind: "IMPLEMENT",
    phase_rank: 1,
    priority: 1,
    dependencies: [],
    context_root: "context-root",
    input_manifest_root: "input-root",
    output_schema_root: "output-root",
    data_class: "PUBLIC",
    required_capabilities: ["CODE"],
    earliest_tick: 0,
    deadline_tick: 20,
    max_compute_units: 10,
    max_input_bytes: 100,
    max_output_bytes: 100,
    concurrency_group: "implementation",
    conflict_set: [],
    review_requirement: "DETERMINISTIC",
    terminal_behavior: "HOLD",
    status: "WAITING",
    ...overrides,
  };
}

function revealFixture(overrides = {}) {
  const reveal = preAssignmentView().raw.reveal;
  return { ...reveal, ...overrides };
}

// Scheduler and broker determinism.
test("scheduler readiness ignores insertion order", () => {
  const firstTask = makeTask("TASK-a");
  const secondTask = makeTask("TASK-b");
  const job = { job_id: "JOB-test", state: "ACTIVE" };
  const contexts = [secondTask, firstTask].map((task) => ({
    task,
    job,
    tick: 5,
    tasksById: [firstTask, secondTask],
    activeLeases: [],
    eligibleWorkerSeatIds: ["SEAT-worker"],
    maxAttempts: 3,
    remainingComputeUnits: 100,
    routeSupported: true,
  }));
  const forward = scheduleReadyTasks(contexts);
  const reverse = scheduleReadyTasks([...contexts].reverse());
  assert.deepEqual(forward.ready, reverse.ready);
  assert.deepEqual(
    forward.ready.map((entry) => entry.task_id),
    ["TASK-a", "TASK-b"],
  );
});

test("scheduler blocks unsatisfied dependencies", () => {
  const dependency = makeTask("TASK-a", { status: "RUNNING" });
  const dependent = makeTask("TASK-b", { dependencies: ["TASK-a"] });
  const result = scheduleReadyTasks([{
    task: dependent,
    job: { job_id: "JOB-test", state: "ACTIVE" },
    tick: 5,
    tasksById: [dependency, dependent],
    activeLeases: [],
    eligibleWorkerSeatIds: ["SEAT-worker"],
    maxAttempts: 3,
    remainingComputeUnits: 100,
    routeSupported: true,
  }]);
  assert.equal(result.ready.length, 0);
});

test("task ordering key is exact", () => {
  assert.deepEqual(taskOrderKey(makeTask("TASK-a")), [
    1,
    1,
    20,
    10,
    "TASK-a",
    1,
  ]);
});

test("bid reveal presentation aliases do not affect the hash", () => {
  const reveal = revealFixture({ display_alias: "first" });
  assert.equal(
    bidRevealHash(reveal),
    bidRevealHash({ ...reveal, display_alias: "renamed" }),
  );
});

test("bid ranking excludes ineligible entries", () => {
  const reveal = revealFixture();
  const ranked = rankEligibleBids([
    { reveal, eligibility: { eligible: false, reason_codes: ["NO"] } },
    { reveal: { ...reveal, nonce: "other" }, eligibility: { eligible: true, reason_codes: [] } },
  ]);
  assert.equal(ranked.eligible.length, 1);
  assert.equal(ranked.rejected.length, 1);
});

test("winning-bid selection is deterministic", () => {
  const reveal = revealFixture();
  const entries = [
    { reveal: { ...reveal, worker_seat_id: "SEAT-b", nonce: "b" }, eligibility: { eligible: true, reason_codes: [] } },
    { reveal: { ...reveal, worker_seat_id: "SEAT-a", nonce: "a" }, eligibility: { eligible: true, reason_codes: [] } },
  ];
  assert.equal(selectWinningBid(entries).reveal.worker_seat_id, "SEAT-a");
});

// Deterministic evidence and packet construction.
test("required-check manifest root matches accepted core state", () => {
  const view = postReviewView();
  assert.equal(
    requiredCheckManifestRoot(view.job.required_check_manifest),
    view.packet.required_check_manifest_root,
  );
});

test("deterministic evidence root matches accepted core state", () => {
  const view = postReviewView();
  assert.equal(
    computeDeterministicEvidenceRoot(evidenceInput(view)),
    view.packet.deterministic_evidence_root,
  );
});

test("deterministic evidence rejects reversed checks", () => {
  const view = postReviewView();
  const checks = [...view.job.deterministic_evidence_manifest.checks].reverse();
  assert.throws(() => computeDeterministicEvidenceRoot(evidenceInput(view, checks)));
});

test("deterministic evidence rejects duplicate checks", () => {
  const view = postReviewView();
  const check = view.job.deterministic_evidence_manifest.checks[0];
  assert.throws(() =>
    computeDeterministicEvidenceRoot(evidenceInput(view, [check, check])),
  );
});

test("a nonzero PASS check is rejected", () => {
  const check = {
    ...postReviewView().job.deterministic_evidence_manifest.checks[0],
    exit_code: 1,
  };
  assert.throws(
    () => checkResultId(check),
    (error) => error?.code === "ERR_DETERMINISTIC_RED",
  );
});

test("required-check manifest rejects extensions", () => {
  const manifest = postReviewView().job.required_check_manifest;
  assert.throws(() => requiredCheckManifestRoot({ ...manifest, extension: true }));
});

test("review packet root matches accepted packet identity", () => {
  const view = postReviewView();
  assert.equal(reviewPacketRoot(view.packet), view.packetRoot);
});

test("review packet root changes with deterministic evidence", () => {
  const view = postReviewView();
  assert.notEqual(
    reviewPacketRoot({
      ...view.packet,
      deterministic_evidence_root: "different-evidence-root",
    }),
    view.packetRoot,
  );
});

test("accepted packet V2 binds review count, diversity, and conflicts", () => {
  const view = postReviewView();
  assert.equal(view.packet.schema, "nexus-review-packet-v2");
  assert.equal(view.packet.required_review_count, 3);
  assert.deepEqual(
    view.packet.required_diversity_dimensions,
    [...view.packet.required_diversity_dimensions].sort(),
  );
  assert.equal(
    view.packet.conflict_policy_root,
    view.job.accepted_contract.conflict_policy_root,
  );
  assert.throws(
    () => reviewPacketRoot({
      ...view.packet,
      schema: "nexus-review-packet-v1",
    }),
    (error) => error?.code === "ERR_SCHEMA",
  );
});

// Review preimage and nested finding semantics.
test("accepted review ID and hash are locally reproducible", () => {
  const review = postReviewView().reviews[0];
  assert.equal(modelReviewId(review), review.review_id);
  assert.match(modelReviewHash(review), /^[0-9a-f]{64}$/);
});

test("malformed nested finding material type is rejected", () => {
  const body = reviewBody();
  assert.throws(
    () => modelReviewId({
      ...body,
      severity: "LOW",
      findings: [finding({ material: "yes" })],
    }),
    (error) => error?.code === "ERR_SCHEMA",
  );
});

test("HIGH findings must be material", () => {
  const body = reviewBody();
  assert.throws(
    () => modelReviewId({
      ...body,
      severity: "HIGH",
      findings: [finding({ severity: "HIGH", material: false })],
    }),
    (error) => error?.code === "ERR_SCHEMA",
  );
});

test("top-level severity must equal maximum finding severity", () => {
  const body = reviewBody();
  assert.throws(
    () => modelReviewId({
      ...body,
      severity: "NONE",
      findings: [finding({ severity: "LOW" })],
    }),
    (error) => error?.code === "ERR_SCHEMA",
  );
});

test("maximum finding severity is accepted when exact", () => {
  const body = reviewBody();
  assert.match(
    modelReviewId({
      ...body,
      severity: "HIGH",
      findings: [
        finding({ id: "finding-a", severity: "LOW" }),
        finding({ id: "finding-b", severity: "HIGH", material: true }),
      ],
    }),
    /^REVIEW-[0-9a-f]{64}$/,
  );
});

test("unordered evidence references are rejected", () => {
  const body = reviewBody();
  const refs = [
    { schema: "nexus-review-evidence-ref-v1", evidence_ref_id: "a", evidence_root: "root-a", locator: "a" },
    { schema: "nexus-review-evidence-ref-v1", evidence_ref_id: "b", evidence_root: "root-b", locator: "b" },
  ];
  assert.throws(
    () => modelReviewId({ ...body, evidence_refs: [...refs].reverse() }),
    (error) => error?.code === "ERR_NON_CANONICAL",
  );
});

test("unresolved material findings veto clearance", () => {
  const body = reviewBody();
  assert.equal(
    reviewFindingsVetoClearance({
      ...body,
      severity: "LOW",
      findings: [finding({ material: true, resolved: false })],
    }),
    true,
  );
});

test("unresolved HIGH findings veto clearance", () => {
  const body = reviewBody();
  assert.equal(
    reviewFindingsVetoClearance({
      ...body,
      severity: "HIGH",
      findings: [finding({ severity: "HIGH", material: true, resolved: false })],
    }),
    true,
  );
});

test("resolved material findings do not veto clearance", () => {
  const body = reviewBody();
  assert.equal(
    reviewFindingsVetoClearance({
      ...body,
      severity: "LOW",
      findings: [finding({ material: true, resolved: true })],
    }),
    false,
  );
});

// Canonical reviewer selection and complete assignment histories.
test("accepted reviewer eligibility is state-bound and eligible", () => {
  const view = postAssignmentView();
  const envelope = view.resolver.resolveAcceptedRecord(
    view.candidates[0].reviewer_eligibility_ref,
  );
  assert.equal(envelope.record.status, "ACCEPTED");
  assert.equal(envelope.record.facts.offer_auth_valid, true);
  assert.match(
    envelope.record.facts.capability_offer_id,
    /^OFFER-[0-9a-f]{64}$/,
  );
  assert.match(
    envelope.record.facts.capability_offer_root,
    /^[0-9a-f]{64}$/,
  );
  assert.equal(
    envelope.record.facts.evaluated_tick,
    view.snapshot.state.tick,
  );
  assert.equal(envelope.record.facts.conflict_free, true);
  assert.equal(
    envelope.record.facts.conflict_policy_root,
    view.packet.conflict_policy_root,
  );
});

test("assignment atomically binds current-tick accepted eligibility", () => {
  const view = postAssignmentView();
  for (const assignment of view.assignments) {
    const eligibility =
      view.state.reviewer_eligibilities[assignment.eligibility_id];
    assert.equal(
      eligibility.facts.evaluated_tick,
      view.snapshot.state.tick,
    );
    assert.equal(
      eligibility.facts.evaluated_tick,
      assignment.not_before_tick,
    );
    assert.equal(eligibility.eligibility_root, assignment.eligibility_root);
  }
});

test("review selection is deterministic and returns exact core inputs", () => {
  const before = preAssignmentView();
  const after = postAssignmentView();
  const acceptedPlans = after.assignments.map((assignment) => ({
    reviewer_principal_id: assignment.reviewer_principal_id,
    reviewer_seat_id: assignment.reviewer_seat_id,
    model_id: assignment.model_id,
    capability_offer_id: assignment.capability_offer_id,
    capability_offer_root: assignment.capability_offer_root,
    expiry_tick: assignment.expiry_tick,
  }));
  assert.deepEqual(
    acceptedPlans,
    before.raw.assignments,
  );
  assert.equal(acceptedPlans.length, 3);
  assert.deepEqual(Object.keys(acceptedPlans[0]), [
    "reviewer_principal_id",
    "reviewer_seat_id",
    "model_id",
    "capability_offer_id",
    "capability_offer_root",
    "expiry_tick",
  ]);
});

test("pre-assignment snapshots expose no unaccepted eligibility refs", () => {
  const view = preAssignmentView();
  assert.deepEqual(view.eligibilities, []);
  assert.deepEqual(view.candidates, []);
});

test("accepted slot history blocks a second initial assignment", () => {
  const view = postAssignmentView();
  assert.throws(
    () => selectReviewAssignments(selectionInput(view)),
    (error) => error?.code === "ERR_REVIEW_ASSIGNMENT",
  );
});

test("existing canonical assignments affect candidate eligibility without refs", () => {
  const view = postAssignmentView();
  const result = evaluateReviewerEligibility(candidateInput(view));
  assert.equal(result.eligible, false);
  assert(result.reason_codes.includes("ERR_REVIEW_ASSIGNMENT"));
  assert.equal(result.accepted_logical_tick, view.snapshot.state.tick);
});

test("crossed accepted offer and eligibility references fail closed", () => {
  const view = postAssignmentView();
  const crossed = {
    capability_offer_ref: view.candidates[1].capability_offer_ref,
    reviewer_eligibility_ref:
      view.candidates[0].reviewer_eligibility_ref,
  };
  const result = evaluateReviewerEligibility({
    ...candidateInput(view),
    candidate: crossed,
  });
  assert.equal(result.eligible, false);
  assert(result.reason_codes.includes("ERR_CAPABILITY"));
});

test("foreign eligibility references cannot cross application states", () => {
  const local = postAssignmentView();
  const replacement = replacementFixture();
  const foreignView = fixtureView(replacement);
  const result = evaluateReviewerEligibility({
    ...candidateInput(local),
    candidate: foreignView.candidates.at(-1),
  });
  assert.equal(result.eligible, false);
  assert(result.reason_codes.length > 0);
});

test("duck-typed resolvers are rejected", () => {
  const view = postAssignmentView();
  assert.throws(
    () => evaluateReviewerEligibility({
      ...candidateInput(view),
      resolver: {
        resolveAcceptedRecord() {},
        resolveAcceptedRecordSet() {},
      },
    }),
    (error) => error?.code === "ERR_AUTHORITY",
  );
});

test("assignment set envelopes are branded, exact, and complete", () => {
  const view = postAssignmentView();
  const envelope = view.resolver.resolveAcceptedRecordSet({
    record_type: "REVIEW_ASSIGNMENT",
    scope: {
      assignment_slot: 0,
      job_id: view.job.job_id,
      review_packet_root: view.packetRoot,
    },
  });
  assert.equal(envelope.schema, "nexus-accepted-record-set-envelope-v2");
  assert.equal(envelope.accepted_logical_tick, view.snapshot.state.tick);
  assert.equal(envelope.records.length, 1);
  assert(Object.isFrozen(envelope));
});

test("legacy review ticks and policy overrides are rejected", () => {
  const view = postAssignmentView();
  assert.throws(
    () => evaluateReviewerEligibility({
      ...candidateInput(view),
      tick: view.snapshot.state.tick,
    }),
    (error) => error?.code === "ERR_SCHEMA",
  );
  assert.throws(
    () => selectReviewAssignments({
      ...selectionInput(view),
      conflictPrincipalIds: [],
    }),
    (error) => error?.code === "ERR_SCHEMA",
  );
});

// Replacement history and exact predecessor behavior.
test("replacement selection uses the complete pre-replacement history", () => {
  const fixture = replacementFixture();
  const replacementEvent = fixture.context.events.find(
    (event) => event.event_type === "REPLACE_REVIEWER",
  );
  const history = fixture.resolver.resolveAcceptedRecordSet({
    record_type: "REVIEW_ASSIGNMENT",
    scope: fixture.history_scope,
  });
  assert.equal(history.records.length, 2);
  assert.equal(
    fixture.replacement.replacement_of,
    fixture.expired.review_assignment_id,
  );
  assert.equal(
    fixture.replacement.capability_offer_id,
    replacementEvent.payload.replacement.capability_offer_id,
  );
  assert.equal(
    fixture.replacement.capability_offer_root,
    replacementEvent.payload.replacement.capability_offer_root,
  );
});

test("an accepted replacement prevents a second replacement", () => {
  const fixture = replacementFixture();
  const view = fixtureView(fixture);
  const replacementEvent = fixture.context.events.find(
    (event) => event.event_type === "REPLACE_REVIEWER",
  );
  assert.throws(
    () => selectReviewReplacement({
      resolver: fixture.resolver,
      expiredAssignmentRef: exactRef(fixture.expired_assignment_ref),
      candidates: view.candidates,
      jobRef: view.jobRef,
      replacementExpiryTick: fixture.replacement.expiry_tick,
    }),
    (error) => error?.code === "ERR_REVIEW_ASSIGNMENT",
  );
});

test("replacement set history contains expired and replacement records", () => {
  const fixture = replacementFixture();
  const envelope = fixture.resolver.resolveAcceptedRecordSet({
    record_type: "REVIEW_ASSIGNMENT",
    scope: fixture.history_scope,
  });
  assert.equal(envelope.records.length, 2);
  assert.deepEqual(
    envelope.records.map((entry) => entry.record.attempt),
    [1, 2],
  );
  const eligibility = fixture.resolver.resolveAcceptedRecord(
    acceptedRef(
      "REVIEWER_ELIGIBILITY",
      fixture.replacement.eligibility_id,
      fixture.replacement.eligibility_root,
    ),
  ).record;
  assert.equal(
    eligibility.facts.evaluated_tick,
    snapshotRuntime(fixture.context.runtime).state.tick,
  );
  assert.equal(
    eligibility.facts.evaluated_tick,
    fixture.replacement.not_before_tick,
  );
});

test("stale expired assignment roots are rejected", () => {
  const fixture = replacementFixture();
  const view = fixtureView(fixture);
  assert.throws(
    () => selectReviewReplacement({
      resolver: fixture.resolver,
      expiredAssignmentRef: {
        ...exactRef(fixture.expired_assignment_ref),
        record_root: "0".repeat(64),
      },
      candidates: view.candidates,
      jobRef: view.jobRef,
      replacementExpiryTick: fixture.replacement.expiry_tick,
    }),
    (error) => error?.code === "ERR_PREDECESSOR",
  );
});

test("replacement caller ticks are rejected", () => {
  const fixture = replacementFixture();
  const view = fixtureView(fixture);
  assert.throws(
    () => selectReviewReplacement({
      resolver: fixture.resolver,
      expiredAssignmentRef: exactRef(fixture.expired_assignment_ref),
      candidates: view.candidates,
      jobRef: view.jobRef,
      replacementExpiryTick: fixture.replacement.expiry_tick,
      tick: fixture.expired.expiry_tick,
    }),
    (error) => error?.code === "ERR_SCHEMA",
  );
});

// Accepted review binding and clearance.
test("accepted review packet binding is valid", () => {
  const view = postReviewView();
  const assignment = view.assignments[0];
  const review = view.reviews.find(
    (entry) => entry.review_assignment_id === assignment.review_assignment_id,
  );
  const result = validateReviewPacketBinding({
    resolver: view.resolver,
    reviewRef: acceptedRef("MODEL_REVIEW", review.review_id, modelReviewHash(review)),
    assignmentRef: acceptedRef(
      "REVIEW_ASSIGNMENT",
      assignment.review_assignment_id,
      assignment.record_root,
    ),
    packetRef: view.packetRef,
  });
  assert.equal(result.valid, true);
  assert.equal(result.accepted_logical_tick, view.snapshot.state.tick);
});

test("stale assignment roots fail packet binding", () => {
  const view = postReviewView();
  const assignment = view.assignments[0];
  assert.throws(
    () => validateReviewPacketBinding({
      resolver: view.resolver,
      reviewRef: view.reviewRefs[0],
      assignmentRef: acceptedRef(
        "REVIEW_ASSIGNMENT",
        assignment.review_assignment_id,
        "0".repeat(64),
      ),
      packetRef: view.packetRef,
    }),
    (error) => error?.code === "ERR_PREDECESSOR",
  );
});

test("three accepted clear reviews produce clearance", () => {
  const view = postReviewView();
  const outcome = computeThreeReviewOutcome(outcomeInput(view));
  assert.equal(outcome.outcome, "CLEARANCE");
  assert.equal(outcome.hold_root, null);
  assert.equal(outcome.accepted_logical_tick, view.snapshot.state.tick);
});

test("review arrival order cannot change clearance", () => {
  const view = postReviewView();
  const forward = computeThreeReviewOutcome(outcomeInput(view));
  const reverse = computeThreeReviewOutcome(
    outcomeInput(view, { reviewRefs: [...view.reviewRefs].reverse() }),
  );
  assert.equal(forward.outcome, reverse.outcome);
  assert.equal(forward.clearance_root, reverse.clearance_root);
});

test("missing accepted reviews force HOLD", () => {
  const view = postReviewView();
  const outcome = computeThreeReviewOutcome(
    outcomeInput(view, { reviewRefs: view.reviewRefs.slice(0, 2) }),
  );
  assert.equal(outcome.outcome, "HOLD");
  assert(outcome.reason_codes.includes("ERR_REVIEW_ASSIGNMENT"));
});

test("caller tick overrides are rejected", () => {
  const view = postReviewView();
  assert.throws(
    () => computeThreeReviewOutcome(
      outcomeInput(view, { currentTick: view.packet.expiry_tick }),
    ),
    (error) => error?.code === "ERR_SCHEMA",
  );
});

test("caller diversity policy overrides are rejected", () => {
  const view = postReviewView();
  assert.throws(
    () => computeThreeReviewOutcome(
      outcomeInput(view, {
        requiredDiversityDimensions: [],
      }),
    ),
    (error) => error?.code === "ERR_SCHEMA",
  );
});

test("nonzero PASS evidence forces HOLD", () => {
  const view = postReviewView();
  const checks = view.job.deterministic_evidence_manifest.checks.map(
    (check, index) => index === 0 ? { ...check, exit_code: 1 } : check,
  );
  const outcome = computeThreeReviewOutcome(
    outcomeInput(view, { deterministicChecks: checks }),
  );
  assert.equal(outcome.outcome, "HOLD");
  assert(outcome.reason_codes.includes("ERR_DETERMINISTIC_RED"));
});

test("diversity vectors ignore accepted review arrival order", () => {
  const view = postReviewView();
  const forward = buildDiversityVector({
    reviews: view.reviews,
    assignments: view.assignments,
    reviewerOffers: view.reviewerOffers,
  });
  const reverse = buildDiversityVector({
    reviews: [...view.reviews].reverse(),
    assignments: [...view.assignments].reverse(),
    reviewerOffers: [...view.reviewerOffers].reverse(),
  });
  assert.deepEqual(forward, reverse);
  assert.deepEqual(diversityLabels(forward), diversityLabels(reverse));
});

test("a shared required dimension produces the HOLD reason", () => {
  const view = postReviewView();
  const correlatedOffers = view.reviewerOffers.map((offer) => ({
    ...offer,
    provider_family: "shared-provider",
  }));
  const vector = buildDiversityVector({
    reviews: view.reviews,
    assignments: view.assignments,
    reviewerOffers: correlatedOffers,
  });
  assert.deepEqual(
    requiredDiversityReasonCodes({
      diversityVector: vector,
      requiredDimensions: ["PROVIDER"],
      requiredReviewCount: 3,
    }),
    ["ERR_REVIEW_DIVERSITY"],
  );
});

// Exact offer identity and accepted donated consent.
test("accepted capability offer root matches local projection", () => {
  const fixture = donatedFixture();
  const envelope = fixture.resolver.resolveAcceptedRecord(
    fixture.capabilityOfferRef,
  );
  assert.equal(envelope.record_root, capabilityOfferRoot(envelope.record));
  assert.equal(envelope.record_id, fixture.donatedOffer.offer_id);
});

test("capability offer root distinguishes absent from present derived ID", () => {
  const fixture = donatedFixture();
  const envelope = fixture.resolver.resolveAcceptedRecord(
    fixture.capabilityOfferRef,
  );
  const offer = envelope.record;
  const withoutId = structuredClone(offer);
  delete withoutId.offer_id;
  const mismatch = `${offer.offer_id.slice(0, -1)}${
    offer.offer_id.endsWith("0") ? "1" : "0"
  }`;

  assert.equal(capabilityOfferRoot(withoutId), envelope.record_root);
  assert.equal(capabilityOfferRoot(offer), envelope.record_root);
  for (const invalidId of [
    null,
    undefined,
    7,
    "malformed",
    mismatch,
  ]) {
    assert.throws(
      () => capabilityOfferRoot({ ...withoutId, offer_id: invalidId }),
      (error) => error?.code === "ERR_ID_PREIMAGE",
    );
  }
});

test("offer verified authentication reference changes carrier root and ID", () => {
  const offer = donatedFixture().donatedOffer;
  const changedContent = {
    ...offer,
    authentication: {
      ...offer.authentication,
      key_id: `${offer.authentication.key_id}-replacement`,
    },
  };
  const changedId = derivedCarrierId(
    "CAPABILITY_OFFER",
    changedContent,
  );
  const changed = { ...changedContent, offer_id: changedId };
  assert.notEqual(capabilityOfferRoot(changed), capabilityOfferRoot(offer));
  assert.notEqual(changedId, offer.offer_id);
  assert.throws(() => capabilityOfferRoot(changedContent));
  const missing = structuredClone(offer);
  delete missing.authentication.key_id;
  assert.throws(() => capabilityOfferRoot(missing));
  assert.throws(() =>
    capabilityOfferRoot({
      ...offer,
      authentication: {
        ...offer.authentication,
        unexpected: true,
      },
    }),
  );
});

test("offer content changes alter root and ID", () => {
  const offer = donatedFixture().donatedOffer;
  const changedContent = {
    ...offer,
    nonce: `${offer.nonce}-changed`,
  };
  changedContent.offer_content_root =
    capabilityOfferContentRoot(changedContent);
  const changed = {
    ...changedContent,
    offer_id: derivedCarrierId("CAPABILITY_OFFER", changedContent),
  };
  assert.notEqual(capabilityOfferRoot(changed), capabilityOfferRoot(offer));
  assert.notEqual(changed.offer_id, offer.offer_id);
});

test("canonical probe binds the consent-bearing offer", () => {
  const fixture = donatedFixture();
  assert.equal(capabilityProbeRoot(fixture.probe), fixture.donatedOffer.probe_root);
  assert.equal(
    fixture.probe.offer_binding_root,
    capabilityOfferBindingRoot(fixture.donatedOffer),
  );
});

test("accepted donated consent authorizes zero-price eligibility", () => {
  const fixture = donatedFixture();
  const result = evaluateOfferEligibility(
    donatedEligibilityInput(fixture),
  );
  assert.equal(result.eligible, true);
  assert.equal(
    result.accepted_application_state_root,
    snapshotRuntime(fixture.context.runtime).current_root,
  );
  assert.equal(
    result.accepted_logical_tick,
    snapshotRuntime(fixture.context.runtime).state.tick,
  );
});

test("current JOB TASK and BID records resolve only at exact roots", () => {
  const fixture = donatedFixture();
  const input = donatedEligibilityInput(fixture);
  const snapshot = snapshotRuntime(fixture.context.runtime);
  const bid = Object.values(snapshot.state.bids)[0];
  for (const reference of [
    input.jobRef,
    input.taskRef,
    acceptedRef("BID", bid.bid_id, bid.record_root),
  ]) {
    const envelope = fixture.resolver.resolveAcceptedRecord(reference);
    assert.equal(envelope.schema, "nexus-accepted-record-envelope-v2");
    assert.equal(envelope.accepted_logical_tick, snapshot.state.tick);
    assert.equal(envelope.record.record_root, reference.record_root);
    assert.equal(
      envelope.record.record_revision,
      envelope.record_revision,
    );
  }
  assert.throws(
    () => fixture.resolver.resolveAcceptedRecord({
      ...input.jobRef,
      record_root: "0".repeat(64),
    }),
    (error) => error?.code === "ERR_PREDECESSOR",
  );
});

test("offer eligibility rejects stale job task contract and conflict refs", () => {
  const fixture = donatedFixture();
  const input = donatedEligibilityInput(fixture);
  for (const key of [
    "jobRef",
    "taskRef",
    "jobContractRef",
    "conflictPolicyRef",
  ]) {
    assert.throws(
      () => evaluateOfferEligibility({
        ...input,
        [key]: {
          ...input[key],
          record_root: "0".repeat(64),
        },
      }),
      (error) => error?.code === "ERR_PREDECESSOR",
    );
  }
  const { conflictPolicyRef: ignored, ...missingConflict } = input;
  assert.throws(
    () => evaluateOfferEligibility(missingConflict),
    (error) => error?.code === "ERR_SCHEMA",
  );
  assert.throws(
    () => evaluateOfferEligibility({
      ...input,
      conflictPolicyRef: {
        ...input.conflictPolicyRef,
        record_id: `CONFLICT-${"0".repeat(64)}`,
      },
    }),
    (error) =>
      error?.code === "ERR_SCHEMA" ||
      error?.code === "ERR_PREDECESSOR",
  );
});

test("offer eligibility rejects every legacy authority override", () => {
  const fixture = donatedFixture();
  const input = donatedEligibilityInput(fixture);
  for (const key of [
    "contract",
    "job",
    "task",
    "bid",
    "tick",
    "revokedOfferIds",
    "conflictPrincipalIds",
  ]) {
    assert.throws(
      () => evaluateOfferEligibility({ ...input, [key]: [] }),
      (error) => error?.code === "ERR_SCHEMA",
    );
  }
});

test("revoked offers cannot resolve from accepted state", () => {
  const fixture = createRevokedOfferFixture();
  assert.throws(
    () => fixture.resolver.resolveAcceptedRecord(
      fixture.capabilityOfferRef,
    ),
    (error) => error?.code === "ERR_CAPABILITY",
  );
});

test("donated capacity rejects unrelated accepted bids", () => {
  const fixture = donatedFixture();
  const snapshot = snapshotRuntime(fixture.context.runtime);
  const bid = Object.values(snapshot.state.bids)[0];
  const result = evaluateOfferEligibility(
    donatedEligibilityInput(fixture, {
      evaluationKind: "BID",
      taskRef: null,
      bidRef: acceptedRef("BID", bid.bid_id, bid.record_root),
    }),
  );
  assert.equal(result.eligible, false);
  assert(result.reason_codes.includes("ERR_BID_CONTRACT_BINDING"));
});

test("donated capacity rejects missing consent references", () => {
  const fixture = donatedFixture();
  const result = evaluateOfferEligibility(donatedEligibilityInput(fixture, {
    donatedCapacityConsentRef: null,
  }));
  assert.equal(result.eligible, false);
  assert(result.reason_codes.includes("ERR_BID_INELIGIBLE"));
});

test("donated capacity rejects stale consent roots", () => {
  const fixture = donatedFixture();
  assert.throws(
    () => evaluateOfferEligibility({
      ...donatedEligibilityInput(fixture),
      donatedCapacityConsentRef: {
        ...fixture.donatedCapacityConsentRef,
        record_root: "0".repeat(64),
      },
    }),
    (error) => error?.code === "ERR_PREDECESSOR",
  );
});

test("accepted consent uses its independent auth domain", () => {
  const consent = donatedFixture().acceptedConsent;
  assert.equal(
    consent.authentication.signed_domain,
    "NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2",
  );
  assert.equal(
    donatedCapacityConsentRoot(consent),
    donatedCapacityConsentRecordRoot(consent),
  );
});

test("donated consent record root distinguishes absent from present derived ID", () => {
  const fixture = donatedFixture();
  const envelope = fixture.resolver.resolveAcceptedRecord(
    fixture.donatedCapacityConsentRef,
  );
  const consent = envelope.record;
  const withoutId = structuredClone(consent);
  delete withoutId.consent_id;
  const mismatch = `${consent.consent_id.slice(0, -1)}${
    consent.consent_id.endsWith("0") ? "1" : "0"
  }`;

  assert.equal(
    donatedCapacityConsentRecordRoot(withoutId),
    envelope.record_root,
  );
  assert.equal(
    donatedCapacityConsentRecordRoot(consent),
    envelope.record_root,
  );
  for (const invalidId of [
    null,
    undefined,
    7,
    "malformed",
    mismatch,
  ]) {
    assert.throws(
      () =>
        donatedCapacityConsentRecordRoot({
          ...withoutId,
          consent_id: invalidId,
        }),
      (error) => error?.code === "ERR_ID_PREIMAGE",
    );
  }
});

test("consent verified authentication reference changes accepted consent root and ID", () => {
  const consent = donatedFixture().acceptedConsent;
  const changedContent = {
    ...consent,
    authentication: {
      ...consent.authentication,
      key_id: `${consent.authentication.key_id}-replacement`,
    },
  };
  const changedId = derivedCarrierId(
    "DONATED_CAPACITY_CONSENT",
    changedContent,
  );
  const changed = { ...changedContent, consent_id: changedId };
  assert.notEqual(
    donatedCapacityConsentRoot(changed),
    donatedCapacityConsentRoot(consent),
  );
  assert.notEqual(changedId, consent.consent_id);
  assert.throws(() => donatedCapacityConsentRoot(changedContent));
  const missing = structuredClone(consent);
  delete missing.authentication.key_id;
  assert.throws(() => donatedCapacityConsentRoot(missing));
  assert.throws(() =>
    donatedCapacityConsentRoot({
      ...consent,
      authentication: {
        ...consent.authentication,
        unexpected: true,
      },
    }),
  );
});

test("consent body binds exact offer terms and window", () => {
  const fixture = donatedFixture();
  const body = fixture.acceptedConsent.signed_body;
  assert.equal(body.offer_terms_root, capabilityOfferTermsRoot(fixture.donatedOffer));
  assert.equal(body.not_before_tick, fixture.donatedOffer.not_before_tick);
  assert.equal(body.expiry_tick, fixture.donatedOffer.expiry_tick);
  assert.equal(
    donatedCapacityConsentBodyRoot(body),
    fixture.acceptedConsent.signed_body_root,
  );
});

test("root APIs reject unknown extensions", () => {
  const fixture = donatedFixture();
  assert.throws(() => capabilityOfferRoot({ ...fixture.donatedOffer, extension: true }));
  assert.throws(() => capabilityProbeRoot({ ...fixture.probe, extension: true }));
  assert.throws(() => donatedCapacityConsentRoot({ ...fixture.acceptedConsent, extension: true }));
});

// Opaque runtime and immutable snapshot boundary.
test("core runtime is frozen and propertyless", () => {
  const runtime = preAssignmentView().runtime;
  assert(Object.isFrozen(runtime));
  assert.deepEqual(Object.keys(runtime), []);
  assert.equal(Object.hasOwn(runtime, "state"), false);
});

test("snapshotRuntime returns the exact deep-frozen schema", () => {
  const snapshot = snapshotRuntime(preAssignmentView().runtime);
  assert.deepEqual(Object.keys(snapshot), [
    "schema",
    "state",
    "events",
    "receipts",
    "current_root",
  ]);
  assert.equal(snapshot.schema, "nexus-runtime-snapshot-v1");
  assert(Object.isFrozen(snapshot));
  assert(Object.isFrozen(snapshot.state));
});

test("accepted resolver outputs are immutable canonical snapshots", () => {
  const view = preAssignmentView();
  const envelope = view.resolver.resolveAcceptedRecord(view.packetRef);
  const before = canonicalize(envelope);
  assert(Object.isFrozen(envelope));
  assert(Object.isFrozen(envelope.record));
  assert.equal(canonicalize(envelope), before);
});

export function runWorkReviewTests() {
  const failures = [];
  for (const { name, body } of TESTS) {
    try {
      body();
      console.log(`ok - ${name}`);
    } catch (error) {
      failures.push({ name, error });
      console.error(`not ok - ${name}`);
      console.error(error);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `${failures.length} work/review test${
        failures.length === 1 ? "" : "s"
      } failed`,
    );
  }
  console.log(
    `work-review: PASS (${TESTS.length} deterministic tests)`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runWorkReviewTests();
}
