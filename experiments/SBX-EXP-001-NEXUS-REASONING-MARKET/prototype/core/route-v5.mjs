import { fail, invariant } from "./errors.mjs";
import { hash, rootId } from "./hash.mjs";
import {
  assertExactObjectKeys,
  assertHexNonce128,
  assertHexRoot,
  assertPlainObject,
  assertSafeNonNegativeInteger,
  assertSortedUniqueStrings,
} from "./schema.mjs";
import { checkedAdd } from "../economy/funding.mjs";

export const CLASSIFIED_INPUT_MANIFEST_SCHEMA =
  "nexus-classified-input-manifest-v2";
export const WORKER_TRUST_AUTHORITY_SCHEMA =
  "nexus-worker-trust-authority-v1";
export const ROUTE_EXECUTION_PLAN_SCHEMA = "nexus-route-execution-plan-v5";
export const ACCEPTED_ROUTE_CONTEXT_SCHEMA = "nexus-accepted-route-context-v1";
export const DATA_ROUTE_DECISION_SCHEMA = "nexus-data-route-decision-v5";
export const ROUTE_PLAN_CONSUMPTION_SCHEMA =
  "nexus-route-plan-consumption-v1";

const DATA_CLASS_RANK = Object.freeze({
  PUBLIC: 0,
  REDACTED: 1,
  PROPRIETARY: 2,
  SECRET: 3,
});

const MANIFEST_KEYS = Object.freeze([
  "schema",
  "classified_input_manifest_id",
  "job_ref",
  "task_ref",
  "lease_ref",
  "input_manifest_root",
  "entries",
  "total_bytes",
  "measurement_method",
  "measurement_authority_root",
  "measurement_principal_id",
  "measurement_controller_id",
  "not_before_tick",
  "expiry_tick",
]);

const TRUST_KEYS = Object.freeze([
  "schema",
  "worker_trust_authority_id",
  "job_ref",
  "task_ref",
  "lease_ref",
  "capability_offer_ref",
  "worker_principal_id",
  "worker_seat_id",
  "controller_id",
  "controller_key_id",
  "probe_root",
  "worker_class",
  "route",
  "data_classes",
  "tools",
  "runtimes",
  "egress_allowlist",
  "isolation_root",
  "trusted_worker_policy_root",
  "maximum_capability_root",
  "not_before_tick",
  "expiry_tick",
]);

const PLAN_KEYS = Object.freeze([
  "schema",
  "route_execution_plan_id",
  "job_ref",
  "task_ref",
  "lease_ref",
  "contract_ref",
  "capability_offer_ref",
  "classified_input_manifest_ref",
  "worker_trust_authority_ref",
  "data_route_authority_ref",
  "redaction_approval_ref",
  "tool_routes",
  "selected_route",
  "requested_tools",
  "requested_runtimes",
  "requested_egress",
  "job_account_ref",
  "funding_lot_refs",
  "allowance_ref",
  "subwork_commitment_ref",
  "spend_amount",
  "not_before_tick",
  "expiry_tick",
  "nonce",
  "created_application_state_root",
  "created_logical_tick",
]);

const CONSUMPTION_KEYS = Object.freeze([
  "schema",
  "route_plan_consumption_id",
  "route_execution_plan_ref",
  "decision_root",
  "evaluated_application_state_root",
  "evaluated_logical_tick",
  "executor_principal_id",
  "executor_controller_id",
]);

function withoutKey(value, key) {
  return Object.fromEntries(
    Object.entries(value).filter(([entryKey]) => entryKey !== key),
  );
}

function assertString(value, label) {
  invariant(
    typeof value === "string" && value.length > 0,
    "ERR_SCHEMA",
    `${label} must be a non-empty string`,
  );
}

function assertRecordRef(value, label, { nullable = false } = {}) {
  if (nullable && value === null) {
    return;
  }
  assertPlainObject(value, label);
  assertExactObjectKeys(value, ["record_id", "record_root"], label);
  assertString(value.record_id, `${label}.record_id`);
  assertHexRoot(value.record_root, `${label}.record_root`);
}

function assertRefArray(value, label) {
  invariant(Array.isArray(value), "ERR_SCHEMA", `${label} must be an array`);
  let previous = null;
  for (const [index, ref] of value.entries()) {
    assertRecordRef(ref, `${label}[${index}]`);
    invariant(
      previous === null || previous < ref.record_id,
      "ERR_SCHEMA",
      `${label} must be strictly sorted by record_id`,
    );
    previous = ref.record_id;
  }
}

function assertDataClass(value, label) {
  invariant(
    Object.hasOwn(DATA_CLASS_RANK, value),
    "ERR_SCHEMA",
    `${label} is not a supported data class`,
  );
}

