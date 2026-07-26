import { hash, rootId } from "./hash.mjs";
import { invariant } from "./errors.mjs";
import { applicationRoot } from "./state.mjs";
import {
  MAX_EVENT_BYTES,
  MAX_EVENT_PAYLOAD_BYTES,
  assertBoundedCanonical,
  assertCanonicalToken,
  assertExactObjectKeys,
  assertSafeNonNegativeInteger,
} from "./schema.mjs";

const PAYLOAD_FIELDS = Object.freeze({
  CREATE_JOB: [
    ["repository", "base_commit", "maintainer_principal_id", "project_pool_account_id", "title", "spec_root", "acceptance_root", "source_root", "context_root", "maximum_artifact_bytes", "data_class", "remote_execution", "budget", "deadline_tick", "max_attempts", "max_subworkers", "max_subworker_budget", "fixed_verification_cost", "max_compute_units", "required_check_names", "check_environment_root", "allowed_worker_principal_ids", "allowed_model_ids", "allowed_provider_families", "allowed_operator_ids", "allowed_tools", "allowed_runtimes", "allowed_routes", "egress_allowlist", "required_isolation_root", "trusted_worker_policy_root", "maximum_capability_root", "allowed_licences", "contribution_terms_root", "attribution_policy_root", "lead_worker_amount_ceiling", "reviewer_amount_each", "verification_recipient_account_id", "timeout_policy_root", "abort_policy_root", "allowed_appeal_grounds", "filing_deadline_ticks", "resolution_deadline_ticks", "resolver_principal_ids", "hold_timeout_ticks", "verifier_root", "policy_root", "disclosure_policy_root", "secret_scan_policy_root", "approval_policy_root", "job_nonce"],
    [],
  ],
  REGISTER_OFFER: [
    ["offer_mode", "worker_class", "owner_consent_id", "owner_consent_root", "project_allowlist", "job_allowlist", "model_id", "provider_family", "operator_id", "route", "data_classes", "tools", "runtimes", "egress_allowlist", "max_input_bytes", "max_output_bytes", "max_compute_units", "max_active_leases", "isolation_root", "trusted_worker_policy_root", "maximum_capability_root", "contribution_terms_allowlist", "attribution", "probe_root", "not_before_tick", "expiry_tick", "seat_nonce", "offer_nonce"],
    [],
  ],
  REVOKE_OFFER: [
    ["capability_offer_id", "capability_offer_root"],
    [],
  ],
  ACCEPT_DONATED_CAPACITY_CONSENT: [["schema", "body", "authentication"], []],
  CONTRIBUTE: [["job_id", "amount", "kind", "sponsor_account_id", "disclosure_acknowledgement_root", "attribution", "contribution_nonce"], []],
  OPEN_BID_ROUND: [["job_id", "open_tick", "commit_close_tick", "reveal_close_tick", "acceptance_deadline_tick", "round_nonce"], []],
  COMMIT_BID: [["round_id", "worker_seat_id", "capability_offer_root", "commitment", "bid_nonce"], []],
  REVEAL_BID: [["bid_id", "reveal"], []],
  ADVANCE_TICK: [[], []],
  SELECT_BID: [["job_id"], ["expected_bid_id"]],
  UNSELECT_BID: [["job_id"], []],
  REVOKE_BID: [["job_id"], []],
  ACCEPT_BID: [["job_id", "candidate_contract_root"], []],
  ISSUE_LEASE: [["job_id", "task_id", "context_root", "input_manifest_root", "not_before_tick", "expiry_tick", "lease_nonce"], []],
  SUBMIT_LEASE_RETURN: [["lease_id", "lease_root", "task_id", "job_id", "attempt", "worker_seat_id", "source_root", "artifact_root", "manifest_root", "contribution_terms_root", "worker_acknowledgement_root", "attribution_record_root", "observations", "commands_root", "return_nonce"], []],
  ISSUE_ALLOWANCE: [["job_id", "amount", "not_before_tick", "expiry_tick", "agent_seat_id", "purpose", "allowance_nonce"], []],
  AUTHORIZE_SUBWORK: [["allowance_id", "amount", "recipient_principal_id", "recipient_seat_id", "capability_offer_root", "task_nonce", "commitment_nonce", "evidence_requirement_root", "expiry_tick", "task_kind", "phase_rank", "priority", "dependencies", "context_root", "input_manifest_root", "output_schema_root", "required_capabilities", "max_compute_units", "max_input_bytes", "max_output_bytes", "concurrency_group", "conflict_set", "review_requirement", "terminal_behavior"], []],
  ACCEPT_SUBWORK_RETURN: [["commitment_id", "lease_id", "work_return_id", "artifact_root", "evidence_root", "funding_lot_ids", "recipient_account_id"], []],
  ACCEPT_LEAD_RETURN: [["job_id", "lease_id", "work_return_id", "recipient_account_id", "source_root", "artifact_root", "manifest_root", "contribution_terms_root", "worker_acknowledgement_root", "attribution_record_root"], []],
  ACCEPT_DETERMINISTIC_EVIDENCE: [["job_id", "required_check_manifest", "expected_required_check_manifest_root", "check_manifest", "evidence_root", "verifier_authority", "expected_verifier_authority_root", "execution_receipt_anchor", "expected_execution_receipt_anchor_root"], []],
  ENTER_REVIEW: [["job_id", "rubric_root", "questions", "max_compute_units", "expiry_tick"], ["expected_packet_root"]],
  ASSIGN_REVIEWERS: [["job_id", "assignments", "assignment_nonce"], []],
  REPLACE_REVIEWER: [["job_id", "expired_assignment_id", "expected_assignment_record_root", "expected_assignment_revision", "replacement", "replacement_nonce"], []],
  ACCEPT_ASSIGNED_REVIEW: [["review_assignment_id", "expected_assignment_record_root", "expected_assignment_revision", "eligibility_root", "required_check_manifest_root", "packet_root", "model_id", "reviewer_seat_id", "provider_family", "operator_id", "prompt_lineage_root", "toolchain_root", "machine_declaration", "verifier_implementation", "verdict", "severity", "findings", "claims", "evidence_refs", "limitations", "review_nonce", "recipient_account_id"], []],
  COMPUTE_REVIEW_OUTCOME: [["job_id"], []],
  HUMAN_DECISION: [["job_id", "decision", "clearance_root", "hold_root", "reason_codes", "decision_nonce"], []],
  FILE_APPEAL: [["job_id", "decision_root", "claimed_role", "ground", "disputed_payout_ids", "evidence_packet_root", "appeal_nonce"], []],
  RESOLVE_APPEAL: [["appeal_id", "resolution", "evidence_root", "reason_codes", "valid_payout_ids", "invalid_payout_ids", "resolution_nonce"], []],
  SETTLE_JOB: [["job_id", "contract_root", "artifact_root", "clearance_root", "decision_root"], []],
  ABORT_JOB: [["job_id", "authorization_root"], []],
  CANCEL_JOB: [["job_id"], []],
  REVOKE_CONTRIBUTION: [["contribution_id"], []],
  ACCEPT_DISCLOSURE_POLICY: [["schema", "body"], []],
  ACCEPT_DISCLOSURE_PROOF_CONTEXT: [["schema", "body"], []],
  REGISTER_ENTROPY_FRESHNESS_AUTHORITY: [["schema", "body"], []],
  AUTHORIZE_DISCLOSURE_PREPARATION: [["schema", "body"], []],
  ACCEPT_DISCLOSURE_PREPARATION: [["schema", "body"], []],
  COMMIT_PUBLIC_EXPORT_AUTHORITY: [["schema", "body"], []],
  CONSUME_ENTROPY_AUTHORITY: [["schema", "claim"], []],
  RECORD_DISCLOSURE_SCAN: [["schema", "body"], []],
  RECORD_DISCLOSURE_APPROVAL: [["schema", "body"], []],
  ACCEPT_DISCLOSURE_COMPILATION: [["schema", "body"], []],
  ACCEPT_DISCLOSURE_MANIFEST: [["schema", "body"], []],
  ACCEPT_PUBLIC_CAPSULE: [["schema", "body"], []],
  ACCEPT_NON_CLAIMS: [["schema", "body"], []],
  AUTHORIZE_DATA_ROUTE: [["schema", "body"], []],
  AUTHORIZE_TOOL_ROUTE: [["schema", "body"], []],
  RECORD_CLASSIFIED_INPUT_MEASUREMENT: [["job_ref", "task_ref", "lease_ref", "entries"], []],
  CREATE_ROUTE_EXECUTION_PLAN: [["lease_ref", "classified_input_manifest_ref", "data_route_authority_ref", "redaction_approval_ref", "tool_route_authority_refs", "plan_nonce"], []],
  CONSUME_ROUTE_EXECUTION_PLAN: [["route_execution_plan_id", "route_execution_plan_root", "expected_decision_root"], []],
  RECORD_REDACTION_MANIFEST: [["schema", "body"], []],
  APPROVE_REDACTION: [["schema", "body"], []],
  ACCEPT_PUBLICATION: [["schema", "body"], []],
  CREATE_PUBLICATION_INTENT: [["schema", "body"], []],
});