function assertManifestEntry(value, index) {
  const label = `classified input entry ${index}`;
  assertPlainObject(value, label);
  assertExactObjectKeys(
    value,
    ["input_root", "data_class", "byte_length", "measurement_receipt_root"],
    label,
  );
  assertString(value.input_root, `${label}.input_root`);
  assertDataClass(value.data_class, `${label}.data_class`);
  assertSafeNonNegativeInteger(value.byte_length, `${label}.byte_length`);
  assertHexRoot(
    value.measurement_receipt_root,
    `${label}.measurement_receipt_root`,
  );
}

function sumManifestEntries(entries) {
  let total = 0;
  for (const entry of entries) {
    total = checkedAdd(total, entry.byte_length);
  }
  return total;
}

function manifestIdentity(body) {
  return rootId(
    "INPUTMANIFEST",
    "NEXUS_CLASSIFIED_INPUT_MANIFEST_ID_V2",
    withoutKey(body, "classified_input_manifest_id"),
  );
}

export function classifiedInputManifestRoot(body) {
  assertPlainObject(body, "classified input manifest");
  assertExactObjectKeys(body, MANIFEST_KEYS, "classified input manifest");
  invariant(
    body.schema === CLASSIFIED_INPUT_MANIFEST_SCHEMA,
    "ERR_SCHEMA",
    "classified input manifest schema is invalid",
  );
  assertString(
    body.classified_input_manifest_id,
    "classified_input_manifest_id",
  );
  assertRecordRef(body.job_ref, "classified input manifest job_ref");
  assertRecordRef(body.task_ref, "classified input manifest task_ref");
  assertRecordRef(body.lease_ref, "classified input manifest lease_ref");
  assertString(body.input_manifest_root, "input_manifest_root");
  invariant(
    Array.isArray(body.entries) && body.entries.length > 0,
    "ERR_SCHEMA",
    "classified input manifest entries must be non-empty",
  );
  let previous = null;
  for (const [index, entry] of body.entries.entries()) {
    assertManifestEntry(entry, index);
    const orderingKey = `${entry.input_root}\u0000${entry.data_class}`;
    invariant(
      previous === null || previous < orderingKey,
      "ERR_SCHEMA",
      "classified input manifest entries must be strictly sorted",
    );
    previous = orderingKey;
  }
  assertSafeNonNegativeInteger(body.total_bytes, "total_bytes");
  invariant(
    sumManifestEntries(body.entries) === body.total_bytes,
    "ERR_SCHEMA",
    "classified input manifest total_bytes is not exact",
  );
  invariant(
    body.measurement_method === "CANONICAL_BYTES_V1",
    "ERR_SCHEMA",
    "classified input measurement method is invalid",
  );
  assertString(
    body.measurement_authority_root,
    "measurement_authority_root",
  );
  assertString(body.measurement_principal_id, "measurement_principal_id");
  assertString(body.measurement_controller_id, "measurement_controller_id");
  assertSafeNonNegativeInteger(
    body.not_before_tick,
    "measurement not_before_tick",
  );
  assertSafeNonNegativeInteger(body.expiry_tick, "measurement expiry_tick");
  invariant(
    body.not_before_tick < body.expiry_tick,
    "ERR_SCHEMA",
    "classified input measurement window is empty",
  );
  invariant(
    manifestIdentity(body) === body.classified_input_manifest_id,
    "ERR_ID_PREIMAGE",
    "classified input manifest id preimage is invalid",
  );
  return hash("NEXUS_CLASSIFIED_INPUT_MANIFEST_V2", body);
}

export function createClassifiedInputManifest(fields) {
  const body = {
    schema: CLASSIFIED_INPUT_MANIFEST_SCHEMA,
    classified_input_manifest_id: "",
    ...fields,
  };
  body.classified_input_manifest_id = manifestIdentity(body);
  classifiedInputManifestRoot(body);
  return body;
}

function trustIdentity(body) {
  return rootId(
    "WORKERTRUST",
    "NEXUS_WORKER_TRUST_AUTHORITY_ID_V1",
    withoutKey(body, "worker_trust_authority_id"),
  );
}

export function workerTrustAuthorityRoot(body) {
  assertPlainObject(body, "worker trust authority");
  assertExactObjectKeys(body, TRUST_KEYS, "worker trust authority");
  invariant(
    body.schema === WORKER_TRUST_AUTHORITY_SCHEMA,
    "ERR_SCHEMA",
    "worker trust authority schema is invalid",
  );
  assertString(body.worker_trust_authority_id, "worker_trust_authority_id");
  assertRecordRef(body.job_ref, "worker trust authority job_ref");
  assertRecordRef(body.task_ref, "worker trust authority task_ref");
  assertRecordRef(body.lease_ref, "worker trust authority lease_ref");
  assertRecordRef(
    body.capability_offer_ref,
    "worker trust authority capability_offer_ref",
  );
  for (const key of [
    "worker_principal_id",
    "worker_seat_id",
    "controller_id",
    "controller_key_id",
    "probe_root",
    "worker_class",
    "route",
    "isolation_root",
    "trusted_worker_policy_root",
    "maximum_capability_root",
  ]) {
    assertString(body[key], `worker trust authority ${key}`);
  }
  assertSortedUniqueStrings(body.data_classes, "worker trust data_classes");
  assertSortedUniqueStrings(body.tools, "worker trust tools");
  assertSortedUniqueStrings(body.runtimes, "worker trust runtimes");
  assertSortedUniqueStrings(
    body.egress_allowlist,
    "worker trust egress_allowlist",
  );
  assertSafeNonNegativeInteger(body.not_before_tick, "trust not_before_tick");
  assertSafeNonNegativeInteger(body.expiry_tick, "trust expiry_tick");
  invariant(
    body.not_before_tick < body.expiry_tick,
    "ERR_SCHEMA",
    "worker trust authority window is empty",
  );
  invariant(
    trustIdentity(body) === body.worker_trust_authority_id,
    "ERR_ID_PREIMAGE",
    "worker trust authority id preimage is invalid",
  );
  return hash("NEXUS_WORKER_TRUST_AUTHORITY_V1", body);
}