export function assertEventIngress(event) {
  assertExactObjectKeys(
    event,
    ["schema", "event_type", "actor_id", "authority_root", "policy_root", "expected_predecessor_root", "tick", "nonce", "idempotency_key", "payload", "event_id", "auth"],
    [],
    "event",
  );
  invariant(event.schema === "nexus-event-v1", "ERR_SCHEMA", "bad event schema");
  assertCanonicalToken(event.event_type, "event type");
  const fields = PAYLOAD_FIELDS[event.event_type];
  invariant(fields, "ERR_SCHEMA", `unsupported event type ${event.event_type}`);
  assertExactObjectKeys(event.payload, fields[0], fields[1], `${event.event_type} payload`);
  assertSafeNonNegativeInteger(event.tick, "event tick");
  assertCanonicalToken(event.nonce, "event nonce");
  assertCanonicalToken(event.idempotency_key, "idempotency key");
  assertBoundedCanonical(event.payload, "event payload", MAX_EVENT_PAYLOAD_BYTES);
  assertExactObjectKeys(
    event.auth,
    ["scheme", "key_id", "controller_id", "signed_domain", "signed_payload_root", "signature"],
    [],
    "event auth",
  );
  assertBoundedCanonical(event, "authenticated event", MAX_EVENT_BYTES);
  return event;
}