export function createWorkerTrustAuthority(fields) {
  const body = {
    schema: WORKER_TRUST_AUTHORITY_SCHEMA,
    worker_trust_authority_id: "",
    ...fields,
  };
  body.worker_trust_authority_id = trustIdentity(body);
  workerTrustAuthorityRoot(body);
  return body;
}

function assertToolRoute(value, index) {
  const label = `tool route ${index}`;
  assertPlainObject(value, label);
  assertExactObjectKeys(
    value,
    ["tool_name", "selected_route", "tool_route_authority_ref"],
    label,
  );
  assertString(value.tool_name, `${label}.tool_name`);
  assertString(value.selected_route, `${label}.selected_route`);
  assertRecordRef(
    value.tool_route_authority_ref,
    `${label}.tool_route_authority_ref`,
    { nullable: true },
  );
}

function planIdentity(body) {
  return rootId(
    "ROUTEPLAN",
    "NEXUS_ROUTE_EXECUTION_PLAN_ID_V5",
    withoutKey(body, "route_execution_plan_id"),
  );
}

export function routeExecutionPlanV5Root(body) {
  assertPlainObject(body, "route execution plan");
  assertExactObjectKeys(body, PLAN_KEYS, "route execution plan");
  invariant(
    body.schema === ROUTE_EXECUTION_PLAN_SCHEMA,
    "ERR_SCHEMA",
    "route execution plan schema is invalid",
  );
  assertString(body.route_execution_plan_id, "route_execution_plan_id");
  for (const key of [
    "job_ref",
    "task_ref",
    "lease_ref",
    "contract_ref",
    "capability_offer_ref",
    "classified_input_manifest_ref",
    "worker_trust_authority_ref",
    "job_account_ref",
  ]) {
    assertRecordRef(body[key], `route execution plan ${key}`);
  }
  assertRecordRef(
    body.data_route_authority_ref,
    "route execution plan data_route_authority_ref",
    { nullable: true },
  );
  assertRecordRef(
    body.redaction_approval_ref,
    "route execution plan redaction_approval_ref",
    { nullable: true },
  );
  assertRecordRef(body.allowance_ref, "route execution plan allowance_ref", {
    nullable: true,
  });
  assertRecordRef(
    body.subwork_commitment_ref,
    "route execution plan subwork_commitment_ref",
    { nullable: true },
  );
  assertRefArray(body.funding_lot_refs, "route execution plan funding_lot_refs");
  invariant(
    Array.isArray(body.tool_routes),
    "ERR_SCHEMA",
    "route execution plan tool_routes must be an array",
  );
  let previousTool = null;
  for (const [index, route] of body.tool_routes.entries()) {
    assertToolRoute(route, index);
    invariant(
      previousTool === null || previousTool < route.tool_name,
      "ERR_SCHEMA",
      "route execution plan tool_routes must be strictly sorted",
    );
    previousTool = route.tool_name;
  }
  assertString(body.selected_route, "route execution plan selected_route");
  assertSortedUniqueStrings(body.requested_tools, "plan requested_tools");
  assertSortedUniqueStrings(body.requested_runtimes, "plan requested_runtimes");
  assertSortedUniqueStrings(body.requested_egress, "plan requested_egress");
  invariant(
    body.tool_routes.length === body.requested_tools.length &&
      body.tool_routes.every(
        (route, index) => route.tool_name === body.requested_tools[index],
      ),
    "ERR_SCHEMA",
    "tool_routes must exactly cover requested_tools",
  );
  assertSafeNonNegativeInteger(body.spend_amount, "plan spend_amount");
  assertSafeNonNegativeInteger(body.not_before_tick, "plan not_before_tick");
  assertSafeNonNegativeInteger(body.expiry_tick, "plan expiry_tick");
  invariant(
    body.not_before_tick < body.expiry_tick,
    "ERR_SCHEMA",
    "route execution plan window is empty",
  );
  assertHexNonce128(body.nonce, "route execution plan nonce");
  assertHexRoot(
    body.created_application_state_root,
    "plan created_application_state_root",
  );
  assertSafeNonNegativeInteger(
    body.created_logical_tick,
    "plan created_logical_tick",
  );
  invariant(
    planIdentity(body) === body.route_execution_plan_id,
    "ERR_ID_PREIMAGE",
    "route execution plan id preimage is invalid",
  );
  return hash("NEXUS_ROUTE_EXECUTION_PLAN_V5", body);
}