function assertEventInput(eventType, payload, nonce, idempotencyKey) {
  const fields = PAYLOAD_FIELDS[eventType];
  invariant(fields, "ERR_SCHEMA", `unsupported event type ${eventType}`);
  assertExactObjectKeys(payload, fields[0], fields[1], `${eventType} payload`);
  assertCanonicalToken(nonce, "event nonce");
  assertCanonicalToken(idempotencyKey, "idempotency key");
  assertBoundedCanonical(payload, "event payload", MAX_EVENT_PAYLOAD_BYTES);
}

function bodyWithout(event, omitted) {
  const output = Object.create(null);
  for (const key of Object.keys(event)) {
    if (!omitted.has(key)) output[key] = event[key];
  }
  return output;
}

export function eventBodyRoot(event) {
  return hash(
    "NEXUS_EVENT_V1",
    bodyWithout(event, new Set(["event_id", "auth"])),
  );
}

export function authenticatedEventRoot(event) {
  return hash("NEXUS_AUTHENTICATED_EVENT_V1", event);
}

export function authPreimage(event, controllerId) {
  return {
    schema: "nexus-event-auth-preimage-v1",
    event_body_root: eventBodyRoot(event),
    event_type: event.event_type,
    actor_id: event.actor_id,
    controller_id: controllerId,
    expected_predecessor_root: event.expected_predecessor_root,
    authority_root: event.authority_root,
    tick: event.tick,
    nonce: event.nonce,
    idempotency_key: event.idempotency_key,
    payload_root: hash("NEXUS_EVENT_PAYLOAD_V1", event.payload),
    policy_root: event.policy_root,
  };
}

function simSignature(keyId, signedPayloadRoot) {
  return hash("NEXUS_SIM_AUTH_UNSAFE_V1", {
    warning: "SIM_AUTH_UNSAFE",
    key_id: keyId,
    signed_payload_root: signedPayloadRoot,
  });
}

export function buildIndependentControllerAuthentication(
  state,
  {
    principalId,
    controllerId,
    signedDomain,
    signedBodyRoot,
  },
) {
  const principal = state.principals[principalId];
  const controller = state.controllers[controllerId];
  invariant(
    principal?.status === "ACTIVE" &&
      controller?.status === "ACTIVE" &&
      principal.controller_id === controllerId,
    "ERR_AUTHORITY",
    "independent controller is not active for principal",
  );
  assertCanonicalToken(signedDomain, "independent signed domain", 256);
  const signedPayloadRoot = hash(signedDomain, {
    principal_id: principalId,
    controller_id: controllerId,
    signed_body_root: signedBodyRoot,
  });
  return {
    scheme: "SIM_AUTH_UNSAFE",
    key_id: controller.key_id,
    controller_id: controllerId,
    signed_domain: signedDomain,
    signed_payload_root: signedPayloadRoot,
    signature: simSignature(controller.key_id, signedPayloadRoot),
  };
}

export function verifyIndependentControllerAuthentication(
  state,
  {
    principalId,
    controllerId,
    signedDomain,
    signedBodyRoot,
    authentication,
  },
) {
  assertExactObjectKeys(
    authentication,
    [
      "scheme",
      "key_id",
      "controller_id",
      "signed_domain",
      "signed_payload_root",
      "signature",
    ],
    [],
    "independent controller authentication",
  );
  const expected = buildIndependentControllerAuthentication(state, {
    principalId,
    controllerId,
    signedDomain,
    signedBodyRoot,
  });
  invariant(
    canonicalAuthentication(authentication) ===
      canonicalAuthentication(expected),
    "ERR_AUTHORITY",
    "independent controller authentication is invalid",
  );
  return authentication;
}