export function createRouteExecutionPlan(fields) {
  const body = {
    schema: ROUTE_EXECUTION_PLAN_SCHEMA,
    route_execution_plan_id: "",
    ...fields,
  };
  body.route_execution_plan_id = planIdentity(body);
  routeExecutionPlanV5Root(body);
  return body;
}

function consumptionIdentity(body) {
  return rootId(
    "ROUTECONSUME",
    "NEXUS_ROUTE_PLAN_CONSUMPTION_ID_V1",
    withoutKey(body, "route_plan_consumption_id"),
  );
}

export function routePlanConsumptionRoot(body) {
  assertPlainObject(body, "route plan consumption");
  assertExactObjectKeys(body, CONSUMPTION_KEYS, "route plan consumption");
  invariant(
    body.schema === ROUTE_PLAN_CONSUMPTION_SCHEMA,
    "ERR_SCHEMA",
    "route plan consumption schema is invalid",
  );
  assertString(body.route_plan_consumption_id, "route_plan_consumption_id");
  assertRecordRef(
    body.route_execution_plan_ref,
    "route plan consumption route_execution_plan_ref",
  );
  assertHexRoot(body.decision_root, "route plan consumption decision_root");
  assertHexRoot(
    body.evaluated_application_state_root,
    "route plan consumption evaluated_application_state_root",
  );
  assertSafeNonNegativeInteger(
    body.evaluated_logical_tick,
    "route plan consumption evaluated_logical_tick",
  );
  assertString(body.executor_principal_id, "executor_principal_id");
  assertString(body.executor_controller_id, "executor_controller_id");
  invariant(
    consumptionIdentity(body) === body.route_plan_consumption_id,
    "ERR_ID_PREIMAGE",
    "route plan consumption id preimage is invalid",
  );
  return hash("NEXUS_ROUTE_PLAN_CONSUMPTION_V1", body);
}

export function createRoutePlanConsumption(fields) {
  const body = {
    schema: ROUTE_PLAN_CONSUMPTION_SCHEMA,
    route_plan_consumption_id: "",
    ...fields,
  };
  body.route_plan_consumption_id = consumptionIdentity(body);
  routePlanConsumptionRoot(body);
  return body;
}