function canonicalAuthentication(authentication) {
  return JSON.stringify(authentication);
}

export function buildEvent(state, {
  eventType,
  actorId,
  payload,
  nonce,
  idempotencyKey = nonce,
}) {
  assertEventInput(eventType, payload, nonce, idempotencyKey);
  const principal = state.principals[actorId];
  invariant(principal, "ERR_AUTHORITY", "unknown actor principal");
  const controller = state.controllers[principal.controller_id];
  invariant(controller, "ERR_AUTHORITY", "actor controller missing");
  const body = {
    schema: "nexus-event-v1",
    event_type: eventType,
    actor_id: actorId,
    authority_root: hash("NEXUS_AUTHORITY_V1", {
      controller_id: controller.controller_id,
      scopes: controller.scopes,
    }),
    policy_root: state.policy_root,
    expected_predecessor_root: applicationRoot(state),
    tick: state.tick,
    nonce,
    idempotency_key: idempotencyKey,
    payload,
  };
  const eventId = rootId("EVT", "NEXUS_EVENT_V1", body);
  const unsigned = { ...body, event_id: eventId };
  const preimage = authPreimage(unsigned, controller.controller_id);
  const signedPayloadRoot = hash("NEXUS_EVENT_AUTH_V1", preimage);
  return {
    ...unsigned,
    auth: {
      scheme: "SIM_AUTH_UNSAFE",
      key_id: controller.key_id,
      controller_id: controller.controller_id,
      signed_domain: "NEXUS_EVENT_AUTH_V1",
      signed_payload_root: signedPayloadRoot,
      signature: simSignature(controller.key_id, signedPayloadRoot),
    },
  };
}

export function verifyNewEvent(state, event) {
  assertEventIngress(event);
  const expectedId = `EVT-${eventBodyRoot(event)}`;
  invariant(event.event_id === expectedId, "ERR_ID_PREIMAGE", "bad event ID");
  invariant(
    event.expected_predecessor_root === applicationRoot(state),
    "ERR_PREDECESSOR",
    "event predecessor is stale",
  );
  invariant(event.tick === state.tick, "ERR_TICK", "event tick is stale");
  invariant(
    event.policy_root === state.policy_root,
    "ERR_POLICY_ROOT",
    "event policy root mismatch",
  );
  const principal = state.principals[event.actor_id];
  invariant(
    principal?.status === "ACTIVE",
    "ERR_AUTHORITY",
    "actor is not active",
  );
  invariant(
    event.auth !== null && typeof event.auth === "object",
    "ERR_AUTHORITY",
    "event authentication is missing",
  );
  const controller = state.controllers[event.auth.controller_id];
  invariant(
    controller?.status === "ACTIVE" &&
      controller.controller_id === principal.controller_id,
    "ERR_AUTHORITY",
    "controller is not active for actor",
  );
  invariant(
    event.auth.controller_id === controller.controller_id &&
      event.auth.key_id === controller.key_id &&
      event.auth.signed_domain === "NEXUS_EVENT_AUTH_V1",
    "ERR_AUTHORITY",
    "authentication key/controller/domain binding mismatch",
  );
  invariant(
    event.auth.scheme === "SIM_AUTH_UNSAFE" &&
      controller.scheme === "SIM_AUTH_UNSAFE",
    "ERR_AUTHORITY",
    "prototype accepts only labelled SIM_AUTH_UNSAFE fixtures",
  );
  const expectedAuthority = hash("NEXUS_AUTHORITY_V1", {
    controller_id: controller.controller_id,
    scopes: controller.scopes,
  });
  invariant(
    event.authority_root === expectedAuthority,
    "ERR_AUTHORITY",
    "event authority root mismatch",
  );
  invariant(
    controller.scopes.includes("*") ||
      controller.scopes.includes(event.event_type),
    "ERR_AUTHORITY",
    `controller lacks ${event.event_type} scope`,
  );
  const preimage = authPreimage(event, controller.controller_id);
  const expectedRoot = hash("NEXUS_EVENT_AUTH_V1", preimage);
  invariant(
    event.auth.signed_payload_root === expectedRoot,
    "ERR_AUTHORITY",
    "signed payload root mismatch",
  );
  invariant(
    event.auth.signature === simSignature(controller.key_id, expectedRoot),
    "ERR_AUTHORITY",
    "invalid simulation signature",
  );
  return event;
}