function sameStrings(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function isSubset(values, ceiling) {
  return (
    Array.isArray(values) &&
    Array.isArray(ceiling) &&
    values.every((value) => ceiling.includes(value))
  );
}

function sameRef(ref, fact) {
  return (
    ref !== null &&
    fact !== null &&
    ref.record_id === fact.record_id &&
    ref.record_root === fact.record_root
  );
}

function addReason(reasons, condition, code) {
  if (!condition) {
    reasons.add(code);
  }
}

function checkedSum(values, reasons, overflowReason) {
  let total = 0;
  try {
    for (const value of values) {
      total = checkedAdd(total, value);
    }
    return total;
  } catch {
    reasons.add(overflowReason);
    return null;
  }
}

function maxDataClass(entries, reasons) {
  let maximum = "PUBLIC";
  for (const entry of entries) {
    if (!Object.hasOwn(DATA_CLASS_RANK, entry.data_class)) {
      reasons.add("INPUT_DATA_CLASS_INVALID");
      continue;
    }
    if (DATA_CLASS_RANK[entry.data_class] > DATA_CLASS_RANK[maximum]) {
      maximum = entry.data_class;
    }
  }
  return maximum;
}

function factRecord(fact) {
  return fact?.record ?? null;
}

function checkWindow(reasons, tick, record, prefix) {
  addReason(
    reasons,
    tick >= record.not_before_tick,
    `${prefix}_NOT_YET_VALID`,
  );
  addReason(reasons, tick < record.expiry_tick, `${prefix}_EXPIRED`);
}

export function deriveDataRouteDecisionFromFacts(context) {
  assertPlainObject(context, "accepted route context");
  invariant(
    context.schema === ACCEPTED_ROUTE_CONTEXT_SCHEMA,
    "ERR_SCHEMA",
    "accepted route context schema is invalid",
  );
  assertHexRoot(
    context.accepted_application_state_root,
    "accepted_application_state_root",
  );
  assertSafeNonNegativeInteger(
    context.accepted_logical_tick,
    "accepted_logical_tick",
  );

  const reasons = new Set();
  const tick = context.accepted_logical_tick;
  const plan = factRecord(context.route_execution_plan);
  const manifest = factRecord(context.classified_input_manifest);
  const trust = factRecord(context.worker_trust_authority);
  const job = factRecord(context.job);
  const task = factRecord(context.task);
  const lease = factRecord(context.lease);
  const contract = factRecord(context.job_contract);
  const offer = factRecord(context.capability_offer);
  const workerPrincipal = factRecord(context.worker_principal);
  const workerController = factRecord(context.worker_controller);
  const measurementPrincipal = factRecord(context.measurement_principal);
  const measurementController = factRecord(context.measurement_controller);
  const account = factRecord(context.job_account);
  const allowance = factRecord(context.allowance);
  const commitment = factRecord(context.subwork_commitment);

  for (const [label, value] of [
    ["PLAN", plan],
    ["MANIFEST", manifest],
    ["TRUST", trust],
    ["JOB", job],
    ["TASK", task],
    ["LEASE", lease],
    ["CONTRACT", contract],
    ["OFFER", offer],
    ["WORKER_PRINCIPAL", workerPrincipal],
    ["WORKER_CONTROLLER", workerController],
    ["MEASUREMENT_PRINCIPAL", measurementPrincipal],
    ["MEASUREMENT_CONTROLLER", measurementController],
    ["JOB_ACCOUNT", account],
  ]) {
    addReason(reasons, value !== null, `${label}_ABSENT`);
  }

  if (reasons.size > 0) {
    fail(
      "ERR_ROUTE_CONTEXT_INCOMPLETE",
      "accepted route context omits mandatory raw facts",
      [...reasons].sort(),
    );
  }

  addReason(
    reasons,
    routeExecutionPlanV5Root(plan) ===
      context.route_execution_plan.record_root,
    "PLAN_PREIMAGE_INVALID",
  );
  addReason(
    reasons,
    classifiedInputManifestRoot(manifest) ===
      context.classified_input_manifest.record_root,
    "MANIFEST_PREIMAGE_INVALID",
  );
  addReason(
    reasons,
    workerTrustAuthorityRoot(trust) ===
      context.worker_trust_authority.record_root,
    "TRUST_PREIMAGE_INVALID",
  );

  for (const [ref, fact, code] of [
    [plan.job_ref, context.job, "JOB_REF_MISMATCH"],
    [plan.task_ref, context.task, "TASK_REF_MISMATCH"],
    [plan.lease_ref, context.lease, "LEASE_REF_MISMATCH"],
    [plan.contract_ref, context.job_contract, "CONTRACT_REF_MISMATCH"],
    [
      plan.capability_offer_ref,
      context.capability_offer,
      "CAPABILITY_OFFER_REF_MISMATCH",
    ],
    [
      plan.classified_input_manifest_ref,
      context.classified_input_manifest,
      "MANIFEST_REF_MISMATCH",
    ],
    [
      plan.worker_trust_authority_ref,
      context.worker_trust_authority,
      "TRUST_REF_MISMATCH",
    ],
    [plan.job_account_ref, context.job_account, "JOB_ACCOUNT_REF_MISMATCH"],
  ]) {
    addReason(reasons, sameRef(ref, fact), code);
  }

  addReason(reasons, context.consumption === null, "PLAN_ALREADY_CONSUMED");
  addReason(
    reasons,
    plan.created_logical_tick <= tick,
    "PLAN_FROM_FUTURE_TICK",
  );
  checkWindow(reasons, tick, plan, "PLAN");
  checkWindow(reasons, tick, lease, "LEASE");
  checkWindow(reasons, tick, offer, "OFFER");
  checkWindow(reasons, tick, trust, "TRUST");
  addReason(reasons, tick >= task.earliest_tick, "TASK_NOT_YET_VALID");
  addReason(reasons, tick < task.deadline_tick, "TASK_EXPIRED");
  addReason(
    reasons,
    !["CANCELLED", "ABORTED", "SETTLED", "CLOSED"].includes(job.state),
    "JOB_NOT_EXECUTABLE",
  );
  addReason(
    reasons,
    ["LEASED", "RUNNING"].includes(task.status),
    "TASK_NOT_EXECUTABLE",
  );
  addReason(reasons, lease.status === "ACTIVE", "LEASE_NOT_ACTIVE");

  addReason(reasons, manifest.job_ref.record_id === job.job_id, "MANIFEST_JOB");
  addReason(
    reasons,
    manifest.task_ref.record_id === task.task_id,
    "MANIFEST_TASK",
  );
  addReason(
    reasons,
    manifest.lease_ref.record_id === lease.lease_id,
    "MANIFEST_LEASE",
  );
  addReason(
    reasons,
    manifest.input_manifest_root === task.input_manifest_root &&
      manifest.input_manifest_root === lease.input_manifest_root,
    "INPUT_MANIFEST_ROOT_MISMATCH",
  );
  addReason(
    reasons,
    manifest.measurement_method === "CANONICAL_BYTES_V1" &&
      manifest.measurement_authority_root === contract.verifier_root &&
      manifest.measurement_principal_id ===
        contract.settlement.verification_principal_id,
    "INPUT_MEASUREMENT_AUTHORITY_MISMATCH",
  );
  addReason(
    reasons,
    measurementPrincipal.principal_id ===
        manifest.measurement_principal_id &&
      measurementPrincipal.controller_id ===
        manifest.measurement_controller_id &&
      measurementPrincipal.status === "ACTIVE",
    "INPUT_MEASUREMENT_PRINCIPAL_INACTIVE",
  );
  addReason(
    reasons,
    measurementController.controller_id ===
        manifest.measurement_controller_id &&
      measurementController.principal_id ===
        manifest.measurement_principal_id &&
      measurementController.status === "ACTIVE",
    "INPUT_MEASUREMENT_CONTROLLER_INACTIVE",
  );
  addReason(
    reasons,
    manifest.measurement_principal_id !== job.requester_principal_id &&
      manifest.measurement_principal_id !== lease.worker_principal_id,
    "INPUT_MEASUREMENT_NOT_INDEPENDENT",
  );
  checkWindow(reasons, tick, manifest, "INPUT_MEASUREMENT");
  const totalBytes = checkedSum(
    manifest.entries.map((entry) => entry.byte_length),
    reasons,
    "INPUT_BYTES_OVERFLOW",
  );
  if (totalBytes !== null) {
    addReason(
      reasons,
      totalBytes === manifest.total_bytes,
      "INPUT_BYTES_NOT_EXACT",
    );
    addReason(
      reasons,
      totalBytes <= task.max_input_bytes,
      "TASK_INPUT_BYTE_LIMIT",
    );
    addReason(
      reasons,
      totalBytes <= offer.max_input_bytes,
      "OFFER_INPUT_BYTE_LIMIT",
    );
  }

  const inputDataClass = maxDataClass(manifest.entries, reasons);
  addReason(
    reasons,
    manifest.entries.every(
      (entry) =>
        DATA_CLASS_RANK[entry.data_class] <= DATA_CLASS_RANK[task.data_class],
    ),
    "TASK_DATA_CLASS_LIMIT",
  );
  addReason(
    reasons,
    DATA_CLASS_RANK[inputDataClass] <= DATA_CLASS_RANK[lease.data_class],
    "LEASE_DATA_CLASS_LIMIT",
  );
  addReason(
    reasons,
    offer.data_classes.includes(inputDataClass),
    "OFFER_DATA_CLASS_LIMIT",
  );
  addReason(
    reasons,
    DATA_CLASS_RANK[inputDataClass] <=
      DATA_CLASS_RANK[contract.authority_ceiling.maximum_data_class],
    "CONTRACT_DATA_CLASS_LIMIT",
  );

  addReason(
    reasons,
    trust.job_ref.record_id === job.job_id &&
      trust.task_ref.record_id === task.task_id &&
      trust.lease_ref.record_id === lease.lease_id,
    "TRUST_SCOPE_MISMATCH",
  );
  addReason(
    reasons,
    sameRef(trust.capability_offer_ref, context.capability_offer),
    "TRUST_OFFER_MISMATCH",
  );
  addReason(
    reasons,
    trust.worker_principal_id === lease.worker_principal_id &&
      trust.worker_principal_id === offer.principal_id &&
      trust.worker_seat_id === lease.worker_seat_id &&
      trust.worker_seat_id === offer.worker_seat_id,
    "TRUST_WORKER_MISMATCH",
  );
  addReason(
    reasons,
    workerPrincipal.principal_id === trust.worker_principal_id &&
      workerPrincipal.controller_id === trust.controller_id &&
      workerPrincipal.status === "ACTIVE",
    "WORKER_PRINCIPAL_INACTIVE",
  );
  addReason(
    reasons,
    workerController.controller_id === trust.controller_id &&
      workerController.principal_id === trust.worker_principal_id &&
      workerController.key_id === trust.controller_key_id &&
      workerController.status === "ACTIVE",
    "WORKER_CONTROLLER_INACTIVE",
  );
  addReason(
    reasons,
    offer.authentication.controller_id === trust.controller_id &&
      offer.authentication.key_id === trust.controller_key_id,
    "OFFER_AUTHORITY_MISMATCH",
  );
  addReason(
    reasons,
    !context.revoked_offer_ids.includes(offer.offer_id),
    "CAPABILITY_OFFER_REVOKED",
  );
  addReason(
    reasons,
    offer.probe_root === trust.probe_root && trust.probe_root.length > 0,
    "PROBE_AUTHORITY_MISMATCH",
  );
  addReason(
    reasons,
    trust.worker_class === offer.worker_class &&
      contract.authority_ceiling.allowed_worker_classes.includes(
        trust.worker_class,
      ),
    "WORKER_CLASS_UNAUTHORIZED",
  );
  addReason(
    reasons,
    trust.isolation_root === lease.isolation_root &&
      trust.isolation_root === offer.isolation_root &&
      trust.isolation_root ===
        contract.authority_ceiling.required_isolation_root,
    "ISOLATION_AUTHORITY_MISMATCH",
  );
  addReason(
    reasons,
    trust.trusted_worker_policy_root === offer.trusted_worker_policy_root &&
      trust.trusted_worker_policy_root ===
        contract.authority_ceiling.trusted_worker_policy_root,
    "TRUST_POLICY_MISMATCH",
  );
  addReason(
    reasons,
    trust.maximum_capability_root === lease.maximum_capability_root &&
      trust.maximum_capability_root === offer.maximum_capability_root &&
      trust.maximum_capability_root ===
        contract.authority_ceiling.maximum_capability_root,
    "MAXIMUM_CAPABILITY_MISMATCH",
  );
  addReason(
    reasons,
    isSubset(task.required_capabilities, [
      ...offer.tools,
      ...offer.runtimes,
    ]),
    "REQUIRED_CAPABILITY_ABSENT",
  );

  addReason(
    reasons,
    plan.selected_route === lease.route &&
      plan.selected_route === offer.route &&
      contract.authority_ceiling.allowed_routes.includes(plan.selected_route),
    "DESTINATION_UNAUTHORIZED",
  );
  addReason(
    reasons,
    sameStrings(plan.requested_tools, lease.tools) &&
      isSubset(plan.requested_tools, offer.tools) &&
      isSubset(plan.requested_tools, contract.authority_ceiling.allowed_tools),
    "TOOLS_UNAUTHORIZED",
  );
  addReason(
    reasons,
    sameStrings(plan.requested_runtimes, lease.runtimes) &&
      isSubset(plan.requested_runtimes, offer.runtimes) &&
      isSubset(
        plan.requested_runtimes,
        contract.authority_ceiling.allowed_runtimes,
      ),
    "RUNTIMES_UNAUTHORIZED",
  );
  addReason(
    reasons,
    sameStrings(plan.requested_egress, lease.egress_allowlist) &&
      isSubset(plan.requested_egress, offer.egress_allowlist) &&
      isSubset(
        plan.requested_egress,
        contract.authority_ceiling.egress_allowlist,
      ),
    "EGRESS_UNAUTHORIZED",
  );

  const dataRouteFact = context.data_route_authority;
  if (plan.selected_route === "REMOTE") {
    addReason(
      reasons,
      contract.privacy.remote_execution === true,
      "REMOTE_EXECUTION_DISABLED",
    );
    addReason(
      reasons,
      sameRef(plan.data_route_authority_ref, dataRouteFact),
      "DATA_ROUTE_AUTHORITY_ABSENT",
    );
    if (dataRouteFact !== null) {
      const authority = dataRouteFact.record;
      addReason(
        reasons,
        authority.contract_root === plan.contract_ref.record_root,
        "DATA_ROUTE_CONTRACT_MISMATCH",
      );
    }
  } else {
    addReason(
      reasons,
      plan.data_route_authority_ref === null &&
        dataRouteFact === null &&
        plan.selected_route === "LOCAL",
      "LOCAL_ROUTE_AUTHORITY_SHAPE",
    );
  }

  const toolFacts = new Map(
    context.tool_route_authorities.map((fact) => [
      fact.record_id,
      fact,
    ]),
  );
  for (const toolRoute of plan.tool_routes) {
    if (toolRoute.selected_route === plan.selected_route) {
      addReason(
        reasons,
        toolRoute.tool_route_authority_ref === null,
        "UNNECESSARY_TOOL_ROUTE_AUTHORITY",
      );
      continue;
    }
    const authorityFact =
      toolRoute.tool_route_authority_ref === null
        ? null
        : toolFacts.get(toolRoute.tool_route_authority_ref.record_id) ?? null;
    addReason(
      reasons,
      sameRef(toolRoute.tool_route_authority_ref, authorityFact),
      "TOOL_ROUTE_AUTHORITY_ABSENT",
    );
    if (authorityFact !== null) {
      const authority = authorityFact.record;
      addReason(
        reasons,
        authority.job_id === job.job_id &&
          authority.task_id === task.task_id &&
          authority.tool_name === toolRoute.tool_name &&
          authority.selected_route === toolRoute.selected_route &&
          authority.authorized_route === toolRoute.selected_route &&
          authority.contract_root === plan.contract_ref.record_root,
        "TOOL_ROUTE_AUTHORITY_MISMATCH",
      );
    }
  }
  addReason(
    reasons,
    toolFacts.size ===
      plan.tool_routes.filter(
        (route) => route.tool_route_authority_ref !== null,
      ).length,
    "EXTRA_TOOL_ROUTE_AUTHORITY",
  );

  const needsRedaction = manifest.entries.some(
    (entry) => entry.data_class === "REDACTED",
  );
  if (needsRedaction) {
    addReason(
      reasons,
      sameRef(plan.redaction_approval_ref, context.redaction_approval),
      "REDACTION_AUTHORITY_ABSENT",
    );
    if (context.redaction_approval !== null) {
      const approval = context.redaction_approval.record;
      addReason(
        reasons,
        approval.job_id === job.job_id &&
          approval.task_id === task.task_id &&
          approval.decision === "APPROVED" &&
          approval.contract_root === undefined,
        "REDACTION_AUTHORITY_MISMATCH",
      );
    }
  } else {
    addReason(
      reasons,
      plan.redaction_approval_ref === null &&
        context.redaction_approval === null,
      "UNNECESSARY_REDACTION_AUTHORITY",
    );
  }
  if (
    plan.selected_route === "REMOTE" &&
    ["PROPRIETARY", "SECRET"].includes(inputDataClass)
  ) {
    reasons.add("SENSITIVE_REMOTE_ROUTE_FORBIDDEN");
  }

  addReason(
    reasons,
    account.account_id === job.job_account_id &&
      account.owner_job_id === job.job_id &&
      account.kind === "JOB" &&
      account.status === "ACTIVE",
    "JOB_ACCOUNT_OWNERSHIP",
  );
  addReason(
    reasons,
    plan.spend_amount <= contract.work.budget,
    "CONTRACT_SPEND_LIMIT",
  );

  const currentLotRefs = context.funding_lots.map((fact) => ({
    record_id: fact.record_id,
    record_root: fact.record_root,
  }));
  addReason(
    reasons,
    JSON.stringify(currentLotRefs) === JSON.stringify(plan.funding_lot_refs),
    "FUNDING_LOT_REF_MISMATCH",
  );
  const expectedBucket = commitment === null ? "JOB" : "ALLOWANCE";
  const expectedBucketId =
    commitment === null ? job.job_id : commitment.allowance_id;
  const lotAmounts = [];
  for (const fact of context.funding_lots) {
    const lot = fact.record;
    addReason(
      reasons,
      lot.status === "ACTIVE" &&
        lot.bucket === expectedBucket &&
        lot.bucket_id === expectedBucketId,
      "FUNDING_LOT_OWNERSHIP",
    );
    lotAmounts.push(lot.amount);
  }
  const fundedAmount = checkedSum(
    lotAmounts,
    reasons,
    "FUNDING_AMOUNT_OVERFLOW",
  );
  if (fundedAmount !== null) {
    addReason(
      reasons,
      plan.spend_amount <= fundedAmount,
      "FUNDING_SPEND_LIMIT",
    );
  }

  if (commitment === null) {
    addReason(
      reasons,
      plan.allowance_ref === null &&
        plan.subwork_commitment_ref === null &&
        context.allowance === null,
      "LEAD_FUNDING_SHAPE",
    );
    addReason(
      reasons,
      contract.award !== null &&
        contract.award.worker_principal_id === lease.worker_principal_id &&
        contract.award.worker_seat_id === lease.worker_seat_id &&
        contract.award.capability_offer_root ===
          plan.capability_offer_ref.record_root &&
        plan.spend_amount === contract.award.lead_worker_amount,
      "LEAD_PRICE_AUTHORITY_INVALID",
    );
  } else {
    addReason(
      reasons,
      sameRef(plan.subwork_commitment_ref, context.subwork_commitment) &&
        sameRef(plan.allowance_ref, context.allowance),
      "SUBWORK_FUNDING_REF_MISMATCH",
    );
    addReason(
      reasons,
      allowance !== null &&
        allowance.status === "ACTIVE" &&
        allowance.job_id === job.job_id &&
        allowance.agent_seat_id === job.accepted_worker_seat &&
        allowance.subwork_commitment_ids.includes(
          commitment.subwork_commitment_id,
        ) &&
        tick >= allowance.not_before_tick &&
        tick < allowance.expiry_tick &&
        plan.spend_amount <= allowance.amount_ceiling,
      "ALLOWANCE_AUTHORITY_INVALID",
    );
    addReason(
      reasons,
      commitment.status === "AUTHORIZED" &&
        commitment.job_id === job.job_id &&
        commitment.task_id === task.task_id &&
        commitment.recipient_principal_id === lease.worker_principal_id &&
        commitment.recipient_seat_id === lease.worker_seat_id &&
        commitment.capability_offer_root ===
          plan.capability_offer_ref.record_root &&
        tick < commitment.expiry_tick &&
        plan.spend_amount === commitment.amount,
      "SUBWORK_COMMITMENT_INVALID",
    );
    addReason(
      reasons,
      sameStrings(
        commitment.funding_lot_ids,
        plan.funding_lot_refs.map((ref) => ref.record_id),
      ),
      "SUBWORK_FUNDING_LOTS_MISMATCH",
    );
  }

  const reasonCodes = [...reasons].sort();
  const decision = {
    schema: DATA_ROUTE_DECISION_SCHEMA,
    route_execution_plan_id: plan.route_execution_plan_id,
    route_execution_plan_root: context.route_execution_plan.record_root,
    evaluated_application_state_root:
      context.accepted_application_state_root,
    evaluated_logical_tick: tick,
    plan_created_application_state_root:
      plan.created_application_state_root,
    outcome: reasonCodes.length === 0 ? "ALLOW" : "HOLD",
    reason_codes: reasonCodes,
    derived_total_input_bytes: totalBytes,
    derived_spend_amount: plan.spend_amount,
  };
  return Object.freeze({
    ...decision,
    decision_root: hash("NEXUS_DATA_ROUTE_DECISION_V5", decision),
  });
}
